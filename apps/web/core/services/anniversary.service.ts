/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TAnniversaryEvent } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class AnniversaryService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetchUpcoming(workspaceSlug: string, days = 30): Promise<TAnniversaryEvent[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/upcoming-anniversaries/`, { params: { days } })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
