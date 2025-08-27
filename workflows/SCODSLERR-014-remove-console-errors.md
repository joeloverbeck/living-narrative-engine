# SCODSLERR-014: Remove Console.error Calls from All Resolvers

## Overview
Perform a comprehensive cleanup to remove all remaining console.error calls from the ScopeDSL resolver codebase, ensuring all errors go through the centralized handler.

## Objectives
- Search and remove all console.error calls
- Verify no direct console access remains
- Ensure all errors use error handler
- Update any missed error scenarios

## Implementation Details

### Search Strategy

#### 1. Global Search
```bash
# Find all console.error calls in resolvers
grep -r "console\.error" src/scopeDsl/resolvers/
grep -r "console\.warn" src/scopeDsl/resolvers/
grep -r "console\.log" src/scopeDsl/resolvers/
```

#### 2. File List to Check
- `filterResolver.js`
- `sourceResolver.js`
- `stepResolver.js`
- `scopeReferenceResolver.js`
- `arrayIterationResolver.js`
- `unionResolver.js`
- `slotAccessResolver.js`
- `clothingStepResolver.js`
- Any additional resolver files

### Replacement Pattern

#### Pattern 1: Simple Console.error
```javascript
// Remove
console.error('Error message', data);

// Already replaced with
errorHandler.handleError(message, context, resolverName, errorCode);
```

#### Pattern 2: Conditional Debug Logging
```javascript
// Remove entire block
if (debug || trace) {
  console.error('Debug info', complexObject);
}

// Keep only the error throw using error handler
```

#### Pattern 3: Warning to Error Conversion
```javascript
// Convert warnings that should be errors
console.warn('Potential issue', data);

// To either error or proper warning mechanism
logger.warn('Potential issue'); // If keeping as warning
// OR
errorHandler.handleError(...); // If should be error
```

### Verification Steps

1. **Automated Check**
```javascript
// Add to CI/CD pipeline
const checkForConsole = () => {
  const files = glob.sync('src/scopeDsl/resolvers/**/*.js');
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('console.')) {
      throw new Error(`Found console usage in ${file}`);
    }
  });
};
```

2. **ESLint Rule**
```javascript
// Add to .eslintrc for scopeDsl directory
{
  "rules": {
    "no-console": ["error", { 
      "allow": [] // No console methods allowed
    }]
  }
}
```

## Acceptance Criteria
- [ ] Zero console.error calls in resolvers
- [ ] Zero console.warn calls in resolvers
- [ ] Zero console.log calls in resolvers
- [ ] ESLint rule configured and passing
- [ ] Automated check added to build
- [ ] All errors go through error handler
- [ ] No functional regression

## Testing Requirements
- Run full test suite after cleanup
- Verify error messages still informative
- Check error buffer population
- Ensure no lost error information
- Performance validation (no degradation)

## Dependencies
- SCODSLERR-006 through SCODSLERR-013: All resolvers migrated

## Estimated Effort
- Search and removal: 2 hours
- Verification setup: 1 hour
- Testing: 1 hour
- Total: 4 hours

## Risk Assessment
- **Low Risk**: Mechanical replacement
- **Consideration**: Ensure no error info lost

## Related Spec Sections
- Section 6: Phase 3 Cleanup
- Section 1.2: Current State Problems

## Cleanup Checklist
- [ ] Search performed in all resolver files
- [ ] Console.error removed
- [ ] Console.warn addressed
- [ ] Console.log removed
- [ ] ESLint rule added
- [ ] CI check implemented
- [ ] Tests passing
- [ ] Code review completed

## Validation Script
```bash
#!/bin/bash
# validate-no-console.sh

echo "Checking for console usage in resolvers..."
CONSOLE_USAGE=$(grep -r "console\." src/scopeDsl/resolvers/ | grep -v "test.js")

if [ ! -z "$CONSOLE_USAGE" ]; then
  echo "Found console usage:"
  echo "$CONSOLE_USAGE"
  exit 1
fi

echo "✓ No console usage found in resolvers"
```