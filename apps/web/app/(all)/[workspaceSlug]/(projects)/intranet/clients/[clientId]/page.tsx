/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Building2, Calendar, Mail, MapPin, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type {
  TClientNote,
  TClientNoteKind,
  TIntranetClientDetail,
  TIntranetClientStatus,
  TIntranetQuote,
  TQuoteStatus,
} from "@plane/types";
import { Input, TextArea } from "@plane/ui";
import { formatWorklogDuration } from "@plane/utils";
// components
import { PageHead } from "@/components/core/page-title";
// services
import { IntranetService } from "@/services/intranet.service";
import { TeamService } from "@/services/team.service";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";

const intranetService = new IntranetService();
const teamService = new TeamService();

const NOTE_KINDS: { key: TClientNoteKind; label: string }[] = [
  { key: "nota", label: "Nota" },
  { key: "chiamata", label: "Chiamata" },
  { key: "meeting", label: "Meeting" },
  { key: "email", label: "Email" },
  { key: "altro", label: "Altro" },
];

const ClientDetailPage = observer(function ClientDetailPage() {
  const { workspaceSlug, clientId } = useParams();
  const ws = workspaceSlug?.toString();
  const cid = clientId?.toString();

  const { allowPermissions } = useUserPermissions();
  const { workspaceProjectIds, getProjectById, updateProject } = useProject();
  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  const [detail, setDetail] = useState<TIntranetClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState<Partial<TIntranetClientDetail> | null>(null);
  const [noteKind, setNoteKind] = useState<TClientNoteKind>("nota");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addingProject, setAddingProject] = useState("");
  const [noteDue, setNoteDue] = useState("");
  const [noteAssignee, setNoteAssignee] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [quoteForm, setQuoteForm] = useState<Partial<TIntranetQuote> | null>(null);

  const load = useCallback(async () => {
    if (!ws || !cid) return;
    setIsLoading(true);
    setHasError(false);
    try {
      setDetail(await intranetService.getClient(ws, cid));
      const team = await teamService.listTeam(ws);
      setMembers(
        (team ?? []).map((member) => ({
          id: member.user_id,
          name: member.user_detail?.display_name ?? member.user_id,
        }))
      );
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [ws, cid]);

  useEffect(() => {
    void load();
  }, [load]);

  const linkedIds = useMemo(() => new Set((detail?.projects ?? []).map((project) => project.id)), [detail]);
  const availableProjects = useMemo(
    () => (workspaceProjectIds ?? []).filter((projectId) => !linkedIds.has(projectId)),
    [workspaceProjectIds, linkedIds]
  );

  const saveClient = async () => {
    if (!ws || !cid || !editForm) return;
    setIsSaving(true);
    try {
      await intranetService.updateClient(ws, cid, {
        name: editForm.name,
        vat: editForm.vat,
        email: editForm.email,
        phone: editForm.phone,
        website: editForm.website,
        address: editForm.address,
        notes: editForm.notes,
        status: editForm.status,
      });
      setEditForm(null);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Salvato", message: "Cliente aggiornato." });
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Salvataggio non riuscito." });
    } finally {
      setIsSaving(false);
    }
  };

  const linkProject = async (projectId: string) => {
    if (!ws || !cid || !projectId) return;
    try {
      await updateProject(ws, projectId, { client: cid });
      setAddingProject("");
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Collegamento non riuscito." });
    }
  };

  const unlinkProject = async (projectId: string) => {
    if (!ws) return;
    try {
      await updateProject(ws, projectId, { client: null });
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Operazione non riuscita." });
    }
  };

  const addNote = async () => {
    if (!ws || !cid || !noteContent.trim()) return;
    setIsSaving(true);
    try {
      await intranetService.createClientNote(ws, cid, {
        kind: noteKind,
        content: noteContent,
        occurred_at: `${noteDate}T12:00:00Z`,
        due_date: noteDue || null,
        assignee: noteAssignee || null,
      });
      setNoteContent("");
      setNoteDue("");
      setNoteAssignee("");
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Nota non salvata." });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNoteDone = async (note: TClientNote) => {
    if (!ws || !cid) return;
    try {
      await intranetService.updateClientNote(ws, cid, note.id, { is_done: !note.is_done });
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Aggiornamento non riuscito." });
    }
  };

  const deleteNote = async (note: TClientNote) => {
    if (!ws || !cid) return;
    try {
      await intranetService.deleteClientNote(ws, cid, note.id);
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Eliminazione non riuscita." });
    }
  };

  const canEditClient = canAdmin;

  const saveQuote = async () => {
    if (!ws || !cid || !quoteForm?.title?.trim() || quoteForm.amount === undefined) return;
    setIsSaving(true);
    try {
      const payload = {
        title: quoteForm.title,
        code: quoteForm.code ?? "",
        client: cid,
        status: (quoteForm.status ?? "bozza") as TQuoteStatus,
        amount: String(quoteForm.amount ?? "0"),
        tax_rate: String(quoteForm.tax_rate ?? "22"),
        issued_date: quoteForm.issued_date || null,
        valid_until: quoteForm.valid_until || null,
        notes: quoteForm.notes ?? "",
      };
      if (quoteForm.id) await intranetService.updateQuote(ws, quoteForm.id, payload);
      else await intranetService.createQuote(ws, payload);
      setQuoteForm(null);
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Preventivo non salvato." });
    } finally {
      setIsSaving(false);
    }
  };

  const removeQuote = async (quote: TIntranetQuote) => {
    if (!ws) return;
    try {
      await intranetService.deleteQuote(ws, quote.id);
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Eliminazione non riuscita." });
    }
  };

  return (
    <>
      <PageHead title={detail?.name ?? "Cliente"} />
      <div className="w-full p-4 lg:p-6">
        {isLoading ? (
          <p className="py-4 text-body-sm-regular text-tertiary">Caricamento...</p>
        ) : hasError || !detail ? (
          <p className="py-4 text-body-sm-regular text-danger-primary">Impossibile caricare il cliente.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-h4-medium text-primary">{detail.name}</h2>
                  <span className="rounded border border-subtle px-2 py-0.5 text-11 text-tertiary uppercase">
                    {detail.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm-regular text-tertiary">
                  {detail.vat && <span>P.IVA {detail.vat}</span>}
                  {detail.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5" /> {detail.email}
                    </span>
                  )}
                  {detail.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" /> {detail.phone}
                    </span>
                  )}
                  {detail.website && <span>{detail.website}</span>}
                  {detail.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" /> {detail.address}
                    </span>
                  )}
                </div>
              </div>
              {canEditClient && !editForm && (
                <Button variant="secondary" size="sm" onClick={() => setEditForm({ ...detail })}>
                  Modifica anagrafica
                </Button>
              )}
            </div>

            {editForm && (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-2">
                <Input
                  placeholder="Ragione sociale"
                  value={editForm.name ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                />
                <Input
                  placeholder="P.IVA"
                  value={editForm.vat ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, vat: event.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={editForm.email ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                />
                <Input
                  placeholder="Telefono"
                  value={editForm.phone ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                />
                <Input
                  placeholder="Sito web"
                  value={editForm.website ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, website: event.target.value })}
                />
                <select
                  value={editForm.status ?? "active"}
                  onChange={(event) =>
                    setEditForm({ ...editForm, status: event.target.value as TIntranetClientStatus })
                  }
                  className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                >
                  <option value="active">Attivo</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inattivo</option>
                </select>
                <TextArea
                  placeholder="Indirizzo"
                  value={editForm.address ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
                  className="md:col-span-2"
                  rows={2}
                />
                <TextArea
                  placeholder="Note"
                  value={editForm.notes ?? ""}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                  className="md:col-span-2"
                  rows={2}
                />
                <div className="flex gap-2 md:col-span-2">
                  <Button variant="primary" size="sm" onClick={saveClient} loading={isSaving}>
                    Salva
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditForm(null)}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-md border border-subtle p-4">
                <p className="text-body-xs-regular text-tertiary uppercase">Ore totali</p>
                <p className="text-h5-medium text-primary">{formatWorklogDuration(detail.total_logged_time)}</p>
              </div>
              <div className="rounded-md border border-subtle p-4">
                <p className="text-body-xs-regular text-tertiary uppercase">Importo pagato</p>
                <p className="text-h5-medium text-primary">€ {Number(detail.total_paid_amount || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-subtle p-4">
                <p className="text-body-xs-regular text-tertiary uppercase">Progetti</p>
                <p className="text-h5-medium text-primary">{detail.projects.length}</p>
              </div>
            </div>

            <div>
              <h5 className="pb-2 text-body-sm-medium text-secondary">Progetti collegati</h5>
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <select
                  value={addingProject}
                  onChange={(event) => setAddingProject(event.target.value)}
                  className="min-w-56 rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                >
                  <option value="">Collega un progetto…</option>
                  {availableProjects.map((projectId) => (
                    <option key={projectId} value={projectId}>
                      {getProjectById(projectId)?.name ?? projectId}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!addingProject}
                  onClick={() => void linkProject(addingProject)}
                >
                  <span className="flex items-center gap-1">
                    <Plus className="size-3.5" /> Collega
                  </span>
                </Button>
              </div>
              {detail.projects.length === 0 ? (
                <p className="py-2 text-body-sm-regular text-tertiary">Nessun progetto collegato.</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-subtle">
                  <table className="w-full table-auto text-left text-body-sm-regular">
                    <thead className="bg-surface-2 text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">Progetto</th>
                        <th className="px-3 py-2 text-right font-medium">Budget (h)</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.projects.map((project) => (
                        <tr key={project.id} className="border-t border-subtle">
                          <td className="px-3 py-2 text-primary">
                            <span className="text-tertiary">{project.identifier}</span> {project.name}
                          </td>
                          <td className="px-3 py-2 text-right text-secondary">
                            {project.budget_hours != null ? project.budget_hours : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="rounded border border-subtle px-2 py-1 text-11 text-danger-primary"
                              onClick={() => void unlinkProject(project.id)}
                            >
                              Scollega
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {canAdmin && (
              <div>
                <div className="flex items-center justify-between pb-2">
                  <h5 className="text-body-sm-medium text-secondary">Preventivi</h5>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setQuoteForm({ status: "bozza", tax_rate: "22", amount: "0" })}
                  >
                    <span className="flex items-center gap-1">
                      <Plus className="size-3.5" /> Nuovo preventivo
                    </span>
                  </Button>
                </div>
                {quoteForm && (
                  <div className="mb-3 grid grid-cols-1 gap-2 rounded-md border border-subtle p-3 md:grid-cols-3">
                    <Input
                      placeholder="Titolo *"
                      value={quoteForm.title ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, title: event.target.value })}
                    />
                    <Input
                      placeholder="Codice (es. PREV-2026-001)"
                      value={quoteForm.code ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, code: event.target.value })}
                    />
                    <select
                      value={quoteForm.status ?? "bozza"}
                      onChange={(event) => setQuoteForm({ ...quoteForm, status: event.target.value as TQuoteStatus })}
                      className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                    >
                      <option value="bozza">Bozza</option>
                      <option value="inviato">Inviato</option>
                      <option value="accettato">Accettato</option>
                      <option value="rifiutato">Rifiutato</option>
                      <option value="scaduto">Scaduto</option>
                    </select>
                    <Input
                      placeholder="Importo netto €"
                      type="number"
                      step="0.01"
                      value={quoteForm.amount ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, amount: event.target.value })}
                    />
                    <Input
                      placeholder="IVA %"
                      type="number"
                      step="0.01"
                      value={quoteForm.tax_rate ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, tax_rate: event.target.value })}
                    />
                    <Input
                      type="date"
                      value={quoteForm.issued_date ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, issued_date: event.target.value })}
                    />
                    <Input
                      type="date"
                      value={quoteForm.valid_until ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, valid_until: event.target.value })}
                    />
                    <TextArea
                      placeholder="Note"
                      value={quoteForm.notes ?? ""}
                      onChange={(event) => setQuoteForm({ ...quoteForm, notes: event.target.value })}
                      className="md:col-span-3"
                      rows={2}
                    />
                    <div className="flex gap-2 md:col-span-3">
                      <Button variant="primary" size="sm" onClick={saveQuote} loading={isSaving}>
                        Salva
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setQuoteForm(null)}>
                        Annulla
                      </Button>
                    </div>
                  </div>
                )}
                {(detail.quotes ?? []).length === 0 ? (
                  <p className="py-2 text-body-sm-regular text-tertiary">Nessun preventivo.</p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-subtle">
                    <table className="w-full table-auto text-left text-body-sm-regular">
                      <thead className="bg-surface-2 text-tertiary">
                        <tr>
                          <th className="px-3 py-2 font-medium">Titolo</th>
                          <th className="px-3 py-2 font-medium">Stato</th>
                          <th className="px-3 py-2 text-right font-medium">Netto €</th>
                          <th className="px-3 py-2 text-right font-medium">Totale €</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.quotes ?? []).map((quote) => (
                          <tr key={quote.id} className="border-t border-subtle">
                            <td className="px-3 py-2 text-primary">
                              {quote.title}
                              {quote.code && <span className="ml-1 text-tertiary">({quote.code})</span>}
                            </td>
                            <td className="px-3 py-2 text-secondary uppercase">{quote.status}</td>
                            <td className="px-3 py-2 text-right text-secondary">{Number(quote.amount).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-medium text-primary">
                              {Number(quote.total).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  className="rounded p-1 text-tertiary hover:text-primary"
                                  onClick={() => setQuoteForm({ ...quote })}
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-tertiary hover:text-danger-primary"
                                  onClick={() => void removeQuote(quote)}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h5 className="pb-2 text-body-sm-medium text-secondary">Contatti</h5>
                {detail.contacts.length === 0 ? (
                  <p className="py-2 text-body-sm-regular text-tertiary">Nessun contatto registrato.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-md border border-subtle p-3">
                        <p className="flex items-center gap-1 text-body-sm-medium text-primary">
                          <User className="size-3.5" /> {contact.name}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-xs-regular text-tertiary">
                          {contact.role && <span>{contact.role}</span>}
                          {contact.email && <span>{contact.email}</span>}
                          {contact.phone && <span>{contact.phone}</span>}
                          {contact.mobile && <span>{contact.mobile}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h5 className="pb-2 text-body-sm-medium text-secondary">Timeline</h5>
                <div className="mb-3 space-y-2 rounded-md border border-subtle p-3">
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={noteKind}
                      onChange={(event) => setNoteKind(event.target.value as TClientNoteKind)}
                      className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                    >
                      {NOTE_KINDS.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(event) => setNoteDate(event.target.value)}
                      className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                    />
                    <input
                      type="date"
                      value={noteDue}
                      onChange={(event) => setNoteDue(event.target.value)}
                      title="Scadenza attività"
                      className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                    />
                    <select
                      value={noteAssignee}
                      onChange={(event) => setNoteAssignee(event.target.value)}
                      className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
                    >
                      <option value="">Nessun assegnatario</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TextArea
                    placeholder="Aggiungi una nota (interazione, chiamata, follow-up…)"
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!noteContent.trim()}
                    loading={isSaving}
                    onClick={addNote}
                  >
                    Aggiungi
                  </Button>
                </div>
                {detail.timeline.length === 0 ? (
                  <p className="py-2 text-body-sm-regular text-tertiary">Nessuna nota.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.timeline.map((note) => (
                      <div key={note.id} className="rounded-md border border-subtle p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex items-center gap-2 text-body-xs-regular text-tertiary">
                            <Calendar className="size-3.5" />
                            {new Date(note.occurred_at).toLocaleDateString()}
                            <span className="rounded border border-subtle px-1.5 py-0.5 uppercase">{note.kind}</span>
                            <span>{note.author_detail?.display_name ?? ""}</span>
                            {note.due_date && <span>scad. {note.due_date}</span>}
                            {note.assignee_detail && <span>{note.assignee_detail.display_name}</span>}
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={note.is_done}
                                onChange={() => void toggleNoteDone(note)}
                              />
                              fatto
                            </label>
                          </p>
                          <button
                            type="button"
                            className="rounded p-1 text-tertiary hover:text-danger-primary"
                            onClick={() => void deleteNote(note)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        {note.content && (
                          <p className="mt-1 text-body-sm-regular whitespace-pre-wrap text-secondary">{note.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {detail.timeline.length === 0 && detail.contacts.length === 0 && !detail.projects.length && (
              <p className="flex items-center gap-2 text-body-xs-regular text-tertiary">
                <Building2 className="size-3.5" /> Inizia collegando un progetto o aggiungendo una nota.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default ClientDetailPage;
