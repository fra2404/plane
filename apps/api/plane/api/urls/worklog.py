# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    WorklogDetailAPIEndpoint,
    WorklogListCreateAPIEndpoint,
    WorkspaceWorklogSummaryAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/worklogs/",
        WorklogListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-worklog-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/worklogs/<uuid:pk>/",
        WorklogDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-worklog-detail",
    ),
    path(
        "workspaces/<str:slug>/worklog-summary/",
        WorkspaceWorklogSummaryAPIEndpoint.as_view(http_method_names=["get"]),
        name="workspace-worklog-summary",
    ),
]
