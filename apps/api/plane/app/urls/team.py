# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import WorkspaceTeamViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/team/",
        WorkspaceTeamViewSet.as_view({"get": "list"}),
        name="workspace-team",
    ),
    path(
        "workspaces/<str:slug>/team/<uuid:user_id>/",
        WorkspaceTeamViewSet.as_view({"post": "upsert", "delete": "destroy"}),
        name="workspace-team-member",
    ),
]
