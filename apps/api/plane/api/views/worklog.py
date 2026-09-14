# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils.dateparse import parse_date

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.serializers import UserLiteSerializer
from plane.api.views.base import BaseAPIView
from plane.app.serializers.worklog import IssueWorklogSerializer
from plane.db.models import IssueWorklog, Project, User
from plane.utils.permissions import ProjectEntityPermission, WorkspaceOwnerPermission


class WorklogListCreateAPIEndpoint(BaseAPIView):
    """Public v1 worklog endpoints for a work item (API-key authenticated)."""

    serializer_class = IssueWorklogSerializer
    model = IssueWorklog
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueWorklog.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("work_item_id"))
            .select_related("actor", "issue", "project", "workspace")
            .order_by("-logged_at", "-created_at")
            .distinct()
        )

    def get(self, request, slug, project_id, work_item_id):
        worklogs = self.get_queryset()
        total_logged_time = worklogs.aggregate(total=Sum("duration"))["total"] or 0
        return self.paginate(
            request=request,
            queryset=worklogs,
            order_by=request.GET.get("order_by", "-logged_at"),
            on_results=lambda x: IssueWorklogSerializer(x, many=True).data,
            extra_stats={"total_logged_time": total_logged_time},
            default_per_page=100,
            max_per_page=100,
        )

    def post(self, request, slug, project_id, work_item_id):
        project = Project.objects.filter(pk=project_id, workspace__slug=slug).first()
        if not project or not project.is_time_tracking_enabled:
            return Response(
                {"error": "Time tracking is disabled for this project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = IssueWorklogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                project_id=project_id,
                issue_id=work_item_id,
                actor=request.user,
                created_by=request.user,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorklogDetailAPIEndpoint(BaseAPIView):
    serializer_class = IssueWorklogSerializer
    model = IssueWorklog
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return IssueWorklog.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
            issue_id=self.kwargs.get("work_item_id"),
            pk=self.kwargs.get("pk"),
        )

    def get(self, request, slug, project_id, work_item_id, pk):
        worklog = self.get_queryset().first()
        if not worklog:
            return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueWorklogSerializer(worklog).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, work_item_id, pk):
        worklog = self.get_queryset().first()
        if not worklog:
            return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IssueWorklogSerializer(worklog, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, work_item_id, pk):
        worklog = self.get_queryset().first()
        if not worklog:
            return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        worklog.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceWorklogSummaryAPIEndpoint(BaseAPIView):
    """Workspace worklog recap (admins only) for the Discord bot / reports."""

    permission_classes = [WorkspaceOwnerPermission]

    def get(self, request, slug):
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
            worklogs.values("issue_id", "issue__name", "project_id", "project__name", "actor_id")
            .annotate(duration=Sum("duration"), worklog_count=Count("id"))
            .order_by("-duration")
        )
        user_rows = list(
            worklogs.values("actor_id")
            .annotate(duration=Sum("duration"), worklog_count=Count("id"))
            .order_by("-duration")
        )
        monthly_rows = list(
            worklogs.annotate(month=TruncMonth("logged_at"))
            .values("month")
            .annotate(duration=Sum("duration"), worklog_count=Count("id"))
            .order_by("-month")
        )

        actor_ids = {row["actor_id"] for row in rows if row["actor_id"]}
        actor_ids |= {row["actor_id"] for row in user_rows if row["actor_id"]}
        actors = {user.id: UserLiteSerializer(user).data for user in User.objects.filter(id__in=actor_ids)}

        results = [
            {
                "issue_id": str(row["issue_id"]),
                "issue_name": row["issue__name"],
                "project_id": str(row["project_id"]) if row["project_id"] else None,
                "project_name": row["project__name"],
                "actor_id": str(row["actor_id"]) if row["actor_id"] else None,
                "actor_detail": actors.get(row["actor_id"]),
                "duration": row["duration"] or 0,
                "worklog_count": row["worklog_count"],
            }
            for row in rows
        ]
        user_totals = [
            {
                "actor_id": str(row["actor_id"]) if row["actor_id"] else None,
                "actor_detail": actors.get(row["actor_id"]),
                "duration": row["duration"] or 0,
                "worklog_count": row["worklog_count"],
            }
            for row in user_rows
        ]
        monthly_totals = [
            {
                "month": row["month"].strftime("%Y-%m"),
                "duration": row["duration"] or 0,
                "worklog_count": row["worklog_count"],
            }
            for row in monthly_rows
            if row["month"]
        ]

        return Response(
            {
                "total_logged_time": sum(row["duration"] or 0 for row in results),
                "results": results,
                "user_totals": user_totals,
                "monthly_totals": monthly_totals,
            },
            status=status.HTTP_200_OK,
        )
