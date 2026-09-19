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

export type TTeamMemberProfile = {
  id: string;
  workspace: string;
  user: string;
  role: string;
  department: string;
  manager: string | null;
  manager_detail: IUserLite | null;
  phone: string;
  discord_id: string;
  location: string;
  hire_date: string | null;
  linkedin: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type TTeamMember = {
  user_id: string;
  user_detail: IUserLite;
  workspace_role: number;
  team: TTeamMemberProfile | null;
};

export type TTeamMemberPayload = {
  role?: string;
  department?: string;
  manager?: string | null;
  phone?: string;
  discord_id?: string;
  location?: string;
  hire_date?: string | null;
  linkedin?: string;
  notes?: string;
};

export type TClientNoteKind = "nota" | "chiamata" | "meeting" | "email" | "altro";

export type TClientNote = {
  id: string;
  client: string;
  author: string | null;
  author_detail: IUserLite | null;
  kind: TClientNoteKind;
  content: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type TIntranetClientProject = {
  id: string;
  name: string;
  identifier: string;
  budget_hours: number | null;
  budget_months: Record<string, number>;
};

export type TIntranetClientDetail = TIntranetClient & {
  contacts: TIntranetContact[];
  projects: TIntranetClientProject[];
  total_logged_time: number;
  total_paid_amount: string;
  timeline: TClientNote[];
};
