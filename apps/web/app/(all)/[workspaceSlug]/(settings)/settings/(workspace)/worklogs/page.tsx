/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TWorkspaceWorklogSummary } from "@plane/types";
import { formatWorklogDuration } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
// services
import { IssueService } from "@/services/issue";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { WorklogsWorkspaceSettingsHeader } from "./header";

const issueService = new IssueService();

const WorkspaceWorklogsSettingsPage = observer(function WorkspaceWorklogsSettingsPage() {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();

  const [summary, setSummary] = useState<TWorkspaceWorklogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  useEffect(() => {
    if (!workspaceSlug || !canAdmin) return;
    let isActive = true;
    setIsLoading(true);
    setHasError(false);
    const load = async () => {
      try {
        const response = await issueService.fetchWorkspaceWorklogSummary(workspaceSlug);
        if (isActive) setSummary(response);
      } catch {
        if (isActive) setHasError(true);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [workspaceSlug, canAdmin]);

  if (workspaceUserInfo && !canAdmin) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  const pageTitle = currentWorkspace?.name ? `${currentWorkspace.name} - Worklogs` : undefined;
  const userTotals = summary?.user_totals ?? [];
  const rows = summary?.results ?? [];

  return (
    <SettingsContentWrapper header={<WorklogsWorkspaceSettingsHeader />} hugging>
      <PageHead title={pageTitle} />
      <section className="size-full">
        <div className="flex items-center justify-between gap-4 pb-3.5">
          <h4 className="text-h3-medium">{t("common.worklogs")}</h4>
          <span className="text-body-sm-regular text-tertiary">
            Total:{" "}
            <span className="font-medium text-primary">{formatWorklogDuration(summary?.total_logged_time ?? 0)}</span>
          </span>
        </div>

        {isLoading && <p className="py-3 text-body-sm-regular text-tertiary">{t("loading")}...</p>}

        {!isLoading && hasError && (
          <p className="py-3 text-body-sm-regular text-danger-primary">{t("something_went_wrong_please_try_again")}</p>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-8">
            <div>
              <h5 className="pb-2 text-body-sm-medium text-secondary">{t("common.members")}</h5>
              {userTotals.length === 0 ? (
                <p className="py-2 text-body-sm-regular text-tertiary">{t("activity_empty_state.no_worklogs")}</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t("common.members")}</th>
                        <th className="px-3 py-2 font-medium">{t("common.worklogs")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("common.duration")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userTotals.map((item) => (
                        <tr key={item.actor_id ?? "unknown"} className="border-t border-subtle">
                          <td className="px-3 py-2 text-primary">
                            {item.actor_detail?.display_name ?? t("unknown_user")}
                          </td>
                          <td className="px-3 py-2 text-secondary">{item.worklog_count}</td>
                          <td className="px-3 py-2 text-right font-medium text-primary">
                            {formatWorklogDuration(item.duration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h5 className="pb-2 text-body-sm-medium text-secondary">{t("common.work_item")}</h5>
              {rows.length === 0 ? (
                <p className="py-2 text-body-sm-regular text-tertiary">{t("activity_empty_state.no_worklogs")}</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t("common.work_item")}</th>
                        <th className="px-3 py-2 font-medium">{t("common.project")}</th>
                        <th className="px-3 py-2 font-medium">{t("common.members")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("common.duration")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.issue_id}-${row.actor_id ?? "unknown"}`} className="border-t border-subtle">
                          <td className="px-3 py-2 text-primary">{row.issue_name}</td>
                          <td className="px-3 py-2 text-secondary">{row.project_name}</td>
                          <td className="px-3 py-2 text-secondary">
                            {row.actor_detail?.display_name ?? t("unknown_user")}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-primary">
                            {formatWorklogDuration(row.duration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </SettingsContentWrapper>
  );
});

export default WorkspaceWorklogsSettingsPage;
