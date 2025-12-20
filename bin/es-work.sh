#!/usr/bin/env bash
#
# es-work - Edge Stack Work Session Manager
#
# Creates isolated development environment and orchestrates feature development.
# This is the token-efficient replacement for the markdown es-work.md command.
#
# Usage:
#   es-work <plan-file>           # Start work from a plan document
#   es-work --branch <name>       # Create new feature branch
#   es-work --continue            # Resume work in current worktree
#   es-work --cleanup             # Remove all worktrees
#
# The script:
#   1. Creates an isolated git worktree for the feature
#   2. Copies .env file (critical for Workers dev server)
#   3. Runs initial validation (Hard Tools)
#   4. Prepares context for OpenCode with @architect persona
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(git rev-parse --show-toplevel)"
OPENCODE_TOOLS="$GIT_ROOT/tool"
WORKTREE_BASE="$GIT_ROOT/.worktrees"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

usage() {
    cat << EOF
Usage: es-work [OPTIONS] [PLAN_FILE]

Options:
  PLAN_FILE              Path to plan document (markdown, specification)
  --branch NAME          Create feature branch with NAME
  --continue             Resume work in current worktree
  --cleanup              Remove all worktrees
  --list                 List active worktrees
  --help                 Show this help

Examples:
  es-work docs/plans/auth-feature.md    # Start from plan
  es-work --branch add-user-auth        # Create new branch
  es-work --continue                    # Resume current work
  es-work --cleanup                     # Clean up worktrees

EOF
    exit 0
}

# Parse arguments
PLAN_FILE=""
BRANCH_NAME=""
CONTINUE_MODE=false
CLEANUP_MODE=false
LIST_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --branch)
            BRANCH_NAME="$2"
            shift 2
            ;;
        --continue)
            CONTINUE_MODE=true
            shift
            ;;
        --cleanup)
            CLEANUP_MODE=true
            shift
            ;;
        --list)
            LIST_MODE=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            PLAN_FILE="$1"
            shift
            ;;
    esac
done

# Handle cleanup mode
if [[ "$CLEANUP_MODE" == true ]]; then
    log_info "Cleaning up worktrees..."
    if [[ -d "$WORKTREE_BASE" ]]; then
        for wt in "$WORKTREE_BASE"/*; do
            if [[ -d "$wt" ]]; then
                log_info "  Removing $(basename "$wt")..."
                git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
            fi
        done
        log_success "All worktrees cleaned up"
    else
        log_info "No worktrees to clean up"
    fi
    exit 0
fi

# Handle list mode
if [[ "$LIST_MODE" == true ]]; then
    log_info "Active worktrees:"
    git worktree list
    exit 0
fi

# Handle continue mode
if [[ "$CONTINUE_MODE" == true ]]; then
    if [[ "$(pwd)" == "$WORKTREE_BASE"* ]]; then
        log_success "Resuming work in current worktree"
        WORK_DIR="$(pwd)"
    else
        log_error "Not in a worktree. Use --branch to create a new one."
        exit 1
    fi
else
    # Determine branch name
    if [[ -z "$BRANCH_NAME" ]] && [[ -n "$PLAN_FILE" ]]; then
        # Derive branch name from plan file
        BRANCH_NAME="feature/$(basename "$PLAN_FILE" .md | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
        log_info "Derived branch name: $BRANCH_NAME"
    elif [[ -z "$BRANCH_NAME" ]]; then
        log_error "Please provide --branch NAME or a plan file"
        usage
    fi

    # Phase 1: Environment Setup
    log_step "Phase 1: Setting up development environment"

    # Update main branch
    log_info "Updating main branch..."
    git fetch origin main 2>/dev/null || log_warn "Could not fetch origin/main"

    # Create worktree directory
    WORK_DIR="$WORKTREE_BASE/${BRANCH_NAME//\//-}"
    mkdir -p "$WORKTREE_BASE"

    # Add .worktrees to .gitignore if not already there
    if ! grep -q "^\.worktrees$" "$GIT_ROOT/.gitignore" 2>/dev/null; then
        echo ".worktrees" >> "$GIT_ROOT/.gitignore"
        log_info "Added .worktrees to .gitignore"
    fi

    # Remove existing worktree if present
    if [[ -d "$WORK_DIR" ]]; then
        log_warn "Removing existing worktree..."
        git worktree remove "$WORK_DIR" --force 2>/dev/null || rm -rf "$WORK_DIR"
    fi

    # Create new worktree with feature branch
    log_info "Creating worktree: $WORK_DIR"
    git worktree add -b "$BRANCH_NAME" "$WORK_DIR" main 2>/dev/null || \
        git worktree add "$WORK_DIR" "$BRANCH_NAME" 2>/dev/null || \
        { log_error "Failed to create worktree"; exit 1; }

    log_success "Worktree created"

    # Copy .env file
    if [[ -f "$GIT_ROOT/.env" ]]; then
        cp "$GIT_ROOT/.env" "$WORK_DIR/.env"
        log_success "Copied .env to worktree"
    else
        log_warn "No .env file found - you may need to configure environment"
    fi

    # Copy .dev.vars if exists (for Wrangler)
    if [[ -f "$GIT_ROOT/.dev.vars" ]]; then
        cp "$GIT_ROOT/.dev.vars" "$WORK_DIR/.dev.vars"
        log_success "Copied .dev.vars to worktree"
    fi
fi

cd "$WORK_DIR"
log_success "Working directory: $WORK_DIR"

# Phase 2: Initial Validation
log_step "Phase 2: Running initial validation..."

# Create temporary output directory
OUTPUT_DIR=$(mktemp -d)
trap "rm -rf $OUTPUT_DIR" EXIT

# Runtime validation
log_info "  → Checking Workers runtime compatibility..."
if [[ -d "src" ]]; then
    node "$OPENCODE_TOOLS/validate-runtime.js" src > "$OUTPUT_DIR/runtime.json" 2>/dev/null || true
    RUNTIME_CRITICAL=$(jq -r '.critical // 0' "$OUTPUT_DIR/runtime.json" 2>/dev/null || echo "0")
    if [[ "$RUNTIME_CRITICAL" -gt 0 ]]; then
        log_warn "    Found $RUNTIME_CRITICAL existing runtime violations"
    else
        log_success "    Clean runtime state"
    fi
else
    echo '{"scanned":"src","total":0,"critical":0}' > "$OUTPUT_DIR/runtime.json"
fi

# Binding analysis
log_info "  → Analyzing current bindings..."
if [[ -f "wrangler.toml" ]]; then
    node "$OPENCODE_TOOLS/analyze-bindings.js" wrangler.toml > "$OUTPUT_DIR/bindings.json" 2>/dev/null || true
    BINDING_COUNT=$(jq -r '.summary | length' "$OUTPUT_DIR/bindings.json" 2>/dev/null || echo "0")
    log_success "    Found $BINDING_COUNT binding types"
else
    echo '{"bindings":null}' > "$OUTPUT_DIR/bindings.json"
    log_info "    No wrangler.toml found"
fi

# Install dependencies if needed
if [[ -f "package.json" ]] && [[ ! -d "node_modules" ]]; then
    log_info "  → Installing dependencies..."
    pnpm install --frozen-lockfile 2>/dev/null || npm ci 2>/dev/null || log_warn "Could not install dependencies"
fi

# Phase 3: Prepare Context
log_step "Phase 3: Preparing work context..."

CONTEXT_FILE="$OUTPUT_DIR/work-context.md"

# Read plan file if provided
PLAN_CONTENT=""
if [[ -n "$PLAN_FILE" ]] && [[ -f "$GIT_ROOT/$PLAN_FILE" ]]; then
    PLAN_CONTENT=$(cat "$GIT_ROOT/$PLAN_FILE")
elif [[ -n "$PLAN_FILE" ]] && [[ -f "$PLAN_FILE" ]]; then
    PLAN_CONTENT=$(cat "$PLAN_FILE")
fi

cat > "$CONTEXT_FILE" << EOF
# Work Session Context

## Environment
- **Branch**: $(git branch --show-current)
- **Worktree**: $WORK_DIR
- **Timestamp**: $(date -Iseconds)

## Current State

### Runtime Validation
\`\`\`json
$(cat "$OUTPUT_DIR/runtime.json" 2>/dev/null || echo '{}')
\`\`\`

### Binding Analysis
\`\`\`json
$(cat "$OUTPUT_DIR/bindings.json" 2>/dev/null || echo '{}')
\`\`\`

$(if [[ -n "$PLAN_CONTENT" ]]; then
cat << PLAN
## Plan Document

$PLAN_CONTENT
PLAN
fi)

## Work Instructions

1. **Check for available tasks**: Run `bd ready` to see unblocked, persistent tasks.
2. **Analyze the plan** and create TodoWrite items for each task.
3. **Run Hard Tools after each change**:
   - `node scripts/validate-runtime.js src`
   - `node scripts/analyze-bindings.js wrangler.toml`
4. **Validate frequently**: `pnpm typecheck && pnpm lint`
5. **Test locally**: `wrangler dev`
6. **Commit incrementally** with conventional commit messages
7. **Complete the session**: Run `bd done <id>` and `bd sync` when tasks are finished.


## Validation Checklist

Before completing work:
- [ ] All runtime violations resolved
- [ ] Bindings configured in wrangler.toml
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] Tests pass (if applicable)
- [ ] No hardcoded secrets

## Commit Message Format

\`\`\`
<type>(<scope>): <short description>

<body - what and why>

<footer - breaking changes, issue refs>
\`\`\`

Types: feat, fix, docs, style, refactor, test, chore
EOF

log_success "Context prepared"

# Phase 4: Launch OpenCode
log_step "Phase 4: Ready to start work"
echo ""
echo "================================================"
echo "🚀 Work Session Ready"
echo ""
echo "  Branch:    $(git branch --show-current)"
echo "  Worktree:  $WORK_DIR"
if [[ -n "$PLAN_FILE" ]]; then
    echo "  Plan:      $PLAN_FILE"
fi
echo ""
echo "To start working, run:"
echo ""
echo "  cd $WORK_DIR"
echo "  opencode @architect"
echo ""
echo "Useful commands:"
echo "  pnpm dev          # Start dev server"
echo "  wrangler dev      # Start Workers dev"
echo "  pnpm typecheck    # Check types"
echo "  pnpm lint         # Run linter"
echo ""
echo "When done:"
echo "  git add -A && git commit"
echo "  git push -u origin $(git branch --show-current)"
echo "  gh pr create"
echo ""
echo "Cleanup:"
echo "  es-work --cleanup"
echo "================================================"
echo ""

# If opencode is available, offer to start it
if command -v opencode &> /dev/null; then
    read -p "Start OpenCode with @architect? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        cd "$WORK_DIR"
        cat "$CONTEXT_FILE" | opencode @architect
    fi
else
    log_info "OpenCode not found. Context saved to: $CONTEXT_FILE"
    echo ""
    echo "You can also use Claude Code:"
    echo "  claude --context $CONTEXT_FILE"
fi
