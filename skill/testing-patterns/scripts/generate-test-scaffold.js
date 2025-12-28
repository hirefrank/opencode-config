#!/usr/bin/env node

/**
 * Generate test scaffold for new features
 * Creates test files with boilerplate code
 */

const fs = require("fs");
const path = require("path");

function generateWorkerTest(name) {
  const content = `import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src';

const env = getMiniflareBindings();

describe('${name}', () => {
  beforeEach(() => {
    // Reset KV/DOs between tests
    // env.KV.clear();
  });

  it('should respond correctly', async () => {
    const request = new Request('http://localhost/test');
    const response = await worker.fetch(request, env);
    
    expect(response.status).toBe(200);
  });
});
`;

  const filename = `tests/${name.toLowerCase().replace(/\s+/g, "-")}.test.ts`;
  fs.writeFileSync(filename, content);
  console.log(`✅ Worker test created: ${filename}`);
}

function generateComponentTest(name) {
  const content = `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ${name} from '../components/${name}';

describe('${name}', () => {
  it('renders correctly', () => {
    render(<${name} />);
    // Add specific assertions
  });

  it('handles user interaction', () => {
    // Add interaction test
  });
});
`;

  const filename = `tests/components/${name.toLowerCase()}.test.tsx`;
  fs.writeFileSync(filename, content);
  console.log(`✅ Component test created: ${filename}`);
}

function generateE2ETest(name) {
  const content = `import { test, expect } from '@playwright/test';

test.describe('${name}', () => {
  test('works end-to-end', async ({ page }) => {
    await page.goto('/');
    
    // Add E2E test steps
    await expect(page.locator('body')).toBeVisible();
  });
});
`;

  const filename = `tests/e2e/${name.toLowerCase().replace(/\s+/g, "-")}.spec.ts`;
  fs.writeFileSync(filename, content);
  console.log(`✅ E2E test created: ${filename}`);
}

function generateServiceTest(name) {
  const content = `import { describe, it, expect, beforeEach } from 'vitest';
import { ${name}Service } from '../src/services/${name.toLowerCase()}';

describe('${name}Service', () => {
  let service: ${name}Service;

  beforeEach(() => {
    service = new ${name}Service();
  });

  it('should initialize correctly', () => {
    expect(service).toBeDefined();
  });

  it('should handle basic operations', () => {
    // Add service-specific tests
  });
});
`;

  const filename = `tests/services/${name.toLowerCase()}.test.ts`;
  fs.writeFileSync(filename, content);
  console.log(`✅ Service test created: ${filename}`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: node generate-test-scaffold.js <type> <name> [options]

Types:
  worker       - Create Cloudflare Worker test
  component    - Create React component test
  e2e         - Create Playwright E2E test
  service      - Create service layer test

Options:
  --all        - Generate all test types for <name>

Examples:
  node generate-test-scaffold.js worker auth-handler
  node generate-test-scaffold.js component Button
  node generate-test-scaffold.js e2e checkout-flow
  node generate-test-scaffold.js service user --all
    `);
    return;
  }

  const [type, name, ...options] = args;

  // Ensure tests directory exists
  const testsDir = path.join(process.cwd(), "tests");
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  // Create subdirectories
  const subdirs = ["components", "e2e", "services"];
  subdirs.forEach((dir) => {
    const dirPath = path.join(testsDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  // Generate test(s)
  if (options.includes("--all")) {
    generateWorkerTest(name);
    generateComponentTest(name);
    generateE2ETest(name);
    generateServiceTest(name);
  } else {
    switch (type) {
      case "worker":
        generateWorkerTest(name);
        break;
      case "component":
        generateComponentTest(name);
        break;
      case "e2e":
        generateE2ETest(name);
        break;
      case "service":
        generateServiceTest(name);
        break;
      default:
        console.error(`❌ Unknown test type: ${type}`);
        console.log("Available types: worker, component, e2e, service");
        process.exit(1);
    }
  }

  console.log("\n💡 Don't forget to:");
  console.log("1. Update test assertions");
  console.log("2. Add specific test cases");
  console.log("3. Mock external dependencies if needed");
}

if (require.main === module) {
  main();
}

module.exports = {
  generateWorkerTest,
  generateComponentTest,
  generateE2ETest,
  generateServiceTest,
};
