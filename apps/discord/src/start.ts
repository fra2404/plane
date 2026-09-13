/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
import { Server } from "./server";

let server: Server | undefined;

async function startServer(): Promise<void> {
  server = new Server();
  try {
    await server.initialize();
    server.listen();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal. Initiating graceful shutdown...");
  try {
    await server?.destroy();
    logger.info("Server shut down gracefully");
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal. Initiating graceful shutdown...");
  try {
    await server?.destroy();
    logger.info("Server shut down gracefully");
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[UNHANDLED_REJECTION]", new AppError(reason));
});

process.on("uncaughtException", (error) => {
  logger.error("[UNCAUGHT_EXCEPTION]", new AppError(error));
});
