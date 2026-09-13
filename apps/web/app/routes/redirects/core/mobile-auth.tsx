/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { redirect } from "react-router";

/**
 * Mobile deep-link handoff (`/m/auth`, `/m/...`).
 *
 * The official mobile app opens these paths on the self-hosted web origin. The
 * Community Edition has no native mobile-auth flow, so instead of rendering the
 * app's 404 page we forward the request (preserving any query string such as
 * `next_path` or tokens) to the web sign-in.
 */
export const clientLoader = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  throw redirect(`/${url.search}`);
};

export default function MobileAuthRedirect() {
  return null;
}
