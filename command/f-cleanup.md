---
description: Cleanup and organize repository files - verify MD placement, remove transient code, organize documentation
---

# Repository Cleanup and Organization

<command_purpose>
Systematically audit and clean up the repository by verifying all Markdown files are properly organized, removing transient test code, and ensuring documentation follows the established structure.
</command_purpose>

## Introduction

<role>Repository Hygiene Specialist</role>

This command performs a comprehensive cleanup of the opencode-config repository, ensuring:

- Markdown files are in the correct locations
- Transient test files and temporary code are removed
- Documentation is properly organized in docs/
- No orphaned or unnecessary files remain

## Prerequisites

<requirements>
- Git repository with clean working tree (or willingness to commit current changes)
- Understanding of which files are essential vs transient
- Backup/git history for safe rollback if needed
</requirements>

## Main Tasks

### 1. Audit Root-Level Markdown Files

<thinking>
Most MD files should NOT be in root. Exceptions: AGENTS.md, README.md.
Everything else should be organized in docs/ or appropriate subdirectories.
</thinking>

**Scan for MD files in root**:

```bash
# List all MD files in root directory
find . -maxdepth 1 -name "*.md" -type f
```

**Allowed in root**:

- ✅ `AGENTS.md` - Global agent instructions
- ✅ `README.md` - Repository overview
- ✅ `RALPH_DIGEST.md` - Ralph Loop digest (auto-updated)

**Should be relocated**:

- ❌ Any other `.md` files in root → Move to docs/ or appropriate subdirectories

**Create todo items** for each misplaced MD file found.

### 2. Analyze Current MD File Locations

<thinking>
Need to understand what MD files exist and whether they're still needed.
Some might be outdated, others might need reorganization.
</thinking>

**Inventory all MD files**:

```bash
# Find all MD files (excluding node_modules and .git)
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  | sort
```

**Categorize each file**:

For each MD file found, determine:

1. **Purpose**: What is this file for?
2. **Status**: Is it still needed?
3. **Location**: Is it in the right place?
4. **Action**: Keep (current location), Move (to docs/), or Delete

**Create categorization report**:

```markdown
## MD File Audit

### Root Level (Should be minimal - only 3 files allowed)

- [ ] AGENTS.md - ✅ KEEP (global instructions)
- [ ] README.md - ✅ KEEP (repo overview)
- [ ] RALPH_DIGEST.md - ✅ KEEP (Ralph Loop auto-updated digest)

### Command Templates (command/)

- [List all found]
- Status: Should all be here

### Agent Definitions (agent/)

- [List all found]
- Status: Should all be here

### Skills (skill/\*/SKILL.md and references/)

- [List all found]
- Status: Verify each is needed

### Plans (plans/)

- [List all found]
- Decision: Archive old plans or keep?

### Docs (docs/)

- [List all found]
- Status: Properly organized?

### Other Locations

- [Any MD files in unexpected places]
- Action: Move or delete
```

### 3. Organize Documentation Structure

<thinking>
Create a logical docs/ structure if it doesn't exist.
Move misplaced documentation files to appropriate locations.
</thinking>

**Recommended docs/ structure**:

```
docs/
  ├── archive/              # Old/deprecated documentation
  ├── guides/               # How-to guides and tutorials
  ├── architecture/         # Architecture decisions and diagrams
  └── development/          # Development workflows and processes
```

**Note**: RALPH_DIGEST.md stays in root (auto-updated by Ralph Loop)

**Create necessary directories**:

```bash
# Create docs structure if needed
mkdir -p docs/{archive,guides,architecture,development}
```

**Move misplaced files** (example):

```bash
# Example: Move a misplaced MD file
if [ -f SOME_DOC.md ]; then
  git mv SOME_DOC.md docs/guides/
  echo "✅ Moved SOME_DOC.md to docs/guides/"
fi
```

### 4. Find and Remove Transient Test Files

<thinking>
Look for temporary files created during development/testing that should be removed.
Common patterns: test-*, tmp*, temp*, *.test.ts (outside of proper test dirs), etc.
</thinking>

**Scan for test/temp files**:

```bash
# Find potential transient files (excluding git and node_modules)
find . -type f \( \
  -name "test-*" -o \
  -name "*-test.*" -o \
  -name "tmp*" -o \
  -name "temp*" -o \
  -name "*.tmp" -o \
  -name ".DS_Store" \
) -not -path "*/node_modules/*" \
  -not -path "*/.git/*"
```

**Review each file**:

For each found file:

1. Check when it was last modified: `git log --oneline -- <file>`
2. Understand its purpose
3. Decide: Keep or Delete
4. If delete: `git rm <file>`

**Look for unused scripts or tools**:

```bash
# Find standalone scripts that might be obsolete
find tool/ lib/ -type f \( -name "*.js" -o -name "*.ts" \) -exec ls -lh {} \;
```

### 5. Check for Orphaned or Unused Files

<thinking>
Some files might exist but no longer be referenced or used.
Check git history to see if files are actively used.
</thinking>

**Find files not modified recently**:

```bash
# Files not modified in last 60 days
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.md" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -mtime +60
```

**Check git history for activity**:

```bash
# For each old file, check last commit
for file in <files_from_above>; do
  echo "File: $file"
  git log -1 --oneline -- "$file"
  echo "---"
done
```

**Present findings**:

```markdown
## Potentially Orphaned Files

Files not modified in 60+ days:

- path/to/file1.ts - Last modified: [date] - Action: ?
- path/to/file2.md - Last modified: [date] - Action: ?

Review each file:

1. Is it still referenced in code or configs?
2. Is it part of active functionality?
3. Should it be archived or deleted?
```

### 6. Verify Configuration Files

<thinking>
Ensure config files in root are needed and not duplicates or test configs.
</thinking>

**Check for duplicate or test config files**:

```bash
# Look for multiple config files that might conflict
ls -la *.json *.jsonc *.yaml *.yml *.toml 2>/dev/null || true
```

**Verify each config file**:

- `opencode.jsonc` - ✅ Primary config (KEEP)
- `oh-my-opencode.json` - ✅ Agent overrides (KEEP)
- `package.json` - ✅ NPM dependencies (KEEP)
- `package-lock.json` - ✅ NPM lock file (KEEP)
- `pnpm-lock.yaml` - ✅ PNPM lock file (KEEP)
- `bun.lock` - ✅ Bun lock file (KEEP)
- `tsconfig.json` - ✅ TypeScript config (KEEP)
- Any others → Review if needed

### 7. Clean Up Lock Files

<thinking>
Projects should only use one package manager.
Multiple lock files (npm, pnpm, bun) might indicate inconsistency.
</thinking>

**Check which package manager is active**:

```bash
# Determine primary package manager
if [ -f "pnpm-lock.yaml" ]; then
  echo "Primary: pnpm"
elif [ -f "bun.lock" ]; then
  echo "Primary: bun"
elif [ -f "package-lock.json" ]; then
  echo "Primary: npm"
else
  echo "No lock file found"
fi
```

**Present recommendation**:

If multiple lock files exist, recommend keeping only one:

- If using pnpm → Keep `pnpm-lock.yaml`, remove others
- If using bun → Keep `bun.lock`, remove others
- If using npm → Keep `package-lock.json`, remove others

**IMPORTANT**: Ask user which package manager they prefer before removing lock files.

### 8. Archive Old Plans

<thinking>
plans/ directory might contain old planning documents that are now implemented.
Archive implemented plans to keep the directory clean.
</thinking>

**Review plans directory**:

```bash
# List all plans with modification dates
ls -lh plans/*.md 2>/dev/null || echo "No plans found"
```

**For each plan**:

1. Check if it's been implemented
2. Check last modification date
3. Decide: Keep active, Archive old, or Delete obsolete

**Archive old plans**:

```bash
# Move old implemented plans to archive
mkdir -p docs/archive/plans
git mv plans/old-plan.md docs/archive/plans/
```

### 9. Generate Cleanup Report

<deliverable>
Comprehensive report of all cleanup actions taken
</deliverable>

```markdown
## 🧹 Cleanup Report

**Date**: $(date)
**Branch**: $(git branch --show-current)

### MD Files Relocated

- [x] [List any MD files moved from root to docs/]
- [ ] [Other relocations if any]

### Files Removed

#### Transient Test Files

- test-foo.ts - Temporary test code
- tmp-bar.js - Old debugging script

#### Orphaned Files

- [List any removed files]

### Files Archived

#### Old Plans

- plans/old-feature.md → docs/archive/plans/

### Documentation Structure Created
```

docs/
├── guides/ # ✅ Created
├── architecture/ # ✅ Created
└── development/ # ✅ Created

````

**Note**: RALPH_DIGEST.md remains in root (auto-updated by Ralph Loop)

### Cleanup with specific focus

```bash
# Ask the assistant to focus on specific areas
/f-cleanup "Focus on removing old test files"
/f-cleanup "Only organize MD files, don't remove anything"
````

## Safety Features

**Pre-cleanup checks**:

- ✅ Shows all files to be moved/deleted before taking action
- ✅ Creates todo list for tracking
- ✅ Recommends git commit before major changes
- ✅ Always uses `git mv` for tracked files (preserves history)

**User confirmation**:

Before deleting files, present them and ask:

```
Found these files for removal:
- tmp-test.js (last modified 90 days ago)
- test-foo.ts (orphaned test file)

Proceed with deletion? (yes/no/review)
```

**Rollback capability**:

- All changes committed separately
- Easy rollback: `git revert HEAD`
- Git history preserved for moved files

## Integration with Other Commands

**Typical workflow**:

1. `/f-cleanup` - Clean up repository
2. Review changes with `git diff --cached`
3. Adjust if needed
4. `/f-commit` - Commit cleanup changes
5. Continue development with clean repo

**Before major releases**:

1. `/f-review` - Code review
2. `/f-cleanup` - Repository cleanup
3. `/f-commit` - Commit all changes
4. Create release

## Best Practices

**Do's** ✅:

- Run cleanup regularly (monthly or before releases)
- Review all proposed deletions carefully
- Keep git history clean with atomic commits
- Document why files were removed (in commit message)
- Archive rather than delete when uncertain

**Don'ts** ❌:

- Don't delete files without reviewing git history
- Don't remove config files without understanding purpose
- Don't clean up during active development
- Don't remove lock files without team consensus
- Don't force-delete tracked files (use git rm)

## Decision Framework

**For each file, ask**:

1. **Is it referenced?** Check grep/search for usage
2. **Is it documented?** Check README or other docs
3. **When was it last used?** Check git log
4. **What's the cost of removing it?** Easy to recreate?
5. **What's the cost of keeping it?** Causes confusion?

**Decision matrix**:

| Referenced | Last Used  | Documented | Action         |
| ---------- | ---------- | ---------- | -------------- |
| Yes        | Recent     | Yes        | ✅ Keep        |
| Yes        | Recent     | No         | ✅ Keep + Doc  |
| Yes        | Old        | Yes        | 🔄 Review      |
| No         | Recent     | Yes        | 🔄 Review      |
| No         | Old (60d+) | No         | ❌ Remove      |
| No         | Very old   | No         | ❌ Archive/Del |

## Troubleshooting

**Issue**: "Not sure if file is still needed"
**Solution**: Move to docs/archive/ instead of deleting, can always restore

**Issue**: "File is tracked but I want to delete it"
**Solution**: Use `git rm <file>` not regular `rm`

**Issue**: "Multiple package lock files exist"
**Solution**: Ask team which package manager to standardize on

**Issue**: "Moved file but references broke"
**Solution**: Use search to find all references and update imports/paths

**Issue**: "Accidentally deleted important file"
**Solution**: `git checkout HEAD -- <file>` to restore

## Advanced Options

### Dry Run Mode

Show what would be changed without making changes:

```bash
# Set a flag at start: DRY_RUN=true
# Then show actions instead of executing them
echo "Would move: file.md → docs/"
echo "Would delete: test.js"
```

### Selective Cleanup

Focus on specific types:

- **MD only**: Only organize Markdown files
- **Code only**: Only remove transient code/tests
- **Docs only**: Only reorganize docs/ structure
- **Configs only**: Only review configuration files

---

**Remember**: This is a destructive operation. Always review changes before committing. When in doubt, archive rather than delete.
