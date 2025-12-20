---
name: code-reviewer
description: Orchestrates comprehensive code reviews using swarm-based multi-agent analysis with parallel worker agents for security, performance, Cloudflare patterns, and design. Automatically activates for PR reviews, code review requests, or when analyzing changed files. Synthesizes findings with confidence scoring (80+ threshold) and creates actionable todos.
triggers:
  - "code review"
  - "PR review"
  - "review changes"
  - "review PR"
  - "review code"
  - "review my"
  - "analyze changes"
  - "check code quality"
  - "pre-commit review"
  - "pull request"
  - "diff"
  - "security review"
  - "performance review"
  - "review the"
---

# Code Reviewer SKILL

## Activation Patterns

This SKILL automatically activates when:

- User requests a code review or PR review
- Analyzing pull request changes
- Pre-commit code quality checks
- When phrases like "review this", "check this code", "analyze changes" are used
- Before merging branches

## Swarm Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Coordinator (This SKILL)                  │
│  Decomposes work → Spawns workers → Synthesizes results     │
└─────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│@review-     │        │@review-     │        │@review-     │
│security     │        │performance  │        │cloudflare   │
└─────────────┘        └─────────────┘        └─────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │@review-     │
                       │design       │
                       └─────────────┘
```

## Expertise Provided

### Multi-Agent Review Coordination

- **Parallel Worker Dispatch**: Spawns specialized workers for different concerns
- **Finding Synthesis**: Consolidates reports from all workers
- **Confidence Scoring**: Filters findings using 80+ threshold
- **Todo Creation**: Converts approved findings to actionable tasks

### Review Workers (Reference: `agent/review-workers/`)

1. **Security Worker** (`@review-security`)
   - Authentication/authorization vulnerabilities
   - Secret exposure and credential handling
   - Input validation and sanitization
   - Injection attacks (SQL, XSS, command)
   - CORS and CSP misconfigurations

2. **Performance Worker** (`@review-performance`)
   - Cold start optimization (bundle size)
   - Edge caching strategies
   - Async patterns and non-blocking I/O
   - Resource selection (KV vs DO)
   - Memory and CPU efficiency

3. **Cloudflare Worker** (`@review-cloudflare`)
   - Workers runtime compatibility
   - Binding patterns (env access)
   - Durable Objects lifecycle
   - KV/R2/D1/Queue usage
   - Stateless Worker enforcement

4. **Design Worker** (`@review-design`)
   - shadcn/ui component usage
   - Tailwind CSS patterns
   - Design anti-patterns
   - Accessibility basics (WCAG)
   - Animation and interaction patterns

## Workflow

### Phase 1: Setup and Context

1. **Determine Review Target**
   - PR number (numeric)
   - GitHub URL
   - Local changes (--local flag)
   - File path

2. **Create Worktree** (for PR reviews)

   ```bash
   git_root=$(git rev-parse --show-toplevel)
   mkdir -p "$git_root/.worktrees/reviews"
   gh pr checkout $PR_NUMBER --worktree "$git_root/.worktrees/reviews/pr-$PR_NUMBER"
   ```

3. **Copy Environment**
   ```bash
   if [ -f "$git_root/.env" ]; then
     cp "$git_root/.env" "$git_root/.worktrees/reviews/pr-$PR_NUMBER/.env"
   fi
   ```

### Phase 2: Parallel Worker Dispatch

Run ALL workers in parallel:

```bash
# Parallel execution (4 workers)
opencode @review-security < context.md &
opencode @review-performance < context.md &
opencode @review-cloudflare < context.md &
opencode @review-design < context.md &
wait
```

### Phase 3: Finding Synthesis

#### Confidence Scoring System

| Score      | Meaning                              | Action                        |
| ---------- | ------------------------------------ | ----------------------------- |
| 0-25       | Not confident; likely false positive | Auto-filter                   |
| 26-50      | Somewhat confident; might be valid   | Auto-filter                   |
| 51-79      | Moderately confident; uncertain      | Auto-filter                   |
| **80-89**  | Highly confident; real and important | **Show to user**              |
| **90-100** | Absolutely certain; definitely real  | **Show to user (prioritize)** |

#### Confidence Criteria

**Evidence Quality** (+20 points each):

- Specific file and line number identified
- Code snippet demonstrates the issue
- Issue is in changed code (not pre-existing)
- Clear violation of documented standard

**False Positive Indicators** (-20 points each):

- Issue exists in unchanged code
- Would be caught by linter/type checker
- Has explicit ignore comment
- Is a style preference, not a bug

**Verification** (+10 points each):

- Multiple agents flagged same issue
- Issue matches known anti-pattern
- AGENTS.md mentions this pattern

### Phase 4: Finding Presentation

For each finding with confidence >= 80:

```
---
Finding #X: [Brief Title]

Confidence: [Score]/100 ✅
Severity: 🔴 P1 / 🟡 P2 / 🔵 P3

Category: [Security/Performance/Cloudflare/Design]

Description:
[Detailed explanation]

Location: [file_path:line_number]

Problem:
[What's wrong]

Impact:
[Why this matters]

Proposed Solution:
[How to fix it]

Effort: Small/Medium/Large

Evidence:
- [Why confidence is high]

---
Do you want to add this to the todo list?
1. yes - create todo/issue
2. next - skip this finding
3. custom - modify before creating
```

### Phase 5: Summary Report

```markdown
## Code Review Complete

**Review Target:** [PR number or branch]
**Total Findings:** [X] (from all agents)
**High-Confidence (≥80):** [Y] (shown to user)
**Filtered (<80):** [Z] (auto-removed)
**Todos Created:** [W]

### Confidence Distribution:

- 90-100 (certain): [count]
- 80-89 (confident): [count]
- <80 (filtered): [count]

### Created Todos:

- `{id}-{description}` - {title} (confidence: 95)
  ...

### Next Steps:

1. Review created todos
2. Use `/es-triage` to prioritize
3. Start working on items
```

## Integration Points

### Complementary Components

- **Validation tools**: `typecheck`, `check_workers`, `check_secrets`, `validate_ui`
- **beads**: Issue tracking for findings
- **oh-my-opencode agents**: `@oracle` for architecture, `@librarian` for research

### Escalation Triggers

- Complex architecture questions → `@oracle` agent
- Deep security analysis → `@librarian` for security patterns
- Performance deep-dive → Use `check_workers` tool

## Quick Start

### Manual Review

```bash
# Ask for code review naturally
"Review my current changes for security and performance issues"

# Or use oh-my-opencode agents
"Ask @oracle to review this architecture"
opencode @review-cloudflare < context.md
opencode @review-design < context.md

# Then synthesize
opencode @reviewer < synthesis.md
```

## Benefits

### Immediate Impact

- **Comprehensive Coverage**: Multiple specialized reviewers catch different issues
- **Reduced False Positives**: Confidence scoring filters noise
- **Actionable Output**: Findings become trackable todos
- **Parallel Execution**: ~70% faster than sequential review

### Long-term Value

- **Consistent Quality**: Same thorough review every time
- **Knowledge Capture**: Patterns learned from reviews
- **Team Alignment**: Shared understanding of quality standards
- **Reduced Review Burden**: AI handles routine checks

## Stakeholder Perspectives

### Developer Perspective

- How easy is this to understand and modify?
- Are the APIs intuitive?
- Is debugging straightforward?

### Operations Perspective

- How do I deploy this safely?
- What metrics and logs are available?
- How do I troubleshoot issues?

### Security Team Perspective

- What's the attack surface?
- How is data protected?
- What are the audit capabilities?

### Business Perspective

- What's the ROI?
- Are there compliance risks?
- What's the total cost of ownership?

This SKILL ensures comprehensive, consistent code reviews by orchestrating specialized worker agents and synthesizing their findings into actionable, confidence-scored recommendations.

## Reference Materials

- [references/SWARM_PATTERNS.md](references/SWARM_PATTERNS.md) - Advanced swarm coordination patterns
- [references/CONFIDENCE_SCORING.md](references/CONFIDENCE_SCORING.md) - Detailed scoring methodology
- [references/REVIEW_CHECKLIST.md](references/REVIEW_CHECKLIST.md) - Comprehensive review checklist
