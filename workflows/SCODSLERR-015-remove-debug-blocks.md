# SCODSLERR-015: Remove Debug-Specific Code Blocks

## Overview
Remove all debug-specific conditional code blocks from resolvers, eliminating development-only code paths that add complexity and performance overhead.

## Objectives
- Remove debug condition blocks
- Eliminate trace-specific logging
- Remove expensive debug computations
- Simplify code paths

## Implementation Details

### Patterns to Remove

#### 1. Debug Conditional Blocks
```javascript
// REMOVE
if (debug || trace) {
  const debugInfo = {
    node: JSON.stringify(node),
    context: deepClone(ctx),
    timestamp: Date.now(),
    // ... extensive debug data
  };
  console.error('Debug:', debugInfo);
}

// KEEP only the essential error handling
errorHandler.handleError(...);
```

#### 2. Trace-Specific Logic
```javascript
// REMOVE
if (ctx.trace) {
  ctx.traceLog = ctx.traceLog || [];
  ctx.traceLog.push({
    resolver: 'FilterResolver',
    input: node,
    output: result
  });
}

// Debug tracking now handled by error buffer
```

#### 3. Development-Only Computations
```javascript
// REMOVE
const debugPath = debug ? computeFullPath(node) : null;
const debugStats = debug ? gatherStatistics(ctx) : null;

// These expensive operations should not exist
```

#### 4. Verbose Object Construction
```javascript
// REMOVE
const error = new Error(
  debug 
    ? `Detailed: ${JSON.stringify(fullContext)}`
    : 'Simple error message'
);

// REPLACE with consistent error through handler
errorHandler.handleError('Clear error message', ctx, ...);
```

### Files to Review

1. All resolver files in `src/scopeDsl/resolvers/`
2. Support utilities used by resolvers
3. Any resolver-specific helper functions

### Refactoring Guidelines

1. **Keep Business Logic**: Only remove debug/trace code
2. **Preserve Error Information**: Essential context should remain
3. **Simplify Conditionals**: Remove branches that only differ in debug output
4. **Eliminate Dead Code**: Remove variables only used for debugging

### Code Metrics to Track

- Lines of code removed (target: 200+ lines)
- Cyclomatic complexity reduction
- Performance improvement in hot paths
- Memory allocation reduction

## Acceptance Criteria
- [ ] No `if (debug)` blocks remain
- [ ] No `if (trace)` blocks remain
- [ ] No debug-only variables
- [ ] No expensive debug computations
- [ ] Code coverage maintained
- [ ] Performance improved
- [ ] Complexity reduced

## Testing Requirements
- Ensure all tests still pass
- Verify error messages remain useful
- Performance benchmarks show improvement
- Memory usage reduced
- Code coverage not decreased

## Dependencies
- SCODSLERR-014: Console.error removal completed
- All resolver migrations (006-013)

## Estimated Effort
- Code analysis: 2 hours
- Block removal: 3 hours
- Testing: 1 hour
- Total: 6 hours

## Risk Assessment
- **Medium Risk**: May accidentally remove needed logic
- **Mitigation**: Careful review, comprehensive testing

## Related Spec Sections
- Section 1.2: Current State Problems
- Section 6: Phase 3 Cleanup
- Section 7.1: Success Metrics (code reduction)

## Verification Script
```javascript
// verify-no-debug.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/scopeDsl/resolvers/**/*.js');
let issues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    if (/if\s*\(\s*(debug|trace)/.test(line)) {
      issues.push(`${file}:${index + 1} - Debug conditional found`);
    }
    if (/\bdebug\s*\?/.test(line)) {
      issues.push(`${file}:${index + 1} - Ternary debug check found`);
    }
  });
});

if (issues.length > 0) {
  console.error('Debug code found:');
  issues.forEach(issue => console.error(issue));
  process.exit(1);
}

console.log('✓ No debug blocks found');
```

## Before/After Metrics
Document improvements:
- Lines of code: before/after
- Cyclomatic complexity: before/after
- Bundle size: before/after
- Test execution time: before/after