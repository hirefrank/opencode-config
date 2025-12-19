# Model Strategy

Optimized for $100 Claude Max plan + free models (Gemini subscription, OpenCode GLM-4.6).

## Philosophy

- **Save Max quota for Opus** — deep thinking tasks only
- **Use free models for everything else** — Gemini 3 Flash, GLM-4.6
- **Simplicity over micro-optimization** — three model tiers, clear rules

---

## Daily Driver

**Gemini 3 Flash** — your default for general coding work.

| Metric | Value |
|--------|-------|
| SWE-bench | 78% (beats Sonnet's 77%) |
| Speed | 3x faster than Sonnet |
| Cost | FREE (Google subscription) |
| Context | 1M tokens |

### When to use daily driver:
- Implementing features from beads tasks
- Bug fixes
- Writing tests
- Refactoring
- General coding questions

### When to escalate to Opus:
- Complex architectural decisions → `@architect`
- Deep code review → `@reviewer`
- Pattern extraction → `@feedback-codifier`
- When Gemini gives unsatisfying answers

---

## Model Tiers

### Tier 1: Deep Thinking (Claude Max → Opus)

Reserved for work that genuinely needs Opus's 80.9% SWE-bench quality.

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `@architect` | Design decisions | New features, resource selection, trade-offs |
| `@reviewer` | Deep code review | Before merging, complex PRs |
| `@feedback-codifier` | Pattern extraction | After corrections, learning loops |

**Trigger:** Invoke explicitly with `@agent` or via context triggers.

### Tier 2: Balanced (Gemini 3 Flash — FREE)

Your daily driver and workhorse.

| Agent | Purpose |
|-------|---------|
| `testing` | E2E test generation |
| `reviewer-fast` | Quick reviews for small changes |
| `ui-validator` | shadcn/ui props validation |
| (default) | General coding |

### Tier 3: Fast/Simple (GLM-4.6 — FREE)

For quick, structured tasks.

| Agent | Purpose |
|-------|---------|
| `runtime-validator` | Check Workers API violations |
| `binding-analyzer` | Parse wrangler.toml |

---

## Workflow Integration

### Session Start
```bash
bd ready                    # Check pending beads tasks
# → Pick a task to work on
```

### During Session (Daily Driver: Gemini 3 Flash)
```
Working on: bd-a1b2 "Add rate limiting to API"

1. General coding → Gemini 3 Flash (default)
2. Hit a design question? → @architect (Opus)
3. Quick validation → @runtime-validator (GLM-4.6)
4. Ready to review? → @reviewer-fast (Gemini) or @reviewer (Opus)
```

### Session End
```bash
bd done bd-a1b2             # Mark completed
bd add "Continue X"         # Create for next session
git commit                  # Commit work
```

---

## Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│ What are you doing?                                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   General coding      Design/Review         Quick validation
        │                     │                     │
        ▼                     ▼                     ▼
   Gemini 3 Flash         Opus                  GLM-4.6
      (FREE)           ($100 Max)               (FREE)
```

---

## Model Configuration Summary

| Role | Model | Provider | Cost |
|------|-------|----------|------|
| Daily driver | Gemini 3 Flash | Google subscription | FREE |
| Deep thinking | Claude Opus 4.5 | Claude Max $100 | Included |
| Fast tasks | GLM-4.6 | OpenCode "big pickle" | FREE |

---

## Quota Protection Rules

1. **Never use Opus for simple coding** — that's what Gemini is for
2. **Never use Opus for validation** — GLM-4.6 handles it
3. **Invoke Opus agents explicitly** — `@architect`, `@reviewer`, `@feedback-codifier`
4. **Default model = Gemini** — saves Max quota automatically

---

## Monthly Cost Breakdown

| Item | Cost |
|------|------|
| Claude Max 5x (Opus access) | $100 |
| Gemini 3 Flash | $0 (subscription) |
| GLM-4.6 | $0 (OpenCode) |
| **Total** | **$100** |

All Tier 2/3 work is FREE. Max quota reserved for Opus-worthy tasks only.
