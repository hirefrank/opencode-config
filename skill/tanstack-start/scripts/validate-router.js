#!/usr/bin/env node

/**
 * Validates Tanstack Start routing and patterns
 * Checks for proper route structure, loaders, and server functions
 */

const fs = require("fs");
const path = require("path");

function validateRoute(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const errors = [];
  const warnings = [];

  // Check for createFileRoute usage
  if (!content.includes("createFileRoute")) {
    errors.push(
      "Missing createFileRoute - Tanstack routes must use createFileRoute",
    );
    return { errors, warnings };
  }

  // Check for loader when useLoaderData is present
  if (content.includes("useLoaderData") && !content.includes("loader:")) {
    warnings.push(
      "useLoaderData found but no loader defined - add loader for data",
    );
  }

  // Check for API calls in components (should be in loader)
  const apiCalls = content.match(/fetch\s*\(/g);
  if (apiCalls && apiCalls.length > 0) {
    if (
      !content.includes("loader:") &&
      !content.includes("createServerFunction")
    ) {
      warnings.push(
        "API calls in component should move to loader or server function",
      );
    }
  }

  // Check for proper error boundaries
  if (content.includes("loader:") && !content.includes("ErrorBoundary")) {
    warnings.push("Route with loader should include ErrorBoundary");
  }

  // Check for proper navigation
  if (content.includes("window.location")) {
    errors.push("Found window.location - use router.navigate() instead");
  }

  return { errors, warnings };
}

function validateServerFunction(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const errors = [];
  const warnings = [];

  // Check for createServerFunction
  if (!content.includes("createServerFunction")) {
    errors.push("Server functions must use createServerFunction");
  }

  // Check for proper HTTP method
  if (content.includes("createServerFunction")) {
    const match = content.match(/createServerFunction\s*\(\s*['"]([^'"]+)['"]/);
    if (!match) {
      errors.push(
        "createServerFunction must specify HTTP method (GET, POST, etc.)",
      );
    }
  }

  // Check for Node.js APIs
  if (content.includes("process.env")) {
    warnings.push("Use env parameter instead of process.env in Workers");
  }

  return { errors, warnings };
}

function main() {
  const srcDir = path.join(process.cwd(), "app");
  if (!fs.existsSync(srcDir)) {
    console.log("No app/ directory found (Tanstack Start uses app/, not src/)");
    process.exit(0);
  }

  const files = fs
    .readdirSync(srcDir, { recursive: true })
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => path.join(srcDir, f));

  let hasErrors = false;

  files.forEach((file) => {
    let errors = [];
    let warnings = [];

    // Check if it's a route or server function
    if (file.includes("routes/")) {
      ({ errors, warnings } = validateRoute(file));
    } else if (file.includes("functions/")) {
      ({ errors, warnings } = validateServerFunction(file));
    }

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

  // Check for required files
  const requiredFiles = ["routes/__root.tsx"];
  requiredFiles.forEach((file) => {
    const fullPath = path.join(srcDir, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`\n❌ Missing required file: ${file}`);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    console.log("\n❌ Validation failed - fix errors before deploying");
    process.exit(1);
  } else {
    console.log("\n✅ All Tanstack Start files passed validation");
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateRoute, validateServerFunction };
