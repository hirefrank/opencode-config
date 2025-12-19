#!/usr/bin/env node
/**
 * KV Validator
 *
 * Validates Cloudflare KV usage patterns in Workers code.
 * This is a "Hard Tool" - deterministic grep-based detection that never misses.
 *
 * Checks for:
 * - TTL usage in .put() calls (missing expirationTtl)
 * - State management anti-patterns (in-memory caches, rate limiting with KV)
 * - Key naming conventions (consistent prefixes, no PII in keys)
 *
 * Usage:
 *   node validate-kv.js [directory]
 *   node validate-kv.js src/
 *
 * Output:
 *   JSON with validation results
 */

const fs = require("fs");
const path = require("path");

// ============================================================================
// KV Anti-Patterns
// ============================================================================

const KV_PATTERNS = [
  // ============ Missing TTL ============
  {
    pattern: /\.put\s*\(\s*[^,]+,\s*[^,)]+\s*\)(?!\s*[,;]?\s*\{)/,
    type: "missing-ttl",
    severity: "warning",
    message: "KV put() without options object - likely missing TTL",
    fix: "Add expirationTtl: await env.KV.put(key, value, { expirationTtl: 3600 })",
    context: "Data persists indefinitely without TTL, causing storage bloat",
  },
  {
    pattern: /\.put\s*\([^)]*\{[^}]*\}[^)]*\)(?![^}]*expirationTtl)/,
    type: "missing-ttl",
    severity: "warning",
    message: "KV put() with options but no expirationTtl",
    fix: "Add expirationTtl to options: { expirationTtl: 3600 }",
    context: "Consider if this data should expire",
  },

  // ============ Rate Limiting Anti-Pattern ============
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

  // ============ In-Memory State Anti-Patterns ============
  {
    pattern: /^(?:let|var)\s+\w*cache\w*\s*=\s*(?:new\s+Map|\{\})/im,
    type: "in-memory-cache",
    severity: "warning",
    message: "In-memory cache detected - will not persist between requests",
    fix: "Use KV for caching: await env.KV.put(key, value, { expirationTtl: 300 })",
    context: "Workers are stateless - in-memory state is lost between requests",
  },
  {
    pattern: /^const\s+\w*cache\w*\s*=\s*new\s+Map/im,
    type: "in-memory-cache",
    severity: "warning",
    message: "In-memory Map cache detected - will not persist between requests",
    fix: "Use Cache API for ephemeral caching or KV for persistent caching",
    context: "Workers are stateless - use bindings for state",
  },

  // ============ Key Naming Issues ============
  {
    pattern:
      /\.(?:get|put|delete)\s*\(\s*['"`][^'"`]*(?:email|password|ssn|credit[-_]?card)[^'"`]*['"`]/i,
    type: "pii-in-key",
    severity: "critical",
    message: "Potential PII in KV key - keys are visible in logs and metrics",
    fix: "Hash PII before using as key: crypto.subtle.digest('SHA-256', data)",
    context: "KV keys appear in Cloudflare dashboard and logs",
  },
  {
    pattern: /\.(?:get|put|delete)\s*\(\s*['"`][a-z0-9]+['"`]\s*[,)]/i,
    type: "missing-prefix",
    severity: "info",
    message:
      "KV key without namespace prefix - consider adding prefix for organization",
    fix: "Use prefixed keys: 'user:123', 'session:abc', 'cache:page:home'",
    context: "Prefixes help organize keys and enable bulk operations",
  },

  // ============ Missing Await ============
  {
    pattern: /(?<!await\s)env\.\w+\.get\s*\([^)]+\)\s*[;,\n]/,
    type: "missing-await-get",
    severity: "critical",
    message: "KV get() without await - returns Promise, not value",
    fix: "Add await: const value = await env.KV.get(key)",
    context: "Without await, you get a Promise object instead of the value",
  },
  {
    pattern: /(?<!await\s)env\.\w+\.put\s*\([^)]+\)\s*[;,\n]/,
    type: "missing-await-put",
    severity: "critical",
    message:
      "KV put() without await - operation may not complete before response",
    fix: "Add await: await env.KV.put(key, value)",
    context:
      "Without await, the write may not complete before the Worker returns",
  },
  {
    pattern: /(?<!await\s)env\.\w+\.delete\s*\([^)]+\)\s*[;,\n]/,
    type: "missing-await-delete",
    severity: "warning",
    message: "KV delete() without await - operation may not complete",
    fix: "Add await: await env.KV.delete(key)",
    context:
      "Without await, the delete may not complete before the Worker returns",
  },

  // ============ Large Value Patterns ============
  {
    pattern: /JSON\.stringify\s*\([^)]*\)\s*[^;]*\.put/,
    type: "large-json",
    severity: "info",
    message: "Storing JSON in KV - ensure value is under 25MB limit",
    fix: "For large objects, consider R2 storage instead of KV",
    context: "KV has 25MB value limit; R2 is better for large objects",
  },

  // ============ Atomic Operation Anti-Patterns ============
  {
    pattern: /\.get\s*\([^)]+\)[^;]*\+\+|\.get\s*\([^)]+\)[^;]*\+\s*1/,
    type: "non-atomic-increment",
    severity: "critical",
    message: "Non-atomic increment pattern detected - race condition risk",
    fix: "Use Durable Objects for counters that need atomic operations",
    context:
      "get-modify-put is not atomic in KV - concurrent requests cause lost updates",
  },

  // ============ Session Storage Patterns ============
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

// File extensions to scan
const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

// Directories to skip
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".wrangler"];

// ============================================================================
// Scanning Functions
// ============================================================================

function scanFile(filePath) {
  const violations = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Check if file likely uses KV (quick filter)
  const hasKvUsage =
    /\.(?:get|put|delete|list)\s*\(|KVNamespace|env\.\w+KV/i.test(content);
  if (!hasKvUsage) {
    return violations;
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

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
        violations.push({
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
  });

  return violations;
}

function scanDirectory(dirPath) {
  const violations = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.includes(entry) && !entry.startsWith(".")) {
          walk(fullPath);
        }
      } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        violations.push(...scanFile(fullPath));
      }
    }
  }

  walk(dirPath);
  return violations;
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatHumanReadable(result) {
  const lines = [];

  lines.push("# KV Validation Results\n");
  lines.push(`Scanned: ${result.scanned}`);
  lines.push(`Files: ${result.filesScanned}`);
  lines.push(
    `Issues: ${result.total} (${result.critical} critical, ${result.warnings} warnings, ${result.info} info)\n`,
  );

  if (result.violations.length === 0) {
    lines.push("No KV issues found");
    return lines.join("\n");
  }

  // Group by file
  const byFile = new Map();
  for (const v of result.violations) {
    const existing = byFile.get(v.file) || [];
    existing.push(v);
    byFile.set(v.file, existing);
  }

  for (const [file, fileViolations] of byFile) {
    lines.push(`## ${file}\n`);

    for (const v of fileViolations) {
      const icon =
        v.severity === "critical"
          ? "CRITICAL"
          : v.severity === "warning"
            ? "WARNING"
            : "INFO";
      lines.push(`${icon} Line ${v.line}: ${v.message}`);
      lines.push(`   Code: ${v.code}`);
      lines.push(`   Fix: ${v.fix}`);
      if (v.context) lines.push(`   Context: ${v.context}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  let targetPath = "src";
  let outputFormat = "json";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      outputFormat = args[i + 1];
      i++;
    } else if (!args[i].startsWith("-")) {
      targetPath = args[i];
    }
  }

  // Check if path exists
  if (!fs.existsSync(targetPath)) {
    const error = {
      error: `Path not found: ${targetPath}`,
      scanned: targetPath,
      timestamp: new Date().toISOString(),
      total: 0,
      violations: [],
    };
    console.log(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  // Count files
  let filesScanned = 0;
  function countFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.includes(entry) && !entry.startsWith(".")) {
          countFiles(fullPath);
        }
      } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        filesScanned++;
      }
    }
  }
  countFiles(targetPath);

  // Run validation
  const violations = scanDirectory(targetPath);

  const result = {
    scanned: targetPath,
    timestamp: new Date().toISOString(),
    filesScanned,
    total: violations.length,
    critical: violations.filter((v) => v.severity === "critical").length,
    warnings: violations.filter((v) => v.severity === "warning").length,
    info: violations.filter((v) => v.severity === "info").length,
    violations,
  };

  // Output
  if (outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatHumanReadable(result));
  }

  // Exit with error code if critical violations found
  if (result.critical > 0) {
    process.exit(1);
  }
}

main();
