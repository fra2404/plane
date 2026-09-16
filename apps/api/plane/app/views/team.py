# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import WorkspaceTeamMemberSerializer
from plane.app.serializers.user import UserLiteSerializer
from plane.db.models import Workspace, WorkspaceMember, WorkspaceTeamMember

from .base import BaseViewSet


def _is_workspace_admin(user, slug):
    return WorkspaceMember.objects.filter(
        workspace__slug=slug,
        member=user,
        role=ROLE.ADMIN.value,
        is_active=True,
    ).exists()


class WorkspaceTeamViewSet(BaseViewSet):
    """Workspace team directory (org chart + contacts)."""

    model = WorkspaceTeamMember
    serializer_class = WorkspaceTeamMemberSerializer

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        members = (
            WorkspaceMember.objects.filter(workspace__slug=slug, is_active=True)
            .select_related("member")
            .order_by("member__display_name")
        )
        profiles = {
            profile.user_id: profile
            for profile in WorkspaceTeamMember.objects.filter(
                workspace__slug=slug, deleted_at__isnull=True
            ).select_related("manager")
        }
        results = []
        for membership in members:
            profile = profiles.get(membership.member_id)
            results.append(
                {
                    "user_id": str(membership.member_id),
                    "user_detail": UserLiteSerializer(membership.member).data,
                    "workspace_role": membership.role,
                    "team": WorkspaceTeamMemberSerializer(profile).data if profile else None,
                }
            )
        return Response(results)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def upsert(self, request, slug, user_id):
        if not _is_workspace_admin(request.user, slug) and str(request.user.id) != str(user_id):
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        workspace = Workspace.objects.get(slug=slug)
        if not WorkspaceMember.objects.filter(
            workspace=workspace, member_id=user_id, is_active=True
        ).exists():
            return Response(
                {"error": "User is not a member of this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = WorkspaceTeamMember.objects.filter(
            workspace=workspace, user_id=user_id, deleted_at__isnull=True
        ).first()
        serializer = WorkspaceTeamMemberSerializer(
            profile,
            data={**request.data, "user": str(user_id)},
            partial=bool(profile),
        )
        if serializer.is_valid():
            if profile:
                serializer.save(updated_by=request.user)
                return Response(serializer.data, status=status.HTTP_200_OK)
            serializer.save(workspace=workspace, user_id=user_id, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def destroy(self, request, slug, user_id):
        if not _is_workspace_admin(request.user, slug) and str(request.user.id) != str(user_id):
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = WorkspaceTeamMember.objects.filter(
            workspace__slug=slug, user_id=user_id, deleted_at__isnull=True
        ).first()
        if not profile:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
