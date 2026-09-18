/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { PlaneNotificationPreference } from "@/types";

/** Assignment notifications default to ON when no preference row exists. */
export function wantsAssignmentNotification(preference: PlaneNotificationPreference | undefined): boolean {
  return preference?.discord_assignment ?? true;
}

/** Comment notifications default to OFF (opt-in) when no preference row exists. */
export function wantsCommentNotification(preference: PlaneNotificationPreference | undefined): boolean {
  return preference?.discord_comment ?? false;
}
