#!/bin/bash
# validate-no-console.sh
# SCODSLERR-014: Validate no console usage in ScopeDSL resolvers

echo "Checking for console usage in ScopeDSL resolvers..."

# Check for any console usage in ScopeDSL nodes, excluding test files
CONSOLE_USAGE=$(grep -r "console\." src/scopeDsl/nodes/ | grep -v "test.js" | grep -v "__tests__")

if [ ! -z "$CONSOLE_USAGE" ]; then
  echo "❌ Found console usage:"
  echo "$CONSOLE_USAGE"
  exit 1
fi

echo "✅ No console usage found in ScopeDSL resolvers"

# Also check for common debugging patterns
DEBUG_PATTERNS=$(grep -r -E "(console\.log|console\.warn|console\.error|console\.info|console\.debug)" src/scopeDsl/nodes/ | grep -v "test.js" | grep -v "__tests__")

if [ ! -z "$DEBUG_PATTERNS" ]; then
  echo "❌ Found debugging patterns:"
  echo "$DEBUG_PATTERNS"
  exit 1
fi

echo "✅ No debugging patterns found in ScopeDSL resolvers"
echo "✅ SCODSLERR-014 validation passed"