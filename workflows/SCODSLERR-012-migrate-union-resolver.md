# SCODSLERR-012: Migrate UnionResolver

## Overview

Migrate the unionResolver to use centralized error handling, focusing on union operation errors and result merging issues.

## Objectives

- Update unionResolver to use IScopeDslErrorHandler
- Handle union operation failures
- Manage result type mismatches
- Remove debug logging for union operations

## Implementation Details

### Location

`src/scopeDsl/resolvers/unionResolver.js`

### Key Error Scenarios

#### 1. Union Operation Errors

- Invalid operands for union
- Type mismatch between operands
- Null/undefined operands
- Empty union results

#### 2. Result Merging Errors

- Incompatible result types
- Duplicate handling failures
- Memory limits for large unions
- Merge conflict resolution

#### 3. Operator Validation

- Invalid union operator (+, |)
- Missing operator
- Multiple operators in single expression

### Error Code Mapping

| Error Type       | Description                      | Error Code | Category           |
| ---------------- | -------------------------------- | ---------- | ------------------ |
| Invalid operand  | Operand cannot be unioned        | SCOPE_2001 | INVALID_DATA       |
| Type mismatch    | Operands have incompatible types | SCOPE_2003 | INVALID_DATA       |
| Merge failure    | Cannot merge results             | SCOPE_3001 | RESOLUTION_FAILURE |
| Memory limit     | Union result too large           | SCOPE_4003 | CONFIGURATION      |
| Invalid operator | Unknown union operator           | SCOPE_2001 | INVALID_DATA       |

### Operand Validation

#### Before:

```javascript
if (!isValidForUnion(leftResult)) {
  console.error('UnionResolver: Invalid left operand', {
    leftResult,
    operator: node.operator,
    rightOperand: node.right,
    context: ctx,
  });
  throw new Error('Left operand is not valid for union operation');
}
```

#### After:

```javascript
if (!isValidForUnion(leftResult)) {
  errorHandler.handleError(
    'Left operand is not valid for union operation',
    { ...ctx, operator: node.operator, operandType: typeof leftResult },
    'UnionResolver',
    ErrorCodes.INVALID_DATA
  );
}
```

### Type Compatibility Checking

```javascript
if (!areTypesCompatible(leftResult, rightResult)) {
  errorHandler.handleError(
    `Cannot union ${typeof leftResult} with ${typeof rightResult}`,
    {
      ...ctx,
      leftType: typeof leftResult,
      rightType: typeof rightResult,
    },
    'UnionResolver',
    ErrorCodes.INVALID_NODE_STRUCTURE
  );
}
```

### Memory Limit Checking

```javascript
const estimatedSize = estimateUnionSize(leftResult, rightResult);
if (estimatedSize > MAX_UNION_SIZE) {
  errorHandler.handleError(
    `Union size ${estimatedSize} exceeds limit ${MAX_UNION_SIZE}`,
    { ...ctx, estimatedSize },
    'UnionResolver',
    ErrorCodes.MEMORY_LIMIT
  );
}
```

### Dependency Updates

```javascript
export default function createUnionResolver({
  resultMerger,
  typeChecker,
  errorHandler, // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError'],
  });
  // ...
}
```

## Acceptance Criteria

- [ ] Operand validation uses error handler
- [ ] Type compatibility checked properly
- [ ] Memory limits enforced
- [ ] Debug logging removed
- [ ] Operator validation implemented
- [ ] Tests cover union scenarios
- [ ] Performance maintained

## Testing Requirements

- Test invalid operands
- Test type mismatches
- Test null/undefined operands
- Test empty unions
- Test large union operations
- Test both + and | operators
- Performance tests for large unions
- Memory usage monitoring

## Dependencies

- SCODSLERR-006: Pilot pattern established
- SCODSLERR-003: Error codes defined
- SCODSLERR-005: Container configuration

## Estimated Effort

- Code migration: 2 hours
- Test updates: 2 hours
- Validation: 1 hour
- Total: 5 hours

## Risk Assessment

- **Low Risk**: Straightforward migration
- **Consideration**: Union size estimation accuracy

## Related Spec Sections

- Section 3.3: Resolver Integration
- Section 2.3: Error Codes
- Union operator handling in scope DSL

## Notes

- Both + and | operators should have same error handling
- Consider deduplication strategy for union results
- Monitor memory usage for large entity unions
