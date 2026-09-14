/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const jsonRecord = z
  .string()
  .default("{}")
  .transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("must be a JSON object");
      }
      return parsed as Record<string, string>;
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid JSON object: ${(error as Error).message}`,
      });
      return z.NEVER;
    }
  });

const booleanish = z
  .string()
  .default("false")
  .transform((value) => ["1", "true", "yes", "on"].includes(value.trim().toLowerCase()));

// Treat an empty string as "not provided" for optional URL variables, so the
// default `.env.example` values work as-is.
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url("must be a valid URL").optional()
);

const THREAD_ARCHIVE_VALUES = [60, 1440, 4320, 10080];

const envSchema = z.object({
  APP_VERSION: z.string().default("1.0.0"),
  LOG_LEVEL: z.string().default("info"),
  HOSTNAME: z.string().optional(),
  PORT: z.string().default("3200").transform(Number),
  API_BASE_PATH: z.string().default("/discord"),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default(""),

  // Discord
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_DEFAULT_CHANNEL_ID: z.string().optional(),
  DISCORD_CHANNEL_MAPPING: jsonRecord,
  DISCORD_USER_MAPPING: jsonRecord,
  DISCORD_AUTO_THREADS: booleanish,
  DISCORD_MIRROR_MESSAGES: booleanish,
  // Channel that receives Alertmanager alerts (falls back to the default channel).
  DISCORD_ALERTS_CHANNEL_ID: z.string().optional(),
  // Where assignment notifications go: "dm" (private, default), "channel" or "both".
  DISCORD_ASSIGN_DELIVERY: z
    .string()
    .default("dm")
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => ["dm", "channel", "both"].includes(value), {
      message: "DISCORD_ASSIGN_DELIVERY must be one of dm, channel, both",
    }),
  DISCORD_THREAD_AUTO_ARCHIVE_MINUTES: z
    .string()
    .default("1440")
    .transform(Number)
    .refine((value) => THREAD_ARCHIVE_VALUES.includes(value), {
      message: `DISCORD_THREAD_AUTO_ARCHIVE_MINUTES must be one of ${THREAD_ARCHIVE_VALUES.join(", ")}`,
    }),

  // Plane
  PLANE_API_BASE_URL: z.string().url("PLANE_API_BASE_URL must be a valid URL"),
  PLANE_API_TOKEN: z.string().min(1, "PLANE_API_TOKEN is required"),
  PLANE_WORKSPACE_SLUG: z.string().min(1, "PLANE_WORKSPACE_SLUG is required"),
  PLANE_WEB_BASE_URL: optionalUrl,
  PLANE_WEBHOOK_SECRET: z.string().optional(),
  PLANE_WEBHOOK_SECRETS: jsonRecord,

  // Optional Redis for persistent issue <-> thread links
  REDIS_URL: optionalUrl,

  // Alertmanager -> Discord bridge. When set, the /webhooks/alertmanager
  // endpoint requires this token (Authorization: Bearer or X-Alertmanager-Token).
  ALERTMANAGER_TOKEN: z.string().optional(),
});

const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", JSON.stringify(result.error.format(), null, 4));
    process.exit(1);
  }
  return result.data;
};

export const env = validateEnv();

export type Env = typeof env;
