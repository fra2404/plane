/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ChannelType, type Client } from "discord.js";
import { logger } from "@plane/logger";

export interface ChannelNameIndex {
  resolveByName(names: string[]): Promise<string | undefined>;
}

/**
 * Normalize a channel/project name so that "Smiling Dog", "smiling-dog" and
 * "SMILINGDOG" all collapse to the same value.
 */
export function normalizeChannelName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

interface CachedChannel {
  id: string;
  normalized: string;
}

const MATCHABLE_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

/**
 * Indexes the Discord channels the bot can see and resolves a channel by
 * (normalized) name. Results are cached briefly to avoid hammering the API on
 * every webhook.
 */
export class DiscordChannelIndex implements ChannelNameIndex {
  private cache: { at: number; channels: CachedChannel[] } | undefined;

  constructor(
    private readonly client: Client,
    private readonly enabled: boolean,
    private readonly ttlMs = 60_000
  ) {}

  async resolveByName(names: string[]): Promise<string | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const wanted = names.map(normalizeChannelName).filter(Boolean);
    if (wanted.length === 0) {
      return undefined;
    }

    const channels = await this.getChannels();
    for (const name of wanted) {
      const hit = channels.find((channel) => channel.normalized === name);
      if (hit) {
        return hit.id;
      }
    }

    return undefined;
  }

  private async getChannels(): Promise<CachedChannel[]> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.channels;
    }

    const guilds = [...this.client.guilds.cache.values()];
    const perGuild = await Promise.all(
      guilds.map(async (guild) => {
        const channels: CachedChannel[] = [];
        try {
          const fetched = await guild.channels.fetch();
          for (const channel of fetched.values()) {
            if (!channel || !MATCHABLE_TYPES.has(channel.type)) {
              continue;
            }
            channels.push({ id: channel.id, normalized: normalizeChannelName(channel.name) });
          }
        } catch (error) {
          logger.warn(`DISCORD_CHANNEL_INDEX: Failed to list channels for guild ${guild.id}`, error);
        }
        return channels;
      })
    );

    const channels = perGuild.flat();
    this.cache = { at: Date.now(), channels };
    return channels;
  }
}
