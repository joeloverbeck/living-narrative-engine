# SCODSLERR-011: Migrate ArrayIterationResolver

## Overview
Migrate the arrayIterationResolver to use centralized error handling, focusing on array access errors and iteration boundary conditions.

## Objectives
- Update arrayIterationResolver to use IScopeDslErrorHandler
- Handle array access and iteration errors
- Remove verbose iteration debug logging
- Standardize array-specific error codes

## Implementation Details

### Location
`src/scopeDsl/resolvers/arrayIterationResolver.js`

### Key Error Scenarios

#### 1. Array Access Errors
- Non-array values being iterated
- Null/undefined array sources
- Invalid array indices
- Empty array handling

#### 2. Iteration Errors
- Filter evaluation failures
- Iterator function errors
- Context propagation issues
- Memory limit exceeded for large arrays

#### 3. Type Mismatch Errors
- Attempting to iterate non-iterable
- Mixed type arrays
- Invalid element access

### Error Code Mapping

| Error Type | Description | Error Code | Category |
|-----------|-------------|------------|----------|
| Not array | Value is not iterable | SCOPE_2001 | INVALID_DATA |
| Null array | Array is null/undefined | SCOPE_2003 | INVALID_DATA |
| Filter fail | Filter evaluation error | SCOPE_3003 | RESOLUTION_FAILURE |
| Memory limit | Array too large | SCOPE_4003 | CONFIGURATION |
| Invalid index | Array index out of bounds | SCOPE_2001 | INVALID_DATA |

### Array Validation

#### Before:
```javascript
if (!Array.isArray(sourceArray)) {
  console.error('ArrayIterationResolver: Not an array', {
    actualType: typeof sourceArray,
    value: sourceArray,
    node: node,
    context: ctx
  });
  throw new Error(`Expected array but got ${typeof sourceArray}`);
}
```

#### After:
```javascript
if (!Array.isArray(sourceArray)) {
  errorHandler.handleError(
    `Expected array but got ${typeof sourceArray}`,
    { ...ctx, actualType: typeof sourceArray },
    'ArrayIterationResolver',
    ErrorCodes.INVALID_DATA
  );
}
```

### Large Array Handling

```javascript
if (sourceArray.length > MAX_ARRAY_SIZE) {
  errorHandler.handleError(
    `Array size ${sourceArray.length} exceeds limit ${MAX_ARRAY_SIZE}`,
    { ...ctx, arraySize: sourceArray.length },
    'ArrayIterationResolver',
    ErrorCodes.MEMORY_LIMIT
  );
}
```

### Filter Evaluation Errors

```javascript
try {
  const passed = evaluateFilter(element, filter, ctx);
} catch (error) {
  errorHandler.handleError(
    `Filter evaluation failed: ${error.message}`,
    { ...ctx, element, filter, index },
    'ArrayIterationResolver',
    ErrorCodes.FILTER_EVAL_FAILED
  );
}
```

### Dependency Updates
```javascript
export default function createArrayIterationResolver({
  arrayAccessor,
  filterEvaluator,
  errorHandler // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError']
  });
  // ...
}
```

## Acceptance Criteria
- [ ] Array type validation uses error handler
- [ ] Size limit checks implemented
- [ ] Filter errors properly handled
- [ ] Debug logging removed from loops
- [ ] Index boundary checks added
- [ ] Tests cover edge cases
- [ ] Performance not degraded

## Testing Requirements
- Test non-array inputs
- Test null/undefined arrays
- Test empty arrays
- Test large arrays (memory limits)
- Test filter evaluation errors
- Test mixed type arrays
- Performance test for large iterations
- Memory usage monitoring

## Dependencies
- SCODSLERR-006: Pilot pattern established
- SCODSLERR-003: Error codes defined
- SCODSLERR-005: Container configuration

## Estimated Effort
- Code migration: 2 hours
- Test updates: 2 hours
- Performance validation: 1 hour
- Total: 5 hours

## Risk Assessment
- **Medium Risk**: Performance-critical code
- **Mitigation**: Careful performance testing
- **Concern**: Error handling in tight loops

## Related Spec Sections
- Section 2.3: Error Codes
- Section 3.3: Resolver Integration
- Section 7.1: Performance metrics

## Performance Considerations
- Avoid error creation in tight loops
- Cache error messages if repeated
- Consider batching similar errors
- Monitor memory usage with large arrays