/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TTeamMember, TTeamMemberPayload } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class TeamService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async listTeam(workspaceSlug: string): Promise<TTeamMember[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/team/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateTeamMember(
    workspaceSlug: string,
    userId: string,
    data: Partial<TTeamMemberPayload>
  ): Promise<TTeamMember["team"]> {
    return this.post(`/api/workspaces/${workspaceSlug}/team/${userId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteTeamMember(workspaceSlug: string, userId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/team/${userId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
