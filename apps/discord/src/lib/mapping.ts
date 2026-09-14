/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { logger } from "@plane/logger";
import type { ChannelNameIndex } from "@/discord/channel-index";
import type { PlaneClient } from "@/plane/client";
import type { PlaneWebhookPayload } from "@/types";

/**
 * Extract the Plane project id referenced by a webhook payload. Different
 * webhook events expose it in different shapes, so we probe the known fields.
 */
export function extractProjectId(payload: PlaneWebhookPayload): string | undefined {
  const data = payload.data as Record<string, unknown> | null;
  if (!data) {
    return undefined;
  }

  const projectDetail = data.project_detail as { id?: unknown } | undefined;
  const issue = data.issue as { project?: unknown } | undefined;
  const candidates = [data.project, data.project_id, projectDetail?.id, issue?.project];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Resolves the Discord channel a webhook should be posted to.
 *
 * Resolution order:
 * 1. explicit `DISCORD_CHANNEL_MAPPING` entry (by project UUID or identifier),
 * 2. a Discord channel whose name matches the project identifier/name
 *    (so new projects work automatically once a same-named channel exists),
 * 3. the configured default channel.
 */
export class ChannelMapper {
  private readonly byKey: Map<string, string>;

  constructor(
    mapping: Record<string, string>,
    private readonly defaultChannelId: string | undefined,
    private readonly client: PlaneClient,
    private readonly channelIndex?: ChannelNameIndex
  ) {
    this.byKey = new Map(Object.entries(mapping).map(([key, value]) => [key.toLowerCase(), value]));
  }

  async resolveForProject(projectId: string | undefined): Promise<string | undefined> {
    if (!projectId) {
      return this.defaultChannelId;
    }

    const direct = this.byKey.get(projectId.toLowerCase());
    if (direct) {
      return direct;
    }

    const project = await this.findProject(projectId);
    if (project) {
      const byIdentifier = this.byKey.get(project.identifier.toLowerCase());
      if (byIdentifier) {
        return byIdentifier;
      }

      if (this.channelIndex) {
        const byName = await this.channelIndex.resolveByName([project.identifier, project.name]);
        if (byName) {
          return byName;
        }
      }
    }

    return this.defaultChannelId;
  }

  private async findProject(projectId: string) {
    try {
      const projects = await this.client.listProjects();
      return projects.find((candidate) => candidate.id === projectId);
    } catch (error) {
      logger.warn("DISCORD_MAPPER: Unable to resolve project from Plane API", error);
      return undefined;
    }
  }

  async resolve(payload: PlaneWebhookPayload): Promise<string | undefined> {
    return this.resolveForProject(extractProjectId(payload));
  }
}
