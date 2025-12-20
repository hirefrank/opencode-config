import { tool } from "@opencode-ai/plugin";
import { $ } from "bun";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { truncateOutput, formatError } from "../lib/tool-utils";

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

// ============================================================================
// D1 Migration Validation
// ============================================================================

/**
 * Required fields for common tables (better-auth + Polar.sh patterns)
 */
const D1_REQUIRED_FIELDS: Record<
  string,
  {
    required: string[];
    recommended: string[];
    betterAuth?: string[];
    polar?: string[];
    description: string;
  }
> = {
  users: {
    required: ["id", "email", "created_at"],
    recommended: ["updated_at", "email_verified"],
    betterAuth: ["password_hash", "name", "image"],
    polar: ["polar_customer_id", "subscription_status"],
    description: "User accounts table (better-auth compatible)",
  },
  accounts: {
    required: ["id", "user_id", "provider", "provider_account_id"],
    recommended: ["access_token", "refresh_token", "expires_at", "created_at"],
    description: "OAuth accounts table (better-auth)",
  },
  sessions: {
    required: ["id", "user_id", "expires_at"],
    recommended: ["created_at"],
    description: "Sessions table (better-auth)",
  },
  subscriptions: {
    required: ["id", "status"],
    recommended: [
      "polar_customer_id",
      "product_id",
      "price_id",
      "current_period_start",
      "current_period_end",
    ],
    polar: ["canceled_at", "created_at", "updated_at"],
    description: "Subscriptions table (Polar.sh compatible)",
  },
  passkeys: {
    required: ["id", "user_id", "credential_id", "public_key"],
    recommended: ["counter", "created_at"],
    description: "Passkeys table (better-auth WebAuthn)",
  },
};

/**
 * Required indexes for performance
 */
const D1_REQUIRED_INDEXES: Record<
  string,
  { columns: string[]; reason: string; optional?: boolean }[]
> = {
  users: [
    { columns: ["email"], reason: "Login lookups by email" },
    {
      columns: ["polar_customer_id"],
      reason: "Polar webhook lookups",
      optional: true,
    },
  ],
  accounts: [
    { columns: ["user_id"], reason: "User account lookups" },
    {
      columns: ["provider", "provider_account_id"],
      reason: "OAuth provider lookups",
    },
  ],
  sessions: [
    { columns: ["user_id"], reason: "User session lookups" },
    {
      columns: ["expires_at"],
      reason: "Session expiration queries",
      optional: true,
    },
  ],
  subscriptions: [
    { columns: ["polar_customer_id"], reason: "Customer subscription lookups" },
    { columns: ["status"], reason: "Active subscription queries" },
  ],
};

/**
 * SQL anti-patterns specific to D1/SQLite
 */
interface D1SqlPattern {
  pattern: RegExp;
  severity: Severity;
  message: string;
  fix: string;
  isGood?: boolean;
}

const D1_SQL_ANTI_PATTERNS: D1SqlPattern[] = [
  {
    pattern: /SELECT\s+\*\s+FROM/gi,
    severity: "warning",
    message:
      "SELECT * can cause performance issues - specify columns explicitly",
    fix: "Replace SELECT * with specific column names",
  },
  {
    pattern: /VARCHAR\s*\(\s*\d+\s*\)/gi,
    severity: "info",
    message: "D1 uses TEXT type - VARCHAR is converted to TEXT",
    fix: "Use TEXT instead of VARCHAR for clarity",
  },
  {
    pattern: /AUTO_INCREMENT/gi,
    severity: "critical",
    message: "AUTO_INCREMENT is MySQL syntax - not supported in D1/SQLite",
    fix: "Use INTEGER PRIMARY KEY (auto-increments) or TEXT with UUID",
  },
  {
    pattern: /NOW\s*\(\s*\)/gi,
    severity: "critical",
    message: "NOW() is not supported in SQLite/D1",
    fix: "Use datetime('now') or pass timestamp from application",
  },
  {
    pattern: /CURRENT_TIMESTAMP\s+ON\s+UPDATE/gi,
    severity: "critical",
    message:
      "ON UPDATE CURRENT_TIMESTAMP is MySQL syntax - not supported in D1",
    fix: "Update timestamps in application code",
  },
  {
    pattern: /ENUM\s*\(/gi,
    severity: "critical",
    message: "ENUM type is not supported in D1/SQLite",
    fix: "Use TEXT with CHECK constraint or validate in application",
  },
  {
    pattern: /UNSIGNED/gi,
    severity: "warning",
    message: "UNSIGNED is not supported in SQLite/D1",
    fix: "Use CHECK constraint for non-negative values",
  },
  {
    pattern: /DROP\s+TABLE(?!\s+IF\s+EXISTS)/gi,
    severity: "warning",
    message: "DROP TABLE without IF EXISTS can fail if table does not exist",
    fix: "Use DROP TABLE IF EXISTS for safety",
  },
];

/**
 * D1 validation issue
 */
interface D1ValidationIssue {
  file: string;
  line?: number;
  table?: string;
  severity: Severity;
  message: string;
  fix: string;
  context?: string;
}

/**
 * Parsed SQL table
 */
interface ParsedTable {
  name: string;
  columns: { name: string; type: string }[];
  raw: string;
}

/**
 * Parsed SQL index
 */
interface ParsedIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

/**
 * Parse SQL content to extract tables and indexes
 */
function parseD1Sql(content: string): {
  tables: ParsedTable[];
  indexes: ParsedIndex[];
} {
  const tables: ParsedTable[] = [];
  const indexes: ParsedIndex[] = [];

  // Remove comments
  const cleanContent = content
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Split into statements
  const statements = cleanContent
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    // Parse CREATE TABLE
    const tableMatch = stmt.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]+)\)/i,
    );
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      const columnsStr = tableMatch[2];

      const columns: { name: string; type: string }[] = [];
      const lines = columnsStr.split(",");

      for (const line of lines) {
        const trimmed = line.trim();
        if (
          /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(
            trimmed,
          )
        ) {
          continue;
        }

        const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\w+)/i);
        if (colMatch) {
          columns.push({
            name: colMatch[1].toLowerCase(),
            type: colMatch[2].toUpperCase(),
          });
        }
      }

      tables.push({ name: tableName, columns, raw: stmt });
    }

    // Parse CREATE INDEX
    const indexMatch = stmt.match(
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s+ON\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i,
    );
    if (indexMatch) {
      const indexName = indexMatch[1];
      const tableName = indexMatch[2].toLowerCase();
      const columnsStr = indexMatch[3];
      const columns = columnsStr
        .split(",")
        .map((c) => c.trim().replace(/[`"']/g, "").toLowerCase());

      indexes.push({
        name: indexName,
        table: tableName,
        columns,
        unique: /UNIQUE/i.test(stmt),
      });
    }
  }

  return { tables, indexes };
}

/**
 * Validate SQL syntax for D1 anti-patterns
 */
function validateD1SqlSyntax(
  content: string,
  filePath: string,
): D1ValidationIssue[] {
  const issues: D1ValidationIssue[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const {
      pattern,
      severity,
      message,
      fix,
      isGood,
    } of D1_SQL_ANTI_PATTERNS) {
      if (isGood) continue;

      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(line)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          severity,
          message,
          fix,
        });
      }
    }
  }

  return issues;
}

/**
 * Validate required fields in tables
 */
function validateD1RequiredFields(
  tables: ParsedTable[],
  filePath: string,
): D1ValidationIssue[] {
  const issues: D1ValidationIssue[] = [];

  for (const table of tables) {
    const requirements = D1_REQUIRED_FIELDS[table.name];
    if (!requirements) continue;

    const columnNames = table.columns.map((c) => c.name);

    // Check required fields
    for (const field of requirements.required) {
      if (!columnNames.includes(field)) {
        issues.push({
          file: filePath,
          table: table.name,
          severity: "critical",
          message: `Missing required field '${field}' in ${table.name} table`,
          fix: `Add column: ${field} TEXT NOT NULL`,
          context: requirements.description,
        });
      }
    }

    // Check recommended fields
    for (const field of requirements.recommended) {
      if (!columnNames.includes(field)) {
        issues.push({
          file: filePath,
          table: table.name,
          severity: "warning",
          message: `Missing recommended field '${field}' in ${table.name} table`,
          fix: `Consider adding: ${field}`,
          context: requirements.description,
        });
      }
    }

    // Check better-auth fields
    if (table.name === "users" && requirements.betterAuth) {
      const hasBetterAuthFields = requirements.betterAuth.some((f) =>
        columnNames.includes(f),
      );
      if (!hasBetterAuthFields) {
        issues.push({
          file: filePath,
          table: table.name,
          severity: "info",
          message:
            "No better-auth fields detected (password_hash, name, image)",
          fix: "Add if using better-auth: password_hash TEXT, name TEXT, image TEXT",
          context: "better-auth integration",
        });
      }
    }

    // Check Polar fields
    if (table.name === "users" && requirements.polar) {
      const hasPolarFields = requirements.polar.some((f) =>
        columnNames.includes(f),
      );
      if (!hasPolarFields) {
        issues.push({
          file: filePath,
          table: table.name,
          severity: "info",
          message:
            "No Polar.sh fields detected (polar_customer_id, subscription_status)",
          fix: "Add if using Polar.sh: polar_customer_id TEXT UNIQUE, subscription_status TEXT",
          context: "Polar.sh billing integration",
        });
      }
    }
  }

  return issues;
}

/**
 * Validate required indexes
 */
function validateD1Indexes(
  tables: ParsedTable[],
  indexes: ParsedIndex[],
  filePath: string,
): D1ValidationIssue[] {
  const issues: D1ValidationIssue[] = [];

  // Build index map
  const indexMap = new Set<string>();
  for (const index of indexes) {
    const key = `${index.table}:${index.columns.sort().join(",")}`;
    indexMap.add(key);
    // Also add single-column keys
    for (const col of index.columns) {
      indexMap.add(`${index.table}:${col}`);
    }
  }

  // Check required indexes
  for (const [tableName, requiredIndexes] of Object.entries(
    D1_REQUIRED_INDEXES,
  )) {
    const table = tables.find((t) => t.name === tableName);
    if (!table) continue;

    for (const required of requiredIndexes) {
      const key = `${tableName}:${required.columns.sort().join(",")}`;
      const singleKey =
        required.columns.length === 1
          ? `${tableName}:${required.columns[0]}`
          : null;

      const found = indexMap.has(key) || (singleKey && indexMap.has(singleKey));

      if (!found) {
        const severity = required.optional ? "info" : "warning";
        const indexName = `idx_${tableName}_${required.columns.join("_")}`;
        const columnList = required.columns.join(", ");

        issues.push({
          file: filePath,
          table: tableName,
          severity,
          message: `Missing index on ${tableName}(${columnList}) - ${required.reason}`,
          fix: `CREATE INDEX ${indexName} ON ${tableName}(${columnList});`,
        });
      }
    }
  }

  return issues;
}

/**
 * Format D1 validation issues for output
 */
function formatD1ValidationIssues(issues: D1ValidationIssue[]): string {
  if (issues.length === 0) {
    return "✅ No D1 migration issues detected";
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  const lines: string[] = [];

  lines.push("# D1 Migration Validation Results\n");
  lines.push(`Total: ${issues.length} issues found`);
  lines.push(`  🔴 Critical: ${critical.length}`);
  lines.push(`  🟡 Warning: ${warnings.length}`);
  lines.push(`  🔵 Info: ${info.length}`);
  lines.push("");

  // Group by file
  const byFile = new Map<string, D1ValidationIssue[]>();
  for (const issue of issues) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }

  for (const [file, fileIssues] of byFile) {
    lines.push(`## ${file}\n`);

    for (const issue of fileIssues) {
      const icon =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "warning"
            ? "🟡"
            : "🔵";
      lines.push(`${icon} ${issue.message}`);
      if (issue.table) lines.push(`   Table: ${issue.table}`);
      if (issue.line) lines.push(`   Line: ${issue.line}`);
      lines.push(`   Fix: ${issue.fix}`);
      if (issue.context) lines.push(`   Context: ${issue.context}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * D1 migration validator tool
 */
export const validate_d1 = tool({
  description:
    "Validate D1 migration files and database patterns. Checks SQL syntax, required fields (better-auth, Polar.sh), indexes, and D1 anti-patterns. Run BEFORE deploying migrations.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe(
        "Path to migrations directory or SQL file (default: migrations/)",
      ),
    json: tool.schema
      .boolean()
      .optional()
      .describe("Output as JSON instead of formatted text"),
  },
  async execute({ path: targetPath, json }) {
    try {
      const scanPath = targetPath || "migrations";

      // Check if path exists
      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}. Create a migrations/ directory or specify a path.`;
      }

      // Find SQL files
      const pathStat = await stat(scanPath);
      let files: string[] = [];

      if (pathStat.isDirectory()) {
        const walkDir = async (dir: string): Promise<string[]> => {
          const result: string[] = [];
          const entries = await readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              if (
                !entry.name.startsWith(".") &&
                entry.name !== "node_modules"
              ) {
                result.push(...(await walkDir(fullPath)));
              }
            } else if (entry.name.endsWith(".sql")) {
              result.push(fullPath);
            }
          }

          return result;
        };

        files = await walkDir(scanPath);
      } else if (scanPath.endsWith(".sql")) {
        files = [scanPath];
      }

      if (files.length === 0) {
        return `No SQL files found in ${scanPath}`;
      }

      // Validate all files
      const allIssues: D1ValidationIssue[] = [];
      const allTables: ParsedTable[] = [];
      const allIndexes: ParsedIndex[] = [];

      for (const file of files) {
        const content = await readFile(file, "utf-8");
        const { tables, indexes } = parseD1Sql(content);

        allTables.push(...tables);
        allIndexes.push(...indexes);

        // Validate
        allIssues.push(...validateD1SqlSyntax(content, file));
        allIssues.push(...validateD1RequiredFields(tables, file));
        allIssues.push(...validateD1Indexes(tables, indexes, file));
      }

      // Check for too many migrations
      if (files.length > 20) {
        allIssues.push({
          file: scanPath,
          severity: "warning",
          message: `${files.length} migration files found - consider consolidating`,
          fix: "Combine related migrations to reduce deployment overhead",
        });
      }

      // Output
      if (json) {
        const result = {
          scanned: scanPath,
          filesScanned: files.length,
          timestamp: new Date().toISOString(),
          total: allIssues.length,
          critical: allIssues.filter((i) => i.severity === "critical").length,
          warnings: allIssues.filter((i) => i.severity === "warning").length,
          info: allIssues.filter((i) => i.severity === "info").length,
          issues: allIssues,
          tables: allTables.map((t) => ({
            name: t.name,
            columns: t.columns.map((c) => c.name),
          })),
          indexes: allIndexes.map((i) => ({
            name: i.name,
            table: i.table,
            columns: i.columns,
          })),
        };
        return truncateOutput(JSON.stringify(result, null, 2));
      }

      return truncateOutput(formatD1ValidationIssues(allIssues));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Quick D1 schema check - critical issues only
 */
export const check_d1 = tool({
  description:
    "Quick D1 schema check - reports only critical issues that will break in production. Use before deployment.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to migrations directory or SQL file"),
  },
  async execute({ path: targetPath }) {
    try {
      const scanPath = targetPath || "migrations";

      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      // Find SQL files
      const pathStat = await stat(scanPath);
      let files: string[] = [];

      if (pathStat.isDirectory()) {
        const walkDir = async (dir: string): Promise<string[]> => {
          const result: string[] = [];
          const entries = await readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              if (
                !entry.name.startsWith(".") &&
                entry.name !== "node_modules"
              ) {
                result.push(...(await walkDir(fullPath)));
              }
            } else if (entry.name.endsWith(".sql")) {
              result.push(fullPath);
            }
          }

          return result;
        };

        files = await walkDir(scanPath);
      } else if (scanPath.endsWith(".sql")) {
        files = [scanPath];
      }

      if (files.length === 0) {
        return `✅ No SQL files found in ${scanPath}`;
      }

      // Validate all files
      const allIssues: D1ValidationIssue[] = [];

      for (const file of files) {
        const content = await readFile(file, "utf-8");
        const { tables, indexes } = parseD1Sql(content);

        allIssues.push(...validateD1SqlSyntax(content, file));
        allIssues.push(...validateD1RequiredFields(tables, file));
        allIssues.push(...validateD1Indexes(tables, indexes, file));
      }

      const critical = allIssues.filter((i) => i.severity === "critical");

      if (critical.length === 0) {
        return `✅ D1 schema check passed (${files.length} files scanned)`;
      }

      const lines: string[] = [];
      lines.push(`❌ ${critical.length} critical issues found:\n`);

      for (const issue of critical) {
        lines.push(`  ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
        lines.push(`    ${issue.message}`);
        lines.push(`    Fix: ${issue.fix}\n`);
      }

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});

// ============================================================================
// KV Validation
// ============================================================================

/**
 * KV anti-patterns and validation rules
 */
interface KVPattern {
  pattern: RegExp;
  type: string;
  severity: Severity;
  message: string;
  fix: string;
  context: string;
}

const KV_PATTERNS: KVPattern[] = [
  // Missing TTL
  {
    pattern: /\.put\s*\(\s*[^,]+,\s*[^,)]+\s*\)(?!\s*[,;]?\s*\{)/,
    type: "missing-ttl",
    severity: "warning",
    message: "KV put() without options object - likely missing TTL",
    fix: "Add expirationTtl: await env.KV.put(key, value, { expirationTtl: 3600 })",
    context: "Data persists indefinitely without TTL, causing storage bloat",
  },

  // Rate Limiting Anti-Pattern
  {
    pattern: /rate[-_]?limit.*\.get\s*\(/i,
    type: "rate-limit-kv",
    severity: "critical",
    message: "Rate limiting with KV detected - KV is eventually consistent",
    fix: "Use Durable Objects for rate limiting - they provide strong consistency",
    context: "KV eventual consistency causes race conditions in rate limiting",
  },
  {
    pattern: /\.get\s*\([^)]*rate[-_]?limit/i,
    type: "rate-limit-kv",
    severity: "critical",
    message: "Rate limiting with KV detected - KV is eventually consistent",
    fix: "Use Durable Objects for rate limiting - they provide strong consistency",
    context: "Two concurrent requests can both pass the rate limit check",
  },

  // In-Memory State Anti-Patterns
  {
    pattern: /^(?:let|var)\s+\w*cache\w*\s*=\s*(?:new\s+Map|\{\})/im,
    type: "in-memory-cache",
    severity: "warning",
    message: "In-memory cache detected - will not persist between requests",
    fix: "Use KV for caching: await env.KV.put(key, value, { expirationTtl: 300 })",
    context: "Workers are stateless - in-memory state is lost between requests",
  },

  // PII in Keys
  {
    pattern:
      /\.(?:get|put|delete)\s*\(\s*['"`][^'"`]*(?:email|password|ssn|credit[-_]?card)[^'"`]*['"`]/i,
    type: "pii-in-key",
    severity: "critical",
    message: "Potential PII in KV key - keys are visible in logs and metrics",
    fix: "Hash PII before using as key: crypto.subtle.digest('SHA-256', data)",
    context: "KV keys appear in Cloudflare dashboard and logs",
  },

  // Non-Atomic Increment
  {
    pattern: /\.get\s*\([^)]+\)[^;]*\+\+|\.get\s*\([^)]+\)[^;]*\+\s*1/,
    type: "non-atomic-increment",
    severity: "critical",
    message: "Non-atomic increment pattern detected - race condition risk",
    fix: "Use Durable Objects for counters that need atomic operations",
    context:
      "get-modify-put is not atomic in KV - concurrent requests cause lost updates",
  },

  // Session Storage without TTL
  {
    pattern: /session.*\.put\s*\([^)]*\)(?![^}]*expirationTtl)/i,
    type: "session-no-ttl",
    severity: "warning",
    message: "Session storage without TTL - sessions should expire",
    fix: "Add TTL for sessions: { expirationTtl: 86400 } (24 hours)",
    context:
      "Sessions without TTL persist forever, causing security and storage issues",
  },
];

/**
 * KV validation issue
 */
interface KVValidationIssue {
  file: string;
  line: number;
  code: string;
  type: string;
  severity: Severity;
  message: string;
  fix: string;
  context: string;
}

/**
 * Scan file for KV issues
 */
async function scanFileForKVIssues(
  filePath: string,
): Promise<KVValidationIssue[]> {
  const issues: KVValidationIssue[] = [];

  try {
    const content = await readFile(filePath, "utf-8");

    // Quick filter - skip files without KV usage
    if (
      !/\.(?:get|put|delete|list)\s*\(|KVNamespace|env\.\w+KV/i.test(content)
    ) {
      return issues;
    }

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
        context,
      } of KV_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(line)) {
          issues.push({
            file: filePath,
            line: lineNumber,
            code: line.trim(),
            type,
            severity,
            message,
            fix,
            context,
          });
        }
      }
    }
  } catch {
    // File not readable
  }

  return issues;
}

/**
 * Format KV validation issues
 */
function formatKVValidationIssues(issues: KVValidationIssue[]): string {
  if (issues.length === 0) {
    return "✅ No KV issues detected";
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  const lines: string[] = [];

  lines.push("# KV Validation Results\n");
  lines.push(`Total: ${issues.length} issues found`);
  lines.push(`  🔴 Critical: ${critical.length}`);
  lines.push(`  🟡 Warning: ${warnings.length}`);
  lines.push(`  🔵 Info: ${info.length}`);
  lines.push("");

  // Group by file
  const byFile = new Map<string, KVValidationIssue[]>();
  for (const issue of issues) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }

  for (const [file, fileIssues] of byFile) {
    lines.push(`## ${file}\n`);

    for (const issue of fileIssues) {
      const icon =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "warning"
            ? "🟡"
            : "🔵";
      lines.push(`${icon} Line ${issue.line}: ${issue.message}`);
      lines.push(`   Code: \`${issue.code}\``);
      lines.push(`   Fix: ${issue.fix}`);
      lines.push(`   Context: ${issue.context}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * KV validator tool
 */
export const validate_kv = tool({
  description:
    "Validate Cloudflare KV usage patterns. Checks for missing TTL, rate limiting anti-patterns, PII in keys, non-atomic operations, and in-memory cache issues.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to scan (default: src)"),
    json: tool.schema
      .boolean()
      .optional()
      .describe("Output as JSON instead of formatted text"),
  },
  async execute({ path: targetPath, json }) {
    try {
      const scanPath = targetPath || "src";

      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      const files = await walkDirectory(scanPath);

      if (files.length === 0) {
        return `No TypeScript/JavaScript files found in ${scanPath}`;
      }

      const allIssues: KVValidationIssue[] = [];
      for (const file of files) {
        const issues = await scanFileForKVIssues(file);
        allIssues.push(...issues);
      }

      if (json) {
        const result = {
          scanned: scanPath,
          filesScanned: files.length,
          timestamp: new Date().toISOString(),
          total: allIssues.length,
          critical: allIssues.filter((i) => i.severity === "critical").length,
          warnings: allIssues.filter((i) => i.severity === "warning").length,
          info: allIssues.filter((i) => i.severity === "info").length,
          issues: allIssues,
        };
        return truncateOutput(JSON.stringify(result, null, 2));
      }

      return truncateOutput(formatKVValidationIssues(allIssues));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Quick KV check - critical issues only
 */
export const check_kv = tool({
  description:
    "Quick KV check - reports only critical issues (rate limiting, PII in keys, non-atomic ops). Use before deployment.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to check (default: src)"),
  },
  async execute({ path: targetPath }) {
    try {
      const scanPath = targetPath || "src";

      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      const files = await walkDirectory(scanPath);

      if (files.length === 0) {
        return `✅ No TypeScript/JavaScript files found in ${scanPath}`;
      }

      const allIssues: KVValidationIssue[] = [];
      for (const file of files) {
        const issues = await scanFileForKVIssues(file);
        allIssues.push(...issues);
      }

      const critical = allIssues.filter((i) => i.severity === "critical");

      if (critical.length === 0) {
        return `✅ KV check passed (${files.length} files scanned)`;
      }

      const lines: string[] = [];
      lines.push(`❌ ${critical.length} critical KV issues found:\n`);

      for (const issue of critical) {
        lines.push(`  ${issue.file}:${issue.line}`);
        lines.push(`    ${issue.message}`);
        lines.push(`    Fix: ${issue.fix}\n`);
      }

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});

// ============================================================================
// Secrets Validation
// ============================================================================

/**
 * Secret detection patterns
 */
interface SecretPattern {
  pattern: RegExp;
  type: string;
  severity: Severity;
  message: string;
  fix: string;
  context: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys
  {
    pattern: /['"`]sk[-_](?:live|test)[-_][a-zA-Z0-9]{20,}['"`]/,
    type: "stripe-key",
    severity: "critical",
    message: "Hardcoded Stripe API key detected",
    fix: "Use wrangler secret: wrangler secret put STRIPE_SECRET_KEY",
    context: "Stripe keys should never be in source code",
  },
  {
    pattern: /['"`](?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}['"`]/,
    type: "aws-key",
    severity: "critical",
    message: "Hardcoded AWS access key detected",
    fix: "Use wrangler secret: wrangler secret put AWS_ACCESS_KEY_ID",
    context: "AWS keys should never be in source code",
  },
  {
    pattern: /['"`]ghp_[a-zA-Z0-9]{36}['"`]/,
    type: "github-pat",
    severity: "critical",
    message: "Hardcoded GitHub Personal Access Token detected",
    fix: "Use wrangler secret: wrangler secret put GITHUB_TOKEN",
    context: "GitHub PATs should never be in source code",
  },
  {
    pattern: /['"`]gho_[a-zA-Z0-9]{36}['"`]/,
    type: "github-oauth",
    severity: "critical",
    message: "Hardcoded GitHub OAuth token detected",
    fix: "Use wrangler secret: wrangler secret put GITHUB_OAUTH_TOKEN",
    context: "OAuth tokens should never be in source code",
  },
  {
    pattern: /['"`]xox[baprs]-[a-zA-Z0-9-]{10,}['"`]/,
    type: "slack-token",
    severity: "critical",
    message: "Hardcoded Slack token detected",
    fix: "Use wrangler secret: wrangler secret put SLACK_TOKEN",
    context: "Slack tokens should never be in source code",
  },

  // Database Credentials
  {
    pattern:
      /['"`](?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^'"`]+:[^'"`]+@[^'"`]+['"`]/i,
    type: "database-url",
    severity: "critical",
    message: "Hardcoded database connection string with credentials",
    fix: "Use wrangler secret: wrangler secret put DATABASE_URL",
    context: "Database credentials should never be in source code",
  },
  {
    pattern: /password\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    type: "password",
    severity: "critical",
    message: "Hardcoded password detected",
    fix: "Use wrangler secret for passwords",
    context: "Passwords should never be in source code",
  },

  // Generic Secrets
  {
    pattern:
      /(?:api[-_]?key|apikey|secret[-_]?key|auth[-_]?token)\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    type: "generic-secret",
    severity: "critical",
    message: "Hardcoded API key or secret detected",
    fix: "Use wrangler secret: wrangler secret put <SECRET_NAME>",
    context: "API keys and secrets should never be in source code",
  },

  // OAuth/Auth Secrets
  {
    pattern: /client[-_]?secret\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    type: "oauth-secret",
    severity: "critical",
    message: "Hardcoded OAuth client secret detected",
    fix: "Use wrangler secret: wrangler secret put OAUTH_CLIENT_SECRET",
    context: "OAuth secrets should never be in source code",
  },
  {
    pattern: /jwt[-_]?secret\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    type: "jwt-secret",
    severity: "critical",
    message: "Hardcoded JWT secret detected",
    fix: "Use wrangler secret: wrangler secret put JWT_SECRET",
    context: "JWT secrets should never be in source code",
  },

  // Cloudflare-Specific
  {
    pattern: /['"`](?:cf|cloudflare)[-_]?[a-zA-Z0-9]{32,}['"`]/i,
    type: "cloudflare-token",
    severity: "critical",
    message: "Potential Cloudflare API token detected",
    fix: "Use wrangler secret: wrangler secret put CF_API_TOKEN",
    context: "Cloudflare tokens should never be in source code",
  },

  // Fallback secrets
  {
    pattern: /env\.\w+\s*\|\|\s*['"`][^'"`]{10,}['"`]/,
    type: "fallback-secret",
    severity: "warning",
    message: "Secret with hardcoded fallback value",
    fix: "Remove fallback - secrets should fail explicitly if missing",
    context: "Fallback values for secrets can mask configuration errors",
  },
];

/**
 * Secrets validation issue
 */
interface SecretsValidationIssue {
  file: string;
  line: number;
  code?: string;
  type: string;
  severity: Severity;
  message: string;
  fix: string;
  context: string;
}

/**
 * Scan file for secret issues
 */
async function scanFileForSecrets(
  filePath: string,
): Promise<SecretsValidationIssue[]> {
  const issues: SecretsValidationIssue[] = [];
  const basename = filePath.split("/").pop() || "";

  // Skip lock files
  if (
    ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"].includes(
      basename,
    )
  ) {
    return issues;
  }

  // Special handling for .env files
  if (basename.startsWith(".env")) {
    issues.push({
      file: filePath,
      line: 0,
      type: "env-file",
      severity: "warning",
      message: ".env file detected - ensure it's in .gitignore",
      fix: "Add .env* to .gitignore and use wrangler secret for production",
      context: ".env files should not be committed to git",
    });
    return issues;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Skip comments
      if (
        line.trim().startsWith("//") ||
        line.trim().startsWith("*") ||
        line.trim().startsWith("#")
      ) {
        continue;
      }

      for (const {
        pattern,
        type,
        severity,
        message,
        fix,
        context,
      } of SECRET_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(line)) {
          issues.push({
            file: filePath,
            line: lineNumber,
            code:
              line.trim().substring(0, 100) +
              (line.trim().length > 100 ? "..." : ""),
            type,
            severity,
            message,
            fix,
            context,
          });
        }
      }
    }
  } catch {
    // File not readable
  }

  return issues;
}

/**
 * Format secrets validation issues
 */
function formatSecretsValidationIssues(
  issues: SecretsValidationIssue[],
): string {
  if (issues.length === 0) {
    return "✅ No secret issues detected";
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  const lines: string[] = [];

  lines.push("# Secrets Validation Results\n");
  lines.push(`Total: ${issues.length} issues found`);
  lines.push(`  🔴 Critical: ${critical.length}`);
  lines.push(`  🟡 Warning: ${warnings.length}`);
  lines.push(`  🔵 Info: ${info.length}`);
  lines.push("");

  // Group by severity
  if (critical.length > 0) {
    lines.push("## 🔴 CRITICAL Issues\n");
    for (const issue of critical) {
      lines.push(`${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      lines.push(`  ${issue.message}`);
      if (issue.code) lines.push(`  Code: ${issue.code}`);
      lines.push(`  Fix: ${issue.fix}`);
      lines.push("");
    }
  }

  if (warnings.length > 0) {
    lines.push("## 🟡 Warnings\n");
    for (const issue of warnings) {
      lines.push(`${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      lines.push(`  ${issue.message}`);
      if (issue.fix) lines.push(`  Fix: ${issue.fix}`);
      lines.push("");
    }
  }

  if (info.length > 0) {
    lines.push("## 🔵 Info\n");
    for (const issue of info) {
      lines.push(`${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      lines.push(`  ${issue.message}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Secrets validator tool
 */
export const validate_secrets = tool({
  description:
    "Scan for hardcoded secrets: API keys (Stripe, AWS, GitHub), database URLs, passwords, OAuth secrets, JWT secrets. Run BEFORE committing.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to scan (default: src)"),
    json: tool.schema
      .boolean()
      .optional()
      .describe("Output as JSON instead of formatted text"),
  },
  async execute({ path: targetPath, json }) {
    try {
      const scanPath = targetPath || "src";

      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      // Walk directory including .env files
      const walkWithEnv = async (dir: string): Promise<string[]> => {
        const files: string[] = [];

        try {
          const entries = await readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
              if (
                !SKIP_DIRS.includes(entry.name) &&
                !entry.name.startsWith(".")
              ) {
                files.push(...(await walkWithEnv(fullPath)));
              }
            } else if (entry.isFile()) {
              const ext = extname(entry.name);
              if (
                WORKERS_SCAN_EXTENSIONS.includes(ext) ||
                ext === ".json" ||
                entry.name.startsWith(".env")
              ) {
                files.push(fullPath);
              }
            }
          }
        } catch {
          // Directory not accessible
        }

        return files;
      };

      const files = await walkWithEnv(scanPath);

      if (files.length === 0) {
        return `No scannable files found in ${scanPath}`;
      }

      const allIssues: SecretsValidationIssue[] = [];
      for (const file of files) {
        const issues = await scanFileForSecrets(file);
        allIssues.push(...issues);
      }

      if (json) {
        const result = {
          scanned: scanPath,
          filesScanned: files.length,
          timestamp: new Date().toISOString(),
          total: allIssues.length,
          critical: allIssues.filter((i) => i.severity === "critical").length,
          warnings: allIssues.filter((i) => i.severity === "warning").length,
          info: allIssues.filter((i) => i.severity === "info").length,
          issues: allIssues,
        };
        return truncateOutput(JSON.stringify(result, null, 2));
      }

      return truncateOutput(formatSecretsValidationIssues(allIssues));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Quick secrets check - critical issues only
 */
export const check_secrets = tool({
  description:
    "Quick secrets check - reports only critical issues (hardcoded API keys, passwords, tokens). Use before committing.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to check (default: src)"),
  },
  async execute({ path: targetPath }) {
    try {
      const scanPath = targetPath || "src";

      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      // Walk directory including .env files
      const walkWithEnv = async (dir: string): Promise<string[]> => {
        const files: string[] = [];

        try {
          const entries = await readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
              if (
                !SKIP_DIRS.includes(entry.name) &&
                !entry.name.startsWith(".")
              ) {
                files.push(...(await walkWithEnv(fullPath)));
              }
            } else if (entry.isFile()) {
              const ext = extname(entry.name);
              if (
                WORKERS_SCAN_EXTENSIONS.includes(ext) ||
                ext === ".json" ||
                entry.name.startsWith(".env")
              ) {
                files.push(fullPath);
              }
            }
          }
        } catch {
          // Directory not accessible
        }

        return files;
      };

      const files = await walkWithEnv(scanPath);

      if (files.length === 0) {
        return `✅ No scannable files found in ${scanPath}`;
      }

      const allIssues: SecretsValidationIssue[] = [];
      for (const file of files) {
        const issues = await scanFileForSecrets(file);
        allIssues.push(...issues);
      }

      const critical = allIssues.filter((i) => i.severity === "critical");

      if (critical.length === 0) {
        return `✅ Secrets check passed (${files.length} files scanned)`;
      }

      const lines: string[] = [];
      lines.push(`❌ ${critical.length} hardcoded secrets found:\n`);

      for (const issue of critical) {
        lines.push(`  ${issue.file}:${issue.line}`);
        lines.push(`    ${issue.message}`);
        lines.push(`    Fix: ${issue.fix}\n`);
      }

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});
