# Confidence Scoring System

## Overview

The confidence scoring system ensures only high-quality findings reach the user, filtering noise and false positives automatically.

## Score Ranges

| Score      | Meaning                              | Action                        |
| ---------- | ------------------------------------ | ----------------------------- |
| 0-25       | Not confident; likely false positive | Auto-filter                   |
| 26-50      | Somewhat confident; might be valid   | Auto-filter                   |
| 51-79      | Moderately confident; uncertain      | Auto-filter                   |
| **80-89**  | Highly confident; real and important | **Show to user**              |
| **90-100** | Absolutely certain; definitely real  | **Show to user (prioritize)** |

## Scoring Criteria

### Evidence Quality (+20 points each)

1. **Specific Location**
   - Exact file path identified
   - Line number provided
   - Can be navigated directly

2. **Code Demonstration**
   - Snippet shows the issue
   - Clear before/after comparison
   - Reproducible pattern

3. **Changed Code Focus**
   - Issue is in modified lines
   - Not pre-existing technical debt
   - Introduced in this PR

4. **Standard Violation**
   - Violates documented pattern
   - Referenced in AGENTS.md or docs
   - Has authoritative source

### False Positive Indicators (-20 points each)

1. **Unchanged Code**
   - Issue exists before PR
   - Not in diff
   - Pre-existing tech debt

2. **Linter Coverage**
   - Would be caught by ESLint
   - Type checker would flag
   - Existing CI check covers

3. **Explicit Ignore**
   - Has `// eslint-disable` comment
   - Documented exception
   - Intentional deviation

4. **Style Preference**
   - Not a bug, just preference
   - No functional impact
   - Subjective opinion

### Verification Boost (+10 points each)

1. **Multi-Agent Agreement**
   - Multiple workers flagged same issue
   - Cross-category confirmation
   - Independent detection

2. **Pattern Match**
   - Matches known anti-pattern
   - Documented in references
   - Historical precedent

3. **Documentation Match**
   - AGENTS.md mentions pattern
   - Team standards violated
   - Industry best practice

## Calculation Example

```
Finding: SQL Injection in API endpoint

Base score: 50

Evidence Quality:
+ Specific file: src/api/users.ts:42       (+20)
+ Code snippet shows string concatenation  (+20)
+ Issue is in new route added by PR        (+20)
+ OWASP SQL injection violation            (+20)

False Positives:
- None identified                          (+0)

Verification:
+ Security worker flagged it               (+0, already counted)
+ Matches known SQL injection pattern      (+10)
+ AGENTS.md security section               (+10)

Final Score: 50 + 80 + 0 + 20 = 150 → capped at 100
```

## Severity Classification

### P1 (Critical) - Blocking

- Security vulnerabilities with exploit path
- Data loss or corruption risks
- Production-breaking bugs
- Compliance violations

### P2 (Important) - Should Fix

- Performance degradations
- Reliability concerns
- Maintainability issues
- UX problems

### P3 (Minor) - Consider

- Style inconsistencies
- Documentation gaps
- Future tech debt
- Nice-to-have improvements

## Deduplication Rules

When multiple workers flag similar issues:

1. **Same file:line** → Keep highest confidence
2. **Similar issues** → Combine, boost confidence by +10
3. **Contradicting findings** → Flag for manual review

## Output Format

```markdown
---
Finding #1: SQL Injection in User API

Confidence: 95/100 ✅
Severity: 🔴 P1

Category: Security

Description:
User input directly concatenated into SQL query without parameterization.

Location: src/api/users.ts:42

Problem:
String interpolation in SQL query allows injection attacks.

Impact:
Attacker could read, modify, or delete database contents.

Proposed Solution:
Use parameterized queries with prepared statements.

Effort: Small

Evidence:
- Specific line with vulnerable code (+20)
- Code snippet demonstrates issue (+20)
- New code in this PR (+20)
- OWASP Top 10 violation (+20)
- Security worker verification (+10)

---
```

## Worker-Specific Scoring

### Security Worker

High confidence triggers:
- Secret/credential exposure
- Authentication bypass
- Input validation gaps
- Injection vulnerabilities

### Performance Worker

High confidence triggers:
- N+1 query patterns
- Unbounded data loading
- Missing caching
- Blocking operations

### Cloudflare Worker

High confidence triggers:
- Runtime violations
- Binding misuse
- DO lifecycle errors
- Resource limits

### Design Worker

High confidence triggers:
- Accessibility failures
- Component misuse
- Missing error states
- Animation issues
