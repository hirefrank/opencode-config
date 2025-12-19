# Model Strategy

Optimized for $100 Claude Max plan + free models (Gemini subscription, OpenCode GLM-4.6).

## Philosophy

- **Save Max quota for Opus** — deep thinking tasks only
- **Use free models for everything else** — Gemini 3 Flash, GLM-4.6
- **Simplicity over micro-optimization** — three model tiers, clear rules

---

## Configuration Note

Check your `opencode.jsonc` primary model setting:

```jsonc
"model": {
  "primary": "...",      // ← This is your daily driver
  "fallback": "...",
  "lightweight": "..."
}
```

If `primary` is set to Opus, general coding consumes Max quota.
Configure Gemini 3 Flash as primary to save quota for explicit Opus agent calls.

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

## Overflow Strategy

When you hit rate limits, cascade through free models before touching Max quota:

```
┌─────────────────────────────────────────────────────────────┐
│ PRIMARY: Gemini 3 Flash (FREE)                              │
│ Hit limit?                                                  │
│     ↓                                                       │
│ OVERFLOW 1: GLM-4.6 "big pickle" (FREE)                     │
│ Hit limit?                                                  │
│     ↓                                                       │
│ OVERFLOW 2: Claude Sonnet (Max quota) — LAST RESORT         │
└─────────────────────────────────────────────────────────────┘
```

| If you hit... | Overflow to... | Cost |
|---------------|----------------|------|
| Gemini 3 Flash | GLM-4.6 | FREE |
| GLM-4.6 | Gemini 3 Flash | FREE |
| Both free models | Claude Sonnet | Max quota |

**If you're hitting both free model limits regularly:**
- You're doing massive refactors → normal, use Sonnet overflow
- Something inefficient is happening → investigate token usage

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

## Model Comparison (December 2025)

### Why These Models?

| Model | SWE-bench | Best For | Cost |
|-------|-----------|----------|------|
| **Claude Opus 4.5** | 80.9% ⭐ | Complex coding, nuance | $100 Max |
| **Gemini 3 Flash** | 78% | Daily coding, fast | FREE |
| **GLM-4.6** | ~75% | Validation, structured | FREE |
| Claude Sonnet 4.5 | 77.2% | (backup only) | Max quota |
| Claude Haiku 4.5 | 73.3% | (don't use, wastes quota) | Max quota |

### Models NOT in Your Stack (and why)

| Model | Why Skip |
|-------|----------|
| GPT-5.2 Pro | Not free, Opus covers deep thinking |
| DeepSeek V3.2 | You have Gemini/GLM free already |
| Grok 4 Fast | Nice 2M context, but Gemini's 1M is enough |

---

## Quota Protection Rules

1. **Never use Opus for simple coding** — that's what Gemini is for
2. **Never use Opus for validation** — GLM-4.6 handles it
3. **Invoke Opus agents explicitly** — `@architect`, `@reviewer`, `@feedback-codifier`
4. **Default model = Gemini** — saves Max quota automatically
5. **Haiku/Sonnet waste quota** — use free alternatives instead

---

## Subscriptions & Plans

### Keep
| Plan | Cost | Why |
|------|------|-----|
| Claude Max 5x | $100/mo | Opus access for deep thinking |
| Google Gemini Pro | (existing) | Gemini 3 Flash for daily driver |

### Don't Renew
| Plan | Why |
|------|-----|
| GLM 4.6 Quarterly | OpenCode "big pickle" provides GLM-4.6 FREE |

**Before quarterly expires:** Test that big pickle alone handles your validator workload.

---

## Monthly Cost Breakdown

| Item | Cost |
|------|------|
| Claude Max 5x (Opus access) | $100 |
| Gemini 3 Flash | $0 (subscription) |
| GLM-4.6 | $0 (OpenCode) |
| **Total** | **$100** |

All Tier 2/3 work is FREE. Max quota reserved for Opus-worthy tasks only.

---

## Future Considerations

### When to Re-evaluate
- New model releases (check benchmarks vs current stack)
- If you consistently hit Max limits → consider Max 20x ($200)
- If you never hit Max limits → consider dropping to Pro ($20) + API overflow

### Models to Watch
| Model | Why Watch |
|-------|-----------|
| Gemini 3 Pro | If included in subscription, could replace some Opus work |
| Claude Opus 5 | Next Opus release, update model IDs when available |
| GPT-5.2-Codex | If you need agentic long-horizon refactors |
