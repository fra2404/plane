/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIntranetLink } from "@plane/types";
import { Input } from "@plane/ui";
// components
import { PageHead } from "@/components/core/page-title";
// services
import { IntranetService } from "@/services/intranet.service";

const intranetService = new IntranetService();

const emptyLink: Partial<TIntranetLink> = { label: "", url: "", category: "", description: "", sort_order: 65535 };

const ProjectUsefulLinksPage = observer(function ProjectUsefulLinksPage() {
  const { workspaceSlug, projectId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [links, setLinks] = useState<TIntranetLink[]>([]);
  const [workspaceLinks, setWorkspaceLinks] = useState<TIntranetLink[]>([]);
  const [linkForm, setLinkForm] = useState<Partial<TIntranetLink> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const wsSlug = workspaceSlug?.toString();
  const projId = projectId?.toString();

  const load = async () => {
    if (!wsSlug || !projId) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const [projectLinks, allWorkspaceLinks] = await Promise.all([
        intranetService.listProjectLinks(wsSlug, projId),
        intranetService.listLinks(wsSlug),
      ]);
      setLinks(projectLinks ?? []);
      setWorkspaceLinks((allWorkspaceLinks ?? []).filter((link) => !link.project));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsSlug, projId]);

  const sortedLinks = useMemo(() => {
    // oxlint-disable-next-line unicorn/no-array-sort
    return [...links].sort(
      (a, b) => (a.sort_order ?? 65535) - (b.sort_order ?? 65535) || a.label.localeCompare(b.label)
    );
  }, [links]);

  const notifyError = () =>
    setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Operation failed. Please try again." });

  const saveLink = async () => {
    if (!wsSlug || !projId || !linkForm?.label?.trim() || !linkForm?.url?.trim()) return;
    setIsSaving(true);
    try {
      if (linkForm.id) {
        const updated = await intranetService.updateProjectLink(wsSlug, projId, linkForm.id, linkForm);
        setLinks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await intranetService.createProjectLink(wsSlug, projId, linkForm);
        setLinks((prev) => [...prev, created]);
      }
      setLinkForm(null);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Saved", message: "Link saved successfully." });
    } catch {
      notifyError();
    } finally {
      setIsSaving(false);
    }
  };

  const removeLink = async (link: TIntranetLink) => {
    if (!wsSlug || !projId) return;
    try {
      await intranetService.deleteProjectLink(wsSlug, projId, link.id);
      setLinks((prev) => prev.filter((item) => item.id !== link.id));
    } catch {
      notifyError();
    }
  };

  return (
    <>
      <PageHead title="Link utili" />
      <div className="h-full w-full overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-h4-medium text-primary">Link utili</h2>
              <p className="mt-1 text-body-sm-regular text-tertiary">
                Link e risorse utili per questo progetto. Tutti i membri del progetto possono gestirli.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setLinkForm({ ...emptyLink })}>
              <span className="flex items-center gap-1.5">
                <Plus className="size-4" />
                Aggiungi link
              </span>
            </Button>
          </div>

          {linkForm && (
            <div className="grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-2">
              <Input
                placeholder="Etichetta *"
                value={linkForm.label ?? ""}
                onChange={(event) => setLinkForm({ ...linkForm, label: event.target.value })}
              />
              <Input
                placeholder="URL * (https://...)"
                value={linkForm.url ?? ""}
                onChange={(event) => setLinkForm({ ...linkForm, url: event.target.value })}
              />
              <Input
                placeholder="Categoria"
                value={linkForm.category ?? ""}
                onChange={(event) => setLinkForm({ ...linkForm, category: event.target.value })}
              />
              <Input
                placeholder="Descrizione"
                value={linkForm.description ?? ""}
                onChange={(event) => setLinkForm({ ...linkForm, description: event.target.value })}
              />
              <div className="flex gap-2 md:col-span-2">
                <Button variant="primary" size="sm" onClick={saveLink} loading={isSaving}>
                  Salva
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setLinkForm(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="py-2 text-body-sm-regular text-tertiary">Caricamento...</p>
          ) : hasError ? (
            <p className="py-2 text-body-sm-regular text-danger-primary">Impossibile caricare i link. Riprova.</p>
          ) : (
            <div className="space-y-6">
              <div>
                {sortedLinks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-subtle p-6 text-center text-body-sm-regular text-tertiary">
                    Nessun link utile per questo progetto. Aggiungine uno con il pulsante in alto.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {sortedLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-subtle p-3"
                      >
                        <div className="min-w-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-body-sm-medium text-primary hover:underline"
                          >
                            <span className="truncate">{link.label}</span>
                            <ExternalLink className="size-3.5 flex-shrink-0" />
                          </a>
                          {link.category && <p className="mt-0.5 text-11 text-tertiary uppercase">{link.category}</p>}
                          {link.description && (
                            <p className="mt-1 text-body-xs-regular text-secondary">{link.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-tertiary hover:text-primary"
                            onClick={() => setLinkForm({ ...link })}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-tertiary hover:text-danger-primary"
                            onClick={() => void removeLink(link)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {workspaceLinks.length > 0 && (
                <div>
                  <h3 className="mb-3 text-body-sm-medium text-secondary">Link generali del workspace</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {workspaceLinks.map((link) => (
                      <div key={link.id} className="rounded-md border border-subtle p-3">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-body-sm-medium text-primary hover:underline"
                        >
                          <span className="truncate">{link.label}</span>
                          <ExternalLink className="size-3.5 flex-shrink-0" />
                        </a>
                        {link.category && <p className="mt-0.5 text-11 text-tertiary uppercase">{link.category}</p>}
                        {link.description && (
                          <p className="mt-1 text-body-xs-regular text-secondary">{link.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
});

export default ProjectUsefulLinksPage;
