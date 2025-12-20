import { tool } from "@opencode-ai/plugin";

/**
 * Find when code patterns were introduced or removed (pickaxe search)
 */
export default tool({
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
