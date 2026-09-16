/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Briefcase, Building2, Linkedin, Mail, MapPin, Pencil, Phone, Search } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Avatar } from "@plane/propel/avatar";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TTeamMember } from "@plane/types";
import { Input, TextArea } from "@plane/ui";
import { getFileURL } from "@plane/utils";
// components
import { PageHead } from "@/components/core/page-title";
// services
import { TeamService } from "@/services/team.service";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";

const teamService = new TeamService();

type TTeamDraft = {
  role: string;
  department: string;
  manager: string;
  phone: string;
  discord_id: string;
  location: string;
  hire_date: string;
  linkedin: string;
  notes: string;
};

const emptyDraft: TTeamDraft = {
  role: "",
  department: "",
  manager: "",
  phone: "",
  discord_id: "",
  location: "",
  hire_date: "",
  linkedin: "",
  notes: "",
};

const renderContactChips = (member: TTeamMember): ReactNode => {
  const team = member.team;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-xs-regular text-tertiary">
      {team?.role && (
        <span className="flex items-center gap-1">
          <Briefcase className="size-3.5" /> {team.role}
        </span>
      )}
      {team?.department && (
        <span className="flex items-center gap-1">
          <Building2 className="size-3.5" /> {team.department}
        </span>
      )}
      {team?.phone && (
        <span className="flex items-center gap-1">
          <Phone className="size-3.5" /> {team.phone}
        </span>
      )}
      {team?.discord_id && <span>Discord: {team.discord_id}</span>}
      {member.user_detail?.email && (
        <span className="flex items-center gap-1">
          <Mail className="size-3.5" /> {member.user_detail.email}
        </span>
      )}
      {team?.location && (
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" /> {team.location}
        </span>
      )}
      {team?.hire_date && <span>Dal {team.hire_date}</span>}
      {team?.linkedin && (
        <a
          href={team.linkedin.startsWith("http") ? team.linkedin : `https://${team.linkedin}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-primary"
        >
          <Linkedin className="size-3.5" /> LinkedIn
        </a>
      )}
    </div>
  );
};

const TeamPage = observer(function TeamPage() {
  const { workspaceSlug } = useParams();
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const ws = workspaceSlug?.toString();

  const [members, setMembers] = useState<TTeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [tab, setTab] = useState<"org" | "list">("org");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TTeamDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ws) return;
    setIsLoading(true);
    setHasError(false);
    try {
      setMembers((await teamService.listTeam(ws)) ?? []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [ws]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = (member: TTeamMember) => canAdmin || member.user_id === currentUser?.id;

  const startEdit = (member: TTeamMember) => {
    setEditingId(member.user_id);
    setDraft({
      role: member.team?.role ?? "",
      department: member.team?.department ?? "",
      manager: member.team?.manager ?? "",
      phone: member.team?.phone ?? "",
      discord_id: member.team?.discord_id ?? "",
      location: member.team?.location ?? "",
      hire_date: member.team?.hire_date ?? "",
      linkedin: member.team?.linkedin ?? "",
      notes: member.team?.notes ?? "",
    });
    if (tab === "org") setTab("list");
  };

  const save = async () => {
    if (!ws || !editingId) return;
    setIsSaving(true);
    try {
      await teamService.updateTeamMember(ws, editingId, {
        role: draft.role,
        department: draft.department,
        manager: draft.manager ? draft.manager : null,
        phone: draft.phone,
        discord_id: draft.discord_id,
        location: draft.location,
        hire_date: draft.hire_date ? draft.hire_date : null,
        linkedin: draft.linkedin,
        notes: draft.notes,
      });
      setEditingId(null);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Salvato", message: "Scheda aggiornata." });
      await load();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Errore", message: "Salvataggio non riuscito." });
    } finally {
      setIsSaving(false);
    }
  };

  const memberIds = useMemo(() => new Set(members.map((member) => member.user_id)), [members]);

  const membersByManager = useMemo(() => {
    const map = new Map<string, TTeamMember[]>();
    members.forEach((member) => {
      const manager = member.team?.manager;
      if (!manager) return;
      const list = map.get(manager) ?? [];
      list.push(member);
      map.set(manager, list);
    });
    return map;
  }, [members]);

  const roots = useMemo(
    () => members.filter((member) => !member.team?.manager || !memberIds.has(member.team.manager)),
    [members, memberIds]
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      [
        member.user_detail?.display_name,
        member.team?.role,
        member.team?.department,
        member.team?.phone,
        member.team?.discord_id,
        member.team?.location,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [members, search]);

  const renderCard = (member: TTeamMember) => (
    <div className="rounded-md border border-subtle bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={member.user_detail?.display_name}
            src={getFileURL(member.user_detail?.avatar_url)}
            size="base"
            shape="circle"
          />
          <div className="min-w-0">
            <p className="truncate text-body-sm-medium text-primary">{member.user_detail?.display_name}</p>
            <p className="text-11 text-tertiary uppercase">{member.team?.role || "—"}</p>
          </div>
        </div>
        {canEdit(member) && (
          <button
            type="button"
            className="rounded p-1 text-tertiary hover:text-primary"
            onClick={() => startEdit(member)}
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {renderContactChips(member)}
      {member.team?.notes && <p className="mt-2 text-body-xs-regular text-secondary">{member.team.notes}</p>}
    </div>
  );

  const renderOrgNode = (member: TTeamMember, visited: Set<string>): ReactNode => {
    if (visited.has(member.user_id)) return null;
    visited.add(member.user_id);
    const reports = membersByManager.get(member.user_id) ?? [];
    return (
      <div key={member.user_id} className="space-y-2">
        {renderCard(member)}
        {reports.length > 0 && (
          <div className="ml-5 space-y-2 border-l border-subtle pl-4">
            {reports.map((report) => renderOrgNode(report, visited))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHead title="Organigramma" />
      <div className="w-full p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
          <div className="flex items-center gap-1">
            {(
              [
                { key: "org", label: "Organigramma" },
                { key: "list", label: "Elenco" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-md px-3 py-1.5 text-body-sm-medium transition ${
                  tab === item.key ? "bg-surface-2 text-primary" : "text-tertiary hover:text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-tertiary" />
            <Input
              placeholder="Cerca..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-56 pl-7"
            />
          </div>
        </div>

        {editingId && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-2">
            <Input
              placeholder="Ruolo / mansione"
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value })}
            />
            <Input
              placeholder="Dipartimento"
              value={draft.department}
              onChange={(event) => setDraft({ ...draft, department: event.target.value })}
            />
            <select
              value={draft.manager}
              onChange={(event) => setDraft({ ...draft, manager: event.target.value })}
              className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular text-primary outline-none"
            >
              <option value="">Nessun responsabile</option>
              {members
                .filter((member) => member.user_id !== editingId)
                .map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user_detail?.display_name}
                  </option>
                ))}
            </select>
            <Input
              placeholder="Telefono"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
            <Input
              placeholder="Discord ID"
              value={draft.discord_id}
              onChange={(event) => setDraft({ ...draft, discord_id: event.target.value })}
            />
            <Input
              placeholder="Sede / luogo"
              value={draft.location}
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            />
            <Input
              type="date"
              value={draft.hire_date}
              onChange={(event) => setDraft({ ...draft, hire_date: event.target.value })}
            />
            <Input
              placeholder="LinkedIn / social"
              value={draft.linkedin}
              onChange={(event) => setDraft({ ...draft, linkedin: event.target.value })}
            />
            <TextArea
              placeholder="Note"
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              className="md:col-span-2"
              rows={2}
            />
            <div className="flex gap-2 md:col-span-2">
              <Button variant="primary" size="sm" onClick={save} loading={isSaving}>
                Salva
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                Annulla
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="py-4 text-body-sm-regular text-tertiary">Caricamento...</p>
        ) : hasError ? (
          <p className="py-4 text-body-sm-regular text-danger-primary">Impossibile caricare il team. Riprova.</p>
        ) : members.length === 0 ? (
          <p className="py-4 text-body-sm-regular text-tertiary">Nessun membro nel workspace.</p>
        ) : tab === "org" ? (
          <div className="mt-4 space-y-2">{roots.map((member) => renderOrgNode(member, new Set<string>()))}</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredMembers.map((member) => (
              <div key={member.user_id}>{renderCard(member)}</div>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

export default TeamPage;
