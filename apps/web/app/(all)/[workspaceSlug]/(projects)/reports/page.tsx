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
import type { TCrmsummary } from "@plane/types";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
// services
import { IntranetService } from "@/services/intranet.service";
// hooks
import { useUserPermissions } from "@/hooks/store/user";

const intranetService = new IntranetService();

const money = (value: string | number) => `€ ${Number(value || 0).toFixed(2)}`;

const ReportsPage = observer(function ReportsPage() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString();
  const { allowPermissions } = useUserPermissions();
  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  const [summary, setSummary] = useState<TCrmsummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!ws || !canAdmin) return;
    let isActive = true;
    setIsLoading(true);
    setHasError(false);
    const load = async () => {
      try {
        const data = await intranetService.fetchCrmSummary(ws);
        if (isActive) setSummary(data);
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
  }, [ws, canAdmin]);

  if (!canAdmin) return <NotAuthorizedView section="settings" className="h-auto" />;

  return (
    <>
      <PageHead title="Report" />
      <div className="w-full p-4 lg:p-6">
        {isLoading ? (
          <p className="py-4 text-body-sm-regular text-tertiary">Caricamento...</p>
        ) : hasError || !summary ? (
          <p className="py-4 text-body-sm-regular text-danger-primary">Impossibile caricare i report.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-md border border-subtle p-4">
                <p className="text-body-xs-regular text-tertiary uppercase">Pipeline aperta</p>
                <p className="text-h5-medium text-primary">{money(summary.pipeline_open_value)}</p>
              </div>
              <div className="rounded-md border border-subtle p-4">
                <p className="text-body-xs-regular text-tertiary uppercase">Vinto</p>
                <p className="text-h5-medium text-primary">{money(summary.won_total)}</p>
              </div>
              <div className="rounded-md border border-subtle p-4">
                <p className="text-body-xs-regular text-tertiary uppercase">Preventivi (netto)</p>
                <p className="text-h5-medium text-primary">{money(summary.quotes_total)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h5 className="pb-2 text-body-sm-medium text-secondary">Pipeline per stadio</h5>
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">Stadio</th>
                        <th className="px-3 py-2 text-right font-medium">N.</th>
                        <th className="px-3 py-2 text-right font-medium">Valore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.pipeline_by_stage.map((row) => (
                        <tr key={row.stage} className="border-t border-subtle">
                          <td className="px-3 py-2 text-primary">{row.label}</td>
                          <td className="px-3 py-2 text-right text-secondary">{row.count}</td>
                          <td className="px-3 py-2 text-right text-primary">{money(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h5 className="pb-2 text-body-sm-medium text-secondary">Preventivi per stato</h5>
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">Stato</th>
                        <th className="px-3 py-2 text-right font-medium">N.</th>
                        <th className="px-3 py-2 text-right font-medium">Valore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.quotes_by_status.map((row) => (
                        <tr key={row.status} className="border-t border-subtle">
                          <td className="px-3 py-2 text-primary uppercase">{row.label}</td>
                          <td className="px-3 py-2 text-right text-secondary">{row.count}</td>
                          <td className="px-3 py-2 text-right text-primary">{money(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h5 className="pb-2 text-body-sm-medium text-secondary">Vinto per mese</h5>
                {summary.won_by_month.length === 0 ? (
                  <p className="py-2 text-body-sm-regular text-tertiary">Nessun dato.</p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-subtle">
                    <table className="w-full table-auto text-left text-body-sm-regular">
                      <thead className="bg-surface-2 text-tertiary">
                        <tr>
                          <th className="px-3 py-2 font-medium">Mese</th>
                          <th className="px-3 py-2 text-right font-medium">N.</th>
                          <th className="px-3 py-2 text-right font-medium">Valore</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.won_by_month.map((row) => (
                          <tr key={row.month} className="border-t border-subtle">
                            <td className="px-3 py-2 text-primary">{row.month}</td>
                            <td className="px-3 py-2 text-right text-secondary">{row.count}</td>
                            <td className="px-3 py-2 text-right text-primary">{money(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h5 className="pb-2 text-body-sm-medium text-secondary">Clienti (valore preventivi)</h5>
                {summary.clients.length === 0 ? (
                  <p className="py-2 text-body-sm-regular text-tertiary">Nessun dato.</p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-subtle">
                    <table className="w-full table-auto text-left text-body-sm-regular">
                      <thead className="bg-surface-2 text-tertiary">
                        <tr>
                          <th className="px-3 py-2 font-medium">Cliente</th>
                          <th className="px-3 py-2 text-right font-medium">Preventivi</th>
                          <th className="px-3 py-2 text-right font-medium">Valore</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.clients.map((row) => (
                          <tr key={row.client_id ?? row.client_name} className="border-t border-subtle">
                            <td className="px-3 py-2 text-primary">{row.client_name}</td>
                            <td className="px-3 py-2 text-right text-secondary">{row.quotes_count}</td>
                            <td className="px-3 py-2 text-right text-primary">{money(row.quotes_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default ReportsPage;
