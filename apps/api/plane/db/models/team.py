# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from .workspace import WorkspaceBaseModel


class WorkspaceTeamMember(WorkspaceBaseModel):
    """Workspace-scoped team/employee contact card (org chart + contacts)."""

    user = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="team_memberships")
    role = models.CharField(max_length=255, blank=True, default="")
    department = models.CharField(max_length=150, blank=True, default="")
    manager = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="team_reports",
        null=True,
        blank=True,
    )
    phone = models.CharField(max_length=50, blank=True, default="")
    discord_id = models.CharField(max_length=64, blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    hire_date = models.DateField(null=True, blank=True)
    linkedin = models.CharField(max_length=300, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Workspace Team Member"
        verbose_name_plural = "Workspace Team Members"
        db_table = "workspace_team_members"
        ordering = ("user__display_name",)
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                condition=models.Q(deleted_at__isnull=True),
                name="team_member_unique_workspace_user",
            )
        ]
        indexes = [models.Index(fields=["workspace", "user"], name="team_member_ws_user_idx")]

    def __str__(self):
        return f"{self.user_id} @ {self.workspace_id}"
