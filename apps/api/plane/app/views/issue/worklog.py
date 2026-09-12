# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, Exists, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, WorkspaceEntityPermission, allow_permission
from plane.app.serializers import IssueWorklogSerializer
from plane.app.serializers.user import UserLiteSerializer
from plane.app.views.base import BaseAPIView
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueWorklog, Project, ProjectMember, User, WorkspaceMember
from plane.utils.host import base_host

from .. import BaseViewSet


def _time_tracking_disabled_response():
    return Response(
        {"error": "Time tracking is disabled for this project."},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _get_scoped_issue(slug, project_id, issue_id):
    return Issue.objects.filter(
        pk=issue_id,
        project_id=project_id,
        workspace__slug=slug,
        project__archived_at__isnull=True,
    ).first()


def _guest_blocked_from_issue(request, slug, project_id, issue):
    return (
        ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role=ROLE.GUEST.value,
            is_active=True,
        ).exists()
        and not issue.project.guest_view_all_features
        and issue.created_by_id != request.user.id
    )


class IssueWorklogViewSet(BaseViewSet):
    serializer_class = IssueWorklogSerializer
    model = IssueWorklog

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("actor", "issue", "project", "workspace")
            .annotate(
                is_member=Exists(
                    ProjectMember.objects.filter(
                        workspace__slug=self.kwargs.get("slug"),
                        project_id=self.kwargs.get("project_id"),
                        member_id=self.request.user.id,
                        is_active=True,
                    )
                )
            )
            .order_by("-logged_at", "-created_at")
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, issue_id, pk):
        issue = _get_scoped_issue(slug, project_id, issue_id)
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if _guest_blocked_from_issue(request, slug, project_id, issue):
            return Response(
                {"error": "You are not allowed to view this issue"},
                status=status.HTTP_403_FORBIDDEN,
            )
        worklog = self.get_queryset().filter(pk=pk).first()
        if not worklog:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(IssueWorklogSerializer(worklog).data, status=status.HTTP_200_OK)

    def _total_logged_time(self, issue_id):
        total = IssueWorklog.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
            issue_id=issue_id,
        ).aggregate(total=Sum("duration"))["total"]
        return total or 0

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id, issue_id):
        issue = _get_scoped_issue(slug, project_id, issue_id)
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if _guest_blocked_from_issue(request, slug, project_id, issue):
            return Response(
                {"error": "You are not allowed to view this issue"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            order_by=request.GET.get("order_by", "-logged_at"),
            on_results=lambda worklogs: IssueWorklogSerializer(worklogs, many=True).data,
            extra_stats={"total_logged_time": self._total_logged_time(issue_id)},
            default_per_page=100,
            max_per_page=100,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def create(self, request, slug, project_id, issue_id):
        issue = _get_scoped_issue(slug, project_id, issue_id)
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        if not project.is_time_tracking_enabled:
            return _time_tracking_disabled_response()
        if _guest_blocked_from_issue(request, slug, project_id, issue):
            return Response(
                {"error": "You are not allowed to log time on this issue"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = IssueWorklogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                project_id=project_id,
                issue_id=issue_id,
                actor=request.user,
                created_by=request.user,
            )
            issue_activity.delay(
                type="worklog.activity.created",
                requested_data=json.dumps(
                    {
                        "id": str(serializer.data["id"]),
                        "duration": serializer.data["duration"],
                    },
                    cls=DjangoJSONEncoder,
                ),
                actor_id=str(request.user.id),
                issue_id=str(issue_id),
                project_id=str(project_id),
                current_instance=None,
                epoch=int(timezone.now().timestamp()),
                notification=False,
                origin=base_host(request=request, is_app=True),
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], creator=True, model=IssueWorklog)
    def partial_update(self, request, slug, project_id, issue_id, pk):
        issue = _get_scoped_issue(slug, project_id, issue_id)
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        if not project.is_time_tracking_enabled:
            return _time_tracking_disabled_response()

        worklog = IssueWorklog.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            issue_id=issue_id,
            pk=pk,
        ).first()
        if not worklog:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_instance = json.dumps(IssueWorklogSerializer(worklog).data, cls=DjangoJSONEncoder)
        serializer = IssueWorklogSerializer(worklog, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            issue_activity.delay(
                type="worklog.activity.updated",
                requested_data=json.dumps(
                    {
                        "id": str(pk),
                        "duration": serializer.data["duration"],
                    },
                    cls=DjangoJSONEncoder,
                ),
                actor_id=str(request.user.id),
                issue_id=str(issue_id),
                project_id=str(project_id),
                current_instance=current_instance,
                epoch=int(timezone.now().timestamp()),
                notification=False,
                origin=base_host(request=request, is_app=True),
            )
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], creator=True, model=IssueWorklog)
    def destroy(self, request, slug, project_id, issue_id, pk):
        issue = _get_scoped_issue(slug, project_id, issue_id)
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        worklog = IssueWorklog.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            issue_id=issue_id,
            pk=pk,
        ).first()
        if not worklog:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        current_instance = json.dumps(
            {"id": str(pk), "duration": worklog.duration},
            cls=DjangoJSONEncoder,
        )
        worklog.delete()
        issue_activity.delay(
            type="worklog.activity.deleted",
            requested_data=json.dumps({"worklog_id": str(pk)}),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=False,
            origin=base_host(request=request, is_app=True),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceWorklogSummaryEndpoint(BaseAPIView):
    """Workspace-level worklog recap for admins: hours per user per work item."""

    permission_classes = [WorkspaceEntityPermission]

    def get(self, request, slug):
        is_admin = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            role=ROLE.ADMIN.value,
            is_active=True,
        ).exists()
        if not is_admin:
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        worklogs = (
            IssueWorklog.objects.filter(
                workspace__slug=slug,
                project__project_projectmember__member=request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("actor", "project", "issue")
            .distinct()
        )

        project_id = request.GET.get("project_id")
        if project_id:
            worklogs = worklogs.filter(project_id=project_id)

        actor_id = request.GET.get("actor_id")
        if actor_id:
            worklogs = worklogs.filter(actor_id=actor_id)

        date_from = parse_date(request.GET.get("date_from", "")) if request.GET.get("date_from") else None
        date_to = parse_date(request.GET.get("date_to", "")) if request.GET.get("date_to") else None
        if date_from:
            worklogs = worklogs.filter(logged_at__date__gte=date_from)
        if date_to:
            worklogs = worklogs.filter(logged_at__date__lte=date_to)

        rows = list(
            worklogs.values("issue_id", "issue__name", "issue__project_id", "project__name", "actor_id")
            .annotate(duration=Sum("duration"), worklog_count=Count("id"))
            .order_by("-duration")
        )

        actor_ids = {row["actor_id"] for row in rows if row["actor_id"]}
        actors = {user.id: UserLiteSerializer(user).data for user in User.objects.filter(id__in=actor_ids)}

        results = [
            {
                "issue_id": str(row["issue_id"]),
                "issue_name": row["issue__name"],
                "project_id": str(row["issue__project_id"]),
                "project_name": row["project__name"],
                "actor_id": str(row["actor_id"]) if row["actor_id"] else None,
                "actor_detail": actors.get(row["actor_id"]),
                "duration": row["duration"] or 0,
                "worklog_count": row["worklog_count"],
            }
            for row in rows
        ]

        user_totals_rows = (
            worklogs.values("actor_id").annotate(duration=Sum("duration"), worklog_count=Count("id")).order_by("-duration")
        )
        user_totals = [
            {
                "actor_id": str(row["actor_id"]) if row["actor_id"] else None,
                "actor_detail": actors.get(row["actor_id"]),
                "duration": row["duration"] or 0,
                "worklog_count": row["worklog_count"],
            }
            for row in user_totals_rows
        ]

        total_logged_time = sum(row["duration"] for row in results)

        return Response(
            {
                "group_by": "user-task",
                "total_logged_time": total_logged_time,
                "results": results,
                "user_totals": user_totals,
            },
            status=status.HTTP_200_OK,
        )
