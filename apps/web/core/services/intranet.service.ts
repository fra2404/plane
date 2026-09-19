/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TClientNote,
  TIntranetClient,
  TIntranetClientDetail,
  TIntranetContact,
  TIntranetDevice,
  TIntranetLink,
  TIntranetNews,
  TIntranetOpportunity,
  TIntranetQuote,
  TCrmsummary,
} from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class IntranetService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // Devices / IPs
  async listDevices(workspaceSlug: string): Promise<TIntranetDevice[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/devices/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createDevice(workspaceSlug: string, data: Partial<TIntranetDevice>): Promise<TIntranetDevice> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/devices/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateDevice(
    workspaceSlug: string,
    deviceId: string,
    data: Partial<TIntranetDevice>
  ): Promise<TIntranetDevice> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/devices/${deviceId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteDevice(workspaceSlug: string, deviceId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/devices/${deviceId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // Useful links
  async listLinks(workspaceSlug: string): Promise<TIntranetLink[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/links/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createLink(workspaceSlug: string, data: Partial<TIntranetLink>): Promise<TIntranetLink> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/links/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateLink(workspaceSlug: string, linkId: string, data: Partial<TIntranetLink>): Promise<TIntranetLink> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/links/${linkId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteLink(workspaceSlug: string, linkId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/links/${linkId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // Project-scoped useful links
  async listProjectLinks(workspaceSlug: string, projectId: string): Promise<TIntranetLink[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/useful-links/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createProjectLink(
    workspaceSlug: string,
    projectId: string,
    data: Partial<TIntranetLink>
  ): Promise<TIntranetLink> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/useful-links/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateProjectLink(
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: Partial<TIntranetLink>
  ): Promise<TIntranetLink> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/useful-links/${linkId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteProjectLink(workspaceSlug: string, projectId: string, linkId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/useful-links/${linkId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // News
  async listNews(workspaceSlug: string): Promise<TIntranetNews[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/news/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createNews(workspaceSlug: string, data: Partial<TIntranetNews>): Promise<TIntranetNews> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/news/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateNews(workspaceSlug: string, newsId: string, data: Partial<TIntranetNews>): Promise<TIntranetNews> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/news/${newsId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteNews(workspaceSlug: string, newsId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/news/${newsId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // Clients
  async listClients(workspaceSlug: string): Promise<TIntranetClient[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/clients/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createClient(workspaceSlug: string, data: Partial<TIntranetClient>): Promise<TIntranetClient> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/clients/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateClient(
    workspaceSlug: string,
    clientId: string,
    data: Partial<TIntranetClient>
  ): Promise<TIntranetClient> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getClient(workspaceSlug: string, clientId: string): Promise<TIntranetClientDetail> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listClientNotes(workspaceSlug: string, clientId: string): Promise<TClientNote[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/notes/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createClientNote(workspaceSlug: string, clientId: string, data: Partial<TClientNote>): Promise<TClientNote> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/notes/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listOpportunities(workspaceSlug: string): Promise<TIntranetOpportunity[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/opportunities/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createOpportunity(workspaceSlug: string, data: Partial<TIntranetOpportunity>): Promise<TIntranetOpportunity> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/opportunities/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateOpportunity(
    workspaceSlug: string,
    opportunityId: string,
    data: Partial<TIntranetOpportunity>
  ): Promise<TIntranetOpportunity> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/opportunities/${opportunityId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listQuotes(workspaceSlug: string, clientId?: string): Promise<TIntranetQuote[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/quotes/`, {
      params: clientId ? { client_id: clientId } : undefined,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createQuote(workspaceSlug: string, data: Partial<TIntranetQuote>): Promise<TIntranetQuote> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/quotes/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateQuote(workspaceSlug: string, quoteId: string, data: Partial<TIntranetQuote>): Promise<TIntranetQuote> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/quotes/${quoteId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteQuote(workspaceSlug: string, quoteId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/quotes/${quoteId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async fetchCrmSummary(workspaceSlug: string): Promise<TCrmsummary> {
    return this.get(`/api/workspaces/${workspaceSlug}/crm-summary/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteOpportunity(workspaceSlug: string, opportunityId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/opportunities/${opportunityId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateClientNote(
    workspaceSlug: string,
    clientId: string,
    noteId: string,
    data: Partial<TClientNote>
  ): Promise<TClientNote> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/notes/${noteId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteClientNote(workspaceSlug: string, clientId: string, noteId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/notes/${noteId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteClient(workspaceSlug: string, clientId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/clients/${clientId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // Contacts
  async listContacts(workspaceSlug: string): Promise<TIntranetContact[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/intranet/contacts/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createContact(workspaceSlug: string, data: Partial<TIntranetContact>): Promise<TIntranetContact> {
    return this.post(`/api/workspaces/${workspaceSlug}/intranet/contacts/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateContact(
    workspaceSlug: string,
    contactId: string,
    data: Partial<TIntranetContact>
  ): Promise<TIntranetContact> {
    return this.patch(`/api/workspaces/${workspaceSlug}/intranet/contacts/${contactId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteContact(workspaceSlug: string, contactId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/intranet/contacts/${contactId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
