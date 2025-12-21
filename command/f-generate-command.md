---
description: Create a custom OpenCode slash command
---

# Create a Custom OpenCode Command

Create a new slash command for the requested task.

**Location:**

- **Project-specific**: `.opencode/command/[name].md` (current project only)
- **Global**: `$OPENCODE_CONFIG_DIR/command/[name].md` (all projects)

Default to project-specific unless the user explicitly asks for a global command.

## Goal

#$ARGUMENTS

## Key Capabilities to Leverage

**File Operations:**

- Read, Edit, Write - modify files precisely
- Glob, Grep - search codebase
- MultiEdit - atomic multi-part changes

**Development:**

- Bash - run commands (git, tests, linters)
- Task - launch specialized agents for complex tasks
- TodoWrite - track progress with todo lists

**Web & APIs:**

- WebFetch, WebSearch - research documentation
- GitHub (gh cli) - PRs, issues, reviews
- Puppeteer - browser automation, screenshots

**Integrations:**

- Platform-specific MCPs for account context and docs
- shadcn/ui MCP - component documentation
- Stripe, Todoist, Featurebase (if relevant)

## Best Practices

1. **Be specific and clear** - detailed instructions yield better results
2. **Break down complex tasks** - use step-by-step plans
3. **Use examples** - reference existing code patterns
4. **Include success criteria** - tests pass, linting clean, etc.
5. **Leverage skills** - reference global skills from `$OPENCODE_CONFIG_DIR/skills/`
6. **Use agents** - delegate to specialized agents when appropriate

## Structure Your Command

```markdown
# [Command Name]

[Brief description of what this command does]

## Steps

1. [First step with specific details]
   - Include file paths, patterns, or constraints
   - Reference existing code if applicable

2. [Second step]
   - Use parallel tool calls when possible
   - Check/verify results

3. [Final steps]
   - Run tests
   - Lint code
   - Commit changes (if appropriate)

## Success Criteria

- [ ] Tests pass
- [ ] Code follows style guide
- [ ] Documentation updated (if needed)
```

## Tips for Effective Commands

- **Use {{PROMPT}}** placeholder for dynamic inputs (OpenCode convention)
- **Reference AGENTS.md** for framework-specific patterns and guidelines
- **Include verification steps** - tests, linting, visual checks
- **Be explicit about constraints** - don't modify X, use pattern Y
- **Use XML tags** for structured prompts: `<task>`, `<requirements>`, `<constraints>`
- **Leverage MCP tools** - use shadcn MCP, context7, better-auth, etc. for ground truth

## Example Pattern

```markdown
Implement {{PROMPT}} following these steps:

1. Research existing patterns
   - Search for similar code using Grep or mgrep (semantic search)
   - Read relevant files to understand approach
   - Check global skills in `$OPENCODE_CONFIG_DIR/skills/` for best practices

2. Plan the implementation
   - Think through edge cases and requirements
   - Consider test cases needed
   - Identify which skills or agents to leverage

3. Implement
   - Follow existing code patterns (reference specific files)
   - Follow AGENTS.md conventions (f-stack, Cloudflare Workers, etc.)
   - Use MCP tools for ground truth (shadcn, context7, better-auth)
   - Delegate UI work to frontend-ui-ux-engineer agent

4. Verify
   - Run validation tools:
     - TypeScript: `typecheck` tool or `pnpm typecheck`
     - Workers: `check_workers` tool
     - Secrets: `check_secrets` tool
     - UI: `validate_ui` tool
   - Run tests: `pnpm test` or framework-specific command
   - Run linter: `pnpm lint`
   - Check changes with git diff

5. Complete (if requested)
   - Use `/f-commit` to commit and push changes
   - Update beads tasks: `bd done <id>`
```

Now create the command file at the appropriate location with the structure above.
