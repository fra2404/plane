/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Application error class that extracts only essential information from unknown
 * errors to keep logs readable and avoid leaking sensitive request data.
 */
export class AppError extends Error {
  statusCode?: number;
  code?: string;
  context?: Record<string, unknown>;

  constructor(messageOrError: string | unknown, data?: Partial<Omit<AppError, "name" | "message">>) {
    const error = messageOrError;

    if (error instanceof AppError) {
      return error;
    }

    if (typeof messageOrError === "string") {
      super(messageOrError);
      this.name = "AppError";
      if (data) {
        Object.assign(this, data);
      }
      return;
    }

    if (error instanceof Error) {
      super(error.message);
      this.name = "AppError";
      this.code = error.name;
      if (data) {
        Object.assign(this, data);
      }
      return;
    }

    super("Unknown error occurred");
    this.name = "AppError";
    if (data) {
      Object.assign(this, data);
    }
  }
}
