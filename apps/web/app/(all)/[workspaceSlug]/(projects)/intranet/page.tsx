/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type {
  TIntranetClient,
  TIntranetClientStatus,
  TIntranetContact,
  TIntranetDevice,
  TIntranetDeviceType,
  TIntranetLink,
  TIntranetNews,
} from "@plane/types";
import { Input, TextArea } from "@plane/ui";
// components
import { PageHead } from "@/components/core/page-title";
// services
import { IntranetService } from "@/services/intranet.service";
// hooks
import { useUserPermissions } from "@/hooks/store/user";

const intranetService = new IntranetService();

type TTab = "ip" | "links" | "news" | "clients" | "contacts";

const DEVICE_TYPES: TIntranetDeviceType[] = ["server", "vm", "container", "dispositivo", "altro"];

const emptyDevice: Partial<TIntranetDevice> = {
  name: "",
  type: "dispositivo",
  local_ip: "",
  vpn_ip: "",
  description: "",
  owner: "",
};

const emptyLink: Partial<TIntranetLink> = { label: "", url: "", category: "", description: "", sort_order: 65535 };
const emptyNews: Partial<TIntranetNews> = { title: "", description: "", tags: [] };
const emptyClient: Partial<TIntranetClient> = {
  name: "",
  vat: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  notes: "",
  status: "active",
};
const emptyContact: Partial<TIntranetContact> = {
  client: null,
  name: "",
  role: "",
  email: "",
  phone: "",
  mobile: "",
  notes: "",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

const IntranetPage = observer(function IntranetPage() {
  const { workspaceSlug } = useParams();
  const { allowPermissions } = useUserPermissions();

  const [tab, setTab] = useState<TTab>("ip");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [devices, setDevices] = useState<TIntranetDevice[]>([]);
  const [links, setLinks] = useState<TIntranetLink[]>([]);
  const [news, setNews] = useState<TIntranetNews[]>([]);
  const [clients, setClients] = useState<TIntranetClient[]>([]);
  const [contacts, setContacts] = useState<TIntranetContact[]>([]);
  const [search, setSearch] = useState("");

  const [deviceForm, setDeviceForm] = useState<Partial<TIntranetDevice> | null>(null);
  const [linkForm, setLinkForm] = useState<Partial<TIntranetLink> | null>(null);
  const [newsForm, setNewsForm] = useState<Partial<TIntranetNews> | null>(null);
  const [clientForm, setClientForm] = useState<Partial<TIntranetClient> | null>(null);
  const [contactForm, setContactForm] = useState<Partial<TIntranetContact> | null>(null);
  const [tagsInput, setTagsInput] = useState("");

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const canEditDevices = canAdmin;

  const load = async () => {
    if (!workspaceSlug) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const [devicesData, linksData, newsData, clientsData, contactsData] = await Promise.all([
        intranetService.listDevices(workspaceSlug),
        intranetService.listLinks(workspaceSlug),
        intranetService.listNews(workspaceSlug),
        intranetService.listClients(workspaceSlug),
        intranetService.listContacts(workspaceSlug),
      ]);
      setDevices(devicesData ?? []);
      setLinks((linksData ?? []).filter((link) => !link.project));
      setNews(newsData ?? []);
      setClients(clientsData ?? []);
      setContacts(contactsData ?? []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug]);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      [device.name, device.local_ip, device.vpn_ip, device.owner, device.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [devices, search]);

  const notifyError = () =>
    setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Operation failed. Please try again." });

  const saveDevice = async () => {
    if (!workspaceSlug || !deviceForm?.name?.trim()) return;
    try {
      if (deviceForm.id) {
        const updated = await intranetService.updateDevice(workspaceSlug, deviceForm.id, deviceForm);
        setDevices((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await intranetService.createDevice(workspaceSlug, deviceForm);
        setDevices((prev) => [...prev, created]);
      }
      setDeviceForm(null);
    } catch {
      notifyError();
    }
  };

  const removeDevice = async (device: TIntranetDevice) => {
    if (!workspaceSlug) return;
    try {
      await intranetService.deleteDevice(workspaceSlug, device.id);
      setDevices((prev) => prev.filter((item) => item.id !== device.id));
    } catch {
      notifyError();
    }
  };

  const saveLink = async () => {
    if (!workspaceSlug || !linkForm?.label?.trim() || !linkForm?.url?.trim()) return;
    try {
      if (linkForm.id) {
        const updated = await intranetService.updateLink(workspaceSlug, linkForm.id, linkForm);
        setLinks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await intranetService.createLink(workspaceSlug, linkForm);
        setLinks((prev) => [...prev, created]);
      }
      setLinkForm(null);
    } catch {
      notifyError();
    }
  };

  const removeLink = async (link: TIntranetLink) => {
    if (!workspaceSlug) return;
    try {
      await intranetService.deleteLink(workspaceSlug, link.id);
      setLinks((prev) => prev.filter((item) => item.id !== link.id));
    } catch {
      notifyError();
    }
  };

  const saveNews = async () => {
    if (!workspaceSlug || !newsForm?.title?.trim()) return;
    const payload = {
      ...newsForm,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    try {
      if (newsForm.id) {
        const updated = await intranetService.updateNews(workspaceSlug, newsForm.id, payload);
        setNews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await intranetService.createNews(workspaceSlug, payload);
        setNews((prev) => [created, ...prev]);
      }
      setNewsForm(null);
      setTagsInput("");
    } catch {
      notifyError();
    }
  };

  const removeNews = async (item: TIntranetNews) => {
    if (!workspaceSlug) return;
    try {
      await intranetService.deleteNews(workspaceSlug, item.id);
      setNews((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch {
      notifyError();
    }
  };

  const saveClient = async () => {
    if (!workspaceSlug || !clientForm?.name?.trim()) return;
    try {
      if (clientForm.id) {
        const updated = await intranetService.updateClient(workspaceSlug, clientForm.id, clientForm);
        setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await intranetService.createClient(workspaceSlug, clientForm);
        setClients((prev) => [...prev, created]);
      }
      setClientForm(null);
    } catch {
      notifyError();
    }
  };

  const removeClient = async (item: TIntranetClient) => {
    if (!workspaceSlug) return;
    try {
      await intranetService.deleteClient(workspaceSlug, item.id);
      setClients((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch {
      notifyError();
    }
  };

  const saveContact = async () => {
    if (!workspaceSlug || !contactForm?.name?.trim()) return;
    try {
      if (contactForm.id) {
        const updated = await intranetService.updateContact(workspaceSlug, contactForm.id, contactForm);
        setContacts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await intranetService.createContact(workspaceSlug, contactForm);
        setContacts((prev) => [...prev, created]);
      }
      setContactForm(null);
    } catch {
      notifyError();
    }
  };

  const removeContact = async (item: TIntranetContact) => {
    if (!workspaceSlug) return;
    try {
      await intranetService.deleteContact(workspaceSlug, item.id);
      setContacts((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch {
      notifyError();
    }
  };

  const clientName = (clientId: string | null) => clients.find((client) => client.id === clientId)?.name ?? "";

  const tabs: { key: TTab; label: string }[] = [
    { key: "ip", label: "IP e Dispositivi" },
    { key: "links", label: "Link utili" },
    { key: "news", label: "News" },
    { key: "clients", label: "Clienti" },
    { key: "contacts", label: "Contatti" },
  ];

  return (
    <>
      <PageHead title="Intranet" />
      <div className="flex h-full w-full flex-col overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
          <div className="flex items-center gap-1">
            {tabs.map((item) => (
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

          {tab === "ip" && canEditDevices && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDeviceForm({ ...emptyDevice });
              }}
            >
              <Plus className="mr-1 size-3.5" /> Aggiungi IP
            </Button>
          )}
          {tab === "links" && canAdmin && (
            <Button variant="primary" size="sm" onClick={() => setLinkForm({ ...emptyLink })}>
              <Plus className="mr-1 size-3.5" /> Aggiungi link
            </Button>
          )}
          {tab === "news" && canAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewsForm({ ...emptyNews });
                setTagsInput("");
              }}
            >
              <Plus className="mr-1 size-3.5" /> Aggiungi news
            </Button>
          )}
          {tab === "clients" && canAdmin && (
            <Button variant="primary" size="sm" onClick={() => setClientForm({ ...emptyClient })}>
              <Plus className="mr-1 size-3.5" /> Aggiungi cliente
            </Button>
          )}
          {tab === "contacts" && canAdmin && (
            <Button variant="primary" size="sm" onClick={() => setContactForm({ ...emptyContact })}>
              <Plus className="mr-1 size-3.5" /> Aggiungi contatto
            </Button>
          )}
        </div>

        {isLoading && <p className="py-4 text-body-sm-regular text-tertiary">Loading...</p>}
        {!isLoading && hasError && (
          <p className="py-4 text-body-sm-regular text-danger-primary">Something went wrong. Please try again.</p>
        )}

        {!isLoading && !hasError && tab === "ip" && (
          <div className="space-y-4 pt-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca per nome, IP, owner..."
              className="max-w-md"
            />

            {deviceForm && canEditDevices && (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-3">
                <Input
                  placeholder="Nome *"
                  value={deviceForm.name ?? ""}
                  onChange={(event) => setDeviceForm({ ...deviceForm, name: event.target.value })}
                />
                <select
                  className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular"
                  value={deviceForm.type ?? "dispositivo"}
                  onChange={(event) =>
                    setDeviceForm({ ...deviceForm, type: event.target.value as TIntranetDeviceType })
                  }
                >
                  {DEVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Owner"
                  value={deviceForm.owner ?? ""}
                  onChange={(event) => setDeviceForm({ ...deviceForm, owner: event.target.value })}
                />
                <Input
                  placeholder="IP locale"
                  value={deviceForm.local_ip ?? ""}
                  onChange={(event) => setDeviceForm({ ...deviceForm, local_ip: event.target.value })}
                />
                <Input
                  placeholder="IP VPN"
                  value={deviceForm.vpn_ip ?? ""}
                  onChange={(event) => setDeviceForm({ ...deviceForm, vpn_ip: event.target.value })}
                />
                <Input
                  placeholder="Descrizione"
                  value={deviceForm.description ?? ""}
                  onChange={(event) => setDeviceForm({ ...deviceForm, description: event.target.value })}
                />
                <div className="flex gap-2 md:col-span-3">
                  <Button variant="primary" size="sm" onClick={saveDevice}>
                    Salva
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setDeviceForm(null)}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {filteredDevices.length === 0 ? (
              <p className="py-2 text-body-sm-regular text-tertiary">Nessun dispositivo.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-subtle">
                <table className="w-full table-auto text-left text-body-sm-regular">
                  <thead className="bg-surface-2 text-tertiary">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nome</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">IP locale</th>
                      <th className="px-3 py-2 font-medium">IP VPN</th>
                      <th className="px-3 py-2 font-medium">Owner</th>
                      <th className="px-3 py-2 font-medium">Descrizione</th>
                      {canEditDevices && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="border-t border-subtle">
                        <td className="px-3 py-2 text-primary">{device.name}</td>
                        <td className="px-3 py-2 text-secondary">{device.type}</td>
                        <td className="font-mono px-3 py-2 text-secondary">{device.local_ip}</td>
                        <td className="font-mono px-3 py-2 text-secondary">{device.vpn_ip}</td>
                        <td className="px-3 py-2 text-secondary">{device.owner}</td>
                        <td className="px-3 py-2 text-tertiary">{device.description}</td>
                        {canEditDevices && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="rounded p-1 text-tertiary hover:text-primary"
                                onClick={() => setDeviceForm({ ...device })}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-tertiary hover:text-danger-primary"
                                onClick={() => void removeDevice(device)}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isLoading && !hasError && tab === "links" && (
          <div className="space-y-4 pt-4">
            {linkForm && canAdmin && (
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
                  <Button variant="primary" size="sm" onClick={saveLink}>
                    Salva
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setLinkForm(null)}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {links.length === 0 ? (
              <p className="py-2 text-body-sm-regular text-tertiary">Nessun link configurato.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {links.map((link) => (
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
                        {link.label} <ExternalLink className="size-3.5" />
                      </a>
                      {link.category && <p className="text-11 text-tertiary uppercase">{link.category}</p>}
                      {link.description && (
                        <p className="mt-1 text-body-xs-regular text-secondary">{link.description}</p>
                      )}
                    </div>
                    {canAdmin && (
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isLoading && !hasError && tab === "news" && (
          <div className="space-y-4 pt-4">
            {newsForm && canAdmin && (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-subtle p-4">
                <Input
                  placeholder="Titolo *"
                  value={newsForm.title ?? ""}
                  onChange={(event) => setNewsForm({ ...newsForm, title: event.target.value })}
                />
                <Input
                  placeholder="Tag (separati da virgola)"
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                />
                <TextArea
                  placeholder="Testo della news"
                  value={newsForm.description ?? ""}
                  onChange={(event) => setNewsForm({ ...newsForm, description: event.target.value })}
                  className="min-h-24"
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={saveNews}>
                    Salva
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setNewsForm(null);
                      setTagsInput("");
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {news.length === 0 ? (
              <p className="py-2 text-body-sm-regular text-tertiary">Nessuna news.</p>
            ) : (
              <div className="space-y-3">
                {news.map((item) => (
                  <div key={item.id} className="rounded-md border border-subtle p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-body-md-medium text-primary">{item.title}</h4>
                        <p className="text-body-xs-regular text-tertiary">
                          {item.author_detail?.display_name ?? ""} · {formatDate(item.created_at)}
                        </p>
                      </div>
                      {canAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-tertiary hover:text-primary"
                            onClick={() => {
                              setNewsForm({ ...item });
                              setTagsInput((item.tags ?? []).join(", "));
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-tertiary hover:text-danger-primary"
                            onClick={() => void removeNews(item)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span key={tag} className="rounded bg-surface-2 px-2 py-0.5 text-11 text-tertiary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.description && (
                      <p className="mt-2 text-body-sm-regular whitespace-pre-wrap text-secondary">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isLoading && !hasError && tab === "clients" && (
          <div className="space-y-4 pt-4">
            {clientForm && canAdmin && (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-3">
                <Input
                  placeholder="Ragione sociale *"
                  value={clientForm.name ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
                />
                <select
                  className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular"
                  value={clientForm.status ?? "active"}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, status: event.target.value as TIntranetClientStatus })
                  }
                >
                  <option value="active">Attivo</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inattivo</option>
                </select>
                <Input
                  placeholder="P.IVA / VAT"
                  value={clientForm.vat ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, vat: event.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={clientForm.email ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })}
                />
                <Input
                  placeholder="Telefono"
                  value={clientForm.phone ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })}
                />
                <Input
                  placeholder="Sito web"
                  value={clientForm.website ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, website: event.target.value })}
                />
                <Input
                  placeholder="Indirizzo"
                  value={clientForm.address ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, address: event.target.value })}
                />
                <Input
                  placeholder="Note"
                  value={clientForm.notes ?? ""}
                  onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })}
                />
                <div className="flex gap-2 md:col-span-3">
                  <Button variant="primary" size="sm" onClick={saveClient}>
                    Salva
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setClientForm(null)}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {clients.length === 0 ? (
              <p className="py-2 text-body-sm-regular text-tertiary">Nessun cliente.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-subtle">
                <table className="w-full table-auto text-left text-body-sm-regular">
                  <thead className="bg-surface-2 text-tertiary">
                    <tr>
                      <th className="px-3 py-2 font-medium">Ragione sociale</th>
                      <th className="px-3 py-2 font-medium">P.IVA</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Telefono</th>
                      <th className="px-3 py-2 font-medium">Stato</th>
                      {canAdmin && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-t border-subtle">
                        <td className="px-3 py-2 text-primary">
                          <Link
                            href={`/${workspaceSlug}/intranet/clients/${client.id}`}
                            className="hover:text-accent-primary hover:underline"
                          >
                            {client.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-secondary">{client.vat}</td>
                        <td className="px-3 py-2 text-secondary">{client.email}</td>
                        <td className="px-3 py-2 text-secondary">{client.phone}</td>
                        <td className="px-3 py-2 text-secondary">{client.status}</td>
                        {canAdmin && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="rounded p-1 text-tertiary hover:text-primary"
                                onClick={() => setClientForm({ ...client })}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-tertiary hover:text-danger-primary"
                                onClick={() => void removeClient(client)}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isLoading && !hasError && tab === "contacts" && (
          <div className="space-y-4 pt-4">
            {contactForm && canAdmin && (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-subtle p-4 md:grid-cols-3">
                <select
                  className="rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-body-sm-regular"
                  value={contactForm.client ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, client: event.target.value || null })}
                >
                  <option value="">Nessun cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Nome *"
                  value={contactForm.name ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
                />
                <Input
                  placeholder="Ruolo"
                  value={contactForm.role ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={contactForm.email ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                />
                <Input
                  placeholder="Telefono"
                  value={contactForm.phone ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })}
                />
                <Input
                  placeholder="Cellulare"
                  value={contactForm.mobile ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, mobile: event.target.value })}
                />
                <Input
                  placeholder="Note"
                  value={contactForm.notes ?? ""}
                  onChange={(event) => setContactForm({ ...contactForm, notes: event.target.value })}
                />
                <div className="flex gap-2 md:col-span-3">
                  <Button variant="primary" size="sm" onClick={saveContact}>
                    Salva
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setContactForm(null)}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {contacts.length === 0 ? (
              <p className="py-2 text-body-sm-regular text-tertiary">Nessun contatto.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-subtle">
                <table className="w-full table-auto text-left text-body-sm-regular">
                  <thead className="bg-surface-2 text-tertiary">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nome</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Ruolo</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Telefono</th>
                      {canAdmin && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-t border-subtle">
                        <td className="px-3 py-2 text-primary">{contact.name}</td>
                        <td className="px-3 py-2 text-secondary">{clientName(contact.client)}</td>
                        <td className="px-3 py-2 text-secondary">{contact.role}</td>
                        <td className="px-3 py-2 text-secondary">{contact.email}</td>
                        <td className="px-3 py-2 text-secondary">{contact.phone || contact.mobile}</td>
                        {canAdmin && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="rounded p-1 text-tertiary hover:text-primary"
                                onClick={() => setContactForm({ ...contact })}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-tertiary hover:text-danger-primary"
                                onClick={() => void removeContact(contact)}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default IntranetPage;
