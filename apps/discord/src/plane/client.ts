/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AppError } from "@/lib/errors";
import type { Paginated, PlaneProject, PlaneProjectMember, PlaneState, PlaneWorkItem } from "@/types";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface CreateWorkItemInput {
  name: string;
  description_html?: string;
  priority?: string;
  state?: string;
  assignees?: string[];
}

/**
 * Minimal typed client for Plane's public REST API (`/api/v1`) authenticated
 * with a personal API token (`X-Api-Key`).
 */
export class PlaneClient {
  private projectsCache: { at: number; value: PlaneProject[] } | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly workspaceSlug: string,
    private readonly projectsTtlMs = 60_000
  ) {}

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/api/v1${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    let response: Response;

    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.token,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      throw new AppError(`Failed to reach Plane API at ${url}`, { code: (error as Error).name });
    }

    const text = await response.text();

    if (!response.ok) {
      throw new AppError(`Plane API responded ${response.status} for ${path}`, {
        statusCode: response.status,
        context: { body: text.slice(0, 500) },
      });
    }

    return (text ? JSON.parse(text) : undefined) as T;
  }

  private unwrapResults<T>(data: Paginated<T> | T[]): T[] {
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  private projectsPath(): string {
    return `/workspaces/${this.workspaceSlug}/projects/`;
  }

  async listProjects(force = false): Promise<PlaneProject[]> {
    if (!force && this.projectsCache && Date.now() - this.projectsCache.at < this.projectsTtlMs) {
      return this.projectsCache.value;
    }

    const data = await this.request<Paginated<PlaneProject> | PlaneProject[]>(this.projectsPath(), {
      query: { per_page: 100 },
    });
    const value = this.unwrapResults(data);
    this.projectsCache = { at: Date.now(), value };
    return value;
  }

  async findProjectByIdentifier(identifier: string): Promise<PlaneProject | undefined> {
    const projects = await this.listProjects();
    return projects.find((project) => project.identifier.toLowerCase() === identifier.toLowerCase());
  }

  async getProject(projectId: string): Promise<PlaneProject> {
    return this.request<PlaneProject>(`/workspaces/${this.workspaceSlug}/projects/${projectId}/`);
  }

  async listStates(projectId: string): Promise<PlaneState[]> {
    const data = await this.request<Paginated<PlaneState> | PlaneState[]>(
      `/workspaces/${this.workspaceSlug}/projects/${projectId}/states/`,
      { query: { per_page: 100 } }
    );
    return this.unwrapResults(data);
  }

  async listProjectMembers(projectId: string): Promise<PlaneProjectMember[]> {
    const data = await this.request<Paginated<PlaneProjectMember> | PlaneProjectMember[]>(
      `/workspaces/${this.workspaceSlug}/projects/${projectId}/project-members-lite/`,
      { query: { per_page: 100 } }
    );
    return this.unwrapResults(data);
  }

  async listWorkItems(
    projectId: string,
    options: { perPage?: number; orderBy?: string } = {}
  ): Promise<PlaneWorkItem[]> {
    const data = await this.request<Paginated<PlaneWorkItem> | PlaneWorkItem[]>(
      `/workspaces/${this.workspaceSlug}/projects/${projectId}/work-items/`,
      {
        query: {
          per_page: options.perPage ?? 50,
          order_by: options.orderBy ?? "-created_at",
          expand: "state,assignees",
        },
      }
    );
    return this.unwrapResults(data);
  }

  async getWorkItem(projectId: string, workItemId: string): Promise<PlaneWorkItem> {
    return this.request<PlaneWorkItem>(
      `/workspaces/${this.workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`
    );
  }

  async getWorkItemByKey(key: string): Promise<PlaneWorkItem> {
    return this.request<PlaneWorkItem>(`/workspaces/${this.workspaceSlug}/work-items/${key}/`);
  }

  async createWorkItem(projectId: string, input: CreateWorkItemInput): Promise<PlaneWorkItem> {
    return this.request<PlaneWorkItem>(`/workspaces/${this.workspaceSlug}/projects/${projectId}/work-items/`, {
      method: "POST",
      body: input,
    });
  }

  async updateWorkItem(
    projectId: string,
    workItemId: string,
    input: Partial<CreateWorkItemInput>
  ): Promise<PlaneWorkItem> {
    return this.request<PlaneWorkItem>(
      `/workspaces/${this.workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`,
      { method: "PATCH", body: input }
    );
  }

  async createComment(
    projectId: string,
    workItemId: string,
    commentHtml: string,
    external: { external_id?: string; external_source?: string } = {}
  ): Promise<unknown> {
    return this.request(`/workspaces/${this.workspaceSlug}/projects/${projectId}/work-items/${workItemId}/comments/`, {
      method: "POST",
      body: { comment_html: commentHtml, ...external },
    });
  }
}
