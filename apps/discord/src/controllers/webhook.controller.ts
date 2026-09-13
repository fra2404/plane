/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { APIEmbed, Message } from "discord.js";
import type { Request, Response } from "express";
import { Controller, Post } from "@plane/decorators";
import { logger } from "@plane/logger";
import type { AppContext } from "@/context";
import type { DiscordBot } from "@/discord/client";
import { buildWebhookMessage, sendChannelMessage } from "@/discord/notify";
import { threadName } from "@/discord/threads";
import { env } from "@/env";
import { extractProjectId, type ChannelMapper } from "@/lib/mapping";
import { verifyPlaneSignature } from "@/lib/signature";
import type { PlaneWebhookPayload } from "@/types";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function resolveSecret(payload: PlaneWebhookPayload): string | undefined {
  const mapped = env.PLANE_WEBHOOK_SECRETS[payload.webhook_id];
  if (mapped) {
    return mapped;
  }
  return env.PLANE_WEBHOOK_SECRET || undefined;
}

@Controller("/webhooks")
export class WebhookController {
  [key: string]: unknown;

  constructor(
    private readonly bot: DiscordBot,
    private readonly mapper: ChannelMapper,
    private readonly context: AppContext
  ) {}

  @Post("/plane")
  async handlePlaneWebhook(req: Request, res: Response): Promise<void> {
    const payload = req.body as PlaneWebhookPayload | undefined;
    const rawBody = (req as RawBodyRequest).rawBody;

    if (!payload || typeof payload !== "object" || !rawBody) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const secret = resolveSecret(payload);
    if (!secret) {
      logger.warn(`DISCORD_WEBHOOK: No secret configured for webhook ${payload.webhook_id}`);
      res.status(401).json({ error: "Webhook secret not configured" });
      return;
    }

    const signature = req.header("X-Plane-Signature");
    if (!verifyPlaneSignature(rawBody, signature, secret)) {
      logger.warn(`DISCORD_WEBHOOK: Invalid signature for webhook ${payload.webhook_id}`);
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Acknowledge immediately so Plane does not retry while we talk to Discord.
    res.status(200).json({ ok: true });

    try {
      await this.dispatch(payload);
    } catch (error) {
      logger.error("DISCORD_WEBHOOK: Failed to dispatch notification", error);
    }
  }

  private async resolveAssignees(projectId: string | undefined, ids: string[]): Promise<string[]> {
    if (!projectId || ids.length === 0) return [];
    try {
      const members = await this.context.plane.listProjectMembers(projectId);
      const names = new Map(members.map(({ member }) => [member.id, member.display_name ?? member.email ?? member.id]));
      return ids.map((id) => names.get(id) ?? id);
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Unable to resolve assignee names", error);
      return [];
    }
  }

  private async buildMessage(payload: PlaneWebhookPayload): Promise<{ embeds: APIEmbed[] } | null> {
    return buildWebhookMessage(payload, {
      webBaseUrl: this.context.webBaseUrl,
      resolveAssignees: (projectId, ids) => this.resolveAssignees(projectId, ids),
    });
  }

  private async dispatch(payload: PlaneWebhookPayload): Promise<void> {
    const channelId = await this.mapper.resolve(payload);
    if (!channelId) {
      logger.info(`DISCORD_WEBHOOK: No channel mapped for event "${payload.event}"`);
      return;
    }

    if (payload.event === "issue_comment") {
      await this.dispatchComment(payload, channelId);
      return;
    }

    const message = await this.buildMessage(payload);
    if (!message) {
      return;
    }

    const sent = await sendChannelMessage(this.bot.client, channelId, message);

    if (this.context.autoThreads && payload.event === "issue" && payload.action === "create" && sent) {
      await this.createIssueThread(payload, sent, channelId);
    }
  }

  private async dispatchComment(payload: PlaneWebhookPayload, channelId: string): Promise<void> {
    const data = payload.data as Record<string, unknown> | null;

    // Comments that originated from Discord are already visible in the thread.
    if (data?.external_source === "discord") {
      return;
    }

    const issueId = typeof data?.issue === "string" ? data.issue : undefined;
    const link = issueId ? await this.context.linkStore.getByIssue(issueId) : undefined;

    const message = await this.buildMessage(payload);
    if (!message) {
      return;
    }

    await sendChannelMessage(this.bot.client, link?.threadId ?? channelId, message);
  }

  private async createIssueThread(
    payload: PlaneWebhookPayload,
    sourceMessage: Message,
    channelId: string
  ): Promise<void> {
    const data = payload.data as Record<string, unknown> | null;
    const issueId = typeof data?.id === "string" ? data.id : undefined;
    const projectId = extractProjectId(payload);

    if (!data || !issueId || !projectId) {
      return;
    }

    try {
      const thread = await sourceMessage.startThread({
        name: threadName(data),
        autoArchiveDuration: this.context.threadAutoArchiveMinutes as 60 | 1440 | 4320 | 10080,
      });
      await this.context.linkStore.save({
        issueId,
        projectId,
        workspaceSlug: payload.workspace_slug,
        channelId,
        threadId: thread.id,
      });
      logger.info(`DISCORD_WEBHOOK: Created thread ${thread.id} for work item ${issueId}`);
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Failed to create thread for work item", error);
    }
  }
}
