/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { LinkStore } from "@/lib/link-store";
import type { PlaneClient } from "@/plane/client";

/**
 * Shared dependencies and feature flags passed to the bot, the command
 * handlers and the webhook controller.
 */
export interface AppContext {
  plane: PlaneClient;
  webBaseUrl: string;
  workspaceSlug: string;
  linkStore: LinkStore;
  mirrorMessages: boolean;
  autoThreads: boolean;
  threadAutoArchiveMinutes: number;
  userMapping: Record<string, string>;
}
