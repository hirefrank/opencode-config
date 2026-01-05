# opencode-config

**Global OpenCode configuration** for Edge-first development.

> This repo is symlinked to `~/.config/opencode` and applies to **all** OpenCode sessions across all projects.

```bash
# Symlink this repo as OpenCode config directory
ln -s ~/Projects/opencode-config ~/.config/opencode
```

> **f-stack**: Cloudflare Workers-first development with TanStack Start, shadcn/ui, and token-efficient AI workflows.

---

## Philosophy

### Primitives

| Primitive    | Purpose                                             | Example                                     |
| ------------ | --------------------------------------------------- | ------------------------------------------- |
| **tool/**    | Execute code, return structured data (MCP protocol) | `ubs.ts` runs bug scan, returns findings    |
| **skill/**   | Reference knowledge for specific domains            | `cloudflare-workers/` documents KV patterns |
| **command/** | Slash commands for workflows                        | `/f-plan` triggers planning workflow        |
| **agent/**   | Custom agent definitions                            | `feedback-codifier` (learning loop)         |
| **plugin/**  | OpenCode plugins (if needed)                        | Custom hooks, extensions                    |

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

# Symlink as OpenCode config directory
ln -s ~/Projects/opencode-config ~/.config/opencode

# Verify setup
bunx oh-my-opencode doctor
```

**Note**: Symlinking to `~/.config/opencode` makes this config global - it applies everywhere you run `opencode`.

---

## Architecture & How Symlinking Works

### Why Symlink Instead of OPENCODE_CONFIG_DIR?

**Better tool compatibility** - All OpenCode tools expect config at `~/.config/opencode/`
**Simpler paths** - Relative paths work everywhere without environment variables
**Less documentation** - Standard location, no special setup needed

### What This Symlink Does

When you symlink `~/Projects/opencode-config` to `~/.config/opencode`:

- OpenCode loads **this repo's `opencode.jsonc`** as the global config file
- All global settings (commands, MCP servers, agents, etc.) come from this repo
- You still edit files in `~/Projects/opencode-config/` and commit/push as normal
- Skills are discovered automatically (no separate symlink needed)

### What Gets Loaded From This Repo

| Component    | Loaded From             | Notes                                  |
| ------------ | ----------------------- | -------------------------------------- |
| Main config  | `opencode.jsonc`        | Commands, MCP servers, plugins, agents |
| Instructions | `AGENTS.md`             | Global agent behavior instructions     |
| Skills       | `skill/`                | Automatically discovered               |
| Tools        | `tool/*.ts`             | Auto-registered MCP tools              |
| Commands     | Templates in `command/` | Registered in `opencode.jsonc`         |

### Command Template Paths

**Simply use relative paths** - they work because the config is loaded from the symlinked directory:

```jsonc
// ✅ CORRECT - Relative paths (recommended)
"f-plan": {
  "template": "command/planning/f-plan.md"
}
```

**How it works:** OpenCode resolves relative paths in command templates from `~/.config/opencode/` (which is symlinked to this repo).

### File Structure

```
~/.config/opencode/  -> ~/Projects/opencode-config/  # Symlink
    ├── opencode.jsonc                   # Main config (loaded globally)
    ├── AGENTS.md                        # Global instructions
    ├── command/                         # Command templates
    │   ├── planning/f-plan.md
    │   └── workflow/f-commit.md
    ├── tool/                            # MCP tools (auto-registered)
    │   ├── ubs.ts
    │   └── ui-validator.ts
    ├── skill/                           # Skill definitions
    │   └── cloudflare-workers/
    ├── agent/                           # Custom agents
    │   └── feedback-codifier.md
    └── oh-my-opencode.json              # Agent model overrides (optional)
```

**Note:** You edit files in `~/Projects/opencode-config/` and they're automatically reflected in OpenCode.

---

## Setup

After cloning and symlinking, install these dependencies for full functionality:

### Required

```bash
# Install plugin dependencies (for MCP tools)
cd ~/Projects/opencode-config && npm install
```

**Note**: With the symlink approach, skills are automatically discovered from `~/.config/opencode/skill/` - no separate skill symlink needed!

### Skill Frontmatter (OpenCode v1.0.190+)

OpenCode natively loads skills from `.opencode/skill/` (project-local) or `~/.config/opencode/skill/` (global).

**Recognized frontmatter fields:**

- `name` (required) - Skill identifier in kebab-case
- `description` (required) - **Used for activation matching** - must contain relevant keywords
- `license` (optional) - License type (e.g., MIT)
- `compatibility` (optional) - Requirements and dependencies
- `metadata` (optional) - String-to-string map for custom fields

**Unknown fields are silently ignored.** This repo previously used a non-standard `triggers:` field - it was removed as OpenCode only uses `description` for skill activation.

### oh-my-opencode

[code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) provides agents (Sisyphus, Oracle, Librarian, etc.), tools, and the context7 MCP.

```bash
npm install -g oh-my-opencode
```

Already configured in `opencode.jsonc` via `"plugin": ["oh-my-opencode"]`.

To override agent models, create `oh-my-opencode.json` in this repo:

```json
{
  "agents": {
    "oracle": { "model": "anthropic/claude-opus-4-5" },
    "frontend-ui-ux-engineer": { "model": "google/gemini-3-pro-high" }
  }
}
```

See the [oh-my-opencode README](https://github.com/code-yeongyu/oh-my-opencode#agent-configuration) for all agent defaults and options.

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

See `skill/beads-workflow/` for detailed usage.

---

## Structure

```
opencode-config/
├── AGENTS.md              # Global instructions (loaded every session)
├── opencode.jsonc         # Config: model, commands, MCP servers
├── agent/                 # Custom agents (feedback-codifier only)
├── command/               # Slash commands (/f-*)
├── tool/                  # MCP tools (auto-registered)
├── skill/                # Knowledge packages (trigger-based)
└── plugin/                # Hooks and extensions (beads-sync)
```

### What Lives Where

| I want to...                              | Use                               |
| ----------------------------------------- | --------------------------------- |
| Run validation, return structured results | `tool/*.ts`                       |
| Inject knowledge about a domain           | `skill/*/SKILL.md`                |
| Create a workflow command                 | `command/*.md` + `opencode.jsonc` |
| Define a custom agent                     | `agent/*.md` + `opencode.jsonc`   |
| Add reference docs for a skill            | `skill/*/references/*.md`         |

---

## Commands

| Command               | Description                                  |
| --------------------- | -------------------------------------------- |
| `/f-plan`             | Plan with architectural guidance             |
| `/f-triage`           | Triage findings to beads                     |
| `/f-commit`           | Stage changes, generate commit message, push |
| `/f-test-gen`         | Generate Playwright tests                    |
| `/f-component`        | Create shadcn/ui component                   |
| `/f-resolve-parallel` | Resolve multiple tasks in parallel           |
| `/f-generate-command` | Create new slash command                     |

---

## Skills

Skills are knowledge packages triggered by keywords. Smaller, focused skills are more token-efficient.

### Core Skills

| Skill                | Triggers                              | Domain                |
| -------------------- | ------------------------------------- | --------------------- |
| `cloudflare-workers` | workers, cloudflare, kv, r2, d1       | Cloudflare runtime    |
| `durable-objects`    | durable objects, do, websocket, state | Stateful coordination |
| `tanstack-start`     | tanstack, router, server functions    | React framework       |
| `better-auth`        | auth, login, session, oauth           | Authentication        |
| `polar-billing`      | billing, subscription, polar          | Payments              |
| `shadcn-ui`          | shadcn, ui, component, button         | UI components         |
| `beads-workflow`     | beads, bd, task, issue                | Task management       |
| `code-reviewer`      | review, pr, code review               | Code review swarm     |

---

## Tools

MCP tools in `tool/` are auto-registered. They execute and return structured data.

| Tool                     | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `mgrep.ts`               | Semantic code search (natural language queries)  |
| `ubs.ts`                 | Universal Bug Scanner (Workers, D1, KV, secrets) |
| `cloudflare-bindings.ts` | Analyze wrangler.toml, generate Env interface    |
| `ui-validator.ts`        | Validate shadcn/ui prop usage                    |
| `repo-autopsy.ts`        | Deep repo analysis (clone, search, AST)          |
| `typecheck.ts`           | TypeScript type checking                         |
| `git-context.ts`         | Git context for commits/PRs                      |

---

## Custom Agents

Only one custom agent (oh-my-opencode provides the rest):

### @feedback-codifier

The learning loop - extracts patterns from code reviews, validates against MCP/docs, writes to skill references.

```
User Feedback → Extract Pattern → Validate via MCP → Accept/Reject → Update Skill
```

---

## Ralph Loop: Self-Improving Knowledge Base

**Ralph Loop** is oh-my-opencode's self-referential development system that monitors pattern usage and automatically improves your skill documentation based on real-world effectiveness.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Feedback Codifier extracts pattern from user feedback    │
│    ↓                                                         │
│ 2. Validates pattern against MCP/docs                       │
│    ↓                                                         │
│ 3. Writes pattern to skill references                       │
│    ↓                                                         │
│ 4. Ralph Loop monitors pattern usage across sessions        │
│    ↓                                                         │
│ 5. Tracks success/failure rates                             │
│    ↓                                                         │
│ 6. Auto-refines patterns (Option B: Active Learning)        │
│    ↓                                                         │
│ 7. Notifies you via daily digest + git commits              │
└─────────────────────────────────────────────────────────────┘
```

### Confidence-Based Auto-Approval

Ralph uses a tiered system to decide when to apply changes automatically:

| Confidence          | Action                   | Review Required            |
| ------------------- | ------------------------ | -------------------------- |
| **High (85-100%)**  | ✅ Auto-apply + commit   | No - just notify in digest |
| **Medium (65-84%)** | ⏸️ Stage change          | Yes - approval required    |
| **Low (<65%)**      | 🚫 Flag for human review | Yes - don't apply          |

**Why this works:**

- High-confidence changes are validated against official MCP documentation
- You only review uncertain changes (~20% of suggestions)
- Full audit trail via git commits
- Easy rollback with `git revert`

### Daily Workflow

**Morning (2 minutes):**

1. Check `RALPH_DIGEST.md` for overnight changes
2. Review auto-applied commits (if any)
3. Approve/reject pending medium-confidence changes

**Weekly:**

- Review flagged low-confidence suggestions in beads
- Check git log: `git log --oneline --author="ralph-loop"`

**Monthly:**

- Audit pattern usage statistics
- Review archived unused patterns

### Review Commands

```bash
# Approve a pending change
/f-pattern-approve abc123

# Reject a change with reasoning
/f-pattern-reject abc123 "reason: better approach is X"

# Revert an auto-applied change
git revert <commit-hash>
```

### Safety Mechanisms

1. **MCP Validation Required** - All high-confidence changes must pass MCP validation
2. **Never Delete** - Ralph only adds/refines, never removes patterns
3. **Revert Limit** - Auto-apply pauses after 3 reverts in a week
4. **Usage Tracking** - Unused patterns auto-archive after 30 days
5. **Breaking Change Detection** - Contradictions always flagged for review

### Git Workflow

Each Ralph change = one atomic commit:

```bash
# View Ralph's recent changes
git log --oneline --author="ralph-loop"

abc1234 ralph: Add R2 cache-control pattern (95% confidence)
def5678 ralph: Add DO ID anti-pattern (88% confidence)
ghi9012 ralph: Update KV TTL guidance (91% confidence)

# Revert specific change
git revert abc1234
```

### Monitored Skills

Ralph monitors these skills for pattern effectiveness:

- `skill/cloudflare-workers/` - Workers, KV, R2, D1 patterns
- `skill/durable-objects/` - Stateful coordination patterns
- `skill/better-auth/` - Authentication patterns
- `skill/tanstack-start/` - React framework patterns
- `skill/shadcn-ui/` - UI component patterns
- `skill/polar-billing/` - Payment integration patterns

### Configuration

Ralph Loop is configured in `oh-my-opencode.json`:

```json
{
  "ralph_loop": {
    "enabled": true,
    "auto_apply_threshold": 85, // High confidence auto-apply
    "require_approval_threshold": 65, // Medium needs approval
    "review": {
      "digest_file": "RALPH_DIGEST.md",
      "digest_frequency": "daily",
      "git_commit_per_change": true
    },
    "safety": {
      "require_mcp_validation": true,
      "never_delete_patterns": true,
      "pause_after_reverts": 3
    }
  }
}
```

### Example Digest

```markdown
# Ralph Loop Daily Digest - Jan 1, 2026

## Auto-Applied Changes (High Confidence)

✅ skill/cloudflare-workers/references/PATTERNS.md

- Added: "Always set cache-control headers on R2 responses"
- Confidence: 95% (validated via context7 Cloudflare docs)
- Commit: abc1234

## Pending Your Review (Medium Confidence)

⏸️ skill/better-auth/references/SCHEMA.md

- Proposed: "Add index on user.email for faster lookups"
- Confidence: 72%
- Approve: /f-pattern-approve abc123

## Flagged for Discussion (Low Confidence)

🚫 skill/tanstack-start/references/ROUTING.md

- Suggested: "Use file-based routing over programmatic routing"
- Confidence: 45%
- Action: Manual investigation needed
```

### Why Ralph Loop?

**Traditional approach:**

- Patterns written once, never updated
- Outdated patterns cause confusion
- No feedback on what works

**With Ralph Loop:**

- Patterns continuously improve based on usage
- Dead patterns automatically archived
- High-quality knowledge base that stays current

**Trust the system** - Ralph validates against official docs and only auto-applies changes with 85%+ confidence.

---

## Credits

| Source                                                                           | What We Use                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)    | Agents (Sisyphus, Oracle, etc.), tools, context7 |
| [joelhooks/opencode-config](https://github.com/joelhooks/opencode-config)        | Structure patterns, tool architecture            |
| [Every Inc](https://github.com/EveryInc/every-marketplace)                       | Feedback codification, parallel execution        |
| [Anthropic Plugins](https://github.com/anthropics/claude-code/tree/main/plugins) | Confidence scoring, safety hooks                 |

---

## License

MIT
