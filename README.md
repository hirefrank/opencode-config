# opencode-config

**Global OpenCode configuration** for Edge-first development.

> This repo is set as `OPENCODE_CONFIG_DIR` and applies to **all** OpenCode sessions across all projects.

```bash
# ~/.bashrc or ~/.zshrc
export OPENCODE_CONFIG_DIR=~/Projects/opencode-config
```

> **Edge Stack**: Cloudflare Workers-first development with TanStack Start, shadcn/ui, and token-efficient AI workflows.

---

## Philosophy

### Primitives

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **tool/** | Execute code, return structured data (MCP protocol) | `ubs.ts` runs bug scan, returns findings |
| **skills/** | Reference knowledge for specific domains | `cloudflare-workers/` documents KV patterns |
| **command/** | Slash commands for workflows | `/es-plan` triggers planning workflow |
| **agent/** | Custom agent definitions | `feedback-codifier` (learning loop) |
| **plugin/** | OpenCode plugins (if needed) | Custom hooks, extensions |

### Key Principles

1. **Tools execute, skills document** - Validators are tools (they run code), skills are reference knowledge

2. **Smaller skills = more token-efficient** - Many focused skills beats few monolithic ones

3. **MCP tools over shell scripts** - Use `tool/*.ts` (auto-registered) instead of legacy scripts

4. **Hard Tools over soft instructions** - Deterministic code > prompt instructions for validation

### Great Use Cases

- **ultrawork**: "Implement a full-stack user profile page with D1 and Tanstack Start." (Claude handles the logic, Gemini builds the UI in parallel!)
- **search**: "How is authentication handled across the entire project?" (The Librarian and Explore agents will scour your docs and code simultaneously.)

---

## Quick Start

```bash
# Clone
git clone https://github.com/hirefrank/opencode-config ~/Projects/opencode-config

# Add to ~/.bashrc or ~/.zshrc
export OPENCODE_CONFIG_DIR=~/Projects/opencode-config

# Reload shell and verify
source ~/.bashrc && opencode doctor
```

**Note**: `OPENCODE_CONFIG_DIR` makes this config global - it applies everywhere you run `opencode`.

---

## Setup

After cloning, install these dependencies for full functionality:

### Required

```bash
# Install plugin dependencies (for MCP tools)
cd ~/Projects/opencode-config && npm install
```

### oh-my-opencode

Provides additional agents and the context7 MCP for documentation lookup.

```bash
npm install -g oh-my-opencode
```

Already configured in `opencode.jsonc` via `"plugin": ["oh-my-opencode"]`.

### mgrep (Semantic Search)

Natural language code search - finds code by intent, not just patterns.

```bash
# Install
npm install -g @mixedbread/mgrep

# Authenticate
mgrep login

# Index your project (run from project root)
mgrep watch
```

**Note**: Tool (`tool/mgrep.ts`) and MCP already configured in this repo - no need to run `mgrep install-opencode`.

Usage: `mgrep "where is authentication handled"` vs grep's exact matching.

### beads (Task Management)

Persistent task tracking across sessions.

```bash
# Install
npm install -g beads

# Initialize in your project
bd onboard
```

Key commands:
```bash
bd ready          # Find available work
bd show <id>      # View issue details
bd done <id>      # Mark complete
bd sync           # Sync with git
```

See `skills/beads-workflow/` for detailed usage.

---

## Structure

```
opencode-config/
├── AGENTS.md              # Global instructions (loaded every session)
├── opencode.jsonc         # Config: model, commands, MCP servers
├── agent/                 # Custom agents (feedback-codifier only)
├── command/               # Slash commands (/es-*)
├── tool/                  # MCP tools (auto-registered)
├── skills/                # Knowledge packages (trigger-based)
└── plugin/                # Hooks and extensions (beads-sync)
```

### What Lives Where

| I want to... | Use |
|--------------|-----|
| Run validation, return structured results | `tool/*.ts` |
| Inject knowledge about a domain | `skills/*/SKILL.md` |
| Create a workflow command | `command/*.md` + `opencode.jsonc` |
| Define a custom agent | `agent/*.md` + `opencode.jsonc` |
| Add reference docs for a skill | `skills/*/references/*.md` |

---

## Commands

| Command | Description |
|---------|-------------|
| `/es-plan` | Plan with architectural guidance |
| `/es-triage` | Triage findings to beads |
| `/es-commit` | Stage changes, generate commit message, push |
| `/es-test-gen` | Generate Playwright tests |
| `/es-component` | Create shadcn/ui component |
| `/es-resolve-parallel` | Resolve multiple tasks in parallel |
| `/es-generate-command` | Create new slash command |

---

## Skills

Skills are knowledge packages triggered by keywords. Smaller, focused skills are more token-efficient.

### Core Skills

| Skill | Triggers | Domain |
|-------|----------|--------|
| `cloudflare-workers` | workers, cloudflare, kv, r2, d1 | Cloudflare runtime |
| `durable-objects` | durable objects, do, websocket, state | Stateful coordination |
| `tanstack-start` | tanstack, router, server functions | React framework |
| `better-auth` | auth, login, session, oauth | Authentication |
| `polar-billing` | billing, subscription, polar | Payments |
| `shadcn-ui` | shadcn, ui, component, button | UI components |
| `beads-workflow` | beads, bd, task, issue | Task management |
| `code-reviewer` | review, pr, code review | Code review swarm |

---

## Tools

MCP tools in `tool/` are auto-registered. They execute and return structured data.

| Tool | Purpose |
|------|---------|
| `mgrep.ts` | Semantic code search (natural language queries) |
| `ubs.ts` | Universal Bug Scanner (Workers, D1, KV, secrets) |
| `cloudflare-bindings.ts` | Analyze wrangler.toml, generate Env interface |
| `ui-validator.ts` | Validate shadcn/ui prop usage |
| `repo-autopsy.ts` | Deep repo analysis (clone, search, AST) |
| `typecheck.ts` | TypeScript type checking |
| `git-context.ts` | Git context for commits/PRs |

---

## Custom Agents

Only one custom agent (oh-my-opencode provides the rest):

### @feedback-codifier

The learning loop - extracts patterns from code reviews, validates against MCP/docs, writes to skill references.

```
User Feedback → Extract Pattern → Validate via MCP → Accept/Reject → Update Skill
```

---

## Credits

| Source | What We Use |
|--------|-------------|
| [joelhooks/opencode-config](https://github.com/joelhooks/opencode-config) | Structure patterns, tool architecture |
| [Every Inc](https://github.com/EveryInc/every-marketplace) | Feedback codification, parallel execution |
| [Anthropic Plugins](https://github.com/anthropics/claude-code/tree/main/plugins) | Confidence scoring, safety hooks |

---

## License

MIT
