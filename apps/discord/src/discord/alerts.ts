/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { APIEmbed } from "discord.js";
import type { AlertmanagerAlert, AlertmanagerPayload } from "@/types";

const FIRING_COLOR = 0xef4444;
const RESOLVED_COLOR = 0x22c55e;
const MAX_ALERT_LINES = 15;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function alertTarget(alert: AlertmanagerAlert): string {
  const { labels } = alert;
  const name = labels.node ?? labels.host ?? labels.pod ?? labels.deployment ?? labels.job;
  const address = labels.instance;

  if (name && address && name !== address) {
    return `${name} (${address})`;
  }

  return name ?? address ?? labels.alertname ?? alert.fingerprint ?? "unknown target";
}

function alertDescription(alert: AlertmanagerAlert): string {
  return alert.annotations.summary ?? alert.annotations.description ?? "";
}

/**
 * Convert an Alertmanager webhook payload (v4) into a Discord message.
 */
export function buildAlertMessage(payload: AlertmanagerPayload): { embeds: APIEmbed[] } {
  const firing = payload.status === "firing";
  const alertname = payload.commonLabels?.alertname ?? payload.groupLabels?.alertname ?? "Alert";

  const lines = payload.alerts.slice(0, MAX_ALERT_LINES).map((alert) => {
    const target = alertTarget(alert);
    if (alert.status !== "firing") {
      return `✅ **${target}** — rientrato`;
    }
    const description = alertDescription(alert);
    return `🔴 **${target}**${description ? ` — ${description}` : ""}`;
  });

  const hidden = payload.alerts.length - MAX_ALERT_LINES;
  if (hidden > 0) {
    lines.push(`… e altri ${hidden} alert`);
  }

  const fields: NonNullable<APIEmbed["fields"]> = [{ name: "Alert", value: alertname, inline: true }];
  const severity = payload.commonLabels?.severity;
  if (severity) {
    fields.push({ name: "Severity", value: severity, inline: true });
  }
  const namespace = payload.commonLabels?.namespace;
  if (namespace) {
    fields.push({ name: "Namespace", value: namespace, inline: true });
  }

  return {
    embeds: [
      {
        title: truncate(`${firing ? "🔴 Alert" : "✅ Rientrato"}: ${alertname}`, 256),
        description: truncate(lines.join("\n") || "—", 4096),
        color: firing ? FIRING_COLOR : RESOLVED_COLOR,
        fields,
        footer: { text: `Alertmanager${payload.receiver ? ` · ${payload.receiver}` : ""}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
