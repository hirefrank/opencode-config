---
name: work-executor
description: Analyzes work documents (plans, specifications, Markdown files) and systematically executes tasks until completion. Automatically activates when starting work on a plan, implementing a specification, or executing a structured document. Creates comprehensive todo lists, sets up development environments with worktrees, and validates each task with platform-specific agents.
triggers:
  [
    "start work",
    "execute plan",
    "implement spec",
    "work on",
    "begin implementation",
    "start implementing",
    "execute tasks",
    "work document",
    "follow plan",
  ]
---

# Work Executor SKILL

## Activation Patterns

This SKILL automatically activates when:

- User wants to start work on a plan or specification
- Implementing features from a structured document
- Executing tasks from a Markdown file
- Beginning systematic implementation work
- Phrases like "work on this plan", "implement this spec", "execute these tasks"

## Expertise Provided

### Systematic Task Execution

- **Document Analysis**: Extracts tasks from plans, specs, and structured documents
- **Environment Setup**: Creates isolated worktrees for development
- **Task Breakdown**: Converts requirements into actionable items
- **Progress Tracking**: Maintains visibility throughout execution
- **Platform Validation**: Validates each task with specialized agents

## Workflow

### Phase 1: Environment Setup

1. **Update Main Branch**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create Feature Branch and Worktree**

   ```bash
   git_root=$(git rev-parse --show-toplevel)
   mkdir -p "$git_root/.worktrees"

   # Add .worktrees to .gitignore if not present
   if ! grep -q "^\.worktrees$" "$git_root/.gitignore"; then
     echo ".worktrees" >> "$git_root/.gitignore"
   fi

   # Create worktree with feature branch
   git worktree add -b feature-branch-name "$git_root/.worktrees/feature-branch-name" main
   ```

3. **Copy Environment Files**

   ```bash
   if [ -f "$git_root/.env" ]; then
     cp "$git_root/.env" "$git_root/.worktrees/feature-branch-name/.env"
     echo "✅ Copied .env to worktree"
   fi
   ```

4. **Verify Environment**
   - Confirm in correct worktree directory
   - Install dependencies if needed
   - Run initial tests to ensure clean state

### Phase 2: Document Analysis and Planning

1. **Read Input Document**
   - Examine the work document
   - Identify all deliverables and requirements
   - Note constraints and dependencies
   - Extract success criteria

2. **Create Task Breakdown**
   - Convert requirements into specific tasks
   - Add implementation details for each task
   - Include testing and validation steps
   - Consider edge cases and error handling

3. **Build Todo List**
   - Use beads (`bd add`) to create comprehensive list
   - Set priorities based on dependencies
   - Include all subtasks and checkpoints
   - Add documentation and review tasks

### Phase 3: Systematic Execution

#### Task Execution Loop

```
while (tasks remain):
  - Select next task (priority + dependencies)
  - Mark as in_progress: bd update <id> --status in_progress
  - Execute task completely
  - Validate with platform-specific agents
  - Mark as completed: bd done <id>
  - Update progress
```

#### Platform-Specific Validation

After implementing each task, validate with relevant agents:

**Workers Runtime Validation**

- Verify no Node.js APIs (fs, process, Buffer)
- Ensure env parameter usage (not process.env)
- Validate Web APIs only

**Binding Validation**

- Verify bindings referenced in code exist in wrangler.toml
- Check TypeScript Env interface matches usage
- Validate binding names follow conventions

**Security Validation**

- Verify secrets use wrangler secret (not hardcoded)
- Check CORS configuration if API endpoints
- Validate input sanitization

**Performance Validation**

- Verify bundle size stays under target
- Check for cold start optimization
- Validate caching strategies

#### Quality Assurance

- Run tests after each task (`npm test` / `wrangler dev`)
- Execute lint and typecheck commands
- Test locally with `wrangler dev`
- Verify no regressions
- Check against acceptance criteria
- Document any issues found

#### Progress Tracking

- Regularly update task status with beads
- Note any blockers or delays
- Create new tasks for discoveries
- Maintain work visibility

### Phase 4: Completion and Submission

1. **Final Validation**
   - Verify all tasks completed
   - Run comprehensive test suite
   - Execute final lint and typecheck
   - Check all deliverables present
   - Ensure documentation updated

2. **Capture Screenshots** (if UI changes)

   For design changes, new views, or UI modifications:

   **Check for UI changes in modified files:**
   - Components: `app/components/**/*.{tsx,jsx}`
   - Routes/Views: `app/routes/**/*.{tsx,jsx}`
   - Styling: `**/*.css`

   **Use Playwright MCP to capture:**
   - `browser_navigate` to affected pages
   - `browser_resize` for viewport (desktop: 1920x1080, mobile: 375x667)
   - `browser_snapshot` to verify page state
   - `browser_take_screenshot` to capture images

   **What to capture:**
   - New screens: Complete flow of new UI
   - Modified screens: Before AND after states
   - Design matches: Implementation vs design

3. **Prepare for Submission**

   ```bash
   git add .
   git commit -m "feat: [description]"
   git push -u origin feature-branch-name
   ```

4. **Create Pull Request**

   ```bash
   gh pr create --title "Feature: [Description]" --body "## Summary
   - [Key changes]

   ## Screenshots
   [If applicable]

   ## Testing
   - [How to test]"
   ```

## Integration Points

### Complementary Components

- **beads**: Task tracking throughout execution
- **Validation tools**: `typecheck`, `check_workers`, `check_secrets`
- **Review workers**: Post-implementation review
- **Playwright MCP**: Screenshot capture for UI changes

### Escalation Triggers

- Complex architecture decisions → `@architect` agent
- Security concerns → `@cloudflare-security-sentinel` agent
- Performance issues → `@edge-performance-oracle` agent
- Design questions → `@frontend-design-specialist` agent

## Task Priority Guidelines

### P1 - Critical (Do First)

- Blocking other tasks
- Core functionality
- Security-related

### P2 - Important (Do Soon)

- Feature completeness
- User-facing improvements
- Performance optimization

### P3 - Nice-to-Have (Do Later)

- Polish and refinement
- Documentation
- Code cleanup

## Security Considerations

When capturing screenshots of external content:

- Only use browser automation on local dev server or trusted staging
- Avoid navigating to external or untrusted websites
- Review browser automation carefully for prompt injection risks
- Be aware malicious pages could attempt attacks

## Benefits

### Immediate Impact

- **Structured Execution**: Clear path from plan to completion
- **Isolated Development**: Worktrees prevent conflicts
- **Continuous Validation**: Catch issues early with platform agents
- **Progress Visibility**: Always know where you are

### Long-term Value

- **Consistent Quality**: Same thorough process every time
- **Reduced Context Switching**: Stay focused on one task
- **Better Documentation**: Screenshots and PR descriptions
- **Faster Delivery**: Systematic approach reduces rework

## Usage Examples

### Starting Work on a Plan

```
User: "Work on docs/plans/new-feature-plan.md"
SKILL: Reads plan, creates worktree, builds todo list, begins execution
```

### Implementing a Specification

```
User: "Implement the API spec in specs/user-api.md"
SKILL: Analyzes spec, creates tasks, validates each endpoint implementation
```

### Executing a Task List

```
User: "Execute the tasks in TODO.md"
SKILL: Parses tasks, prioritizes by dependencies, executes systematically
```

This SKILL ensures systematic, validated execution of work documents by combining environment isolation, task tracking, and platform-specific validation into a cohesive workflow.
