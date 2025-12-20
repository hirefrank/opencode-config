# Swarm Coordination Patterns

Multi-agent coordination patterns based on the OpenCode Swarm architecture. These patterns enable parallel execution, reduced costs, and improved reliability through specialized agent roles.

---

## 1. Task Decomposition (The Coordinator)

**Pattern**: Break complex, high-level tasks into smaller, atomic subtasks that can be executed independently.

- **Strategy Selection**: Choose a decomposition strategy (file-based, feature-based, or risk-based) based on the task nature.
- **Atomic Subtasks**: Each subtask should have a clear goal, a set of target files, and defined success criteria.
- **Context Injection**: The coordinator provides just enough shared context for each worker to succeed without overwhelming their token limit.

## 2. Worker Spawning & Isolation

**Pattern**: Execute subtasks in isolated environments to prevent conflicts and ensure clean merges.

- **Worktree Isolation**: Create temporary git worktrees for each subtask. This allows workers to run tests and builds in isolation.
- **File Reservations**: When worktrees aren't feasible, use a reservation system to lock specific files or directories for exclusive editing by a single agent.
- **Disposable Contexts**: Workers are spawned with focused, short-lived contexts, significantly reducing token costs compared to a single long-running session.

## 3. Swarm Mail (Inter-Agent Communication)

**Pattern**: Enable agents to communicate, share updates, and coordinate during parallel execution.

- **Asynchronous Messaging**: Agents send "mail" to each other (e.g., "I updated the API schema, you may need to update your consumer").
- **Broadcasts**: The coordinator or a lead worker can broadcast critical updates (e.g., a shared dependency change) to all active agents in the swarm.
- **Acknowledgment Required**: Use for critical handoffs where the next agent must confirm receipt of information before proceeding.

## 4. Verification Gates (The Quality Filter)

**Pattern**: Enforce strict quality standards before allowing a subtask to be marked as complete.

- **UBS Scan**: Run automated bug scanning for common signatures (null safety, injection, race conditions).
- **Hard Tools Validation**: Mandatory execution of `typecheck`, `lint`, and `test` commands.
- **Self-Evaluation**: Agents must provide a self-evaluation of their work against the original subtask criteria.
- **Review Loop**: A dedicated `reviewer` agent analyzes the diff and either approves or sends it back with specific feedback (max 3 retries).

## 5. Merging & Recovery

**Pattern**: Systematic integration of completed work back into the main branch and recovery from failures.

- **Atomic Merges**: Cherry-pick or merge subtask commits only after all verification gates pass.
- **Compaction Recovery**: If a long-running swarm session exceeds context limits, use "Swarm Sign" detection to rebuild the state from git history and beads metadata.

---

## 6. es-review Swarm Implementation

**Pattern**: Code review using specialized parallel workers with coordinator synthesis.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    @reviewer (Coordinator)                   │
│                      Opus 4.5 (Smart)                        │
├─────────────────────────────────────────────────────────────┤
│  1. Parse PR, run Hard Tools                                │
│  2. Spawn 4 focused workers in parallel                     │
│  3. Merge results, apply confidence scoring                 │
│  4. Generate unified report                                 │
└─────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│@review-     │        │@review-     │        │@review-     │
│security     │        │performance  │        │cloudflare   │
│ Flash ($)   │        │  Flash ($)  │        │  Flash ($)  │
└─────────────┘        └─────────────┘        └─────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │@review-     │
                       │design       │
                       │  Flash ($)  │
                       └─────────────┘
```

### Worker Responsibilities

| Worker                | Focus                          | Ignores               |
| --------------------- | ------------------------------ | --------------------- |
| `@review-security`    | Auth, secrets, injection, CORS | Performance, design   |
| `@review-performance` | Bundle size, async, caching    | Security, design      |
| `@review-cloudflare`  | Runtime, bindings, stateless   | Security, performance |
| `@review-design`      | shadcn/ui, a11y, anti-patterns | Backend concerns      |

### Context Injection

Each worker receives:

1. **Shared context**: PR metadata, Hard Tools output
2. **Filtered files**: Only files relevant to their domain
3. **Clear scope**: Explicit "do not review" boundaries
4. **Output format**: Structured findings with confidence scores

### Synthesis Rules

1. **Deduplication**: Same file:line → keep highest confidence
2. **Boost**: Issues flagged by multiple workers get +10 confidence
3. **Filter**: Findings with confidence < 80 are hidden
4. **Priority**: P1 (critical) > P2 (important) > P3 (nice-to-have)

### Usage

```bash
# Full swarm review
es-review 123

# Local changes
es-review --local

# Sequential mode (one worker at a time)
es-review --sequential

# Fast mode (skip synthesis)
es-review --fast
```

---

## Success Metrics (Target)

- **Time Reduction**: ~75% (Parallel execution of 4 perspectives in 5 min vs 20 min sequential).
- **Cost Reduction**: ~70% (1 expensive Coordinator + 4 cheap Workers vs 4 expensive sequential agents).
- **Reliability**: Higher consistency through specialized focus and mandatory verification gates.

### es-review Specific Metrics

| Metric          | Sequential (Old)   | Swarm (New)               | Improvement   |
| --------------- | ------------------ | ------------------------- | ------------- |
| Time            | ~8 min             | ~2 min                    | 75% faster    |
| Cost            | 4x Opus calls      | 1 Opus + 4 Flash          | ~70% cheaper  |
| Coverage        | Single perspective | 4 specialized             | More thorough |
| False positives | Higher             | Lower (confidence filter) | Better signal |
