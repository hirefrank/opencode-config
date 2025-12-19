# Agent Skills Migration Plan

Migration plan from current OpenCode configuration to Agent Skills standard.

## Current → Skills Mapping

### Commands → Skills

| Current Command | Skill Name | Description |
|-----------------|------------|-------------|
| `/es-review` | `es-review` | Code review with Hard Tools validation and multi-perspective analysis |
| `/es-work` | `es-work` | Feature development workflow with worktree isolation |
| `/es-validate` | `es-validate` | Pre-deployment validation suite |
| `/es-worker` | `es-worker` | Cloudflare Worker/Durable Object scaffolding |
| `/es-release` | `es-release` | Version bump, changelog, and release commit |
| `/es-upstream` | `es-upstream` | Monitor upstream sources for changes |
| `/es-blogs` | `es-blogs` | Research Anthropic blogs for new patterns |

### Agents → allowed-tools

| Current Agent | Becomes | allowed-tools |
|---------------|---------|---------------|
| `architect` | Embedded in es-work skill | `Read Grep Bash(mgrep:*)` |
| `reviewer` | Embedded in es-review skill | `Read Grep Bash(git:*)` |
| `runtime-validator` | Embedded in es-validate skill | `Read Grep` |
| `ui-validator` | Shared across skills | `Read` |
| `testing` | Embedded in es-validate skill | `Bash(playwright:*)` |

### Knowledge → references/

| Current Knowledge File | Destination |
|------------------------|-------------|
| `cloudflare-patterns.md` | `skills/es-worker/references/` |
| `design-anti-patterns.md` | `skills/es-review/references/` |
| `mgrep-patterns.md` | Global (not skill-specific) |
| `beads-patterns.md` | Global (not skill-specific) |

## Proposed Skill Structure

```
skills/
├── es-review/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── review.sh
│   └── references/
│       └── design-anti-patterns.md
│
├── es-work/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── work.sh
│   └── references/
│       └── worktree-patterns.md
│
├── es-validate/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── validate.sh
│   └── references/
│       └── runtime-checks.md
│
├── es-worker/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── scaffold.sh
│   └── references/
│       ├── cloudflare-patterns.md
│       └── env-interface.md
│
├── es-release/
│   ├── SKILL.md
│   └── scripts/
│       └── release.sh
│
├── es-upstream/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── check-upstream.sh
│   └── references/
│       └── UPSTREAM.md
│
└── es-blogs/
    ├── SKILL.md
    └── scripts/
        └── research-blogs.sh
```

## Example SKILL.md

```yaml
---
name: es-review
description: >
  Comprehensive code review with Hard Tools validation and multi-perspective
  analysis. Use when reviewing PRs, checking code quality, or before merging.
  Triggers on: review, PR, pull request, check this, what's wrong.
license: MIT
compatibility: Requires git, designed for OpenCode
allowed-tools: Read Grep Bash(git:*) Bash(mgrep:*)
metadata:
  author: hirefrank
  version: "1.0"
---

# Code Review Skill

## Workflow

1. Run Hard Tools validation (deterministic checks)
2. Analyze results with multi-perspective review
3. Generate confidence-scored findings

## Hard Tools Validation

Run `scripts/review.sh` first to get deterministic results:
- Runtime compatibility (Workers API violations)
- Type errors
- Lint issues
- Bundle size

## Review Perspectives

After Hard Tools, analyze from multiple angles:
- **Security**: Auth, injection, secrets exposure
- **Performance**: Cold starts, bundle size, caching
- **Cloudflare**: Resource selection, binding usage
- **Design**: Anti-patterns, distinctiveness

See [design anti-patterns](references/design-anti-patterns.md) for forbidden patterns.

## Output Format

For each finding:
- **Severity**: critical / warning / suggestion
- **Confidence**: 0.0-1.0 (how certain)
- **Location**: file:line
- **Issue**: What's wrong
- **Fix**: How to fix it
```

## What Stays Global

These remain outside skills (in AGENTS.md or root config):

1. **Framework preferences** - USE Tanstack Start, NOT Next.js
2. **Cloudflare Workers rules** - Stateless, env not process.env
3. **Code style** - TypeScript, conventional commits
4. **External tools** - beads, mgrep (skills invoke them)
5. **MCP servers** - context7, shadcn (infrastructure)

## Migration Steps

1. **Wait for OpenCode Skills support** (announced as coming)
2. Create `skills/` directory
3. For each command:
   - Create `skills/{name}/SKILL.md` with frontmatter
   - Move script to `skills/{name}/scripts/`
   - Move relevant knowledge to `skills/{name}/references/`
4. Update `opencode.jsonc` to discover skills
5. Remove old `.opencode/command/` files
6. Test each skill activation

## Benefits of Migration

| Before | After |
|--------|-------|
| 4 files per workflow | 1 folder per skill |
| Scattered knowledge | Co-located references |
| Manual context loading | Progressive disclosure |
| Custom triggers | Standard description matching |
| OpenCode-specific | Cross-platform (Cursor, VS Code, etc.) |
