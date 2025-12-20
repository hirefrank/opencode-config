import { tool } from "@opencode-ai/plugin";

/**
 * Get current git context in one call
 */
export default tool({
  description: "Get current git context: branch, status, recent commits, diff stats",
  args: {},
  async execute() {
    const [branch, status, log, diff, remoteStatus] = await Promise.all([
      Bun.$`git branch --show-current`.text().catch(() => "unknown"),
      Bun.$`git status --short`.text().catch(() => ""),
      Bun.$`git log --oneline -5`.text().catch(() => "No commits"),
      Bun.$`git diff --stat HEAD~1 2>/dev/null`.text().catch(() => ""),
      Bun.$`git status -sb | head -1`.text().catch(() => ""),
    ]);

    // Parse ahead/behind from remote status
    let syncStatus = "";
    if (remoteStatus.includes("ahead")) {
      const match = remoteStatus.match(/ahead (\d+)/);
      if (match) syncStatus = `↑${match[1]} ahead`;
    }
    if (remoteStatus.includes("behind")) {
      const match = remoteStatus.match(/behind (\d+)/);
      if (match) syncStatus += `${syncStatus ? ", " : ""}↓${match[1]} behind`;
    }
    if (!syncStatus && remoteStatus.includes("...")) {
      syncStatus = "✓ up to date";
    }

    const statusTrimmed = status.trim();
    const statusDisplay = statusTrimmed
      ? statusTrimmed.split("\n").slice(0, 10).join("\n") +
        (statusTrimmed.split("\n").length > 10
          ? `\n... +${statusTrimmed.split("\n").length - 10} more`
          : "")
      : "(clean)";

    return `Branch: ${branch.trim()}${syncStatus ? ` [${syncStatus}]` : ""}

Status:
${statusDisplay}

Recent commits:
${log.trim()}

Last commit changed:
${diff.trim() || "(no previous commit)"}`;
  },
});

// ============================================================================
// Deep Git History Analysis Tools
// ============================================================================

/**
 * Trace file evolution through renames and refactorings
 */
export const file_history = tool({
  description:
    "Trace file evolution: history through renames, refactorings, and changes. Shows chronological development.",
  args: {
    file: tool.schema.string().describe("File path to analyze"),
    limit: tool.schema
      .number()
      .optional()
      .describe("Number of commits to show (default: 20)"),
  },
  async execute({ file, limit = 20 }) {
    try {
      const history = await Bun.$`git log --follow --oneline -${limit} -- ${file}`
        .text()
        .catch(() => "");

      if (!history.trim()) {
        return `No history found for: ${file}`;
      }

      // Get more detailed info for context
      const detailed = await Bun.$`git log --follow --format="%h %ad %s" --date=short -${Math.min(limit, 10)} -- ${file}`
        .text()
        .catch(() => "");

      return `## File History: ${file}

${detailed.trim() || history.trim()}

Total commits shown: ${history.trim().split("\n").length}`;
    } catch (e) {
      return `Failed to get file history: ${e}`;
    }
  },
});

/**
 * Code origin tracing with blame
 */
export const blame = tool({
  description:
    "Trace code origins: who wrote each line, when, following code movement across files.",
  args: {
    file: tool.schema.string().describe("File path to blame"),
    startLine: tool.schema.number().optional().describe("Start line (1-indexed)"),
    endLine: tool.schema.number().optional().describe("End line"),
  },
  async execute({ file, startLine, endLine }) {
    try {
      // -w: ignore whitespace, -C -C -C: detect code movement across files
      const lineRange = startLine && endLine ? `-L ${startLine},${endLine}` : "";
      const cmd = lineRange
        ? `git blame -w -C -C -C ${lineRange} --date=short "${file}" 2>/dev/null | head -100`
        : `git blame -w -C -C -C --date=short "${file}" 2>/dev/null | head -100`;

      const blame = await Bun.$`sh -c ${cmd}`.text();

      if (!blame.trim()) {
        return `No blame info for: ${file}`;
      }

      return `## Blame: ${file}${lineRange ? ` (lines ${startLine}-${endLine})` : ""}

${blame.trim()}`;
    } catch (e) {
      return `Failed to get blame: ${e}`;
    }
  },
});

/**
 * Search commit messages for patterns
 */
export const search_commits = tool({
  description:
    "Search commit messages for keywords: find fixes, refactors, features by theme.",
  args: {
    keyword: tool.schema
      .string()
      .describe("Keyword to search (e.g., 'fix', 'refactor', 'auth')"),
    limit: tool.schema
      .number()
      .optional()
      .describe("Max results (default: 30)"),
  },
  async execute({ keyword, limit = 30 }) {
    try {
      const results = await Bun.$`git log --grep=${keyword} --oneline -${limit}`
        .text()
        .catch(() => "");

      if (!results.trim()) {
        return `No commits found matching: "${keyword}"`;
      }

      const count = results.trim().split("\n").length;
      return `## Commits matching "${keyword}"

${results.trim()}

Found: ${count} commit${count > 1 ? "s" : ""}`;
    } catch (e) {
      return `Failed to search commits: ${e}`;
    }
  },
});

/**
 * Get contributor statistics
 */
export const contributors = tool({
  description:
    "Map contributors: who contributed what, commit counts, expertise domains.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Limit to specific path/directory"),
  },
  async execute({ path }) {
    try {
      const pathArg = path ? `-- ${path}` : "";

      const [shortlog, recent] = await Promise.all([
        Bun.$`sh -c ${"git shortlog -sn " + pathArg + " | head -20"}`.text(),
        Bun.$`sh -c ${"git log --format='%an' -50 " + pathArg + " | sort | uniq -c | sort -rn | head -10"}`
          .text()
          .catch(() => ""),
      ]);

      if (!shortlog.trim()) {
        return `No contributors found${path ? ` for: ${path}` : ""}`;
      }

      return `## Contributors${path ? ` (${path})` : ""}

### All-time
${shortlog.trim()}

### Recent (last 50 commits)
${recent.trim() || "N/A"}`;
    } catch (e) {
      return `Failed to get contributors: ${e}`;
    }
  },
});

/**
 * Find when code patterns were introduced or removed (pickaxe search)
 */
export const code_search = tool({
  description:
    "Find when code patterns were introduced/removed: trace when specific code appeared or disappeared.",
  args: {
    pattern: tool.schema
      .string()
      .describe("Code pattern to search for (e.g., 'useState', 'async function')"),
    limit: tool.schema
      .number()
      .optional()
      .describe("Max results (default: 20)"),
  },
  async execute({ pattern, limit = 20 }) {
    try {
      // -S finds commits where the pattern was added or removed
      const results = await Bun.$`git log -S${pattern} --oneline -${limit}`
        .text()
        .catch(() => "");

      if (!results.trim()) {
        return `No commits found that added/removed: "${pattern}"`;
      }

      const count = results.trim().split("\n").length;
      return `## Code pattern: "${pattern}"

Commits that added or removed this pattern:

${results.trim()}

Found: ${count} commit${count > 1 ? "s" : ""}`;
    } catch (e) {
      return `Failed to search code: ${e}`;
    }
  },
});

/**
 * Get hotspots - most changed files
 */
export const hotspots = tool({
  description:
    "Find code hotspots: most frequently changed files, churn analysis.",
  args: {
    limit: tool.schema
      .number()
      .optional()
      .describe("Number of files to show (default: 15)"),
  },
  async execute({ limit = 15 }) {
    try {
      const churn = await Bun.$`sh -c ${"git log --oneline --name-only --pretty=format: | sort | uniq -c | sort -rn | grep -v '^$' | head -" + limit}`
        .text()
        .catch(() => "");

      if (!churn.trim()) {
        return "No churn data available";
      }

      return `## Code Hotspots (most changed files)

${churn.trim()}`;
    } catch (e) {
      return `Failed to get hotspots: ${e}`;
    }
  },
});
