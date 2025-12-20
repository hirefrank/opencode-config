import { tool } from "@opencode-ai/plugin";

/**
 * Get hotspots - most changed files
 */
export default tool({
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
