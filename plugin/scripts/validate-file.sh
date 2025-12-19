#!/bin/bash
# Validate file operations on sensitive files
# This hook warns when modifying configuration and credential files

# Read the tool input from stdin
INPUT=$(cat)

# Extract the file path from the JSON input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Get just the filename
FILENAME=$(basename "$FILE_PATH")

# Warn on environment and secret files
if echo "$FILENAME" | grep -qE '^\.(env|env\..*)$|\.pem$|\.key$|credentials\.json$|secrets?\.(json|yaml|yml)$'; then
  echo '{"decision": "block", "reason": "Modifying credential/secret file. Please confirm this change is intentional."}'
  exit 0
fi

# Warn on critical config files
if echo "$FILENAME" | grep -qE '^(wrangler\.toml|package\.json|tsconfig\.json)$'; then
  echo '{"decision": "ask", "reason": "Modifying critical configuration file. Please review the changes carefully."}'
  exit 0
fi

# Warn on lock files
if echo "$FILENAME" | grep -qE '\.(lock|lockb)$|lock\.json$'; then
  echo '{"decision": "block", "reason": "Lock files should not be manually edited. Use package manager commands instead."}'
  exit 0
fi

# Allow the operation
exit 0
