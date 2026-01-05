---
description: Analyze repositories against global skills, identify gaps and improvements
---

# Repository Analysis Command

Analyze a repository against your global skills. Identify what's good, what's wrong, and what's missing.

## Input

{{PROMPT}}

## Modes

Parse the input to determine mode:

- **Self-assessment** (no args): Analyze the current working directory
- **External repo** (`owner/repo`): Clone and analyze an external repository
- **Discovery** (`--discover "topic"`): Search GitHub for repos to analyze

---

## Workflow

### Step 1: Get Global Skills Context

Read skills from the global config at `$OPENCODE_CONFIG_PATH`:

```bash
# Skills location
$OPENCODE_CONFIG_PATH/skill/
```

Reference files to check:

- `$OPENCODE_CONFIG_PATH/skill/cloudflare-workers/references/PATTERNS.md`
- `$OPENCODE_CONFIG_PATH/skill/cloudflare-workers/references/ANTI_PATTERNS.md`
- `$OPENCODE_CONFIG_PATH/skill/durable-objects/references/PATTERNS.md`
- `$OPENCODE_CONFIG_PATH/skill/durable-objects/references/ANTI_PATTERNS.md`
- etc.

**Note:** Do NOT clone the config repo. Use the local path from the environment variable.

### Step 2: Get Target Repository

**For self-assessment:** Use current working directory.

**For external repo:**

```
repo-autopsy_clone({ repo: "<owner/repo>" })
```

**For discovery:**

```
grep_app_searchGitHub({ query: "<topic>", language: ["TypeScript", "TSX"] })
```

Then clone top results.

### Step 3: Stack Verification

Check what parts of the f-stack the target uses:

```
repo-autopsy_deps({ repo })
```

| Dependency                                     | Stack Component |
| ---------------------------------------------- | --------------- |
| `wrangler.toml` or `@cloudflare/workers-types` | Workers         |
| `@tanstack/start` or `@tanstack/react-router`  | Tanstack Start  |
| `components.json` or `@radix-ui/*`             | shadcn/ui       |
| `hono`                                         | Hono            |
| `better-auth`                                  | better-auth     |

Only analyze components the repo actually uses.

### Step 4: Pattern Extraction

Run parallel searches based on detected stack:

**Workers patterns:**

```
repo-autopsy_search({ repo, pattern: "env\\.KV|env\\.R2|env\\.D1", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "expirationTtl", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "process\\.env\\.", fileGlob: "*.ts" })
```

**Durable Objects patterns:**

```
repo-autopsy_search({ repo, pattern: "blockConcurrencyWhile", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "state\\.storage", fileGlob: "*.ts" })
```

**Auth patterns:**

```
repo-autopsy_search({ repo, pattern: "betterAuth|better-auth", fileGlob: "*.ts" })
```

**UI patterns:**

```
repo-autopsy_search({ repo, pattern: "cn\\(", fileGlob: "*.tsx" })
```

### Step 5: Compare Against Skills

For each finding, compare against global skills:

1. **Does a skill cover this pattern?**
   - Yes, and code matches → ✓ Compliant
   - Yes, but code violates → Gap (implementation issue)
   - Yes, but code is BETTER → Improvement opportunity

2. **Is this pattern NOT in any skill?**
   - Useful pattern → New skill opportunity
   - Anti-pattern → New anti-pattern to document

### Step 6: Validate with Official Docs

For patterns that might improve skills or represent new opportunities:

```
context7_get-library-docs({ context7CompatibleLibraryID: "...", topic: "..." })
better-auth_search({ query: "..." })
```

Confirm patterns are correct before recommending skill changes.

---

## Output: The Report

Generate a structured report with three sections:

```markdown
# Repository Analysis: <target>

## Stack Detected

- [x] Cloudflare Workers
- [ ] Tanstack Start
- [x] shadcn/ui
- etc.

---

## 1. SKILL IMPROVEMENTS

Patterns in this repo that are BETTER than current skills.

### 1.1 [Pattern Name]

**Skill**: cloudflare-workers
**Current skill says**: [what the skill currently documents]
**This repo does**: [the better approach found]
**Why it's better**: [explanation with doc references]
**Evidence**: [file:line references]

---

## 2. IMPLEMENTATION GAPS

Code that VIOLATES existing skills.

### 2.1 [Violation Name]

**Skill violated**: cloudflare-workers / ANTI_PATTERNS.md
**What the skill says**: [the correct approach]
**What this repo does**: [the violation]
**Files affected**: [list]
**Suggested fix**: [brief description]

---

## 3. NEW SKILL OPPORTUNITIES

Patterns not covered by any existing skill.

### 3.1 [Pattern Name]

**Category**: [Workers/Auth/UI/etc.]
**What it does**: [description]
**Why it matters**: [value proposition]
**Evidence**: [file:line references]
**Validation**: [doc reference confirming this is good]

---

## Summary

| Category            | Count |
| ------------------- | ----- |
| Skill Improvements  | N     |
| Implementation Gaps | N     |
| New Opportunities   | N     |
```

---

## Post-Report Options

After presenting the report, ask:

**"What would you like to do with these findings?"**

| Choice                         | Action                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| **1. Apply skill changes**     | **LIVE UPDATE**: Modify skill files directly in `opencode-config` and push to remote. (No PR) |
| **2. Fix implementation gaps** | **TASKED**: Create beads/issues in the current repo for violations. Do NOT auto-fix.          |
| **3. Both**                    | Do both of the above                                                                          |
| **4. Export report**           | Save report to a file for later                                                               |
| **5. Done**                    | End session                                                                                   |

---

## Key Principles

1.  **Live Knowledge Updates**: Skill changes are "hard facts" validated by MCP. They are applied directly to `opencode-config` and pushed immediately. This ensures the entire agent fleet has the latest guidance.
2.  **No Project Auto-Fixes**: Never modify the target repository's code during analysis. High-fidelity analysis identifies gaps; remediation is a separate task tracked via beads.
3.  **Centralized Intelligence**: All discovered patterns must be codified in `$OPENCODE_CONFIG_PATH`. Never create local-only skill overrides.
4.  **Evidence-Based Codification**: Every pattern must include evidence (file:line) and validation (MCP docs/search).
