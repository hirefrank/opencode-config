#!/bin/bash
# Validate Bash commands for potentially destructive operations
# This hook blocks dangerous git and shell commands

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command from the JSON input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block destructive git commands
if echo "$COMMAND" | grep -qE 'git\s+(push\s+.*--force|reset\s+--hard|clean\s+-fd|reflog\s+expire)'; then
  echo '{"decision": "block", "reason": "Destructive git command detected. Use with caution or run manually."}'
  exit 0
fi

# Block dangerous rm commands (recursive force on important directories)
if echo "$COMMAND" | grep -qE 'rm\s+-rf?\s+(/|~|\$HOME|\.\./)'; then
  echo '{"decision": "block", "reason": "Potentially dangerous rm command targeting root or home directory."}'
  exit 0
fi

# Block commands that could expose secrets
if echo "$COMMAND" | grep -qE '(cat|less|more|head|tail).*\.(env|pem|key|secret)'; then
  echo '{"decision": "block", "reason": "Command may expose sensitive credentials. Review the file contents manually."}'
  exit 0
fi

# Block curl/wget piped to shell
if echo "$COMMAND" | grep -qE '(curl|wget).*\|\s*(ba)?sh'; then
  echo '{"decision": "block", "reason": "Piping remote content to shell is dangerous. Download and review first."}'
  exit 0
fi

# Allow the command
exit 0
