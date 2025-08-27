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

`src/scopeDsl/resolvers/scopeReferenceResolver.js`

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
| Scope not found | Scope ID not in registry    | SCOPE_3002 | RESOLUTION_FAILURE |
| Max depth       | Resolution depth exceeded   | SCOPE_4002 | DEPTH_EXCEEDED     |
| Invalid ID      | Malformed scope ID          | SCOPE_2001 | INVALID_DATA       |
| No registry     | Registry missing            | SCOPE_1004 | MISSING_CONTEXT    |

### Circular Reference Handling

#### Before:

```javascript
if (visited.has(scopeId)) {
  console.error('Circular reference detected', {
    scopeId,
    visitedScopes: Array.from(visited),
    resolutionPath: getResolutionPath(ctx),
    // Extensive debug info
  });
  throw new ScopeCycleError(`Circular reference: ${scopeId}`);
}
```

#### After:

```javascript
if (visited.has(scopeId)) {
  const path = Array.from(visited).join(' → ') + ` → ${scopeId}`;
  errorHandler.handleError(
    `Circular reference detected: ${path}`,
    { ...ctx, visitedScopes: visited, scopeId },
    'ScopeReferenceResolver',
    ErrorCodes.CYCLE_DETECTED
  );
}
```

### Registry Lookup Errors

```javascript
const scopeDefinition = registry.get(scopeId);
if (!scopeDefinition) {
  errorHandler.handleError(
    `Scope not found in registry: ${scopeId}`,
    { ...ctx, requestedScope: scopeId },
    'ScopeReferenceResolver',
    ErrorCodes.SCOPE_NOT_FOUND
  );
}
```

### Dependency Updates

```javascript
export default function createScopeReferenceResolver({
  scopeRegistry,
  cycleDetector,
  errorHandler, // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError'],
  });
  // ...
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

- Test direct circular references
- Test indirect circular references
- Test self-references
- Test missing scope IDs
- Test malformed scope IDs
- Test depth limit enforcement
- Performance test for deep chains
- Memory test for visited set growth

## Dependencies

- SCODSLERR-006: Pilot pattern established
- SCODSLERR-003: Error codes defined
- SCODSLERR-005: Container configuration

## Estimated Effort

- Code migration: 3 hours
- Test updates: 3 hours
- Validation: 1 hour
- Total: 7 hours

## Risk Assessment

- **High Risk**: Circular reference detection is critical
- **Mitigation**: Extensive testing of cycle patterns
- **Concern**: Must preserve detection accuracy

## Related Spec Sections

- Section 2.3: Error Codes (SCOPE_4001)
- Section 2.2: Error Categories (CYCLE_DETECTED)
- Section 3.3: Resolver Integration

## Special Considerations

- Preserve visited set for cycle detection
- Include full path in cycle errors
- Consider visualization of cycles for debugging
- Maintain performance of cycle detection
