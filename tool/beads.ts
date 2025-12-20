/**
 * Beads Tools
 *
 * OpenCode tool definitions for beads (bd) task management.
 * These tools allow the AI agent to interact with beads directly.
 */

import { $ } from "bun";

/**
 * Check if beads is available
 */
async function ensureBeads(): Promise<void> {
  try {
    await $`bd --version`.quiet();
  } catch {
    throw new Error("Beads (bd) is not installed. Run 'bd onboard' to set up.");
  }
}

/**
 * Tool: List available tasks
 */
export const bd_ready = {
  name: "bd_ready",
  description: "Show available beads tasks ready to be worked on",
  schema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of tasks to show",
        default: 10,
      },
    },
  },
  async execute({ limit = 10 }: { limit?: number }): Promise<string> {
    await ensureBeads();
    const result = await $`bd ready --limit ${limit}`.text();
    return result || "No tasks available. Create one with 'bd create <title>'";
  },
};

/**
 * Tool: Show task details
 */
export const bd_show = {
  name: "bd_show",
  description: "Show details of a specific beads task",
  schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Task ID (e.g., bd-abc123)",
      },
    },
    required: ["id"],
  },
  async execute({ id }: { id: string }): Promise<string> {
    await ensureBeads();
    const result = await $`bd show ${id}`.text();
    return result;
  },
};

/**
 * Tool: Claim a task
 */
export const bd_claim = {
  name: "bd_claim",
  description: "Claim a beads task and mark it as in_progress",
  schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Task ID to claim (e.g., bd-abc123)",
      },
    },
    required: ["id"],
  },
  async execute({ id }: { id: string }): Promise<string> {
    await ensureBeads();
    await $`bd update ${id} --status in_progress`.quiet();
    return `Claimed ${id} - now in_progress`;
  },
};

/**
 * Tool: Mark task as done
 */
export const bd_done = {
  name: "bd_done",
  description: "Mark a beads task as completed",
  schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Task ID to complete (e.g., bd-abc123)",
      },
    },
    required: ["id"],
  },
  async execute({ id }: { id: string }): Promise<string> {
    await ensureBeads();
    await $`bd done ${id}`.quiet();
    return `Completed ${id}`;
  },
};

/**
 * Tool: Create a new task
 */
export const bd_create = {
  name: "bd_create",
  description: "Create a new beads task",
  schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Task title",
      },
      body: {
        type: "string",
        description: "Optional task description/body",
      },
      priority: {
        type: "number",
        description: "Priority (1-5, higher = more important)",
        default: 3,
      },
    },
    required: ["title"],
  },
  async execute({
    title,
    body,
    priority = 3,
  }: {
    title: string;
    body?: string;
    priority?: number;
  }): Promise<string> {
    await ensureBeads();

    const args = [title];
    if (body) args.push("--body", body);
    if (priority !== 3) args.push("--priority", String(priority));

    const result = await $`bd create ${args}`.text();
    return result;
  },
};

/**
 * Tool: List all tasks
 */
export const bd_list = {
  name: "bd_list",
  description: "List all beads tasks with optional status filter",
  schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["all", "open", "in_progress", "done"],
        description: "Filter by status",
        default: "all",
      },
    },
  },
  async execute({ status = "all" }: { status?: string }): Promise<string> {
    await ensureBeads();

    if (status === "all") {
      return await $`bd list`.text();
    }
    return await $`bd list --status ${status}`.text();
  },
};

/**
 * Tool: Sync beads with git
 */
export const bd_sync = {
  name: "bd_sync",
  description: "Sync beads tasks with git repository",
  schema: {
    type: "object",
    properties: {},
  },
  async execute(): Promise<string> {
    await ensureBeads();
    await $`bd sync`.quiet();
    return "Beads synced with git";
  },
};

/**
 * Tool: Add dependency between tasks
 */
export const bd_dep = {
  name: "bd_dep",
  description: "Add a dependency between beads tasks (task A depends on task B)",
  schema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Task that has the dependency",
      },
      depends_on: {
        type: "string",
        description: "Task that must be completed first",
      },
    },
    required: ["task", "depends_on"],
  },
  async execute({
    task,
    depends_on,
  }: {
    task: string;
    depends_on: string;
  }): Promise<string> {
    await ensureBeads();
    await $`bd dep add ${task} ${depends_on}`.quiet();
    return `Added dependency: ${task} depends on ${depends_on}`;
  },
};

// Export all tools as a collection
export const beadsTools = {
  bd_ready,
  bd_show,
  bd_claim,
  bd_done,
  bd_create,
  bd_list,
  bd_sync,
  bd_dep,
};

export default beadsTools;
