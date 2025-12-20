import { tool } from "@opencode-ai/plugin";

/**
 * Code origin tracing with blame
 */
export default tool({
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
