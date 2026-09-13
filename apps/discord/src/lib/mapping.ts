/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { logger } from "@plane/logger";
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
 * Configured via `DISCORD_CHANNEL_MAPPING`, whose keys can be either a Plane
 * project UUID or a project identifier (e.g. `PROJ`). When no explicit mapping
 * exists, it falls back to the optional default channel.
 */
export class ChannelMapper {
  private readonly byKey: Map<string, string>;

  constructor(
    mapping: Record<string, string>,
    private readonly defaultChannelId: string | undefined,
    private readonly client: PlaneClient
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

    try {
      const projects = await this.client.listProjects();
      const project = projects.find((candidate) => candidate.id === projectId);
      if (project) {
        const byIdentifier = this.byKey.get(project.identifier.toLowerCase());
        if (byIdentifier) {
          return byIdentifier;
        }
      }
    } catch (error) {
      logger.warn("DISCORD_MAPPER: Unable to resolve project identifier from Plane API", error);
    }

    return this.defaultChannelId;
  }

  async resolve(payload: PlaneWebhookPayload): Promise<string | undefined> {
    return this.resolveForProject(extractProjectId(payload));
  }
}
