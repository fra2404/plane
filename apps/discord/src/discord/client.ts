/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Client, Events, GatewayIntentBits } from "discord.js";
import { logger } from "@plane/logger";
import type { AppContext } from "@/context";
import { env } from "@/env";
import { COMMANDS, handleInteraction } from "./commands";
import { handleThreadMessage } from "./thread-sync";

/**
 * Wrapper around the discord.js client. Connects to the gateway, registers the
 * slash commands, routes incoming interactions to the command handlers and,
 * when enabled, mirrors thread messages back to Plane.
 */
export class DiscordBot {
  public readonly client: Client;

  constructor(private readonly context: AppContext) {
    const intents = [GatewayIntentBits.Guilds];
    if (context.mirrorMessages) {
      intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
    }
    this.client = new Client({ intents });
  }

  async initialize(): Promise<void> {
    const ready = new Promise<void>((resolve, reject) => {
      this.client.once(Events.ClientReady, (client) => {
        this.registerCommands(client).then(resolve).catch(reject);
      });
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      handleInteraction(interaction, this.context).catch((error) => {
        logger.error("DISCORD: Unhandled interaction error", error);
      });
    });

    if (this.context.mirrorMessages) {
      this.client.on(Events.MessageCreate, (message) => {
        handleThreadMessage(message, this.context).catch((error) => {
          logger.error("DISCORD: Unhandled message error", error);
        });
      });
    }

    await this.client.login(env.DISCORD_BOT_TOKEN);
    await ready;
    logger.info(`DISCORD: Logged in as ${this.client.user?.tag ?? "unknown"}`);
  }

  private async registerCommands(client: Client): Promise<void> {
    const body = COMMANDS.map((command) => command.toJSON());

    // Global registration is required for the commands to be usable in DMs.
    await client.application!.commands.set(body);
    logger.info(`DISCORD: Registered ${body.length} global commands`);

    // Guild registration gives instant updates inside the server.
    if (env.DISCORD_GUILD_ID) {
      const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
      await guild.commands.set(body);
      logger.info(`DISCORD: Registered ${body.length} commands in guild ${env.DISCORD_GUILD_ID}`);
    }
  }

  async destroy(): Promise<void> {
    this.client.destroy();
    logger.info("DISCORD: Client disconnected");
  }
}
