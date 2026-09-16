# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.app.serializers.base import BaseSerializer
from plane.app.serializers.user import UserLiteSerializer
from plane.db.models import WorkspaceTeamMember


class WorkspaceTeamMemberSerializer(BaseSerializer):
    user_detail = UserLiteSerializer(read_only=True, source="user")
    manager_detail = UserLiteSerializer(read_only=True, source="manager")

    class Meta:
        model = WorkspaceTeamMember
        fields = [
            "id",
            "workspace",
            "user",
            "user_detail",
            "role",
            "department",
            "manager",
            "manager_detail",
            "phone",
            "discord_id",
            "location",
            "hire_date",
            "linkedin",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at", "created_by", "updated_by"]
