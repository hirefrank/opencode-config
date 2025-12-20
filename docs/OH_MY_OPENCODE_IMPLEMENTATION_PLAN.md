# Implementation Plan: oh-my-opencode Extension

Leverage oh-my-opencode as the foundation, extend with trigger-based skill selection and beads integration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Workflow                        │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              oh-my-opencode (base plugin)               │
│  • 7 curated agents (Sisyphus, Oracle, etc.)           │
│  • 21 hooks                                             │
│  • find_skills / use_skills                             │
│  • Background agents                                    │
│  • LSP/AST-Grep tools                                   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│           edge-stack-extension (your plugin)            │
│  • Trigger-based skill matching                         │
│  • Beads sync hook                                      │
│  • Enhanced skill format                                │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Search Tools                          │
│  • grep      → exact pattern matching                   │
│  • mgrep     → semantic LOCAL code search               │
│  • grep_app  → GitHub/public code search (MCP)          │
│  • AST-Grep  → structural code patterns                 │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   OpenCode (platform)                   │
│  • Streaming, providers, error handling                 │
└─────────────────────────────────────────────────────────┘
```

---

## Search Tools Reference

Four complementary search tools for different use cases:

| Tool | Searches | Use Case | Example |
|------|----------|----------|---------|
| `grep` | Local code (exact) | Find literal strings | `grep "TODO" src/` |
| `mgrep` | Local code (semantic) | Find by intent | `mgrep "error handling logic"` |
| `grep_app` | GitHub (MCP) | Find public examples | Via oh-my-opencode MCP |
| `AST-Grep` | Local code (structural) | Refactoring patterns | Via oh-my-opencode tools |

### mgrep Installation

```bash
# Via Homebrew
brew install mixedbread-ai/tap/mgrep

# Via npm
npm install -g @mixedbread-ai/mgrep
```

### When to Use Each

```
"Find where TODO comments exist"
  → grep "TODO"                    # Exact match

"Find error handling logic"
  → mgrep "error handling"         # Semantic, local

"Find examples of rate limiting in open source"
  → grep_app MCP                   # GitHub search

"Find all async functions returning Promise<void>"
  → AST-Grep pattern               # Structural
```

### mgrep Examples

```bash
# Find authentication flow
mgrep "authentication flow"

# Find where errors are handled
mgrep "how errors are handled"

# Find API endpoints
mgrep "REST endpoints for users"

# Scope to directory
mgrep "database queries" src/db/

# Scope to file type
mgrep "state management" --glob "*.ts"
```

### Token Efficiency

mgrep reduces token usage ~2x compared to grep-based exploration:
- `grep` returns raw matches requiring AI interpretation
- `mgrep` returns semantically relevant results pre-filtered

---

## Phase 1: Setup & Trigger-Based Skill Matching (1 day)

### 1.1 Install oh-my-opencode

```bash
# Add to opencode.json
{
  "plugin": ["oh-my-opencode"]
}

# Or install globally
opencode plugin add oh-my-opencode
```

### 1.2 Configure oh-my-opencode

Create/update `~/.config/opencode/oh-my-opencode.json`:

```jsonc
{
  // Use their agents or disable to use yours
  "disabled_agents": [],

  // Keep their hooks
  "disabled_hooks": [],

  // Enable skill tools
  "claude_code": {
    "skills": true,
    "commands": true
  },

  // MCP servers (they pre-configure these)
  "mcp": {
    "context7": true,
    "exa": true,
    "grep_app": true
  }
}
```

### 1.3 Add Triggers to Skills

Update each skill's SKILL.md with trigger keywords:

```yaml
# skills/durable-objects/SKILL.md
---
name: durable-objects
description: Stateful coordination on Cloudflare Workers edge
triggers:
  - "rate limit"
  - "rate limiting"
  - "concurrent"
  - "websocket"
  - "realtime"
  - "coordination"
  - "state machine"
  - "singleton"
  - "actor model"
  - "strong consistency"
allowed-tools: Bash(wrangler:*) Read Write
---
```

```yaml
# skills/tanstack-start/SKILL.md
---
name: tanstack-start
description: Full-stack React with SSR and Server Functions
triggers:
  - "tanstack"
  - "route"
  - "routing"
  - "ssr"
  - "server function"
  - "server component"
  - "file-based routing"
  - "loader"
  - "action"
allowed-tools: Bash(npm:*) Bash(pnpm:*) Read Write
---
```

```yaml
# skills/better-auth/SKILL.md
---
name: better-auth
description: Authentication with D1 database support
triggers:
  - "auth"
  - "authentication"
  - "login"
  - "oauth"
  - "session"
  - "jwt"
  - "user"
  - "signup"
  - "password"
allowed-tools: Bash(wrangler:*) Read Write
---
```

```yaml
# skills/shadcn-ui/SKILL.md
---
name: shadcn-ui
description: Component library with Radix primitives
triggers:
  - "component"
  - "button"
  - "form"
  - "modal"
  - "dialog"
  - "dropdown"
  - "shadcn"
  - "radix"
  - "ui"
  - "design system"
allowed-tools: Bash(npx:*) Read Write
---
```

```yaml
# skills/polar-billing/SKILL.md
---
name: polar-billing
description: Subscription billing with Polar.sh
triggers:
  - "billing"
  - "subscription"
  - "payment"
  - "pricing"
  - "checkout"
  - "polar"
  - "monetize"
  - "plan"
  - "tier"
allowed-tools: Read Write
---
```

```yaml
# skills/cloudflare-workers/SKILL.md
---
name: cloudflare-workers
description: Edge-first serverless functions
triggers:
  - "worker"
  - "cloudflare"
  - "edge"
  - "kv"
  - "r2"
  - "d1"
  - "binding"
  - "wrangler"
  - "deploy"
allowed-tools: Bash(wrangler:*) Read Write
---
```

### 1.4 Skill Trigger Matcher

Create a simple trigger matcher that oh-my-opencode can use:

```typescript
// .opencode/skill-matcher.ts
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

interface Skill {
  name: string;
  description: string;
  triggers: string[];
  path: string;
}

export function loadSkills(skillsDir: string): Skill[] {
  const skills: Skill[] = [];

  for (const dir of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;

    const skillPath = join(skillsDir, dir.name, "SKILL.md");
    try {
      const content = readFileSync(skillPath, "utf-8");
      const { data } = matter(content);

      skills.push({
        name: data.name || dir.name,
        description: data.description || "",
        triggers: data.triggers || [],
        path: skillPath,
      });
    } catch {
      // Skip if no SKILL.md
    }
  }

  return skills;
}

export function matchSkills(task: string, skills: Skill[]): Skill[] {
  const taskLower = task.toLowerCase();

  return skills.filter(skill =>
    skill.triggers.some(trigger =>
      taskLower.includes(trigger.toLowerCase())
    )
  );
}

// CLI usage
if (import.meta.main) {
  const skills = loadSkills("skills/");
  const task = process.argv[2] || "";
  const matches = matchSkills(task, skills);

  console.log("Matching skills:");
  matches.forEach(s => console.log(`  - ${s.name}: ${s.triggers.join(", ")}`));
}
```

**Test it:**
```bash
bun .opencode/skill-matcher.ts "design a rate limiter for the API"
# → durable-objects, cloudflare-workers

bun .opencode/skill-matcher.ts "add GitHub OAuth login"
# → better-auth

bun .opencode/skill-matcher.ts "create a pricing page component"
# → shadcn-ui, polar-billing
```

---

## Phase 2: Knowledge Migration (2 days)

### 2.1 Enhanced Skill Structure

Each skill gets additional files:

```
skills/durable-objects/
├── SKILL.md              # Quick reference + triggers
├── PATTERNS.md           # Validated patterns (from agent)
├── ANTI_PATTERNS.md      # What NOT to do
├── DECISION_TREE.md      # When to use DO vs KV vs D1
└── EXAMPLES/
    ├── rate-limiter.ts
    ├── websocket-hub.ts
    └── counter.ts
```

### 2.2 Migration Checklist

| Agent File | Target Skill | Status |
|------------|--------------|--------|
| `agent/cloudflare/durable-objects.md` | `skills/durable-objects/` | [ ] |
| `agent/tanstack/tanstack-ui-architect.md` | `skills/tanstack-start/` | [ ] |
| `agent/tanstack/frontend-design-specialist.md` | `skills/shadcn-ui/` | [ ] |
| `agent/integrations/better-auth-specialist.md` | `skills/better-auth/` | [ ] |
| `agent/integrations/polar-billing-specialist.md` | `skills/polar-billing/` | [ ] |
| `agent/reviewer.md` (partial) | `skills/code-reviewer/` | [ ] |

### 2.3 Migration Script

```bash
#!/bin/bash
# scripts/migrate-agent-to-skill.sh

AGENT_FILE=$1
SKILL_DIR=$2

if [ -z "$AGENT_FILE" ] || [ -z "$SKILL_DIR" ]; then
  echo "Usage: ./migrate-agent-to-skill.sh <agent-file> <skill-dir>"
  exit 1
fi

mkdir -p "$SKILL_DIR/EXAMPLES"

# Extract sections using awk
echo "Migrating $AGENT_FILE → $SKILL_DIR"

# Create PATTERNS.md from "## Patterns" or "## Best Practices" sections
awk '/^## (Patterns|Best Practices|Validated|Recommended)/,/^## [^P]/' "$AGENT_FILE" > "$SKILL_DIR/PATTERNS.md"

# Create ANTI_PATTERNS.md from "## Anti" or "## Common Mistakes" sections
awk '/^## (Anti|Common Mistakes|Pitfalls|Avoid)/,/^## [^A]/' "$AGENT_FILE" > "$SKILL_DIR/ANTI_PATTERNS.md"

# Extract code blocks as examples
grep -Pzo '```typescript\n[\s\S]*?```' "$AGENT_FILE" | head -500 > "$SKILL_DIR/EXAMPLES/extracted.ts"

echo "✅ Migrated. Review and clean up the extracted files."
```

### 2.4 Example: Migrated durable-objects Skill

**skills/durable-objects/PATTERNS.md:**
```markdown
# Durable Objects Patterns

## Singleton Pattern

Use a fixed ID for global singletons:

```typescript
const id = env.RATE_LIMITER.idFromName("global");
const stub = env.RATE_LIMITER.get(id);
```

## Alarm Pattern

Schedule future work without external triggers:

```typescript
export class MyDO implements DurableObject {
  async alarm() {
    // Runs at scheduled time
    await this.processQueue();

    // Reschedule if needed
    const storage = this.ctx.storage;
    await storage.setAlarm(Date.now() + 60_000);
  }
}
```

## State Coalescing

Batch writes to reduce I/O:

```typescript
async increment(key: string, amount: number) {
  const current = await this.ctx.storage.get<number>(key) ?? 0;
  await this.ctx.storage.put(key, current + amount);
}

// Better: use transaction
async incrementBatch(updates: Map<string, number>) {
  await this.ctx.storage.transaction(async (txn) => {
    for (const [key, amount] of updates) {
      const current = await txn.get<number>(key) ?? 0;
      await txn.put(key, current + amount);
    }
  });
}
```
```

**skills/durable-objects/ANTI_PATTERNS.md:**
```markdown
# Durable Objects Anti-Patterns

## ❌ In-Memory State Without Persistence

```typescript
// WRONG: State lost on eviction
export class BadDO {
  private cache = new Map();  // Dies when DO hibernates

  async fetch(request: Request) {
    this.cache.set("key", "value");  // Lost!
  }
}

// RIGHT: Use storage
export class GoodDO {
  async fetch(request: Request) {
    await this.ctx.storage.put("key", "value");  // Persisted
  }
}
```

## ❌ Blocking the Event Loop

```typescript
// WRONG: Blocks all requests to this DO
export class BadDO {
  async fetch(request: Request) {
    for (let i = 0; i < 1_000_000; i++) {
      // CPU-intensive work blocks other requests
    }
  }
}

// RIGHT: Use alarms for background work
export class GoodDO {
  async fetch(request: Request) {
    await this.ctx.storage.setAlarm(Date.now());
    return new Response("Scheduled");
  }

  async alarm() {
    // Heavy work happens here, not blocking fetch
  }
}
```

## ❌ Too Many Small DOs

```typescript
// WRONG: One DO per user action = millions of DOs
const id = env.COUNTER.idFromName(`user:${userId}:action:${actionId}`);

// RIGHT: One DO per user, stores all their actions
const id = env.COUNTER.idFromName(`user:${userId}`);
```
```

**skills/durable-objects/DECISION_TREE.md:**
```markdown
# When to Use Durable Objects

## Decision Flow

```
Need persistent state?
├── No → Use stateless Worker
└── Yes
    ├── Read-heavy, eventual consistency OK?
    │   └── Use KV
    ├── Need SQL queries/joins?
    │   └── Use D1
    ├── Large files (>25MB)?
    │   └── Use R2
    └── Need strong consistency / coordination?
        └── Use Durable Objects ✓
```

## Use Durable Objects For

| Use Case | Why DO? |
|----------|---------|
| Rate limiting | Strong consistency, per-key state |
| WebSocket rooms | Stateful connections, broadcasting |
| Distributed locks | Single-threaded guarantee |
| Counters | Atomic increments |
| Session state | Low-latency reads/writes |
| Collaboration | Real-time sync |

## Don't Use Durable Objects For

| Use Case | Use Instead |
|----------|-------------|
| Static content cache | KV |
| User profiles (read-heavy) | KV or D1 |
| File storage | R2 |
| Complex queries | D1 |
| Global config | KV |
```

---

## Phase 3: Beads Integration (1 day)

### 3.1 Beads Sync Hook

Create a hook that syncs TodoWrite with beads:

```typescript
// .opencode/hooks/beads-sync.ts
import { $ } from "bun";

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export async function onTodoWrite(todos: TodoItem[]): Promise<void> {
  // Find newly completed items
  const completed = todos.filter(t => t.status === "completed");

  for (const todo of completed) {
    // Check if this maps to a beads task
    const match = todo.content.match(/\(?(bd-[a-z0-9]+)\)?/i);
    if (match) {
      const taskId = match[1];
      try {
        await $`bd done ${taskId}`.quiet();
        console.log(`✅ Synced: ${taskId} marked done in beads`);
      } catch (error) {
        console.warn(`⚠️ Failed to sync ${taskId}: ${error.message}`);
      }
    }
  }
}

export async function onSessionStart(): Promise<void> {
  // Show available tasks at session start
  try {
    const result = await $`bd ready --limit 5`.quiet();
    if (result.stdout.toString().trim()) {
      console.log("\n📋 Available tasks:");
      console.log(result.stdout.toString());
    }
  } catch {
    // beads not installed or no tasks
  }
}
```

### 3.2 Register Hook with oh-my-opencode

Add to your oh-my-opencode config:

```jsonc
// ~/.config/opencode/oh-my-opencode.json
{
  "hooks": {
    "custom": [
      ".opencode/hooks/beads-sync.ts"
    ]
  }
}
```

Or create an OpenCode plugin:

```typescript
// .opencode/plugins/beads-integration.ts
import type { Plugin } from "opencode";
import { onTodoWrite, onSessionStart } from "../hooks/beads-sync";

export const BeadsPlugin: Plugin = async (ctx) => {
  // Run on session start
  await onSessionStart();

  return {
    async "tool.execute.after"({ tool, result }) {
      if (tool.name === "TodoWrite") {
        await onTodoWrite(result.todos);
      }
    }
  };
};
```

### 3.3 Beads Commands as Tools

Add beads shortcuts:

```typescript
// .opencode/tools/beads.ts
import { $ } from "bun";

export const beadsTools = {
  bd_ready: {
    description: "Show available beads tasks",
    schema: {},
    async execute() {
      const result = await $`bd ready`.text();
      return result;
    }
  },

  bd_claim: {
    description: "Claim a beads task",
    schema: { id: "string" },
    async execute({ id }: { id: string }) {
      await $`bd update ${id} --status in_progress`;
      return `Claimed ${id}`;
    }
  },

  bd_done: {
    description: "Mark a beads task as done",
    schema: { id: "string" },
    async execute({ id }: { id: string }) {
      await $`bd done ${id}`;
      return `Completed ${id}`;
    }
  },

  bd_create: {
    description: "Create a new beads task",
    schema: { title: "string", body: "string?" },
    async execute({ title, body }: { title: string; body?: string }) {
      const result = await $`bd create ${title} ${body ? `--body "${body}"` : ""}`.text();
      return result;
    }
  }
};
```

---

## Phase 4: Testing & Validation (0.5 day)

### 4.1 Trigger Matching Tests

```typescript
// tests/skill-matcher.test.ts
import { expect, test, describe } from "bun:test";
import { loadSkills, matchSkills } from "../.opencode/skill-matcher";

const skills = loadSkills("skills/");

describe("skill matching", () => {
  test("rate limiting → durable-objects", () => {
    const matches = matchSkills("design a rate limiter", skills);
    expect(matches.map(s => s.name)).toContain("durable-objects");
  });

  test("oauth → better-auth", () => {
    const matches = matchSkills("add GitHub OAuth", skills);
    expect(matches.map(s => s.name)).toContain("better-auth");
  });

  test("component → shadcn-ui", () => {
    const matches = matchSkills("create a button component", skills);
    expect(matches.map(s => s.name)).toContain("shadcn-ui");
  });

  test("vague query → no matches", () => {
    const matches = matchSkills("fix the bug", skills);
    expect(matches.length).toBe(0);
  });

  test("multiple triggers → multiple skills", () => {
    const matches = matchSkills("deploy worker with billing", skills);
    expect(matches.map(s => s.name)).toContain("cloudflare-workers");
    expect(matches.map(s => s.name)).toContain("polar-billing");
  });
});
```

Run:
```bash
bun test tests/skill-matcher.test.ts
```

### 4.2 Beads Integration Test

```bash
# Create test task
bd create "Test task for integration"

# Should appear in ready
bd ready | grep "Test task"

# Simulate TodoWrite completion (via OpenCode)
# → Should auto-sync to beads

# Verify
bd list | grep "Test task"  # Should show as done
```

### 4.3 oh-my-opencode Verification

```bash
# Start OpenCode with oh-my-opencode
opencode

# Check plugin loaded
/status  # Should show oh-my-opencode

# Test skill finding
# Type: "I need to add rate limiting"
# → Should suggest durable-objects skill

# Test agent availability
@oracle "review this code"  # Should use GPT-5.2
@librarian "find examples"  # Should search repos
```

---

## Timeline Summary

| Phase | Task | Duration |
|-------|------|----------|
| **1** | Setup oh-my-opencode + add triggers to skills | 1 day |
| **2** | Migrate agent knowledge to enriched skills | 2 days |
| **3** | Beads integration hook + tools | 1 day |
| **4** | Testing & validation | 0.5 day |
| **Total** | | **4.5 days** |

---

## File Changes Summary

### New Files
```
.opencode/
├── skill-matcher.ts        # Trigger-based matching
├── hooks/
│   └── beads-sync.ts       # TodoWrite → beads sync
├── tools/
│   └── beads.ts            # bd_* tool shortcuts
└── plugins/
    └── beads-integration.ts # OpenCode plugin wrapper

tests/
└── skill-matcher.test.ts   # Matching tests
```

### Modified Files
```
skills/*/SKILL.md           # Add triggers: field
skills/*/PATTERNS.md        # Migrated from agents
skills/*/ANTI_PATTERNS.md   # Migrated from agents
skills/*/DECISION_TREE.md   # When to use this skill
skills/*/EXAMPLES/*.ts      # Working code examples
```

### Config Files
```
~/.config/opencode/oh-my-opencode.json  # Plugin config
opencode.json                            # Add oh-my-opencode to plugins
```

---

## What You Get

After implementation:

1. **oh-my-opencode agents**: Sisyphus, Oracle, Librarian, Explore, Frontend
2. **21 hooks**: tool.execute.before/after, chat.message, etc.
3. **Skill auto-matching**: Task triggers → relevant skills
4. **Enriched skills**: PATTERNS.md, ANTI_PATTERNS.md, EXAMPLES/
5. **Beads sync**: TodoWrite → bd done automatically
6. **LSP/AST tools**: Better code understanding
7. **MCP servers**: Context7, Exa, Grep.app pre-configured
8. **Search tools**: grep (exact), mgrep (semantic), grep_app (GitHub), AST-Grep (structural)

---

## Next Steps After Implementation

1. **Add more triggers** as you discover gaps
2. **Contribute semantic search** upstream to oh-my-opencode if triggers aren't enough
3. **Create project-specific skills** in `.opencode/skills/`
4. **Tune agent selection** in oh-my-opencode config based on usage patterns
