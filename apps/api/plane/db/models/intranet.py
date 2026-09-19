# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.utils import timezone

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


class IntranetClient(WorkspaceBaseModel):
    """Client registry (anagrafica clienti)."""

    STATUS_CHOICES = (
        ("active", "Attivo"),
        ("prospect", "Prospect"),
        ("inactive", "Inattivo"),
    )

    name = models.CharField(max_length=255)
    vat = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    website = models.CharField(max_length=255, blank=True, default="")
    address = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        verbose_name = "Intranet Client"
        verbose_name_plural = "Intranet Clients"
        db_table = "intranet_clients"
        ordering = ("name",)
        indexes = [models.Index(fields=["workspace", "name"], name="intranet_client_ws_idx")]

    def __str__(self):
        return self.name


class IntranetContact(WorkspaceBaseModel):
    """Client contact (referente), optionally linked to a client."""

    client = models.ForeignKey(
        "db.IntranetClient",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contacts",
    )
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=150, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    mobile = models.CharField(max_length=50, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Intranet Contact"
        verbose_name_plural = "Intranet Contacts"
        db_table = "intranet_contacts"
        ordering = ("name",)
        indexes = [models.Index(fields=["workspace", "name"], name="intranet_contact_ws_idx")]

    def __str__(self):
        return self.name


class ClientNote(WorkspaceBaseModel):
    """Timeline entry for a client (note, call, meeting, email...)."""

    KIND_CHOICES = (
        ("nota", "Nota"),
        ("chiamata", "Chiamata"),
        ("meeting", "Meeting"),
        ("email", "Email"),
        ("altro", "Altro"),
    )

    client = models.ForeignKey("db.IntranetClient", on_delete=models.CASCADE, related_name="timeline_entries")
    author = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="client_notes",
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="nota")
    content = models.TextField(blank=True, default="")
    occurred_at = models.DateTimeField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    is_done = models.BooleanField(default=False)
    assignee = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="client_activities",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Client Note"
        verbose_name_plural = "Client Notes"
        db_table = "intranet_client_notes"
        ordering = ("-occurred_at", "-created_at")
        indexes = [models.Index(fields=["workspace", "client", "occurred_at"], name="client_note_ws_client_idx")]

    def __str__(self):
        return f"{self.client_id} {self.kind}"


class IntranetOpportunity(WorkspaceBaseModel):
    """Sales opportunity / deal for the CRM pipeline."""

    STAGE_CHOICES = (
        ("lead", "Lead"),
        ("contattato", "Contattato"),
        ("preventivo", "Preventivo"),
        ("negoziazione", "Negoziazione"),
        ("vinto", "Vinto"),
        ("perso", "Perso"),
    )

    name = models.CharField(max_length=255)
    client = models.ForeignKey(
        "db.IntranetClient",
        on_delete=models.SET_NULL,
        related_name="opportunities",
        null=True,
        blank=True,
    )
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="lead")
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    expected_close_date = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="owned_opportunities",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True, default="")
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Intranet Opportunity"
        verbose_name_plural = "Intranet Opportunities"
        db_table = "intranet_opportunities"
        ordering = ("stage", "sort_order", "-created_at")
        indexes = [models.Index(fields=["workspace", "stage"], name="intranet_opp_ws_stage_idx")]

    def __str__(self):
        return f"{self.name} ({self.stage})"


class IntranetQuote(WorkspaceBaseModel):
    """Quote / preventivo for a client."""

    STATUS_CHOICES = (
        ("bozza", "Bozza"),
        ("inviato", "Inviato"),
        ("accettato", "Accettato"),
        ("rifiutato", "Rifiutato"),
        ("scaduto", "Scaduto"),
    )

    title = models.CharField(max_length=255)
    code = models.CharField(max_length=64, blank=True, default="")
    client = models.ForeignKey(
        "db.IntranetClient",
        on_delete=models.CASCADE,
        related_name="quotes",
    )
    opportunity = models.ForeignKey(
        "db.IntranetOpportunity",
        on_delete=models.SET_NULL,
        related_name="quotes",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="bozza")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=22)
    issued_date = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Intranet Quote"
        verbose_name_plural = "Intranet Quotes"
        db_table = "intranet_quotes"
        ordering = ("-issued_date", "-created_at")
        indexes = [models.Index(fields=["workspace", "status"], name="intranet_quote_ws_status_idx")]

    def __str__(self):
        return f"{self.title} ({self.status})"
