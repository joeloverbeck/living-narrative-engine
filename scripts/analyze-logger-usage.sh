#!/bin/bash

# Logger Usage Analysis Script
# Analyzes logger usage patterns across the test suite to ensure compatibility

echo "=================================="
echo "  Logger Usage Analysis Report"
echo "=================================="
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Project root: $PROJECT_ROOT"
echo ""

# Section 1: Logger Usage Statistics
echo "=== Logger Usage Analysis ==="
echo ""

echo "1. Total logger calls in tests:"
echo -n "   - Unit tests: "
grep -r "logger\." tests/unit 2>/dev/null | wc -l || echo "0"
echo -n "   - Integration tests: "
grep -r "logger\." tests/integration 2>/dev/null | wc -l || echo "0"
echo -n "   - E2E tests: "
grep -r "logger\." tests/e2e 2>/dev/null | wc -l || echo "0"
echo -n "   - Performance tests: "
grep -r "logger\." tests/performance 2>/dev/null | wc -l || echo "0"
echo -n "   - Memory tests: "
grep -r "logger\." tests/memory 2>/dev/null | wc -l || echo "0"
echo -n "   TOTAL: "
grep -r "logger\." tests/ 2>/dev/null | wc -l || echo "0"
echo ""

# Section 2: Mock Creation Patterns
echo "=== Mock Creation Patterns (using existing utilities) ==="
echo ""

echo "2. Mock logger creation:"
echo -n "   - createMockLogger calls: "
grep -r "createMockLogger" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - createEnhancedMockLogger calls: "
grep -r "createEnhancedMockLogger" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - Direct jest.fn() for logger: "
grep -r "jest\.fn.*logger" tests/ 2>/dev/null | wc -l || echo "0"
echo ""

# Section 3: Assertion Patterns
echo "=== Assertion Patterns ==="
echo ""

echo "3. Common assertion patterns:"
echo -n "   - toHaveBeenCalledWith on logger: "
grep -r "logger.*toHaveBeenCalledWith" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.mock.calls usage: "
grep -r "logger.*mock\.calls" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - expect(logger.debug) patterns: "
grep -r "expect.*logger\.debug" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - expect(logger.info) patterns: "
grep -r "expect.*logger\.info" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - expect(logger.warn) patterns: "
grep -r "expect.*logger\.warn" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - expect(logger.error) patterns: "
grep -r "expect.*logger\.error" tests/ 2>/dev/null | wc -l || echo "0"
echo ""

# Section 4: Logger Method Usage
echo "=== Logger Method Usage ==="
echo ""

echo "4. Method calls in tests:"
echo -n "   - logger.debug calls: "
grep -r "logger\.debug" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.info calls: "
grep -r "logger\.info" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.warn calls: "
grep -r "logger\.warn" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.error calls: "
grep -r "logger\.error" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.setLogLevel calls: "
grep -r "logger\.setLogLevel" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.groupCollapsed calls: "
grep -r "logger\.groupCollapsed" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.groupEnd calls: "
grep -r "logger\.groupEnd" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - logger.table calls: "
grep -r "logger\.table" tests/ 2>/dev/null | wc -l || echo "0"
echo ""

# Section 5: Existing Logger Implementations
echo "=== Existing Logger Implementations ==="
echo ""

echo "5. Logger implementation files:"
if [ -d "src/logging" ]; then
    ls -la src/logging/*.js 2>/dev/null | while read -r line; do
        if [ -n "$line" ]; then
            echo "   $line"
        fi
    done
else
    echo "   No logging directory found"
fi
echo ""

# Section 6: Mock Utilities Location
echo "=== Mock Utilities ==="
echo ""

echo "6. Mock utility files:"
if [ -f "tests/common/mockFactories/loggerMocks.js" ]; then
    echo "   ✅ tests/common/mockFactories/loggerMocks.js exists"
    echo -n "      - File size: "
    ls -lh tests/common/mockFactories/loggerMocks.js | awk '{print $5}'
    echo -n "      - Line count: "
    wc -l < tests/common/mockFactories/loggerMocks.js
else
    echo "   ❌ tests/common/mockFactories/loggerMocks.js not found"
fi
echo ""

# Section 7: Test Files Using Logger Mocks
echo "=== Test Files Using Logger Mocks ==="
echo ""

echo "7. Top 10 test files by logger mock usage:"
grep -l "createMockLogger\|createEnhancedMockLogger" tests/**/*.js 2>/dev/null | head -10 | while read -r file; do
    count=$(grep -c "createMockLogger\|createEnhancedMockLogger" "$file" 2>/dev/null || echo "0")
    echo "   $count occurrences: $file"
done | sort -rn | head -10
echo ""

# Section 8: Import Analysis
echo "=== Import Analysis ==="
echo ""

echo "8. Logger-related imports:"
echo -n "   - ConsoleLogger imports: "
grep -r "import.*ConsoleLogger" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - HybridLogger imports: "
grep -r "import.*HybridLogger" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - RemoteLogger imports: "
grep -r "import.*RemoteLogger" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - LoggerStrategy imports: "
grep -r "import.*LoggerStrategy" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - Mock utility imports: "
grep -r "import.*loggerMocks" tests/ 2>/dev/null | wc -l || echo "0"
echo ""

# Section 9: Dependency Injection Usage
echo "=== Dependency Injection Usage ==="
echo ""

echo "9. ILogger token usage:"
echo -n "   - ILogger token references: "
grep -r "ILogger" src/ 2>/dev/null | wc -l || echo "0"
echo -n "   - ILogger in tests: "
grep -r "ILogger" tests/ 2>/dev/null | wc -l || echo "0"
echo ""

# Section 10: Summary Statistics
echo "=== Summary Statistics ==="
echo ""

total_test_files=$(find tests -name "*.test.js" -o -name "*.spec.js" 2>/dev/null | wc -l)
files_with_logger=$(grep -l "logger" tests/**/*.js 2>/dev/null | wc -l)
files_with_mocks=$(grep -l "createMockLogger\|createEnhancedMockLogger" tests/**/*.js 2>/dev/null | wc -l)

echo "10. Overall statistics:"
echo "    - Total test files: $total_test_files"
echo "    - Files using logger: $files_with_logger"
echo "    - Files using mock utilities: $files_with_mocks"

if [ "$total_test_files" -gt 0 ]; then
    coverage_percent=$((files_with_logger * 100 / total_test_files))
    mock_usage_percent=$((files_with_mocks * 100 / total_test_files))
    echo "    - Logger usage coverage: ${coverage_percent}%"
    echo "    - Mock utility usage: ${mock_usage_percent}%"
fi
echo ""

# Section 11: Compatibility Risks
echo "=== Potential Compatibility Risks ==="
echo ""

echo "11. Patterns that might need attention:"
echo -n "   - Direct console.log usage in tests: "
grep -r "console\.log" tests/ 2>/dev/null | wc -l || echo "0"
echo -n "   - Custom logger implementations: "
grep -r "class.*Logger" tests/ 2>/dev/null | grep -v "Mock" | wc -l || echo "0"
echo -n "   - Logger property access (non-method): "
grep -r "logger\.[a-z]*[^(]" tests/ 2>/dev/null | grep -v "logger\.debug\|logger\.info\|logger\.warn\|logger\.error\|logger\.setLogLevel\|logger\.mock" | wc -l || echo "0"
echo ""

echo "=================================="
echo "  Analysis Complete"
echo "=================================="
echo ""
echo "Timestamp: $(date)"
echo "Report generated successfully!"