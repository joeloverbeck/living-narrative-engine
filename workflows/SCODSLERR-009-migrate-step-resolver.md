# SCODSLERR-009: Migrate StepResolver

## Overview

Migrate the stepResolver to use the centralized error handling system, focusing on its complex traversal and node stepping logic.

## Objectives

- Update stepResolver to use IScopeDslErrorHandler
- Handle complex nested traversal errors
- Remove verbose debug logging
- Standardize step-specific error codes

## Implementation Details

### Location

`src/scopeDsl/resolvers/stepResolver.js`

### Key Error Scenarios

#### 1. Node Traversal Errors

- Invalid parent node
- Missing child nodes
- Broken traversal chain
- Null node references

#### 2. Step Operation Errors

- Invalid step direction
- Boundary violations
- Recursive step limits
- Invalid step count

#### 3. Context Propagation Errors

- Lost context during traversal
- Invalid context mutation
- Depth limit exceeded

### Error Code Mapping

| Error Type   | Description                 | Error Code | Category        |
| ------------ | --------------------------- | ---------- | --------------- |
| No parent    | Node has no parent for step | SCOPE_2002 | INVALID_DATA    |
| Invalid step | Step operation invalid      | SCOPE_2001 | INVALID_DATA    |
| Max depth    | Exceeded depth limit        | SCOPE_4002 | DEPTH_EXCEEDED  |
| Null node    | Encountered null node       | SCOPE_2003 | INVALID_DATA    |
| Context lost | Context corrupted           | SCOPE_1001 | MISSING_CONTEXT |

### Complex Error Handling

#### Before:

```javascript
if (!node.parent) {
  if (debug) {
    console.error('StepResolver: Cannot step up from root', {
      node: JSON.stringify(node),
      path: getNodePath(node),
      context: ctx,
      // More debug info
    });
  }
  throw new Error('Cannot step up from root node');
}
```

#### After:

```javascript
if (!node.parent) {
  errorHandler.handleError(
    'Cannot step up from root node',
    { ...ctx, nodePath: getNodePath(node) },
    'StepResolver',
    ErrorCodes.MISSING_NODE_PARENT
  );
}
```

### Special Considerations

1. **Path Tracking**: Include node path in error context
2. **Depth Management**: Track and report depth violations
3. **Recursive Steps**: Handle and report infinite recursion
4. **Performance**: Remove expensive debug serialization

### Dependency Updates

```javascript
export default function createStepResolver({
  nodeTraverser,
  depthTracker,
  errorHandler, // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError'],
  });
  // ...
}
```

## Acceptance Criteria

- [ ] All traversal errors use error handler
- [ ] Debug logging removed
- [ ] Path information preserved in errors
- [ ] Depth tracking errors handled
- [ ] Performance improved (no debug serialization)
- [ ] Tests updated for new errors
- [ ] Error buffer captures traversal history

## Testing Requirements

- Test boundary conditions (root, leaf nodes)
- Test depth limit enforcement
- Test recursive step detection
- Test path tracking in errors
- Performance tests for deep traversals
- Memory tests for error buffering

## Dependencies

- SCODSLERR-006: Pilot pattern established
- SCODSLERR-005: Container configuration
- SCODSLERR-003: Error codes defined

## Estimated Effort

- Code migration: 3 hours
- Test updates: 2 hours
- Validation: 1 hour
- Total: 6 hours

## Risk Assessment

- **Medium Risk**: Complex traversal logic
- **Mitigation**: Careful testing of edge cases
- **Concern**: Path tracking performance

## Related Spec Sections

- Section 4: Migration Strategy
- Section 2.3: Error Codes
- Section 3.3: Resolver Integration

## Performance Notes

- Remove JSON.stringify from hot paths
- Cache node paths if needed repeatedly
- Consider lazy evaluation of debug info
