# Upstream Tracking

This document tracks upstream sources for patterns, improvements, and learnings.

## Upstream Sources

| Source | Repository | Focus | Priority |
|--------|-----------|-------|----------|
| **Every Inc** | [every-marketplace](https://github.com/EveryInc/every-marketplace) | Workflow patterns, multi-agent orchestration | PRIMARY |
| **joelhooks** | [opencode-config](https://github.com/joelhooks/opencode-config) | Prompt engineering, persona architecture | PRIMARY |
| **oh-my-opencode** | [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) | Shell integration, CLI patterns | SECONDARY |
| **Anthropic** | [claude-code](https://github.com/anthropics/claude-code) | Official Claude Code patterns | REFERENCE |

---

## Source 1: Every Inc (Compound Engineering)

**Repository**: https://github.com/EveryInc/every-marketplace/tree/main/plugins/compound-engineering
**License**: MIT
**Original Author**: Kieran Klaassen (kieran@every.to)

### What We Adopted

- Multi-agent orchestration system
- Feedback codification approach (Learning Engine)
- Git worktree isolation for parallel execution
- Triage system for issue analysis
- Upstream tracking methodology (this document!)

### What We Modified

- All agents specialized for Cloudflare Workers (not Rails/Python)
- Converted markdown commands to shell scripts (Hard Tools pattern)
- Adapted for OpenCode instead of Claude Code

### Relevance Filter

**Adopt**: Workflow improvements, bug fixes, generic patterns
**Adapt**: Language-agnostic patterns → Cloudflare-specific
**Ignore**: Rails/Python/Ruby specific, Express/Next.js patterns

---

## Source 2: joelhooks/opencode-config

**Repository**: https://github.com/joelhooks/opencode-config
**License**: MIT
**Author**: Joel Hooks

### What We Adopted

- Directory structure (`.opencode/agent/`, `.opencode/knowledge/`)
- Persona architecture (consolidated agents with focused roles)
- Progressive disclosure pattern (context triggers)
- YAML frontmatter format for agents

### What We Modified

- Content focused on Cloudflare (not Effect-TS/Next.js)
- Added `tool/` directory for Hard Tools
- Added `state/` directory for tracking

### Relevance Filter

**Adopt**: Directory structure, persona patterns, config schema
**Adapt**: Prompt engineering patterns → Cloudflare context
**Ignore**: Effect-TS patterns, Next.js patterns

---

## Source 3: oh-my-opencode

**Repository**: https://github.com/code-yeongyu/oh-my-opencode
**License**: MIT
**Author**: Yeongyu Kim

### What We Adopted

- Shell wrapper pattern for complex workflows
- CLI verification before execution
- "Hard Tools" philosophy (scripts > AI instructions)

### What We Modified

- Scripts tailored for Cloudflare development
- Integrated with our validation tools

### Relevance Filter

**Adopt**: Shell patterns, CLI integration, hook system
**Adapt**: Generic utilities → Cloudflare-specific
**Ignore**: Zsh-specific features we don't need

---

## Source 4: Anthropic (Claude Code Plugins)

**Repository**: https://github.com/anthropics/claude-code/tree/main/plugins
**License**: MIT
**Maintainer**: Anthropic

### What We Reference

| Plugin | Relevance | Notes |
|--------|-----------|-------|
| `frontend-design` | HIGH | Design patterns, 4-dimension context |
| `code-review` | HIGH | Confidence scoring (80-point threshold) |
| `hookify` | HIGH | Safety hook patterns |
| `feature-dev` | MEDIUM | 7-phase workflow |
| `plugin-dev` | USEFUL | For our own development |

### What We Adopted

- Confidence scoring pattern (0-100 scale, 80+ threshold)
- Safety hook patterns (block destructive commands)
- 4-dimension design context (Purpose, Tone, Constraints, Differentiation)

### Relevance Filter

**Reference**: Patterns and architectures
**Adapt**: Generic patterns → Cloudflare-specific
**Ignore**: We implement patterns ourselves, don't install plugins

---

## Review Schedule

| Frequency | Action |
|-----------|--------|
| Monthly | Run `./bin/es-check-upstream.sh` |
| Monthly | Run `./bin/es-research-blogs.sh` |
| As Needed | Critical bug fixes or security updates |

## Running Upstream Checks

```bash
# Check all upstream sources
./bin/es-check-upstream.sh

# Check specific source
./bin/es-check-upstream.sh --source every

# Check since specific date
./bin/es-check-upstream.sh --since 2025-01-01

# Create GitHub issues for changes
./bin/es-check-upstream.sh --create-issues
```

## Running Blog Research

```bash
# Check Anthropic blogs for updates
./bin/es-research-blogs.sh

# Check since specific date
./bin/es-research-blogs.sh --since 2025-01-01
```

---

## Adoption Log

### 2025-12-18: Initial OpenCode Migration

**From Every Inc**:
- Adopted: Feedback codification, upstream tracking methodology
- Adapted: Multi-agent system → consolidated personas

**From joelhooks/opencode-config**:
- Adopted: Directory structure, persona format
- Adapted: Content for Cloudflare Workers

**From oh-my-opencode**:
- Adopted: Shell wrapper pattern (Hard Tools)
- Adapted: Scripts for Cloudflare validation

**From Anthropic**:
- Reference: Confidence scoring, safety hooks

---

## Metrics

- **Sources tracked**: 4
- **Last review**: 2025-12-18
- **Next review**: 2026-01-18
- **Patterns adopted**: 8
- **Patterns adapted**: 6
- **Value assessment**: High (foundational architecture)
