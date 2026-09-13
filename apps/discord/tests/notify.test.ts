/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { buildWebhookMessage, stripHtml } from "@/discord/notify";
import type { PlaneWebhookPayload } from "@/types";

const options = { webBaseUrl: "https://app.plane.so" };

const buildPayload = (overrides: Partial<PlaneWebhookPayload>): PlaneWebhookPayload => ({
  event: "issue",
  action: "create",
  webhook_id: "wh-1",
  workspace_id: "ws-1",
  workspace_slug: "acme",
  data: {},
  activity: null,
  ...overrides,
});

describe("stripHtml", () => {
  it("converts paragraphs and line breaks to text", () => {
    expect(stripHtml("<p>Hello</p><p>World<br>again</p>")).toBe("Hello\nWorld\nagain");
  });

  it("decodes common entities", () => {
    expect(stripHtml("<p>Tom &amp; Jerry &quot;rock&quot;</p>")).toBe('Tom & Jerry "rock"');
  });
});

describe("buildWebhookMessage", () => {
  it("builds an embed for a created work item", async () => {
    const message = await buildWebhookMessage(
      buildPayload({
        data: {
          id: "issue-1",
          project: "project-1",
          sequence_id: 42,
          name: "Fix the thing",
          priority: "high",
          state: { id: "s1", name: "In Progress", color: "#000", group: "started" },
          assignees: ["u1", "u2"],
        },
      }),
      options
    );

    expect(message).not.toBeNull();
    const embed = message!.embeds[0];
    expect(embed.title).toBe("#42 · Fix the thing");
    expect(embed.url).toBe("https://app.plane.so/acme/projects/project-1/work-items/issue-1");
    expect(embed.fields?.some((field) => field.name === "State" && field.value === "In Progress")).toBe(true);
    expect(embed.fields?.some((field) => field.name === "Priority" && field.value === "high")).toBe(true);
  });

  it("resolves assignee names via the resolver", async () => {
    const message = await buildWebhookMessage(
      buildPayload({
        data: {
          id: "issue-1",
          project: "project-1",
          sequence_id: 42,
          name: "Fix the thing",
          assignees: ["u1", "u2"],
        },
      }),
      {
        ...options,
        resolveAssignees: async (_projectId, ids) => ids.map((id) => (id === "u1" ? "Alice" : "Bob")),
      }
    );

    const assignees = message!.embeds[0].fields?.find((field) => field.name === "Assignees");
    expect(assignees?.value).toBe("Alice, Bob");
  });

  it("includes the changed field on updates", async () => {
    const message = await buildWebhookMessage(
      buildPayload({
        action: "update",
        data: { id: "issue-1", project: "project-1", sequence_id: 7, name: "Task" },
        activity: { field: "priority", old_value: "low", new_value: "high" },
      }),
      options
    );

    const changeField = message!.embeds[0].fields?.find((field) => field.name.startsWith("Change"));
    expect(changeField?.value).toBe("low → high");
  });

  it("builds an embed for a comment", async () => {
    const message = await buildWebhookMessage(
      buildPayload({
        event: "issue_comment",
        data: {
          project: "project-1",
          issue: "issue-1",
          comment_stripped: "Looks good to me",
          issue_detail: { name: "Task", sequence_id: 9 },
        },
        activity: { actor: { id: "u1", display_name: "Alice" } },
      }),
      options
    );

    const embed = message!.embeds[0];
    expect(embed.title).toBe("Comment on #9 · Task");
    expect(embed.description).toBe("Looks good to me");
    expect(embed.url).toBe("https://app.plane.so/acme/projects/project-1/work-items/issue-1");
  });

  it("returns null for unsupported events", async () => {
    expect(await buildWebhookMessage(buildPayload({ event: "workspace" }), options)).toBeNull();
  });
});
