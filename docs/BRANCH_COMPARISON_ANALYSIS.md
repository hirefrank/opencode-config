# Branch Comparison: Main vs Simplify-Stack

A comprehensive analysis of architectural differences, tradeoffs, and recommendations for the Edge Stack configuration.

---

## Executive Summary

| Aspect | Main Branch | Simplify-Stack Branch |
|--------|-------------|----------------------|
| **Agents** | 40+ specialized agents | 4 general-purpose modes |
| **Skills** | 19 validation-focused | 29 with rich documentation + scripts |
| **Model Selection** | Static tier assignment | Dynamic mode-based selection |
| **Extensibility** | Add agent definitions | Add skills with SKILL.md + scripts |
| **Provider Lock-in** | Tied to OpenCode | Model-agnostic harness |
| **Complexity** | High (many moving parts) | Lower (fewer concepts) |

**Verdict**: The simplify-stack approach is conceptually cleaner and more maintainable, but requires additional work to match the main branch's depth of specialization.

---

## 1. Architecture Comparison

### 1.1 Main Branch: Many Specialized Agents

The main branch uses **40+ specialized agents** organized into 4 tiers:

```
Tier 1 (Opus 4.5) - 8 agents
├── architect, reviewer, feedback-codifier
├── durable-objects, frontend-design-specialist
├── tanstack-ui-architect, plan, explore

Tier 2 (Gemini Pro) - 9 agents
├── architect-alt, reviewer-alt, feedback-codifier-alt
├── frontend-design-specialist-alt
├── tanstack-migration-specialist, tanstack-ssr-specialist
├── better-auth-specialist, polar-billing-specialist
└── general-alt

Tier 3 (Gemini Flash) - 17 agents
├── reviewer-fast, explainer-fast, testing, ui-validator
├── tanstack-routing-specialist, accessibility-guardian
├── mcp-efficiency-specialist, playwright-testing-specialist
├── resend-email-specialist, git-history-analyzer
├── build, compaction, summary
└── Review Swarm: security, performance, cloudflare, design

Tier 4 (Big Pickle) - 2 agents
└── runtime-guardian, binding-analyzer
```

**Philosophy**: "Right agent for the right job" - each agent is highly specialized with its own model assignment and system prompt.

### 1.2 Simplify-Stack: Few General Modes + Rich Skills

The simplify-stack branch uses **4 general-purpose modes**:

```
Modes:
├── architect - High-level design and planning
├── worker   - Implementation and code writing
├── intern   - Simple tasks, documentation, research
└── (implicit) ui-specialist - Delegated for UI work
```

Domain expertise is carried by **skills** rather than agents:

```
Skills (29 total):
├── Core Framework
│   ├── cloudflare-workers (with scripts)
│   ├── tanstack-start (with scripts)
│   ├── durable-objects (with scripts)
│   └── shadcn-ui (with scripts)
│
├── Integrations
│   ├── better-auth (with scripts)
│   ├── polar-billing
│   ├── beads-workflow (with scripts)
│   └── testing-patterns (with scripts)
│
└── Validators (19 existing)
    ├── agent-native-architecture
    ├── cloudflare-validator
    ├── code-reviewer
    └── ... (16 more)
```

**Philosophy**: "Expertise in knowledge, not agents" - general agents load domain knowledge dynamically.

---

## 2. What's Better in Each Branch

### 2.1 Main Branch Advantages

#### Precise Model-Task Matching
Each agent has the optimal model for its specific task:
- Complex architectural decisions → Opus 4.5
- Pattern validation → Gemini Flash
- Deterministic checks → Big Pickle

This is **more cost-efficient** for heterogeneous workloads.

#### Swarm Pattern Implementation
The review swarm (4 parallel workers + coordinator) is well-implemented and provides:
- Parallel execution for faster reviews
- Confidence scoring for quality gates
- Clear synthesis of multiple perspectives

#### Quota Management
The bucket system (A/B/C) with fallback rules is sophisticated:
```
Bucket A (Anthropic Max) → capped → use -alt agents
Bucket B (Google quota) → capped → fallback to Sonnet
Bucket C (Free tier) → always available
```

#### Deep Integration Specialists
Agents like `better-auth-specialist`, `polar-billing-specialist`, and `durable-objects` have deep domain knowledge that's hard to replicate with generic modes.

### 2.2 Simplify-Stack Advantages

#### Conceptual Simplicity
Only 4 concepts to understand (architect/worker/intern + skills) vs 40+ specialized agents. This dramatically reduces:
- Cognitive load for users
- Documentation burden
- Maintenance complexity

#### Skills as First-Class Citizens
Skills with executable scripts are more powerful than pure documentation:
```javascript
// skills/tanstack-start/scripts/validate-router.js
// Actual validation logic, not just instructions
```

#### Model-Agnostic Architecture
The `model-harness.ts` supports multiple providers:
```typescript
harness.register(new AnthropicProvider());
harness.register(new OpenAIProvider());
harness.register(new GoogleProvider());
harness.register(new LocalProvider()); // Ollama, LM Studio
```

This future-proofs against:
- Provider outages
- Pricing changes
- New model releases

#### CLI Tooling
The `edge-cli.ts` provides a clean interface:
```bash
edge work "Design rate limiting" --mode architect
edge mode worker
edge skills
edge run cloudflare-workers validate
```

#### Better Skill Documentation
Skills have richer documentation with:
- Frontmatter metadata (name, description, compatibility)
- Allowed tools specification
- Reference materials
- Executable scripts

---

## 3. What's Worse in Each Branch

### 3.1 Main Branch Weaknesses

#### Agent Explosion
40+ agents is hard to maintain:
- Which agent to use for a given task?
- Overlapping responsibilities (e.g., `testing` vs `playwright-testing-specialist`)
- Stale agent definitions that drift from best practices

#### Static Model Assignments
If a model becomes deprecated or pricing changes, you need to update many agent definitions.

#### Tight OpenCode Coupling
The entire architecture depends on OpenCode's agent system. No portability to other tools.

#### Documentation Fragmentation
Agent instructions are scattered across:
- `agent/*.md` files
- `opencode.jsonc` descriptions
- `knowledge/*.md` patterns
- `AGENTS.md` overview

### 3.2 Simplify-Stack Weaknesses

#### Loss of Specialization Depth
Generic modes can't match specialized agents for complex tasks:
- `architect` mode knows less about Durable Objects than `@durable-objects` agent
- `worker` mode may miss Cloudflare-specific edge cases

#### Incomplete Implementation
The `src/*.ts` files are functional skeletons but lack:
- Robust error handling
- Streaming support
- Proper skill content injection into prompts
- Integration with beads task system

#### Skill Selection is Naive
Current implementation uses keyword matching:
```typescript
// Simple keyword matching for now - can be enhanced with embeddings
if (keywords.some(kw => taskLower.includes(kw))) {
  relevant.push(skill);
}
```

This will miss relevant skills for tasks with unusual phrasing.

#### UI Delegation is Basic
```typescript
private requiresUI(task: string): boolean {
  const uiKeywords = ['ui', 'component', 'design', ...];
  return uiKeywords.some(kw => task.toLowerCase().includes(kw));
}
```

This is fragile - "fix the button" might not trigger UI delegation.

---

## 4. Tradeoff Analysis

### 4.1 Cost vs Quality

| Approach | Cost | Quality | When to Use |
|----------|------|---------|-------------|
| Main: Specialized agents | Higher (Opus for each specialist) | Higher (domain expertise) | Critical production work |
| Simplify: General modes | Lower (mode-based selection) | Variable (depends on skill quality) | Prototyping, simpler tasks |

**Recommendation**: Hybrid approach - use general modes for common tasks, escalate to specialized agents for critical work.

### 4.2 Simplicity vs Power

| Dimension | Main | Simplify |
|-----------|------|----------|
| Learning curve | Steep (40+ agents) | Gentle (4 modes) |
| Edge case handling | Better (specialized knowledge) | Weaker (generic approach) |
| Maintenance burden | High | Low |
| Extensibility | Add agent file + config | Add skill directory |

**Recommendation**: Simplify-stack's model is better for long-term maintainability.

### 4.3 Lock-in vs Portability

| Provider | Main | Simplify |
|----------|------|----------|
| OpenCode | Required | Optional (via harness) |
| Anthropic | Primary | One of many |
| Google | Secondary | One of many |
| Local LLMs | Not supported | Supported |

**Recommendation**: Simplify-stack's model-agnostic approach is more future-proof.

---

## 5. Recommendations for Improving Simplify-Stack

### 5.1 Enhance Skill Selection

Replace keyword matching with semantic matching:

```typescript
// Use embeddings for skill selection
private async selectSkills(task: string): Promise<Skill[]> {
  const taskEmbedding = await embed(task);

  return this.skills
    .map(skill => ({
      skill,
      similarity: cosineSimilarity(taskEmbedding, skill.embedding)
    }))
    .filter(({ similarity }) => similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(({ skill }) => skill);
}
```

### 5.2 Add Skill Escalation

Allow skills to request model upgrades for complex tasks:

```yaml
# SKILL.md frontmatter
escalation:
  complexity_threshold: high
  recommended_mode: architect
  triggers:
    - "system design"
    - "architecture decision"
    - "breaking change"
```

### 5.3 Preserve Specialist Knowledge

Migrate deep specialist knowledge from agents to skills:

```
skills/
├── durable-objects/
│   ├── SKILL.md              # Quick reference
│   ├── PATTERNS.md           # From agent/cloudflare/durable-objects.md
│   ├── ANTI_PATTERNS.md      # What not to do
│   └── scripts/
│       └── validate-do.js    # Runtime validation
```

### 5.4 Implement Skill Composition

Allow skills to build on each other:

```yaml
# skills/fullstack-app/SKILL.md
name: fullstack-app
requires:
  - tanstack-start
  - cloudflare-workers
  - better-auth
  - shadcn-ui
```

### 5.5 Add Mode-Skill Affinity

Some skills work better with certain modes:

```yaml
# SKILL.md frontmatter
mode_affinity:
  architect: 0.9  # Great for design decisions
  worker: 0.7     # Good for implementation
  intern: 0.3     # Too complex for simple tasks
```

### 5.6 Improve CLI Robustness

Add proper error handling and streaming:

```typescript
// Enhanced edge-cli.ts
program
  .command('work')
  .option('--stream', 'Stream response tokens')
  .option('--dry-run', 'Show selected skills without running')
  .option('--escalate', 'Force architect mode for complex tasks')
  .action(async (task, options) => {
    try {
      if (options.dryRun) {
        const skills = agent.selectSkills(task);
        console.log('Would use skills:', skills.map(s => s.name));
        return;
      }

      if (options.stream) {
        for await (const chunk of agent.streamTask(task)) {
          process.stdout.write(chunk);
        }
      } else {
        const response = await agent.handleTask(task);
        console.log(response);
      }
    } catch (error) {
      console.error('Task failed:', error.message);
      process.exit(1);
    }
  });
```

### 5.7 Bridge the Gap with Main Branch

Create "virtual agents" that combine a mode + skill set:

```typescript
// Virtual agent definitions
const virtualAgents = {
  'durable-objects-expert': {
    mode: 'architect',
    skills: ['durable-objects', 'cloudflare-workers'],
    temperature: 0.3
  },
  'ui-craftsman': {
    mode: 'worker',
    skills: ['shadcn-ui', 'tanstack-start'],
    temperature: 0.5
  }
};

// Usage: edge work "design rate limiter" --as durable-objects-expert
```

---

## 6. Migration Path

If adopting simplify-stack, here's a phased approach:

### Phase 1: Skill Enrichment (1-2 weeks)
- Migrate agent knowledge to skill PATTERNS.md files
- Add validation scripts to all skills
- Implement semantic skill selection

### Phase 2: Virtual Agents (1 week)
- Create virtual agent mappings for common workflows
- Maintain backward compatibility with `@agent` syntax
- Add escalation rules

### Phase 3: CLI Hardening (1 week)
- Add streaming support
- Implement proper error handling
- Add beads integration
- Add dry-run and debugging modes

### Phase 4: Deprecate Old Agents (ongoing)
- Monitor usage of old agents
- Migrate users to virtual agents
- Archive unused agent definitions

---

## 7. Conclusion

### Simplify-Stack is the Right Direction

The simplify-stack approach is architecturally superior for several reasons:

1. **Maintainability**: 4 modes + skills >> 40+ agents for long-term maintenance
2. **Portability**: Model-agnostic harness protects against lock-in
3. **Extensibility**: Skills are easier to create and share than agents
4. **Conceptual clarity**: Fewer concepts to learn and document

### But It Needs Work

The current implementation is a proof-of-concept that requires:

1. **Better skill selection** (semantic > keyword matching)
2. **Preserved specialization** (migrate agent knowledge to skills)
3. **Robust tooling** (streaming, error handling, beads integration)
4. **Escape hatches** (virtual agents for complex workflows)

### Recommended Hybrid Approach

1. **Use simplify-stack as the base** for new development
2. **Keep select specialized agents** for critical paths:
   - `@reviewer` for code reviews (swarm coordination is complex)
   - `@durable-objects` for DO design (deep expertise needed)
   - `@feedback-codifier` for pattern extraction (meta-reasoning)
3. **Invest in skills** as the primary knowledge carriers
4. **Use virtual agents** to provide familiar interfaces while using the new architecture

---

## Appendix: Quick Reference

### Main Branch File Structure
```
agent/                  # 28 agent definitions
├── architect.md
├── reviewer.md
├── cloudflare/        # 3 cloudflare specialists
├── integrations/      # 7 integration specialists
├── review-workers/    # 4 swarm workers
├── tanstack/          # 6 tanstack specialists
└── workflow/          # 1 workflow agent

skills/                # 19 validation-focused skills
knowledge/             # 13 pattern files
command/              # 24 slash commands
```

### Simplify-Stack File Structure
```
src/
├── edge-agent.ts      # 4-mode agent implementation
├── edge-cli.ts        # CLI interface
└── model-harness.ts   # Provider abstraction

skills/               # 29 skills (10 new with scripts)
├── tanstack-start/
│   ├── SKILL.md
│   └── scripts/validate-router.js
├── cloudflare-workers/
│   ├── SKILL.md
│   ├── references/PATTERNS.md
│   └── scripts/validate-runtime.js
└── ...
```

### Key Metrics

| Metric | Main | Simplify-Stack | Delta |
|--------|------|----------------|-------|
| Agent definitions | 28 | 4 (modes) | -24 |
| Skills | 19 | 29 | +10 |
| Skills with scripts | 1 | 11 | +10 |
| Lines of TypeScript | 0 | 847 | +847 |
| Concepts to learn | 50+ | ~15 | -35 |
