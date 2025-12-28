#!/usr/bin/env node

/**
 * Validates shadcn/ui component usage
 * Checks for hallucinated props and common anti-patterns
 */

const fs = require("fs");
const path = require("path");

// shadcn/ui component props registry (simplified version)
const knownComponents = {
  button: {
    props: ["variant", "size", "asChild"],
    variants: [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ],
    sizes: ["default", "sm", "lg", "icon"],
  },
  card: {
    props: [],
    variants: [],
    sizes: [],
  },
  input: {
    props: ["type", "disabled"],
    variants: [],
    sizes: ["default", "sm", "lg"],
  },
  dialog: {
    props: ["open", "onOpenChange"],
    variants: [],
    sizes: [],
  },
};

function validateComponent(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const errors = [];
  const warnings = [];

  // Find all shadcn/ui imports
  const importRegex =
    /import\s*{([^}]+)}\s*from\s*["']@\/components\/ui\/([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1].split(",").map((s) => s.trim());
    const component = match[2];

    imports.forEach((imp) => {
      const componentName = imp.split(" as ")[0].trim();
      validateComponentUsage(
        filePath,
        content,
        componentName.toLowerCase(),
        errors,
        warnings,
      );
    });
  }

  // Check for anti-patterns
  if (content.includes("color=")) {
    warnings.push('Found "color" prop - did you mean "variant"?');
  }

  if (content.includes("loading=")) {
    warnings.push('Found "loading" prop - consider using "disabled" + spinner');
  }

  return { errors, warnings };
}

function validateComponentUsage(
  filePath,
  content,
  component,
  errors,
  warnings,
) {
  const componentInfo = knownComponents[component];
  if (!componentInfo) {
    warnings.push(`Unknown shadcn/ui component: ${component}`);
    return;
  }

  // Find component usage
  const componentRegex = new RegExp(`<${component}\\s+([^>]+)>`, "g");
  let match;

  while ((match = componentRegex.exec(content)) !== null) {
    const props = match[1];

    // Check for unknown props
    const propRegex = /(\w+)=/g;
    let propMatch;

    while ((propMatch = propRegex.exec(props)) !== null) {
      const prop = propMatch[1];

      if (
        ![
          "className",
          "children",
          "key",
          "ref",
          ...componentInfo.props,
        ].includes(prop)
      ) {
        warnings.push(`Unknown prop "${prop}" on <${component}>`);
      }
    }

    // Check variant values
    const variantMatch = props.match(/variant="([^"]+)"/);
    if (variantMatch) {
      const variant = variantMatch[1];
      if (
        componentInfo.variants.length > 0 &&
        !componentInfo.variants.includes(variant)
      ) {
        errors.push(
          `Invalid variant "${variant}" for ${component}. Valid: ${componentInfo.variants.join(", ")}`,
        );
      }
    }

    // Check size values
    const sizeMatch = props.match(/size="([^"]+)"/);
    if (sizeMatch) {
      const size = sizeMatch[1];
      if (
        componentInfo.sizes.length > 0 &&
        !componentInfo.sizes.includes(size)
      ) {
        errors.push(
          `Invalid size "${size}" for ${component}. Valid: ${componentInfo.sizes.join(", ")}`,
        );
      }
    }
  }
}

function main() {
  const srcDir = path.join(process.cwd(), "src");
  if (!fs.existsSync(srcDir)) {
    console.log("No src/ directory found");
    process.exit(0);
  }

  const files = fs
    .readdirSync(srcDir, { recursive: true })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".jsx"))
    .map((f) => path.join(srcDir, f));

  let hasErrors = false;

  files.forEach((file) => {
    const { errors, warnings } = validateComponent(file);

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
    console.log("\n❌ Validation failed - fix errors before committing");
    process.exit(1);
  } else {
    console.log("\n✅ All components passed validation");
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateComponent };
