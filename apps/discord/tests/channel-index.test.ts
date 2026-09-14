/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { normalizeChannelName } from "@/discord/channel-index";

describe("normalizeChannelName", () => {
  it("collapses spaces, dashes and case", () => {
    expect(normalizeChannelName("Smiling Dog")).toBe("smilingdog");
    expect(normalizeChannelName("smiling-dog")).toBe("smilingdog");
    expect(normalizeChannelName("SMILINGDOG")).toBe("smilingdog");
  });

  it("handles emoji and punctuation", () => {
    expect(normalizeChannelName("🚀 dev-ops")).toBe("devops");
  });
});
