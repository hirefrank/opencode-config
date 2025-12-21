---
description: Analyze external repositories to discover patterns for the f-train
---

# Repository Analysis Command

You are the **Implementation Analyzer**. Your job is to proactively discover patterns from external repositories that implement the f-train.

## Input

{{PROMPT}}

## Workflow

### Step 1: Parse Input

Determine the analysis target and mode:

- **Internal Repo (Self-Assessment)**: Analyze my current/previous implementations to verify if they align with my SKILLS or if I've discovered a better way "in the field."
- **External Repo (Discovery)**: Analyze `owner/repo` to find new patterns.
- **Discovery Mode**: `--discover <topic>` search GitHub.

### Step 2: Repository Discovery

**For specific repo:**

```
repo-autopsy_clone({ repo: "<provided-repo>" })
```

**For discovery mode:**

```
grep_app_searchGitHub({
  query: "<topic>",
  language: ["TypeScript", "TSX"]
})
```

Then clone top results.

### Step 3: Stack Verification

Verify the repo uses our stack before deep analysis:

```
repo-autopsy_deps({ repo })
```

Check for required dependencies:

- `@tanstack/start` or `@tanstack/react-router` → Tanstack Start ✓
- `wrangler.toml` or `@cloudflare/workers-types` → Workers ✓
- `components.json` or `@radix-ui/` → shadcn/ui ✓
- `hono` → Hono ✓
- `better-auth` → better-auth ✓

**If stack doesn't match our requirements:**

- Report which parts are compatible
- Skip incompatible patterns
- Continue with compatible parts only

### Step 4: Hotspot Analysis

Find high-value files to focus on:

```
repo-autopsy_hotspots({ repo })
```

Prioritize:

- Most changed files (core patterns)
- Largest files (complex logic)
- Files with TODOs (known issues)

### Step 5: Pattern Extraction

Run parallel searches for each category:

**Workers Runtime Patterns:**

```
repo-autopsy_ast({ repo, pattern: "export default { async fetch($$$) { $$$ } }", lang: "ts" })
repo-autopsy_search({ repo, pattern: "env\\.KV|env\\.R2|env\\.D1|env\\.DO", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "expirationTtl", fileGlob: "*.ts" })
```

**Workers Anti-Patterns:**

```
repo-autopsy_search({ repo, pattern: "process\\.env\\.", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "import.*from ['\"]fs['\"]", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "Buffer\\.", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "require\\(", fileGlob: "*.ts" })
```

**Durable Objects Patterns:**

```
repo-autopsy_search({ repo, pattern: "state\\.acceptWebSocket", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "state\\.storage\\.setAlarm", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "blockConcurrencyWhile", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "idFromName", fileGlob: "*.ts" })
```

**DO Anti-Patterns:**

```
repo-autopsy_search({ repo, pattern: "newUniqueId\\(\\)", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "setTimeout|setInterval", fileGlob: "*.ts" })
```

**Auth Patterns:**

```
repo-autopsy_search({ repo, pattern: "betterAuth|better-auth", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "d1Adapter|kvAdapter", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "getSession|signIn|signOut", fileGlob: "*.ts" })
```

**UI Patterns:**

```
repo-autopsy_search({ repo, pattern: "cn\\(", fileGlob: "*.tsx" })
repo-autopsy_search({ repo, pattern: "variant=|size=", fileGlob: "*.tsx" })
repo-autopsy_search({ repo, pattern: "asChild", fileGlob: "*.tsx" })
```

**UI Anti-Patterns:**

```
repo-autopsy_search({ repo, pattern: "style=\\{\\{", fileGlob: "*.tsx" })
repo-autopsy_search({ repo, pattern: "color=|loading=|isLoading=", fileGlob: "*.tsx" })
```

### Step 6: Validation

For each extracted pattern, validate against official docs:

**Workers patterns:**

```
context7_resolve-library-id({ libraryName: "cloudflare workers" })
context7_get-library-docs({
  context7CompatibleLibraryID: "<resolved-id>",
  topic: "<pattern-topic>",
  mode: "code"
})
```

**Auth patterns:**

```
better-auth_search({ query: "<pattern-description>" })
```

**UI patterns:**

```
shadcn_view_items_in_registries({ items: ["@shadcn/<component>"] })
```

**Validation Decision:**

- Docs CONFIRM pattern → Classify as Good Pattern
- Docs CONTRADICT pattern → Classify as Anti-Pattern
- Docs SILENT → Mark as candidate, needs review
- Pattern already in SKILLS → Update usage stats only

### Step 7: Classification

For each validated pattern, determine:

| Classification          | Criteria                    | Action                  |
| ----------------------- | --------------------------- | ----------------------- |
| Good Pattern (New)      | Docs confirm, not in SKILLS | Add to PATTERNS.md      |
| Good Pattern (Existing) | Already documented          | Update stats            |
| Anti-Pattern (New)      | Docs contradict             | Add to ANTI_PATTERNS.md |
| Anti-Pattern (Known)    | Already documented          | Update stats            |
| Gap                     | No SKILL covers this        | Note for new SKILL      |
| Reject                  | Not relevant to stack       | Skip                    |

### Step 8: Codification

**For Good Patterns**, add to appropriate PATTERNS.md:

````markdown
## Pattern: [Descriptive Name]

**Category**: [Runtime/Resource/Binding/Edge/Auth/UI]
**Confidence**: [High/Medium] (validated via [MCP source])
**Maturity**: candidate
**Source**: https://github.com/<owner>/<repo>

### Problem

[What goes wrong without this pattern]

### Solution

[The correct approach]

### Example

```typescript
[Code from the analyzed repo]
```
````

### Validation

[The MCP query and response that validated this]

### Effectiveness

- Success: 0
- Failure: 0
- Last validated: [today's date]
- Discovered in: 1 repos

````

**For Anti-Patterns**, add to appropriate ANTI_PATTERNS.md:

```markdown
## Anti-Pattern: [Descriptive Name]

**Category**: [Runtime/Resource/Binding/Edge/Auth/UI]
**Severity**: [Critical/Warning/Info]
**Source**: https://github.com/<owner>/<repo>

### Problem

[What the anti-pattern looks like]

### Why It's Wrong

[Explanation with docs reference]

### Fix

[The correct approach]

### Detection

````

[Regex or AST pattern to find this]

````

### Example

```typescript
// ❌ WRONG
[bad code from repo]

// ✅ CORRECT
[fixed version]
````

````

### Step 9: Generate Report

```markdown
# Repository Analysis: <owner/repo>

## Stack Compatibility

- [x/✗] Cloudflare Workers
- [x/✗] Tanstack Start
- [x/✗] shadcn/ui
- [x/✗] better-auth
- [x/✗] Hono
- [x/✗] Polar.sh

## Summary

| Category | Good Patterns | Anti-Patterns | Gaps |
|----------|---------------|---------------|------|
| Workers  | N             | N             | N    |
| Auth     | N             | N             | N    |
| UI       | N             | N             | N    |

## Good Patterns Discovered

### 1. [Pattern Name]
- **Category**: [Category]
- **Description**: [Brief description]
- **File**: [path/to/file.ts]

### 2. ...

## Anti-Patterns Found

### 1. [Anti-Pattern Name]
- **Category**: [Category]
- **Severity**: [Critical/Warning/Info]
- **Files**: [list of files]
- **Fix**: [Brief fix description]

### 2. ...

## Gaps Identified

- [Missing pattern or skill area]
- ...

## Actions Taken

- Added N patterns to `skills/cloudflare-workers/references/PATTERNS.md`
- Added N anti-patterns to `skills/durable-objects/references/ANTI_PATTERNS.md`
- ...

## Recommendations

1. [Suggested improvement]
2. [Suggested new skill]
3. ...
````

### Step 10: Post-Analysis Options

Present options to user:

**Question:** "Analysis complete. What would you like to do next?"

**Options:**

1. **Review changes** - Show git diff of skill updates
2. **Analyze another repo** - Continue with new target
3. **Create issues** - Add gaps to beads (`bd add`)
4. **Undo changes** - Revert skill file modifications
5. **Done** - End analysis session

---

## Examples

### Example 1: Analyze Specific Repo

Input: `/f-analyze-repo honojs/hono`

### Example 2: Discover by Topic

Input: `/f-analyze-repo --discover "cloudflare workers authentication"`

### Example 3: Batch Analysis

Input: `/f-analyze-repo --batch repos.txt`

Where `repos.txt` contains:

```
user/repo1
org/repo2
dev/repo3
```

---

## Error Handling

- **Repo not found**: Report error, suggest alternatives
- **Stack mismatch**: Report compatible parts, skip incompatible
- **MCP validation fails**: Mark pattern as "needs review"
- **Rate limited**: Pause and retry with backoff
