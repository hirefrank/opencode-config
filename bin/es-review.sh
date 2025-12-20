#!/usr/bin/env bash
#
# es-review - Edge Stack Code Review (Swarm Edition)
#
# Performs exhaustive code reviews using parallel worker agents.
# Architecture: 1 Coordinator (Opus) + 4 Workers (Flash) = ~70% cost savings
#
# Usage:
#   es-review [PR_NUMBER]       # Review a specific PR
#   es-review                   # Review the latest PR
#   es-review --local           # Review current branch changes
#   es-review --sequential      # Force sequential mode (no parallel)
#   es-review --fast            # Skip coordinator, just run workers
#
# Swarm Mode (default):
#   1. Creates isolated git worktree for the PR
#   2. Runs Hard Tools (deterministic validation)
#   3. Spawns 4 parallel worker agents (Security, Performance, Cloudflare, Design)
#   4. Coordinator synthesizes results with confidence scoring
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(git rev-parse --show-toplevel)"
OPENCODE_CONFIG="$GIT_ROOT"
SCRIPTS_DIR="$OPENCODE_CONFIG/scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_swarm() { echo -e "${MAGENTA}[SWARM]${NC} $1"; }
log_worker() { echo -e "${CYAN}[WORKER]${NC} $1"; }

# Parse arguments
PR_NUMBER=""
LOCAL_MODE=false
SEQUENTIAL_MODE=false
FAST_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --local)
            LOCAL_MODE=true
            shift
            ;;
        --sequential)
            SEQUENTIAL_MODE=true
            shift
            ;;
        --fast)
            FAST_MODE=true
            shift
            ;;
        --help)
            echo "Usage: es-review [PR_NUMBER] [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  PR_NUMBER      Review a specific PR (default: latest)"
            echo "  --local        Review current branch without worktree"
            echo "  --sequential   Force sequential worker execution"
            echo "  --fast         Skip coordinator synthesis, just run workers"
            echo ""
            echo "Swarm Architecture:"
            echo "  Coordinator (Opus 4.5) - Decomposes work, synthesizes results"
            echo "  Workers (Gemini Flash) - Focused parallel analysis:"
            echo "    - @review-security    Security vulnerabilities"
            echo "    - @review-performance Edge performance patterns"
            echo "    - @review-cloudflare  Cloudflare-specific patterns"
            echo "    - @review-design      UI/UX and design patterns"
            echo ""
            echo "Cost Model:"
            echo "  Sequential (old): 4x Opus calls = $$$$"
            echo "  Swarm (new):      1 Opus + 4 Flash = $$ (~70% savings)"
            echo ""
            exit 0
            ;;
        *)
            PR_NUMBER="$1"
            shift
            ;;
    esac
done

# Get PR number if not specified
if [[ -z "$PR_NUMBER" ]] && [[ "$LOCAL_MODE" == false ]]; then
    log_info "Fetching latest PR..."
    PR_NUMBER=$(gh pr list --limit 1 --json number --jq '.[0].number' 2>/dev/null || echo "")
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "No open PRs found. Use --local for local branch review."
        exit 1
    fi
    log_success "Found PR #$PR_NUMBER"
fi

# Set up review directory
if [[ "$LOCAL_MODE" == true ]]; then
    REVIEW_DIR="$GIT_ROOT"
    REVIEW_ID="local-$(date +%s)"
    log_info "Running local review (no worktree)"
else
    WORKTREE_BASE="$GIT_ROOT/.worktrees/reviews"
    REVIEW_DIR="$WORKTREE_BASE/pr-$PR_NUMBER"
    REVIEW_ID="pr-$PR_NUMBER"

    # Create worktree
    log_info "Creating isolated worktree for PR #$PR_NUMBER..."
    mkdir -p "$WORKTREE_BASE"

    # Remove existing worktree if present
    if [[ -d "$REVIEW_DIR" ]]; then
        log_warn "Removing existing worktree..."
        git worktree remove "$REVIEW_DIR" --force 2>/dev/null || rm -rf "$REVIEW_DIR"
    fi

    # Create new worktree and checkout PR
    git worktree add "$REVIEW_DIR" --detach 2>/dev/null
    cd "$REVIEW_DIR"
    gh pr checkout "$PR_NUMBER"
    log_success "Worktree created at $REVIEW_DIR"

    # Copy .env file (critical for Workers dev server)
    if [[ -f "$GIT_ROOT/.env" ]]; then
        cp "$GIT_ROOT/.env" "$REVIEW_DIR/.env"
        log_success "Copied .env to worktree"
    else
        log_warn "No .env file found in repository root"
    fi
fi

cd "$REVIEW_DIR"

# Create output directory for swarm results
OUTPUT_DIR="$GIT_ROOT/.worktrees/reviews/.swarm-output/$REVIEW_ID"
mkdir -p "$OUTPUT_DIR"

# Cleanup on exit (keep results for debugging)
# trap "rm -rf $OUTPUT_DIR" EXIT

# ============================================================================
# PHASE 1: Run Hard Tools (deterministic validation)
# ============================================================================
log_info "Phase 1: Running Hard Tools (deterministic validation)..."

# Runtime validation
log_info "  → Checking Workers runtime compatibility..."
if [[ -d "src" ]]; then
    node "$SCRIPTS_DIR/validate-runtime.js" src > "$OUTPUT_DIR/runtime.json" 2>/dev/null || echo '{"error":"script failed"}' > "$OUTPUT_DIR/runtime.json"
    RUNTIME_CRITICAL=$(jq -r '.critical // 0' "$OUTPUT_DIR/runtime.json" 2>/dev/null || echo "0")
    if [[ "$RUNTIME_CRITICAL" -gt 0 ]]; then
        log_error "    Found $RUNTIME_CRITICAL critical runtime violations!"
    else
        log_success "    No runtime violations found"
    fi
else
    echo '{"scanned":"src","total":0,"critical":0,"warnings":0,"violations":[]}' > "$OUTPUT_DIR/runtime.json"
    log_warn "    No src/ directory found"
fi

# Binding analysis
log_info "  → Analyzing Cloudflare bindings..."
if [[ -f "wrangler.toml" ]]; then
    node "$SCRIPTS_DIR/analyze-bindings.js" wrangler.toml > "$OUTPUT_DIR/bindings.json" 2>/dev/null || echo '{"error":"script failed"}' > "$OUTPUT_DIR/bindings.json"
    BINDING_COUNT=$(jq -r '.summary | length' "$OUTPUT_DIR/bindings.json" 2>/dev/null || echo "0")
    log_success "    Found $BINDING_COUNT binding types"
else
    echo '{"error":"wrangler.toml not found","bindings":null}' > "$OUTPUT_DIR/bindings.json"
    log_warn "    No wrangler.toml found"
fi

# UI validation (if React components exist)
log_info "  → Validating UI components..."
if [[ -d "src/components" ]] || [[ -d "app/components" ]]; then
    COMP_DIR=$(ls -d src/components app/components 2>/dev/null | head -1)
    node "$SCRIPTS_DIR/validate-ui.js" "$COMP_DIR" > "$OUTPUT_DIR/ui.json" 2>/dev/null || echo '{"error":"script failed"}' > "$OUTPUT_DIR/ui.json"
    UI_ERRORS=$(jq -r '.errors // 0' "$OUTPUT_DIR/ui.json" 2>/dev/null || echo "0")
    if [[ "$UI_ERRORS" -gt 0 ]]; then
        log_warn "    Found $UI_ERRORS potential UI prop issues"
    else
        log_success "    No UI prop issues found"
    fi
else
    echo '{"scanned":"none","total":0,"errors":0,"warnings":0,"issues":[]}' > "$OUTPUT_DIR/ui.json"
    log_info "    No component directories found"
fi

# ============================================================================
# PHASE 2: Prepare Worker Contexts
# ============================================================================
log_swarm "Phase 2: Preparing swarm worker contexts..."

# Get PR info
if [[ "$LOCAL_MODE" == false ]]; then
    PR_INFO=$(gh pr view "$PR_NUMBER" --json title,body,files,commits 2>/dev/null || echo '{}')
    PR_TITLE=$(echo "$PR_INFO" | jq -r '.title // "Unknown"')
    PR_FILES=$(echo "$PR_INFO" | jq -r '.files[].path' 2>/dev/null | head -50 || echo "")
else
    PR_TITLE="Local changes on $(git branch --show-current)"
    PR_FILES=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached || git diff --name-only)
fi

# Categorize files for worker assignment
API_FILES=$(echo "$PR_FILES" | grep -E '\.(ts|js)$' | grep -vE 'components|\.test\.' || true)
COMPONENT_FILES=$(echo "$PR_FILES" | grep -E 'components.*\.(tsx|jsx)$' || true)
CONFIG_FILES=$(echo "$PR_FILES" | grep -E '(wrangler\.toml|\.env|config\.)' || true)

# Create shared context header
SHARED_CONTEXT="# Review Target
$(if [[ "$LOCAL_MODE" == true ]]; then echo "**Local Branch**: $(git branch --show-current)"; else echo "**PR #$PR_NUMBER**: $PR_TITLE"; fi)

## Hard Tools Results (Ground Truth)

### Runtime Validation
\`\`\`json
$(cat "$OUTPUT_DIR/runtime.json")
\`\`\`

### Binding Analysis
\`\`\`json
$(cat "$OUTPUT_DIR/bindings.json")
\`\`\`

### UI Validation
\`\`\`json
$(cat "$OUTPUT_DIR/ui.json")
\`\`\`

## All Changed Files
\`\`\`
$PR_FILES
\`\`\`
"

# Create worker-specific context files
cat > "$OUTPUT_DIR/worker-security.md" << EOF
# Security Review Worker Assignment

$SHARED_CONTEXT

## Your Focus
Scan ONLY for security issues:
- Authentication/authorization
- Secret exposure
- Input validation
- Injection attacks
- CORS/CSP issues

## Target Files
\`\`\`
$API_FILES
\`\`\`

## Instructions
1. Report ONLY security findings
2. Include confidence scores (0-100)
3. Provide file:line locations
4. Do NOT synthesize - just report facts
EOF

cat > "$OUTPUT_DIR/worker-performance.md" << EOF
# Performance Review Worker Assignment

$SHARED_CONTEXT

## Your Focus
Scan ONLY for performance issues:
- Bundle size / cold start
- Async patterns
- Caching strategies
- Resource selection

## Target Files
\`\`\`
$API_FILES
\`\`\`

## Instructions
1. Report ONLY performance findings
2. Include confidence scores (0-100)
3. Estimate impact where possible
4. Do NOT synthesize - just report facts
EOF

cat > "$OUTPUT_DIR/worker-cloudflare.md" << EOF
# Cloudflare Patterns Review Worker Assignment

$SHARED_CONTEXT

## Your Focus
Scan ONLY for Cloudflare-specific issues:
- Node.js API violations
- Binding patterns
- Stateful Worker violations
- Resource selection errors

## Target Files
\`\`\`
$API_FILES
$CONFIG_FILES
\`\`\`

## Instructions
1. Report ONLY Cloudflare pattern findings
2. Include confidence scores (0-100)
3. Distinguish P1 (breaks) vs P2 (anti-pattern)
4. Do NOT synthesize - just report facts
EOF

cat > "$OUTPUT_DIR/worker-design.md" << EOF
# Design Review Worker Assignment

$SHARED_CONTEXT

## Your Focus
Scan ONLY for design/UI issues:
- shadcn/ui usage
- Tailwind patterns
- Design anti-patterns
- Accessibility basics

## Target Files
\`\`\`
$COMPONENT_FILES
\`\`\`

## Instructions
1. Report ONLY design/UI findings
2. Include confidence scores (0-100)
3. Flag accessibility issues as P1
4. Do NOT synthesize - just report facts
EOF

# Create coordinator synthesis prompt
cat > "$OUTPUT_DIR/coordinator-synthesis.md" << EOF
# Review Swarm Synthesis

You are the **Review Coordinator**. Four worker agents have completed their focused analyses.
Your job is to merge, deduplicate, and synthesize their findings into a unified report.

## Worker Results

### Security Worker Results
\`\`\`
$(cat "$OUTPUT_DIR/result-security.txt" 2>/dev/null || echo "No results yet")
\`\`\`

### Performance Worker Results
\`\`\`
$(cat "$OUTPUT_DIR/result-performance.txt" 2>/dev/null || echo "No results yet")
\`\`\`

### Cloudflare Worker Results
\`\`\`
$(cat "$OUTPUT_DIR/result-cloudflare.txt" 2>/dev/null || echo "No results yet")
\`\`\`

### Design Worker Results
\`\`\`
$(cat "$OUTPUT_DIR/result-design.txt" 2>/dev/null || echo "No results yet")
\`\`\`

## Synthesis Instructions

1. **Merge** all findings into a single list
2. **Deduplicate** - same file:line = keep highest confidence
3. **Boost confidence** (+10) for issues flagged by multiple workers
4. **Filter** findings with confidence < 80
5. **Prioritize** P1 > P2 > P3

## Output Format

\`\`\`markdown
## Code Review: $REVIEW_ID

**Swarm Stats:**
- Workers: 4 (Security, Performance, Cloudflare, Design)
- Execution: Parallel
- Cost: ~70% savings vs sequential

**Validation Results (Hard Tools):**
- Runtime: [X] violations
- Bindings: [X] configured
- UI: [X] warnings

---

## High-Confidence Findings (≥80)

### [P1] Finding #1: [TITLE]
- **Category**: Security | Performance | Cloudflare | Design
- **Confidence**: [SCORE]
- **Location**: [file:line]
- **Issue**: [DESCRIPTION]
- **Fix**: [REMEDIATION]

...

---

## Summary

| Category | P1 | P2 | P3 | Filtered |
|----------|----|----|----|---------||
| Security | X | Y | Z | N |
| Performance | X | Y | Z | N |
| Cloudflare | X | Y | Z | N |
| Design | X | Y | Z | N |

## Next Steps
1. [ ] Address P1 findings before merge
2. [ ] Triage findings to Beads: Run `/es-triage` to create persistent tasks
3. [ ] Run `/es-validate` before deploy
\`\`\`
EOF

log_success "Worker contexts prepared in $OUTPUT_DIR"

# ============================================================================
# PHASE 3: Spawn Workers
# ============================================================================
log_swarm "Phase 3: Spawning review workers..."

echo ""
echo "=============================================="
echo "         REVIEW SWARM READY"
echo "=============================================="
echo ""
echo "Output directory: $OUTPUT_DIR"
echo "Review target: $REVIEW_ID"
echo ""
echo "Worker context files created:"
echo "  - $OUTPUT_DIR/worker-security.md"
echo "  - $OUTPUT_DIR/worker-performance.md"
echo "  - $OUTPUT_DIR/worker-cloudflare.md"
echo "  - $OUTPUT_DIR/worker-design.md"
echo ""

if [[ "$SEQUENTIAL_MODE" == true ]]; then
    echo "Sequential mode: Run workers one at a time"
    echo ""
    echo "Commands:"
    echo "  opencode @review-security < $OUTPUT_DIR/worker-security.md > $OUTPUT_DIR/result-security.txt"
    echo "  opencode @review-performance < $OUTPUT_DIR/worker-performance.md > $OUTPUT_DIR/result-performance.txt"
    echo "  opencode @review-cloudflare < $OUTPUT_DIR/worker-cloudflare.md > $OUTPUT_DIR/result-cloudflare.txt"
    echo "  opencode @review-design < $OUTPUT_DIR/worker-design.md > $OUTPUT_DIR/result-design.txt"
else
    echo "Parallel mode (default): Run all workers simultaneously"
    echo ""
    echo "To spawn workers in parallel terminals:"
    echo ""
    echo "  # Terminal 1 (Security)"
    echo "  opencode @review-security < $OUTPUT_DIR/worker-security.md | tee $OUTPUT_DIR/result-security.txt"
    echo ""
    echo "  # Terminal 2 (Performance)"  
    echo "  opencode @review-performance < $OUTPUT_DIR/worker-performance.md | tee $OUTPUT_DIR/result-performance.txt"
    echo ""
    echo "  # Terminal 3 (Cloudflare)"
    echo "  opencode @review-cloudflare < $OUTPUT_DIR/worker-cloudflare.md | tee $OUTPUT_DIR/result-cloudflare.txt"
    echo ""
    echo "  # Terminal 4 (Design)"
    echo "  opencode @review-design < $OUTPUT_DIR/worker-design.md | tee $OUTPUT_DIR/result-design.txt"
fi

echo ""
echo "=============================================="
echo ""

# If opencode is available, offer to run
if command -v opencode &> /dev/null; then
    if [[ "$FAST_MODE" == true ]]; then
        echo "Fast mode: Running coordinator synthesis directly..."
        echo ""
        # In fast mode, just run coordinator with existing context
        cat "$OUTPUT_DIR/coordinator-synthesis.md" | opencode @reviewer
    else
        echo "After workers complete, run coordinator synthesis:"
        echo ""
        echo "  opencode @reviewer < $OUTPUT_DIR/coordinator-synthesis.md"
        echo ""
        read -p "Start coordinator now (expects worker results)? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$REVIEW_DIR"
            cat "$OUTPUT_DIR/coordinator-synthesis.md" | opencode @reviewer
        fi
    fi
else
    log_warn "opencode CLI not found. Install from https://opencode.ai"
    echo ""
    echo "Worker contexts saved to: $OUTPUT_DIR/"
fi
