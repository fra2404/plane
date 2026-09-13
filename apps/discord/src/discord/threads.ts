/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Build a Discord thread name for a work item. Discord limits thread names to
 * 100 characters.
 */
export function threadName(data: { sequence_id?: unknown; name?: unknown }): string {
  const sequence = typeof data.sequence_id === "number" ? `#${data.sequence_id}` : "Work item";
  const name = typeof data.name === "string" ? data.name : "";
  return `${sequence} ${name}`.trim().slice(0, 100) || "Work item";
}
