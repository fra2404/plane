/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { buildAlertMessage } from "@/discord/alerts";
import type { AlertmanagerAlert, AlertmanagerPayload } from "@/types";

const nodeAlert = (overrides: Partial<AlertmanagerAlert> = {}): AlertmanagerAlert => ({
  status: "firing",
  labels: { alertname: "NodeDown", instance: "k3s-node-2", severity: "critical" },
  annotations: { description: "Node k3s-node-2 has been unreachable for 5m" },
  ...overrides,
});

const buildPayload = (overrides: Partial<AlertmanagerPayload> = {}): AlertmanagerPayload => ({
  status: "firing",
  receiver: "discord-node-alerts",
  commonLabels: { alertname: "NodeDown", severity: "critical" },
  alerts: [nodeAlert()],
  ...overrides,
});

describe("buildAlertMessage", () => {
  it("builds a firing embed", () => {
    const { embeds } = buildAlertMessage(buildPayload());
    const embed = embeds[0];

    expect(embed.title).toBe("🔴 Alert: NodeDown");
    expect(embed.color).toBe(0xef4444);
    expect(embed.description).toContain("k3s-node-2");
    expect(embed.description).toContain("unreachable");
    expect(embed.fields?.some((field) => field.name === "Severity" && field.value === "critical")).toBe(true);
  });

  it("builds a resolved embed", () => {
    const { embeds } = buildAlertMessage(
      buildPayload({ status: "resolved", alerts: [nodeAlert({ status: "resolved" })] })
    );
    const embed = embeds[0];

    expect(embed.title).toBe("✅ Rientrato: NodeDown");
    expect(embed.color).toBe(0x22c55e);
  });

  it("truncates to 15 alert lines", () => {
    const alerts = Array.from({ length: 20 }, (_, index) =>
      nodeAlert({ labels: { alertname: "NodeDown", instance: `node-${index}` } })
    );
    const { embeds } = buildAlertMessage(buildPayload({ alerts }));

    expect(embeds[0].description).toContain("e altri 5 alert");
  });

  it("falls back to a generic title when the alertname is missing", () => {
    const { embeds } = buildAlertMessage(
      buildPayload({ commonLabels: {}, groupLabels: {}, alerts: [nodeAlert({ labels: { instance: "x" } })] })
    );
    expect(embeds[0].title).toBe("🔴 Alert: Alert");
  });
});
