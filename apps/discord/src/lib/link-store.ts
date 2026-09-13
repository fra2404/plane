/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Redis from "ioredis";
import { logger } from "@plane/logger";

export interface IssueLink {
  issueId: string;
  projectId: string;
  workspaceSlug: string;
  channelId: string;
  threadId?: string;
}

/**
 * Persists the mapping between a Plane work item and the Discord channel/thread
 * it is mirrored to. Required for two-way comment syncing.
 */
export interface LinkStore {
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  save(link: IssueLink): Promise<void>;
  getByIssue(issueId: string): Promise<IssueLink | undefined>;
  getByThread(threadId: string): Promise<IssueLink | undefined>;
}

const LINK_TTL_SECONDS = 60 * 60 * 24 * 90;

export class MemoryLinkStore implements LinkStore {
  private readonly byIssue = new Map<string, IssueLink>();
  private readonly byThread = new Map<string, string>();

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    this.byIssue.clear();
    this.byThread.clear();
  }

  async save(link: IssueLink): Promise<void> {
    this.byIssue.set(link.issueId, link);
    if (link.threadId) {
      this.byThread.set(link.threadId, link.issueId);
    }
  }

  async getByIssue(issueId: string): Promise<IssueLink | undefined> {
    return this.byIssue.get(issueId);
  }

  async getByThread(threadId: string): Promise<IssueLink | undefined> {
    const issueId = this.byThread.get(threadId);
    return issueId ? this.byIssue.get(issueId) : undefined;
  }
}

export class RedisLinkStore implements LinkStore {
  private client: Redis | null = null;

  constructor(private readonly url: string) {}

  async initialize(): Promise<void> {
    this.client = new Redis(this.url, { maxRetriesPerRequest: 2, connectTimeout: 10000 });
    this.client.on("error", (error) => {
      logger.warn("LINK_STORE: Redis error, links may be served from a degraded connection", error);
    });
    await this.client.ping();
  }

  async dispose(): Promise<void> {
    if (!this.client) {
      return;
    }
    const client = this.client;
    this.client = null;
    await client.quit().catch(() => client.disconnect());
  }

  private issueKey(issueId: string): string {
    return `plane:discord:issue:${issueId}`;
  }

  private threadKey(threadId: string): string {
    return `plane:discord:thread:${threadId}`;
  }

  async save(link: IssueLink): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.set(this.issueKey(link.issueId), JSON.stringify(link), "EX", LINK_TTL_SECONDS);
    if (link.threadId) {
      await this.client.set(this.threadKey(link.threadId), link.issueId, "EX", LINK_TTL_SECONDS);
    }
  }

  async getByIssue(issueId: string): Promise<IssueLink | undefined> {
    if (!this.client) {
      return undefined;
    }
    const raw = await this.client.get(this.issueKey(issueId));
    return raw ? (JSON.parse(raw) as IssueLink) : undefined;
  }

  async getByThread(threadId: string): Promise<IssueLink | undefined> {
    if (!this.client) {
      return undefined;
    }
    const issueId = await this.client.get(this.threadKey(threadId));
    return issueId ? this.getByIssue(issueId) : undefined;
  }
}

/**
 * Use Redis when configured, otherwise fall back to an in-memory store. The
 * in-memory store loses links on restart but keeps the bot functional without
 * extra infrastructure.
 */
export async function createLinkStore(redisUrl: string | undefined): Promise<LinkStore> {
  if (redisUrl) {
    const store = new RedisLinkStore(redisUrl);
    try {
      await store.initialize();
      logger.info("LINK_STORE: Using Redis store");
      return store;
    } catch (error) {
      logger.warn("LINK_STORE: Redis unavailable, falling back to in-memory store", error);
      await store.dispose().catch(() => undefined);
    }
  }

  const memory = new MemoryLinkStore();
  await memory.initialize();
  logger.info("LINK_STORE: Using in-memory store");
  return memory;
}
