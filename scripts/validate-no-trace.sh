#!/bin/bash
# validate-no-trace.sh
# SCODSLERR-015: Validate no trace blocks in ScopeDSL code

echo "Checking for trace blocks in ScopeDSL code..."

# Check for any trace blocks in ScopeDSL nodes
TRACE_USAGE=$(grep -r "if (trace)" src/scopeDsl/nodes/ 2>/dev/null | grep -v "test.js" | grep -v "__tests__")

if [ ! -z "$TRACE_USAGE" ]; then
  echo "❌ Found trace blocks in nodes:"
  echo "$TRACE_USAGE"
  exit 1
fi

echo "✅ No trace blocks found in ScopeDSL nodes"

# Check for trace blocks in core helpers
TRACE_CORE=$(grep -r "if (trace)" src/scopeDsl/core/ 2>/dev/null | grep -v "test.js" | grep -v "__tests__")

if [ ! -z "$TRACE_CORE" ]; then
  echo "❌ Found trace blocks in core:"
  echo "$TRACE_CORE"
  exit 1
fi

echo "✅ No trace blocks found in ScopeDSL core"

# Check for trace blocks in utils
TRACE_UTILS=$(grep -r "if (trace)" src/scopeDsl/utils/ 2>/dev/null | grep -v "test.js" | grep -v "__tests__")

if [ ! -z "$TRACE_UTILS" ]; then
  echo "❌ Found trace blocks in utils:"
  echo "$TRACE_UTILS"
  exit 1
fi

echo "✅ No trace blocks found in ScopeDSL utils"

# Also check for trace.addLog calls outside of if blocks (shouldn't exist)
TRACE_CALLS=$(grep -r "trace\.addLog" src/scopeDsl/ 2>/dev/null | grep -v "if (trace)" | grep -v "test.js" | grep -v "__tests__")

if [ ! -z "$TRACE_CALLS" ]; then
  echo "⚠️  Warning: Found trace.addLog calls outside of if blocks:"
  echo "$TRACE_CALLS"
  echo "These may need manual review"
fi

echo "✅ SCODSLERR-015 validation passed - no trace blocks found"