#!/usr/bin/env node

/**
 * Validates Cloudflare Workers runtime compatibility
 * Checks for forbidden Node.js APIs and ensures proper patterns
 */

const fs = require("fs");
const path = require("path");

// Forbidden Node.js APIs
const forbiddenApis = [
  "fs",
  "path",
  "process",
  "buffer",
  "Buffer",
  "require",
  "module",
  "exports",
  "__dirname",
  "child_process",
  "cluster",
  "crypto",
  "os",
  "util",
];

// Forbidden patterns
const forbiddenPatterns = [
  /process\.env/,
  /require\s*\(/,
  /module\.exports/,
  /__dirname/,
  /__filename/,
  /Buffer\.from/,
  /new Buffer\s*\(/,
];

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const errors = [];
  const warnings = [];

  // Check for forbidden APIs
  forbiddenApis.forEach((api) => {
    const regex = new RegExp(`\\b${api}\\b`, "g");
    if (regex.test(content)) {
      errors.push(`Found forbidden Node.js API: ${api}`);
    }
  });

  // Check for forbidden patterns
  forbiddenPatterns.forEach((pattern) => {
    if (pattern.test(content)) {
      errors.push(`Found forbidden pattern: ${pattern.source}`);
    }
  });

  // Check for proper env usage
  if (content.includes("env.") && !content.includes("env: Env")) {
    warnings.push("Using env parameter but Env interface not defined");
  }

  return { errors, warnings };
}

function main() {
  const srcDir = path.join(process.cwd(), "src");
  if (!fs.existsSync(srcDir)) {
    console.log("No src/ directory found");
    process.exit(0);
  }

  const files = fs
    .readdirSync(srcDir, { recursive: true })
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .map((f) => path.join(srcDir, f));

  let hasErrors = false;

  files.forEach((file) => {
    const { errors, warnings } = validateFile(file);

    if (errors.length > 0) {
      console.log(`\n❌ ${file}:`);
      errors.forEach((e) => console.log(`   - ${e}`));
      hasErrors = true;
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  ${file}:`);
      warnings.forEach((w) => console.log(`   - ${w}`));
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✅ ${file}`);
    }
  });

  if (hasErrors) {
    console.log("\n❌ Validation failed - fix errors before deploying");
    process.exit(1);
  } else {
    console.log("\n✅ All files passed validation");
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateFile };
