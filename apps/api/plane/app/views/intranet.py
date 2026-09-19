# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from decimal import Decimal

from django.db.models import Sum
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import (
    ClientNoteSerializer,
    IntranetClientSerializer,
    IntranetContactSerializer,
    IntranetDeviceSerializer,
    IntranetLinkSerializer,
    IntranetNewsSerializer,
)
from plane.db.models import (
    ClientNote,
    IntranetClient,
    IntranetContact,
    IntranetDevice,
    IntranetLink,
    IntranetNews,
    IssueWorklog,
    Project,
    Workspace,
    WorklogPayment,
)

from .base import BaseViewSet


class IntranetDeviceViewSet(BaseViewSet):
    model = IntranetDevice
    serializer_class = IntranetDeviceSerializer

    def get_queryset(self):
        return IntranetDevice.objects.filter(workspace__slug=self.kwargs.get("slug"))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(IntranetDeviceSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(IntranetDeviceSerializer(obj).data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IntranetDeviceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IntranetDeviceSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IntranetLinkViewSet(BaseViewSet):
    model = IntranetLink
    serializer_class = IntranetLinkSerializer

    def get_queryset(self):
        return IntranetLink.objects.filter(workspace__slug=self.kwargs.get("slug"))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(IntranetLinkSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(IntranetLinkSerializer(obj).data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IntranetLinkSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IntranetLinkSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectUsefulLinkViewSet(BaseViewSet):
    """Project-scoped useful links. Any project member can manage them."""

    model = IntranetLink
    serializer_class = IntranetLinkSerializer

    def get_queryset(self):
        return IntranetLink.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="PROJECT")
    def list(self, request, slug, project_id):
        return Response(IntranetLinkSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="PROJECT")
    def retrieve(self, request, slug, project_id, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(IntranetLinkSerializer(obj).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def create(self, request, slug, project_id):
        workspace = Workspace.objects.get(slug=slug)
        project = Project.objects.get(id=project_id, workspace=workspace)
        serializer = IntranetLinkSerializer(data=request.data, context={"workspace_slug": slug})
        if serializer.is_valid():
            serializer.save(workspace=workspace, project=project, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def partial_update(self, request, slug, project_id, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IntranetLinkSerializer(obj, data=request.data, partial=True, context={"workspace_slug": slug})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def destroy(self, request, slug, project_id, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IntranetNewsViewSet(BaseViewSet):
    model = IntranetNews
    serializer_class = IntranetNewsSerializer

    def get_queryset(self):
        return IntranetNews.objects.filter(workspace__slug=self.kwargs.get("slug")).select_related("author")

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(IntranetNewsSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(IntranetNewsSerializer(obj).data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IntranetNewsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, author=request.user, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IntranetNewsSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IntranetClientViewSet(BaseViewSet):
    model = IntranetClient
    serializer_class = IntranetClientSerializer

    def get_queryset(self):
        return IntranetClient.objects.filter(workspace__slug=self.kwargs.get("slug")).prefetch_related("contacts")

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(IntranetClientSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        projects = Project.objects.filter(workspace=obj.workspace, client=obj, archived_at__isnull=True)
        total_logged_time = IssueWorklog.objects.filter(project__in=projects).aggregate(total=Sum("duration"))[
            "total"
        ] or 0
        total_paid_amount = WorklogPayment.objects.filter(
            project__in=projects, deleted_at__isnull=True
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        notes = ClientNote.objects.filter(client=obj).select_related("author")
        data = IntranetClientSerializer(obj).data
        data["contacts"] = IntranetContactSerializer(obj.contacts.all(), many=True).data
        data["projects"] = [
            {
                "id": str(project.id),
                "name": project.name,
                "identifier": project.identifier,
                "budget_hours": project.budget_hours,
                "budget_months": project.budget_months or {},
            }
            for project in projects
        ]
        data["total_logged_time"] = total_logged_time
        data["total_paid_amount"] = str(total_paid_amount)
        data["timeline"] = ClientNoteSerializer(notes, many=True).data
        return Response(data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IntranetClientSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IntranetClientSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IntranetContactViewSet(BaseViewSet):
    model = IntranetContact
    serializer_class = IntranetContactSerializer

    def get_queryset(self):
        return IntranetContact.objects.filter(workspace__slug=self.kwargs.get("slug"))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(IntranetContactSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(IntranetContactSerializer(obj).data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IntranetContactSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = IntranetContactSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClientNoteViewSet(BaseViewSet):
    """Timeline notes for an intranet client."""

    model = ClientNote
    serializer_class = ClientNoteSerializer

    def get_queryset(self):
        return ClientNote.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            client_id=self.kwargs.get("client_id"),
        ).select_related("author")

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug, client_id):
        return Response(ClientNoteSerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug, client_id):
        workspace = Workspace.objects.get(slug=slug)
        client = IntranetClient.objects.filter(pk=client_id, workspace=workspace).first()
        if not client:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ClientNoteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, client=client, author=request.user, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def destroy(self, request, slug, client_id, pk):
        note = self.get_queryset().filter(pk=pk).first()
        if not note:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
