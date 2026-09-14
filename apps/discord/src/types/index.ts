/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type PlanePriority = "urgent" | "high" | "medium" | "low" | "none";

export interface PlaneProject {
  id: string;
  identifier: string;
  name: string;
  description?: string;
}

export interface PlaneState {
  id: string;
  name: string;
  color: string;
  group: "backlog" | "unstarted" | "started" | "completed" | "cancelled" | string;
}

export interface PlaneUser {
  id: string;
  display_name?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface PlaneWorkItem {
  id: string;
  name: string;
  sequence_id: number;
  priority?: PlanePriority;
  state?: PlaneState | string | null;
  assignees?: string[] | PlaneUser[];
  description_html?: string | null;
  project?: string;
  project_detail?: PlaneProject;
  created_at?: string;
  updated_at?: string;
}

export interface PlaneComment {
  id: string;
  comment_html: string;
  comment_stripped?: string;
}

export interface IntranetDevice {
  id: string;
  name: string;
  type: string;
  local_ip: string;
  vpn_ip: string;
  description: string;
  owner: string;
}

export interface IntranetLink {
  id: string;
  label: string;
  url: string;
  category: string;
  description: string;
  sort_order: number;
}

export interface IntranetNews {
  id: string;
  title: string;
  description: string;
  tags: string[];
  author_detail?: PlaneUser | null;
  created_at: string;
}

export interface WorklogSummary {
  total_logged_time: number;
  user_totals: {
    actor_id: string | null;
    actor_detail: PlaneUser | null;
    duration: number;
    worklog_count: number;
  }[];
  monthly_totals: { month: string; duration: number; worklog_count: number }[];
}

export interface Paginated<T> {
  results: T[];
  next?: string | null;
  previous?: string | null;
  total_count?: number;
}

export type PlaneWebhookEvent = "project" | "issue" | "module" | "cycle" | "issue_comment" | (string & {});

export type PlaneWebhookAction = "created" | "updated" | "deleted" | "create" | "update" | "delete";

export interface PlaneWebhookActivity {
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  actor?: PlaneUser | null;
  old_identifier?: string | null;
  new_identifier?: string | null;
}

export interface PlaneWebhookPayload<T = Record<string, unknown>> {
  event: PlaneWebhookEvent;
  action: PlaneWebhookAction;
  webhook_id: string;
  workspace_id: string;
  workspace_slug: string;
  data: T | null;
  activity: PlaneWebhookActivity | null;
}
