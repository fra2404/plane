# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    IntranetClientViewSet,
    IntranetContactViewSet,
    IntranetDeviceViewSet,
    IntranetLinkViewSet,
    IntranetNewsViewSet,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/intranet/devices/",
        IntranetDeviceViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-intranet-devices",
    ),
    path(
        "workspaces/<str:slug>/intranet/devices/<uuid:pk>/",
        IntranetDeviceViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="workspace-intranet-device",
    ),
    path(
        "workspaces/<str:slug>/intranet/links/",
        IntranetLinkViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-intranet-links",
    ),
    path(
        "workspaces/<str:slug>/intranet/links/<uuid:pk>/",
        IntranetLinkViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-intranet-link",
    ),
    path(
        "workspaces/<str:slug>/intranet/news/",
        IntranetNewsViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-intranet-news",
    ),
    path(
        "workspaces/<str:slug>/intranet/news/<uuid:pk>/",
        IntranetNewsViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-intranet-news-item",
    ),
    path(
        "workspaces/<str:slug>/intranet/clients/",
        IntranetClientViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-intranet-clients",
    ),
    path(
        "workspaces/<str:slug>/intranet/clients/<uuid:pk>/",
        IntranetClientViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-intranet-client",
    ),
    path(
        "workspaces/<str:slug>/intranet/contacts/",
        IntranetContactViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-intranet-contacts",
    ),
    path(
        "workspaces/<str:slug>/intranet/contacts/<uuid:pk>/",
        IntranetContactViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-intranet-contact",
    ),
]
