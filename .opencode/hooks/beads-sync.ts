/**
 * Beads Sync Hook
 *
 * Syncs TodoWrite completions with beads (bd) for cross-session persistence.
 * When a todo item containing a beads ID (bd-xxx) is marked complete,
 * this hook automatically marks it done in beads.
 */

import { $ } from "bun";

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

/**
 * Extract beads task IDs from text
 */
function extractBeadsIds(text: string): string[] {
  const matches = text.match(/bd-[a-z0-9]+/gi);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Check if beads is available
 */
async function isBeadsAvailable(): Promise<boolean> {
  try {
    await $`bd --version`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a beads task as done
 */
async function markBeadsDone(taskId: string): Promise<boolean> {
  try {
    await $`bd done ${taskId}`.quiet();
    console.log(`✅ Synced: ${taskId} marked done in beads`);
    return true;
  } catch (error) {
    console.warn(`⚠️ Failed to sync ${taskId}: ${error}`);
    return false;
  }
}

/**
 * Claim a beads task (mark as in_progress)
 */
async function claimBeadsTask(taskId: string): Promise<boolean> {
  try {
    await $`bd update ${taskId} --status in_progress`.quiet();
    console.log(`📋 Claimed: ${taskId} marked in_progress in beads`);
    return true;
  } catch (error) {
    console.warn(`⚠️ Failed to claim ${taskId}: ${error}`);
    return false;
  }
}

/**
 * Sync beads with git
 */
async function syncBeads(): Promise<void> {
  try {
    await $`bd sync`.quiet();
    console.log("🔄 Beads synced with git");
  } catch {
    // Ignore sync failures
  }
}

/**
 * Hook: Called when TodoWrite updates todos
 */
export async function onTodoWrite(todos: TodoItem[]): Promise<void> {
  if (!(await isBeadsAvailable())) {
    return; // Beads not installed, skip
  }

  for (const todo of todos) {
    const beadsIds = extractBeadsIds(todo.content);

    for (const taskId of beadsIds) {
      if (todo.status === "completed") {
        await markBeadsDone(taskId);
      } else if (todo.status === "in_progress") {
        await claimBeadsTask(taskId);
      }
    }
  }

  // Sync with git after processing
  await syncBeads();
}

/**
 * Hook: Called at session start
 */
export async function onSessionStart(): Promise<void> {
  if (!(await isBeadsAvailable())) {
    return;
  }

  try {
    const result = await $`bd ready --limit 5`.quiet();
    const output = result.stdout.toString().trim();

    if (output) {
      console.log("\n📋 Available beads tasks:");
      console.log(output);
      console.log("\nUse 'bd show <id>' for details or include task ID in your work.\n");
    }
  } catch {
    // No tasks or beads not configured
  }
}

/**
 * Hook: Called at session end
 */
export async function onSessionEnd(): Promise<void> {
  if (!(await isBeadsAvailable())) {
    return;
  }

  await syncBeads();
  console.log("📤 Session ended, beads synced with git");
}

// Export for OpenCode plugin integration
export default {
  onTodoWrite,
  onSessionStart,
  onSessionEnd,
  extractBeadsIds,
  markBeadsDone,
  claimBeadsTask,
  syncBeads,
};
