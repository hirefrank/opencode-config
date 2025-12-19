# Model Strategy

Optimized for $100 Claude Max plan + free models (Google Gemini Subscription, OpenCode Zen).

## The "Bucket" Philosophy

To maintain maximum reliability and efficiency, we divide our models into three provider "buckets." If one bucket is capped (usage limit) or down (API outage), we switch to a different bucket.

### Bucket A: Anthropic ($100 Max Plan)

- **Models**: Opus 4.5, Sonnet 4.5
- **Quota**: Shared. If Opus hits a daily limit, Sonnet may be capped as well.
- **Best For**: Absolute gold-standard reasoning and reliability.

### Bucket B: Google (Free/Pro Subscription)

- **Models**: Gemini 3 Pro, Gemini 3 Flash
- **Quota**: Independent of Bucket A.
- **Best For**: Daily coding, high-reasoning tasks that don't need Opus, and independent redundancy.

### Bucket C: Free Tier (OpenCode Zen)

- **Models**: Big Pickle
- **Quota**: Unlimited (free tier)
- **Best For**: Deterministic validation scripts, background tasks, titling sessions.

---

## Agent Intent Tiers

We use agents to intentionally choose the right model for the right task.

### Tier 1: Gold Standard (Bucket A - Opus 4.5)

Use when quality is the ONLY priority. Consumes Anthropic Max quota.

| Agent                         | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `@architect`                  | Senior Cloudflare Architect              |
| `@reviewer`                   | Deep code review with confidence scoring |
| `@feedback-codifier`          | Extracts patterns from feedback          |
| `@durable-objects`            | Durable Objects and State Management     |
| `@frontend-design-specialist` | Prevents generic UI patterns             |
| `@tanstack-ui-architect`      | TanStack Start architecture              |
| `@plan`                       | Opus-powered reliable task breakdown     |
| `@explore`                    | High-precision codebase navigation       |

### Tier 2: Independent High-Reasoning (Bucket B - Gemini Pro)

High-quality alternatives that use Google subscription instead of Claude Max quota.

| Agent                             | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `@architect-alt`                  | Cloudflare Architect (quota saving)       |
| `@reviewer-alt`                   | Smart code review (quota saving)          |
| `@feedback-codifier-alt`          | Pattern extraction (quota saving)         |
| `@frontend-design-specialist-alt` | UI pattern enforcement                    |
| `@tanstack-migration-specialist`  | TanStack migration patterns               |
| `@tanstack-ssr-specialist`        | TanStack SSR and Server Functions         |
| `@better-auth-specialist`         | better-auth D1 integration                |
| `@polar-billing-specialist`       | Polar.sh billing integration              |
| `@general-alt`                    | High-reasoning conversational alternative |

### Tier 3: Fast & Lightweight (Bucket B - Gemini Flash)

The default for general chat, parallel workers, and quick tasks.

| Agent                            | Purpose                         |
| -------------------------------- | ------------------------------- |
| `@reviewer-fast`                 | Instant sanity checks           |
| `@explainer-fast`                | Quick code/pattern explanations |
| `@testing`                       | E2E test generation             |
| `@ui-validator`                  | shadcn/ui component validation  |
| `@tanstack-routing-specialist`   | TanStack Router patterns        |
| `@accessibility-guardian`        | WCAG compliance validation      |
| `@mcp-efficiency-specialist`     | MCP token optimization          |
| `@playwright-testing-specialist` | Playwright E2E patterns         |
| `@resend-email-specialist`       | Resend email integration        |
| `@git-history-analyzer`          | Git history analysis            |
| `@build`                         | Implementation muscle           |
| `@compaction`                    | Context management              |
| `@summary`                       | Fast session handoffs           |

**Review Swarm Workers** (parallel execution):

- `@review-security` - Security-focused review
- `@review-performance` - Performance-focused review
- `@review-cloudflare` - Cloudflare patterns review
- `@review-design` - Design/UI review

**Global Fallback**: Sonnet 4.5 (when Flash is capped)

### Tier 4: Validation Scripts (Bucket C - Big Pickle)

Free tier for deterministic validation. Script-like behavior.

| Agent               | Purpose                        |
| ------------------- | ------------------------------ |
| `@runtime-guardian` | Workers runtime compatibility  |
| `@binding-analyzer` | wrangler.toml binding analysis |

---

## Quota Protection Rules

1. **Context Triggers = Opus**: By default, keywords like "review" or "architect" will trigger **Tier 1 (Opus 4.5)**. If you are low on quota, explicitly use the `@agent-alt` versions.
2. **Small Tasks = Big Pickle**: All background tasks (titling sessions, summarizing context) are hard-coded to **Bucket C** to prevent credit bleed.
3. **Proactive Scaling**: If Gemini Flash gives an unsatisfying answer, don't keep retry-looping. Immediately escalate to `@architect-alt` (Gemini Pro) or `@architect` (Opus).

---

## Limit Handling Summary

| Scenario         | Action                   | Effect              |
| ---------------- | ------------------------ | ------------------- |
| **Opus capped**  | Use `-alt` agents        | Bucket A → Bucket B |
| **Flash capped** | Falls back to Sonnet 4.5 | Bucket B → Bucket A |
| **Both capped**  | Use Tier 4 agents        | Bucket C (free)     |

---

## Workflow Integration

Every session follows the **beads** lifecycle to ensure cross-session memory:

### 1. Session Start

```bash
bd ready    # Check unblocked tasks
# Select task and begin coding with Gemini Flash
```

### 2. Deep Work

- Complex logic? → `@architect`
- Quota saving? → `@architect-alt`
- Quick check? → `@reviewer-fast`

### 3. Session End

```bash
bd done [id]       # Close task
bd add "..."       # Log next steps
git commit -m "..."
git push           # Mandatory
```
