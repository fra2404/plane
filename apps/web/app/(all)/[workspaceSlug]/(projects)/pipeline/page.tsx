/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIntranetClient, TIntranetOpportunity, TOpportunityStage } from "@plane/types";
import { Input, TextArea } from "@plane/ui";
// components
import { PageHead } from "@/components/core/page-title";
// services
import { IntranetService } from "@/services/intranet.service";
import { TeamService } from "@/services/team.service";

const intranetService = new IntranetService();
const teamService = new TeamService();

const STAGES: { key: TOpportunityStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "contattato", label: "Contattato" },
  { key: "preventivo", label: "Preventivo" },
  { key: "negoziazione", label: "Negoziazione" },
  { key: "vinto", label: "Vinto" },
  { key: "perso", label: "Perso" },
];

type TDraft = {
  name: string;
  client: string;
  stage: TOpportunityStage;
  value: string;
  expected_close_date: string;
  owner: string;
  notes: string;
};

const emptyDraft: TDraft = {
  name: "",
  client: "",
  stage: "lead",
  value: "",
  expected_close_date: "",
  owner: "",
  notes: "",
};

const PipelinePage = observer(function PipelinePage() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString();

  const [opportunities, setOpportunities] = useState<TIntranetOpportunity[]>([]);
  const [clients, setClients] = useState<TIntranetClient[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<TOpportunityStage | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const [opportunitiesData, clientsData, teamData] = await Promise.all([
        intranetService.listOpportunities(ws),
        intranetService.listClients(ws),
        teamService.listTeam(ws),
      ]);
      setOpportunities(opportunitiesData ?? []);
      setClients(clientsData ?? []);
      setMembers(
        (teamData ?? []).map((member) => ({
          id: member.user_id,
          name: member.user_detail?.display_name ?? member.user_id,
        }))
      );
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [ws]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStage = useMemo(() => {
    const map: Record<string, TIntranetOpportunity[]> = {};
    STAGES.forEach((stage) => {
      map[stage.key] = opportunities.filter((opportunity) => opportunity.stage === stage.key);
    });
    return map;
  }, [opportunities]);

  const stageTotal = (stage: TOpportunityStage) =>
    byStage[stage].reduce((sum, opportunity) => sum + Number(opportunity.value || 0), 0);

  const openPipelineValue = opportunities
    .filter((opportunity) => opportunity.stage !== "perso")
    .reduce((sum, opportunity) => sum + Number(opportunity.value || 0), 0);

  const startCreate = (stage: TOpportunityStage) => {
    setEditingId(null);
    setDraft({ ...emptyDraft, stage });
  };

  const startEdit = (opportunity: TIntranetOpportunity) => {
    setEditingId(opportunity.id);
    setDraft({
      name: opportunity.name,
      client: opportunity.client ?? "",
      stage: opportunity.stage,
      value: opportunity.value ?? "",
      expected_close_date: opportunity.expected_close_date ?? "",
      owner: opportunity.owner ?? "",
      notes: opportunity.notes ?? "",
    });
  };

  const save = async () => {
    if (!ws || !draft.name.trim()) return;
    setIsSaving(true);
    const payload = {
      name: draft.name,
      client: draft.client || null,
      stage: draft.stage,
      value: draft.value === "" ? null : draft.value,
      expected_close_date: draft.expected_close_date || null,
      owner: draft.owner || null,
      notes: draft.notes,
    };
    try {
      if (editingId) await intranetService.updateOpportunity(ws, editingId, payload);
      else await intranetService.createOpportunity(ws, payload);
      setEditingId(null);
      setDraft(emptyDraft);
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Salvataggio non riuscito." });
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (opportunity: TIntranetOpportunity) => {
    if (!ws) return;
    try {
      await intranetService.deleteOpportunity(ws, opportunity.id);
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Eliminazione non riuscita." });
    }
  };

  const moveToStage = async (opportunityId: string, stage: TOpportunityStage) => {
    if (!ws) return;
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    if (!opportunity || opportunity.stage === stage) return;
    setOpportunities((prev) => prev.map((item) => (item.id === opportunityId ? { ...item, stage } : item)));
    try {
      await intranetService.updateOpportunity(ws, opportunityId, { stage });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Spostamento non riuscito." });
      await load();
    }
  };

  const formVisible = editingId !== null || draft !== emptyDraft;
  const isDirty = draft.name !== "" || draft.client !== "" || draft.value !== "" || draft.notes !== "";

  return (
    <>
      <PageHead title="Pipeline" />
      <div className="w-full p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <h4 className="text-h3-medium text-primary">Pipeline</h4>
            <p className="text-body-xs-regular text-tertiary">
              Opportunità commerciali per stadio. Totale aperto:{" "}
              <span className="font-medium text-primary">€ {openPipelineValue.toFixed(2)}</span>
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => startCreate("lead")}>
            <span className="flex items-center gap-1">
              <Plus className="size-3.5" /> Nuova opportunità
            </span>
          </Button>
        </div>

        {(formVisible || isDirty) && (
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-3">
            <Input
              placeholder="Nome opportunità *"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <select
              value={draft.client}
              onChange={(event) => setDraft({ ...draft, client: event.target.value })}
              className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
            >
              <option value="">Nessun cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <select
              value={draft.stage}
              onChange={(event) => setDraft({ ...draft, stage: event.target.value as TOpportunityStage })}
              className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
            >
              {STAGES.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Valore (€)"
              type="number"
              step="0.01"
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
            />
            <Input
              type="date"
              value={draft.expected_close_date}
              onChange={(event) => setDraft({ ...draft, expected_close_date: event.target.value })}
            />
            <select
              value={draft.owner}
              onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
              className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
            >
              <option value="">Nessun referente</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <TextArea
              placeholder="Note"
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              className="md:col-span-3"
              rows={2}
            />
            <div className="flex gap-2 md:col-span-3">
              <Button variant="primary" size="sm" onClick={save} loading={isSaving} disabled={!draft.name.trim()}>
                {editingId ? "Aggiorna" : "Crea"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                }}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="py-4 text-body-sm-regular text-tertiary">Caricamento...</p>
        ) : hasError ? (
          <p className="py-4 text-body-sm-regular text-danger-primary">Impossibile caricare la pipeline.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {STAGES.map((stage) => (
              <div
                key={stage.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStage(stage.key);
                }}
                onDragLeave={() => setDragOverStage((prev) => (prev === stage.key ? null : prev))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverStage(null);
                  const opportunityId = event.dataTransfer.getData("text/plain");
                  if (opportunityId) void moveToStage(opportunityId, stage.key);
                }}
                className={`rounded-md border p-2 ${
                  dragOverStage === stage.key ? "border-accent-strong bg-surface-2" : "border-subtle"
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2">
                  <span className="text-body-xs-medium text-tertiary uppercase">{stage.label}</span>
                  <span className="text-11 text-tertiary">€ {stageTotal(stage.key).toFixed(0)}</span>
                </div>
                <div className="space-y-2">
                  {byStage[stage.key].map((opportunity) => (
                    <div
                      key={opportunity.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", opportunity.id)}
                      className="cursor-grab rounded-md border border-subtle bg-surface-2 p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-body-sm-medium text-primary">{opportunity.name}</p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-0.5 text-tertiary hover:text-primary"
                            onClick={() => startEdit(opportunity)}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-tertiary hover:text-danger-primary"
                            onClick={() => void remove(opportunity)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                      {opportunity.client_detail && (
                        <p className="text-11 text-tertiary">{opportunity.client_detail.name}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between text-11 text-secondary">
                        <span>{opportunity.value ? `€ ${Number(opportunity.value).toFixed(0)}` : "—"}</span>
                        <span>{opportunity.expected_close_date ?? ""}</span>
                      </div>
                      {opportunity.owner_detail && (
                        <p className="mt-0.5 text-11 text-placeholder">{opportunity.owner_detail.display_name}</p>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => startCreate(stage.key)}
                    className="w-full rounded border border-dashed border-subtle py-1 text-11 text-tertiary hover:text-primary"
                  >
                    + aggiungi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

export default PipelinePage;
