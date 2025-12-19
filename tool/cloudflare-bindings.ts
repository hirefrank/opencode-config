import { tool } from "@opencode-ai/plugin";
import { readFile, stat } from "node:fs/promises";
import { truncateOutput, formatError } from "./tool-utils";

/**
 * Cloudflare Bindings Analyzer
 *
 * Parses wrangler.toml and generates TypeScript Env interface.
 * This is a "Hard Tool" - deterministic parsing that provides ground truth.
 */

// Binding type mappings for TypeScript interface generation
const TYPE_MAP: Record<string, string> = {
  kv_namespaces: "KVNamespace",
  r2_buckets: "R2Bucket",
  d1_databases: "D1Database",
  durable_objects: "DurableObjectNamespace",
  services: "Fetcher",
  queues: "Queue",
  vectorize: "VectorizeIndex",
  ai: "Ai",
  analytics_engine: "AnalyticsEngineDataset",
  hyperdrive: "Hyperdrive",
};

/**
 * Parsed bindings structure
 */
interface ParsedBindings {
  kv_namespaces: Array<{ binding: string; id?: string }>;
  r2_buckets: Array<{ binding: string; bucket_name?: string }>;
  d1_databases: Array<{ binding: string; database_id?: string }>;
  durable_objects: Array<{
    name?: string;
    binding?: string;
    class_name?: string;
  }>;
  services: Array<{ binding: string; service?: string }>;
  queues_producers: Array<{ binding: string; queue?: string }>;
  queues_consumers: Array<{ queue?: string }>;
  vectorize: Array<{ binding: string; index_name?: string }>;
  ai: { binding?: string } | null;
  vars: Record<string, string>;
  secrets: string[];
}

/**
 * Simple TOML parser for wrangler.toml
 * Handles the common patterns used in Cloudflare configs
 */
function parseToml(content: string): ParsedBindings {
  const bindings: ParsedBindings = {
    kv_namespaces: [],
    r2_buckets: [],
    d1_databases: [],
    durable_objects: [],
    services: [],
    queues_producers: [],
    queues_consumers: [],
    vectorize: [],
    ai: null,
    vars: {},
    secrets: [],
  };

  const lines = content.split("\n");
  let currentSection: string | null = null;
  let currentItem: Record<string, string | boolean> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") continue;

    // Array section headers [[section]]
    const arrayMatch = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayMatch) {
      // Save previous item if exists
      if (currentSection && Object.keys(currentItem).length > 0) {
        pushBinding(bindings, currentSection, currentItem);
      }
      currentSection = arrayMatch[1].replace(/\./g, "_");
      currentItem = {};
      continue;
    }

    // Table section headers [section]
    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      if (currentSection && Object.keys(currentItem).length > 0) {
        pushBinding(bindings, currentSection, currentItem);
      }
      currentSection = tableMatch[1].replace(/\./g, "_");
      currentItem = {};
      continue;
    }

    // Key-value pairs
    const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value: string | boolean = kvMatch[2].trim();

      // Remove quotes from strings
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Parse booleans
      if (value === "true") value = true;
      if (value === "false") value = false;

      if (currentSection === "vars") {
        bindings.vars[key] = String(value);
      } else {
        currentItem[key] = value;
      }
    }
  }

  // Don't forget the last item
  if (currentSection && Object.keys(currentItem).length > 0) {
    pushBinding(bindings, currentSection, currentItem);
  }

  return bindings;
}

function pushBinding(
  bindings: ParsedBindings,
  section: string,
  item: Record<string, string | boolean>,
): void {
  const typedItem = item as Record<string, string>;

  if (section === "kv_namespaces") {
    bindings.kv_namespaces.push(typedItem as { binding: string; id?: string });
  } else if (section === "r2_buckets") {
    bindings.r2_buckets.push(
      typedItem as { binding: string; bucket_name?: string },
    );
  } else if (section === "d1_databases") {
    bindings.d1_databases.push(
      typedItem as { binding: string; database_id?: string },
    );
  } else if (section === "durable_objects_bindings") {
    bindings.durable_objects.push(
      typedItem as { name?: string; binding?: string; class_name?: string },
    );
  } else if (section === "services") {
    bindings.services.push(typedItem as { binding: string; service?: string });
  } else if (section === "queues_producers") {
    bindings.queues_producers.push(
      typedItem as { binding: string; queue?: string },
    );
  } else if (section === "queues_consumers") {
    bindings.queues_consumers.push(typedItem as { queue?: string });
  } else if (section === "vectorize") {
    bindings.vectorize.push(
      typedItem as { binding: string; index_name?: string },
    );
  } else if (section === "ai") {
    bindings.ai = typedItem as { binding?: string };
  }
}

/**
 * Generate TypeScript Env interface from parsed bindings
 */
function generateEnvInterface(bindings: ParsedBindings): string {
  const lines: string[] = ["interface Env {"];

  // KV Namespaces
  if (bindings.kv_namespaces.length > 0) {
    lines.push("  // KV Namespaces");
    bindings.kv_namespaces.forEach((kv) => {
      lines.push(`  ${kv.binding}: KVNamespace;`);
    });
    lines.push("");
  }

  // R2 Buckets
  if (bindings.r2_buckets.length > 0) {
    lines.push("  // R2 Buckets");
    bindings.r2_buckets.forEach((r2) => {
      lines.push(`  ${r2.binding}: R2Bucket;`);
    });
    lines.push("");
  }

  // D1 Databases
  if (bindings.d1_databases.length > 0) {
    lines.push("  // D1 Databases");
    bindings.d1_databases.forEach((d1) => {
      lines.push(`  ${d1.binding}: D1Database;`);
    });
    lines.push("");
  }

  // Durable Objects
  if (bindings.durable_objects.length > 0) {
    lines.push("  // Durable Objects");
    bindings.durable_objects.forEach((dobj) => {
      const name = dobj.name || dobj.binding;
      if (name) {
        lines.push(`  ${name}: DurableObjectNamespace;`);
      }
    });
    lines.push("");
  }

  // Service Bindings
  if (bindings.services.length > 0) {
    lines.push("  // Service Bindings");
    bindings.services.forEach((svc) => {
      lines.push(`  ${svc.binding}: Fetcher;`);
    });
    lines.push("");
  }

  // Queues
  if (bindings.queues_producers.length > 0) {
    lines.push("  // Queue Producers");
    bindings.queues_producers.forEach((q) => {
      lines.push(`  ${q.binding}: Queue;`);
    });
    lines.push("");
  }

  // Vectorize
  if (bindings.vectorize.length > 0) {
    lines.push("  // Vectorize Indexes");
    bindings.vectorize.forEach((v) => {
      lines.push(`  ${v.binding}: VectorizeIndex;`);
    });
    lines.push("");
  }

  // AI
  if (bindings.ai) {
    lines.push("  // AI");
    lines.push(`  ${bindings.ai.binding || "AI"}: Ai;`);
    lines.push("");
  }

  // Environment Variables
  if (Object.keys(bindings.vars).length > 0) {
    lines.push("  // Environment Variables");
    Object.keys(bindings.vars).forEach((key) => {
      lines.push(`  ${key}: string;`);
    });
    lines.push("");
  }

  // Add common secrets placeholder
  lines.push("  // Secrets (add as needed)");
  lines.push("  // API_KEY?: string;");

  lines.push("}");
  return lines.join("\n");
}

/**
 * Generate human-readable summary of bindings
 */
function summarizeBindings(bindings: ParsedBindings): string[] {
  const summary: string[] = [];

  if (bindings.kv_namespaces.length > 0) {
    summary.push(
      `KV Namespaces: ${bindings.kv_namespaces.map((b) => b.binding).join(", ")}`,
    );
  }
  if (bindings.r2_buckets.length > 0) {
    summary.push(
      `R2 Buckets: ${bindings.r2_buckets.map((b) => b.binding).join(", ")}`,
    );
  }
  if (bindings.d1_databases.length > 0) {
    summary.push(
      `D1 Databases: ${bindings.d1_databases.map((b) => b.binding).join(", ")}`,
    );
  }
  if (bindings.durable_objects.length > 0) {
    summary.push(
      `Durable Objects: ${bindings.durable_objects.map((b) => b.name || b.binding).join(", ")}`,
    );
  }
  if (bindings.services.length > 0) {
    summary.push(
      `Service Bindings: ${bindings.services.map((b) => b.binding).join(", ")}`,
    );
  }
  if (bindings.queues_producers.length > 0) {
    summary.push(
      `Queue Producers: ${bindings.queues_producers.map((b) => b.binding).join(", ")}`,
    );
  }
  if (bindings.vectorize.length > 0) {
    summary.push(
      `Vectorize: ${bindings.vectorize.map((b) => b.binding).join(", ")}`,
    );
  }
  if (bindings.ai) {
    summary.push(`AI: ${bindings.ai.binding || "AI"}`);
  }

  return summary;
}

/**
 * Analyze wrangler.toml bindings and generate TypeScript interface
 */
export const analyze_bindings = tool({
  description:
    "Parse wrangler.toml and generate TypeScript Env interface. Shows all configured bindings (KV, R2, D1, DO, Services, Queues, AI) with proper types.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to wrangler.toml (default: wrangler.toml)"),
    json: tool.schema
      .boolean()
      .optional()
      .describe("Output as JSON instead of formatted text"),
  },
  async execute({ path: wranglerPath, json }) {
    try {
      const targetPath = wranglerPath || "wrangler.toml";

      // Check if file exists
      try {
        await stat(targetPath);
      } catch {
        return `Error: wrangler.toml not found at ${targetPath}`;
      }

      const content = await readFile(targetPath, "utf-8");
      const bindings = parseToml(content);
      const envInterface = generateEnvInterface(bindings);
      const summary = summarizeBindings(bindings);

      if (json) {
        const result = {
          file: targetPath,
          timestamp: new Date().toISOString(),
          summary,
          bindings: {
            kv_namespaces: bindings.kv_namespaces,
            r2_buckets: bindings.r2_buckets,
            d1_databases: bindings.d1_databases,
            durable_objects: bindings.durable_objects,
            services: bindings.services,
            queues: bindings.queues_producers,
            vectorize: bindings.vectorize,
            ai: bindings.ai,
            vars: bindings.vars,
          },
          typescript: envInterface,
        };
        return truncateOutput(JSON.stringify(result, null, 2));
      }

      // Human-readable output
      const lines: string[] = [];
      lines.push("# Cloudflare Bindings Analysis\n");
      lines.push(`File: ${targetPath}`);
      lines.push(`Analyzed: ${new Date().toISOString()}\n`);

      if (summary.length > 0) {
        lines.push("## Bindings Summary\n");
        summary.forEach((s) => lines.push(`- ${s}`));
        lines.push("");
      } else {
        lines.push("No bindings found in wrangler.toml\n");
      }

      lines.push("## Generated TypeScript Interface\n");
      lines.push("```typescript");
      lines.push(envInterface);
      lines.push("```");

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Quick binding check - just list what's configured
 */
export const list_bindings = tool({
  description:
    "Quick list of all bindings in wrangler.toml. Use for fast overview without TypeScript generation.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to wrangler.toml (default: wrangler.toml)"),
  },
  async execute({ path: wranglerPath }) {
    try {
      const targetPath = wranglerPath || "wrangler.toml";

      try {
        await stat(targetPath);
      } catch {
        return `Error: wrangler.toml not found at ${targetPath}`;
      }

      const content = await readFile(targetPath, "utf-8");
      const bindings = parseToml(content);
      const summary = summarizeBindings(bindings);

      if (summary.length === 0) {
        return "No bindings found in wrangler.toml";
      }

      return `Bindings in ${targetPath}:\n\n${summary.map((s) => `- ${s}`).join("\n")}`;
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Validate bindings against code usage
 */
export const validate_bindings = tool({
  description:
    "Validate that bindings in wrangler.toml match code usage. Finds unused bindings and missing declarations.",
  args: {
    wranglerPath: tool.schema
      .string()
      .optional()
      .describe("Path to wrangler.toml (default: wrangler.toml)"),
    srcPath: tool.schema
      .string()
      .optional()
      .describe("Path to source directory (default: src)"),
  },
  async execute({ wranglerPath, srcPath }) {
    try {
      const tomlPath = wranglerPath || "wrangler.toml";
      const sourcePath = srcPath || "src";

      // Check if wrangler.toml exists
      try {
        await stat(tomlPath);
      } catch {
        return `Error: wrangler.toml not found at ${tomlPath}`;
      }

      const content = await readFile(tomlPath, "utf-8");
      const bindings = parseToml(content);

      // Collect all binding names
      const declaredBindings = new Set<string>();

      bindings.kv_namespaces.forEach((b) => declaredBindings.add(b.binding));
      bindings.r2_buckets.forEach((b) => declaredBindings.add(b.binding));
      bindings.d1_databases.forEach((b) => declaredBindings.add(b.binding));
      bindings.durable_objects.forEach((b) => {
        if (b.name) declaredBindings.add(b.name);
        if (b.binding) declaredBindings.add(b.binding);
      });
      bindings.services.forEach((b) => declaredBindings.add(b.binding));
      bindings.queues_producers.forEach((b) => declaredBindings.add(b.binding));
      bindings.vectorize.forEach((b) => declaredBindings.add(b.binding));
      if (bindings.ai?.binding) declaredBindings.add(bindings.ai.binding);
      Object.keys(bindings.vars).forEach((k) => declaredBindings.add(k));

      // Search for env.BINDING usage in source files
      const { $ } = await import("bun");
      const usedBindings = new Set<string>();

      try {
        // Find all env.BINDING patterns
        const rgOutput =
          await $`rg "env\\.([A-Z_][A-Z0-9_]*)" ${sourcePath} -o --no-filename 2>/dev/null`.text();

        rgOutput.split("\n").forEach((match) => {
          const bindingMatch = match.match(/env\.([A-Z_][A-Z0-9_]*)/);
          if (bindingMatch) {
            usedBindings.add(bindingMatch[1]);
          }
        });
      } catch {
        // No matches or directory doesn't exist
      }

      // Find unused and missing
      const unused = [...declaredBindings].filter((b) => !usedBindings.has(b));
      const missing = [...usedBindings].filter((b) => !declaredBindings.has(b));

      const lines: string[] = [];
      lines.push("# Binding Validation Results\n");

      if (unused.length === 0 && missing.length === 0) {
        lines.push("All bindings are properly declared and used.");
        return lines.join("\n");
      }

      if (unused.length > 0) {
        lines.push("## Unused Bindings (declared but not used)\n");
        unused.forEach((b) => lines.push(`- ${b}`));
        lines.push("");
      }

      if (missing.length > 0) {
        lines.push("## Missing Bindings (used but not declared)\n");
        missing.forEach((b) => lines.push(`- env.${b} - add to wrangler.toml`));
        lines.push("");
      }

      lines.push("## Summary\n");
      lines.push(`- Declared: ${declaredBindings.size}`);
      lines.push(`- Used: ${usedBindings.size}`);
      lines.push(`- Unused: ${unused.length}`);
      lines.push(`- Missing: ${missing.length}`);

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});
