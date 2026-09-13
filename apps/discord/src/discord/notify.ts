/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { APIEmbed, Client, Message, TextChannel } from "discord.js";
import { logger } from "@plane/logger";
import type { PlaneWebhookPayload } from "@/types";

const PRIORITY_COLORS: Record<string, number> = {
  urgent: 0xe11d48,
  high: 0xf97316,
  medium: 0xfacc15,
  low: 0x3b82f6,
  none: 0x9ca3af,
};

const STATE_GROUP_COLORS: Record<string, number> = {
  backlog: 0x9ca3af,
  unstarted: 0x6b7280,
  started: 0x3b82f6,
  completed: 0x22c55e,
  cancelled: 0xef4444,
};

const ACTION_LABELS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
};

const EVENT_LABELS: Record<string, string> = {
  project: "Project",
  issue: "Work item",
  module: "Module",
  cycle: "Cycle",
  issue_comment: "Comment",
};

type WebhookData = Record<string, unknown>;

export type AssigneeResolver = (projectId: string | undefined, ids: string[]) => Promise<string[]>;

function asRecord(value: unknown): WebhookData | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as WebhookData) : undefined;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(", ") || "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function issueUrl(data: WebhookData, workspaceSlug: string, webBaseUrl: string): string | undefined {
  const projectId = data.project;
  const issueId = data.id;
  if (typeof projectId !== "string" || typeof issueId !== "string") {
    return undefined;
  }
  return `${webBaseUrl.replace(/\/$/, "")}/${workspaceSlug}/projects/${projectId}/work-items/${issueId}`;
}

function resolveColor(data: WebhookData): number {
  const state = asRecord(data.state);
  if (state && typeof state.group === "string" && STATE_GROUP_COLORS[state.group] !== undefined) {
    return STATE_GROUP_COLORS[state.group];
  }
  if (typeof data.priority === "string" && PRIORITY_COLORS[data.priority] !== undefined) {
    return PRIORITY_COLORS[data.priority];
  }
  return 0x5e6ad2;
}

async function buildIssueEmbed(
  payload: PlaneWebhookPayload,
  data: WebhookData,
  webBaseUrl: string,
  resolveAssignees?: AssigneeResolver
): Promise<APIEmbed> {
  const action = ACTION_LABELS[payload.action] ?? payload.action;
  const identifier = typeof data.sequence_id === "number" ? `#${data.sequence_id}` : "Work item";
  const name = typeof data.name === "string" ? data.name : identifier;

  const fields: APIEmbed["fields"] = [];
  const state = asRecord(data.state);
  if (state && typeof state.name === "string") {
    fields.push({ name: "State", value: state.name, inline: true });
  }
  if (typeof data.priority === "string") {
    fields.push({ name: "Priority", value: data.priority, inline: true });
  }

  const rawAssignees = data.assignees;
  if (Array.isArray(rawAssignees) && rawAssignees.length > 0) {
    const objectNames = rawAssignees
      .map((assignee) => {
        if (typeof assignee === "string") return undefined;
        const record = asRecord(assignee);
        return (record?.display_name as string) ?? (record?.email as string) ?? undefined;
      })
      .filter((value): value is string => Boolean(value));

    let value: string;
    if (objectNames.length === rawAssignees.length) {
      value = objectNames.join(", ");
    } else {
      const ids = rawAssignees
        .map((assignee) =>
          typeof assignee === "string" ? assignee : ((asRecord(assignee)?.id as string) ?? undefined)
        )
        .filter((id): id is string => Boolean(id));
      const projectId = typeof data.project === "string" ? data.project : undefined;
      const names = resolveAssignees && ids.length ? await resolveAssignees(projectId, ids) : [];
      value = (names.length ? names : ids).join(", ");
    }
    fields.push({ name: "Assignees", value: truncate(value, 1024), inline: true });
  }

  const activity = payload.activity;
  if (activity?.field) {
    fields.push({
      name: `Change · ${activity.field}`,
      value: truncate(`${stringifyValue(activity.old_value)} → ${stringifyValue(activity.new_value)}`, 1024),
    });
  }

  return {
    title: truncate(`${identifier} · ${name}`, 256),
    url: issueUrl(data, payload.workspace_slug, webBaseUrl),
    color: resolveColor(data),
    fields,
    footer: { text: `Plane · work item ${action}` },
    timestamp: new Date().toISOString(),
  };
}

function buildCommentEmbed(payload: PlaneWebhookPayload, data: WebhookData, webBaseUrl: string): APIEmbed {
  const action = ACTION_LABELS[payload.action] ?? payload.action;
  const issueDetail = asRecord(data.issue_detail);
  const issueName = typeof issueDetail?.name === "string" ? issueDetail.name : "work item";
  const sequenceId = issueDetail?.sequence_id;
  const title = sequenceId !== undefined ? `Comment on #${sequenceId} · ${issueName}` : `Comment on ${issueName}`;

  const rawBody =
    typeof data.comment_stripped === "string"
      ? data.comment_stripped
      : typeof data.comment_html === "string"
        ? stripHtml(data.comment_html)
        : "—";

  const projectId = typeof data.project === "string" ? data.project : undefined;
  const issueId = typeof data.issue === "string" ? data.issue : undefined;
  const url =
    projectId && issueId
      ? `${webBaseUrl.replace(/\/$/, "")}/${payload.workspace_slug}/projects/${projectId}/work-items/${issueId}`
      : undefined;

  const actor = asRecord(payload.activity?.actor);

  return {
    title: truncate(title, 256),
    description: truncate(rawBody, 4096),
    url,
    color: 0x5e6ad2,
    author: actor?.display_name ? { name: String(actor.display_name) } : undefined,
    footer: { text: `Plane · comment ${action}` },
    timestamp: new Date().toISOString(),
  };
}

function buildGenericEmbed(payload: PlaneWebhookPayload, data: WebhookData): APIEmbed {
  const action = ACTION_LABELS[payload.action] ?? payload.action;
  const label = EVENT_LABELS[payload.event] ?? payload.event;
  const name = typeof data.name === "string" ? data.name : (payload.activity?.new_identifier ?? String(data.id ?? ""));

  return {
    title: truncate(`${label} ${action}: ${name}`, 256),
    color: 0x5e6ad2,
    footer: { text: "Plane" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convert a Plane webhook payload into a Discord message. Returns `null` when
 * the payload carries nothing worth posting (e.g. an unsupported event).
 */
export async function buildWebhookMessage(
  payload: PlaneWebhookPayload,
  options: { webBaseUrl: string; resolveAssignees?: AssigneeResolver }
): Promise<{ embeds: APIEmbed[] } | null> {
  const data = asRecord(payload.data);
  if (!data) {
    return null;
  }

  switch (payload.event) {
    case "issue":
      return { embeds: [await buildIssueEmbed(payload, data, options.webBaseUrl, options.resolveAssignees)] };
    case "issue_comment":
      return { embeds: [buildCommentEmbed(payload, data, options.webBaseUrl)] };
    case "project":
    case "module":
    case "cycle":
      return { embeds: [buildGenericEmbed(payload, data)] };
    default:
      logger.warn(`DISCORD_NOTIFY: Unsupported webhook event "${payload.event}"`);
      return null;
  }
}

/**
 * Post a pre-built message to a Discord channel. Failures are logged and
 * swallowed so a broken channel never causes the webhook to retry forever.
 * Returns the sent message when successful.
 */
export async function sendChannelMessage(
  client: Client,
  channelId: string,
  message: { embeds: APIEmbed[] }
): Promise<Message | undefined> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`DISCORD_NOTIFY: Channel ${channelId} is not a sendable text channel`);
      return undefined;
    }
    return await (channel as TextChannel).send(message);
  } catch (error) {
    logger.error(`DISCORD_NOTIFY: Failed to send message to channel ${channelId}`, error);
    return undefined;
  }
}
