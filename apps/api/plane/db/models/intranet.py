# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from .workspace import WorkspaceBaseModel


class IntranetDevice(WorkspaceBaseModel):
    """IP / device inventory entry (native Plane Intranet module)."""

    TYPE_CHOICES = (
        ("server", "Server"),
        ("vm", "VM"),
        ("container", "Container"),
        ("dispositivo", "Dispositivo"),
        ("altro", "Altro"),
    )

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, default="dispositivo")
    local_ip = models.CharField(max_length=64, blank=True, default="")
    vpn_ip = models.CharField(max_length=64, blank=True, default="")
    description = models.TextField(blank=True, default="")
    owner = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Intranet Device"
        verbose_name_plural = "Intranet Devices"
        db_table = "intranet_devices"
        ordering = ("name",)
        indexes = [models.Index(fields=["workspace", "name"], name="intranet_device_ws_idx")]

    def __str__(self):
        return f"{self.name} ({self.local_ip})"


class IntranetNews(WorkspaceBaseModel):
    """Internal news / announcements."""

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    author = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="intranet_news",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Intranet News"
        verbose_name_plural = "Intranet News"
        db_table = "intranet_news"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["workspace", "created_at"], name="intranet_news_ws_idx")]

    def __str__(self):
        return self.title


class IntranetLink(WorkspaceBaseModel):
    """Useful link configured by workspace admins."""

    label = models.CharField(max_length=255)
    url = models.URLField(max_length=500)
    category = models.CharField(max_length=100, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Intranet Link"
        verbose_name_plural = "Intranet Links"
        db_table = "intranet_links"
        ordering = ("sort_order", "label")
        indexes = [models.Index(fields=["workspace", "sort_order"], name="intranet_link_ws_idx")]

    def __str__(self):
        return f"{self.label} ({self.url})"
