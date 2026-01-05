---
description: Comprehensive code review with swarm-based multi-agent analysis
---

# Code Review Command

<command_purpose>
Orchestrate a comprehensive code review using swarm-based multi-agent analysis. Automatically validates security, performance, Cloudflare patterns, and design using specialized workers with confidence scoring (80+ threshold) to filter noise and surface only high-quality findings.
</command_purpose>

## Introduction

<role>Senior Code Review Coordinator</role>

This command coordinates a **multi-agent swarm review** that parallels industry-standard code review practices with AI-powered analysis, following:

- **Anthropic's Best Practices**: Plan-then-execute, self-review, fresh context
- **OWASP Standards**: OWASP Top 10, security checklists, secure coding guidance
- **Cloudflare Patterns**: Workers runtime, edge optimization, binding validation
- **Accessibility**: WCAG compliance and inclusive design

## Prerequisites

<requirements>
- Git repository with changes to review (or PR number)
- Validation tools available (`typecheck`, `check_workers`, `check_secrets`, `validate_ui`)
- GitHub CLI (`gh`) for PR operations (optional)
- Beads (`bd`) for task tracking (recommended)
</requirements>

## Review Target Options

<review_targets>
You can review different targets with automatic detection:

1. **Pull Request**: `/f-review 123` or `/f-review https://github.com/org/repo/pull/123`
2. **Local Changes**: `/f-review --local` or `/f-review` (default if changes exist)
3. **Specific File**: `/f-review src/api/users.ts`
4. **Commit Range**: `/f-review main..feature-branch`

The command automatically determines the review scope and gathers appropriate context.
</review_targets>

## Main Workflow

### Phase 1: Pre-Review Validation

<thinking>
Run automated validation tools first to catch obvious issues before spending AI cycles on review.
</thinking>

**Run validation tools in parallel**:

```bash
# TypeScript validation
typecheck

# Cloudflare Workers compatibility
check_workers

# Hardcoded secrets detection
check_secrets

# shadcn/ui prop validation
validate_ui
```

**Collect validation results**:

- If **critical failures** exist (type errors, runtime incompatibility, exposed secrets):
  - ❌ **STOP**: Fix these first before proceeding with AI review
  - Report issues to user with remediation steps
  - Exit early

- If **warnings only**:
  - ✅ **CONTINUE**: Note warnings for AI context
  - Include in review context document

**Rationale**: Automated tools catch 60-70% of common issues deterministically. Don't waste expensive AI cycles on what linters can find.

### Phase 2: Context Gathering

<thinking>
Assemble comprehensive context for review workers following Anthropic's best practice of providing clear, structured input.
</thinking>

**Gather review context**:

1. **Determine target**:

   ```bash
   # If PR number provided
   if [[ "$1" =~ ^[0-9]+$ ]]; then
     TARGET_TYPE="pr"
     PR_NUMBER="$1"
     gh pr view $PR_NUMBER --json files,diff,title,body > pr_context.json

   # If local changes
   elif [[ "$1" == "--local" ]] || git diff --quiet; then
     TARGET_TYPE="local"
     git diff > local_changes.diff
     git diff --cached >> local_changes.diff

   # If file path
   elif [[ -f "$1" ]]; then
     TARGET_TYPE="file"
     FILE_PATH="$1"

   # If commit range
   else
     TARGET_TYPE="range"
     COMMIT_RANGE="$1"
     git diff $COMMIT_RANGE > range.diff
   fi
   ```

2. **Create context document** (`review_context.md`):

   ```markdown
   # Review Context

   ## Target

   - Type: [pr|local|file|range]
   - Identifier: [PR #123 | local changes | path/to/file.ts | main..feature]

   ## Repository Context

   - Framework: [from AGENTS.md - TanStack Start, shadcn/ui, etc.]
   - Patterns: [Cloudflare Workers, edge-first, etc.]
   - Validation Results: [typecheck, check_workers output]

   ## Changed Files

   [List of modified files with line counts]

   ## Full Diff

   [Complete diff content]

   ## PR Description (if applicable)

   [PR title and body from gh pr view]

   ## Review Objectives

   - Security: OWASP Top 10 compliance
   - Performance: Bundle size, edge optimization
   - Cloudflare: Runtime compatibility, binding patterns
   - Design: shadcn/ui usage, accessibility (WCAG)
   - Quality: TypeScript safety, maintainability
   ```

3. **Setup worktree** (for PR reviews):
   ```bash
   if [[ "$TARGET_TYPE" == "pr" ]]; then
     git_root=$(git rev-parse --show-toplevel)
     worktree_path="$git_root/.worktrees/reviews/pr-$PR_NUMBER"

     # Create isolated environment
     gh pr checkout $PR_NUMBER --worktree "$worktree_path"

     # Copy environment config
     [[ -f "$git_root/.env" ]] && cp "$git_root/.env" "$worktree_path/.env"

     # Navigate to worktree
     cd "$worktree_path"
   fi
   ```

### Phase 3: Swarm-Based Review

<thinking>
Dispatch specialized review workers in parallel following the swarm pattern from the code-reviewer skill. Each worker has domain expertise and returns structured findings.
</thinking>

**Activate code-reviewer skill**:

The `code-reviewer` skill (from `skill/code-reviewer/`) automatically orchestrates:

1. **Parallel Worker Dispatch** (4 specialized agents):
   - `@review-security`: Auth, secrets, injection, OWASP Top 10
   - `@review-performance`: Bundle size, caching, async patterns
   - `@review-cloudflare`: Workers runtime, bindings, Durable Objects
   - `@review-design`: shadcn/ui, Tailwind, accessibility (WCAG)

2. **Each worker analyzes** the `review_context.md` and returns:

   ```json
   {
     "findings": [
       {
         "title": "SQL Injection in User API",
         "category": "security",
         "severity": "P1",
         "file": "src/api/users.ts",
         "line": 42,
         "description": "...",
         "evidence": ["..."],
         "confidence_raw": 95
       }
     ]
   }
   ```

3. **Confidence Scoring** (from `skill/code-reviewer/references/CONFIDENCE_SCORING.md`):

   Each finding scored 0-100 based on:

   **Evidence Quality** (+20 each):
   - Specific file:line location
   - Code snippet demonstrates issue
   - Issue is in changed code (not pre-existing)
   - Violates documented standard

   **False Positive Indicators** (-20 each):
   - Issue in unchanged code
   - Would be caught by linter/typecheck
   - Has explicit ignore comment
   - Style preference, not a bug

   **Verification Boost** (+10 each):
   - Multiple workers flagged same issue
   - Matches known anti-pattern
   - AGENTS.md mentions this pattern

   **Threshold**: Only findings with confidence ≥ 80 shown to user

4. **Deduplication**:
   - Same file:line → Keep highest confidence
   - Similar issues → Combine and boost +10
   - Contradicting → Flag for manual review

### Phase 4: Finding Presentation

<deliverable>
Present high-confidence findings (≥80) to the user with actionable context
</deliverable>

**For each finding** (confidence ≥ 80):

````markdown
---

Finding #1: SQL Injection in User API

Confidence: 95/100 ✅
Severity: 🔴 P1

Category: Security (OWASP A03:2021 - Injection)

Description:
User input directly concatenated into SQL query without parameterization,
violating OWASP secure coding standards.

Location: src/api/users.ts:42

Problem:

```typescript
// ❌ Vulnerable code
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```
````

Impact:
Attacker could execute arbitrary SQL, potentially reading, modifying, or
deleting database contents. This is a **critical security vulnerability**.

Proposed Solution:

```typescript
// ✅ Safe with parameterized query
const query = db.prepare("SELECT * FROM users WHERE email = ?");
const result = await query.bind(userEmail).first();
```

Effort: Small (5-10 minutes)

Evidence (Confidence Breakdown):

- Specific location identified (+20)
- Code snippet demonstrates vulnerability (+20)
- Issue introduced in this PR (+20)
- OWASP Top 10 A03:2021 violation (+20)
- Security worker verification (+10)
- Pattern matches documented SQL injection anti-pattern (+10)

References:

- OWASP: https://owasp.org/www-community/attacks/SQL_Injection
- Cloudflare D1 Docs: https://developers.cloudflare.com/d1/platform/client-api/#prepared-statements

---

Do you want to add this to Beads?

1. yes - Create task with `bd add`
2. next - Skip to next finding
3. custom - Modify finding before creating task
4. fix - Attempt automatic fix (if available)

````

**Interactive workflow**:

- **Option 1 (yes)**:
  ```bash
  bd add "🔴 P1: SQL Injection in User API (src/api/users.ts:42)" \
    --description "$(cat finding_1.md)" \
    --priority high
````

- **Option 2 (next)**: Move to next finding

- **Option 3 (custom)**: Allow user to edit finding details before creating task

- **Option 4 (fix)**: If fix is deterministic (like adding type annotation), apply it automatically

### Phase 5: Summary Report

<deliverable>
Comprehensive review summary with metrics and next steps
</deliverable>

```markdown
## 📋 Code Review Complete

**Review Target:** PR #123 - "Add user authentication API"
**Review Date:** 2025-12-28
**Total Findings:** 12 (from all workers)
**High-Confidence (≥80):** 4 (shown to user)
**Filtered (<80):** 8 (auto-removed as noise)
**Todos Created:** 3

### Confidence Distribution

- 90-100 (certain): 2 findings
- 80-89 (confident): 2 findings
- 51-79 (uncertain): 5 findings (filtered)
- 0-50 (low): 3 findings (filtered)

### Findings by Category

**Security** (2 findings):

- 🔴 P1: SQL Injection in User API (confidence: 95)
- 🔴 P1: Hardcoded API key in config (confidence: 90)

**Performance** (1 finding):

- 🟡 P2: Missing cache headers on avatar endpoint (confidence: 85)

**Cloudflare** (1 finding):

- 🟡 P2: Blocking await in Worker request path (confidence: 82)

**Design** (0 findings):

- ✅ All checks passed

### Validation Results

✅ TypeScript: No errors
✅ Workers Runtime: Compatible
❌ Secrets Check: 1 hardcoded secret found
✅ UI Validation: shadcn/ui components used correctly

### Created Todos

- `bd-42` - 🔴 P1: SQL Injection in User API (confidence: 95)
- `bd-43` - 🔴 P1: Hardcoded API key in config (confidence: 90)
- `bd-44` - 🟡 P2: Missing cache headers (confidence: 85)

### Filtered Findings (Low Confidence)

8 findings were automatically filtered for low confidence (<80):

- "Consider renaming variable `x` to `userEmail`" (confidence: 45, style preference)
- "Missing JSDoc comment on `fetchUser`" (confidence: 30, documentation)
- ... (view full list with `--show-filtered`)

### Next Steps

1. **Fix Critical Issues** (2 P1 findings):
   - `bd show bd-42` - SQL Injection
   - `bd show bd-43` - Hardcoded API key

2. **Triage Medium Priority**:
   - Run `/f-triage` to prioritize P2 findings

3. **Re-run Validation**:
   - After fixes, run `check_secrets` and `typecheck` again

4. **Request Re-review**:
   - After addressing findings, run `/f-review` again or request human review

### Review Quality Metrics

- **Precision**: 4 high-confidence findings from 12 total (33% signal-to-noise)
- **Coverage**: All 4 categories reviewed (Security, Performance, Cloudflare, Design)
- **Execution Time**: ~45 seconds (parallel worker execution)
- **OWASP Coverage**: A03 (Injection), A07 (Auth), A05 (Security Config)
```

## Best Practices

### Do's ✅

- **Run validation tools first** - Catch obvious issues before AI review
- **Review small PRs** - < 400 lines of changes for best results
- **Trust high-confidence findings** (≥90) - These are almost certainly real issues
- **Investigate medium-confidence** (80-89) - Likely real, verify before fixing
- **Use beads for tracking** - Convert findings to persistent tasks
- **Re-review after fixes** - Ensure issues are resolved and no new ones introduced
- **Combine with human review** - AI catches patterns, humans understand context

### Don'ts ❌

- **Don't ignore P1 findings** - Security and data loss issues are blocking
- **Don't trust low-confidence** (<80) - Auto-filtered for good reason
- **Don't review massive PRs** - Break into smaller chunks first
- **Don't skip validation tools** - They're faster and more accurate for their domain
- **Don't disable confidence scoring** - It's your noise filter

## Integration with Other Commands

**Typical workflow**:

1. **Make changes** to codebase
2. **Run validation** (automatic in Phase 1):
   - `typecheck`
   - `check_workers`
   - `check_secrets`
   - `validate_ui`
3. `/f-review` ← THIS COMMAND
4. **Address findings** using created todos
5. `/f-commit` - Commit fixes
6. **Re-review** with `/f-review` to verify

**Or for PR reviews**:

1. **Receive PR** from teammate
2. `/f-review 123` - AI review first
3. **Human review** - Focus on business logic and architecture
4. **Request changes** or approve
5. **Merge** when both AI and human approve

## Advanced Usage

### Self-Review (Anthropic Best Practice)

For code you wrote yourself:

```bash
# Have Claude review its own code in fresh context
/f-review --self-review
```

This uses a **fresh Claude instance** (no prior conversation context) to critique the code objectively, following Anthropic's recommendation for better self-critique.

### Custom Review Focus

```bash
# Focus on specific category
/f-review --focus=security   # Only security worker
/f-review --focus=performance # Only performance worker

# Custom checklist (merge with standard)
/f-review --checklist=custom_security.md

# Adjust confidence threshold
/f-review --min-confidence=90  # Only show ≥90 (very strict)
/f-review --min-confidence=70  # Show ≥70 (more findings, more noise)
```

### Show Filtered Findings

```bash
# See what was auto-filtered
/f-review --show-filtered

# Review specific filtered finding
/f-review --show-filtered --finding=7
```

## Reference Checklists

This command uses industry-standard checklists from:

- **Security**: `skill/code-reviewer/references/REVIEW_CHECKLIST.md` (OWASP-aligned)
- **Confidence Scoring**: `skill/code-reviewer/references/CONFIDENCE_SCORING.md`
- **Swarm Patterns**: Orchestrated via `skill/code-reviewer/SKILL.md`

**OWASP Top 10 Coverage** (2021):

1. ✅ A01: Broken Access Control
2. ✅ A02: Cryptographic Failures
3. ✅ A03: Injection
4. ✅ A04: Insecure Design
5. ✅ A05: Security Misconfiguration
6. ✅ A06: Vulnerable Components
7. ✅ A07: Identification & Authentication
8. ✅ A08: Software & Data Integrity
9. ✅ A09: Security Logging Failures
10. ✅ A10: Server-Side Request Forgery

**WCAG 2.1 Coverage** (Level AA):

- ✅ Perceivable: Alt text, color contrast, semantic HTML
- ✅ Operable: Keyboard navigation, focus states, touch targets
- ✅ Understandable: Form labels, error messages, language
- ✅ Robust: Valid HTML, ARIA, screen reader compatibility

## Troubleshooting

**Issue**: "No changes to review"
**Solution**: Stage changes with `git add` or specify PR number

**Issue**: "Validation tools failed"
**Solution**: Fix critical errors first (typecheck, secrets) before AI review

**Issue**: "Too many findings (>20)"
**Solution**: PR too large - break into smaller chunks or use `--focus` flag

**Issue**: "All findings filtered (<80 confidence)"
**Solution**: Good! Your code passed automated review. Consider human review for business logic.

**Issue**: "Worker timeout"
**Solution**: PR too large. Review in chunks: `/f-review src/api/` then `/f-review src/ui/`

---

**Remember**: This is a **coordinator** command. The actual review logic lives in the `code-reviewer` skill and specialized worker agents. This command orchestrates the workflow, not implements it.
