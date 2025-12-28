#!/usr/bin/env node

/**
 * Validates Durable Object design patterns
 * Checks for common anti-patterns and best practices
 */

const fs = require("fs");
const path = require("path");

// Anti-patterns to check
const antiPatterns = [
  {
    pattern: /constructor\s*\([^)]*\)\s*{(?![^}]*blockConcurrencyWhile)/s,
    message:
      "Missing blockConcurrencyWhile() in constructor - race condition risk",
    severity: "error",
  },
  {
    pattern: /await this\.state\.storage\.[^(]*\([^)]*\)[^;]*;/,
    message: "Storage operation without error handling",
    severity: "warning",
  },
  {
    pattern: /this\.[a-zA-Z]+\s*=\s*\[\]/,
    message: "Unbounded array accumulation - consider cleanup",
    severity: "warning",
  },
  {
    pattern: /setInterval|setTimeout/,
    message: "Using timer APIs - prefer setAlarm() in Durable Objects",
    severity: "error",
  },
];

// Required exports
const requiredExports = ["DurableObject"];

function validateDurableObject(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const errors = [];
  const warnings = [];

  // Check for DurableObject class
  if (!content.includes("export class")) {
    errors.push(
      "No exported class found - Durable Objects must export a class",
    );
    return { errors, warnings };
  }

  // Check for proper ID generation
  if (content.includes("idFromName") || content.includes("idFromString")) {
    // Good practice - uses proper ID management
  } else {
    warnings.push(
      "Consider using idFromName() or idFromString() for deterministic IDs",
    );
  }

  // Check anti-patterns
  antiPatterns.forEach(({ pattern, message, severity }) => {
    if (pattern.test(content)) {
      if (severity === "error") {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  });

  // Check for alarm usage in long-lived DOs
  if (content.includes("WebSocket") && !content.includes("setAlarm")) {
    warnings.push("WebSocket DOs should use setAlarm() for persistence");
  }

  // Check memory management
  if (content.includes("Map(") && !content.includes(".delete(")) {
    warnings.push("Map found without delete() - potential memory leak");
  }

  // Check for proper error handling in fetch
  if (content.includes("async fetch(") && !content.includes("try")) {
    warnings.push("fetch() method should include try/catch for error handling");
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
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(srcDir, f))
    .filter((f) => {
      const content = fs.readFileSync(f, "utf8");
      return (
        content.includes("DurableObject") || content.includes("export class")
      );
    });

  let hasErrors = false;

  files.forEach((file) => {
    const { errors, warnings } = validateDurableObject(file);

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
    console.log("\n✅ All Durable Objects passed validation");
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateDurableObject };
