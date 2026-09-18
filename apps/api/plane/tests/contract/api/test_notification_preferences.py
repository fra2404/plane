# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the workspace Discord notification-preferences endpoint.

GET /api/v1/workspaces/<slug>/notification-preferences/
"""

import pytest
from rest_framework import status

from plane.db.models import UserNotificationPreference


def _url(slug):
    return f"/api/v1/workspaces/{slug}/notification-preferences/"


@pytest.mark.contract
class TestWorkspaceNotificationPreferences:
    @pytest.mark.django_db
    def test_returns_member_preferences_with_defaults(self, api_key_client, workspace, create_user):
        response = api_key_client.get(_url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1

        item = next((i for i in response.data if i["email"] == create_user.email), None)
        assert item is not None
        for key in ("member_id", "email", "discord_assignment", "discord_comment"):
            assert key in item
        # Defaults when no preference row is present.
        assert item["discord_assignment"] is True
        assert item["discord_comment"] is False

    @pytest.mark.django_db
    def test_reflects_stored_preferences(self, api_key_client, workspace, create_user):
        UserNotificationPreference.objects.update_or_create(
            user=create_user,
            defaults={"discord_assignment": False, "discord_comment": True},
        )

        response = api_key_client.get(_url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        item = next((i for i in response.data if i["email"] == create_user.email), None)
        assert item is not None
        assert item["discord_assignment"] is False
        assert item["discord_comment"] is True

    @pytest.mark.django_db
    def test_unknown_workspace_is_rejected(self, api_key_client):
        response = api_key_client.get(_url("does-not-exist"))
        assert response.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )
