/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { Controller, Post } from "@plane/decorators";
import { logger } from "@plane/logger";
import { buildAlertMessage } from "@/discord/alerts";
import type { DiscordBot } from "@/discord/client";
import { sendChannelMessage } from "@/discord/notify";
import { env } from "@/env";
import type { AlertmanagerPayload } from "@/types";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

function isAuthorized(req: Request): boolean {
  if (!env.ALERTMANAGER_TOKEN) {
    return true;
  }
  const bearer = req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  const provided = req.header("X-Alertmanager-Token") ?? bearer;
  return typeof provided === "string" && safeEqual(provided, env.ALERTMANAGER_TOKEN);
}

@Controller("/webhooks")
export class AlertController {
  [key: string]: unknown;

  constructor(private readonly bot: DiscordBot) {}

  @Post("/alertmanager")
  async handleAlertmanagerWebhook(req: Request, res: Response): Promise<void> {
    if (!isAuthorized(req)) {
      logger.warn("DISCORD_ALERTS: Rejected alertmanager webhook with invalid token");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = req.body as AlertmanagerPayload | undefined;
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.alerts)) {
      res.status(400).json({ error: "Invalid Alertmanager payload" });
      return;
    }

    // Acknowledge immediately so Alertmanager does not retry while we talk to Discord.
    res.status(200).json({ ok: true });

    try {
      const channelId = env.DISCORD_ALERTS_CHANNEL_ID ?? env.DISCORD_DEFAULT_CHANNEL_ID;
      if (!channelId) {
        logger.warn("DISCORD_ALERTS: No alerts channel configured");
        return;
      }
      await sendChannelMessage(this.bot.client, channelId, buildAlertMessage(payload));
    } catch (error) {
      logger.error("DISCORD_ALERTS: Failed to dispatch alert", error);
    }
  }
}
