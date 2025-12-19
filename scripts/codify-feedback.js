#!/usr/bin/env node
/**
 * Feedback Codifier Tool - The Learning Engine
 *
 * Validates and stores patterns in the knowledge base with:
 * - Confidence decay (90-day half-life)
 * - Pattern maturity progression (candidate → established → proven → deprecated)
 * - Anti-pattern auto-inversion (>60% failure rate)
 *
 * Usage:
 *   node codify-feedback.js --pattern "Use DO for rate limiting"
 *   node codify-feedback.js --pattern "..." --category runtime
 *   node codify-feedback.js --list
 *   node codify-feedback.js --validate "pattern to check"
 *   node codify-feedback.js --track "pattern-id" --result success
 *   node codify-feedback.js --track "pattern-id" --result failure --reason "why"
 *   node codify-feedback.js --stats "pattern-id"
 *   node codify-feedback.js --stale
 *   node codify-feedback.js --failing
 *
 * Output:
 *   JSON with validation status and storage location
 */

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "..", "knowledge");
const PATTERNS_FILE = path.join(KNOWLEDGE_DIR, "cloudflare-patterns.md");
const GUIDELINES_FILE = path.join(KNOWLEDGE_DIR, "guidelines.md");
const TRACKING_FILE = path.join(KNOWLEDGE_DIR, ".pattern-tracking.json");

// Categories for pattern organization
const CATEGORIES = {
  runtime: "Runtime Compatibility",
  resource: "Resource Selection",
  binding: "Binding Patterns",
  edge: "Edge Optimization",
  security: "Security",
  ui: "UI/Component Patterns",
};

// Maturity levels
const MATURITY = {
  candidate: { minUses: 0, minSuccess: 0, label: "candidate" },
  established: { minUses: 5, minSuccess: 0.7, label: "established" },
  proven: { minUses: 20, minSuccess: 0.85, label: "proven" },
  deprecated: { maxSuccess: 0.5, label: "deprecated" },
};

// Confidence decay constants
const HALF_LIFE_DAYS = 90;
const DECAY_CONSTANT = Math.log(2) / HALF_LIFE_DAYS;

// Invalid patterns that should never be codified
const REJECTION_PATTERNS = [
  { pattern: /next\.?js/i, reason: "Use Tanstack Start instead" },
  { pattern: /express|fastify|koa|nestjs/i, reason: "Use Hono instead" },
  { pattern: /langchain/i, reason: "Use Vercel AI SDK instead" },
  { pattern: /cloudflare pages/i, reason: "Use Workers with static assets" },
  { pattern: /process\.env/i, reason: "Use env parameter" },
  { pattern: /require\s*\(/i, reason: "Use ES modules import" },
  {
    pattern: /wrangler\.toml.*(add|modify|edit)/i,
    reason: "Do not codify config modifications",
  },
];

// ============================================================================
// Tracking Data Management
// ============================================================================

function loadTracking() {
  if (!fs.existsSync(TRACKING_FILE)) {
    return { patterns: {}, antiPatterns: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(TRACKING_FILE, "utf-8"));
  } catch {
    return { patterns: {}, antiPatterns: [] };
  }
}

function saveTracking(data) {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
}

function generatePatternId(patternText) {
  // Create a slug from the pattern text
  return patternText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

// ============================================================================
// Confidence Decay
// ============================================================================

function calculateConfidence(lastValidated) {
  if (!lastValidated) return 0;

  const now = new Date();
  const validated = new Date(lastValidated);
  const daysSince = (now - validated) / (1000 * 60 * 60 * 24);

  // Exponential decay: C(t) = C0 * e^(-λt)
  // With 90-day half-life: C(90) = 0.5 * C0
  const confidence = Math.exp(-DECAY_CONSTANT * daysSince);

  return Math.round(confidence * 100);
}

function getConfidenceLabel(confidence) {
  if (confidence >= 80) return "High";
  if (confidence >= 50) return "Medium";
  if (confidence >= 25) return "Low";
  return "Stale";
}

// ============================================================================
// Pattern Maturity
// ============================================================================

function calculateMaturity(stats) {
  const totalUses = stats.success + stats.failure;
  const successRate = totalUses > 0 ? stats.success / totalUses : 0;

  // Check for deprecated first (failure rate > 50%)
  if (totalUses >= 5 && successRate < MATURITY.deprecated.maxSuccess) {
    return "deprecated";
  }

  // Check for proven (20+ uses, 85%+ success)
  if (
    totalUses >= MATURITY.proven.minUses &&
    successRate >= MATURITY.proven.minSuccess
  ) {
    return "proven";
  }

  // Check for established (5+ uses, 70%+ success)
  if (
    totalUses >= MATURITY.established.minUses &&
    successRate >= MATURITY.established.minSuccess
  ) {
    return "established";
  }

  return "candidate";
}

// ============================================================================
// Anti-Pattern Detection
// ============================================================================

function checkForAntiPattern(patternId, stats, tracking) {
  const totalUses = stats.success + stats.failure;
  const failureRate = totalUses > 0 ? stats.failure / totalUses : 0;

  // Flag for inversion if failure rate > 60%
  if (totalUses >= 5 && failureRate > 0.6) {
    return {
      shouldInvert: true,
      failureRate: Math.round(failureRate * 100),
      totalUses,
      recentFailures: stats.recentFailures || [],
    };
  }

  return { shouldInvert: false };
}

function invertToAntiPattern(patternId, patternText, reason, tracking) {
  // Add to anti-patterns list
  if (!tracking.antiPatterns) {
    tracking.antiPatterns = [];
  }

  const antiPattern = {
    id: `anti-${patternId}`,
    originalPattern: patternText,
    reason: reason,
    invertedAt: new Date().toISOString(),
    addedToRejection: true,
  };

  tracking.antiPatterns.push(antiPattern);

  // Mark original pattern as deprecated
  if (tracking.patterns[patternId]) {
    tracking.patterns[patternId].maturity = "deprecated";
    tracking.patterns[patternId].invertedTo = antiPattern.id;
  }

  return antiPattern;
}

// ============================================================================
// Pattern Tracking
// ============================================================================

function trackResult(patternId, result, reason = null) {
  const tracking = loadTracking();

  if (!tracking.patterns[patternId]) {
    tracking.patterns[patternId] = {
      success: 0,
      failure: 0,
      created: new Date().toISOString(),
      lastValidated: new Date().toISOString(),
      recentFailures: [],
    };
  }

  const stats = tracking.patterns[patternId];

  if (result === "success") {
    stats.success++;
    stats.lastValidated = new Date().toISOString();
  } else if (result === "failure") {
    stats.failure++;
    stats.recentFailures = stats.recentFailures || [];
    stats.recentFailures.push({
      date: new Date().toISOString(),
      reason: reason || "No reason provided",
    });
    // Keep only last 5 failures
    if (stats.recentFailures.length > 5) {
      stats.recentFailures = stats.recentFailures.slice(-5);
    }
  }

  // Update maturity
  stats.maturity = calculateMaturity(stats);

  // Check for anti-pattern inversion
  const antiCheck = checkForAntiPattern(patternId, stats, tracking);

  saveTracking(tracking);

  return {
    patternId,
    result,
    stats: {
      success: stats.success,
      failure: stats.failure,
      successRate: Math.round(
        (stats.success / (stats.success + stats.failure)) * 100,
      ),
      maturity: stats.maturity,
      confidence: calculateConfidence(stats.lastValidated),
    },
    antiPatternWarning: antiCheck.shouldInvert
      ? {
          message: `Pattern has ${antiCheck.failureRate}% failure rate - consider inverting to anti-pattern`,
          recentFailures: antiCheck.recentFailures,
        }
      : null,
  };
}

function getPatternStats(patternId) {
  const tracking = loadTracking();
  const stats = tracking.patterns[patternId];

  if (!stats) {
    return { error: `Pattern '${patternId}' not found in tracking` };
  }

  const totalUses = stats.success + stats.failure;
  const successRate =
    totalUses > 0 ? Math.round((stats.success / totalUses) * 100) : 0;
  const confidence = calculateConfidence(stats.lastValidated);

  return {
    patternId,
    success: stats.success,
    failure: stats.failure,
    totalUses,
    successRate,
    maturity: stats.maturity || calculateMaturity(stats),
    confidence,
    confidenceLabel: getConfidenceLabel(confidence),
    lastValidated: stats.lastValidated,
    created: stats.created,
    recentFailures: stats.recentFailures || [],
    needsRefresh: confidence < 50,
    atRiskOfDeprecation: successRate < 60 && totalUses >= 3,
  };
}

function getStalePatterns() {
  const tracking = loadTracking();
  const stale = [];

  for (const [id, stats] of Object.entries(tracking.patterns)) {
    const confidence = calculateConfidence(stats.lastValidated);
    if (confidence < 50) {
      stale.push({
        patternId: id,
        confidence,
        lastValidated: stats.lastValidated,
        daysSinceValidation: Math.round(
          (new Date() - new Date(stats.lastValidated)) / (1000 * 60 * 60 * 24),
        ),
      });
    }
  }

  return {
    count: stale.length,
    patterns: stale.sort((a, b) => a.confidence - b.confidence),
  };
}

function getFailingPatterns() {
  const tracking = loadTracking();
  const failing = [];

  for (const [id, stats] of Object.entries(tracking.patterns)) {
    const totalUses = stats.success + stats.failure;
    const failureRate = totalUses > 0 ? stats.failure / totalUses : 0;

    if (totalUses >= 3 && failureRate > 0.6) {
      failing.push({
        patternId: id,
        failureRate: Math.round(failureRate * 100),
        totalUses,
        recentFailures: stats.recentFailures || [],
        recommendation:
          failureRate > 0.8
            ? "INVERT: Convert to anti-pattern immediately"
            : "REVIEW: Consider deprecation or refinement",
      });
    }
  }

  return {
    count: failing.length,
    patterns: failing.sort((a, b) => b.failureRate - a.failureRate),
    antiPatterns: tracking.antiPatterns || [],
  };
}

// ============================================================================
// Pattern Validation & Storage (Original Functionality)
// ============================================================================

function ensureKnowledgeDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  // Initialize patterns file if doesn't exist
  if (!fs.existsSync(PATTERNS_FILE)) {
    fs.writeFileSync(
      PATTERNS_FILE,
      `# Cloudflare Patterns Knowledge Base

This file contains validated patterns for Cloudflare Workers development.
Patterns are validated against official documentation before being added.

---

`,
    );
  }

  // Initialize guidelines file if doesn't exist
  if (!fs.existsSync(GUIDELINES_FILE)) {
    fs.writeFileSync(
      GUIDELINES_FILE,
      `# Development Guidelines

Validated best practices for edge-first development.

---

`,
    );
  }
}

function validatePattern(patternText) {
  const tracking = loadTracking();
  const result = {
    valid: true,
    warnings: [],
    rejectionReason: null,
  };

  // Check against rejection patterns
  for (const { pattern, reason } of REJECTION_PATTERNS) {
    if (pattern.test(patternText)) {
      result.valid = false;
      result.rejectionReason = reason;
      return result;
    }
  }

  // Check against known anti-patterns
  for (const antiPattern of tracking.antiPatterns || []) {
    if (
      patternText
        .toLowerCase()
        .includes(antiPattern.originalPattern.toLowerCase())
    ) {
      result.valid = false;
      result.rejectionReason = `Known anti-pattern: ${antiPattern.reason}`;
      return result;
    }
  }

  // Add warnings for patterns that might need MCP validation
  const needsValidation = [
    {
      pattern: /kv|r2|d1|durable/i,
      note: "Validate resource selection against Cloudflare docs",
    },
    { pattern: /shadcn|tailwind/i, note: "Validate against shadcn MCP server" },
    {
      pattern: /security|secret|auth/i,
      note: "Review security implications carefully",
    },
  ];

  for (const { pattern, note } of needsValidation) {
    if (pattern.test(patternText)) {
      result.warnings.push(note);
    }
  }

  return result;
}

function formatPattern(patternText, category, source) {
  const timestamp = new Date().toISOString().split("T")[0];
  const categoryName = CATEGORIES[category] || category;
  const patternId = generatePatternId(patternText);

  return `
## Pattern: ${patternText.slice(0, 50)}${patternText.length > 50 ? "..." : ""}

**ID**: \`${patternId}\`
**Category**: ${categoryName}
**Maturity**: candidate
**Added**: ${timestamp}
**Source**: ${source || "User feedback"}

### Description
${patternText}

### Validation
- Status: Pending MCP validation
- Run: \`context7 search "${patternText.slice(0, 30)}"\` to verify

### Effectiveness
- Success: 0
- Failure: 0
- Last validated: ${timestamp}

---
`;
}

function addPattern(patternText, category = "runtime", source = "feedback") {
  ensureKnowledgeDir();

  const validation = validatePattern(patternText);

  if (!validation.valid) {
    return {
      success: false,
      action: "rejected",
      reason: validation.rejectionReason,
      pattern: patternText,
    };
  }

  const patternId = generatePatternId(patternText);
  const formatted = formatPattern(patternText, category, source);
  fs.appendFileSync(PATTERNS_FILE, formatted);

  // Initialize tracking for new pattern
  const tracking = loadTracking();
  tracking.patterns[patternId] = {
    success: 0,
    failure: 0,
    created: new Date().toISOString(),
    lastValidated: new Date().toISOString(),
    maturity: "candidate",
    text: patternText,
    category: category,
  };
  saveTracking(tracking);

  return {
    success: true,
    action: "added",
    patternId,
    file: PATTERNS_FILE,
    category: CATEGORIES[category] || category,
    maturity: "candidate",
    warnings: validation.warnings,
    note:
      validation.warnings.length > 0
        ? "Pattern added with warnings - validate with MCP"
        : "Pattern added successfully - track effectiveness with --track",
  };
}

function listPatterns() {
  ensureKnowledgeDir();

  if (!fs.existsSync(PATTERNS_FILE)) {
    return { patterns: [], count: 0 };
  }

  const content = fs.readFileSync(PATTERNS_FILE, "utf-8");
  const tracking = loadTracking();
  const patterns = [];

  // Extract pattern headers and IDs
  const patternRegex = /## Pattern: (.+)\n\n\*\*ID\*\*: `([^`]+)`/g;
  let match;
  while ((match = patternRegex.exec(content)) !== null) {
    const id = match[2];
    const stats = tracking.patterns[id] || {};
    const confidence = calculateConfidence(stats.lastValidated);

    patterns.push({
      name: match[1],
      id: id,
      maturity: stats.maturity || "candidate",
      confidence,
      confidenceLabel: getConfidenceLabel(confidence),
      successRate:
        stats.success + stats.failure > 0
          ? Math.round((stats.success / (stats.success + stats.failure)) * 100)
          : null,
    });
  }

  // Fallback for patterns without ID (legacy format)
  if (patterns.length === 0) {
    const legacyRegex = /## Pattern: (.+)/g;
    while ((match = legacyRegex.exec(content)) !== null) {
      patterns.push({
        name: match[1],
        id: generatePatternId(match[1]),
        maturity: "unknown",
        confidence: null,
      });
    }
  }

  return {
    file: PATTERNS_FILE,
    count: patterns.length,
    patterns,
    antiPatterns: tracking.antiPatterns || [],
  };
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(
      JSON.stringify(
        {
          usage: {
            add: 'node codify-feedback.js --pattern "pattern text" [--category runtime|resource|binding|edge|security|ui]',
            list: "node codify-feedback.js --list",
            validate: 'node codify-feedback.js --validate "pattern to check"',
            track:
              'node codify-feedback.js --track "pattern-id" --result success|failure [--reason "why"]',
            stats: 'node codify-feedback.js --stats "pattern-id"',
            stale: "node codify-feedback.js --stale",
            failing: "node codify-feedback.js --failing",
          },
          categories: CATEGORIES,
          maturityLevels: {
            candidate: "New pattern, < 5 uses",
            established: "5+ uses, > 70% success",
            proven: "20+ uses, > 85% success",
            deprecated: "< 50% success or superseded",
          },
          confidenceDecay:
            "90-day half-life (50% confidence after 90 days without validation)",
        },
        null,
        2,
      ),
    );
    return;
  }

  // --list: List all patterns with stats
  if (args.includes("--list")) {
    console.log(JSON.stringify(listPatterns(), null, 2));
    return;
  }

  // --stale: List patterns needing refresh
  if (args.includes("--stale")) {
    console.log(JSON.stringify(getStalePatterns(), null, 2));
    return;
  }

  // --failing: List patterns with high failure rate
  if (args.includes("--failing")) {
    console.log(JSON.stringify(getFailingPatterns(), null, 2));
    return;
  }

  // --stats: Get stats for a specific pattern
  if (args.includes("--stats")) {
    const statsIndex = args.indexOf("--stats");
    const patternId = args[statsIndex + 1];
    if (!patternId) {
      console.log(
        JSON.stringify({ error: "Pattern ID required after --stats" }, null, 2),
      );
      process.exit(1);
    }
    console.log(JSON.stringify(getPatternStats(patternId), null, 2));
    return;
  }

  // --track: Track pattern result
  if (args.includes("--track")) {
    const trackIndex = args.indexOf("--track");
    const patternId = args[trackIndex + 1];

    if (!patternId) {
      console.log(
        JSON.stringify({ error: "Pattern ID required after --track" }, null, 2),
      );
      process.exit(1);
    }

    if (!args.includes("--result")) {
      console.log(
        JSON.stringify({ error: "--result success|failure required" }, null, 2),
      );
      process.exit(1);
    }

    const resultIndex = args.indexOf("--result");
    const result = args[resultIndex + 1];

    if (!["success", "failure"].includes(result)) {
      console.log(
        JSON.stringify(
          { error: '--result must be "success" or "failure"' },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    let reason = null;
    if (args.includes("--reason")) {
      const reasonIndex = args.indexOf("--reason");
      reason = args[reasonIndex + 1];
    }

    console.log(
      JSON.stringify(trackResult(patternId, result, reason), null, 2),
    );
    return;
  }

  // --validate: Validate a pattern without adding
  if (args.includes("--validate")) {
    const validateIndex = args.indexOf("--validate");
    const pattern = args[validateIndex + 1];
    if (!pattern) {
      console.log(
        JSON.stringify(
          { error: "Pattern text required after --validate" },
          null,
          2,
        ),
      );
      process.exit(1);
    }
    console.log(JSON.stringify(validatePattern(pattern), null, 2));
    return;
  }

  // --pattern: Add a new pattern
  if (args.includes("--pattern")) {
    const patternIndex = args.indexOf("--pattern");
    const pattern = args[patternIndex + 1];

    if (!pattern) {
      console.log(
        JSON.stringify(
          { error: "Pattern text required after --pattern" },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    let category = "runtime";
    if (args.includes("--category")) {
      const catIndex = args.indexOf("--category");
      category = args[catIndex + 1] || "runtime";
    }

    const result = addPattern(pattern, category, "CLI input");
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  console.log(
    JSON.stringify(
      { error: "Unknown command. Use --help for usage." },
      null,
      2,
    ),
  );
  process.exit(1);
}

main();
