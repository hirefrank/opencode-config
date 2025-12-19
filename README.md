# opencode-config

Personal OpenCode configuration optimized for Edge-first development.

> **Edge Stack** is a Cloudflare Workers-first development framework optimized for edge computing, modern React (TanStack Start), and token-efficient AI workflows.

---

## ⚡ Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/hirefrank/opencode-config ~/.config/opencode
cd ~/.config/opencode
```

### 2. Verify
```bash
opencode doctor
```

---

## 🏗️ Structure

- **`agent/`**: 18 specialized agent definitions (36 config entries with tier variants).
- **`command/`**: 29 workflow commands (setup, development, validation).
- **`skills/`**: 19 dormant SKILLs (awaiting OpenCode skills support).
- **`knowledge/`**: Context-triggers and edge development patterns.
- **`scripts/`**: 4 Hard Tools (JS validators) for runtime and UI checks.
- **`plugin/`**: Pre-tool-use hooks and validation scripts.

---

## 🛠️ Key Features

- **Edge-first architecture**: Optimized for Workers, KV, R2, D1, and Durable Objects.
- **Modern Stack**: TanStack Start (React 19), Server Functions, shadcn/ui, and Tailwind 4.
- **Token-efficient**: "Hard Tools" over "Soft Instructions" to reduce context bloat.
- **Ground Truth**: Integrated MCP servers (Context7, shadcn, Better Auth) prevent AI hallucinations.

---

## 📖 Commands

| Task | Command |
|------|---------|
| Start work | `/es-work` |
| Validate commit | `/es-validate` |
| New worker | `/es-worker` |
| Code review | `/es-review` |
| Release | `/es-release` |
| Check upstream | `/es-upstream` |

---

## 💡 Popular Prompts

### Task Management with Beads

```bash
# Start a work session from beads
"Check bd ready for available tasks, pick the highest priority one, and start working on it"

# Work on multiple beads in parallel
"Run bd list --status open, identify 3 independent P2 tasks, and work on them in parallel using subagents"

# Close out a session
"Show me what I accomplished today. Close any completed beads and create new ones for remaining work"
```

### Agent Selection by Task

```bash
# Architecture decisions (Opus 4.5 - highest quality)
@architect "Design a rate limiting system using Durable Objects"

# Quick review (Gemini Flash - fast)
@reviewer-fast "Sanity check this PR before I push"

# Deep review (Opus 4.5 - thorough)
@reviewer "Full code review of the auth implementation"

# Cost-conscious alternative (Gemini Pro)
@architect-alt "Same task but using Gemini Pro instead of Opus"
```

### Frontend & UI

```bash
# Prevent generic UI (your most-used agent)
@frontend-design-specialist "Review this landing page for distinctiveness. Score it against anti-patterns"

# Gemini Pro alternative for faster iteration
@frontend-design-specialist-alt "Quick check - is this button styling too generic?"

# TanStack patterns
@tanstack-ui-architect "Help me structure this dashboard with TanStack Start"

# Accessibility check
@accessibility-guardian "Audit this form for WCAG compliance"
```

### Cloudflare Workers

```bash
# Runtime compatibility
@runtime-guardian "Check if this code will work in Workers runtime"

# Durable Objects patterns
@durable-objects "Implement a WebSocket chat room with DO"

# Binding analysis
@binding-analyzer "Generate TypeScript Env interface from wrangler.toml"
```

### Parallel Work Patterns

```bash
# Parallel implementation
"Implement these 3 API endpoints in parallel: /users, /posts, /comments"

# Parallel validation
"Run these checks in parallel: typecheck, lint, and runtime validation"

# Parallel research
"Research these 3 libraries in parallel and recommend the best fit: [lib1, lib2, lib3]"
```

### Workflow Commands

```bash
# Start feature work (creates worktree, copies .env)
/es-work --branch add-user-auth

# Validate before commit
/es-validate

# Full design review
/es-design-review

# Create new Worker
/es-worker api-gateway

# Release with auto-versioning
/es-release --dry-run
```

### Integration Specialists

```bash
# Authentication
@better-auth-specialist "Set up GitHub OAuth with D1 adapter"

# Billing
@polar-billing-specialist "Implement subscription webhooks"

# Email
@resend-email-specialist "Create transactional email templates"

# Testing
@playwright-testing-specialist "Write E2E tests for the checkout flow"
```

### Model Tier Strategy

| Tier | Agent Suffix | Use When |
|------|--------------|----------|
| 1 (Opus) | `@agent` | Critical decisions, complex architecture |
| 2 (Gemini Pro) | `@agent-alt` | High reasoning, cost-conscious |
| 3 (Gemini Flash) | `@agent-fast` | Quick checks, validation |
| 4 (Big Pickle) | (internal) | Background utilities |

---

## Credits & Inspiration

This configuration stands on the shoulders of giants. We gratefully acknowledge:

### Primary Sources

| Source | Author | What We Adopted |
|--------|--------|-----------------|
| **[Every Inc - Compounding Engineering](https://github.com/EveryInc/every-marketplace/tree/main/plugins/compounding-engineering)** | Kieran Klaassen ([@kieranklaassen](https://github.com/kieranklaassen)) | Multi-agent orchestration, parallel execution, feedback codification, git worktree isolation, workflow structure |
| **[Anthropic Claude Code Plugins](https://github.com/anthropics/claude-code/tree/main/plugins)** | Anthropic | Confidence scoring (`code-review`), safety hooks (`hookify`), 4-dimension design context (`frontend-design`) |
| **[joelhooks/opencode-config](https://github.com/joelhooks/opencode-config)** | Joel Hooks ([@joelhooks](https://github.com/joelhooks)) | OpenCode structure patterns, custom tool architecture, SKILL.md format |

### Community Contributors

- **Ben Fisher** - Git worktree `.env` auto-copy fix
- **Dan Shipper** ([@danshipper](https://github.com/danshipper)) - Agent-native architecture patterns
- **Julik Tarkhanov** - JS reviewer race condition patterns

### Tools & Platforms

- **[OpenCode](https://opencode.ai)** - The foundation
- **[beads (bd)](https://github.com/beads-ai/bd)** - Cross-session task tracking
- **[Context7](https://context7.io)** - Framework documentation MCP
- **[shadcn/ui](https://ui.shadcn.com)** - Component library + MCP

---

## License

MIT
