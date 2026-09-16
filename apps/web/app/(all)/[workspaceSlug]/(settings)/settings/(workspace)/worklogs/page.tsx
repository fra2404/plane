/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { WorkspaceWorklogsRecap } from "@/components/worklogs/workspace-worklogs-recap";
// local imports
import { WorklogsWorkspaceSettingsHeader } from "./header";

const WorkspaceWorklogsSettingsPage = function WorkspaceWorklogsSettingsPage() {
  return (
    <SettingsContentWrapper header={<WorklogsWorkspaceSettingsHeader />} hugging>
      <WorkspaceWorklogsRecap />
    </SettingsContentWrapper>
  );
};

export default WorkspaceWorklogsSettingsPage;
