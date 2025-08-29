# SCODSLERR-010: Migrate ScopeReferenceResolver

## Overview

Migrate the scopeReferenceResolver to use centralized error handling, with special attention to circular reference detection and scope registry errors.

## Objectives

- Update scopeReferenceResolver to use IScopeDslErrorHandler
- Improve circular reference error reporting
- Handle scope registry lookup failures
- Remove debug logging overhead

## Implementation Details

### Location

`src/scopeDsl/nodes/scopeReferenceResolver.js`

### Critical Error Scenarios

#### 1. Circular Reference Detection

- Direct circular references (A → B → A)
- Indirect circular references (A → B → C → A)
- Self-references
- Depth-based cycle detection

#### 2. Scope Registry Errors

- Scope ID not found
- Invalid scope ID format
- Registry not available
- Registry access failures

#### 3. Resolution Chain Errors

- Maximum resolution depth exceeded
- Broken resolution chain
- Invalid nested scope references

### Error Code Mapping

| Error Type      | Description                 | Error Code | Category           |
| --------------- | --------------------------- | ---------- | ------------------ |
| Circular ref    | Circular reference detected | SCOPE_4001 | CYCLE_DETECTED     |
| Scope not found | Scope ID not in registry    | SCOPE_3001 | SCOPE_NOT_FOUND    |
| Max depth       | Resolution depth exceeded   | SCOPE_4002 | MAX_DEPTH_EXCEEDED |
| Invalid ID      | Malformed scope ID          | SCOPE_2001 | INVALID_NODE_TYPE  |
| No registry     | Registry missing            | SCOPE_1004 | MISSING_REGISTRY   |

### Circular Reference Handling

#### Current Implementation:

```javascript
// Check for circular references
if (cycleDetector) {
  cycleDetector.enter(scopeId);
}

try {
  // Resolution logic here
} finally {
  // Exit the scope reference to allow proper cycle detection
  if (cycleDetector) {
    cycleDetector.leave();
  }
}
```

#### After Migration:

```javascript
// Check for circular references
if (cycleDetector) {
  try {
    cycleDetector.enter(scopeId);
  } catch (error) {
    // Cycle detected by cycleDetector
    errorHandler.handleError(
      `Circular reference detected: ${error.message}`,
      { ...ctx, scopeId },
      'ScopeReferenceResolver',
      ErrorCodes.CYCLE_DETECTED
    );
    return new Set(); // Return empty set on cycle detection
  }
}

try {
  // Resolution logic here
} finally {
  if (cycleDetector) {
    cycleDetector.leave();
  }
}
```

### Registry Lookup Errors

#### Current Implementation:

```javascript
// Get the referenced scope's AST from the registry
const scopeAst = scopeRegistry.getScopeAst(scopeId);

if (!scopeAst) {
  throw new Error(`Referenced scope not found: ${scopeId}`);
}
```

#### After Migration:

```javascript
// Get the referenced scope's AST from the registry
const scopeAst = scopeRegistry.getScopeAst(scopeId);

if (!scopeAst) {
  errorHandler.handleError(
    `Referenced scope not found: ${scopeId}`,
    { ...ctx, requestedScope: scopeId },
    'ScopeReferenceResolver',
    ErrorCodes.SCOPE_NOT_FOUND
  );
  return new Set(); // Return empty set when scope not found
}
```

### Dependency Updates

#### Current Implementation:

```javascript
export default function createScopeReferenceResolver({
  scopeRegistry,
  cycleDetector,
}) {
  return {
    canResolve(node) { /* ... */ },
    resolve(node, ctx) { /* ... */ }
  };
}
```

#### After Migration:

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

export default function createScopeReferenceResolver({
  scopeRegistry,
  cycleDetector,
  errorHandler, // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError'],
  });
  
  return {
    canResolve(node) { /* ... */ },
    resolve(node, ctx) { /* ... */ }
  };
}
```

## Acceptance Criteria

- [ ] Circular references properly detected and reported
- [ ] Clear resolution path in error messages
- [ ] Registry errors handled consistently
- [ ] Debug logging removed
- [ ] Visited set tracking maintained
- [ ] Tests cover all cycle patterns
- [ ] Error buffer shows resolution history

## Testing Requirements

### Test File Location
- `tests/unit/scopeDsl/nodes/scopeReferenceResolver.test.js` (new file to be created)

### Unit Tests Required
- Test `canResolve()` method with ScopeReference and non-ScopeReference nodes
- Test successful scope resolution with valid scope ID
- Test circular reference detection and error handling
- Test scope not found scenarios
- Test missing scopeRegistry dependency
- Test missing actorEntity in context
- Test error handler integration
- Test context validation and error reporting

### Integration Tests
- Test with real scope registry and cycle detector
- Test error handling integration with IScopeDslErrorHandler
- Test trace logging functionality

### Test Structure Pattern
```javascript
describe('ScopeReferenceResolver', () => {
  let testBed;
  
  beforeEach(() => {
    testBed = createTestBed();
  });
  
  describe('canResolve', () => {
    // Test method recognition
  });
  
  describe('resolve', () => {
    // Test resolution scenarios
    // Test error scenarios
    // Test error handler integration
  });
});
```

## Dependencies

- SCODSLERR-006: Pilot pattern established
- SCODSLERR-003: Error codes defined (✓ Already implemented in `src/scopeDsl/constants/errorCodes.js`)
- SCODSLERR-005: Container configuration (✓ IScopeDslErrorHandler token exists in `src/dependencyInjection/tokens/tokens-core.js`)

## Estimated Effort

- Code migration: 3 hours
- Test updates: 3 hours
- Validation: 1 hour
- Total: 7 hours

## Risk Assessment

- **High Risk**: Circular reference detection is critical
- **Mitigation**: Extensive testing of cycle patterns
- **Concern**: Must preserve detection accuracy

## Related Components

- Error codes: `src/scopeDsl/constants/errorCodes.js`
- Error handler interface: `IScopeDslErrorHandler` (token in `src/dependencyInjection/tokens/tokens-core.js`)  
- Cycle detector: Already integrated via `cycleDetector` dependency
- Scope registry: Uses `scopeRegistry.getScopeAst()` method

## Special Considerations

- **Cycle Detection**: Uses existing `cycleDetector.enter()/leave()` pattern, not a visited set
- **Error Handling**: Should return empty `Set()` instead of throwing to maintain resolver contract
- **Context Validation**: Must validate `actorEntity` and `scopeRegistry` presence
- **Trace Integration**: Preserve existing trace logging functionality
- **Performance**: Maintain minimal overhead for cycle detection operations
