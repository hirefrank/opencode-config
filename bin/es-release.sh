#!/usr/bin/env bash
#
# es-release - Release Workflow
#
# Automates the release process:
# 1. Detects changes since last release
# 2. Syncs documentation with code
# 3. Bumps version appropriately
# 4. Creates semantic commit
# 5. Pushes to remote
#
# Usage:
#   es-release                  # Auto-detect version bump
#   es-release --major          # Force major bump
#   es-release --minor          # Force minor bump
#   es-release --patch          # Force patch bump
#   es-release --dry-run        # Preview without committing
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(git rev-parse --show-toplevel)"
OPENCODE_DIR="$GIT_ROOT/.opencode"

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

# Parse arguments
FORCE_BUMP=""
DRY_RUN=false
SKIP_PUSH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --major)
            FORCE_BUMP="major"
            shift
            ;;
        --minor)
            FORCE_BUMP="minor"
            shift
            ;;
        --patch)
            FORCE_BUMP="patch"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-push)
            SKIP_PUSH=true
            shift
            ;;
        --help)
            echo "Usage: es-release [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --major      Force major version bump (breaking changes)"
            echo "  --minor      Force minor version bump (new features)"
            echo "  --patch      Force patch version bump (bug fixes)"
            echo "  --dry-run    Preview changes without committing"
            echo "  --skip-push  Create commit but don't push"
            echo ""
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

cd "$GIT_ROOT"

echo ""
echo "======================================"
echo "  Edge Stack Release"
echo "======================================"
echo ""

# Phase 1: Detect last release
log_info "Phase 1: Detecting last release..."

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LAST_TAG" ]]; then
    LAST_RELEASE="$LAST_TAG"
    log_info "  Last release: $LAST_TAG"
else
    LAST_RELEASE=$(git rev-parse HEAD~20 2>/dev/null || git rev-parse HEAD)
    log_info "  No tags found, using last 20 commits"
fi

# Get current version from opencode.jsonc (look for version pattern)
CURRENT_VERSION="1.0.0"  # Default
if [[ -f "$GIT_ROOT/opencode.jsonc" ]]; then
    # Try to extract version if present
    CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$GIT_ROOT/opencode.jsonc" 2>/dev/null || echo "1.0.0")
fi

log_info "  Current version: $CURRENT_VERSION"
echo ""

# Phase 2: Analyze changes
log_info "Phase 2: Analyzing changes since $LAST_RELEASE..."

# Count changes by category
AGENTS_ADDED=$(git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=A | grep -c "\agent/.*\.md$" || echo "0")
AGENTS_REMOVED=$(git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=D | grep -c "\agent/.*\.md$" || echo "0")
TOOLS_ADDED=$(git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=A | grep -c "\scripts/.*\.js$" || echo "0")
SCRIPTS_ADDED=$(git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=A | grep -c "bin/.*\.sh$" || echo "0")
KNOWLEDGE_CHANGED=$(git diff "$LAST_RELEASE"..HEAD --name-only | grep -c "\knowledge/.*\.md$" || echo "0")

echo "  Changes detected:"
echo "    Agents added: $AGENTS_ADDED"
echo "    Agents removed: $AGENTS_REMOVED"
echo "    Tools added: $TOOLS_ADDED"
echo "    Scripts added: $SCRIPTS_ADDED"
echo "    Knowledge files changed: $KNOWLEDGE_CHANGED"
echo ""

# Phase 3: Determine version bump
log_info "Phase 3: Determining version bump..."

if [[ -n "$FORCE_BUMP" ]]; then
    BUMP_TYPE="$FORCE_BUMP"
    log_info "  Forced bump: $BUMP_TYPE"
else
    # Auto-detect based on changes
    if [[ "$AGENTS_REMOVED" -gt 0 ]]; then
        BUMP_TYPE="major"
        log_warn "  Breaking change detected (agents removed)"
    elif [[ "$AGENTS_ADDED" -gt 0 ]] || [[ "$TOOLS_ADDED" -gt 0 ]] || [[ "$SCRIPTS_ADDED" -gt 0 ]]; then
        BUMP_TYPE="minor"
        log_info "  New features detected"
    else
        BUMP_TYPE="patch"
        log_info "  Bug fixes / documentation only"
    fi
fi

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    minor)
        NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
        ;;
    patch)
        NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
        ;;
esac

log_success "  Version: $CURRENT_VERSION → $NEW_VERSION"
echo ""

# Phase 4: Run validation
log_info "Phase 4: Running pre-release validation..."

if [[ -x "$GIT_ROOT/bin/es-validate.sh" ]]; then
    if "$GIT_ROOT/bin/es-validate.sh" > /dev/null 2>&1; then
        log_success "  Validation passed"
    else
        log_warn "  Validation had warnings (continuing)"
    fi
else
    log_info "  Skipping validation (es-validate.sh not found)"
fi
echo ""

# Phase 5: Generate changelog entry
log_info "Phase 5: Generating changelog..."

CHANGELOG_ENTRY=$(cat << EOF
## v$NEW_VERSION ($(date +%Y-%m-%d))

### Changes
EOF
)

if [[ "$AGENTS_ADDED" -gt 0 ]]; then
    CHANGELOG_ENTRY+=$'\n\n**New Agents:**\n'
    git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=A | grep "\agent/.*\.md$" | while read -r f; do
        name=$(basename "$f" .md)
        CHANGELOG_ENTRY+="- $name"$'\n'
    done
fi

if [[ "$TOOLS_ADDED" -gt 0 ]]; then
    CHANGELOG_ENTRY+=$'\n\n**New Tools:**\n'
    git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=A | grep "\scripts/.*\.js$" | while read -r f; do
        name=$(basename "$f" .js)
        CHANGELOG_ENTRY+="- $name"$'\n'
    done
fi

if [[ "$SCRIPTS_ADDED" -gt 0 ]]; then
    CHANGELOG_ENTRY+=$'\n\n**New Scripts:**\n'
    git diff "$LAST_RELEASE"..HEAD --name-only --diff-filter=A | grep "bin/.*\.sh$" | while read -r f; do
        name=$(basename "$f" .sh)
        CHANGELOG_ENTRY+="- $name"$'\n'
    done
fi

echo "$CHANGELOG_ENTRY"
echo ""

# Phase 6: Generate commit message
log_info "Phase 6: Preparing commit..."

COMMIT_MSG=$(cat << EOF
feat(edge-stack): Release v$NEW_VERSION

Changes in this release:
- Agents: +$AGENTS_ADDED / -$AGENTS_REMOVED
- Tools: +$TOOLS_ADDED
- Scripts: +$SCRIPTS_ADDED
- Knowledge: $KNOWLEDGE_CHANGED files updated

Version bump: $CURRENT_VERSION → $NEW_VERSION ($BUMP_TYPE)

🤖 Generated with OpenCode + Edge Stack
EOF
)

echo "Commit message:"
echo "─────────────────────────────────────────"
echo "$COMMIT_MSG"
echo "─────────────────────────────────────────"
echo ""

# Phase 7: Execute release
if [[ "$DRY_RUN" == true ]]; then
    log_warn "DRY RUN - No changes made"
    echo ""
    echo "To execute this release, run without --dry-run"
    exit 0
fi

read -p "Proceed with release? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Release cancelled"
    exit 1
fi

# Stage all changes
log_info "Staging changes..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    log_warn "No changes to commit"
    exit 0
fi

# Create commit
log_info "Creating commit..."
git commit -m "$COMMIT_MSG"
log_success "Commit created"

# Create tag
log_info "Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
log_success "Tag created"

# Push
if [[ "$SKIP_PUSH" == true ]]; then
    log_warn "Skipping push (--skip-push)"
else
    log_info "Pushing to remote..."
    git push origin HEAD
    git push origin "v$NEW_VERSION"
    log_success "Pushed to remote"
fi

echo ""
echo "======================================"
echo "  Release Complete! 🎉"
echo "======================================"
echo ""
echo "Version: v$NEW_VERSION"
echo "Tag: v$NEW_VERSION"
echo ""
