# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers.base import BaseSerializer
from plane.app.serializers.user import UserLiteSerializer
from plane.db.models import IntranetClient, IntranetContact, IntranetDevice, IntranetLink, IntranetNews


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
