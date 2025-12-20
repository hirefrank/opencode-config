import { tool } from "@opencode-ai/plugin";

/**
 * Trace file evolution through renames and refactorings
 */
export default tool({
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
