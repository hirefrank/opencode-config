/**
 * Beads Sync Plugin
 *
 * Syncs TodoWrite completions with beads (bd) for cross-session persistence.
 * When a todo item containing a beads ID (bd-xxx) is marked complete,
 * this plugin automatically marks it done in beads.
 */

import type { Plugin } from "@opencode-ai/plugin";

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

const plugin: Plugin = async ({ $ }) => {
  // Check if beads is available once at plugin load
  const beadsAvailable = await isBeadsAvailable($);

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

        for (const todo of todos) {
          const beadsIds = extractBeadsIds(todo.content);

          for (const taskId of beadsIds) {
            if (todo.status === "completed") {
              await markBeadsDone($, taskId);
            } else if (todo.status === "in_progress") {
              await claimBeadsTask($, taskId);
            }
          }
        }

        // Sync with git after processing
        await syncBeads($);
      } catch {
        // Ignore parse errors
      }
    },

    // Hook into session events
    event: async ({ event }) => {
      if (!beadsAvailable) return;

      if (event.type === "session.created") {
        // Show available beads tasks at session start
        try {
          const result = await $`bd ready --limit 5`.quiet();
          const output = result.stdout.toString().trim();

          if (output) {
            console.log("\nAvailable beads tasks:");
            console.log(output);
            console.log("\nUse 'bd show <id>' for details.\n");
          }
        } catch {
          // No tasks or beads not configured
        }
      } else if (event.type === "session.ended") {
        await syncBeads($);
        console.log("Session ended, beads synced");
      }
    },
  };
};

export default plugin;
