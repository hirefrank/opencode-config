---
name: implementation-analyzer
description: Proactive pattern discovery from external repositories. Analyzes codebases implementing the f-stack to find good patterns, anti-patterns, and gaps. Activates when analyzing repos, discovering patterns, auditing implementations, or learning from OSS.
---

# Implementation Analyzer SKILL

## Purpose

Proactively analyze external repositories to discover patterns that should be added to the SKILLS knowledge base. This is the "Reverse Feedback Codifier" - instead of waiting for feedback, it actively seeks patterns from real-world implementations.

## Activation Patterns

This SKILL automatically activates when:

- User wants to analyze an external repository
- Discovering patterns from OSS implementations
- Auditing a codebase for f-stack compliance
- Learning from real-world implementations
- Phrases like "analyze this repo", "find patterns in", "what can we learn from"

---

## Core Workflow

### Phase 1: Discovery

**Tools Used:**

- `repo-autopsy_clone` - Clone target repository
- `repo-autopsy_deps` - Analyze dependencies
- `repo-autopsy_structure` - Understand project layout
- `grep_app_searchGitHub` - Find repos by topic

**Stack Detection:**

```typescript
const STACK_SIGNATURES = {
  tanstackStart: ["@tanstack/start", "@tanstack/react-router"],
  cloudflareWorkers: ["wrangler.toml", "@cloudflare/workers-types"],
  shadcnUI: ["components.json", "@radix-ui/"],
  hono: ["hono"],
  betterAuth: ["better-auth"],
  polar: ["@polar-sh/"],
};
```

### Phase 2: Pattern Extraction

**Tools Used:**

- `repo-autopsy_search` - Regex pattern search
- `repo-autopsy_ast` - AST-based structural search
- `repo-autopsy_hotspots` - Find high-value files
- `repo-autopsy_file` - Read specific files

**Pattern Categories:**

| Category        | Good Pattern Signals                        | Anti-Pattern Signals          |
| --------------- | ------------------------------------------- | ----------------------------- |
| Workers Runtime | `env.KV`, `env.R2`, `expirationTtl`         | `process.env`, `Buffer`, `fs` |
| Durable Objects | `acceptWebSocket`, `setAlarm`, `idFromName` | `newUniqueId()`, `setTimeout` |
| Auth            | `betterAuth()`, `d1Adapter`, `getSession`   | Hardcoded secrets             |
| UI              | `cn()`, `variant=`, `asChild`               | `style={{}}`, `color=`        |

### Phase 3: Validation

**Tools Used:**

- `context7_get-library-docs` - Official documentation
- `better-auth_search` - Auth pattern validation
- `shadcn_view_items_in_registries` - UI component validation
- `ubs_check_workers` - Workers compatibility check

**Validation Rules:**

1. Every pattern MUST be validated against official docs
2. Patterns contradicting docs become anti-patterns
3. Patterns not in docs are marked as "candidate"
4. Existing SKILLS patterns get usage stats updated

### Phase 4: Classification

| Outcome                 | Criteria                    | Action                  |
| ----------------------- | --------------------------- | ----------------------- |
| Good Pattern (New)      | Docs confirm, not in SKILLS | Add to PATTERNS.md      |
| Good Pattern (Existing) | Already documented          | Update usage stats      |
| Anti-Pattern (New)      | Docs contradict             | Add to ANTI_PATTERNS.md |
| Anti-Pattern (Known)    | Already documented          | Update stats            |
| Gap                     | No SKILL covers domain      | Propose new SKILL       |
| Reject                  | Not relevant to stack       | Skip                    |

### Phase 5: Codification

**Storage Locations:**

| Pattern Type     | File                                                |
| ---------------- | --------------------------------------------------- |
| Workers Runtime  | `skill/cloudflare-workers/references/PATTERNS.md`   |
| Durable Objects  | `skill/durable-objects/references/PATTERNS.md`      |
| DO Anti-Patterns | `skill/durable-objects/references/ANTI_PATTERNS.md` |
| Auth             | `skill/better-auth/references/PATTERNS.md`          |
| UI               | `skill/shadcn-ui/references/PATTERNS.md`            |
| Tanstack         | `skill/tanstack-start/references/PATTERNS.md`       |

---

## Pattern Format

### Good Pattern

```markdown
## Pattern: [Name]

**Category**: Runtime/Resource/Binding/Edge/Auth/UI
**Confidence**: High/Medium (validated via MCP)
**Maturity**: candidate/established/proven
**Source**: [Repository URL]

### Problem

[What goes wrong without this pattern]

### Solution

[The correct approach]

### Example

[Code example]

### Validation

[MCP query that validated this pattern]

### Effectiveness

- Success: 0
- Failure: 0
- Last validated: [date]
- Discovered in: N repos
```

### Anti-Pattern

````markdown
## Anti-Pattern: [Name]

**Category**: Runtime/Resource/Binding/Edge/Auth/UI
**Severity**: Critical/Warning/Info
**Source**: [Repository URL]

### Problem

[What the anti-pattern looks like]

### Why It's Wrong

[Explanation with docs reference]

### Fix

[The correct approach]

### Detection

[Regex or AST pattern to find this]

### Example

```typescript
// ❌ WRONG
[bad code]

// ✅ CORRECT
[good code]
```
````

```

---

## Integration Points

### Complementary Components

- **feedback-codifier agent**: Reactive pattern codification (from chat)
- **code-reviewer SKILL**: Uses patterns for review
- **cloudflare-workers SKILL**: Stores Workers patterns
- **durable-objects SKILL**: Stores DO patterns
- **better-auth SKILL**: Stores auth patterns
- **shadcn-ui SKILL**: Stores UI patterns

### Tools Required

- `repo-autopsy_*` - Repository analysis suite
- `context7_*` - Documentation queries
- `better-auth_*` - Auth validation
- `shadcn_*` - UI validation
- `grep_app_*` - GitHub code search
- `ubs_*` - Code scanning

### Escalation Triggers

- Complex architectural patterns → `@oracle` agent
- UI/UX patterns → `@frontend-ui-ux-engineer` agent
- Documentation gaps → `@document-writer` agent

---

## Usage Examples

### Analyze Specific Repository

```

/f-analyze-repo honojs/hono

```

### Discover Repos by Topic

```

/f-analyze-repo --discover "cloudflare workers tanstack"

```

### Batch Analysis

```

/f-analyze-repo --batch repos-to-analyze.txt

```

---

## Relationship to Feedback Codifier

| Aspect | Feedback Codifier | Implementation Analyzer |
|--------|-------------------|------------------------|
| **Trigger** | Reactive (chat feedback) | Proactive (repo analysis) |
| **Input** | User comments, reviews | External repositories |
| **Discovery** | Patterns mentioned in chat | Patterns found in code |
| **Validation** | Same (MCP cross-reference) | Same (MCP cross-reference) |
| **Output** | Same (SKILL reference files) | Same (SKILL reference files) |

Both systems share:
- Pattern Format specification
- Validation workflow (MCP queries)
- Storage locations (skill reference files)
- Confidence scoring system
- Maturity progression

---

## Benefits

### Immediate Impact

- Discover patterns from battle-tested implementations
- Find anti-patterns before they enter your codebase
- Learn from the broader f-stack community

### Long-term Value

- Continuously growing knowledge base
- Patterns validated against real usage
- Reduced time debugging common issues
- Better code review coverage

---

## Quality Checklist

Before codifying a pattern:

- [ ] Pattern validated against official docs (context7/MCP)
- [ ] Pattern follows our stack requirements
- [ ] Pattern not already in SKILLS (or updates stats)
- [ ] Code example is correct and complete
- [ ] Anti-pattern includes fix
- [ ] Source repository is credited
```
