/**
 * Beads Sync Plugin
 *
 * Syncs TodoWrite completions with beads (bd) for cross-session persistence.
 * When a todo item containing a beads ID (bd-xxx) is marked complete,
 * this plugin automatically marks it done in beads.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

function extractBeadsIds(text: string): string[] {
  const matches = text.match(/bd-[a-z0-9]+/gi);
  return matches ? [...new Set(matches)] : [];
}

async function isBeadsAvailable($: any): Promise<boolean> {
  try {
    await $`bd --version`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function markBeadsDone($: any, taskId: string): Promise<boolean> {
  try {
    await $`bd done ${taskId}`.quiet();
    console.log(`Synced: ${taskId} marked done in beads`);
    return true;
  } catch (error) {
    console.warn(`Failed to sync ${taskId}: ${error}`);
    return false;
  }
}

async function claimBeadsTask($: any, taskId: string): Promise<boolean> {
  try {
    await $`bd update ${taskId} --status in_progress`.quiet();
    console.log(`Claimed: ${taskId} marked in_progress in beads`);
    return true;
  } catch (error) {
    console.warn(`Failed to claim ${taskId}: ${error}`);
    return false;
  }
}

async function syncBeads($: any): Promise<void> {
  try {
    await $`bd sync`.quiet();
  } catch {
    // Ignore sync failures
  }
}

// File-based state to survive module reloads
const BEADS_DIR = ".beads";
const STATE_FILE = ".beads/.plugin-state.json";

interface PluginState {
  syncedDone: string[];
  syncedInProgress: string[];
}

function loadState(worktree: string): PluginState {
  const statePath = join(worktree, STATE_FILE);
  try {
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, "utf-8"));
    }
  } catch {}
  return { syncedDone: [], syncedInProgress: [] };
}

function saveState(worktree: string, state: PluginState): void {
  const beadsDir = join(worktree, BEADS_DIR);
  const statePath = join(worktree, STATE_FILE);
  try {
    if (!existsSync(beadsDir)) {
      mkdirSync(beadsDir, { recursive: true });
    }
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {}
}

const plugin: Plugin = async ({ $, worktree }) => {
  // Check if beads is available
  const beadsAvailable = await isBeadsAvailable($);

  // Load persisted state
  const state = loadState(worktree);
  const syncedDone = new Set(state.syncedDone);
  const syncedInProgress = new Set(state.syncedInProgress);

  return {
    // Hook into TodoWrite tool execution
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "TodoWrite" || !beadsAvailable) {
        return;
      }

      // Parse todos from the tool args
      try {
        const args = output.metadata?.args;
        if (!args?.todos) return;

        const todos: TodoItem[] = args.todos;
        let needsSync = false;

        for (const todo of todos) {
          const beadsIds = extractBeadsIds(todo.content);

          for (const taskId of beadsIds) {
            if (todo.status === "completed" && !syncedDone.has(taskId)) {
              await markBeadsDone($, taskId);
              syncedDone.add(taskId);
              needsSync = true;
            } else if (
              todo.status === "in_progress" &&
              !syncedInProgress.has(taskId)
            ) {
              await claimBeadsTask($, taskId);
              syncedInProgress.add(taskId);
              needsSync = true;
            }
          }
        }

        // Only sync with git if we actually made changes
        if (needsSync) {
          await syncBeads($);
          // Persist state
          state.syncedDone = [...syncedDone];
          state.syncedInProgress = [...syncedInProgress];
          saveState(worktree, state);
        }
      } catch {
        // Ignore parse errors
      }
    },

    event: async ({ event }) => {
      if (!beadsAvailable) return;

      if (event.type === "session.deleted") {
        await syncBeads($);
      }
    },
  };
};

export default plugin;
