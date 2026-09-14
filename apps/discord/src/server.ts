/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Server as HttpServer } from "node:http";
import compression from "compression";
import cors from "cors";
import type { Express, Request, Response, Router } from "express";
import express from "express";
import helmet from "helmet";
import { registerController } from "@plane/decorators";
import { logger, loggerMiddleware } from "@plane/logger";
import { AlertController, HealthController, WebhookController } from "@/controllers";
import type { AppContext } from "@/context";
import { DiscordChannelIndex } from "@/discord/channel-index";
import { DiscordBot } from "@/discord/client";
import { env } from "@/env";
import { createLinkStore, type LinkStore } from "@/lib/link-store";
import { ChannelMapper } from "@/lib/mapping";
import { PlaneClient } from "@/plane/client";

export class Server {
  private readonly app: Express;
  private readonly router: Router;
  private readonly plane: PlaneClient;

  private bot: DiscordBot | undefined;
  private linkStore: LinkStore | undefined;
  private context: AppContext | undefined;
  private mapper: ChannelMapper | undefined;
  private httpServer: HttpServer | undefined;

  constructor() {
    this.app = express();
    this.setupMiddleware();

    this.router = express.Router();
    this.app.set("port", env.PORT);
    this.app.use(env.API_BASE_PATH, this.router);

    this.plane = new PlaneClient(env.PLANE_API_BASE_URL, env.PLANE_API_TOKEN, env.PLANE_WORKSPACE_SLUG);
  }

  public async initialize(): Promise<void> {
    try {
      this.linkStore = await createLinkStore(env.REDIS_URL);
      this.context = {
        plane: this.plane,
        webBaseUrl: env.PLANE_WEB_BASE_URL ?? env.PLANE_API_BASE_URL,
        workspaceSlug: env.PLANE_WORKSPACE_SLUG,
        linkStore: this.linkStore,
        mirrorMessages: env.DISCORD_MIRROR_MESSAGES,
        autoThreads: env.DISCORD_AUTO_THREADS,
        threadAutoArchiveMinutes: env.DISCORD_THREAD_AUTO_ARCHIVE_MINUTES,
        userMapping: env.DISCORD_USER_MAPPING,
        assignDelivery: env.DISCORD_ASSIGN_DELIVERY as "dm" | "channel" | "both",
      };

      this.bot = new DiscordBot(this.context);
      await this.bot.initialize();
      logger.info("SERVER: Discord bot is ready");

      const channelIndex = new DiscordChannelIndex(this.bot.client, env.DISCORD_AUTO_CHANNEL_MATCH);
      this.mapper = new ChannelMapper(
        env.DISCORD_CHANNEL_MAPPING,
        env.DISCORD_DEFAULT_CHANNEL_ID,
        this.plane,
        channelIndex
      );

      this.setupRoutes();
      this.setupNotFoundHandler();
    } catch (error) {
      logger.error("SERVER: Failed to initialize:", error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(loggerMiddleware);
    this.app.use(
      express.json({
        limit: "1mb",
        verify: (req, _res, buf) => {
          (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
        },
      })
    );
    this.app.use(express.urlencoded({ extended: true }));
    this.setupCors();
  }

  private setupCors(): void {
    const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    this.app.use(
      cors({
        origin: allowedOrigins.length > 0 ? allowedOrigins : false,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
      })
    );
  }

  private setupRoutes(): void {
    if (!this.bot || !this.context || !this.mapper) {
      throw new Error("Server must be initialized before registering routes");
    }

    registerController(this.router, HealthController, []);
    registerController(this.router, WebhookController, [this.bot, this.mapper, this.context]);
    registerController(this.router, AlertController, [this.bot]);
  }

  private setupNotFoundHandler(): void {
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ message: "Not Found" });
    });
  }

  public listen(): void {
    this.httpServer = this.app
      .listen(this.app.get("port"), () => {
        logger.info(`SERVER: Express server has started at port ${this.app.get("port")}`);
      })
      .on("error", (error) => {
        logger.error("SERVER: Failed to start server:", error);
        throw error;
      });
  }

  public async destroy(): Promise<void> {
    await this.bot?.destroy();
    await this.linkStore?.dispose();

    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((error) => {
          if (error) {
            reject(error);
          } else {
            logger.info("SERVER: Express server closed gracefully.");
            resolve();
          }
        });
      });
    }
  }
}
