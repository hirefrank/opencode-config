---
name: skill-creator
description: Guide for creating well-structured SKILL.md files that follow the tiered documentation pattern. Activates when creating new skills, documenting capabilities, or establishing agent knowledge packages. Ensures proper frontmatter, trigger design, and progressive disclosure structure.
---

# Skill Creator SKILL

## Purpose

This skill teaches AI agents how to create effective SKILL.md files that serve as injectable knowledge packages. Skills provide domain expertise that agents can load on-demand, following a tiered documentation structure for optimal context efficiency.

## Activation Patterns

This SKILL automatically activates when:

- Creating a new skill directory and SKILL.md file
- Documenting agent capabilities or expertise areas
- Converting ad-hoc knowledge into reusable skills
- Phrases like "create a skill for...", "add a skill", "new SKILL.md"
- When establishing patterns for agent behavior

---

## Core Concepts

### What is a Skill?

A **skill** is a self-contained knowledge package that provides:

1. **Domain Expertise**: Specialized knowledge in a specific area
2. **Validation Rules**: Patterns to check and enforce
3. **Workflows**: Step-by-step procedures to follow
4. **Integration Points**: How this skill connects to others

Skills differ from agents in that they are **passive knowledge** that agents consume, not active participants in conversations.

### The Tiered Documentation Structure

Skills follow a **progressive disclosure** pattern to optimize token usage:

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: FRONTMATTER (Always Loaded)                        │
│  ├── name: Identifier                                       │
│  ├── description: Activation triggers + summary             │
│  └── triggers: Keyword list for activation                  │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: SKILL.md BODY (Loaded When Activated)              │
│  ├── Activation Patterns                                    │
│  ├── Expertise Provided                                     │
│  ├── Validation Rules (P1/P2/P3)                            │
│  ├── Workflow Steps                                         │
│  ├── Code Examples                                          │
│  └── Integration Points                                     │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: REFERENCE RESOURCES (Loaded On-Demand)             │
│  ├── examples/ directory                                    │
│  ├── scripts/ directory                                     │
│  └── External documentation links                           │
└─────────────────────────────────────────────────────────────┘
```

**Token Efficiency Rule**: Only load what's needed. Frontmatter is scanned for activation; body loads when triggered; reference resources load only when explicitly needed.

---

## Frontmatter Specification

### Required Fields

```yaml
---
name: skill-name-kebab-case
description: |
  Comprehensive description that serves THREE purposes:
  1. Summarizes what the skill does (first sentence)
  2. Lists activation contexts (when to use)
  3. Contains searchable keywords for triggering
triggers: ["keyword1", "keyword2", "phrase that triggers", "action verb + noun"]
---
```

### The `description` Field (Critical)

The description is the **most important field** for skill activation. It serves as the primary trigger mechanism.

**Structure**:

```
[What it does]. [When it activates]. [Key capabilities].
```

**Good Examples**:

```yaml
# Validator skill
description: Validates Cloudflare Workers runtime compatibility by checking for Node.js API usage, process.env access, and forbidden imports. Automatically activates when writing Worker code, before deployments, or when debugging runtime errors.

# Generator skill
description: Generates production-ready Cloudflare Workers code with proper bindings, runtime compatibility, and TypeScript types. Automatically activates when creating new Workers, adding endpoints, or generating Worker code.

# Orchestrator skill
description: Orchestrates comprehensive code reviews using swarm-based multi-agent analysis with parallel worker agents for security, performance, Cloudflare patterns, and design. Automatically activates for PR reviews, code review requests, or when analyzing changed files.
```

**Bad Examples**:

```yaml
# Too vague - won't trigger correctly
description: Helps with Workers stuff.

# Missing activation context
description: Checks code for errors.

# No searchable keywords
description: A useful tool for development.
```

### The `triggers` Field

An array of keywords/phrases that activate the skill. These supplement the description.

**Design Principles**:

1. **Include verb+noun combinations**: "create worker", "validate config"
2. **Include common synonyms**: "check", "validate", "verify"
3. **Include domain terms**: "wrangler.toml", "KV namespace", "Durable Object"
4. **Include action contexts**: "before deploy", "pre-commit", "PR review"

**Example**:

```yaml
triggers: [
    "create worker", # Action + noun
    "new worker", # Synonym
    "generate worker", # Synonym
    "cloudflare worker", # Domain term
    "add endpoint", # Related action
    "worker code", # Partial match
  ]
```

---

## SKILL.md Body Structure

### Section Order (Recommended)

```markdown
# [Skill Name] SKILL

## Activation Patterns

When this skill activates (human-readable)

## Expertise Provided

What knowledge/capabilities this skill offers

## Validation Rules (for validator skills)

### P1 - Critical (Block Operations)

### P2 - Important (Warn)

### P3 - Suggestions (Inform)

## Workflow (for procedural skills)

### Step 1: ...

### Step 2: ...

## Code Examples

### Good Patterns ✅

### Bad Patterns ❌

## Integration Points

### Complementary Components

### Escalation Triggers

## Benefits

### Immediate Impact

### Long-term Value

## Usage Examples

Concrete examples of skill in action
```

### Validation Rules Pattern

For skills that validate code or configuration:

```markdown
## Validation Rules

### P1 - Critical (Block Operations)

Issues that MUST be fixed before proceeding.

**Rule Name**:

- ✅ Correct pattern: `description`
- ❌ Incorrect pattern: `description`
- ✅ Required: `specific requirement`

### P2 - Important (Warn)

Issues that should be addressed but don't block.

- ⚠️ Warning condition
- ⚠️ Another warning

### P3 - Suggestions (Inform)

Recommendations for improvement.

- ℹ️ Suggestion
- ℹ️ Another suggestion
```

### Workflow Pattern

For skills that guide procedures:

````markdown
## Workflow

### Step 1: Context Gathering

**What to check**:

- Item 1
- Item 2

**Commands**:

```bash
command example
```
````

### Step 2: Analysis

...

### Step 3: Action

...

### Step 4: Verification

...

````

### Code Examples Pattern

Always show both correct and incorrect patterns:

```markdown
## Code Examples

### ❌ Anti-Patterns (Forbidden)
```typescript
// WRONG - explanation of why
const bad = problematicCode();
````

### ✅ Correct Patterns

```typescript
// CORRECT - explanation of why
const good = properCode();
```

```

---

## Reference Resources (Tier 3)

### When to Use External Resources

Create reference resources when:

1. **Examples are lengthy**: Multi-file examples belong in `examples/`
2. **Scripts are needed**: Executable code goes in `scripts/`
3. **Content is specialized**: Deep-dive content for advanced use cases

### Directory Structure

```

skill/
my-skill/
SKILL.md # Main skill file (Tier 2)
examples/ # Example implementations (Tier 3)
basic-example.md
advanced-example.md
scripts/ # Executable scripts (Tier 3)
validate.ts
generate.ts
README.md # Optional: detailed documentation

````

### Referencing External Content

In SKILL.md, reference external resources like this:

```markdown
## Examples

See `examples/` directory for detailed implementations:

**Basic Setup:** `examples/basic-example.md`
- Description of what this example shows
- When to use it

**Advanced Patterns:** `examples/advanced-example.md`
- Description of advanced usage
- Prerequisites
````

---

## Skill Categories

### Validator Skills

**Purpose**: Check code/config for correctness.

**Key Sections**:

- Validation Rules (P1/P2/P3)
- Good/Bad code examples
- Auto-fix suggestions

**Examples**: `workers-runtime-validator`, `auth-security-validator`, `cloudflare-validator`

### Generator Skills

**Purpose**: Create code from templates/requirements.

**Key Sections**:

- Generation workflow
- Template patterns
- Customization options

**Examples**: `worker-generator`

### Orchestrator Skills

**Purpose**: Coordinate multiple agents/skills.

**Key Sections**:

- Swarm architecture diagram
- Worker dispatch logic
- Finding synthesis

**Examples**: `code-reviewer`

### Domain Expert Skills

**Purpose**: Provide deep knowledge in a specific area.

**Key Sections**:

- Core concepts
- Best practices
- Common pitfalls

**Examples**: `agent-native-architecture`, `edge-performance-optimizer`

### Tool Integration Skills

**Purpose**: Guide usage of external tools.

**Key Sections**:

- Setup instructions
- Command reference
- Integration examples

**Examples**: `gemini-imagegen`

---

## Integration Points

### Complementary Skills

Skills often work together:

```markdown
## Integration Points

### Complementary Components

- **related-validator SKILL**: Validates output from this skill
- **f-command command**: Uses this skill's patterns
- **related-agent agent**: Handles complex cases

### Escalation Triggers

- Complex scenarios → `@expert-agent` agent
- Deep analysis → `@specialist-agent` agent
```

### Connecting to Commands

Skills can be invoked by commands:

````markdown
## Usage

### Via Command

```bash
/f-my-command
```
````

### Direct Activation

Phrases that trigger: "validate my...", "create a...", "check the..."

````

---

## Quality Checklist

Before finalizing a skill, verify:

### Frontmatter
- [ ] `name` is kebab-case and descriptive
- [ ] `description` contains: what + when + keywords
- [ ] `triggers` array has 5-10 relevant keywords/phrases
- [ ] No duplicate triggers with other skills

### Body Content
- [ ] Activation Patterns section explains when skill triggers
- [ ] Expertise Provided lists concrete capabilities
- [ ] Code examples show both good and bad patterns
- [ ] Integration Points connect to ecosystem

### Structure
- [ ] Follows tiered documentation (frontmatter → body → refs)
- [ ] Progressive disclosure (essential first, details later)
- [ ] Sections are scannable (headers, bullets, code blocks)

### Token Efficiency
- [ ] Frontmatter is concise (under 500 chars for description)
- [ ] Body focuses on essential patterns
- [ ] Lengthy examples are in `examples/` directory

---

## Creating a New Skill: Quick Reference

### 1. Create Directory

```bash
mkdir -p skill/my-new-skill
````

### 2. Create SKILL.md

````markdown
---
name: my-new-skill
description: [What it does]. Activates when [contexts]. [Key capabilities].
triggers:
  [
    "action verb",
    "domain term",
    "context phrase",
  ]
---

# My New Skill SKILL

## Activation Patterns

This SKILL automatically activates when:

- Context 1
- Context 2
- Phrases like "...", "...", "..."

## Expertise Provided

### Capability 1

- Detail
- Detail

### Capability 2

- Detail
- Detail

## Validation Rules / Workflow / Patterns

[Appropriate section for skill type]

## Code Examples

### ❌ Anti-Patterns

```typescript
// Wrong approach
```
````

### ✅ Correct Patterns

```typescript
// Right approach
```

## Integration Points

### Complementary Components

- **related-skill SKILL**: Description
- **related-command command**: Description

### Escalation Triggers

- Complex scenario → `@expert-agent` agent

## Benefits

### Immediate Impact

- Benefit 1
- Benefit 2

### Long-term Value

- Benefit 3
- Benefit 4

````

### 3. Add to Index (if applicable)

Update any skill indexes or documentation to include the new skill.

### 4. Test Activation

Verify the skill triggers correctly by using its keywords in conversation.

---

## Anti-Patterns

### ❌ Skill Anti-Patterns

**Vague Descriptions**:
```yaml
# BAD
description: Helps with stuff
````

**Missing Activation Context**:

```yaml
# BAD - doesn't say WHEN to use
description: Validates code for errors
```

**Overloaded Skills**:

```markdown
# BAD - tries to do everything

## This skill validates, generates, reviews, and deploys...
```

**No Code Examples**:

```markdown
# BAD - tells but doesn't show

This skill checks for bad patterns.
```

**Flat Structure**:

```markdown
# BAD - no progressive disclosure

[All content at same level with no hierarchy]
```

### ✅ Skill Best Practices

**Clear, Searchable Descriptions**:

```yaml
description: Validates authentication security patterns including password hashing, cookie configuration, and CSRF protection. Automatically activates when auth files change, session config is modified, or before deployment.
```

**Focused Scope**:

```markdown
# GOOD - single responsibility

## This skill focuses specifically on KV optimization patterns
```

**Rich Code Examples**:

````markdown
# GOOD - shows both patterns

### ❌ Wrong

```typescript
code;
```
````

### ✅ Correct

```typescript
code;
```

````

**Tiered Structure**:
```markdown
# GOOD - progressive disclosure
## Quick Reference (scan first)
## Detailed Patterns (read when needed)
## Examples (load on demand)
````

---

This skill ensures new skills follow consistent patterns, maximize activation accuracy, and optimize token usage through the tiered documentation structure.
