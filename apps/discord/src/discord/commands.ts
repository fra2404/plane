/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  MessageFlags,
  SlashCommandBuilder,
  type APIEmbed,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import { logger } from "@plane/logger";
import type { AppContext } from "@/context";
import type { CreateWorkItemInput } from "@/plane/client";
import type { PlaneWorkItem } from "@/types";

export type CommandDeps = AppContext;

const PRIORITY_CHOICES = [
  { name: "Urgent", value: "urgent" },
  { name: "High", value: "high" },
  { name: "Medium", value: "medium" },
  { name: "Low", value: "low" },
  { name: "None", value: "none" },
];

const issueCommand = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Manage Plane work items")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a work item")
      .addStringOption((option) =>
        option.setName("project").setDescription("Plane project").setRequired(true).setAutocomplete(true)
      )
      .addStringOption((option) => option.setName("title").setDescription("Title").setRequired(true))
      .addStringOption((option) => option.setName("description").setDescription("Description"))
      .addStringOption((option) =>
        option
          .setName("priority")
          .setDescription("Priority")
          .addChoices(...PRIORITY_CHOICES)
      )
      .addStringOption((option) => option.setName("assignee").setDescription("Assignee").setAutocomplete(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List work items in a project (defaults to yours)")
      .addStringOption((option) =>
        option.setName("project").setDescription("Plane project").setRequired(true).setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("assignee")
          .setDescription("Filter by assignee (default: you). Choose All to see everyone.")
          .setAutocomplete(true)
      )
      .addIntegerOption((option) =>
        option.setName("limit").setDescription("How many work items to show (1-25)").setMinValue(1).setMaxValue(25)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View a work item by identifier (e.g. PROJ-123)")
      .addStringOption((option) => option.setName("id").setDescription("Work item identifier").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("comment")
      .setDescription("Add a comment to a work item")
      .addStringOption((option) => option.setName("id").setDescription("Work item identifier").setRequired(true))
      .addStringOption((option) => option.setName("text").setDescription("Comment text").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("update")
      .setDescription("Update a work item's state")
      .addStringOption((option) => option.setName("id").setDescription("Work item identifier").setRequired(true))
      .addStringOption((option) =>
        option.setName("state").setDescription("Target state").setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("assign")
      .setDescription("Assign a work item to a project member")
      .addStringOption((option) => option.setName("id").setDescription("Work item identifier").setRequired(true))
      .addStringOption((option) =>
        option.setName("assignee").setDescription("Project member").setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unassign")
      .setDescription("Remove all assignees from a work item")
      .addStringOption((option) => option.setName("id").setDescription("Work item identifier").setRequired(true))
  );

const statusCommand = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show a work item summary for a project")
  .addStringOption((option) =>
    option.setName("project").setDescription("Plane project").setRequired(true).setAutocomplete(true)
  );

export const COMMANDS = [issueCommand, statusCommand];

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(value: string): string {
  return `<p>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</p>`;
}

function stateName(workItem: PlaneWorkItem): string {
  if (typeof workItem.state === "string") {
    return workItem.state;
  }
  return workItem.state?.name ?? "—";
}

function assigneeIds(workItem: PlaneWorkItem): string[] {
  const list = workItem.assignees;
  if (!Array.isArray(list)) return [];
  return list.map((assignee) => (typeof assignee === "string" ? assignee : assignee.id));
}

function assigneeNames(workItem: PlaneWorkItem): string | undefined {
  const list = workItem.assignees;
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const names = list.map((assignee) =>
    typeof assignee === "string" ? assignee : (assignee.display_name ?? assignee.email ?? assignee.id)
  );
  return names.join(", ");
}

/**
 * Map a Discord user to a Plane project member using `DISCORD_USER_MAPPING`.
 * Keys can be the Discord user id, username or tag; values can be the Plane
 * member UUID or the member email address.
 */
async function resolveDiscordMemberId(
  interaction: ChatInputCommandInteraction,
  projectId: string,
  deps: CommandDeps
): Promise<string | undefined> {
  const mapping = deps.userMapping ?? {};
  if (Object.keys(mapping).length === 0) return undefined;

  const lookup = new Map(Object.entries(mapping).map(([key, value]) => [key.toLowerCase(), value]));
  const candidates = [interaction.user.id, interaction.user.username, interaction.user.tag]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const mapped = candidates.map((key) => lookup.get(key)).find(Boolean);
  if (!mapped) return undefined;

  if (mapped.includes("@")) {
    try {
      const members = await deps.plane.listProjectMembers(projectId);
      const match = members.find((member) => (member.email ?? "").toLowerCase() === mapped.toLowerCase());
      return match?.id;
    } catch (error) {
      logger.warn(`DISCORD_COMMANDS: Unable to resolve member by email "${mapped}"`, error);
      return undefined;
    }
  }

  return mapped;
}

function workItemToEmbed(workItem: PlaneWorkItem, webBaseUrl: string, workspaceSlug: string): APIEmbed {
  const identifier = `#${workItem.sequence_id}`;
  const projectId = workItem.project ?? workItem.project_detail?.id;
  const fields: NonNullable<APIEmbed["fields"]> = [
    { name: "State", value: stateName(workItem), inline: true },
    { name: "Priority", value: workItem.priority ?? "none", inline: true },
  ];

  const names = assigneeNames(workItem);
  if (names) {
    fields.push({ name: "Assignees", value: names.slice(0, 1024), inline: true });
  }

  return {
    title: `${identifier} · ${workItem.name}`.slice(0, 256),
    url: projectId
      ? `${webBaseUrl.replace(/\/$/, "")}/${workspaceSlug}/projects/${projectId}/work-items/${workItem.id}`
      : undefined,
    description: workItem.description_html
      ? workItem.description_html.replace(/<[^>]+>/g, "").slice(0, 500)
      : undefined,
    color: 0x5e6ad2,
    fields,
    timestamp: new Date().toISOString(),
  };
}

async function resolveProjectIdFromKey(key: string, deps: CommandDeps): Promise<string | undefined> {
  try {
    const workItem = await deps.plane.getWorkItemByKey(key);
    return workItem.project ?? workItem.project_detail?.id;
  } catch (error) {
    logger.warn(`DISCORD_COMMANDS: Unable to resolve work item "${key}"`, error);
    return undefined;
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction, deps: CommandDeps): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = String(focused.value ?? "").toLowerCase();

  if (focused.name === "project") {
    const projects = await deps.plane.listProjects();
    const matches = projects
      .filter((project) => `${project.identifier} ${project.name}`.toLowerCase().includes(query))
      .slice(0, 25)
      .map((project) => ({ name: `${project.identifier} · ${project.name}`.slice(0, 100), value: project.id }));
    await interaction.respond(matches);
    return;
  }

  if (focused.name === "state") {
    const key = interaction.options.getString("id");
    const projectId = key ? await resolveProjectIdFromKey(key, deps) : undefined;
    if (!projectId) {
      await interaction.respond([]);
      return;
    }
    const states = await deps.plane.listStates(projectId);
    const matches = states
      .filter((state) => state.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map((state) => ({ name: state.name.slice(0, 100), value: state.id }));
    await interaction.respond(matches);
    return;
  }

  if (focused.name === "assignee") {
    const directProject = interaction.options.getString("project");
    const key = interaction.options.getString("id");
    const projectId = directProject ?? (key ? await resolveProjectIdFromKey(key, deps) : undefined);
    if (!projectId) {
      await interaction.respond([]);
      return;
    }
    const members = await deps.plane.listProjectMembers(projectId);
    const isListFilter = interaction.options.getSubcommand(false) === "list";
    const special: { name: string; value: string }[] = [];
    if (
      isListFilter &&
      (!query || "assigned to me".includes(query) || "me".includes(query) || "mine".includes(query))
    ) {
      special.push({ name: "Assigned to me", value: "__me__" });
    }
    if (isListFilter && (!query || "all".includes(query) || "everyone".includes(query) || "tutti".includes(query))) {
      special.push({ name: "All members", value: "__all__" });
    }
    const matches = members
      .filter((member) => `${member.display_name ?? ""} ${member.email ?? ""}`.toLowerCase().includes(query))
      .slice(0, Math.max(0, 25 - special.length))
      .map((member) => ({
        name: (member.email
          ? `${member.display_name ?? member.email} <${member.email}>`
          : (member.display_name ?? member.id)
        ).slice(0, 100),
        value: member.id,
      }));
    await interaction.respond([...special, ...matches]);
    return;
  }

  await interaction.respond([]);
}

async function handleIssueCreate(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const projectId = interaction.options.getString("project", true);
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description");
  const priority = interaction.options.getString("priority");
  const assigneeId = interaction.options.getString("assignee");

  await interaction.deferReply();

  const input: CreateWorkItemInput = { name: title };
  if (description) {
    input.description_html = textToHtml(description);
  }
  if (priority) {
    input.priority = priority;
  }
  if (assigneeId) {
    input.assignees = [assigneeId];
  }

  const workItem = await deps.plane.createWorkItem(projectId, input);
  await interaction.editReply({
    content: `Created work item #${workItem.sequence_id}`,
    embeds: [workItemToEmbed(workItem, deps.webBaseUrl, deps.workspaceSlug)],
  });
}

async function handleIssueList(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const projectId = interaction.options.getString("project", true);
  const limit = interaction.options.getInteger("limit") ?? 10;
  const assigneeOption = interaction.options.getString("assignee");

  await interaction.deferReply();

  const [project, workItems] = await Promise.all([
    deps.plane.getProject(projectId),
    deps.plane.listWorkItems(projectId, { perPage: Math.max(limit, 25) }),
  ]);

  let targetMemberId: string | undefined;
  let label = "all members";

  if (assigneeOption === "__all__") {
    label = "all members";
  } else if (assigneeOption && assigneeOption !== "__me__") {
    targetMemberId = assigneeOption;
    try {
      const members = await deps.plane.listProjectMembers(projectId);
      const member = members.find((candidate) => candidate.id === targetMemberId);
      label = member?.display_name ?? member?.email ?? "selected member";
    } catch {
      label = "selected member";
    }
  } else {
    const mapped = await resolveDiscordMemberId(interaction, projectId, deps);
    if (mapped) {
      targetMemberId = mapped;
      label = "you";
    } else {
      label = "all members (no Discord→Plane mapping for you)";
    }
  }

  const filtered = targetMemberId ? workItems.filter((item) => assigneeIds(item).includes(targetMemberId)) : workItems;

  const slice = filtered.slice(0, limit);
  const lines = slice.map(
    (item) => `• #${item.sequence_id} ${item.name} — ${stateName(item)} — ${assigneeNames(item) ?? "unassigned"}`
  );

  await interaction.editReply({
    content: `**${project.identifier} · work items (${label})**\n${lines.join("\n") || "No work items found."}`,
  });
}

async function handleIssueView(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const key = interaction.options.getString("id", true);
  await interaction.deferReply();
  const workItem = await deps.plane.getWorkItemByKey(key);
  await interaction.editReply({ embeds: [workItemToEmbed(workItem, deps.webBaseUrl, deps.workspaceSlug)] });
}

async function handleIssueComment(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const key = interaction.options.getString("id", true);
  const text = interaction.options.getString("text", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const workItem = await deps.plane.getWorkItemByKey(key);
  const projectId = workItem.project ?? workItem.project_detail?.id;
  if (!projectId) {
    await interaction.editReply({ content: `Could not resolve the project for ${key}.` });
    return;
  }

  await deps.plane.createComment(projectId, workItem.id, textToHtml(text));
  await interaction.editReply({ content: `Comment added to #${workItem.sequence_id}.` });
}

async function handleIssueUpdate(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const key = interaction.options.getString("id", true);
  const state = interaction.options.getString("state", true);

  await interaction.deferReply();

  const workItem = await deps.plane.getWorkItemByKey(key);
  const projectId = workItem.project ?? workItem.project_detail?.id;
  if (!projectId) {
    await interaction.editReply({ content: `Could not resolve the project for ${key}.` });
    return;
  }

  const updated = await deps.plane.updateWorkItem(projectId, workItem.id, { state });
  await interaction.editReply({
    content: `Updated #${updated.sequence_id} → ${stateName(updated)}`,
    embeds: [workItemToEmbed(updated, deps.webBaseUrl, deps.workspaceSlug)],
  });
}

async function handleIssueAssign(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const key = interaction.options.getString("id", true);
  const assigneeId = interaction.options.getString("assignee", true);

  await interaction.deferReply();

  const workItem = await deps.plane.getWorkItemByKey(key);
  const projectId = workItem.project ?? workItem.project_detail?.id;
  if (!projectId) {
    await interaction.editReply({ content: `Could not resolve the project for ${key}.` });
    return;
  }

  const updated = await deps.plane.updateWorkItem(projectId, workItem.id, { assignees: [assigneeId] });
  await interaction.editReply({
    content: `Assigned a member to #${updated.sequence_id}.`,
    embeds: [workItemToEmbed(updated, deps.webBaseUrl, deps.workspaceSlug)],
  });
}

async function handleIssueUnassign(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const key = interaction.options.getString("id", true);

  await interaction.deferReply();

  const workItem = await deps.plane.getWorkItemByKey(key);
  const projectId = workItem.project ?? workItem.project_detail?.id;
  if (!projectId) {
    await interaction.editReply({ content: `Could not resolve the project for ${key}.` });
    return;
  }

  const updated = await deps.plane.updateWorkItem(projectId, workItem.id, { assignees: [] });
  await interaction.editReply({
    content: `Removed all assignees from #${updated.sequence_id}.`,
    embeds: [workItemToEmbed(updated, deps.webBaseUrl, deps.workspaceSlug)],
  });
}

async function handleIssue(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  switch (interaction.options.getSubcommand()) {
    case "create":
      return handleIssueCreate(interaction, deps);
    case "list":
      return handleIssueList(interaction, deps);
    case "view":
      return handleIssueView(interaction, deps);
    case "comment":
      return handleIssueComment(interaction, deps);
    case "update":
      return handleIssueUpdate(interaction, deps);
    case "assign":
      return handleIssueAssign(interaction, deps);
    case "unassign":
      return handleIssueUnassign(interaction, deps);
    default:
      return;
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction, deps: CommandDeps): Promise<void> {
  const projectId = interaction.options.getString("project", true);
  await interaction.deferReply();

  const [project, states, workItems] = await Promise.all([
    deps.plane.getProject(projectId),
    deps.plane.listStates(projectId),
    deps.plane.listWorkItems(projectId, { perPage: 100 }),
  ]);

  const counts = new Map<string, number>(states.map((state) => [state.id, 0]));
  for (const item of workItems) {
    const stateId = typeof item.state === "string" ? item.state : item.state?.id;
    if (stateId && counts.has(stateId)) {
      counts.set(stateId, (counts.get(stateId) ?? 0) + 1);
    }
  }

  const lines = states.map((state) => `• ${state.name}: ${counts.get(state.id) ?? 0}`);
  await interaction.editReply({
    content: `**${project.identifier} · status** (latest ${workItems.length} work items)\n${lines.join("\n")}`,
  });
}

export async function handleInteraction(interaction: Interaction, deps: CommandDeps): Promise<void> {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, deps);
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    switch (interaction.commandName) {
      case "issue":
        await handleIssue(interaction, deps);
        return;
      case "status":
        await handleStatus(interaction, deps);
        return;
      default:
        return;
    }
  } catch (error) {
    logger.error(`DISCORD_COMMANDS: Command "${interaction.commandName}" failed`, error);
    const content = "Something went wrong while talking to Plane. Please try again.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  }
}
