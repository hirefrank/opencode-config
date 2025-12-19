import { tool } from "@opencode-ai/plugin";
import { $ } from "bun";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { truncateOutput, formatError } from "./tool-utils";

/**
 * UBS - Ultimate Bug Scanner
 *
 * Multi-language bug scanner that catches what humans and AI miss:
 * null safety, XSS, async/await bugs, memory leaks, type coercion issues.
 *
 * Supports: JavaScript/TypeScript, Python, C/C++, Rust, Go, Java, Ruby, Swift
 *
 * Run BEFORE committing to catch bugs early. Exit 0 = clean, Exit 1 = issues found.
 */

async function runUbs(args: string[]): Promise<string> {
  try {
    const result = await $`ubs ${args}`.text();
    return result.trim();
  } catch (e: any) {
    // ubs exits non-zero when it finds issues - that's expected behavior
    const stdout = e.stdout?.toString() || "";
    const stderr = e.stderr?.toString() || "";
    if (stdout) return stdout.trim();
    if (stderr) return stderr.trim();
    return `Error: ${e.message || e}`;
  }
}

export const scan = tool({
  description:
    "Scan code for bugs: null safety, XSS, async/await issues, memory leaks, type coercion. Run BEFORE committing. Supports JS/TS, Python, C++, Rust, Go, Java, Ruby.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to scan (default: current directory)"),
    only: tool.schema
      .string()
      .optional()
      .describe(
        "Restrict to languages: js,python,cpp,rust,golang,java,ruby,swift",
      ),
    staged: tool.schema
      .boolean()
      .optional()
      .describe("Scan only files staged for commit"),
    diff: tool.schema
      .boolean()
      .optional()
      .describe("Scan only modified files (working tree vs HEAD)"),
    failOnWarning: tool.schema
      .boolean()
      .optional()
      .describe("Exit non-zero if warnings exist (default for CI)"),
  },
  async execute({ path, only, staged, diff, failOnWarning }) {
    const args: string[] = [];
    if (staged) args.push("--staged");
    if (diff) args.push("--diff");
    if (only) args.push(`--only=${only}`);
    if (failOnWarning) args.push("--fail-on-warning");
    args.push(path || ".");
    return runUbs(args);
  },
});

export const scan_json = tool({
  description:
    "Scan code for bugs with JSON output. Better for parsing results programmatically.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to scan (default: current directory)"),
    only: tool.schema
      .string()
      .optional()
      .describe(
        "Restrict to languages: js,python,cpp,rust,golang,java,ruby,swift",
      ),
  },
  async execute({ path, only }) {
    const args = ["--format=json", "--ci"];
    if (only) args.push(`--only=${only}`);
    args.push(path || ".");
    return runUbs(args);
  },
});

export const doctor = tool({
  description:
    "Check UBS health: validate modules, dependencies, and configuration.",
  args: {
    fix: tool.schema
      .boolean()
      .optional()
      .describe("Automatically download or refresh cached modules"),
  },
  async execute({ fix }) {
    const args = ["doctor"];
    if (fix) args.push("--fix");
    return runUbs(args);
  },
});

// ============================================================================
// Workers-Specific Bug Detection
// ============================================================================

/**
 * Severity levels for Workers violations
 */
type Severity = "critical" | "warning" | "info";

/**
 * Categories of Workers-specific bugs
 */
type ViolationType =
  | "node-api" // Node.js APIs that don't exist in Workers
  | "env-access" // process.env usage
  | "commonjs" // require/module.exports
  | "sync-io" // Synchronous I/O operations
  | "stateful-worker" // In-memory state in Workers
  | "missing-await" // Async operations without await
  | "kv-pattern" // KV anti-patterns (missing TTL, rate limiting)
  | "service-binding" // HTTP instead of service bindings
  | "bundle-size"; // Heavy dependencies

/**
 * A detected violation in Workers code
 */
interface WorkersViolation {
  file: string;
  line: number;
  column?: number;
  code: string;
  type: ViolationType;
  severity: Severity;
  message: string;
  fix: string;
}

/**
 * Pattern definition for Workers bug detection
 */
interface WorkersPattern {
  pattern: RegExp;
  type: ViolationType;
  severity: Severity;
  message: string;
  fix: string;
}

/**
 * Forbidden patterns that will break in Cloudflare Workers
 * Based on knowledge/cloudflare-patterns.md
 */
const WORKERS_PATTERNS: WorkersPattern[] = [
  // ============ Node.js Built-in Modules ============
  {
    pattern: /import\s+.*\s+from\s+['"]fs['"]/,
    type: "node-api",
    severity: "critical",
    message: "fs module not available in Workers runtime",
    fix: "Use R2 for file storage or KV for key-value data",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]path['"]/,
    type: "node-api",
    severity: "critical",
    message: "path module not available in Workers runtime",
    fix: "Use URL API for path manipulation: new URL(path, base)",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]os['"]/,
    type: "node-api",
    severity: "critical",
    message: "os module not available in Workers runtime",
    fix: "Workers run in V8 isolates, not OS processes",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]buffer['"]/,
    type: "node-api",
    severity: "critical",
    message: "Buffer module not available in Workers runtime",
    fix: "Use Uint8Array or ArrayBuffer instead",
  },
  {
    pattern: /import\s+crypto\s+from\s+['"]crypto['"]/,
    type: "node-api",
    severity: "critical",
    message: "Node.js crypto module not available",
    fix: "Use Web Crypto API: crypto.subtle.digest(), crypto.getRandomValues()",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]child_process['"]/,
    type: "node-api",
    severity: "critical",
    message: "child_process not available in Workers runtime",
    fix: "Workers cannot spawn processes. Use Workers for compute, external APIs for heavy processing",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]net['"]/,
    type: "node-api",
    severity: "critical",
    message: "net module not available in Workers runtime",
    fix: "Use fetch() for HTTP or Durable Objects for WebSockets",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]http['"]/,
    type: "node-api",
    severity: "critical",
    message: "http module not available in Workers runtime",
    fix: "Use fetch() API for HTTP requests",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]https['"]/,
    type: "node-api",
    severity: "critical",
    message: "https module not available in Workers runtime",
    fix: "Use fetch() API for HTTPS requests",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]stream['"]/,
    type: "node-api",
    severity: "critical",
    message: "Node.js stream module not available",
    fix: "Use Web Streams API: ReadableStream, WritableStream, TransformStream",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]events['"]/,
    type: "node-api",
    severity: "critical",
    message: "Node.js events module not available",
    fix: "Use EventTarget or custom event handling patterns",
  },

  // ============ process.env and process APIs ============
  {
    pattern: /process\.env\./,
    type: "env-access",
    severity: "critical",
    message: "process.env not available in Workers runtime",
    fix: "Use env parameter: export default { fetch(request, env) { env.MY_VAR } }",
  },
  {
    pattern: /process\.exit/,
    type: "env-access",
    severity: "critical",
    message: "process.exit() not available in Workers runtime",
    fix: "Return Response with appropriate status code instead",
  },
  {
    pattern: /process\.cwd\(\)/,
    type: "env-access",
    severity: "critical",
    message: "process.cwd() not available in Workers runtime",
    fix: "Workers have no filesystem. Use relative imports or env bindings",
  },
  {
    pattern: /process\.argv/,
    type: "env-access",
    severity: "critical",
    message: "process.argv not available in Workers runtime",
    fix: "Use request URL or headers for input parameters",
  },

  // ============ CommonJS ============
  {
    pattern: /\brequire\s*\(/,
    type: "commonjs",
    severity: "critical",
    message: "require() not supported in Workers runtime",
    fix: 'Use ES modules: import { x } from "module"',
  },
  {
    pattern: /module\.exports/,
    type: "commonjs",
    severity: "critical",
    message: "module.exports not supported in Workers runtime",
    fix: "Use ES modules: export default or export { x }",
  },
  {
    pattern: /__dirname/,
    type: "commonjs",
    severity: "critical",
    message: "__dirname not available in Workers runtime",
    fix: "Use import.meta.url for module-relative paths",
  },
  {
    pattern: /__filename/,
    type: "commonjs",
    severity: "critical",
    message: "__filename not available in Workers runtime",
    fix: "Use import.meta.url for module-relative paths",
  },

  // ============ Buffer Usage ============
  {
    pattern: /Buffer\.from\(/,
    type: "node-api",
    severity: "critical",
    message: "Buffer.from() not available in Workers runtime",
    fix: "Use: new TextEncoder().encode(string) or new Uint8Array()",
  },
  {
    pattern: /Buffer\.alloc\(/,
    type: "node-api",
    severity: "critical",
    message: "Buffer.alloc() not available in Workers runtime",
    fix: "Use: new Uint8Array(size)",
  },
  {
    pattern: /Buffer\.concat\(/,
    type: "node-api",
    severity: "critical",
    message: "Buffer.concat() not available in Workers runtime",
    fix: "Use: new Uint8Array([...arr1, ...arr2]) or custom concat function",
  },
  {
    pattern: /\.toString\(['"]base64['"]\)/,
    type: "node-api",
    severity: "warning",
    message: "Buffer.toString('base64') pattern detected",
    fix: "Use: btoa(String.fromCharCode(...new Uint8Array(buffer)))",
  },

  // ============ Synchronous I/O ============
  {
    pattern: /readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync/,
    type: "sync-io",
    severity: "critical",
    message: "Synchronous file operations not available",
    fix: "Workers have no filesystem. Use KV for key-value, R2 for files",
  },

  // ============ Stateful Worker Anti-patterns ============
  {
    pattern: /^(?:let|var)\s+\w+\s*=\s*(?:new\s+Map|new\s+Set|\[\]|\{\})/m,
    type: "stateful-worker",
    severity: "warning",
    message:
      "Module-level mutable state detected - will not persist between requests",
    fix: "Use KV, D1, or Durable Objects for persistent state",
  },
  {
    pattern: /^const\s+cache\s*=\s*new\s+Map/m,
    type: "stateful-worker",
    severity: "warning",
    message: "In-memory cache will be lost between requests",
    fix: "Use Cache API for caching: caches.default.put()",
  },

  // ============ KV Anti-patterns ============
  {
    pattern: /\.put\s*\([^)]+\)\s*(?!.*expirationTtl)/,
    type: "kv-pattern",
    severity: "info",
    message: "KV put() without TTL - data persists indefinitely",
    fix: "Add expirationTtl: await env.KV.put(key, value, { expirationTtl: 3600 })",
  },

  // ============ Service Binding Anti-patterns ============
  {
    pattern: /fetch\s*\(\s*['"]https?:\/\/[^'"]*\.workers\.dev/,
    type: "service-binding",
    severity: "warning",
    message: "HTTP call to .workers.dev - use Service Bindings instead",
    fix: "Use Service Bindings: env.MY_SERVICE.fetch(request) for Worker-to-Worker calls",
  },

  // ============ Heavy Dependencies ============
  {
    pattern: /import\s+.*\s+from\s+['"]lodash['"]/,
    type: "bundle-size",
    severity: "warning",
    message: "lodash adds ~70KB to bundle, slowing cold starts",
    fix: "Use native JS methods or lodash-es with tree-shaking",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]moment['"]/,
    type: "bundle-size",
    severity: "warning",
    message: "moment.js adds ~300KB to bundle, slowing cold starts",
    fix: "Use native Date or date-fns (tree-shakeable)",
  },
  {
    pattern: /import\s+.*\s+from\s+['"]axios['"]/,
    type: "bundle-size",
    severity: "info",
    message: "axios is unnecessary - Workers have native fetch()",
    fix: "Use native fetch() API which is built into Workers",
  },

  // ============ Missing Await Patterns ============
  {
    pattern: /env\.\w+\.get\s*\([^)]+\)\s*[;,\n](?!\s*\.then)/,
    type: "missing-await",
    severity: "warning",
    message: "KV/R2 get() without await - returns Promise, not value",
    fix: "Add await: const value = await env.KV.get(key)",
  },
  {
    pattern: /env\.\w+\.put\s*\([^)]+\)\s*[;,\n](?!\s*\.then)/,
    type: "missing-await",
    severity: "warning",
    message: "KV/R2 put() without await - operation may not complete",
    fix: "Add await: await env.KV.put(key, value)",
  },
];

/**
 * File extensions to scan for Workers violations
 */
const WORKERS_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

/**
 * Directories to skip during scanning
 */
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".wrangler"];

/**
 * Recursively walk a directory and collect file paths
 */
async function walkDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name) && !entry.name.startsWith(".")) {
          files.push(...(await walkDirectory(fullPath)));
        }
      } else if (
        entry.isFile() &&
        WORKERS_SCAN_EXTENSIONS.includes(extname(entry.name))
      ) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Directory doesn't exist or not accessible
  }

  return files;
}

/**
 * Scan a single file for Workers violations
 */
async function scanFileForWorkersViolations(
  filePath: string,
): Promise<WorkersViolation[]> {
  const violations: WorkersViolation[] = [];

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      for (const {
        pattern,
        type,
        severity,
        message,
        fix,
      } of WORKERS_PATTERNS) {
        // Create a fresh regex for each test
        const regex = new RegExp(pattern.source, pattern.flags);
        const match = regex.exec(line);

        if (match) {
          violations.push({
            file: filePath,
            line: lineNumber,
            column: match.index + 1,
            code: line.trim(),
            type,
            severity,
            message,
            fix,
          });
        }
      }
    }
  } catch (e) {
    // File not readable
  }

  return violations;
}

/**
 * Format violations for human-readable output
 */
function formatWorkersViolations(violations: WorkersViolation[]): string {
  if (violations.length === 0) {
    return "✅ No Workers runtime violations detected";
  }

  const critical = violations.filter((v) => v.severity === "critical");
  const warnings = violations.filter((v) => v.severity === "warning");
  const info = violations.filter((v) => v.severity === "info");

  const lines: string[] = [];

  lines.push("# Workers Runtime Scan Results\n");
  lines.push(`Total: ${violations.length} issues found`);
  lines.push(`  🔴 Critical: ${critical.length}`);
  lines.push(`  🟡 Warning: ${warnings.length}`);
  lines.push(`  🔵 Info: ${info.length}`);
  lines.push("");

  // Group by file
  const byFile = new Map<string, WorkersViolation[]>();
  for (const v of violations) {
    const existing = byFile.get(v.file) || [];
    existing.push(v);
    byFile.set(v.file, existing);
  }

  for (const [file, fileViolations] of byFile) {
    lines.push(`## ${file}\n`);

    for (const v of fileViolations) {
      const icon =
        v.severity === "critical"
          ? "🔴"
          : v.severity === "warning"
            ? "🟡"
            : "🔵";
      lines.push(`${icon} Line ${v.line}: ${v.message}`);
      lines.push(`   Code: \`${v.code}\``);
      lines.push(`   Fix: ${v.fix}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Workers-specific bug scanner tool
 */
export const scan_workers = tool({
  description:
    "Scan code for Cloudflare Workers-specific bugs: Node.js API usage, process.env, CommonJS, stateful patterns, missing await, KV anti-patterns. Run BEFORE deploying to Workers.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to scan (default: current directory)"),
    severity: tool.schema
      .enum(["all", "critical", "warning"])
      .optional()
      .describe("Minimum severity to report (default: all)"),
    json: tool.schema
      .boolean()
      .optional()
      .describe("Output as JSON instead of formatted text"),
  },
  async execute({ path, severity, json }) {
    try {
      const targetPath = path || ".";

      // Check if path exists
      try {
        await stat(targetPath);
      } catch {
        return `Error: Path not found: ${targetPath}`;
      }

      // Collect files
      const files = await walkDirectory(targetPath);

      if (files.length === 0) {
        return `No TypeScript/JavaScript files found in ${targetPath}`;
      }

      // Scan all files
      const allViolations: WorkersViolation[] = [];
      for (const file of files) {
        const violations = await scanFileForWorkersViolations(file);
        allViolations.push(...violations);
      }

      // Filter by severity if specified
      let filtered = allViolations;
      if (severity === "critical") {
        filtered = allViolations.filter((v) => v.severity === "critical");
      } else if (severity === "warning") {
        filtered = allViolations.filter(
          (v) => v.severity === "critical" || v.severity === "warning",
        );
      }

      // Output
      if (json) {
        const result = {
          scanned: targetPath,
          filesScanned: files.length,
          timestamp: new Date().toISOString(),
          total: filtered.length,
          critical: filtered.filter((v) => v.severity === "critical").length,
          warnings: filtered.filter((v) => v.severity === "warning").length,
          info: filtered.filter((v) => v.severity === "info").length,
          violations: filtered,
        };
        return truncateOutput(JSON.stringify(result, null, 2));
      }

      return truncateOutput(formatWorkersViolations(filtered));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Quick check for Workers compatibility (critical issues only)
 */
export const check_workers = tool({
  description:
    "Quick Workers compatibility check - reports only critical issues that will break in production. Use before deployment.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to check (default: current directory)"),
  },
  async execute({ path }) {
    try {
      const targetPath = path || ".";

      try {
        await stat(targetPath);
      } catch {
        return `Error: Path not found: ${targetPath}`;
      }

      const files = await walkDirectory(targetPath);

      if (files.length === 0) {
        return `✅ No TypeScript/JavaScript files found in ${targetPath}`;
      }

      const allViolations: WorkersViolation[] = [];
      for (const file of files) {
        const violations = await scanFileForWorkersViolations(file);
        allViolations.push(...violations);
      }

      const critical = allViolations.filter((v) => v.severity === "critical");

      if (critical.length === 0) {
        return `✅ Workers compatibility check passed (${files.length} files scanned)`;
      }

      const lines: string[] = [];
      lines.push(`❌ ${critical.length} critical issues found:\n`);

      for (const v of critical) {
        lines.push(`  ${v.file}:${v.line}`);
        lines.push(`    ${v.message}`);
        lines.push(`    Fix: ${v.fix}\n`);
      }

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});
