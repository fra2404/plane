/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Minimal service worker that makes the web app installable (PWA) without
 * caching application data. Every request is handled by the network as usual;
 * the presence of a fetch handler is what browsers require to offer
 * "Install app" / standalone display.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network passthrough: intentionally empty.
});
