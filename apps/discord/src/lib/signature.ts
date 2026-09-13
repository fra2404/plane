/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify the `X-Plane-Signature` header of an incoming webhook.
 *
 * Plane signs the exact JSON body it sends (Python `json.dumps` output) with
 * HMAC-SHA256 using the webhook `secret_key`. We therefore verify against the
 * raw request body bytes rather than a re-serialized object, which is the only
 * way to guarantee the signature matches for unicode/float payloads.
 */
export function verifyPlaneSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!rawBody || rawBody.length === 0 || !signature || !secret) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
