/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Message } from "discord.js";
import { logger } from "@plane/logger";
import type { AppContext } from "@/context";
import { textToHtml } from "./commands";

/**
 * Mirror a message written in a linked Discord thread into Plane as a comment.
 * Messages authored by bots are ignored, which also prevents the echo loop with
 * comments pushed from Plane into the same thread.
 */
export async function handleThreadMessage(message: Message, context: AppContext): Promise<void> {
  if (!context.mirrorMessages || message.author.bot) {
    return;
  }

  const content = message.content?.trim();
  if (!content) {
    return;
  }

  const link = await context.linkStore.getByThread(message.channelId);
  if (!link) {
    return;
  }

  try {
    await context.plane.createComment(link.projectId, link.issueId, textToHtml(content), {
      external_id: message.id,
      external_source: "discord",
    });
    await message.react("✅").catch(() => undefined);
  } catch (error) {
    logger.error("DISCORD_THREAD_SYNC: Failed to mirror message to Plane", error);
    await message.react("⚠️").catch(() => undefined);
  }
}
