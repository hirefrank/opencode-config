---
name: cloudflare-validator
description: Runs comprehensive validation checks for Cloudflare Workers projects before committing code. Automatically activates before commits, deployments, or when explicitly requested. Validates documentation sync, wrangler.toml syntax, TypeScript checks, build verification, linting, bundle size, and binding configuration. Enforces strict quality gates (0 errors, max 5 warnings).
triggers:
  [
    "validate",
    "pre-commit",
    "before commit",
    "check code",
    "run checks",
    "validate project",
    "before deploy",
    "quality check",
    "lint and build",
  ]
---

# Cloudflare Validator SKILL

## Activation Patterns

This SKILL automatically activates when:

- User runs `/validate` or `/es-validate`
- Before `git commit` operations
- Before deployment commands
- After making configuration changes
- When troubleshooting build issues
- Phrases like "validate", "check code", "run checks"

## Expertise Provided

### Comprehensive Validation

- **Documentation Sync**: Ensures docs reflect current state
- **Configuration Validation**: wrangler.toml syntax and settings
- **Type Checking**: TypeScript compilation
- **Build Verification**: Production build success
- **Linting**: Code style and quality
- **Bundle Analysis**: Size limits for edge performance
- **Binding Validation**: Correct binding configuration

## Validation Checks

### Continuous SKILL-based Validation (Active During Development)

**Cloudflare Workers SKILLs**:

- `workers-runtime-validator`: Runtime compatibility
- `cloudflare-security-checker`: Security patterns
- `workers-binding-validator`: Binding configuration
- `edge-performance-optimizer`: Performance guidance
- `kv-optimization-advisor`: KV storage optimization
- `durable-objects-pattern-checker`: DO best practices
- `cors-configuration-validator`: CORS setup

**Frontend Design SKILLs** (if shadcn/ui detected):

- `shadcn-ui-design-validator`: Prevents generic aesthetics
- `component-aesthetic-checker`: Component customization
- `animation-interaction-validator`: Animations and interactions

### Explicit Command Validation

1. **Documentation Sync** - Validates all docs reflect current state
2. **wrangler.toml Syntax** - Validates configuration file
3. **compatibility_date** - Ensures current runtime version
4. **TypeScript Checks** - Runs typecheck if available
5. **Build Verification** - Runs build command
6. **Linting** - Runs linter if available
7. **Bundle Size Analysis** - Checks deployment size limits
8. **Remote Bindings** - Validates binding configuration

## Validation Rules

### Strict Requirements

- **0 errors** - All errors must be fixed before committing
- **≤5 warnings** - More than 5 warnings must be addressed

### Exit Codes

- **0**: All checks passed ✅ (0 errors, ≤5 warnings)
- **1**: Validation failed ❌ (fix issues before committing)

## Workflow

### Step 1: Documentation Validation

**Count Actual Files**:

```bash
# Count commands
COMMAND_COUNT=$(find command -name "es-*.md" 2>/dev/null | wc -l)

# Count agents
AGENT_COUNT=$(find agent -name "*.md" 2>/dev/null | wc -l)

# Count SKILLs
SKILL_COUNT=$(find skills -name "SKILL.md" 2>/dev/null | wc -l)

echo "📊 Actual counts:"
echo "  Commands: $COMMAND_COUNT"
echo "  Agents: $AGENT_COUNT"
echo "  SKILLs: $SKILL_COUNT"
```

**Check README.md Accuracy**:

- Verify command counts match
- Verify agent counts match
- Verify SKILL counts match

**Check for Outdated References**:

```bash
# Check for old command prefixes
OLD_REFS=$(grep -r '/cf-' --include="*.md" 2>/dev/null | wc -l)
if [ "$OLD_REFS" -gt 0 ]; then
  echo "❌ ERROR: Found references to /cf-* commands (should be /es-*)"
fi
```

### Step 2: Configuration Validation

**wrangler.toml Checks**:

```bash
# Verify wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
  echo "⚠️ WARNING: No wrangler.toml found"
fi

# Check compatibility_date is recent
COMPAT_DATE=$(grep "compatibility_date" wrangler.toml | cut -d'"' -f2)
echo "📅 Compatibility date: $COMPAT_DATE"
```

**Binding Validation**:

- KV namespaces have IDs
- R2 buckets are configured
- D1 databases have IDs
- Durable Objects have class names

### Step 3: Build Validation

**TypeScript Check**:

```bash
if [ -f "package.json" ] && grep -q '"typecheck"' package.json; then
  pnpm typecheck
fi
```

**Build Check**:

```bash
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  pnpm build
fi
```

**Lint Check**:

```bash
if [ -f "package.json" ] && grep -q '"lint"' package.json; then
  pnpm lint
fi
```

### Step 4: Bundle Size Analysis

**Check Bundle Size**:

```bash
# After build, check output size
if [ -d "dist" ]; then
  BUNDLE_SIZE=$(du -sh dist/*.js 2>/dev/null | cut -f1)
  echo "📦 Bundle size: $BUNDLE_SIZE"

  # Warn if over 50KB
  SIZE_KB=$(du -k dist/*.js 2>/dev/null | cut -f1)
  if [ "$SIZE_KB" -gt 50 ]; then
    echo "⚠️ WARNING: Bundle size exceeds 50KB target"
  fi
fi
```

### Step 5: Summary Report

```markdown
## Validation Results

### Documentation

- [ ] README.md counts accurate
- [ ] No outdated command references
- [ ] All commands documented

### Configuration

- [ ] wrangler.toml valid
- [ ] compatibility_date current
- [ ] Bindings configured

### Build

- [ ] TypeScript: ✅ 0 errors
- [ ] Build: ✅ Success
- [ ] Lint: ✅ 0 errors, X warnings

### Performance

- [ ] Bundle size: XKB (target: <50KB)

### Overall: ✅ PASSED / ❌ FAILED
```

## Integration Points

### Complementary Components

- **Continuous SKILLs**: Provide real-time validation during development
- **es-deploy command**: Uses validation before deployment
- **Git hooks**: Can trigger validation on pre-commit

### Escalation Triggers

- Complex TypeScript errors → Manual debugging
- Bundle size issues → `@edge-performance-oracle` agent
- Binding configuration → `@workers-binding-validator` SKILL

## Documentation Auto-Update

If documentation validation fails, offer to auto-update:

```bash
if [ "$DOCS_VALID" = false ]; then
  echo "Would you like to auto-update documentation? (y/n)"
  read -r UPDATE_DOCS

  if [ "$UPDATE_DOCS" = "y" ]; then
    # Update README.md counts
    sed -i "s/\*\*[0-9]* specialized agents\*\*/\*\*$AGENT_COUNT specialized agents\*\*/g" README.md
    sed -i "s/\*\*[0-9]* autonomous SKILLs\*\*/\*\*$SKILL_COUNT autonomous SKILLs\*\*/g" README.md
    echo "✅ README.md updated"
  fi
fi
```

## Benefits

### Immediate Impact

- **Prevents Broken Commits**: Catches issues before they enter repo
- **Consistent Quality**: Same checks every time
- **Fast Feedback**: Know immediately if something is wrong
- **Documentation Accuracy**: Keeps docs in sync with code

### Long-term Value

- **Reduced CI Failures**: Catch issues locally first
- **Better Code Quality**: Enforced standards
- **Faster Deployments**: Confidence in code quality
- **Team Alignment**: Shared quality gates

## Usage Examples

### Before Committing

```
User: "validate"
SKILL: Runs all checks, reports results, blocks commit if failures
```

### After Configuration Changes

```
User: "check the wrangler config"
SKILL: Validates wrangler.toml, checks bindings, reports issues
```

### Troubleshooting Build Issues

```
User: "why is my build failing?"
SKILL: Runs validation, identifies specific failures, suggests fixes
```

## Quick Reference

| Check      | Command           | Target                |
| ---------- | ----------------- | --------------------- |
| TypeScript | `pnpm typecheck`  | 0 errors              |
| Build      | `pnpm build`      | Success               |
| Lint       | `pnpm lint`       | 0 errors, ≤5 warnings |
| Bundle     | `du -k dist/*.js` | <50KB                 |
| Docs       | Manual count      | Accurate counts       |

This SKILL ensures code quality by running comprehensive validation checks before commits, catching issues early and maintaining consistent standards across the project.
