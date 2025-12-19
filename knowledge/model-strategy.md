# Model Strategy

Optimized for $100 Claude Max plan + free models (Google Gemini Subscription, OpenCode Zen).

## The "Bucket" Philosophy

To maintain maximum reliability and efficiency, we divide our models into three provider "buckets." If one bucket is capped (usage limit) or down (API outage), we switch to a different bucket.

### Bucket A: Anthropic ($100 Max Plan)
*   **Models**: Opus 4.5, Sonnet 4.5.
*   **Quota**: Shared. If Opus hits a daily limit, Sonnet may be capped as well.
*   **Best For**: Absolute gold-standard reasoning and reliability.

### Bucket B: Google (Free/Pro Subscription)
*   **Models**: Gemini 3 Pro, Gemini 3 Flash.
*   **Quota**: Independent of Bucket A.
*   **Best For**: Daily coding, high-reasoning tasks that don't need Opus, and independent redundancy.

---

## Agent Intent Tiers

We use agents to intentionally choose the right model for the right task.

### Tier 1: Gold Standard (Bucket A)
Use when quality is the ONLY priority.
*   `@architect` (Opus 4.5)
*   `@reviewer` (Opus 4.5)
*   `@feedback-codifier` (Opus 4.5)

### Tier 2: Independent High-Reasoning (Bucket B)
High-quality alternatives that use your Google subscription instead of Claude Max quota.
*   `@architect-alt` (Gemini 3 Pro)
*   `@reviewer-alt` (Gemini 3 Pro)
*   `@feedback-codifier-alt` (Gemini 3 Pro)

### Tier 3: Fast & Lightweight (Bucket B)
The default for general chat and quick utility tasks.
*   **Primary (Chat)**: Gemini 3 Flash (Free/Fast)
*   **@reviewer-fast**: Instant sanity checks.
*   **@explainer-fast**: Quick code/pattern explanations.
*   **@testing**: E2E generation.
*   **Global Fallback**: Sonnet 4.5 (Reliable backup)

---

## Quota Protection Rules

1.  **Context Triggers = Opus**: By default, keywords like "review" or "architect" will trigger **Tier 1 (Opus 4.5)**. If you are low on quota, explicitly use the `@agent-alt` versions.
2.  **Small Tasks = Big Pickle**: All background tasks (titling sessions, summarizing context) are hard-coded to **Bucket C** to prevent credit bleed.
3.  **Proactive Scaling**: If Gemini Flash gives an unsatisfying answer, don't keep retry-looping. Immediately escalate to `@architect-alt` (Gemini Pro) or `@architect` (Opus).

---

## Workflow Integration

Every session follows the **beads** lifecycle to ensure cross-session memory:

### 1. Session Start
```bash
bd ready    # Check unblocked tasks
# Select task and begin coding with Gemini Flash
```

### 2. Deep Work
*   Complex logic? → `@architect`
*   Quota saving? → `@architect-alt`
*   Quick check? → `@reviewer-fast`

### 3. Session End
```bash
bd done [id]       # Close task
bd add "..."       # Log next steps
git commit -m "..."
git push           # Mandatory

---

## Limit Handling Summary

1.  **If Opus is capped**: Switch to the "alt" equivalent (e.g., `@architect` -> `@architect-alt`). This jumps you from **Bucket A** to **Bucket B**.
2.  **If Gemini Flash is capped**: OpenCode will automatically fall back to **Sonnet 4.5**. This jumps you from **Bucket B** to **Bucket A**.
3.  **If both are capped**: Stick to Bucket C (Big Pickle) for basic tasks or wait for quota reset.