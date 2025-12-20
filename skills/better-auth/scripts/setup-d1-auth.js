#!/usr/bin/env node

/**
 * Setup D1 database for better-auth
 * Creates tables and validates schema
 */

const fs = require("fs");
const path = require("path");

const authTables = `
-- Users table
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN DEFAULT false,
  "image" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Accounts table (for OAuth providers)
CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refreshToken" TEXT,
  "accessToken" TEXT,
  "expiresAt" INTEGER,
  "tokenType" TEXT,
  "scope" TEXT,
  "idToken" TEXT,
  "sessionState" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Verification table
CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);
`;

function generateMigration() {
  const migrationsDir = path.join(process.cwd(), "migrations");

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const migrationFile = path.join(migrationsDir, "001_better_auth.sql");
  fs.writeFileSync(migrationFile, authTables);

  console.log(`✅ Migration file created: ${migrationFile}`);
  return migrationFile;
}

async function runMigration() {
  const { execSync } = require("child_process");

  try {
    console.log("🔄 Running migration with D1...");

    // Apply migration
    execSync("wrangler d1 migrations apply better-auth-migration --remote", {
      stdio: "inherit",
    });

    console.log("✅ Migration applied successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);

    // Fallback: direct SQL execution
    console.log("\n📝 SQL to run manually:");
    console.log(authTables);
  }
}

async function checkSchema() {
  try {
    const result = execSync(
      "wrangler d1 execute better-auth --remote --command \"SELECT name FROM sqlite_master WHERE type='table'\"",
      { encoding: "utf8" },
    );

    const tables = result
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.split("|")[1]?.trim())
      .filter(Boolean);

    const requiredTables = ["user", "account", "session", "verification"];
    const missing = requiredTables.filter((t) => !tables.includes(t));

    if (missing.length > 0) {
      console.log(`❌ Missing tables: ${missing.join(", ")}`);
      return false;
    }

    console.log("✅ All required tables exist");
    return true;
  } catch (error) {
    console.log("⚠️  Could not verify schema");
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
Usage: node setup-d1-auth.js [options]

Options:
  --generate     Generate migration file only
  --migrate     Run migration on D1
  --check        Check if tables exist
  --help         Show this help

Examples:
  node setup-d1-auth.js --generate
  node setup-d1-auth.js --migrate
  node setup-d1-auth.js --check
    `);
    return;
  }

  // Check for wrangler.toml
  if (!fs.existsSync(path.join(process.cwd(), "wrangler.toml"))) {
    console.error("❌ wrangler.toml not found. Run from project root.");
    process.exit(1);
  }

  if (args.includes("--generate")) {
    generateMigration();
  } else if (args.includes("--migrate")) {
    generateMigration();
    runMigration();
  } else if (args.includes("--check")) {
    checkSchema();
  } else {
    // Default: generate and migrate
    generateMigration();
    runMigration();
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateMigration, runMigration, checkSchema };
