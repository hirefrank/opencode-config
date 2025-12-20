# Edge Stack Development Guidelines

This file defines the rules and conventions for AI agents working on this project.

---

## Project Overview

**Edge Stack** is a Cloudflare Workers-first development framework optimized for:

- Edge-first architecture (Workers, KV, R2, D1, Durable Objects)
- Modern React stack (Tanstack Start, shadcn/ui, Tailwind 4)
- Token-efficient AI workflows ("Hard Tools" over "Soft Instructions")

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

See `skills/component-aesthetic-checker/` for complete design patterns.

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

1. **Hard Tools Validation**

   ```bash
   ./bin/es-validate.sh
   ```

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

See `skills/beads-workflow/` for detailed usage.

---

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

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

| Task           | Command        |
| -------------- | -------------- |
| Code review    | `/es-review`   |
| Start work     | `/es-work`     |
| Validate       | `/es-validate` |
| New worker     | `/es-worker`   |
| Release        | `/es-release`  |
| Check upstream | `/es-upstream` |

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
1. Use natural language: "functions that validate user input" not "validate.*input"
2. Be specific about intent: "error handling in API routes" not just "errors"
3. Fallback to grep for exact matches (faster and deterministic)

**Token Efficiency**: mgrep reduces token usage ~2x compared to grep - returns semantically relevant results pre-filtered vs raw matches requiring AI interpretation.

---

## Learning Loop: Feedback Codifier

The `@feedback-codifier` agent is a **pattern curation system** that extracts and validates patterns from code reviews before adding them to knowledge files.

### How It Works

```
User Feedback → Extract Pattern → Validate via MCP/Docs → Accept/Reject → Update Knowledge
```

### Example: Valid Pattern

```
Feedback: "Always set TTL when writing to KV"
1. Query MCP: context7 → "KV put TTL best practices"
2. Docs confirm: "Set expirationTtl on all writes"
3. Pattern MATCHES ✓
4. Write to skills/cloudflare-workers/references/PATTERNS.md
```

### Example: Rejected Pattern

```
Feedback: "Use KV for rate limiting - it's fast enough"
1. Query MCP: context7 → "KV consistency rate limiting"
2. Docs say: "KV is eventually consistent. Use DO for rate limiting"
3. Pattern CONTRADICTS ✗
4. REJECT: "KV eventual consistency causes race conditions"
```

### Why This Exists

- Prevents bad patterns from entering the knowledge base
- Ensures all patterns are validated against official documentation
- Creates a self-improving system that learns from reviews

### Storage Locations

Patterns are stored in skill reference files:

| Category | Location |
|----------|----------|
| Cloudflare patterns | `skills/cloudflare-workers/references/` |
| UI patterns | `skills/component-aesthetic-checker/references/` |
| TanStack patterns | `skills/tanstack-start/references/` |
| Auth patterns | `skills/better-auth/references/` |

**Note**: This is unique to our stack - oh-my-opencode has no equivalent learning loop.

---

## File Locations

```
agent/           # Custom agents (feedback-codifier only)
command/         # Slash commands
tool/            # MCP tools (auto-registered)
skills/          # Knowledge packages (trigger-based)
plugin/          # Hooks and extensions (beads-sync)
opencode.jsonc   # Main configuration
```

**Note**: Most agents are provided by oh-my-opencode. Only `@feedback-codifier` is custom.
