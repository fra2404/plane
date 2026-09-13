/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPlaneSignature } from "@/lib/signature";

describe("verifyPlaneSignature", () => {
  const secret = "plane_wh_test_secret";
  const body = Buffer.from(JSON.stringify({ event: "issue", action: "create", name: "héllo wörld" }));
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyPlaneSignature(body, signature, secret)).toBe(true);
  });

  it("rejects a signature computed from a different body", () => {
    const tampered = Buffer.from(JSON.stringify({ event: "issue", action: "delete" }));
    expect(verifyPlaneSignature(tampered, signature, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyPlaneSignature(body, signature, "other_secret")).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyPlaneSignature(body, undefined, secret)).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(verifyPlaneSignature(Buffer.alloc(0), signature, secret)).toBe(false);
  });
});
