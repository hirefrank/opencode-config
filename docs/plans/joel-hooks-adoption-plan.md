# Joel Hooks OpenCode Adoption Plan

**Epic:** opencode-config-758
**Created:** 2025-12-19
**Target:** Enhance Cloudflare/Tanstack workflow with proven patterns from joelhooks/opencode-config

## Executive Summary

This plan adopts valuable patterns from Joel Hooks' opencode-config while maintaining focus on our Cloudflare Workers + Tanstack Start stack. We're prioritizing:

1. **Custom MCP tools** for better TypeScript validation and git context
2. **Swarm orchestration** for parallel agent execution
3. **Skills migration** aligned with upcoming OpenCode Skills support
4. **Knowledge expansion** with testing, error, and prevention patterns

**Cost/Benefit:** 70% cost reduction potential through swarm coordination, better type safety, and systematic testing patterns.

---

## Phase 1: Before Skills Launch (This Week)

**Priority:** P1 - Complete ASAP
**Timeline:** Before Skills support releases

### Tasks

#### 1. Add typecheck.ts custom MCP tool
**ID:** opencode-config-758.2
**Status:** Ready to work

**What:** Port TypeScript validation tool with grouped errors from Joel's config.

**Why:** Essential for type-safe Workers development. Currently relying on manual `tsc` runs.

**Implementation:**
```bash
# 1. Copy tool from Joel's repo
curl -o tool/typecheck.ts https://raw.githubusercontent.com/joelhooks/opencode-config/main/tool/typecheck.ts

# 2. Update opencode.jsonc to register tool
# Add to "tool" section

# 3. Test with sample Workers project
```

**Success Criteria:** Can run typecheck via MCP tool and get grouped error output.

---

#### 2. Add git-context.ts custom MCP tool
**ID:** opencode-config-758.3
**Status:** Ready to work

**What:** Branch status + commits in one call.

**Why:** Your es-work workflow uses git worktrees extensively. This consolidates multiple git commands into one tool call.

**Implementation:**
```bash
# 1. Copy tool from Joel's repo
curl -o tool/git-context.ts https://raw.githubusercontent.com/joelhooks/opencode-config/main/tool/git-context.ts

# 2. Update opencode.jsonc

# 3. Test with es-work command
```

**Success Criteria:** Single tool call returns branch, status, recent commits, and diff summary.

---

#### 3. Add repo-autopsy.ts custom MCP tool
**ID:** opencode-config-758.4
**Status:** Ready to work

**What:** Deep codebase analysis (AST, blame, hotspots).

**Why:** Perfect for understanding legacy code before Tanstack migrations.

**Implementation:**
```bash
# 1. Copy tool from Joel's repo
curl -o tool/repo-autopsy.ts https://raw.githubusercontent.com/joelhooks/opencode-config/main/tool/repo-autopsy.ts

# 2. Install dependencies if needed
# 3. Update opencode.jsonc
# 4. Test with target migration project
```

**Success Criteria:** Can analyze a React/Next.js project and identify:
- Hot files (most changed)
- AST complexity
- Blame distribution
- Migration candidates

---

#### 4. Add agent permission constraints
**ID:** opencode-config-758.5
**Status:** Ready to work

**What:** Add `allowed-tools` constraints to agent frontmatter.

**Why:** runtime-validator and ui-validator don't need write access. Constraining prevents accidental modifications.

**Implementation:**
Update agent frontmatter:

```yaml
# agent/cloudflare/runtime-guardian.md
---
name: runtime-guardian
model: anthropic/claude-haiku-4-5
allowed-tools: Read Grep
color: "#3B82F6"
---

# agent/integrations/accessibility-guardian.md
---
name: accessibility-guardian
model: anthropic/claude-sonnet-4-5
allowed-tools: Read Grep
color: "#3B82F6"
---

# agent/integrations/playwright-testing-specialist.md
---
name: playwright-testing-specialist
model: anthropic/claude-sonnet-4-5
allowed-tools: Read Grep Bash(playwright:*) Write(test/**/*)
color: "#A855F7"
---
```

**Success Criteria:** Agents respect permission boundaries (verify with test run).

---

#### 5. Create testing-patterns.md knowledge file
**ID:** opencode-config-758.6
**Status:** Ready to work

**What:** Port 25 dependency-breaking techniques for testing.

**Why:** You have playwright-testing-specialist agent but no testing patterns knowledge.

**Implementation:**
```bash
# 1. Review Joel's skills/testing-patterns/SKILL.md
curl https://raw.githubusercontent.com/joelhooks/opencode-config/main/skills/testing-patterns/SKILL.md -o /tmp/testing-patterns-source.md

# 2. Extract relevant patterns (focus on TypeScript/Workers)
# 3. Create knowledge/testing-patterns.md
# 4. Add to AGENTS.md or instructions array
```

**Key Patterns to Include:**
- The Seam Model (dependency injection for Workers)
- Characterization Tests (documenting actual behavior)
- Breaking Dependencies (Parameterize Constructor, Extract Interface)
- Safe Refactoring (Preserve Signatures, Lean on Compiler)

**Success Criteria:** playwright-testing-specialist agent can reference patterns when writing tests.

---

#### 6. Review swarm.ts plugin architecture
**ID:** opencode-config-758.7
**Status:** Ready to work

**What:** Study Joel's multi-agent coordination patterns.

**Why:** Understand how to implement parallel execution for es-review (run Security, Performance, Design, Cloudflare perspectives concurrently).

**Implementation:**
```bash
# 1. Read swarm.ts plugin
curl https://raw.githubusercontent.com/joelhooks/opencode-config/main/plugin/swarm.ts -o /tmp/swarm-reference.ts

# 2. Document key patterns:
#    - Task decomposition
#    - Worker spawning
#    - SwarmMail (message queues)
#    - File reservations
#    - Verification gates

# 3. Create knowledge/swarm-coordination-patterns.md
# 4. Identify es-review adaptation points
```

**Key Insights to Document:**
- Coordinator uses expensive context (Sonnet/Opus) only for orchestration
- Workers get disposable, focused contexts
- 70% cost reduction through role separation
- Recovery from context compaction

**Success Criteria:** Clear understanding of how to parallelize es-review perspectives.

---

## Phase 2: After Skills Launch (Week 2-4)

**Priority:** P2 - Medium
**Timeline:** After Skills support releases
**Dependencies:** Phase 1 completion

### Tasks

#### 7. Study Joel's SKILL.md frontmatter format
**ID:** opencode-config-758.9
**Status:** Blocked by Phase 1
**Dependencies:** opencode-config-758.1

**What:** Review skill structure for es-* migrations.

**Required Fields:**
```yaml
---
name: skill-name
description: >
  What the skill does. Triggers on: keyword1, keyword2.
license: MIT
compatibility: Requires X, designed for OpenCode
allowed-tools: Read Grep Bash(git:*)
metadata:
  author: hirefrank
  version: "1.0"
---
```

**Directory Structure:**
```
skills/
├── skill-name/
│   ├── SKILL.md          (frontmatter + instructions)
│   ├── scripts/          (executable scripts)
│   └── references/       (supporting knowledge)
```

---

#### 8-11. Migrate es-* commands to Skills structure
**IDs:** opencode-config-758.10, .11, .12, .13
**Status:** Blocked by format study
**Dependencies:** opencode-config-758.9

**Skills to Migrate:**
1. **es-review** → `skills/es-review/`
2. **es-work** → `skills/es-work/`
3. **es-validate** → `skills/es-validate/`
4. **es-worker** → `skills/es-worker/`

**Migration Template:**
```bash
# For each skill:
mkdir -p skills/{name}/{scripts,references}
mv command/{name}.md skills/{name}/SKILL.md
# Update frontmatter
# Move scripts
# Move knowledge files to references/
```

---

#### 12. Implement swarm pattern for es-review
**ID:** opencode-config-758.14
**Status:** Blocked by swarm review
**Dependencies:** opencode-config-758.7

**What:** Apply parallel execution to code review.

**Current (Sequential):**
```
Coordinator spawns agents one at a time:
1. Security perspective (5 min)
2. Performance perspective (5 min)
3. Design perspective (5 min)
4. Cloudflare perspective (5 min)
Total: 20 minutes
```

**With Swarm (Parallel):**
```
Coordinator spawns 4 workers concurrently:
- Security worker (focused context)
- Performance worker (focused context)
- Design worker (focused context)
- Cloudflare worker (focused context)

Merge results after all complete
Total: 5 minutes (75% time reduction)
```

**Cost Comparison:**
- **Before:** 4 agents × full context = 4× cost
- **After:** 1 coordinator (full context) + 4 workers (minimal context) = ~1.3× cost

**70% cost savings, 75% time savings**

---

#### 13-15. Port knowledge files
**IDs:** opencode-config-758.15, .16, .17
**Status:** Ready to work

**Files to Port:**
1. **error-patterns.md** - Known error signatures + solutions
2. **prevention-patterns.md** - Debug → prevention workflow
3. **typescript-patterns.md** - Type-level programming for Workers

**Adaptation:** Focus on Cloudflare Workers edge cases, not general web dev.

---

## Phase 3: Month 2 (Long-term)

**Priority:** P2 - Low
**Timeline:** After core migration

#### 16. Integrate learning system into feedback-codifier
**ID:** opencode-config-758.19
**Dependencies:** opencode-config-758.16

**What:** Implement confidence decay and pattern maturity tracking.

**Features:**
- 90-day confidence half-life
- Pattern maturity: candidate → established → proven → deprecated
- Anti-pattern auto-inversion (>60% failure rate)

**Use Case:** Track which Cloudflare patterns work best over time.

---

#### 17. Add UBS tool for Workers-specific bug detection
**ID:** opencode-config-758.20

**What:** Port Universal Bug Scanner for edge-specific issues.

**Scans:**
- Null safety
- XSS vulnerabilities
- SQL/NoSQL injection
- Async race conditions
- **Workers-specific:** env usage, global state, cold start issues

---

#### 18. Add skill-creator skill
**ID:** opencode-config-758.21
**Dependencies:** opencode-config-758.10

**What:** Meta-skill for generating new skills.

**Why:** Accelerate future skill creation.

---

## What We're NOT Adopting

**Rationale for exclusions:**

| Item | Reason |
|------|--------|
| next-devtools MCP | You use Tanstack Start, not Next.js |
| chrome-devtools MCP | Redundant with Playwright MCP |
| Biome formatter | Already have Prettier |
| CASS + semantic-memory | Overkill for single-platform usage |
| pdf-brain | No PDF knowledge base requirement |

---

## Success Metrics

**Phase 1 (Week 1):**
- ✅ 3 custom MCP tools operational
- ✅ Agent permissions enforced
- ✅ Testing patterns documented
- ✅ Swarm architecture understood

**Phase 2 (Weeks 2-4):**
- ✅ 4 skills migrated to new structure
- ✅ es-review runs in parallel (70% cost reduction)
- ✅ 3 knowledge files ported and adapted

**Phase 3 (Month 2):**
- ✅ Learning system tracking pattern effectiveness
- ✅ UBS detecting Workers-specific bugs
- ✅ skill-creator accelerating new skill development

---

## Quick Reference

**Check what's ready to work on:**
```bash
bd ready
```

**Start working on a task:**
```bash
bd update opencode-config-758.2 --status in_progress
```

**Mark task complete:**
```bash
bd close opencode-config-758.2
```

**View task details:**
```bash
bd show opencode-config-758.2
```

**See dependencies:**
```bash
bd graph opencode-config-758
```

---

## Resources

- **Joel's Repo:** https://github.com/joelhooks/opencode-config
- **Skills Migration Plan:** knowledge/skills-migration-plan.md
- **Beads Patterns:** knowledge/beads-patterns.md
- **Epic Tracking:** `bd show opencode-config-758`
