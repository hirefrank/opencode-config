#!/usr/bin/env node
/**
 * Secrets Validator
 *
 * Validates secret handling patterns in Cloudflare Workers code.
 * This is a "Hard Tool" - deterministic grep-based detection that never misses.
 *
 * Checks for:
 * - Hardcoded secrets in code files (API keys, tokens, passwords)
 * - Proper usage of 'env' parameter for secrets
 * - Presence of required secrets in wrangler.toml example
 *
 * Usage:
 *   node validate-secrets.js [directory]
 *   node validate-secrets.js src/
 *
 * Output:
 *   JSON with validation results
 */

const fs = require("fs");
const path = require("path");

// ============================================================================
// Secret Patterns (High-Entropy Detection)
// ============================================================================

const SECRET_PATTERNS = [
  // ============ API Keys ============
  {
    pattern: /['"`]sk[-_](?:live|test)[-_][a-zA-Z0-9]{20,}['"`]/,
    type: "stripe-key",
    severity: "critical",
    message: "Hardcoded Stripe API key detected",
    fix: "Use wrangler secret: wrangler secret put STRIPE_SECRET_KEY",
    context: "Stripe keys should never be in source code",
  },
  {
    pattern: /['"`]pk[-_](?:live|test)[-_][a-zA-Z0-9]{20,}['"`]/,
    type: "stripe-publishable-key",
    severity: "warning",
    message: "Hardcoded Stripe publishable key - consider using env",
    fix: "While publishable keys are public, use env.STRIPE_PUBLISHABLE_KEY for consistency",
    context: "Publishable keys are safe to expose but env vars are cleaner",
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
  {
    pattern: /['"`](?:bearer|token)\s+[a-zA-Z0-9_-]{20,}['"`]/i,
    type: "bearer-token",
    severity: "warning",
    message: "Potential hardcoded bearer token detected",
    fix: "Use wrangler secret for API tokens",
    context: "Bearer tokens should be stored as secrets",
  },

  // ============ Database Credentials ============
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

  // ============ API Secrets ============
  {
    pattern: /['"`][a-f0-9]{32}['"`]/,
    type: "hex-secret",
    severity: "info",
    message: "32-character hex string - may be an API key or hash",
    fix: "If this is a secret, use wrangler secret",
    context: "Review if this is a secret that should be in env",
  },
  {
    pattern: /['"`][A-Za-z0-9+/]{40,}={0,2}['"`]/,
    type: "base64-secret",
    severity: "info",
    message: "Long base64 string - may be an encoded secret",
    fix: "If this is a secret, use wrangler secret",
    context: "Review if this is a secret that should be in env",
  },
  {
    pattern:
      /(?:api[-_]?key|apikey|secret[-_]?key|auth[-_]?token)\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    type: "generic-secret",
    severity: "critical",
    message: "Hardcoded API key or secret detected",
    fix: "Use wrangler secret: wrangler secret put <SECRET_NAME>",
    context: "API keys and secrets should never be in source code",
  },

  // ============ OAuth/Auth Secrets ============
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

  // ============ Cloudflare-Specific ============
  {
    pattern: /['"`](?:cf|cloudflare)[-_]?[a-zA-Z0-9]{32,}['"`]/i,
    type: "cloudflare-token",
    severity: "critical",
    message: "Potential Cloudflare API token detected",
    fix: "Use wrangler secret: wrangler secret put CF_API_TOKEN",
    context: "Cloudflare tokens should never be in source code",
  },

  // ============ process.env Usage ============
  {
    pattern: /process\.env\./,
    type: "process-env",
    severity: "critical",
    message: "process.env not available in Workers runtime",
    fix: "Use env parameter: export default { fetch(request, env) { env.MY_SECRET } }",
    context: "Workers use env parameter, not process.env",
  },

  // ============ Env Interface Issues ============
  {
    pattern: /env\.\w+\s*\|\|\s*['"`][^'"`]{10,}['"`]/,
    type: "fallback-secret",
    severity: "warning",
    message: "Secret with hardcoded fallback value",
    fix: "Remove fallback - secrets should fail explicitly if missing",
    context: "Fallback values for secrets can mask configuration errors",
  },
];

// ============================================================================
// Wrangler.toml Validation
// ============================================================================

const COMMON_SECRETS = [
  { name: "API_KEY", description: "Generic API key" },
  { name: "DATABASE_URL", description: "Database connection string" },
  { name: "JWT_SECRET", description: "JWT signing secret" },
  { name: "OAUTH_CLIENT_SECRET", description: "OAuth client secret" },
  { name: "STRIPE_SECRET_KEY", description: "Stripe API key" },
  { name: "GITHUB_TOKEN", description: "GitHub API token" },
  { name: "AUTH_SECRET", description: "better-auth secret" },
];

function checkWranglerToml(dirPath) {
  const issues = [];
  const wranglerPath = path.join(dirPath, "wrangler.toml");
  const wranglerExamplePath = path.join(dirPath, "wrangler.toml.example");

  // Check if wrangler.toml exists
  if (!fs.existsSync(wranglerPath)) {
    return issues; // Not a Workers project
  }

  const content = fs.readFileSync(wranglerPath, "utf-8");

  // Check for secrets in wrangler.toml (they should NOT be there)
  for (const { pattern, type, message, fix } of SECRET_PATTERNS) {
    if (type === "process-env" || type === "fallback-secret") continue;

    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(content)) {
      issues.push({
        file: wranglerPath,
        line: 0,
        type: "secret-in-config",
        severity: "critical",
        message: `${message} in wrangler.toml`,
        fix: "Remove from wrangler.toml and use: wrangler secret put <NAME>",
        context:
          "wrangler.toml is committed to git - secrets should use wrangler secret",
      });
    }
  }

  // Check for [vars] section with potential secrets
  const varsMatch = content.match(/\[vars\]([\s\S]*?)(?=\[|$)/);
  if (varsMatch) {
    const varsSection = varsMatch[1];
    const secretKeywords = /(?:secret|key|token|password|auth|api[-_]?key)/i;

    const lines = varsSection.split("\n");
    for (const line of lines) {
      if (secretKeywords.test(line) && line.includes("=")) {
        issues.push({
          file: wranglerPath,
          line: 0,
          type: "secret-in-vars",
          severity: "warning",
          message: `Potential secret in [vars] section: ${line.trim()}`,
          fix: "Move to wrangler secret: wrangler secret put <NAME>",
          context:
            "[vars] are visible in wrangler.toml - use secrets for sensitive data",
        });
      }
    }
  }

  // Check for wrangler.toml.example with documented secrets
  if (fs.existsSync(wranglerExamplePath)) {
    issues.push({
      file: wranglerExamplePath,
      line: 0,
      type: "example-exists",
      severity: "info",
      message:
        "wrangler.toml.example found - good practice for documenting required secrets",
      fix: null,
      context: "Example files help developers know which secrets to configure",
    });
  }

  return issues;
}

// ============================================================================
// File Scanning
// ============================================================================

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".env"];
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".wrangler"];
const SKIP_FILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
];

function scanFile(filePath) {
  const violations = [];
  const basename = path.basename(filePath);

  // Skip lock files
  if (SKIP_FILES.includes(basename)) {
    return violations;
  }

  // Special handling for .env files
  if (basename.startsWith(".env")) {
    violations.push({
      file: filePath,
      line: 0,
      type: "env-file",
      severity: "warning",
      message: ".env file detected - ensure it's in .gitignore",
      fix: "Add .env* to .gitignore and use wrangler secret for production",
      context: ".env files should not be committed to git",
    });
    return violations;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Skip comments
    if (
      line.trim().startsWith("//") ||
      line.trim().startsWith("*") ||
      line.trim().startsWith("#")
    ) {
      return;
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
        violations.push({
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
      } else {
        const ext = path.extname(entry);
        if (SCAN_EXTENSIONS.includes(ext) || entry.startsWith(".env")) {
          violations.push(...scanFile(fullPath));
        }
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

  lines.push("# Secrets Validation Results\n");
  lines.push(`Scanned: ${result.scanned}`);
  lines.push(`Files: ${result.filesScanned}`);
  lines.push(
    `Issues: ${result.total} (${result.critical} critical, ${result.warnings} warnings, ${result.info} info)\n`,
  );

  if (result.violations.length === 0) {
    lines.push("No secret issues found");
    return lines.join("\n");
  }

  // Group by severity
  const critical = result.violations.filter((v) => v.severity === "critical");
  const warnings = result.violations.filter((v) => v.severity === "warning");
  const info = result.violations.filter((v) => v.severity === "info");

  if (critical.length > 0) {
    lines.push("## CRITICAL Issues\n");
    for (const v of critical) {
      lines.push(`File: ${v.file}${v.line ? `:${v.line}` : ""}`);
      lines.push(`  ${v.message}`);
      if (v.code) lines.push(`  Code: ${v.code}`);
      lines.push(`  Fix: ${v.fix}`);
      lines.push("");
    }
  }

  if (warnings.length > 0) {
    lines.push("## Warnings\n");
    for (const v of warnings) {
      lines.push(`File: ${v.file}${v.line ? `:${v.line}` : ""}`);
      lines.push(`  ${v.message}`);
      if (v.fix) lines.push(`  Fix: ${v.fix}`);
      lines.push("");
    }
  }

  if (info.length > 0) {
    lines.push("## Info\n");
    for (const v of info) {
      lines.push(`File: ${v.file}${v.line ? `:${v.line}` : ""}`);
      lines.push(`  ${v.message}`);
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
  let checkWrangler = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      outputFormat = args[i + 1];
      i++;
    } else if (args[i] === "--no-wrangler") {
      checkWrangler = false;
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
      } else {
        const ext = path.extname(entry);
        if (SCAN_EXTENSIONS.includes(ext) || entry.startsWith(".env")) {
          filesScanned++;
        }
      }
    }
  }
  countFiles(targetPath);

  // Run validation
  const violations = scanDirectory(targetPath);

  // Check wrangler.toml if in project root
  if (checkWrangler) {
    const projectRoot = fs.statSync(targetPath).isDirectory()
      ? targetPath
      : path.dirname(targetPath);
    violations.push(...checkWranglerToml(projectRoot));
  }

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
