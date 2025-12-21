# AI Quality Gates Anti-Patterns

Anti-patterns that cause configuration drift, silent failures, or unexpected behavior in AI-assisted development workflows.

---

## 1. Shadow Configuration

**Category**: Configuration
**Confidence**: High (validated via user feedback)
**Maturity**: established
**Source**: User intervention when model switch failed silently

### Problem

Plugin-specific configuration files (like `oh-my-opencode.json`) can override primary configuration (`opencode.jsonc`) without warning. When you update the primary config but forget the plugin config, the system silently uses the wrong settings.

**Real-world example:**

```jsonc
// opencode.jsonc - Updated to use Claude
{
  "model": "anthropic/claude-sonnet-4-5",
  "plugin": ["oh-my-opencode"],
}
```

```json
// oh-my-opencode.json - Still has old model (SHADOW!)
{
  "agents": {
    "Sisyphus": { "model": "google/gemini-3-flash-preview" }
  }
}
```

**Result**: User expects Claude but gets Gemini. No error, no warning.

### Why This Happens

1. **Layered Configuration**: Plugins add their own config layer on top of base config
2. **No Validation**: No tool checks for conflicts between config files
3. **Silent Override**: Plugin config takes precedence without notification
4. **Forgotten Files**: Plugin configs are often in different locations (`~/.config/opencode/` vs project root)

### Solution

**Always update ALL configuration files when changing models or settings.**

#### Checklist for Model Changes

1. Update `opencode.jsonc` (primary config)
2. Update `oh-my-opencode.json` (if using oh-my-opencode plugin)
3. Check `~/.config/opencode/oh-my-opencode.json` (global overrides)
4. Verify with `opencode doctor` or start a session to confirm

#### Configuration Hierarchy (oh-my-opencode)

```
Priority (highest to lowest):
1. ~/.config/opencode/oh-my-opencode.json  (global user overrides)
2. ./oh-my-opencode.json                    (project-level overrides)
3. oh-my-opencode defaults                  (plugin defaults)
4. opencode.jsonc "model" field             (base config - LOWEST priority for agents!)
```

**Key insight**: For oh-my-opencode agents, the plugin config OVERRIDES `opencode.jsonc`. The base `model` field only affects non-agent operations.

### Correct Pattern

```jsonc
// opencode.jsonc
{
  "model": "anthropic/claude-sonnet-4-5",
  "plugin": ["oh-my-opencode"],
}
```

```json
// oh-my-opencode.json - MUST match or be intentionally different
{
  "agents": {
    "Sisyphus": { "model": "anthropic/claude-sonnet-4-5" }
  }
}
```

### Prevention

1. **Document the relationship**: Add comments explaining which configs affect which components
2. **Use a single source of truth**: Consider removing agent overrides from `oh-my-opencode.json` unless you specifically need different models per agent
3. **Validate on startup**: Create a pre-flight check that compares configs

#### Validation Script (Future Enhancement)

```bash
#!/bin/bash
# scripts/validate-config-consistency.sh

BASE_MODEL=$(jq -r '.model' opencode.jsonc)
SISYPHUS_MODEL=$(jq -r '.agents.Sisyphus.model // empty' oh-my-opencode.json)

if [ -n "$SISYPHUS_MODEL" ] && [ "$SISYPHUS_MODEL" != "$BASE_MODEL" ]; then
  echo "⚠️  WARNING: Shadow configuration detected!"
  echo "   opencode.jsonc model: $BASE_MODEL"
  echo "   oh-my-opencode Sisyphus: $SISYPHUS_MODEL"
  echo "   The Sisyphus agent will use: $SISYPHUS_MODEL"
fi
```

### Related Anti-Patterns

- **Orphaned Overrides**: Removing a plugin but leaving its config file behind
- **Environment Drift**: Different configs in dev vs production environments
- **Implicit Defaults**: Relying on plugin defaults without documenting them

---

## 2. Orphaned Plugin Configuration

**Category**: Configuration
**Confidence**: Medium
**Maturity**: candidate
**Source**: Derived from Shadow Configuration pattern

### Problem

When removing a plugin from `opencode.jsonc`, the plugin's configuration file remains and may cause confusion or be accidentally re-enabled.

```jsonc
// opencode.jsonc - Plugin removed
{
  "model": "anthropic/claude-sonnet-4-5",
  // "plugin": ["oh-my-opencode"]  <-- Removed
}
```

```json
// oh-my-opencode.json - Still exists! (ORPHANED)
{
  "agents": {
    "Sisyphus": { "model": "google/gemini-3-flash-preview" }
  }
}
```

### Solution

When removing a plugin:

1. Remove from `opencode.jsonc`
2. Delete or archive the plugin's config file
3. Check for global configs in `~/.config/opencode/`

---

## 3. Undocumented Agent Model Overrides

**Category**: Documentation
**Confidence**: High
**Maturity**: established
**Source**: AGENTS.md best practices

### Problem

Overriding agent models in `oh-my-opencode.json` without documenting WHY leads to confusion when the team expects one model but gets another.

```json
// oh-my-opencode.json - No explanation
{
  "agents": {
    "oracle": { "model": "openai/gpt-5.2" },
    "frontend-ui-ux-engineer": { "model": "google/gemini-3-pro-preview" }
  }
}
```

### Solution

Document intentional overrides in `AGENTS.md`:

```markdown
## oh-my-opencode Agents

### Custom Model Assignments

| Agent                   | Model                       | Reason                          |
| ----------------------- | --------------------------- | ------------------------------- |
| oracle                  | openai/gpt-5.2              | Best for architecture decisions |
| frontend-ui-ux-engineer | google/gemini-3-pro-preview | Superior UI generation          |
```

This makes it clear that differences from the base model are INTENTIONAL, not accidental shadow configurations.
