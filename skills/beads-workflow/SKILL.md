---
name: beads-workflow
description: Track tasks, manage workflow, and sync work with beads (bd). Use for issue tracking, task management, and git synchronization.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires beads (bd) CLI and git
allowed-tools: Bash(bd:*) Bash(git:*) Read
---

# Beads Workflow Management

## Core Commands

### Task Management

```bash
# Find available work
bd ready

# View issue details
bd show <id>

# Claim and start work
bd update <id> --status in_progress

# Mark complete
bd done <id>

# Create new task
bd add "Task description"

# List all tasks
bd list

# Sync with git
bd sync
```

### Dependencies

```bash
# Make task B depend on task A
bd dep add bd-b bd-a

# View task dependencies
bd show <id>  # Shows dependencies in output
```

## Workflow Pattern

### 1. Start Session

```bash
# Check what's available
bd ready

# Pick a task and start
bd update <id> --status in_progress
```

### 2. During Work

- Use `bd` commands to track progress
- Add related tasks: `bd add "Follow-up: implement tests"`
- Set dependencies as needed

### 3. End Session (Mandatory)

```bash
# Complete current task
bd done <id>

# Create follow-up tasks if needed
bd add "Issue: bug found in deployment"
bd add "Feature: add dark mode toggle"

# Sync with git
bd sync

# Commit and push (MANDATORY)
git add .
git commit -m "feat: implement feature X

- Add new component
- Update tests
- Fix edge case

Closes #<id>"
git push

# Verify clean state
git status  # Must show "up to date with origin"
```

## Integration with Git

### Automatic Sync

```bash
# Before pulling changes
bd sync

# After pulling
bd sync

# Before committing
bd sync

# After committing
bd sync
```

### Commit Message Format

```
<type>(<scope>): <description>

<body>

Closes #<beads-id>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Task States

- **pending**: Ready to work on
- **in_progress**: Currently being worked on
- **completed**: Done, ready for review
- **blocked**: Waiting on dependency

## Best Practices

### 1. One Task at a Time

Only have one task marked `in_progress`. This provides clear focus.

### 2. Create Granular Tasks

Break large work into small, completable pieces:

- ❌ "Build user system"
- ✅ "Create user model in D1"
- ✅ "Implement auth endpoint"
- ✅ "Add login form component"

### 3. Track Blockers

When blocked, create a blocker task:

```bash
bd add "BLOCKED: Need API key for service X"
bd dep add <current-task> <blocker-task>
```

### 4. Review Before Closing

Always run validation before `bd done`:

```bash
# For code changes
./bin/es-validate.sh

# For new components
pnpm typecheck
pnpm lint

# Then mark done
bd done <id>
```

## Common Patterns

### Feature Development

```bash
# 1. Create feature breakdown
bd add "Feature: User authentication"
bd add "Setup better-auth with D1"
bd add "Create login page"
bd add "Add session management"
bd dep add bd-2 bd-1
bd dep add bd-3 bd-2
bd dep add bd-4 bd-3

# 2. Work through tasks
bd update bd-1 --status in_progress
# ... work ...
bd done bd-1
bd update bd-2 --status in_progress
# ... work ...
bd done bd-2
# ... continue ...
```

### Bug Fixing

```bash
# 1. Create bug report task
bd add "BUG: App crashes on invalid input"

# 2. Create fix task
bd add "FIX: Add input validation"
bd dep add <fix-task> <bug-task>

# 3. Fix and test
bd update <fix-task> --status in_progress
# ... fix ...
bd done <fix-task>

# 4. Close bug
bd done <bug-task>
```

### Research Tasks

```bash
# 1. Research
bd add "RESEARCH: Compare auth solutions"
# ... research ...
bd done bd-1

# 2. Decision and implementation
bd add "DECISION: Use better-auth"
bd add "Implement better-auth integration"
bd dep add bd-3 bd-2
```

## Automation Scripts

Run `scripts/sync-with-git.js` for automated sync before commits.

## Reference Materials

See [references/COMMANDS.md](references/COMMANDS.md) for complete command reference.
