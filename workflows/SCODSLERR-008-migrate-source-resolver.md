# SCODSLERR-008: Migrate SourceResolver

## Overview

Migrate the sourceResolver to use the centralized error handling system following the pattern established by the filterResolver pilot.

## Objectives

- Update sourceResolver to use IScopeDslErrorHandler
- Remove console.error calls and debug blocks
- Apply standardized error codes
- Follow patterns from pilot migration

## Implementation Details

### Location

`src/scopeDsl/resolvers/sourceResolver.js`

### Common Error Scenarios

#### 1. Missing Context Properties

- No actorEntity in context
- Missing dispatcher function
- Invalid context structure

#### 2. Invalid Source References

- Unknown source type
- Malformed source identifier
- Invalid component reference

#### 3. Resolution Failures

- Entity not found
- Component access failure
- Source evaluation errors

### Error Handling Updates

#### Before:

```javascript
if (!ctx.actorEntity) {
  console.error('SourceResolver: Missing actorEntity', {
    context: ctx,
    node: node,
  });
  throw new Error('SourceResolver: actorEntity is required');
}
```

#### After:

```javascript
if (!ctx.actorEntity) {
  errorHandler.handleError(
    'actorEntity is required for source resolution',
    ctx,
    'SourceResolver',
    ErrorCodes.MISSING_ACTOR
  );
}
```

### Specific Source Type Errors

| Source Type | Error Scenario         | Error Code | Category           |
| ----------- | ---------------------- | ---------- | ------------------ |
| actor       | Missing actor entity   | SCOPE_1001 | MISSING_CONTEXT    |
| component   | Invalid component ID   | SCOPE_2001 | INVALID_DATA       |
| entity      | Entity not found       | SCOPE_3002 | RESOLUTION_FAILURE |
| self        | Invalid self reference | SCOPE_2002 | INVALID_DATA       |

### Dependency Injection

```javascript
export default function createSourceResolver({
  entityGateway,
  componentAccessor,
  errorHandler, // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError'],
  });
  // ...
}
```

## Acceptance Criteria

- [ ] All error scenarios use error handler
- [ ] Console.error calls removed
- [ ] Debug blocks eliminated
- [ ] Proper error codes assigned
- [ ] Tests updated for new error format
- [ ] No functional regression
- [ ] Consistent error messages
- [ ] Error buffer populated correctly

## Testing Requirements

- Update sourceResolver unit tests
- Add error handling specific tests
- Verify error codes and categories
- Test all source types (actor, entity, component, self)
- Integration tests with scope engine
- Performance impact assessment

## Dependencies

- SCODSLERR-006: Pilot migration completed
- SCODSLERR-007: Integration test patterns established
- SCODSLERR-005: Container configuration

## Estimated Effort

- Code migration: 2 hours
- Test updates: 2 hours
- Validation: 1 hour
- Total: 5 hours

## Risk Assessment

- **Low Risk**: Following established pattern
- **Consideration**: Source types may have unique error cases

## Related Spec Sections

- Section 4: Migration Strategy
- Section 3.3: Resolver Integration Pattern

## Migration Checklist

- [ ] Identify all error throw points
- [ ] Map to appropriate error codes
- [ ] Update constructor for error handler
- [ ] Replace error handling code
- [ ] Remove debug logging
- [ ] Update tests
- [ ] Run integration tests
- [ ] Document any new error codes needed
