#!/usr/bin/env node

/**
 * Automated sync script for beads and git
 * Ensures beads and git state are consistent
 */

const { execSync } = require("child_process");

function runCommand(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    throw error;
  }
}

function checkGitStatus() {
  const status = runCommand("git status --porcelain");
  return status
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);
}

function checkBeadsStatus() {
  try {
    // Check if there are in-progress tasks
    const list = runCommand("bd list --json");
    const tasks = JSON.parse(list);
    return tasks.filter((t) => t.status === "in_progress").length;
  } catch {
    return 0;
  }
}

function main() {
  const args = process.argv.slice(2);
  const options = {
    preCommit: args.includes("--pre-commit"),
    statusOnly: args.includes("--status"),
  };

  if (options.statusOnly) {
    const gitChanges = checkGitStatus();
    const inProgressTasks = checkBeadsStatus();

    console.log(`Git changes: ${gitChanges.length} files`);
    console.log(`In-progress beads: ${inProgressTasks}`);

    if (gitChanges.length > 0 && inProgressTasks > 0) {
      console.log("\n⚠️  You have uncommitted changes and in-progress tasks");
      console.log("Consider completing work before committing");
    }

    return;
  }

  console.log("🔄 Syncing beads and git...");

  // 1. Sync beads with remote
  console.log("Syncing beads...");
  try {
    runCommand("bd sync");
    console.log("✅ Beads synced");
  } catch {
    console.log("⚠️  Beads sync failed (offline?)");
  }

  // 2. Check git status
  const gitChanges = checkGitStatus();

  if (options.preCommit && gitChanges.length > 0) {
    console.log("\n📝 Staged changes:");
    gitChanges.forEach((line) => console.log(`  ${line}`));

    // Check for TODOs or FIXMEs
    const diff = runCommand("git diff --cached --name-only");
    if (diff) {
      const files = diff.trim().split("\n");
      const hasTodos = files.some((file) => {
        try {
          const content = runCommand(`git show :${file}`);
          return /TODO|FIXME|XXX/.test(content);
        } catch {
          return false;
        }
      });

      if (hasTodos) {
        console.log("\n⚠️  Found TODOs/FIXMEs in staged changes");
        console.log("Consider addressing before committing");
      }
    }
  }

  // 3. Remind about best practices
  const inProgressTasks = checkBeadsStatus();

  if (gitChanges.length > 0 && inProgressTasks === 0) {
    console.log("\n💡 Tip: Consider marking tasks as done before committing");
  }

  console.log("\n✅ Sync complete");
}

if (require.main === module) {
  main();
}

module.exports = { checkGitStatus, checkBeadsStatus };
