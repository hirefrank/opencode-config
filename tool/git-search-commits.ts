import { tool } from "@opencode-ai/plugin";

/**
 * Search commit messages for patterns
 */
export default tool({
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
