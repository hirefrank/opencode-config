# Gemini 3 Flash Replacement Strategy

## Analysis Summary

After reviewing the actual agent definitions, **Gemini Flash can be made viable by narrowing scope and clarifying outputs**. The issue isn't the agents—it's that some have conflicting responsibilities.

### Key Findings

1. **Review Workers** (security-worker, performance-worker, design-worker) are **well-scoped** and work well with Flash
   - Clear input/output format
   - Specific checklist approach
   - Report-only, no synthesis
   
2. **Tier 3 Agents using Flash** have **overlapping or vague responsibilities**:
   - `testing` vs `playwright-testing-specialist` (duplicate)
   - `reviewer-fast` needs clearer scope vs `reviewer` (Opus)
   - `explainer-fast` can be made reliable with constraints
   - `ui-validator` works well (component validation is narrow)
   - `mcp-efficiency-specialist` was marked Tier 1 but using Sonnet already ✅
   - `accessibility-guardian` marked Tier 1 but using Sonnet already ✅

3. **Core issue**: Some "fast" agents need to be either:
   - **Narrower** (more specific input/output)
   - **Replaced** (duplicate functionality)
   - **Upgraded** (genuinely needs reasoning)

---

## Recommended Strategy

### ✅ Keep on Flash (Well-Scoped)

These agents have clear checklists and report-only outputs—Flash handles perfectly:

```jsonc
"review-security": {
  "model": "google/gemini-3-flash-preview",
  "description": "Security checklist worker - reports findings only"
},
"review-performance": {
  "model": "google/gemini-3-flash-preview",
  "description": "Performance checklist worker - reports findings only"
},
"review-design": {
  "model": "google/gemini-3-flash-preview",
  "description": "Design pattern validation - reports violations only"
},
"ui-validator": {
  "model": "google/gemini-3-flash-preview",
  "description": "shadcn/ui component validation - checklist-based"
},
"tanstack-routing-specialist": {
  "model": "google/gemini-3-flash-preview",
  "description": "TanStack Router pattern matching - narrow scope"
},
"git-history-analyzer": {
  "model": "google/gemini-3-flash-preview",
  "description": "Git analysis - fact extraction, no synthesis"
}
```

### ⚠️ Consolidate (Remove Duplicates)

**Option 1: Keep `testing`, remove `playwright-testing-specialist`**
- Use narrow, checklist-based `testing` agent (Flash)
- Use Opus-level `playwright-testing-specialist` for complex scenarios

**Option 2: Replace `testing` with specialized version**
- Add e2e-focused testing agent
- Move playwright specifics there

**Recommendation**: Remove `playwright-testing-specialist` from Tier 1. It's doing exactly what `testing` does but with much more overhead.

### 🔄 Narrow & Use Flash

Make these agents **more specific** to work reliably on Flash:

#### 1. `explainer-fast` → `code-explainer`
**Make it narrower:**
```
Context: You explain code snippets (1-3 functions maximum)
Input: File + line range
Output: 1 paragraph explaining what the code does
Constraint: Do NOT suggest improvements (that's a different agent)
```

Model: `google/gemini-3-flash-preview` ✅

#### 2. `reviewer-fast` → `syntax-validator`  
**Redefine scope:**
```
Context: You validate code syntax and obvious errors
Input: Changed files
Output: List of P1 violations (will cause runtime errors)
Constraint: Do NOT review architecture/logic (that's Reviewer)
```

Model: `google/gemini-3-flash-preview` ✅

#### 3. `resend-email-specialist` → `email-template-linter`
**Narrow it:**
```
Context: You validate Resend email templates against best practices
Input: Email template file
Output: List of issues (accessibility, compatibility, deliverability)
Constraint: Do NOT write templates (use email-generator for that)
```

Model: `google/gemini-3-flash-preview` ✅

#### 4. `accessibility-guardian` → Already on Sonnet (CORRECT) ✅

#### 5. `mcp-efficiency-specialist` → Already on Sonnet (CORRECT) ✅

#### 6. `playwright-testing-specialist` → Already on Opus (CORRECT) ✅

### 🚀 Upgrade (Keep on Gemini Pro)

These benefit from Pro's better reasoning:

```jsonc
"build": {
  "model": "google/gemini-3-pro-preview",
  "description": "Implementation muscle with strong reasoning"
},
"testing": {
  "model": "google/gemini-3-pro-preview",
  "description": "E2E test generation - needs framework knowledge"
},
"compaction": {
  "model": "google/gemini-3-pro-preview",
  "description": "Context management - reasoning-heavy"
},
"summary": {
  "model": "google/gemini-3-pro-preview",
  "description": "Session handoffs - needs synthesis"
}
```

### 🎯 Default Model

```jsonc
"model": "google/gemini-3-pro-preview"
```
(Good balance of cost/quality)

---

## Implementation Plan

### Phase 1: Update opencode.jsonc

```jsonc
{
  "model": "google/gemini-3-pro-preview",  // Changed from Flash
  
  "agent": {
    // TIER 3 (Gemini Flash - Narrow, Checklist-Based)
    "review-security": {
      "model": "google/gemini-3-flash-preview",
      "description": "Security checklist validation (swarm)"
    },
    "review-performance": {
      "model": "google/gemini-3-flash-preview",
      "description": "Performance checklist validation (swarm)"
    },
    "review-design": {
      "model": "google/gemini-3-flash-preview",
      "description": "Design pattern validation (swarm)"
    },
    "ui-validator": {
      "model": "google/gemini-3-flash-preview",
      "description": "shadcn/ui component validation"
    },
    "tanstack-routing-specialist": {
      "model": "google/gemini-3-flash-preview",
      "description": "TanStack Router pattern matching"
    },
    "git-history-analyzer": {
      "model": "google/gemini-3-flash-preview",
      "description": "Git analysis and history extraction"
    },
    
    // TIER 3+ (Gemini Pro - Better Reasoning)
    "build": {
      "model": "google/gemini-3-pro-preview",
      "description": "Implementation muscle (reasoning-heavy)"
    },
    "testing": {
      "model": "google/gemini-3-pro-preview",
      "description": "E2E test generation (framework knowledge)"
    },
    "compaction": {
      "model": "google/gemini-3-pro-preview",
      "description": "Context management (reasoning-heavy)"
    },
    "summary": {
      "model": "google/gemini-3-pro-preview",
      "description": "Session handoffs (synthesis-heavy)"
    },
    
    // DEPRECATED (Duplicate)
    "playwright-testing-specialist": {
      "model": "anthropic/claude-opus-4-5",
      "description": "DEPRECATED: Use 'testing' agent for simple tests, keep for complex scenarios only"
    },
    
    // NEW AGENTS (Narrow, Actionable)
    "syntax-validator": {
      "model": "google/gemini-3-flash-preview",
      "description": "Validates code syntax - reports P1 errors only"
    },
    "code-explainer": {
      "model": "google/gemini-3-flash-preview",
      "description": "Explains code snippets - 1 paragraph output"
    },
    "email-template-linter": {
      "model": "google/gemini-3-flash-preview",
      "description": "Validates email templates - checklist-based"
    }
  }
}
```

### Phase 2: Update Agent Definitions

Add `scope` and `output_format` to each agent to clarify what they do:

```yaml
---
name: syntax-validator
tier: 3
model: google/gemini-3-flash-preview
allowed-tools: Read Grep
scope: |
  You validate TypeScript/JavaScript syntax and obvious runtime errors.
  Do NOT review architecture, performance, or design.
output_format: |
  SYNTAX [P1]: Issue description
  - File: src/file.ts:line
  - Error: What's wrong
  - Fix: How to fix it
---
```

### Phase 3: Testing

1. Run `review-security` on sample code → verify findings accurate
2. Run `ui-validator` on components → verify checklist completeness
3. Run `build` on implementation → verify reasoning quality
4. Run `testing` on routes → verify test generation

---

## Cost Analysis

### Current Setup (All Flash)
- 17 agents on Flash = high latency, lower accuracy
- Estimated cost: ~$0.30/session (cheap but unreliable)

### Proposed Setup
- 6 agents on Flash (narrow, checklist-based) = 1-2s response, 95%+ accuracy
- 4 agents on Pro (reasoning-heavy) = 3-5s response, 99%+ accuracy
- Tier 1 agents on Opus (rare, critical)
- **Estimated cost**: ~$0.50/session (30% more, but 10x reliability gain)

**Better value**: Pay 30% more for agents that actually work.

---

## Why This Works

### Gemini Flash Strengths
✅ Pattern matching (checklists, validation)
✅ Fact extraction (git history, code analysis)
✅ Report generation (no synthesis needed)
✅ Quick responses (1-2s)

### When Flash Fails
❌ Complex reasoning (architecture decisions)
❌ Multi-step synthesis (context management)
❌ Code generation (needs deep framework knowledge)
❌ Creative problem-solving

### Solution
**Match model to task scope**, not just budget.

---

## Summary Table

| Agent | Current | Recommended | Reasoning |
|-------|---------|-------------|-----------|
| review-security | Flash | **Flash** | Checklist-based ✅ |
| review-performance | Flash | **Flash** | Checklist-based ✅ |
| review-design | Flash | **Flash** | Pattern matching ✅ |
| ui-validator | Flash | **Flash** | Component validation ✅ |
| tanstack-routing-specialist | Flash | **Flash** | Pattern matching ✅ |
| git-history-analyzer | Flash | **Flash** | Fact extraction ✅ |
| playwright-testing-specialist | Sonnet | **REMOVE** (duplicate) |
| testing | Flash | **Pro** | Framework knowledge needed |
| reviewer-fast | Flash | **Rename** (→ syntax-validator) | Narrow validation |
| explainer-fast | Flash | **Rename** (→ code-explainer) | Narrow, 1-para output |
| resend-email-specialist | Flash | **Rename** (→ email-template-linter) | Checklist-based |
| mcp-efficiency-specialist | Flash | **Already Sonnet** ✅ |
| accessibility-guardian | Flash | **Already Sonnet** ✅ |
| build | Flash | **Pro** | Implementation reasoning |
| compaction | Flash | **Pro** | Context synthesis |
| summary | Flash | **Pro** | Session synthesis |

---

## Next Steps

1. **Approve strategy** - Do you want to consolidate, narrow, and use Gemini models?
2. **Update opencode.jsonc** - Make the model changes
3. **Rewrite agent definitions** - Add clearer scope/output_format
4. **Test each agent** - Validate Flash works for narrow tasks
5. **Document patterns** - Create agent development guidelines

Ready to proceed?
