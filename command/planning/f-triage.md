---
description: Triage findings and decisions to add to the Beads (bd) persistent task system
---

Present all findings, decisions, or issues here one by one for triage. The goal is to go through each item and decide whether to add it to the Beads (bd) persistent task system.

**IMPORTANT: DO NOT CODE ANYTHING DURING TRIAGE!**

This command is for:

- Triaging code review findings
- Processing security audit results
- Reviewing performance analysis
- Handling any other categorized findings that need tracking

## Workflow

### Step 1: Present Each Finding

For each finding, present in this format:

```
---
Issue #X: [Brief Title]

Severity: 🔴 P1 (CRITICAL) / 🟡 P2 (IMPORTANT) / 🔵 P3 (NICE-TO-HAVE)

Category: [Security/Performance/Architecture/Bug/Feature/etc.]

Description:
[Detailed explanation of the issue or improvement]

Location: [file_path:line_number]

Problem Scenario:
[Step by step what's wrong or could happen]

Proposed Solution:
[How to fix it]

Estimated Effort: [Small (< 2 hours) / Medium (2-8 hours) / Large (> 8 hours)]

---
Do you want to add this to Beads?
1. yes - run bd add
2. next - skip this item
3. custom - modify before adding
```

### Step 2: Handle User Decision

**When user says "yes":**

1. **Map severity to priority:**
   - 🔴 P1 (CRITICAL) → `1`
   - 🟡 P2 (IMPORTANT) → `2`
   - 🔵 P3 (NICE-TO-HAVE) → `3`

2. **Run `bd add`:**

   ```bash
   bd add "[Brief Title]" --description "[Description + Location + Solution]" --priority [priority] --label [category]
   ```

3. **Confirm creation:**
   "✅ Added to Beads: `[Brief Title]`"

**When user says "next":**

- Skip to the next item
- Track skipped items for summary

**When user says "custom":**

- Ask what to modify (priority, description, details)
- Update the information
- Present revised version
- Ask again: yes/next/custom

**Cloudflare-Specific Labels to Use:**

- `workers-runtime` - V8 runtime issues, Node.js API usage
- `bindings` - KV/R2/D1/DO binding configuration or usage
- `security` - Workers security model, secrets, CORS
- `performance` - Cold starts, bundle size, edge optimization
- `durable-objects` - DO patterns, state persistence, WebSockets
- `kv` - KV usage patterns, TTL, consistency
- `r2` - R2 storage patterns, uploads, streaming
- `d1` - D1 database patterns, migrations, queries
- `edge-caching` - Cache API patterns, invalidation
- `workers-ai` - AI integration, Vercel AI SDK, RAG

### Step 3: Continue Until All Processed

- Process all items one by one
- Track using TodoWrite for visibility
- Don't wait for approval between items - keep moving

### Step 4: Final Summary

After all items processed:

```markdown
## Triage Complete

**Total Items:** [X]
**Tasks Added:** [Y]
**Skipped:** [Z]

### Added to Beads:

- `[Task Title 1]`
- `[Task Title 2]`
  ...

### Skipped Items:

- Item #5: [reason]
- Item #12: [reason]

### Next Steps:

1. View available work: `bd ready`
2. Start work: `bd update <id> --status in_progress`
```

## Example Response Format

```
---
Issue #5: Missing Transaction Boundaries for Multi-Step Operations

Severity: 🔴 P1 (CRITICAL)

Category: Data Integrity / Security

Description:
The google_oauth2_connected callback in GoogleOauthCallbacks concern performs multiple database
operations without transaction protection. If any step fails midway, the database is left in an
inconsistent state.

Location: app/controllers/concerns/google_oauth_callbacks.rb:13-50

Problem Scenario:
1. User.update succeeds (email changed)
2. Account.save! fails (validation error)
3. Result: User has changed email but no associated Account
4. Next login attempt fails completely

Operations Without Transaction:
- User confirmation (line 13)
- Waitlist removal (line 14)
- User profile update (line 21-23)
- Account creation (line 28-37)
- Avatar attachment (line 39-45)
- Journey creation (line 47)

Proposed Solution:
Wrap all operations in ApplicationRecord.transaction do ... end block

Estimated Effort: Small (30 minutes)

---
Do you want to add this to Beads?
1. yes - run bd add
2. next - skip this item
3. custom - modify before adding
```

Do not code during triage. When user says yes, run `bd add` to create the beads task. Track progress using TodoWrite for real-time visibility.

Every time you present a finding as a header, include triage progress: how many completed, how many remaining, and estimated time for completion based on current pace.
