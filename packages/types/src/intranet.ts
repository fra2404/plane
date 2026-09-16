/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IUserLite } from "./users";

export type TIntranetDeviceType = "server" | "vm" | "container" | "dispositivo" | "altro";

export type TIntranetDevice = {
  id: string;
  workspace: string;
  name: string;
  type: TIntranetDeviceType;
  local_ip: string;
  vpn_ip: string;
  description: string;
  owner: string;
  created_at: string;
  updated_at: string;
};

export type TIntranetLink = {
  id: string;
  workspace: string;
  project: string | null;
  label: string;
  url: string;
  category: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TIntranetNews = {
  id: string;
  workspace: string;
  title: string;
  description: string;
  tags: string[];
  author: string | null;
  author_detail: IUserLite | null;
  created_at: string;
  updated_at: string;
};

export type TIntranetClientStatus = "active" | "prospect" | "inactive";

export type TIntranetClient = {
  id: string;
  workspace: string;
  name: string;
  vat: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  notes: string;
  status: TIntranetClientStatus;
  created_at: string;
  updated_at: string;
};

export type TIntranetContact = {
  id: string;
  workspace: string;
  client: string | null;
  name: string;
  role: string;
  email: string;
  phone: string;
  mobile: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type TAnniversaryEvent = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  type: "birthday" | "anniversary";
  date: string;
  days_until: number;
  years: number | null;
};
