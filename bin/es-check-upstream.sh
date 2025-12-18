#!/usr/bin/env bash
#
# es-check-upstream - Upstream Template Monitor
#
# Monitors multiple upstream sources for changes to adopt/adapt/ignore:
# 1. Every Inc (compounding-engineering) - workflow patterns
# 2. Anthropic (claude-code plugins) - official patterns
# 3. joelhooks/opencode-config - prompt engineering
# 4. oh-my-opencode - shell integration
#
# Usage:
#   es-check-upstream                    # Check all sources
#   es-check-upstream --source every     # Check specific source
#   es-check-upstream --since 2025-01-01 # Check since date
#   es-check-upstream --create-issues    # Create GitHub issues
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(git rev-parse --show-toplevel)"
STATE_DIR="$GIT_ROOT/.opencode/state"
OUTPUT_DIR=$(mktemp -d)
trap "rm -rf $OUTPUT_DIR" EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_source() { echo -e "${CYAN}[$1]${NC} $2"; }

# Upstream sources configuration
declare -A UPSTREAM_SOURCES
UPSTREAM_SOURCES=(
    ["every"]="https://github.com/EveryInc/every-marketplace|plugins/compound-engineering|Workflow patterns, multi-agent orchestration"
    ["anthropic"]="https://github.com/anthropics/claude-code|plugins|Official Claude Code patterns"
    ["joelhooks"]="https://github.com/joelhooks/opencode-config|.|Prompt engineering, persona architecture"
    ["oh-my-opencode"]="https://github.com/code-yeongyu/oh-my-opencode|.|Shell integration patterns"
)

# Parse arguments
SOURCE_FILTER=""
SINCE_DATE=""
CREATE_ISSUES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --source)
            SOURCE_FILTER="$2"
            shift 2
            ;;
        --since)
            SINCE_DATE="$2"
            shift 2
            ;;
        --create-issues)
            CREATE_ISSUES=true
            shift
            ;;
        --help)
            echo "Usage: es-check-upstream [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --source NAME     Check specific source (every, anthropic, joelhooks, oh-my-opencode)"
            echo "  --since DATE      Check commits since date (YYYY-MM-DD)"
            echo "  --create-issues   Create GitHub issues for changes to adopt"
            echo ""
            echo "Sources monitored:"
            echo "  every         - Every Inc compounding-engineering (workflow patterns)"
            echo "  anthropic     - Anthropic claude-code plugins (official patterns)"
            echo "  joelhooks     - joelhooks/opencode-config (prompt engineering)"
            echo "  oh-my-opencode - oh-my-opencode (shell integration)"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

# Ensure state directory exists
mkdir -p "$STATE_DIR"

echo ""
echo "======================================"
echo "  Upstream Template Monitor"
echo "======================================"
echo ""

# Load state
STATE_FILE="$STATE_DIR/upstream-check.json"
if [[ -f "$STATE_FILE" ]]; then
    LAST_REVIEW=$(jq -r '.lastReviewDate // empty' "$STATE_FILE" 2>/dev/null)
    TOTAL_RUNS=$(jq -r '.totalRuns // 0' "$STATE_FILE" 2>/dev/null)
    log_info "Previous runs: $TOTAL_RUNS"
    log_info "Last review: ${LAST_REVIEW:-never}"
else
    LAST_REVIEW=""
    TOTAL_RUNS=0
    log_info "First run - initializing state"
fi

# Determine review period
if [[ -n "$SINCE_DATE" ]]; then
    REVIEW_SINCE="$SINCE_DATE"
elif [[ -n "$LAST_REVIEW" ]]; then
    REVIEW_SINCE="$LAST_REVIEW"
else
    REVIEW_SINCE=$(date -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)
fi

TODAY=$(date +%Y-%m-%d)
log_info "Review period: $REVIEW_SINCE → $TODAY"
echo ""

# Function to check a single upstream source
check_upstream_source() {
    local name="$1"
    local config="${UPSTREAM_SOURCES[$name]}"
    local url=$(echo "$config" | cut -d'|' -f1)
    local path=$(echo "$config" | cut -d'|' -f2)
    local description=$(echo "$config" | cut -d'|' -f3)

    log_source "$name" "Checking: $description"

    # Remote name for git
    local remote_name="${name}-upstream"

    # Add remote if not exists
    if ! git remote | grep -q "^${remote_name}$"; then
        git remote add "$remote_name" "$url" 2>/dev/null || true
        log_info "  Added remote: $remote_name"
    fi

    # Fetch latest
    if git fetch "$remote_name" --quiet 2>/dev/null; then
        log_success "  Fetched latest changes"
    else
        log_warn "  Could not fetch (may be rate limited)"
        return 1
    fi

    # Get default branch
    local default_branch=$(git remote show "$remote_name" 2>/dev/null | grep "HEAD branch" | cut -d: -f2 | xargs || echo "main")

    # Count commits since review date
    local commit_count=$(git log "${remote_name}/${default_branch}" \
        --since="$REVIEW_SINCE" \
        --oneline \
        -- "$path" 2>/dev/null | wc -l | xargs)

    if [[ "$commit_count" -eq 0 ]]; then
        log_info "  No new commits since $REVIEW_SINCE"
        echo "0" > "$OUTPUT_DIR/${name}_count"
        return 0
    fi

    log_info "  Found $commit_count new commits"
    echo "$commit_count" > "$OUTPUT_DIR/${name}_count"

    # Get commit details
    git log "${remote_name}/${default_branch}" \
        --since="$REVIEW_SINCE" \
        --pretty=format:"%H|%ad|%an|%s" \
        --date=short \
        -- "$path" > "$OUTPUT_DIR/${name}_commits.txt" 2>/dev/null || true

    # Get file changes summary
    git log "${remote_name}/${default_branch}" \
        --since="$REVIEW_SINCE" \
        --name-only \
        --pretty=format:"COMMIT:%s" \
        -- "$path" 2>/dev/null | head -100 > "$OUTPUT_DIR/${name}_files.txt" || true

    return 0
}

# Check each source (or filtered source)
TOTAL_NEW_COMMITS=0

for source in "${!UPSTREAM_SOURCES[@]}"; do
    # Apply source filter if specified
    if [[ -n "$SOURCE_FILTER" ]] && [[ "$source" != "$SOURCE_FILTER" ]]; then
        continue
    fi

    echo ""
    if check_upstream_source "$source"; then
        count=$(cat "$OUTPUT_DIR/${source}_count" 2>/dev/null || echo "0")
        TOTAL_NEW_COMMITS=$((TOTAL_NEW_COMMITS + count))
    fi
done

echo ""
echo "======================================"
echo "  Summary"
echo "======================================"
echo ""

log_info "Total new commits across all sources: $TOTAL_NEW_COMMITS"

if [[ "$TOTAL_NEW_COMMITS" -eq 0 ]]; then
    log_success "All caught up! No new upstream changes."
    echo ""
    exit 0
fi

# Generate context file for AI analysis
CONTEXT_FILE="$OUTPUT_DIR/upstream-context.md"
cat > "$CONTEXT_FILE" << EOF
# Upstream Changes Analysis Request

**Review Period**: $REVIEW_SINCE → $TODAY
**Total New Commits**: $TOTAL_NEW_COMMITS

## Our Architecture

We're building an OpenCode configuration for Cloudflare Workers development:
- **Runtime**: Cloudflare Workers (V8-based, NOT Node.js)
- **Framework**: Tanstack Start + shadcn/ui + Tailwind 4
- **Backend**: Hono
- **Auth**: better-auth
- **Billing**: Polar.sh
- **Testing**: Playwright

## Sources Analyzed

EOF

# Add details for each source
for source in "${!UPSTREAM_SOURCES[@]}"; do
    count_file="$OUTPUT_DIR/${source}_count"
    commits_file="$OUTPUT_DIR/${source}_commits.txt"

    if [[ -f "$count_file" ]]; then
        count=$(cat "$count_file")
        config="${UPSTREAM_SOURCES[$source]}"
        description=$(echo "$config" | cut -d'|' -f3)

        cat >> "$CONTEXT_FILE" << EOF

### $source ($description)

**New Commits**: $count

EOF
        if [[ -f "$commits_file" ]] && [[ -s "$commits_file" ]]; then
            echo '```' >> "$CONTEXT_FILE"
            head -20 "$commits_file" >> "$CONTEXT_FILE"
            echo '```' >> "$CONTEXT_FILE"
        fi
    fi
done

cat >> "$CONTEXT_FILE" << EOF

## Analysis Request

For each source, analyze the commits and determine:

1. **Adopt** - Changes we should take directly
   - Workflow improvements
   - Bug fixes that apply to us
   - Documentation patterns

2. **Adapt** - Changes that need modification
   - Generic patterns we can make Cloudflare-specific
   - Shell patterns we can use

3. **Ignore** - Changes not relevant
   - Language-specific (Rails, Python)
   - Framework-specific (Next.js, Express)
   - Features we already have

For each change to adopt/adapt, provide:
- Priority (CRITICAL/HIGH/MEDIUM/LOW)
- Effort estimate (TRIVIAL/SMALL/MEDIUM/LARGE)
- Files to modify
- Implementation steps

## Output Format

Generate a structured report that can be appended to UPSTREAM.md
EOF

echo ""
log_info "Context file generated: $CONTEXT_FILE"
echo ""
echo "======================================"
echo "  Next Steps"
echo "======================================"
echo ""
echo "To analyze these changes with AI:"
echo ""
echo "  opencode @architect < $CONTEXT_FILE"
echo ""
echo "Or copy the context and paste into OpenCode manually."
echo ""

# Update state file
NEW_STATE=$(cat << EOF
{
  "lastRun": "$(date -Iseconds)",
  "lastReviewDate": "$TODAY",
  "nextScheduledRun": "$(date -d '+1 month' +%Y-%m-%d 2>/dev/null || date -v+1m +%Y-%m-%d)",
  "totalRuns": $((TOTAL_RUNS + 1)),
  "sourcesChecked": {
$(for source in "${!UPSTREAM_SOURCES[@]}"; do
    count=$(cat "$OUTPUT_DIR/${source}_count" 2>/dev/null || echo "0")
    echo "    \"$source\": $count,"
done | sed '$ s/,$//')
  }
}
EOF
)

echo "$NEW_STATE" > "$STATE_FILE"
log_success "State updated: $STATE_FILE"

# Offer to create issues if flag set
if [[ "$CREATE_ISSUES" == true ]] && command -v gh &> /dev/null; then
    echo ""
    read -p "Create GitHub issues for upstream changes? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh issue create \
            --title "Upstream review: $TODAY" \
            --body "$(cat $CONTEXT_FILE)" \
            --label "upstream,review"
        log_success "GitHub issue created"
    fi
fi
