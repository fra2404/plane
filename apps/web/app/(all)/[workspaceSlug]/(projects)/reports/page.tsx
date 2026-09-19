/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import type { TCrmsummary, TProjectExpense, TProjectMargin } from "@plane/types";
import { Input, TextArea } from "@plane/ui";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
// services
import { IntranetService } from "@/services/intranet.service";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";

const intranetService = new IntranetService();

const money = (value: string | number) => `€ ${Number(value || 0).toFixed(2)}`;

const ReportsPage = observer(function ReportsPage() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString();
  const { allowPermissions } = useUserPermissions();
  const { updateProject } = useProject();
  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  const [summary, setSummary] = useState<TCrmsummary | null>(null);
  const [margins, setMargins] = useState<TProjectMargin[]>([]);
  const [expensesByProject, setExpensesByProject] = useState<Record<string, TProjectExpense[]>>({});
  const [openExpenses, setOpenExpenses] = useState<string | null>(null);
  const [contractDraft, setContractDraft] = useState<Record<string, string>>({});
  const [expenseDraft, setExpenseDraft] = useState<{
    date: string;
    category: string;
    vendor: string;
    amount: string;
    description: string;
  }>({ date: "", category: "", vendor: "", amount: "", description: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!ws || !canAdmin) return;
    let isActive = true;
    setIsLoading(true);
    setHasError(false);
    const load = async () => {
      try {
        const [data, marginData] = await Promise.all([
          intranetService.fetchCrmSummary(ws),
          intranetService.fetchProjectsMargin(ws),
        ]);
        if (isActive) {
          setSummary(data);
          setMargins(marginData?.results ?? []);
        }
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

  const saveContract = async (projectId: string) => {
    const value = contractDraft[projectId];
    if (!ws || value === undefined) return;
    try {
      await updateProject(ws, projectId, { contract_value: value === "" ? null : value });
      const marginData = await intranetService.fetchProjectsMargin(ws);
      setMargins(marginData?.results ?? []);
      setContractDraft((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    } catch {
      // ignore
    }
  };

  const toggleExpenses = async (projectId: string) => {
    if (!ws) return;
    if (openExpenses === projectId) {
      setOpenExpenses(null);
      return;
    }
    setOpenExpenses(projectId);
    setExpenseDraft({ date: "", category: "", vendor: "", amount: "", description: "" });
    try {
      const data = await intranetService.listExpenses(ws, projectId);
      setExpensesByProject((prev) => ({ ...prev, [projectId]: data ?? [] }));
    } catch {
      // ignore
    }
  };

  const addExpense = async (projectId: string) => {
    if (!ws || expenseDraft.amount === "") return;
    try {
      await intranetService.createExpense(ws, {
        project: projectId,
        date: expenseDraft.date || null,
        category: expenseDraft.category,
        vendor: expenseDraft.vendor,
        amount: expenseDraft.amount,
        description: expenseDraft.description,
      });
      const [expenses, marginData] = await Promise.all([
        intranetService.listExpenses(ws, projectId),
        intranetService.fetchProjectsMargin(ws),
      ]);
      setExpensesByProject((prev) => ({ ...prev, [projectId]: expenses ?? [] }));
      setMargins(marginData?.results ?? []);
      setExpenseDraft({ date: "", category: "", vendor: "", amount: "", description: "" });
    } catch {
      // ignore
    }
  };

  const removeExpense = async (projectId: string, expenseId: string) => {
    if (!ws) return;
    try {
      await intranetService.deleteExpense(ws, expenseId);
      const [expenses, marginData] = await Promise.all([
        intranetService.listExpenses(ws, projectId),
        intranetService.fetchProjectsMargin(ws),
      ]);
      setExpensesByProject((prev) => ({ ...prev, [projectId]: expenses ?? [] }));
      setMargins(marginData?.results ?? []);
    } catch {
      // ignore
    }
  };

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

            <div>
              <h5 className="pb-2 text-body-sm-medium text-secondary">Progetti e margini</h5>
              <p className="pb-2 text-body-xs-regular text-tertiary">
                Ricavo (valore contratto) − costo ore pagate − spese = margine.
              </p>
              <div className="overflow-x-auto rounded-md border border-subtle">
                <table className="w-full table-auto text-left text-body-sm-regular">
                  <thead className="bg-surface-2 text-tertiary">
                    <tr>
                      <th className="px-3 py-2 font-medium">Progetto</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 text-right font-medium">Contratto €</th>
                      <th className="px-3 py-2 text-right font-medium">Ore</th>
                      <th className="px-3 py-2 text-right font-medium">Costo ore €</th>
                      <th className="px-3 py-2 text-right font-medium">Spese €</th>
                      <th className="px-3 py-2 text-right font-medium">Margine €</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {margins.map((row) => (
                      <tr key={row.project_id} className="border-t border-subtle">
                        <td className="px-3 py-2 text-primary">
                          <span className="text-tertiary">{row.project_identifier}</span> {row.project_name}
                        </td>
                        <td className="px-3 py-2 text-secondary">{row.client_name ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="—"
                            value={contractDraft[row.project_id] ?? Number(row.contract_value || 0).toString()}
                            onChange={(event) =>
                              setContractDraft((prev) => ({ ...prev, [row.project_id]: event.target.value }))
                            }
                            onBlur={() => void saveContract(row.project_id)}
                            className="w-24 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-secondary">{(row.logged_time / 3600).toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-secondary">{Number(row.labor_cost).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-secondary">{Number(row.expenses).toFixed(2)}</td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            Number(row.margin) < 0 ? "text-danger-primary" : "text-primary"
                          }`}
                        >
                          {Number(row.margin).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="rounded border border-subtle px-2 py-1 text-11 text-secondary hover:text-primary"
                            onClick={() => void toggleExpenses(row.project_id)}
                          >
                            {openExpenses === row.project_id ? "Chiudi" : "Spese"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {openExpenses && (
                      <tr className="border-t border-subtle bg-surface-2">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-5">
                            <Input
                              type="date"
                              value={expenseDraft.date}
                              onChange={(event) => setExpenseDraft({ ...expenseDraft, date: event.target.value })}
                            />
                            <Input
                              placeholder="Categoria"
                              value={expenseDraft.category}
                              onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })}
                            />
                            <Input
                              placeholder="Fornitore"
                              value={expenseDraft.vendor}
                              onChange={(event) => setExpenseDraft({ ...expenseDraft, vendor: event.target.value })}
                            />
                            <Input
                              placeholder="Importo €"
                              type="number"
                              step="0.01"
                              value={expenseDraft.amount}
                              onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })}
                            />
                            <TextArea
                              placeholder="Descrizione"
                              value={expenseDraft.description}
                              rows={1}
                              onChange={(event) =>
                                setExpenseDraft({ ...expenseDraft, description: event.target.value })
                              }
                            />
                          </div>
                          <div className="mb-3">
                            <Button variant="primary" size="sm" onClick={() => void addExpense(openExpenses)}>
                              Aggiungi spesa
                            </Button>
                          </div>
                          {(expensesByProject[openExpenses] ?? []).length === 0 ? (
                            <p className="text-body-sm-regular text-tertiary">Nessuna spesa registrata.</p>
                          ) : (
                            <table className="w-full table-auto text-left text-body-sm-regular">
                              <tbody>
                                {(expensesByProject[openExpenses] ?? []).map((expense) => (
                                  <tr key={expense.id} className="border-t border-subtle">
                                    <td className="px-2 py-1 text-secondary">{expense.date ?? "—"}</td>
                                    <td className="px-2 py-1 text-secondary">{expense.category || "—"}</td>
                                    <td className="px-2 py-1 text-secondary">{expense.vendor || "—"}</td>
                                    <td className="px-2 py-1 text-right text-primary">
                                      {Number(expense.amount).toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1 text-tertiary">{expense.description}</td>
                                    <td className="px-2 py-1 text-right">
                                      <button
                                        type="button"
                                        className="rounded p-1 text-tertiary hover:text-danger-primary"
                                        onClick={() => void removeExpense(openExpenses, expense.id)}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default ReportsPage;
