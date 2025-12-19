#!/usr/bin/env node
/**
 * D1 Migration Validator
 *
 * Validates D1 migration files and database patterns for Cloudflare Workers.
 * This is a "Hard Tool" - deterministic validation that catches common D1 issues.
 *
 * Checks for:
 * - Proper SQL syntax (basic validation)
 * - Required fields in users/subscriptions tables (better-auth, Polar.sh)
 * - Proper indexing on common query fields
 * - D1 anti-patterns (too many small migrations, missing indexes)
 *
 * Usage:
 *   node validate-d1.js [migrations-directory]
 *   node validate-d1.js migrations/
 *   node validate-d1.js --schema schema.sql
 *
 * Output:
 *   JSON with validation results
 */

const fs = require("fs");
const path = require("path");

// ============================================================================
// Required Fields for Common Tables (better-auth + Polar.sh patterns)
// ============================================================================

const REQUIRED_FIELDS = {
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

// ============================================================================
// Required Indexes for Performance
// ============================================================================

const REQUIRED_INDEXES = {
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

// ============================================================================
// D1 Anti-Patterns
// ============================================================================

const SQL_ANTI_PATTERNS = [
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
    pattern: /BOOLEAN/gi,
    severity: "info",
    message: "D1 stores BOOLEAN as INTEGER (0 or 1)",
    fix: "Use INTEGER with CHECK constraint or document 0/1 convention",
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
    pattern: /TINYINT|SMALLINT|MEDIUMINT|BIGINT/gi,
    severity: "info",
    message: "All integer types are stored as INTEGER in SQLite/D1",
    fix: "Use INTEGER for clarity",
  },
  {
    pattern: /DOUBLE|FLOAT/gi,
    severity: "info",
    message: "Floating point types are stored as REAL in SQLite/D1",
    fix: "Use REAL for clarity",
  },
  {
    pattern: /IF\s+NOT\s+EXISTS/gi,
    severity: "info",
    message: "IF NOT EXISTS is good practice for idempotent migrations",
    isGood: true,
  },
  {
    pattern: /DROP\s+TABLE(?!\s+IF\s+EXISTS)/gi,
    severity: "warning",
    message: "DROP TABLE without IF EXISTS can fail if table does not exist",
    fix: "Use DROP TABLE IF EXISTS for safety",
  },
  {
    pattern: /ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN(?!\s+IF\s+NOT\s+EXISTS)/gi,
    severity: "warning",
    message: "ADD COLUMN without IF NOT EXISTS can fail on re-run",
    fix: "Use ADD COLUMN IF NOT EXISTS for idempotent migrations",
  },
];

// ============================================================================
// Migration File Anti-Patterns
// ============================================================================

const MIGRATION_ANTI_PATTERNS = {
  tooManySmallMigrations: {
    threshold: 20,
    severity: "warning",
    message: "Too many small migration files can slow down deployment",
    fix: "Consider consolidating migrations into fewer files",
  },
  missingDownMigration: {
    severity: "info",
    message:
      "No down migration found - rollbacks will require manual intervention",
    fix: "Consider adding down migrations for reversibility",
  },
  noTimestampPrefix: {
    pattern: /^\d{4}[-_]?\d{2}[-_]?\d{2}/,
    severity: "warning",
    message: "Migration file should have timestamp prefix for ordering",
    fix: "Use format: YYYYMMDD_HHMMSS_description.sql or similar",
  },
};

// ============================================================================
// Parsing Functions
// ============================================================================

function parseSqlFile(content) {
  const result = {
    tables: [],
    indexes: [],
    statements: [],
    errors: [],
  };

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
    result.statements.push(stmt);

    // Parse CREATE TABLE
    const tableMatch = stmt.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]+)\)/i,
    );
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      const columnsStr = tableMatch[2];

      const columns = parseColumns(columnsStr);
      const constraints = parseConstraints(columnsStr);

      result.tables.push({
        name: tableName,
        columns,
        constraints,
        raw: stmt,
      });
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

      result.indexes.push({
        name: indexName,
        table: tableName,
        columns,
        unique: /UNIQUE/i.test(stmt),
        raw: stmt,
      });
    }
  }

  return result;
}

function parseColumns(columnsStr) {
  const columns = [];
  const lines = columnsStr.split(",");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip constraints
    if (
      /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)
    ) {
      continue;
    }

    // Parse column definition
    const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\w+)/i);
    if (colMatch) {
      const name = colMatch[1].toLowerCase();
      const type = colMatch[2].toUpperCase();

      columns.push({
        name,
        type,
        nullable: !/NOT\s+NULL/i.test(trimmed),
        primaryKey: /PRIMARY\s+KEY/i.test(trimmed),
        unique: /UNIQUE/i.test(trimmed),
        default: extractDefault(trimmed),
        raw: trimmed,
      });
    }
  }

  return columns;
}

function parseConstraints(columnsStr) {
  const constraints = [];
  const lines = columnsStr.split(",");

  for (const line of lines) {
    const trimmed = line.trim();

    // Foreign key
    const fkMatch = trimmed.match(
      /FOREIGN\s+KEY\s*\([`"']?(\w+)[`"']?\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/i,
    );
    if (fkMatch) {
      constraints.push({
        type: "foreign_key",
        column: fkMatch[1].toLowerCase(),
        references: {
          table: fkMatch[2].toLowerCase(),
          column: fkMatch[3].toLowerCase(),
        },
        onDelete: /ON\s+DELETE\s+CASCADE/i.test(trimmed) ? "CASCADE" : null,
      });
    }

    // Primary key constraint
    const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      const columns = pkMatch[1]
        .split(",")
        .map((c) => c.trim().replace(/[`"']/g, "").toLowerCase());
      constraints.push({
        type: "primary_key",
        columns,
      });
    }

    // Unique constraint
    const uniqueMatch = trimmed.match(/UNIQUE\s*\(([^)]+)\)/i);
    if (uniqueMatch) {
      const columns = uniqueMatch[1]
        .split(",")
        .map((c) => c.trim().replace(/[`"']/g, "").toLowerCase());
      constraints.push({
        type: "unique",
        columns,
      });
    }
  }

  return constraints;
}

function extractDefault(columnDef) {
  const match = columnDef.match(
    /DEFAULT\s+(.+?)(?:\s+(?:NOT\s+NULL|UNIQUE|PRIMARY|CHECK|REFERENCES|,|$))/i,
  );
  if (match) {
    return match[1].trim();
  }
  return null;
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateSqlSyntax(content, filePath) {
  const issues = [];

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
    } of SQL_ANTI_PATTERNS) {
      if (isGood) continue; // Skip positive patterns

      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(line)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          code: line.trim(),
          severity,
          message,
          fix,
        });
      }
    }
  }

  return issues;
}

function validateRequiredFields(parsed, filePath) {
  const issues = [];

  for (const table of parsed.tables) {
    const tableName = table.name;
    const requirements = REQUIRED_FIELDS[tableName];

    if (!requirements) continue;

    const columnNames = table.columns.map((c) => c.name);

    // Check required fields
    for (const field of requirements.required || []) {
      if (!columnNames.includes(field)) {
        issues.push({
          file: filePath,
          table: tableName,
          severity: "critical",
          message: `Missing required field '${field}' in ${tableName} table`,
          fix: `Add column: ${field} TEXT NOT NULL`,
          context: requirements.description,
        });
      }
    }

    // Check recommended fields
    for (const field of requirements.recommended || []) {
      if (!columnNames.includes(field)) {
        issues.push({
          file: filePath,
          table: tableName,
          severity: "warning",
          message: `Missing recommended field '${field}' in ${tableName} table`,
          fix: `Consider adding: ${field}`,
          context: requirements.description,
        });
      }
    }

    // Check better-auth fields if users table
    if (tableName === "users" && requirements.betterAuth) {
      const hasBetterAuthFields = requirements.betterAuth.some((f) =>
        columnNames.includes(f),
      );
      if (!hasBetterAuthFields) {
        issues.push({
          file: filePath,
          table: tableName,
          severity: "info",
          message:
            "No better-auth fields detected (password_hash, name, image)",
          fix: "Add if using better-auth: password_hash TEXT, name TEXT, image TEXT",
          context: "better-auth integration",
        });
      }
    }

    // Check Polar fields if users table
    if (tableName === "users" && requirements.polar) {
      const hasPolarFields = requirements.polar.some((f) =>
        columnNames.includes(f),
      );
      if (!hasPolarFields) {
        issues.push({
          file: filePath,
          table: tableName,
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

function validateIndexes(parsed, filePath) {
  const issues = [];

  // Build index map
  const indexMap = new Map();
  for (const index of parsed.indexes) {
    const key = `${index.table}:${index.columns.sort().join(",")}`;
    indexMap.set(key, index);
  }

  // Also check for inline indexes in CREATE TABLE
  for (const table of parsed.tables) {
    for (const col of table.columns) {
      if (col.unique || col.primaryKey) {
        const key = `${table.name}:${col.name}`;
        indexMap.set(key, {
          table: table.name,
          columns: [col.name],
          inline: true,
        });
      }
    }
  }

  // Check required indexes
  for (const [tableName, requiredIndexes] of Object.entries(REQUIRED_INDEXES)) {
    const table = parsed.tables.find((t) => t.name === tableName);
    if (!table) continue;

    for (const required of requiredIndexes) {
      const key = `${tableName}:${required.columns.sort().join(",")}`;

      // Check for exact match or superset
      let found = indexMap.has(key);

      // Also check for single-column indexes
      if (!found && required.columns.length === 1) {
        const singleKey = `${tableName}:${required.columns[0]}`;
        found = indexMap.has(singleKey);
      }

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

function validateMigrationPatterns(files, directory) {
  const issues = [];

  // Check for too many small migrations
  if (files.length > MIGRATION_ANTI_PATTERNS.tooManySmallMigrations.threshold) {
    issues.push({
      file: directory,
      severity: MIGRATION_ANTI_PATTERNS.tooManySmallMigrations.severity,
      message: `${files.length} migration files found - ${MIGRATION_ANTI_PATTERNS.tooManySmallMigrations.message}`,
      fix: MIGRATION_ANTI_PATTERNS.tooManySmallMigrations.fix,
    });
  }

  // Check for timestamp prefixes
  for (const file of files) {
    const basename = path.basename(file);
    if (!MIGRATION_ANTI_PATTERNS.noTimestampPrefix.pattern.test(basename)) {
      issues.push({
        file,
        severity: MIGRATION_ANTI_PATTERNS.noTimestampPrefix.severity,
        message: MIGRATION_ANTI_PATTERNS.noTimestampPrefix.message,
        fix: MIGRATION_ANTI_PATTERNS.noTimestampPrefix.fix,
      });
    }
  }

  // Check for down migrations
  const hasDownMigrations = files.some((f) =>
    /down|rollback|revert/i.test(path.basename(f)),
  );
  if (!hasDownMigrations && files.length > 0) {
    issues.push({
      file: directory,
      severity: MIGRATION_ANTI_PATTERNS.missingDownMigration.severity,
      message: MIGRATION_ANTI_PATTERNS.missingDownMigration.message,
      fix: MIGRATION_ANTI_PATTERNS.missingDownMigration.fix,
    });
  }

  return issues;
}

// ============================================================================
// File Discovery
// ============================================================================

function findMigrationFiles(dirPath) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.startsWith(".") && entry !== "node_modules") {
          walk(fullPath);
        }
      } else if (entry.endsWith(".sql")) {
        files.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return files.sort();
}

// ============================================================================
// Main Validation
// ============================================================================

function validateD1Migrations(targetPath, options = {}) {
  const allIssues = [];
  const allParsed = [];

  // Determine if single file or directory
  const stat = fs.statSync(targetPath);
  const files = stat.isDirectory()
    ? findMigrationFiles(targetPath)
    : [targetPath];

  if (files.length === 0) {
    return {
      scanned: targetPath,
      timestamp: new Date().toISOString(),
      filesScanned: 0,
      total: 0,
      critical: 0,
      warnings: 0,
      info: 0,
      issues: [],
      tables: [],
      indexes: [],
      message: "No SQL files found",
    };
  }

  // Validate each file
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    // Parse SQL
    const parsed = parseSqlFile(content);
    allParsed.push({ file, ...parsed });

    // Validate SQL syntax
    allIssues.push(...validateSqlSyntax(content, file));

    // Validate required fields
    allIssues.push(...validateRequiredFields(parsed, file));

    // Validate indexes
    allIssues.push(...validateIndexes(parsed, file));
  }

  // Validate migration patterns (directory-level)
  if (stat.isDirectory()) {
    allIssues.push(...validateMigrationPatterns(files, targetPath));
  }

  // Collect all tables and indexes
  const allTables = allParsed.flatMap((p) => p.tables);
  const allIndexes = allParsed.flatMap((p) => p.indexes);

  // Build result
  const result = {
    scanned: targetPath,
    timestamp: new Date().toISOString(),
    filesScanned: files.length,
    total: allIssues.length,
    critical: allIssues.filter((i) => i.severity === "critical").length,
    warnings: allIssues.filter((i) => i.severity === "warning").length,
    info: allIssues.filter((i) => i.severity === "info").length,
    issues: allIssues,
    tables: allTables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => c.name),
      file: allParsed.find((p) => p.tables.includes(t))?.file,
    })),
    indexes: allIndexes.map((i) => ({
      name: i.name,
      table: i.table,
      columns: i.columns,
    })),
  };

  return result;
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let targetPath = "migrations";
  let outputFormat = "json";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--schema" && args[i + 1]) {
      targetPath = args[i + 1];
      i++;
    } else if (args[i] === "--format" && args[i + 1]) {
      outputFormat = args[i + 1];
      i++;
    } else if (!args[i].startsWith("-")) {
      targetPath = args[i];
    }
  }

  // Check if path exists
  if (!fs.existsSync(targetPath)) {
    console.log(
      JSON.stringify(
        {
          error: `Path not found: ${targetPath}`,
          scanned: targetPath,
          timestamp: new Date().toISOString(),
          total: 0,
          issues: [],
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  // Run validation
  const result = validateD1Migrations(targetPath);

  // Output
  if (outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Human-readable format
    console.log("# D1 Migration Validation Results\n");
    console.log(`Scanned: ${result.scanned}`);
    console.log(`Files: ${result.filesScanned}`);
    console.log(
      `Issues: ${result.total} (${result.critical} critical, ${result.warnings} warnings, ${result.info} info)\n`,
    );

    if (result.tables.length > 0) {
      console.log("## Tables Found");
      for (const table of result.tables) {
        console.log(`  - ${table.name}: ${table.columns.join(", ")}`);
      }
      console.log("");
    }

    if (result.issues.length > 0) {
      console.log("## Issues\n");
      for (const issue of result.issues) {
        const icon =
          issue.severity === "critical"
            ? "🔴"
            : issue.severity === "warning"
              ? "🟡"
              : "🔵";
        console.log(`${icon} ${issue.message}`);
        if (issue.file) console.log(`   File: ${issue.file}`);
        if (issue.table) console.log(`   Table: ${issue.table}`);
        if (issue.fix) console.log(`   Fix: ${issue.fix}`);
        console.log("");
      }
    } else {
      console.log("✅ No issues found");
    }
  }

  // Exit with error code if critical issues found
  if (result.critical > 0) {
    process.exit(1);
  }
}

main();
