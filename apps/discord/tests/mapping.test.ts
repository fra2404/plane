/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import { ChannelMapper, extractProjectId } from "@/lib/mapping";
import type { PlaneClient } from "@/plane/client";
import type { PlaneWebhookPayload } from "@/types";

const buildPayload = (data: PlaneWebhookPayload["data"]): PlaneWebhookPayload => ({
  event: "issue",
  action: "create",
  webhook_id: "wh-1",
  workspace_id: "ws-1",
  workspace_slug: "acme",
  data,
  activity: null,
});

describe("extractProjectId", () => {
  it("reads the project field", () => {
    expect(extractProjectId(buildPayload({ project: "project-uuid" }))).toBe("project-uuid");
  });

  it("reads nested issue.project", () => {
    expect(extractProjectId(buildPayload({ issue: { project: "nested-uuid" } }))).toBe("nested-uuid");
  });

  it("returns undefined when no project is present", () => {
    expect(extractProjectId(buildPayload({ name: "no project" }))).toBeUndefined();
  });
});

describe("ChannelMapper", () => {
  const projects = [{ id: "project-uuid", identifier: "PROJ", name: "Project" }];
  const createClient = () => ({ listProjects: vi.fn().mockResolvedValue(projects) }) as unknown as PlaneClient;

  it("maps by project uuid", async () => {
    const mapper = new ChannelMapper({ "project-uuid": "channel-1" }, "default-channel", createClient());
    await expect(mapper.resolve(buildPayload({ project: "project-uuid" }))).resolves.toBe("channel-1");
  });

  it("maps by project identifier via an API lookup", async () => {
    const client = createClient();
    const mapper = new ChannelMapper({ PROJ: "channel-2" }, "default-channel", client);
    await expect(mapper.resolve(buildPayload({ project: "project-uuid" }))).resolves.toBe("channel-2");
    expect(client.listProjects).toHaveBeenCalled();
  });

  it("falls back to the default channel", async () => {
    const mapper = new ChannelMapper({}, "default-channel", createClient());
    await expect(mapper.resolve(buildPayload({ project: "unknown" }))).resolves.toBe("default-channel");
  });

  it("uses the default channel when the payload has no project", async () => {
    const mapper = new ChannelMapper({}, "default-channel", createClient());
    await expect(mapper.resolve(buildPayload({ name: "x" }))).resolves.toBe("default-channel");
  });

  it("returns undefined when nothing is mapped", async () => {
    const mapper = new ChannelMapper({}, undefined, createClient());
    await expect(mapper.resolve(buildPayload({ project: "unknown" }))).resolves.toBeUndefined();
  });

  it("resolves by channel name when no explicit mapping exists", async () => {
    const index = { resolveByName: vi.fn().mockResolvedValue("channel-by-name") };
    const mapper = new ChannelMapper({}, "default-channel", createClient(), index);
    await expect(mapper.resolve(buildPayload({ project: "project-uuid" }))).resolves.toBe("channel-by-name");
    expect(index.resolveByName).toHaveBeenCalledWith(["PROJ", "Project"]);
  });

  it("prefers an explicit mapping over the channel name", async () => {
    const index = { resolveByName: vi.fn().mockResolvedValue("channel-by-name") };
    const mapper = new ChannelMapper({ PROJ: "channel-2" }, "default-channel", createClient(), index);
    await expect(mapper.resolve(buildPayload({ project: "project-uuid" }))).resolves.toBe("channel-2");
    expect(index.resolveByName).not.toHaveBeenCalled();
  });

  it("falls back to the default channel when the name does not match", async () => {
    const index = { resolveByName: vi.fn().mockResolvedValue(undefined) };
    const mapper = new ChannelMapper({}, "default-channel", createClient(), index);
    await expect(mapper.resolve(buildPayload({ project: "project-uuid" }))).resolves.toBe("default-channel");
  });
});
