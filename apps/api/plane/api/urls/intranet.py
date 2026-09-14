# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    IntranetDeviceListAPIEndpoint,
    IntranetLinkListAPIEndpoint,
    IntranetNewsListAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/intranet/devices/",
        IntranetDeviceListAPIEndpoint.as_view(http_method_names=["get"]),
        name="intranet-device-list",
    ),
    path(
        "workspaces/<str:slug>/intranet/links/",
        IntranetLinkListAPIEndpoint.as_view(http_method_names=["get"]),
        name="intranet-link-list",
    ),
    path(
        "workspaces/<str:slug>/intranet/news/",
        IntranetNewsListAPIEndpoint.as_view(http_method_names=["get"]),
        name="intranet-news-list",
    ),
]
