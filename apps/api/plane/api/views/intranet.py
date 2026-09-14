# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework.response import Response

# Module imports
from plane.api.views.base import BaseAPIView
from plane.app.serializers.intranet import (
    IntranetDeviceSerializer,
    IntranetLinkSerializer,
    IntranetNewsSerializer,
)
from plane.db.models import IntranetDevice, IntranetLink, IntranetNews
from plane.utils.permissions import WorkspaceEntityPermission


class IntranetDeviceListAPIEndpoint(BaseAPIView):
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        queryset = IntranetDevice.objects.filter(workspace__slug=slug)
        return Response(IntranetDeviceSerializer(queryset, many=True).data)


class IntranetLinkListAPIEndpoint(BaseAPIView):
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        queryset = IntranetLink.objects.filter(workspace__slug=slug)
        return Response(IntranetLinkSerializer(queryset, many=True).data)


class IntranetNewsListAPIEndpoint(BaseAPIView):
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        queryset = IntranetNews.objects.filter(workspace__slug=slug).select_related("author")
        return Response(IntranetNewsSerializer(queryset, many=True).data)
