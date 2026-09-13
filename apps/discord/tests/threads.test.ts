/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { threadName } from "@/discord/threads";

describe("threadName", () => {
  it("combines the sequence id and name", () => {
    expect(threadName({ sequence_id: 42, name: "Fix the thing" })).toBe("#42 Fix the thing");
  });

  it("handles a missing name", () => {
    expect(threadName({ sequence_id: 7 })).toBe("#7");
  });

  it("handles a missing sequence id", () => {
    expect(threadName({ name: "No sequence" })).toBe("Work item No sequence");
  });

  it("truncates to Discord's 100 character limit", () => {
    const name = "x".repeat(200);
    expect(threadName({ sequence_id: 1, name }).length).toBe(100);
  });
});
