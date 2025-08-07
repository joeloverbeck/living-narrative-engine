#!/bin/bash
set -e

# Create test-baselines directory if it doesn't exist
mkdir -p test-baselines

BASELINE_DIR="test-baselines/intmig-$(date +%Y%m%d-%H%M%S)"

echo "📊 Capturing test baseline for INTMIG migration..."
echo "Baseline directory: $BASELINE_DIR"
echo ""

# Create baseline directory
mkdir -p "$BASELINE_DIR"

echo "🧪 Running unit tests..."
npm run test:unit 2>&1 | tee "$BASELINE_DIR/unit-tests.log"
UNIT_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "🔗 Running integration tests..."
npm run test:integration 2>&1 | tee "$BASELINE_DIR/integration-tests.log"
INTEGRATION_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "🌐 Running E2E tests..."
npm run test:e2e 2>&1 | tee "$BASELINE_DIR/e2e-tests.log"
E2E_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "📈 Capturing test coverage..."
npm run test:ci 2>&1 | tee "$BASELINE_DIR/coverage.log"
COVERAGE_EXIT_CODE=${PIPESTATUS[0]}

# Extract coverage summary from the log
echo ""
echo "📝 Extracting coverage summary..."
grep -A 20 "Coverage summary" "$BASELINE_DIR/coverage.log" > "$BASELINE_DIR/coverage-summary.txt" 2>/dev/null || echo "Could not extract coverage summary"

echo ""
echo "📋 Creating baseline summary..."
cat > "$BASELINE_DIR/summary.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "testResults": {
    "unit": {
      "exitCode": $UNIT_EXIT_CODE,
      "status": $([ $UNIT_EXIT_CODE -eq 0 ] && echo '"passed"' || echo '"failed"')
    },
    "integration": {
      "exitCode": $INTEGRATION_EXIT_CODE,
      "status": $([ $INTEGRATION_EXIT_CODE -eq 0 ] && echo '"passed"' || echo '"failed"')
    },
    "e2e": {
      "exitCode": $E2E_EXIT_CODE,
      "status": $([ $E2E_EXIT_CODE -eq 0 ] && echo '"passed"' || echo '"failed"')
    },
    "coverage": {
      "exitCode": $COVERAGE_EXIT_CODE,
      "status": $([ $COVERAGE_EXIT_CODE -eq 0 ] && echo '"passed"' || echo '"failed"')
    }
  }
}
EOF

# Create a quick reference file
echo "INTMIG Test Baseline - $(date)" > "$BASELINE_DIR/README.txt"
echo "================================" >> "$BASELINE_DIR/README.txt"
echo "" >> "$BASELINE_DIR/README.txt"
echo "Test Results:" >> "$BASELINE_DIR/README.txt"
echo "  Unit Tests: $([ $UNIT_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')" >> "$BASELINE_DIR/README.txt"
echo "  Integration Tests: $([ $INTEGRATION_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')" >> "$BASELINE_DIR/README.txt"
echo "  E2E Tests: $([ $E2E_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')" >> "$BASELINE_DIR/README.txt"
echo "  Coverage: $([ $COVERAGE_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')" >> "$BASELINE_DIR/README.txt"
echo "" >> "$BASELINE_DIR/README.txt"
echo "Git Information:" >> "$BASELINE_DIR/README.txt"
echo "  Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')" >> "$BASELINE_DIR/README.txt"
echo "  Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')" >> "$BASELINE_DIR/README.txt"
echo "" >> "$BASELINE_DIR/README.txt"
echo "This baseline can be used to compare test results after migration." >> "$BASELINE_DIR/README.txt"

echo ""
echo "=== Test Baseline Summary ==="
echo ""
echo "✅ Test baseline captured at: $BASELINE_DIR"
echo ""
echo "Test Results:"
echo "  Unit Tests: $([ $UNIT_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "  Integration Tests: $([ $INTEGRATION_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "  E2E Tests: $([ $E2E_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "  Coverage: $([ $COVERAGE_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')"

# Check if all tests passed
if [ $UNIT_EXIT_CODE -eq 0 ] && [ $INTEGRATION_EXIT_CODE -eq 0 ] && [ $E2E_EXIT_CODE -eq 0 ] && [ $COVERAGE_EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✨ All tests passed! Ready to begin migration."
  exit 0
else
  echo ""
  echo "⚠️  Some tests failed. Review the logs before proceeding with migration."
  echo "   Logs are available in: $BASELINE_DIR"
  exit 1
fi