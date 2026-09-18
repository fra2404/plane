/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { wantsAssignmentNotification, wantsCommentNotification } from "@/lib/preferences";
import type { PlaneNotificationPreference } from "@/types";

const preference = (overrides: Partial<PlaneNotificationPreference> = {}): PlaneNotificationPreference => ({
  member_id: "m1",
  discord_assignment: true,
  discord_comment: false,
  ...overrides,
});

describe("wantsAssignmentNotification", () => {
  it("defaults to true when no preference exists", () => {
    expect(wantsAssignmentNotification(undefined)).toBe(true);
  });

  it("respects an explicit opt-out", () => {
    expect(wantsAssignmentNotification(preference({ discord_assignment: false }))).toBe(false);
  });

  it("allows explicit opt-in", () => {
    expect(wantsAssignmentNotification(preference({ discord_assignment: true }))).toBe(true);
  });
});

describe("wantsCommentNotification", () => {
  it("defaults to false (opt-in) when no preference exists", () => {
    expect(wantsCommentNotification(undefined)).toBe(false);
  });

  it("respects an explicit opt-in", () => {
    expect(wantsCommentNotification(preference({ discord_comment: true }))).toBe(true);
  });
});
