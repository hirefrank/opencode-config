#!/usr/bin/env bash
#
# es-research-blogs - Blog Update Monitor
#
# Monitors Anthropic and Claude blogs for relevant updates.
# Uses WebFetch to gather posts, then prepares context for AI analysis.
#
# Usage:
#   es-research-blogs                     # Check last 30 days
#   es-research-blogs --since 2025-01-01  # Check since date
#   es-research-blogs --topics mcp,cloudflare # Filter by topics
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(git rev-parse --show-toplevel)"
STATE_DIR="$GIT_ROOT/state"
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

# Blog sources
BLOGS=(
    "https://www.anthropic.com/engineering|Anthropic Engineering"
    "https://www.anthropic.com/research|Anthropic Research"
    "https://www.anthropic.com/news|Anthropic News"
)

# Topics we care about
RELEVANT_TOPICS=(
    "mcp" "model context protocol"
    "claude code" "claude-code"
    "cloudflare" "workers" "edge"
    "react" "tanstack"
    "playwright" "testing"
    "authentication" "auth"
    "tool use" "function calling"
    "agents" "agentic"
    "prompt engineering"
)

# Parse arguments
SINCE_DATE=""
TOPIC_FILTER=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --since)
            SINCE_DATE="$2"
            shift 2
            ;;
        --topics)
            TOPIC_FILTER="$2"
            shift 2
            ;;
        --help)
            echo "Usage: es-research-blogs [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --since DATE    Check posts since date (YYYY-MM-DD)"
            echo "  --topics LIST   Filter by topics (comma-separated)"
            echo ""
            echo "Topics: mcp, cloudflare, react, testing, auth, agents"
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
echo "  Blog Update Monitor"
echo "======================================"
echo ""

# Load state
STATE_FILE="$STATE_DIR/blog-updates.json"
if [[ -f "$STATE_FILE" ]]; then
    LAST_REVIEW=$(jq -r '.lastReviewDate // empty' "$STATE_FILE" 2>/dev/null)
    TOTAL_RUNS=$(jq -r '.totalRuns // 0' "$STATE_FILE" 2>/dev/null)
    log_info "Previous runs: $TOTAL_RUNS"
    log_info "Last review: ${LAST_REVIEW:-never}"
else
    LAST_REVIEW=""
    TOTAL_RUNS=0
    log_info "First run"
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

# Generate context for AI to fetch and analyze blogs
CONTEXT_FILE="$OUTPUT_DIR/blog-context.md"
cat > "$CONTEXT_FILE" << EOF
# Blog Research Request

**Review Period**: $REVIEW_SINCE → $TODAY
**Focus**: Updates relevant to Cloudflare Workers + OpenCode development

## Blogs to Monitor

1. **Anthropic Engineering** (https://www.anthropic.com/engineering)
   - MCP updates
   - Claude Code features
   - Tool use patterns
   - Agent architectures

2. **Anthropic Research** (https://www.anthropic.com/research)
   - Model capabilities
   - Safety patterns
   - Prompt engineering

3. **Anthropic News** (https://www.anthropic.com/news)
   - Product announcements
   - New features
   - Partnerships

## Our Stack Context

We're building with:
- **OpenCode** for AI-assisted development
- **Cloudflare Workers** (V8 runtime, not Node.js)
- **Tanstack Start** + shadcn/ui + Tailwind 4
- **Hono** for backend
- **better-auth** for authentication
- **Polar.sh** for billing
- **Playwright** for testing

## Analysis Request

For each blog, use WebFetch to:
1. Get recent posts (last 30 days)
2. Identify posts relevant to our stack
3. Extract key learnings

## Relevance Criteria

**HIGH relevance**:
- MCP server announcements
- Claude Code updates
- Tool use / function calling
- Agent patterns
- Cloudflare integration

**MEDIUM relevance**:
- Prompt engineering
- React/UI patterns
- Testing strategies
- Authentication patterns

**LOW relevance** (note but don't prioritize):
- General AI research
- Enterprise features
- Non-technical content

## Output Format

For each relevant post:

### [Post Title]
- **URL**: [link]
- **Date**: [date]
- **Relevance**: HIGH/MEDIUM/LOW
- **Summary**: [2-3 sentences]
- **Key Learnings**:
  1. [learning]
  2. [learning]
- **Action Items**:
  - [ ] [specific change to make]
  - [ ] [file to update]

## Implementation Recommendations

Group findings by priority:
1. **Immediate** (this week)
2. **Short-term** (this month)
3. **Long-term** (this quarter)

Include effort estimates (TRIVIAL/SMALL/MEDIUM/LARGE)
EOF

echo ""
log_info "Context file generated: $CONTEXT_FILE"
echo ""
echo "======================================"
echo "  Next Steps"
echo "======================================"
echo ""
echo "Run this analysis with OpenCode:"
echo ""
echo "  opencode @architect < $CONTEXT_FILE"
echo ""
echo "The AI will use WebFetch to check each blog and analyze relevance."
echo ""

# Update state file
cat > "$STATE_FILE" << EOF
{
  "lastRun": "$(date -Iseconds)",
  "lastReviewDate": "$TODAY",
  "nextScheduledRun": "$(date -d '+1 month' +%Y-%m-%d 2>/dev/null || date -v+1m +%Y-%m-%d)",
  "totalRuns": $((TOTAL_RUNS + 1)),
  "blogsMonitored": [
    "https://www.anthropic.com/engineering",
    "https://www.anthropic.com/research",
    "https://www.anthropic.com/news"
  ]
}
EOF

log_success "State updated: $STATE_FILE"

# If opencode is available, offer to run
if command -v opencode &> /dev/null; then
    echo ""
    read -p "Run analysis now with OpenCode? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        cat "$CONTEXT_FILE" | opencode @architect
    fi
fi
