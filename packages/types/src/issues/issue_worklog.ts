/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IUserLite } from "../users";

export type TIssueWorklogEditableFields = {
  duration: number;
  description?: string;
  logged_at?: string;
};

export type TIssueWorklog = TIssueWorklogEditableFields & {
  id: string;
  issue: string;
  project: string;
  workspace: string;
  actor: string;
  actor_detail: IUserLite;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type TIssueWorklogMap = {
  [worklogId: string]: TIssueWorklog;
};

export type TIssueWorklogIdMap = {
  [issueId: string]: string[];
};

export type TIssueWorklogListResponse = {
  results: TIssueWorklog[];
  extra_stats: { total_logged_time: number } | null;
  next_page_results: boolean;
  next_cursor: string;
  total_count: number;
};

export type TWorkspaceWorklogSummaryRow = {
  issue_id: string;
  issue_name: string;
  project_id: string;
  project_name: string;
  actor_id: string | null;
  actor_detail: IUserLite | null;
  duration: number;
  worklog_count: number;
};

export type TWorkspaceWorklogUserTotal = {
  actor_id: string | null;
  actor_detail: IUserLite | null;
  duration: number;
  worklog_count: number;
};

export type TWorkspaceWorklogMonthTotal = {
  month: string;
  duration: number;
  worklog_count: number;
};

export type TWorkspaceWorklogMonthUserTotal = TWorkspaceWorklogMonthTotal & {
  actor_id: string | null;
  actor_detail: IUserLite | null;
};

export type TWorkspaceWorklogMonthProjectUserTotal = TWorkspaceWorklogMonthUserTotal & {
  project_id: string | null;
  project_name: string;
};

export type TWorklogPayment = {
  id: string;
  project_id: string;
  actor_id: string | null;
  actor_detail: IUserLite | null;
  month: string;
  is_paid: boolean;
  paid_at: string | null;
  amount: string | null;
  note: string;
};

export type TWorklogPaymentPayload = {
  project: string;
  actor: string;
  month: string;
  is_paid?: boolean;
  paid_at?: string | null;
  amount?: string | null;
  note?: string;
};

export type TWorkspaceWorklogSummary = {
  group_by: string;
  total_logged_time: number;
  results: TWorkspaceWorklogSummaryRow[];
  user_totals: TWorkspaceWorklogUserTotal[];
  monthly_totals: TWorkspaceWorklogMonthTotal[];
  monthly_user_totals: TWorkspaceWorklogMonthUserTotal[];
  monthly_project_user_totals?: TWorkspaceWorklogMonthProjectUserTotal[];
  payments?: TWorklogPayment[];
  project_totals?: {
    project_id: string | null;
    project_name: string;
    budget_hours: number | null;
    budget_months?: Record<string, number> | null;
    duration: number;
    worklog_count: number;
  }[];
};

export type TWorkspaceWorklogSummaryParams = {
  project_id?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
};
