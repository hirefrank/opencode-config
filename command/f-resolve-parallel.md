---
description: Resolve all beads tasks using parallel processing with multiple agents
---

Resolve all beads tasks using parallel processing with multiple agents.

## Workflow

### 1. Analyze

Get all unresolved beads tasks:

**Query Beads:**

- Run `bd ready` to get all unblocked, persistent tasks
- Run `bd show <id>` for each task to understand details and dependencies
- Parse task metadata (priority, labels, dependencies)

### 2. Plan

Create a TodoWrite list of all unresolved beads tasks grouped by:

- **Priority**: P1 (critical) → P2 (important) → P3 (nice-to-have)
- **Labels**: Category-based grouping (workers-runtime, bindings, security, etc.)
- **Dependencies**: Tasks that block other tasks

**Dependency Analysis:**

- Look at task dependencies and prioritize the ones needed by others
- For example, if task B depends on task A, A must be completed first
- Use dependency tree to determine execution order
- Use `bd dep add` to document newly discovered dependencies

**Visualization:**

- Output a mermaid flow diagram showing the resolution flow
- Can we do everything in parallel? Do we need to do one first that leads to others in parallel?
- Put the tasks in the mermaid diagram flow-wise so the agent knows how to proceed in order

### 3. Implement (PARALLEL)

Spawn appropriate agents for each unresolved beads task in parallel:

**For each Beads task:**

1. Run `bd update <id> --status in_progress` to claim the task
2. Spawn the most appropriate agent based on task labels:
   - `workers-runtime` → use explore + librarian agents
   - `bindings` → use cloudflare-workers skill
   - `durable-objects` → use durable-objects skill
   - `security` → use ubs scan + validation tools
   - `performance` → use edge-performance-optimizer
   - `ui` → delegate to frontend-ui-ux-engineer
   - Default → use general agent

**Example:**
If there are 5 beads tasks with different labels, spawn 5 agents in parallel:

1. Task explore(bd-1: workers-runtime task)
2. Task frontend-ui-ux-engineer(bd-2: ui component)
3. Task general(bd-3: refactoring task)
4. Task oracle(bd-4: architecture decision)
5. Task explore(bd-5: performance optimization)

Always run all agents in parallel for independent tasks (respecting dependencies from Step 2).

### 4. Commit & Resolve

**For each completed Beads task:**

1. Verify work is complete (tests pass, code quality checks)
2. Run `bd done <id>` to mark task as completed
3. Run `bd sync` to update the persistent state

**Final steps:**

- Commit all changes with descriptive message
- Run `bd sync` one last time to ensure all state is persisted
- Push to remote repository
- Ensure `git status` shows "up to date with origin"

**Completion Summary:**

```
✅ Resolved N beads tasks in parallel
📦 Tasks completed:
  - bd-1: [title]
  - bd-2: [title]
  - bd-3: [title]
  ...

🔄 Next available work: `bd ready`
```
