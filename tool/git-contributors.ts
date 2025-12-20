import { tool } from "@opencode-ai/plugin";

/**
 * Get contributor statistics
 */
export default tool({
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
