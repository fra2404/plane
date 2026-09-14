# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.api.serializers import IssueSerializer
from plane.api.views.base import BaseAPIView
from plane.db.models import Issue
from plane.utils.permissions import WorkspaceEntityPermission


class WorkspaceMyWorkItemsAPIEndpoint(BaseAPIView):
    """Workspace-level work items assigned to a user (defaults to the caller)."""

    serializer_class = IssueSerializer
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        assignee_id = request.GET.get("assignee_id") or request.user.id
        queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .filter(
                project__project_projectmember__member=request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .filter(assignees__id=assignee_id)
            .select_related("project", "workspace", "state")
            .prefetch_related("assignees", "labels")
            .order_by(request.GET.get("order_by", "-created_at"))
            .distinct()
        )
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: IssueSerializer(x, many=True, fields=self.fields, expand=self.expand).data,
            default_per_page=50,
            max_per_page=100,
        )
