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
import { buildWebhookMessage, sendChannelMessage, sendDirectMessage } from "@/discord/notify";
import { threadName } from "@/discord/threads";
import { env } from "@/env";
import { extractProjectId, type ChannelMapper } from "@/lib/mapping";
import { wantsAssignmentNotification, wantsCommentNotification } from "@/lib/preferences";
import { verifyPlaneSignature } from "@/lib/signature";
import type { PlaneUser, PlaneWebhookPayload, PlaneWorkItem } from "@/types";

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

/** Extract Plane member ids from an array of ids or expanded user objects. */
function extractMemberIds(value: unknown): string[] {
  if (typeof value === "string" && value) return [value];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        return (record.id as string | undefined) ?? (record.member as string | undefined);
      }
      return undefined;
    })
    .filter((id): id is string => Boolean(id));
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
      const names = new Map(members.map((member) => [member.id, member.display_name ?? member.email ?? member.id]));
      return ids.map((id) => names.get(id) ?? id);
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Unable to resolve assignee names", error);
      return [];
    }
  }

  private async buildMessage(payload: PlaneWebhookPayload): Promise<{ embeds: APIEmbed[]; content?: string } | null> {
    return buildWebhookMessage(payload, {
      webBaseUrl: this.context.webBaseUrl,
      resolveAssignees: (projectId, ids) => this.resolveAssignees(projectId, ids),
    });
  }

  /** Plane member ids that were newly assigned by this event. */
  private assignedMemberIds(payload: PlaneWebhookPayload): string[] {
    if (payload.event !== "issue") return [];
    const data = payload.data as Record<string, unknown> | null;
    const action = payload.action;
    const isCreate = action === "create" || action === "created";
    const isUpdate = action === "update" || action === "updated";

    if (isCreate) {
      return extractMemberIds(data?.assignees);
    }

    // On update Plane's webhook activity carries the changed field plus the old
    // and new values, e.g. field "assignees"/"assignee_ids".
    const field = String(payload.activity?.field ?? "").toLowerCase();
    if (isUpdate && field.includes("assign")) {
      const oldIds = new Set(extractMemberIds(payload.activity?.old_value));
      return extractMemberIds(payload.activity?.new_value).filter((id) => !oldIds.has(id));
    }

    return [];
  }

  /** Human-readable project identifier/name for notifications. */
  private async resolveProjectLabel(payload: PlaneWebhookPayload): Promise<string | undefined> {
    const data = payload.data as Record<string, unknown> | null;
    const detail = data?.project_detail as { identifier?: string; name?: string } | undefined;
    if (detail && (detail.identifier || detail.name)) {
      return [detail.identifier, detail.name].filter(Boolean).join(" · ");
    }
    const projectId = extractProjectId(payload);
    if (!projectId) return undefined;
    try {
      const project = await this.context.plane.getProject(projectId);
      return [project.identifier, project.name].filter(Boolean).join(" · ");
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Unable to resolve project name", error);
      return projectId;
    }
  }

  /** Map Plane member ids to Discord user ids using DISCORD_USER_MAPPING. */
  private async resolveDiscordUserIds(projectId: string | undefined, memberIds: string[]): Promise<string[]> {
    if (memberIds.length === 0) return [];
    const mapping = this.context.userMapping ?? {};
    // Mentions/DMs require a numeric Discord user id as the mapping key.
    const entries = Object.entries(mapping).filter(([key]) => /^\d{5,}$/.test(key));
    if (entries.length === 0) return [];

    const memberIdSet = new Set(memberIds);
    const result = new Set<string>();

    const needsEmailLookup = entries.some(([, value]) => value.includes("@") && !memberIdSet.has(value));
    let members: PlaneUser[] = [];
    if (needsEmailLookup && projectId) {
      try {
        members = await this.context.plane.listProjectMembers(projectId);
      } catch {
        members = [];
      }
    }

    for (const [discordId, value] of entries) {
      if (memberIdSet.has(value)) {
        result.add(discordId);
        continue;
      }
      if (value.includes("@")) {
        const match = members.find((member) => (member.email ?? "").toLowerCase() === value.toLowerCase());
        if (match && memberIdSet.has(match.id)) {
          result.add(discordId);
        }
      }
    }

    return [...result];
  }

  /** Assigned members who still want Discord assignment notifications. */
  private async filterAssignedByPreference(payload: PlaneWebhookPayload): Promise<string[]> {
    const memberIds = this.assignedMemberIds(payload);
    if (memberIds.length === 0) return [];
    try {
      const preferences = await this.context.plane.getNotificationPreferences();
      return memberIds.filter((id) => wantsAssignmentNotification(preferences.get(id)));
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Unable to read notification preferences, using defaults", error);
      return memberIds;
    }
  }

  /** DM the work item's assignees (who opted in) about a new comment. */
  private async notifyCommentAssignees(
    payload: PlaneWebhookPayload,
    message: { embeds: APIEmbed[]; content?: string }
  ): Promise<void> {
    const data = payload.data as Record<string, unknown> | null;
    const issueId = typeof data?.issue === "string" ? data.issue : undefined;
    const projectId = extractProjectId(payload);
    if (!issueId || !projectId) return;

    let workItem: PlaneWorkItem;
    try {
      workItem = await this.context.plane.getWorkItem(projectId, issueId);
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Unable to load work item for comment notification", error);
      return;
    }

    const assigneeIds = (workItem.assignees ?? [])
      .map((assignee) => (typeof assignee === "string" ? assignee : assignee.id))
      .filter((id): id is string => Boolean(id));
    const authorId = payload.activity?.actor?.id;
    const candidates = assigneeIds.filter((id) => id !== authorId);
    if (candidates.length === 0) return;

    let eligible: string[];
    try {
      const preferences = await this.context.plane.getNotificationPreferences();
      eligible = candidates.filter((id) => wantsCommentNotification(preferences.get(id)));
    } catch (error) {
      logger.warn("DISCORD_WEBHOOK: Unable to read notification preferences for comment", error);
      return;
    }
    if (eligible.length === 0) return;

    const discordUserIds = await this.resolveDiscordUserIds(projectId, eligible);
    if (discordUserIds.length === 0) return;

    const projectLabel = await this.resolveProjectLabel(payload);
    const content = projectLabel ? `Nuovo commento · ${projectLabel}` : "Nuovo commento";
    await Promise.all(
      discordUserIds.map((userId) => sendDirectMessage(this.bot.client, userId, { content, embeds: message.embeds }))
    );
  }

  private async dispatch(payload: PlaneWebhookPayload): Promise<void> {
    if (payload.event === "issue_comment") {
      const commentChannelId = await this.mapper.resolve(payload);
      if (!commentChannelId) {
        logger.info(`DISCORD_WEBHOOK: No channel mapped for event "${payload.event}"`);
        return;
      }
      await this.dispatchComment(payload, commentChannelId);
      return;
    }

    const message = await this.buildMessage(payload);
    if (!message) {
      return;
    }

    const assignedMemberIds = await this.filterAssignedByPreference(payload);
    const discordUserIds = assignedMemberIds.length
      ? await this.resolveDiscordUserIds(extractProjectId(payload), assignedMemberIds)
      : [];
    const isAssignment = discordUserIds.length > 0;
    const delivery = this.context.assignDelivery;

    // Assignments are delivered privately (DM) by default so a person's work
    // items are not broadcast to everyone in the project channel.
    if (isAssignment && delivery !== "channel") {
      const projectLabel = await this.resolveProjectLabel(payload);
      const content = projectLabel
        ? `Ti è stato assegnato un task\nProgetto: ${projectLabel}`
        : "Ti è stato assegnato un task";
      await Promise.all(
        discordUserIds.map((userId) =>
          sendDirectMessage(this.bot.client, userId, {
            content,
            embeds: message.embeds,
          })
        )
      );
    }

    const postToChannel = isAssignment ? delivery !== "dm" : true;
    if (!postToChannel) {
      return;
    }

    const channelId = await this.mapper.resolve(payload);
    if (!channelId) {
      logger.info(`DISCORD_WEBHOOK: No channel mapped for event "${payload.event}"`);
      return;
    }

    if (isAssignment) {
      message.content = `${discordUserIds.map((id) => `<@${id}>`).join(" ")} Ti è stato assegnato un task`;
    }

    const sent = await sendChannelMessage(this.bot.client, channelId, message);

    const isCreate = payload.action === "create" || payload.action === "created";
    if (this.context.autoThreads && payload.event === "issue" && isCreate && sent) {
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
    await this.notifyCommentAssignees(payload, message);
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
