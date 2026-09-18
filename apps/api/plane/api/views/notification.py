# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.views.base import BaseAPIView
from plane.db.models import UserNotificationPreference, WorkspaceMember
from plane.utils.permissions import WorkspaceEntityPermission


class WorkspaceNotificationPreferencesAPIEndpoint(BaseAPIView):
    """Per-member Discord notification preferences, for the Discord bot.

    The bot authenticates with a workspace API key and needs the preferences of
    *other* members to decide whether to send them a DM. The internal
    `/api/users/me/notification-preferences/` endpoint is scoped to the caller,
    so this read-only workspace endpoint is exposed on the public API.
    """

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        members = (
            WorkspaceMember.objects.filter(
                workspace__slug=slug,
                is_active=True,
                member__is_bot=False,
            )
            .select_related("member")
            .distinct()
        )

        member_ids = [member.member_id for member in members]
        preferences = {
            str(preference.user_id): preference
            for preference in UserNotificationPreference.objects.filter(user_id__in=member_ids)
        }

        data = []
        for member in members:
            preference = preferences.get(str(member.member_id))
            data.append(
                {
                    "member_id": str(member.member_id),
                    "email": member.member.email,
                    "discord_assignment": preference.discord_assignment if preference else True,
                    "discord_comment": preference.discord_comment if preference else False,
                }
            )

        return Response(data, status=status.HTTP_200_OK)
