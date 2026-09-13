/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { MemoryLinkStore } from "@/lib/link-store";

describe("MemoryLinkStore", () => {
  it("saves and resolves links by issue and thread", async () => {
    const store = new MemoryLinkStore();
    await store.initialize();
    await store.save({
      issueId: "issue-1",
      projectId: "project-1",
      workspaceSlug: "acme",
      channelId: "channel-1",
      threadId: "thread-1",
    });

    await expect(store.getByIssue("issue-1")).resolves.toMatchObject({
      issueId: "issue-1",
      projectId: "project-1",
      threadId: "thread-1",
    });
    await expect(store.getByThread("thread-1")).resolves.toMatchObject({ issueId: "issue-1" });
  });

  it("returns undefined for unknown ids", async () => {
    const store = new MemoryLinkStore();
    await expect(store.getByIssue("missing")).resolves.toBeUndefined();
    await expect(store.getByThread("missing")).resolves.toBeUndefined();
  });

  it("supports links without a thread", async () => {
    const store = new MemoryLinkStore();
    await store.save({ issueId: "issue-2", projectId: "p", workspaceSlug: "acme", channelId: "c" });
    await expect(store.getByIssue("issue-2")).resolves.toMatchObject({ issueId: "issue-2" });
    await expect(store.getByThread("thread-2")).resolves.toBeUndefined();
  });

  it("clears all links on dispose", async () => {
    const store = new MemoryLinkStore();
    await store.save({ issueId: "issue-3", projectId: "p", workspaceSlug: "acme", channelId: "c", threadId: "t3" });
    await store.dispose();
    await expect(store.getByIssue("issue-3")).resolves.toBeUndefined();
    await expect(store.getByThread("t3")).resolves.toBeUndefined();
  });
});
