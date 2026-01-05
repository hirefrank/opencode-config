# f-stack Development Guidelines

This file defines the rules and conventions for AI agents working on this project.

---

## Project Overview

**f-stack** is a Cloudflare Workers-first development framework optimized for:

- Edge-first architecture (Workers, KV, R2, D1, Durable Objects)
- Modern React stack (Tanstack Start, shadcn/ui, Tailwind 4)
- Token-efficient AI workflows ("Hard Tools" over "Soft Instructions")

### Great Use Cases

- **ultrawork**: "Implement a full-stack user profile page with D1 and Tanstack Start." (Claude handles the logic, Gemini builds the UI in parallel!)
- **search**: "How is authentication handled across the entire project?" (The Librarian and Explore agents will scour your docs and code simultaneously.)

---

## CRITICAL: Repository Architecture

### This Repo IS the Global Config

**NEVER FORGET:** This repository at `/home/frank/Projects/opencode-config` is the global OpenCode configuration because `OPENCODE_CONFIG_DIR` points here.

```bash
export OPENCODE_CONFIG_DIR=~/Projects/opencode-config
```

### What This Means

| File Location                      | Status      | Purpose                                        |
| ---------------------------------- | ----------- | ---------------------------------------------- |
| **THIS REPO's `opencode.jsonc`**   | ✅ Active   | **Primary config** loaded by OpenCode          |
| `~/.config/opencode/opencode.json` | ❌ Unused   | **NOT loaded** when OPENCODE_CONFIG_DIR is set |
| `~/.config/opencode/skill/`        | ✅ Required | **Symlink** to this repo's `skill/` directory  |

### Command Template Path Resolution

**Use relative paths in command templates:**

```jsonc
// ✅ CORRECT - Relative paths resolved from OPENCODE_CONFIG_DIR
"template": "command/planning/f-plan.md"

// ❌ DON'T USE - Environment variable syntax doesn't work
"template": "{env:OPENCODE_CONFIG_DIR}/command/planning/f-plan.md"

// ⚠️ AVOID - Absolute paths work but aren't portable
"template": "/home/frank/Projects/opencode-config/command/planning/f-plan.md"
```

**How it works:** When `OPENCODE_CONFIG_DIR` is set, OpenCode resolves relative template paths from that directory automatically.

### File Changes: Where to Edit

When modifying global configuration:

- **Commands** → Edit THIS repo's `opencode.jsonc`
- **MCP tools** → Edit THIS repo's `tool/*.ts`
- **Skills** → Edit THIS repo's `skill/*/SKILL.md`
- **Instructions** → Edit THIS repo's `AGENTS.md`
- **Agent overrides** → Edit `~/.config/opencode/oh-my-opencode.json` (not in this repo)

**NEVER edit `~/.config/opencode/opencode.json`** - it's ignored when OPENCODE_CONFIG_DIR is set and should be deleted if it exists.

---

## Framework Preferences (STRICT)

### UI Framework

- **USE**: Tanstack Start (React 19) with Server Functions
- **NOT**: Next.js, Remix, plain React, Vue, Svelte

### Component Library

- **USE**: shadcn/ui (Radix UI primitives + Tailwind)
- **NOT**: Material UI, Chakra, Ant Design, custom components

### Styling

- **USE**: Tailwind CSS utilities, cn() helper
- **NOT**: CSS modules, styled-components, SASS, custom CSS files

### Backend

- **USE**: Hono (lightweight, edge-optimized)
- **NOT**: Express, Fastify, Koa, NestJS

### AI Integration

- **USE**: Vercel AI SDK + Cloudflare AI Gateway
- **NOT**: LangChain, direct OpenAI/Anthropic SDKs

### Authentication

- **USE**: better-auth (D1 compatible)
- **NOT**: Lucia, Auth.js, Passport, Clerk, Supabase Auth

### Billing

- **USE**: Polar.sh
- **NOT**: Stripe direct, Paddle, Lemon Squeezy

### Deployment

- **USE**: Cloudflare Workers with static assets
- **NOT**: Cloudflare Pages, Vercel, Netlify

---

## Cloudflare Workers Rules

### 1. Workers Are Stateless

```typescript
// ❌ FORBIDDEN: In-memory state
let cache = new Map(); // Dies between requests

// ✅ REQUIRED: State in bindings
export default {
  async fetch(request: Request, env: Env) {
    const value = await env.KV.get("key");
  },
};
```

### 2. Use env Parameter, Not process.env

```typescript
// ❌ FORBIDDEN
const apiKey = process.env.API_KEY;

// ✅ REQUIRED
export default {
  async fetch(request: Request, env: Env) {
    const apiKey = env.API_KEY;
  },
};
```

### 3. Web APIs Only (No Node.js)

```typescript
// ❌ FORBIDDEN: Node.js APIs
import fs from "fs";
import { Buffer } from "buffer";
const path = require("path");

// ✅ REQUIRED: Web APIs
const encoder = new TextEncoder();
const hash = await crypto.subtle.digest("SHA-256", data);
const response = await fetch(url);
```

### 4. Right Resource for Right Job

| Use Case         | Resource        | Reason                            |
| ---------------- | --------------- | --------------------------------- |
| Read-heavy cache | KV              | Eventually consistent, fast reads |
| User sessions    | KV              | Simple key-value, TTL support     |
| Rate limiting    | Durable Objects | Strong consistency required       |
| WebSockets       | Durable Objects | Stateful connections              |
| File storage     | R2              | Large objects, S3-compatible      |
| Relational data  | D1              | SQL queries, joins                |
| Coordination     | Durable Objects | Single-threaded consistency       |

### 5. Always Define Env Interface

```typescript
// src/env.d.ts
interface Env {
  // KV Namespaces
  CACHE: KVNamespace;

  // R2 Buckets
  STORAGE: R2Bucket;

  // D1 Databases
  DB: D1Database;

  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace;

  // Secrets (via wrangler secret)
  API_KEY: string;
}
```

---

## Design Anti-Patterns (FORBIDDEN)

### Typography

- ❌ Inter font (80%+ of websites use it)
- ❌ Roboto font
- ✅ Space Grotesk, Archivo Black, JetBrains Mono

### Colors

- ❌ Purple gradients (#8B5CF6 range)
- ❌ Default Tailwind gray palette
- ✅ Custom brand colors with semantic naming

### Animations

- ❌ No hover states on interactive elements
- ❌ Static buttons and cards
- ✅ transition-all, hover:scale-105, micro-interactions

### Components

- ❌ Default shadcn/ui props only
- ❌ className="" with no customization
- ✅ Deep customization via cn() utility

See `skill/component-aesthetic-checker/` for complete design patterns.

---

## Code Style

### TypeScript Required

All code must be TypeScript with strict mode enabled.

### Conventional Commits

```
<type>(<scope>): <description>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Error Handling

```typescript
// Always use try/catch with appropriate HTTP status
try {
  const result = await operation();
  return new Response(JSON.stringify(result), { status: 200 });
} catch (error) {
  console.error("Operation failed:", error);
  return new Response("Internal error", { status: 500 });
}
```

### Secrets Management

```bash
# ❌ FORBIDDEN: Hardcoded secrets
const API_KEY = "sk-live-xxx";

# ✅ REQUIRED: Wrangler secrets
wrangler secret put API_KEY
```

---

## Validation Before Commit

Always run before committing:

1. **Hard Tools Validation** (use tools directly)
   - `typecheck` - TypeScript type checking
   - `check_workers` - Workers runtime compatibility
   - `check_secrets` - Hardcoded secrets detection
   - `validate_ui` - UI component validation

2. **Type Check**

   ```bash
   pnpm typecheck
   ```

3. **Lint**

   ```bash
   pnpm lint
   ```

4. **Bundle Size**
   - Target: < 50KB
   - Check: `du -h dist/*.js`

---

## MCP Server Usage

### Always Query Before Implementing

Use MCP servers for ground truth:

```typescript
// shadcn/ui components
shadcn.get_component("Button"); // Get real props, not guessed

// Framework docs
context7.resolve("cloudflare workers kv"); // Get current docs

// Auth patterns
better - auth.getProviderSetup("github"); // Get real setup
```

### Never Trust AI Memory

AI can hallucinate component props and API patterns.
Hard Tools and MCP servers provide ground truth.

### MCP Efficiency (Token Optimization)

**Problem**: Direct MCP tool calls consume massive context (150K+ tokens for complex workflows).

**Solution**: Use deferred loading and code execution patterns.

```typescript
// Configure MCP tools with defer_loading for on-demand discovery
const toolConfig = {
  // Always-loaded (3-5 critical tools)
  cloudflare_search: { defer_loading: false },
  package_registry: { defer_loading: false },

  // Deferred (load on-demand via search)
  shadcn_components: { defer_loading: true },
  playwright_generate: { defer_loading: true },
  polar_billing: { defer_loading: true },
};
```

**Benefits**:

- 85% reduction in token usage
- Compatible with prompt caching
- oh-my-opencode handles this automatically via "Context-aware delegating"

**When to write code instead of direct tool calls**:

- Complex workflows with 3+ dependent calls
- Large datasets requiring filtering
- Parallel operations

---

## Task Management (beads)

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

| Tool          | Scope          | When                                      |
| ------------- | -------------- | ----------------------------------------- |
| **TodoWrite** | Single session | Real-time progress visibility (automatic) |
| **beads**     | Cross-session  | Everything persistent                     |

### beads Commands

```bash
bd ready                  # Find available work
bd show <id>              # View issue details
bd update <id> --status in_progress  # Claim work
bd done <id>              # Mark complete
bd sync                   # Sync with git
bd list                   # All tasks
bd dep add bd-b bd-a       # B depends on A
```

See `skill/beads-workflow/` for detailed usage.

---

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

### 1. Distinguish between Knowledge and Code

| Change Type   | Target Repo       | Workflow        | Why                                                                  |
| ------------- | ----------------- | --------------- | -------------------------------------------------------------------- |
| **Knowledge** | `opencode-config` | **Direct Push** | Skills/Patterns are global facts. Agents need them live immediately. |
| **Code**      | Project Repos     | **Branch + PR** | Feature code requires review, tests, and CI/CD validation.           |

**Knowledge updates** (modifying `.md` files in `skill/` or `agent/`) should NEVER use PRs unless explicitly requested by the user. Commit and push directly to the default or active branch.

### 2. Mandatory Workflow

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

---

## Quick Reference

| Task           | Command / Tool                                |
| -------------- | --------------------------------------------- |
| Plan feature   | `/f-plan`                                     |
| Triage issues  | `/f-triage`                                   |
| Commit changes | `/f-commit`                                   |
| Generate tests | `/f-test-gen`                                 |
| UI component   | `/f-component`                                |
| Analyze repo   | `/f-analyze-repo`                             |
| Validate code  | `typecheck`, `check_workers`, `check_secrets` |
| Find work      | `bd ready`                                    |

### Code Search

| Search Type     | Tool    | Example                        |
| --------------- | ------- | ------------------------------ |
| Exact match     | `grep`  | `grep "TODO" src/`             |
| Regex pattern   | `grep`  | `grep "function.*async" src/`  |
| Semantic/intent | `mgrep` | `mgrep "error handling logic"` |

Use mgrep for intent-based queries ("find rate limiting"), grep for exact patterns.

#### mgrep Usage

```bash
# Find by intent (semantic search)
mgrep "authentication flow"
mgrep "how errors are handled"
mgrep "REST endpoints for users"

# With filters
mgrep "state management" --glob "*.ts"
mgrep "database queries" src/db/

# OpenCode agent mode
mgrep --opencode "find rate limiting logic"
```

**Best Practices**:

1. Use natural language: "functions that validate user input" not "validate.\*input"
2. Be specific about intent: "error handling in API routes" not just "errors"
3. Fallback to grep for exact matches (faster and deterministic)

**Token Efficiency**: mgrep reduces token usage ~2x compared to grep - returns semantically relevant results pre-filtered vs raw matches requiring AI interpretation.

---

## Learning Loop: Pattern Discovery System

The f-stack has a three-tier pattern discovery and refinement system:

### 1. Feedback Codifier (Reactive Discovery)

The `@feedback-codifier` agent extracts and validates patterns from **chat feedback and code reviews**.

```
User Feedback → Extract Pattern → Validate via MCP/Docs → Accept/Reject → Update Knowledge
```

**Example:**

```
Feedback: "Always set TTL when writing to KV"
1. Query MCP: context7 → "KV put TTL best practices"
2. Docs confirm: "Set expirationTtl on all writes"
3. Pattern MATCHES ✓
4. Write to skill/cloudflare-workers/references/PATTERNS.md
```

### 2. Implementation Analyzer (Proactive Discovery)

The `@implementation-analyzer` agent **proactively scans external repositories** to discover patterns from real-world implementations.

```
Target Repo → Clone & Analyze → Extract Patterns → Validate via MCP → Codify to SKILLS
```

**Usage:**

```bash
/f-analyze-repo honojs/hono                    # Analyze specific repo
/f-analyze-repo --discover "cloudflare auth"   # Find and analyze repos
```

**What it discovers:**

- **Good Patterns** → Added directly to `PATTERNS.md` files in global config
- **Anti-Patterns** → Added directly to `ANTI_PATTERNS.md` with fixes in global config
- **Gaps** → Added as new skills in global config

### 3. Ralph Loop (Continuous Refinement)

**Ralph Loop** monitors pattern effectiveness and **auto-improves** documentation based on real-world usage.

```
Codifier writes pattern → Ralph monitors usage → Tracks success rate → Auto-refines pattern
```

**How it works:**

1. Feedback Codifier or Implementation Analyzer adds pattern to skill
2. Ralph Loop monitors when pattern is used in sessions
3. Tracks success/failure rates (did following the pattern work?)
4. If pattern consistently fails or needs refinement → auto-improves
5. High confidence changes (85%+) → auto-apply + commit
6. Medium confidence (65-84%) → request approval via `RALPH_DIGEST.md`
7. Low confidence (<65%) → flag for manual review

**Safety mechanisms:**

- MCP validation required for all auto-applied changes
- Never deletes patterns (only adds/refines)
- Atomic git commits for easy rollback
- Pauses after 3 reverts in a week

**Review workflow:**

- **Daily** (~2 min): Check `RALPH_DIGEST.md` for changes
- **Weekly** (~15 min): Review pending approvals and flagged items
- **Monthly**: Audit pattern usage statistics

See `RALPH_DIGEST.md` for current status and `README.md` for full Ralph Loop documentation.

### Comparison

| Aspect       | Feedback Codifier      | Implementation Analyzer | Ralph Loop            |
| ------------ | ---------------------- | ----------------------- | --------------------- |
| Trigger      | Reactive (chat)        | Proactive (command)     | Continuous (monitor)  |
| Input        | User feedback          | External repositories   | Pattern usage data    |
| Discovery    | Patterns in discussion | Patterns in code        | Pattern effectiveness |
| Validation   | MCP docs               | MCP docs                | MCP + usage stats     |
| Output       | New patterns           | New patterns            | Refined patterns      |
| Human Review | Always                 | Always                  | Only medium/low conf  |

### Storage Locations

Patterns are stored in skill reference files:

| Category            | Location                               |
| ------------------- | -------------------------------------- |
| Cloudflare patterns | `skill/cloudflare-workers/references/` |
| Durable Objects     | `skill/durable-objects/references/`    |
| UI patterns         | `skill/shadcn-ui/references/`          |
| TanStack patterns   | `skill/tanstack-start/references/`     |
| Auth patterns       | `skill/better-auth/references/`        |

**Note**: This three-tier learning system is unique to our stack - oh-my-opencode provides Ralph Loop, we built the discovery layers on top.

---

## File Locations

```
agent/           # Custom agents (feedback-codifier, implementation-analyzer)
command/         # Slash commands
tool/            # MCP tools (auto-registered)
skill/          # Knowledge packages (trigger-based)
plugin/          # Hooks and extensions (beads-sync)
opencode.jsonc   # Main configuration
```

**Note**: Most agents are provided by oh-my-opencode. Only `@feedback-codifier` and `@implementation-analyzer` are custom.

---

## oh-my-opencode Agents

Agents are provided by [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode).

### Default Agent Models

| Agent                   | Default Model                       | Purpose                           |
| ----------------------- | ----------------------------------- | --------------------------------- |
| Sisyphus (primary)      | `anthropic/claude-sonnet-4-5`       | Main orchestrator                 |
| Planner-Sisyphus        | (inherits from OpenCode plan agent) | Planning mode                     |
| oracle                  | `openai/gpt-5.2`                    | Architecture decisions, debugging |
| librarian               | `anthropic/claude-sonnet-4-5`       | External docs, OSS examples       |
| explore                 | (session model)                     | Internal codebase search          |
| frontend-ui-ux-engineer | `google/gemini-3-pro-preview`       | UI/UX implementation              |
| document-writer         | `google/gemini-3-flash-preview`     | Documentation                     |
| multimodal-looker       | `google/gemini-2.5-flash`           | PDFs, images, diagrams            |

### Override Agent Models

Create `~/.config/opencode/oh-my-opencode.json`:

```json
{
  "agents": {
    "oracle": { "model": "anthropic/claude-opus-4-5" },
    "frontend-ui-ux-engineer": { "model": "anthropic/claude-sonnet-4" },
    "explore": { "model": "anthropic/claude-haiku-4-5", "temperature": 0.5 }
  }
}
```

See the [oh-my-opencode README](https://github.com/code-yeongyu/oh-my-opencode#agent-configuration) for full configuration options.
