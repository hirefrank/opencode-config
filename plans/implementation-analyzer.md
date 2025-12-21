# Implementation Analyzer - Reverse Feedback Codifier

## Executive Summary

The **Implementation Analyzer** is a proactive pattern discovery system that analyzes external repositories implementing the f-stack (Tanstack Start, Cloudflare Workers, shadcn/ui, etc.) to:

1. **Discover good patterns** → Add to SKILLS as validated patterns
2. **Identify anti-patterns** → Add to SKILLS as warnings with fixes
3. **Find gaps** → Propose new skills or skill enhancements

Unlike the reactive `feedback-codifier` (which processes chat feedback), the Implementation Analyzer **proactively scans codebases** to learn from real-world implementations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION ANALYZER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   DISCOVER   │───▶│   ANALYZE    │───▶│   VALIDATE   │                   │
│  │              │    │              │    │              │                   │
│  │ repo-autopsy │    │ Pattern      │    │ context7     │                   │
│  │ librarian    │    │ Extraction   │    │ better-auth  │                   │
│  │ grep_app     │    │ AST Analysis │    │ shadcn MCP   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         CLASSIFICATION                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ GOOD PATTERN│  │ANTI-PATTERN │  │    GAP      │  │   REJECT    │  │   │
│  │  │ Add to SKILL│  │Add + Fix    │  │New SKILL?   │  │ Not relevant│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         CODIFICATION                                  │   │
│  │  skills/cloudflare-workers/references/PATTERNS.md                     │   │
│  │  skills/durable-objects/references/ANTI_PATTERNS.md                   │   │
│  │  skills/[new-skill]/SKILL.md                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Discovery

### 1.1 Repository Sources

The analyzer discovers repos through multiple channels:

| Source              | Method                      | Use Case                        |
| ------------------- | --------------------------- | ------------------------------- |
| **Direct URL**      | User provides `owner/repo`  | Analyze specific implementation |
| **grep.app Search** | `grep_app_searchGitHub`     | Find repos using our stack      |
| **GitHub Topics**   | `gh api`                    | Discover by topic tags          |
| **Librarian Agent** | `call_omo_agent(librarian)` | Find OSS examples               |

### 1.2 Stack Detection

Before deep analysis, verify the repo uses our stack:

```typescript
// Stack detection queries
const STACK_SIGNATURES = {
  tanstackStart: ["@tanstack/start", "@tanstack/react-router"],
  cloudflareWorkers: ["wrangler.toml", "@cloudflare/workers-types"],
  shadcnUI: ["components.json", "@radix-ui/"],
  hono: ["hono", "Hono"],
  betterAuth: ["better-auth", "@better-auth/"],
  polar: ["@polar-sh/", "polar.sh"],
  tailwind4: ["tailwindcss@4", "@tailwindcss/"],
};
```

### 1.3 Discovery Command

```bash
/f-analyze-repo <owner/repo>           # Analyze specific repo
/f-analyze-repo --discover <topic>     # Find and analyze repos by topic
/f-analyze-repo --batch <file.txt>     # Analyze list of repos
```

---

## Phase 2: Analysis

### 2.1 Pattern Extraction

Use `repo-autopsy` tools to extract patterns:

```typescript
// Analysis pipeline
async function analyzeRepo(repo: string) {
  // 1. Clone and get structure
  await repo_autopsy_clone({ repo });
  const structure = await repo_autopsy_structure({ repo, depth: 4 });
  const deps = await repo_autopsy_deps({ repo });

  // 2. Stack-specific pattern searches
  const patterns = await Promise.all([
    // Cloudflare Workers patterns
    repo_autopsy_search({
      repo,
      pattern: "export default.*fetch",
      fileGlob: "*.ts",
    }),
    repo_autopsy_search({
      repo,
      pattern: "env\\.KV|env\\.R2|env\\.D1",
      fileGlob: "*.ts",
    }),
    repo_autopsy_ast({ repo, pattern: "process.env.$KEY", lang: "ts" }),

    // Auth patterns
    repo_autopsy_search({
      repo,
      pattern: "better-auth|betterAuth",
      fileGlob: "*.ts",
    }),

    // UI patterns
    repo_autopsy_search({
      repo,
      pattern: "cn\\(|className=",
      fileGlob: "*.tsx",
    }),

    // Anti-pattern detection
    repo_autopsy_search({
      repo,
      pattern: "import.*from [\"']fs[\"']",
      fileGlob: "*.ts",
    }),
    repo_autopsy_search({
      repo,
      pattern: "Buffer\\.from|Buffer\\.alloc",
      fileGlob: "*.ts",
    }),
  ]);

  return patterns;
}
```

### 2.2 Pattern Categories

| Category                  | Detection Method            | Example                       |
| ------------------------- | --------------------------- | ----------------------------- |
| **Runtime Compatibility** | AST search for Node.js APIs | `Buffer`, `fs`, `process.env` |
| **Resource Selection**    | Grep for binding usage      | KV vs DO for rate limiting    |
| **Binding Patterns**      | AST for env access          | `env.KV` vs `process.env`     |
| **Edge Optimization**     | Bundle analysis             | Import patterns, tree-shaking |
| **Auth Patterns**         | better-auth MCP             | Session handling, providers   |
| **UI Patterns**           | shadcn MCP                  | Component usage, props        |

### 2.3 Hotspot Analysis

Focus on high-value files:

```typescript
// Prioritize analysis on:
const hotspots = await repo_autopsy_hotspots({ repo });
// - Most changed files (likely core patterns)
// - Largest files (complex logic)
// - Files with TODOs/FIXMEs (known issues)
```

---

## Phase 3: Validation

### 3.1 MCP Cross-Reference

Every extracted pattern MUST be validated against official docs:

```typescript
async function validatePattern(pattern: ExtractedPattern) {
  // 1. Query official docs via context7
  const docs = await context7_get_library_docs({
    context7CompatibleLibraryID: pattern.library,
    topic: pattern.topic,
    mode: "code",
  });

  // 2. Check against existing SKILLS
  const existingPatterns = await readSkillPatterns(pattern.category);

  // 3. Validate with domain-specific MCP
  if (pattern.category === "auth") {
    const authDocs = await better_auth_search({ query: pattern.description });
  }
  if (pattern.category === "ui") {
    const uiDocs = await shadcn_view_items_in_registries({
      items: pattern.components,
    });
  }

  return {
    validated: docs.confirms(pattern),
    confidence: calculateConfidence(docs, existingPatterns),
    source: pattern.sourceRepo,
  };
}
```

### 3.2 Validation Matrix

| Pattern Type    | Primary Validation         | Secondary Validation        |
| --------------- | -------------------------- | --------------------------- |
| Workers Runtime | context7 (Cloudflare docs) | ubs_check_workers           |
| KV/R2/D1/DO     | context7 (Cloudflare docs) | cloudflare-bindings tools   |
| Auth            | better-auth MCP            | context7 (better-auth docs) |
| UI Components   | shadcn MCP                 | ui-validator tools          |
| Tanstack        | context7 (Tanstack docs)   | grep_app examples           |

### 3.3 Confidence Scoring

```typescript
interface PatternConfidence {
  docsMatch: number; // 0-1: Does official docs confirm?
  skillsMatch: number; // 0-1: Aligns with existing SKILLS?
  usageFrequency: number; // 0-1: How common in analyzed repos?
  recency: number; // 0-1: How recent is the pattern?

  // Computed
  overall: number; // Weighted average
  recommendation: "codify" | "review" | "reject";
}
```

---

## Phase 4: Classification

### 4.1 Decision Tree

```
Pattern Extracted
       │
       ▼
┌──────────────────┐
│ Docs Validation  │
│ (context7/MCP)   │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
  MATCH    CONTRADICT
    │         │
    ▼         ▼
┌────────┐ ┌────────────┐
│ Check  │ │ Check if   │
│ SKILLS │ │ anti-pattern│
└───┬────┘ └─────┬──────┘
    │            │
┌───┴───┐   ┌────┴────┐
│       │   │         │
NEW   EXISTS KNOWN   NEW
│       │   │         │
▼       ▼   ▼         ▼
ADD   UPDATE SKIP   ADD AS
PATTERN STATS       ANTI-PATTERN
```

### 4.2 Classification Outcomes

| Outcome                     | Criteria                              | Action             |
| --------------------------- | ------------------------------------- | ------------------ |
| **Good Pattern (New)**      | Docs confirm, not in SKILLS           | Add to PATTERNS.md |
| **Good Pattern (Existing)** | Already in SKILLS                     | Update usage stats |
| **Anti-Pattern (New)**      | Docs contradict, not in ANTI_PATTERNS | Add with fix       |
| **Anti-Pattern (Known)**    | Already documented                    | Update stats       |
| **Gap Identified**          | No SKILL covers this domain           | Propose new SKILL  |
| **Reject**                  | Not relevant to our stack             | Skip               |

---

## Phase 5: Codification

### 5.1 Pattern Format (from feedback-codifier.md)

```markdown
## Pattern: [Name]

**Category**: Runtime/Resource/Binding/Edge/Auth/UI
**Confidence**: High/Medium (validated via MCP)
**Maturity**: candidate/established/proven/deprecated
**Source**: [Repository where discovered]

### Problem

[What goes wrong without this pattern]

### Solution

[The correct approach]

### Example

[Code example showing correct usage]

### Validation

[MCP query that validated this pattern]

### Effectiveness

- Success: [count]
- Failure: [count]
- Last validated: [date]
- Discovered in: [repo count] repos
```

### 5.2 Anti-Pattern Format

````markdown
## Anti-Pattern: [Name]

**Category**: Runtime/Resource/Binding/Edge/Auth/UI
**Severity**: Critical/Warning/Info
**Source**: [Repository where discovered]

### Problem

[What the anti-pattern looks like]

### Why It's Wrong

[Explanation with docs reference]

### Fix

[The correct approach]

### Detection

[How to find this in code]

### Example

```typescript
// ❌ WRONG
[bad code]

// ✅ CORRECT
[good code]
```
````

````

### 5.3 Storage Locations

| Pattern Type | Storage Location |
|--------------|-----------------|
| Workers Runtime | `skills/cloudflare-workers/references/PATTERNS.md` |
| Durable Objects | `skills/durable-objects/references/PATTERNS.md` |
| DO Anti-Patterns | `skills/durable-objects/references/ANTI_PATTERNS.md` |
| Auth Patterns | `skills/better-auth/references/PATTERNS.md` |
| UI Patterns | `skills/shadcn-ui/references/PATTERNS.md` |
| Tanstack Patterns | `skills/tanstack-start/references/PATTERNS.md` |

---

## Implementation Plan

### New Files to Create

#### 1. Agent Definition: `agent/implementation-analyzer.md`

```markdown
---
name: implementation-analyzer
tier: 1
model: anthropic/claude-opus-4-5
temperature: 0.3
description: Proactive pattern discovery from external repositories
---

# Implementation Analyzer - Reverse Feedback Codifier

You analyze external repositories to discover patterns for the f-stack.

## Core Workflow

1. **Discover** - Clone and analyze target repo
2. **Extract** - Find patterns using repo-autopsy tools
3. **Validate** - Cross-reference with MCP (context7, better-auth, shadcn)
4. **Classify** - Good pattern, anti-pattern, or gap
5. **Codify** - Write to appropriate SKILL reference file

## Stack Requirements

Only analyze patterns for:
- Tanstack Start (NOT Next.js, Remix)
- Cloudflare Workers (NOT Vercel, Netlify)
- shadcn/ui (NOT Material UI, Chakra)
- Hono (NOT Express, Fastify)
- better-auth (NOT Auth.js, Lucia)
- Polar.sh (NOT Stripe direct)

## Validation Rules

NEVER codify a pattern without MCP validation:
- Workers patterns → context7 Cloudflare docs
- Auth patterns → better-auth MCP
- UI patterns → shadcn MCP

## Output Format

Write patterns to skill reference files following the Pattern Format.
````

#### 2. Command: `command/f-analyze-repo.md`

```markdown
---
description: Analyze external repositories to discover patterns for the f-stack
---

# Repository Analysis Command

You are the Implementation Analyzer. Your job is to proactively discover patterns from external repositories.

## Input

{{PROMPT}}

## Workflow

### Step 1: Repository Discovery

If a specific repo is provided:
```

repo-autopsy_clone({ repo: "<provided-repo>" })

```

If `--discover <topic>` is provided:
```

grep_app_searchGitHub({ query: "<topic>", language: ["TypeScript", "TSX"] })

```

### Step 2: Stack Verification

Verify the repo uses our stack:
```

repo-autopsy_deps({ repo })
repo-autopsy_search({ repo, pattern: "wrangler.toml|@tanstack/start|better-auth" })

```

If stack doesn't match, report and skip.

### Step 3: Pattern Extraction

Run parallel searches:
```

// Workers patterns
repo-autopsy_ast({ repo, pattern: "export default { async fetch($$$) { $$$ } }", lang: "ts" })

// Anti-patterns
repo-autopsy_search({ repo, pattern: "process\\.env\\.", fileGlob: "*.ts" })
repo-autopsy_search({ repo, pattern: "import.*from ['\"]fs['\"]", fileGlob: "\*.ts" })

// Auth patterns
repo-autopsy_search({ repo, pattern: "betterAuth|better-auth", fileGlob: "\*.ts" })

// UI patterns
repo-autopsy_search({ repo, pattern: "cn\\(|className=", fileGlob: "\*.tsx" })

```

### Step 4: Validation

For each extracted pattern:
```

context7_get_library_docs({ context7CompatibleLibraryID: "<library>", topic: "<pattern>" })

````

### Step 5: Classification & Codification

Based on validation:
- **Good Pattern** → Add to `skills/<category>/references/PATTERNS.md`
- **Anti-Pattern** → Add to `skills/<category>/references/ANTI_PATTERNS.md`
- **Gap** → Propose new skill in report

### Step 6: Report

Generate analysis report:
```markdown
# Repository Analysis: <repo>

## Stack Compatibility
- [x] Cloudflare Workers
- [x] Tanstack Start
- [ ] shadcn/ui (not detected)

## Patterns Discovered

### Good Patterns (3)
1. **KV TTL Usage** - Always sets expirationTtl
2. **DO Hibernation** - Uses state.acceptWebSocket
3. **Env Bindings** - Proper env parameter usage

### Anti-Patterns (2)
1. **process.env Usage** - Found in 3 files
2. **In-memory State** - Found in 1 Durable Object

### Gaps Identified
- No rate limiting implementation found
- Missing error boundary patterns

## Actions Taken
- Added 2 patterns to skills/cloudflare-workers/references/PATTERNS.md
- Added 1 anti-pattern to skills/durable-objects/references/ANTI_PATTERNS.md

## Recommendations
- Consider adding rate-limiting skill
- Review error handling patterns
````

## Post-Analysis Options

After generating the report, ask:

1. **Review changes** - Show diff of skill updates
2. **Analyze another repo** - Continue with new target
3. **Create issue** - Add gaps to beads
4. **Done** - End analysis session

````

#### 3. Skill: `skills/implementation-analyzer/SKILL.md`

```markdown
---
name: implementation-analyzer
description: Proactive pattern discovery from external repositories. Analyzes codebases implementing the f-stack to find good patterns, anti-patterns, and gaps. Activates when analyzing repos, discovering patterns, or auditing implementations.
triggers:
  - "analyze repo"
  - "discover patterns"
  - "audit implementation"
  - "reverse feedback"
  - "learn from repo"
  - "pattern discovery"
  - "implementation audit"
---

# Implementation Analyzer SKILL

## Purpose

Proactively analyze external repositories to discover patterns that should be added to the SKILLS knowledge base.

## Activation Patterns

This SKILL activates when:
- User wants to analyze an external repository
- Discovering patterns from OSS implementations
- Auditing a codebase for f-stack compliance
- Learning from real-world implementations

## Workflow

### 1. Discovery Phase
- Clone target repo with `repo-autopsy_clone`
- Verify stack compatibility
- Identify hotspots with `repo-autopsy_hotspots`

### 2. Analysis Phase
- Extract patterns with AST and regex searches
- Categorize by domain (Workers, Auth, UI, etc.)
- Identify potential anti-patterns

### 3. Validation Phase
- Cross-reference with official docs (context7)
- Validate with domain MCPs (better-auth, shadcn)
- Check against existing SKILLS

### 4. Codification Phase
- Add validated patterns to PATTERNS.md files
- Add anti-patterns with fixes to ANTI_PATTERNS.md
- Propose new skills for gaps

## Integration Points

### Tools Used
- `repo-autopsy_*` - Repository analysis
- `context7_*` - Documentation validation
- `better-auth_*` - Auth pattern validation
- `shadcn_*` - UI pattern validation
- `grep_app_*` - Pattern discovery across GitHub

### Related Components
- **feedback-codifier agent** - Reactive pattern codification
- **code-reviewer SKILL** - Code review patterns
- **cloudflare-workers SKILL** - Workers patterns storage
````

### Configuration Updates

#### Update `opencode.jsonc`

```jsonc
{
  // ... existing config ...

  "command": {
    // ... existing commands ...
    "f-analyze-repo": {
      "template": "command/f-analyze-repo.md",
      "description": "Analyze external repositories to discover patterns",
    },
  },

  "agent": {
    // ... existing agents ...
    "implementation-analyzer": {
      "model": "anthropic/claude-opus-4-5",
      "temperature": 0.3,
      "description": "Proactive pattern discovery from external repositories",
    },
  },
}
```

---

## Usage Examples

### Example 1: Analyze Specific Repo

```bash
/f-analyze-repo honojs/hono
```

Output:

```
Analyzing honojs/hono...

Stack Detection:
- [x] Cloudflare Workers (wrangler.toml found)
- [x] TypeScript
- [ ] Tanstack Start (not detected - this is a backend framework)

Patterns Discovered:
1. Middleware chaining pattern
2. Context type inference
3. Route grouping

Anti-Patterns: None detected

Gaps:
- No auth integration examples
- No D1 usage patterns

Actions:
- Added 3 patterns to skills/hono/references/PATTERNS.md
```

### Example 2: Discover Repos by Topic

```bash
/f-analyze-repo --discover "cloudflare workers tanstack"
```

Output:

```
Searching for repos with "cloudflare workers tanstack"...

Found 5 relevant repos:
1. user/tanstack-workers-template (87 stars)
2. org/f-stack-starter (45 stars)
3. dev/cf-tanstack-demo (23 stars)
...

Analyzing top 3...
[Analysis continues]
```

### Example 3: Batch Analysis

```bash
/f-analyze-repo --batch repos-to-analyze.txt
```

---

## Relationship to Feedback Codifier

| Aspect         | Feedback Codifier            | Implementation Analyzer      |
| -------------- | ---------------------------- | ---------------------------- |
| **Trigger**    | Reactive (chat feedback)     | Proactive (repo analysis)    |
| **Input**      | User comments, reviews       | External repositories        |
| **Discovery**  | Patterns mentioned in chat   | Patterns found in code       |
| **Validation** | Same (MCP cross-reference)   | Same (MCP cross-reference)   |
| **Output**     | Same (SKILL reference files) | Same (SKILL reference files) |

Both systems share:

- Pattern Format specification
- Validation workflow (MCP queries)
- Storage locations (skill reference files)
- Confidence scoring system

---

## Success Metrics

| Metric                       | Target           |
| ---------------------------- | ---------------- |
| Patterns discovered per repo | 3-10             |
| Validation accuracy          | > 90%            |
| False positive rate          | < 10%            |
| Time per repo analysis       | < 5 minutes      |
| Skill coverage improvement   | +20% per quarter |

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- [ ] Create `agent/implementation-analyzer.md`
- [ ] Create `command/f-analyze-repo.md`
- [ ] Create `skills/implementation-analyzer/SKILL.md`
- [ ] Update `opencode.jsonc`

### Phase 2: Pattern Extraction (Week 2)

- [ ] Implement stack detection logic
- [ ] Create pattern extraction queries
- [ ] Build anti-pattern detection rules

### Phase 3: Validation Pipeline (Week 3)

- [ ] Integrate context7 validation
- [ ] Integrate better-auth MCP
- [ ] Integrate shadcn MCP
- [ ] Build confidence scoring

### Phase 4: Codification (Week 4)

- [ ] Implement pattern writing to SKILLS
- [ ] Implement anti-pattern writing
- [ ] Build gap detection and reporting

### Phase 5: Testing & Refinement (Week 5)

- [ ] Test on 10+ real repos
- [ ] Refine detection accuracy
- [ ] Document edge cases

---

## Appendix: Pattern Detection Queries

### Cloudflare Workers

```typescript
// Good patterns
"export default { async fetch"; // Proper handler
"env\\.KV\\.put.*expirationTtl"; // KV with TTL
"state\\.acceptWebSocket"; // Hibernation-safe WS
"state\\.storage\\.setAlarm"; // Proper alarms

// Anti-patterns
"process\\.env\\."; // Node.js env
"import.*from ['\"]fs['\"]"; // Node.js fs
"Buffer\\."; // Node.js Buffer
"new Map\\(\\).*=.*new Map"; // In-memory state
"setTimeout|setInterval"; // Non-hibernation timers
```

### Auth (better-auth)

```typescript
// Good patterns
"betterAuth\\("; // Proper initialization
"auth\\.api\\.getSession"; // Session handling
"signIn|signOut|signUp"; // Auth flows

// Anti-patterns
"password.*=.*['\"]"; // Hardcoded passwords
"jwt\\.sign.*secret.*['\"]"; // Hardcoded JWT secrets
```

### UI (shadcn)

```typescript
// Good patterns
"cn\\("; // Utility usage
"className=\\{cn\\("; // Proper class merging
"variant=|size="; // Proper props

// Anti-patterns
"style=\\{\\{"; // Inline styles
"!important"; // CSS overrides
"color=|loading="; // Hallucinated props
```
