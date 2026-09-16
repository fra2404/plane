/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { WorkspaceWorklogsRecap } from "@/components/worklogs/workspace-worklogs-recap";

export default function WorkspaceWorklogsPage() {
  return (
    <div className="w-full p-4 lg:p-6">
      <WorkspaceWorklogsRecap />
    </div>
  );
}
