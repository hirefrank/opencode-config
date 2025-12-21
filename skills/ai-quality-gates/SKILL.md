---
name: ai-quality-gates
description: Enforce codebase constraints (like LOC limits) to optimize for AI-assisted development and maintainability.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
---

# AI-Friendly Code Quality Gates

Constraints and automated checks designed to keep a codebase in the "Sweet Spot" for Large Language Models (LLMs) and AI coding assistants.

## 1. The 500 LOC Limit

Strictly enforce a maximum of 500 lines of code per file.

### Why it Matters for AI:

- **Context Preservation**: Smaller files fit entirely within model context windows without truncation.
- **Improved Reasoning**: AI models reason better over small, focused modules than massive multi-responsibility files.
- **Fewer Regressions**: Small files make it harder for an AI to accidentally delete unrelated logic when refactoring.

### Automated Check (Bash):

```bash
#!/bin/bash
# scripts/check-file-sizes.sh
MAX_LOC=500
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | while read line; do
  count=$(echo $line | awk '{print $1}')
  file=$(echo $line | awk '{print $2}')
  if [ "$count" -gt "$MAX_LOC" ] && [ "$file" != "total" ]; then
    echo "❌ $file is too large ($count lines). Keep it under $MAX_LOC."
    exit 1
  fi
done
```

## 2. Dependency Hygiene

Prevent circular dependencies which confuse AI logic during multi-file refactoring.

### Tools:

Use `madge` or similar tools to verify dependency graphs during CI.

```json
{
  "scripts": {
    "check-deps": "madge --circular --extensions ts ./src"
  }
}
```

## 3. Explicit Pattern Documentation

Maintain an `AGENTS.md` or similar file that explicitly lists the stack, commands, and architecture rules for AI assistants to read as part of their initial context.

## 4. Configuration Consistency

Prevent "Shadow Configuration" where plugin configs silently override primary settings.

### The Problem:

When using plugins like `oh-my-opencode`, their configuration files can override `opencode.jsonc` without warning. Updating one but not the other causes silent failures.

### Solution:

- Always update ALL config files when changing models
- Document intentional overrides in `AGENTS.md`
- See `references/ANTI_PATTERNS.md` for detailed patterns

## Best Practices

1. **Single Responsibility**: If a file exceeds 500 LOC, it's a signal that it's handling too many responsibilities.
2. **Absolute Imports**: Always use absolute imports (e.g., `@/components/Button`) to give AI assistants clear context on file locations.
3. **Type Safety**: No `any` types. LLMs rely on type definitions to "understand" data structures.
4. **Configuration Hygiene**: Keep all config files in sync. Document intentional differences.
