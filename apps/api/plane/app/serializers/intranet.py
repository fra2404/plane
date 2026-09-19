# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from decimal import Decimal

from rest_framework import serializers

from plane.app.serializers.base import BaseSerializer
from plane.app.serializers.user import UserLiteSerializer
from plane.db.models import (
    ClientNote,
    IntranetClient,
    IntranetContact,
    IntranetDevice,
    IntranetLink,
    IntranetNews,
    IntranetOpportunity,
    IntranetQuote,
)


class IntranetDeviceSerializer(BaseSerializer):
    class Meta:
        model = IntranetDevice
        fields = [
            "id",
            "workspace",
            "name",
            "type",
            "local_ip",
            "vpn_ip",
            "description",
            "owner",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value


class IntranetNewsSerializer(BaseSerializer):
    author_detail = UserLiteSerializer(read_only=True, source="author")

    class Meta:
        model = IntranetNews
        fields = [
            "id",
            "workspace",
            "title",
            "description",
            "tags",
            "author",
            "author_detail",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "author",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate_title(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Title is required.")
        return value

    def validate_tags(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list of strings.")
        return [str(tag) for tag in value]


class IntranetLinkSerializer(BaseSerializer):
    class Meta:
        model = IntranetLink
        fields = [
            "id",
            "workspace",
            "project",
            "label",
            "url",
            "category",
            "description",
            "sort_order",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]

    def validate_label(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Label is required.")
        return value

    def validate_project(self, value):
        if value is None:
            return value
        workspace_slug = self.context.get("workspace_slug")
        if workspace_slug and value.workspace.slug != workspace_slug:
            raise serializers.ValidationError("Project does not belong to this workspace.")
        return value


class IntranetClientSerializer(BaseSerializer):
    class Meta:
        model = IntranetClient
        fields = [
            "id",
            "workspace",
            "name",
            "vat",
            "email",
            "phone",
            "website",
            "address",
            "notes",
            "status",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value


class IntranetContactSerializer(BaseSerializer):
    class Meta:
        model = IntranetContact
        fields = [
            "id",
            "workspace",
            "client",
            "name",
            "role",
            "email",
            "phone",
            "mobile",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value


class ClientNoteSerializer(BaseSerializer):
    author_detail = UserLiteSerializer(read_only=True, source="author")
    assignee_detail = UserLiteSerializer(read_only=True, source="assignee")

    class Meta:
        model = ClientNote
        fields = [
            "id",
            "workspace",
            "client",
            "author",
            "author_detail",
            "kind",
            "content",
            "occurred_at",
            "due_date",
            "is_done",
            "assignee",
            "assignee_detail",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "author", "created_at", "updated_at", "created_by", "updated_by"]


class IntranetOpportunitySerializer(BaseSerializer):
    client_detail = IntranetClientSerializer(read_only=True, source="client")
    owner_detail = UserLiteSerializer(read_only=True, source="owner")

    class Meta:
        model = IntranetOpportunity
        fields = [
            "id",
            "workspace",
            "name",
            "client",
            "client_detail",
            "stage",
            "value",
            "expected_close_date",
            "owner",
            "owner_detail",
            "notes",
            "sort_order",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]


class IntranetQuoteSerializer(BaseSerializer):
    client_detail = IntranetClientSerializer(read_only=True, source="client")
    total = serializers.SerializerMethodField()

    class Meta:
        model = IntranetQuote
        fields = [
            "id",
            "workspace",
            "title",
            "code",
            "client",
            "client_detail",
            "opportunity",
            "status",
            "amount",
            "tax_rate",
            "total",
            "issued_date",
            "valid_until",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]

    def get_total(self, obj):
        amount = obj.amount or 0
        tax_rate = obj.tax_rate or 0
        return str((amount * (1 + tax_rate / 100)).quantize(Decimal("0.01")))
