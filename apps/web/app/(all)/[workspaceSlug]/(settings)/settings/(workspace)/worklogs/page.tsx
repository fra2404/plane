/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TWorkspaceWorklogMonthProjectUserTotal, TWorkspaceWorklogSummary, TWorklogPayment } from "@plane/types";
import { formatWorklogDuration } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
// services
import { IssueService } from "@/services/issue";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { WorklogsWorkspaceSettingsHeader } from "./header";

const issueService = new IssueService();

const monthEnd = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
};

const formatMonth = (month: string) => {
  const date = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
};

const hours = (seconds: number) => (seconds / 3600).toFixed(1);

const paymentKey = (month: string, projectId: string, actorId: string) => `${month}|${projectId}|${actorId}`;

type TPaymentDraft = { paid_at?: string; hours?: string; amount?: string; note?: string };

const hoursToInput = (seconds: number) => {
  const value = Number((seconds / 3600).toFixed(2));
  return value ? String(value) : "";
};

const inputToSeconds = (value: string | undefined) => Math.round((Number(value) || 0) * 3600);

const WorkspaceWorklogsSettingsPage = observer(function WorkspaceWorklogsSettingsPage() {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { updateProject } = useProject();

  const [overview, setOverview] = useState<TWorkspaceWorklogSummary | null>(null);
  const [summary, setSummary] = useState<TWorkspaceWorklogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [budgetDraft, setBudgetDraft] = useState<Record<string, { general?: string; month?: string }>>({});
  const [savingBudget, setSavingBudget] = useState<string | null>(null);
  const [paymentEditDraft, setPaymentEditDraft] = useState<Record<string, TPaymentDraft>>({});
  const [paymentNewDraft, setPaymentNewDraft] = useState<Record<string, TPaymentDraft>>({});
  const [savingPayment, setSavingPayment] = useState<string | null>(null);

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  const projectTotals = summary?.project_totals ?? overview?.project_totals ?? [];

  const setDraft = (projectId: string, key: "general" | "month", value: string) =>
    setBudgetDraft((prev) => ({ ...prev, [projectId]: { ...prev[projectId], [key]: value } }));

  const fetchSummary = async () => {
    if (!workspaceSlug || !canAdmin) return;
    setIsLoading(true);
    setHasError(false);
    const params =
      selectedMonth === "all" ? undefined : { date_from: `${selectedMonth}-01`, date_to: monthEnd(selectedMonth) };
    try {
      const response = await issueService.fetchWorkspaceWorklogSummary(workspaceSlug, params);
      setSummary(response);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBudget = async (projectId: string, budgetMonths: Record<string, number> | null | undefined) => {
    if (!workspaceSlug) return;
    const draft = budgetDraft[projectId] ?? {};
    const payload: { budget_hours?: number | null; budget_months?: Record<string, number> } = {};

    if (draft.general !== undefined) {
      const trimmed = draft.general.trim();
      const value = trimmed === "" ? null : Number(trimmed);
      if (value !== null && Number.isNaN(value)) return;
      payload.budget_hours = value;
    }

    if (selectedMonth !== "all" && draft.month !== undefined) {
      const nextMonths = { ...budgetMonths };
      const trimmed = draft.month.trim();
      if (trimmed === "") {
        delete nextMonths[selectedMonth];
      } else {
        const value = Number(trimmed);
        if (Number.isNaN(value)) return;
        nextMonths[selectedMonth] = value;
      }
      payload.budget_months = nextMonths;
    }

    setSavingBudget(projectId);
    try {
      await updateProject(workspaceSlug, projectId, payload);
      setBudgetDraft((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      await fetchSummary();
    } catch {
      // ignore; input keeps the value
    } finally {
      setSavingBudget(null);
    }
  };

  const startNewPayment = (group: { key: string; residual: number }) => {
    const today = new Date().toISOString().slice(0, 10);
    setPaymentNewDraft((prev) => ({
      ...prev,
      [group.key]: { paid_at: today, hours: hoursToInput(group.residual), amount: "", note: "" },
    }));
  };

  const cancelNewPayment = (key: string) =>
    setPaymentNewDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const saveNewPayment = async (group: { key: string; row: TWorkspaceWorklogMonthProjectUserTotal }) => {
    if (!workspaceSlug || !group.row.project_id || !group.row.actor_id) return;
    const draft = paymentNewDraft[group.key];
    if (!draft) return;
    setSavingPayment(group.key);
    try {
      await issueService.createWorkspaceWorklogPayment(workspaceSlug, {
        project: group.row.project_id,
        actor: group.row.actor_id,
        month: group.row.month,
        duration: inputToSeconds(draft.hours),
        paid_at: draft.paid_at ? draft.paid_at : null,
        amount: draft.amount === undefined || draft.amount === "" ? null : draft.amount,
        note: draft.note ?? "",
      });
      cancelNewPayment(group.key);
      await fetchSummary();
    } catch {
      // keep the draft so the value is not lost
    } finally {
      setSavingPayment(null);
    }
  };

  const savePaymentEdit = async (payment: TWorklogPayment) => {
    if (!workspaceSlug) return;
    const draft = paymentEditDraft[payment.id];
    if (!draft) return;
    setSavingPayment(payment.id);
    try {
      await issueService.updateWorkspaceWorklogPayment(workspaceSlug, payment.id, {
        duration: inputToSeconds(draft.hours),
        paid_at: draft.paid_at ? draft.paid_at : null,
        amount: draft.amount === undefined || draft.amount === "" ? null : draft.amount,
        note: draft.note ?? "",
      });
      setPaymentEditDraft((prev) => {
        const next = { ...prev };
        delete next[payment.id];
        return next;
      });
      await fetchSummary();
    } catch {
      // keep the draft so the value is not lost
    } finally {
      setSavingPayment(null);
    }
  };

  const deletePayment = async (payment: TWorklogPayment) => {
    if (!workspaceSlug) return;
    setSavingPayment(payment.id);
    try {
      await issueService.deleteWorkspaceWorklogPayment(workspaceSlug, payment.id);
      await fetchSummary();
    } catch {
      // ignore
    } finally {
      setSavingPayment(null);
    }
  };

  // Full (unfiltered) overview: keeps the month list and per-month totals stable.
  useEffect(() => {
    if (!workspaceSlug || !canAdmin) return;
    let isActive = true;
    const load = async () => {
      try {
        const response = await issueService.fetchWorkspaceWorklogSummary(workspaceSlug);
        if (isActive) setOverview(response);
      } catch {
        // overview is best-effort
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [workspaceSlug, canAdmin]);

  // Filtered detail for the selected month.
  useEffect(() => {
    if (!workspaceSlug || !canAdmin) return;
    let isActive = true;
    setIsLoading(true);
    setHasError(false);
    const params =
      selectedMonth === "all" ? undefined : { date_from: `${selectedMonth}-01`, date_to: monthEnd(selectedMonth) };
    const load = async () => {
      try {
        const response = await issueService.fetchWorkspaceWorklogSummary(workspaceSlug, params);
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
  }, [workspaceSlug, canAdmin, selectedMonth]);

  if (workspaceUserInfo && !canAdmin) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  const pageTitle = currentWorkspace?.name ? `${currentWorkspace.name} - Worklogs` : undefined;
  const userTotals = summary?.user_totals ?? [];
  const rows = summary?.results ?? [];
  const months = overview?.monthly_totals ?? summary?.monthly_totals ?? [];
  const paymentGroups = useMemo(() => {
    const projectUserRows = summary?.monthly_project_user_totals ?? [];
    const byKey = new Map<string, TWorklogPayment[]>();
    (summary?.payments ?? []).forEach((payment) => {
      if (!payment.project_id || !payment.actor_id) return;
      const key = paymentKey(payment.month, payment.project_id, payment.actor_id);
      const list = byKey.get(key) ?? [];
      list.push(payment);
      byKey.set(key, list);
    });
    return projectUserRows
      .filter((row) => row.project_id && row.actor_id)
      .map((row) => {
        const key = paymentKey(row.month, row.project_id ?? "", row.actor_id ?? "");
        const payments = (byKey.get(key) ?? [])
          .slice()
          // oxlint-disable-next-line unicorn/no-array-sort
          .sort((a, b) => (a.paid_at ?? "").localeCompare(b.paid_at ?? ""));
        const paidDuration = row.paid_duration ?? 0;
        return { key, row, payments, paidDuration, residual: Math.max(0, row.duration - paidDuration) };
      });
  }, [summary?.monthly_project_user_totals, summary?.payments]);

  return (
    <SettingsContentWrapper header={<WorklogsWorkspaceSettingsHeader />} hugging>
      <PageHead title={pageTitle} />
      <section className="size-full">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3.5">
          <h4 className="text-h3-medium">{t("common.worklogs")}</h4>
          <div className="flex items-center gap-3">
            <label className="text-body-sm-regular text-tertiary" htmlFor="worklog-month">
              {selectedMonth === "all" ? "All months" : formatMonth(selectedMonth)}
            </label>
            <select
              id="worklog-month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
            >
              <option value="all">All months</option>
              {months.map((item) => (
                <option key={item.month} value={item.month}>
                  {formatMonth(item.month)}
                </option>
              ))}
            </select>
            <span className="text-body-sm-regular text-tertiary">
              Total:{" "}
              <span className="font-medium text-primary">{formatWorklogDuration(summary?.total_logged_time ?? 0)}</span>
            </span>
          </div>
        </div>

        {isLoading && <p className="py-3 text-body-sm-regular text-tertiary">{t("loading")}...</p>}

        {!isLoading && hasError && (
          <p className="py-3 text-body-sm-regular text-danger-primary">{t("something_went_wrong_please_try_again")}</p>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-8">
            <div>
              <h5 className="pb-2 text-body-sm-medium text-secondary">By month</h5>
              {months.length === 0 ? (
                <p className="py-2 text-body-sm-regular text-tertiary">{t("activity_empty_state.no_worklogs")}</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium">{t("common.worklogs")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("common.duration")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((item) => (
                        <tr
                          key={item.month}
                          className="cursor-pointer border-t border-subtle hover:bg-surface-2"
                          onClick={() => setSelectedMonth((current) => (current === item.month ? "all" : item.month))}
                        >
                          <td className="px-3 py-2 text-primary">{formatMonth(item.month)}</td>
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
              <h5 className="pb-2 text-body-sm-medium text-secondary">Ore pagate</h5>
              <p className="pb-3 text-body-xs-regular text-tertiary">
                Storico pagamenti per membro, progetto e mese. Puoi aggiungere più pagamenti nello stesso mese (es.
                acconto a metà mese e saldo a fine mese): il residuo &quot;da pagare&quot; si calcola automaticamente.
                {selectedMonth !== "all" && ` Mese selezionato: ${formatMonth(selectedMonth)}.`}
              </p>
              {paymentGroups.length === 0 ? (
                <p className="py-2 text-body-sm-regular text-tertiary">{t("activity_empty_state.no_worklogs")}</p>
              ) : (
                <div className="space-y-3">
                  {paymentGroups.map((group) => {
                    const newDraft = paymentNewDraft[group.key];
                    return (
                      <div key={group.key} className="rounded-md border border-subtle p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm-regular">
                            <span className="font-medium text-primary">
                              {group.row.actor_detail?.display_name ?? t("unknown_user")}
                            </span>
                            <span className="text-tertiary">{group.row.project_name}</span>
                            <span className="text-tertiary">{formatMonth(group.row.month)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-body-sm-regular">
                            <span className="text-tertiary">
                              Ore: <span className="text-primary">{hours(group.row.duration)}</span>
                            </span>
                            <span className="text-tertiary">
                              Pagate: <span className="text-primary">{hours(group.paidDuration)}</span>
                            </span>
                            <span className={group.residual > 1 ? "font-medium text-danger-primary" : "text-tertiary"}>
                              Da pagare: {hours(group.residual)}
                            </span>
                            <button
                              type="button"
                              onClick={() => startNewPayment(group)}
                              className="rounded bg-accent-primary px-2 py-1 text-11 text-white"
                            >
                              + Pagamento
                            </button>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded border border-subtle">
                          <table className="w-full table-auto text-left text-body-sm-regular">
                            <thead className="bg-surface-2 text-tertiary">
                              <tr>
                                <th className="px-3 py-1.5 font-medium">Data</th>
                                <th className="px-3 py-1.5 font-medium">Ore</th>
                                <th className="px-3 py-1.5 font-medium">Importo €</th>
                                <th className="px-3 py-1.5 font-medium">Nota</th>
                                <th className="px-3 py-1.5" />
                              </tr>
                            </thead>
                            <tbody>
                              {group.payments.map((payment) => {
                                const draft = paymentEditDraft[payment.id] ?? {};
                                const paidAt = draft.paid_at ?? payment.paid_at ?? "";
                                const hoursValue = draft.hours ?? hoursToInput(payment.duration);
                                const amountValue = draft.amount ?? payment.amount ?? "";
                                const noteValue = draft.note ?? payment.note ?? "";
                                const dirty = Object.keys(draft).length > 0;
                                return (
                                  <tr key={payment.id} className="border-t border-subtle">
                                    <td className="px-3 py-1.5">
                                      <input
                                        type="date"
                                        value={paidAt}
                                        onChange={(event) =>
                                          setPaymentEditDraft((prev) => ({
                                            ...prev,
                                            [payment.id]: { ...prev[payment.id], paid_at: event.target.value },
                                          }))
                                        }
                                        className="rounded border border-subtle bg-surface-1 px-2 py-1 text-body-sm-regular text-primary outline-none"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        value={hoursValue}
                                        onChange={(event) =>
                                          setPaymentEditDraft((prev) => ({
                                            ...prev,
                                            [payment.id]: { ...prev[payment.id], hours: event.target.value },
                                          }))
                                        }
                                        className="w-20 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="—"
                                        value={amountValue}
                                        onChange={(event) =>
                                          setPaymentEditDraft((prev) => ({
                                            ...prev,
                                            [payment.id]: { ...prev[payment.id], amount: event.target.value },
                                          }))
                                        }
                                        className="w-24 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input
                                        type="text"
                                        placeholder="—"
                                        value={noteValue}
                                        onChange={(event) =>
                                          setPaymentEditDraft((prev) => ({
                                            ...prev,
                                            [payment.id]: { ...prev[payment.id], note: event.target.value },
                                          }))
                                        }
                                        className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-body-sm-regular text-primary outline-none"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {dirty && (
                                          <button
                                            type="button"
                                            disabled={savingPayment === payment.id}
                                            onClick={() => void savePaymentEdit(payment)}
                                            className="rounded bg-accent-primary px-2 py-1 text-11 text-white disabled:opacity-50"
                                          >
                                            Salva
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          disabled={savingPayment === payment.id}
                                          onClick={() => void deletePayment(payment)}
                                          className="rounded border border-subtle px-2 py-1 text-11 text-danger-primary disabled:opacity-50"
                                        >
                                          Elimina
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {newDraft && (
                                <tr className="border-t border-subtle bg-surface-2">
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="date"
                                      value={newDraft.paid_at ?? ""}
                                      onChange={(event) =>
                                        setPaymentNewDraft((prev) => ({
                                          ...prev,
                                          [group.key]: { ...prev[group.key], paid_at: event.target.value },
                                        }))
                                      }
                                      className="rounded border border-subtle bg-surface-1 px-2 py-1 text-body-sm-regular text-primary outline-none"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      value={newDraft.hours ?? ""}
                                      onChange={(event) =>
                                        setPaymentNewDraft((prev) => ({
                                          ...prev,
                                          [group.key]: { ...prev[group.key], hours: event.target.value },
                                        }))
                                      }
                                      className="w-20 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="—"
                                      value={newDraft.amount ?? ""}
                                      onChange={(event) =>
                                        setPaymentNewDraft((prev) => ({
                                          ...prev,
                                          [group.key]: { ...prev[group.key], amount: event.target.value },
                                        }))
                                      }
                                      className="w-24 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="text"
                                      placeholder="Nota"
                                      value={newDraft.note ?? ""}
                                      onChange={(event) =>
                                        setPaymentNewDraft((prev) => ({
                                          ...prev,
                                          [group.key]: { ...prev[group.key], note: event.target.value },
                                        }))
                                      }
                                      className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-body-sm-regular text-primary outline-none"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        disabled={savingPayment === group.key}
                                        onClick={() => void saveNewPayment(group)}
                                        className="rounded bg-accent-primary px-2 py-1 text-11 text-white disabled:opacity-50"
                                      >
                                        Salva
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => cancelNewPayment(group.key)}
                                        className="rounded border border-subtle px-2 py-1 text-11 text-secondary"
                                      >
                                        Annulla
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {group.payments.length === 0 && !newDraft && (
                                <tr className="border-t border-subtle">
                                  <td colSpan={5} className="px-3 py-2 text-tertiary">
                                    Nessun pagamento registrato.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h5 className="pb-2 text-body-sm-medium text-secondary">Per progetto (budget ore)</h5>
              <p className="pb-2 text-body-xs-regular text-tertiary">
                Budget generale del progetto; selezionando un mese puoi impostare un budget specifico che ha priorità su
                quello generale.
              </p>
              {projectTotals.length === 0 ? (
                <p className="py-2 text-body-sm-regular text-tertiary">{t("activity_empty_state.no_worklogs")}</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">Progetto</th>
                        <th className="px-3 py-2 text-right font-medium">Budget gen. (h)</th>
                        {selectedMonth !== "all" && (
                          <th className="px-3 py-2 text-right font-medium">Budget mese (h)</th>
                        )}
                        <th className="px-3 py-2 text-right font-medium">Registrate (h)</th>
                        <th className="px-3 py-2 text-right font-medium">Residuo (h)</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {projectTotals.map((item) => {
                        if (!item.project_id) return null;
                        const projectId = item.project_id;
                        const logged = item.duration / 3600;
                        const generalBudget = item.budget_hours;
                        const monthBudget =
                          selectedMonth === "all" ? null : (item.budget_months?.[selectedMonth] ?? null);
                        const effective = monthBudget ?? generalBudget;
                        const remaining = effective != null ? effective - logged : null;
                        const draft = budgetDraft[projectId] ?? {};
                        const dirty = draft.general !== undefined || draft.month !== undefined;
                        return (
                          <tr key={projectId} className="border-t border-subtle">
                            <td className="px-3 py-2 text-primary">{item.project_name}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                placeholder="—"
                                value={draft.general ?? (generalBudget != null ? String(generalBudget) : "")}
                                onChange={(event) => setDraft(projectId, "general", event.target.value)}
                                className="w-20 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                              />
                            </td>
                            {selectedMonth !== "all" && (
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  placeholder="—"
                                  value={draft.month ?? (monthBudget != null ? String(monthBudget) : "")}
                                  onChange={(event) => setDraft(projectId, "month", event.target.value)}
                                  className="w-20 rounded border border-subtle bg-surface-1 px-2 py-1 text-right text-body-sm-regular text-primary outline-none"
                                />
                              </td>
                            )}
                            <td className="px-3 py-2 text-right text-secondary">{hours(item.duration)}</td>
                            <td
                              className={`px-3 py-2 text-right font-medium ${
                                remaining != null && remaining < 0 ? "text-danger-primary" : "text-primary"
                              }`}
                            >
                              {remaining != null ? remaining.toFixed(1) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {dirty && (
                                <button
                                  type="button"
                                  disabled={savingBudget === projectId}
                                  onClick={() => void saveBudget(projectId, item.budget_months)}
                                  className="rounded bg-accent-primary px-2 py-1 text-11 text-white disabled:opacity-50"
                                >
                                  Salva
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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
