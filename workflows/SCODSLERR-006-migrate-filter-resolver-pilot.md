# SCODSLERR-006: Migrate FilterResolver as Pilot

## Overview
Migrate the filterResolver to use the new centralized error handling system as a pilot implementation. This will validate the approach before migrating other resolvers.

## Objectives
- Update filterResolver to use IScopeDslErrorHandler
- Remove all console.error calls
- Remove debug-specific code blocks
- Standardize error messages using error codes
- Validate the migration pattern

## Implementation Details

### Location
`src/scopeDsl/resolvers/filterResolver.js`

### Migration Steps

#### 1. Add Error Handler Dependency
```javascript
export default function createFilterResolver({
  logicEval,
  entitiesGateway,
  locationProvider,
  errorHandler  // New dependency
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError', 'getErrorBuffer']
  });
  // ...
}
```

#### 2. Replace Error Handling Patterns

**Before:**
```javascript
if (!actorEntity) {
  if (trace) {
    const error = new Error('FilterResolver: actorEntity is undefined...');
    console.error('[CRITICAL] FilterResolver context missing actorEntity:', {
      // 30+ lines of debug object
    });
    throw error;
  }
  throw new Error('FilterResolver: actorEntity is undefined in context');
}
```

**After:**
```javascript
if (!actorEntity) {
  errorHandler.handleError(
    'actorEntity is missing from context',
    ctx,
    'FilterResolver',
    ErrorCodes.MISSING_ACTOR
  );
}
```

#### 3. Common Error Scenarios to Migrate

1. **Missing Context Properties**
   - actorEntity missing
   - dispatcher missing
   - scopeRegistry missing

2. **Invalid Node Structure**
   - Missing filter property
   - Invalid filter format
   - Malformed JSON Logic

3. **Evaluation Failures**
   - Filter evaluation errors
   - Entity access failures
   - Location resolution errors

### Error Code Mapping
| Current Error | New Error Code | Category |
|--------------|---------------|----------|
| actorEntity undefined | SCOPE_1001 | MISSING_CONTEXT |
| dispatcher missing | SCOPE_1003 | MISSING_CONTEXT |
| Invalid filter | SCOPE_2003 | INVALID_DATA |
| Evaluation failed | SCOPE_3003 | RESOLUTION_FAILURE |

## Acceptance Criteria
- [ ] All console.error calls removed
- [ ] All debug-specific blocks removed
- [ ] Error handler properly injected
- [ ] All error scenarios use error handler
- [ ] Proper error codes assigned
- [ ] Tests updated to expect new error format
- [ ] No functionality regression
- [ ] Error messages remain informative

## Testing Requirements
- Update existing filterResolver tests
- Test each error scenario
- Verify error codes in thrown errors
- Test with both dev and prod configurations
- Integration test with real scope resolution
- Verify error buffer contains entries

## Dependencies
- SCODSLERR-001: Error handler implementation
- SCODSLERR-002: Error factory implementation
- SCODSLERR-003: Error constants
- SCODSLERR-005: Container configuration

## Estimated Effort
- Code migration: 3 hours
- Test updates: 2 hours
- Validation: 1 hour
- Total: 6 hours

## Risk Assessment
- **Medium Risk**: First resolver migration
- **Mitigation**: Keep old code commented for easy rollback
- **Validation**: Extensive testing before other migrations

## Related Spec Sections
- Section 3.3: Resolver Integration Pattern
- Section 4.1: Dependency Injection Setup
- Migration example in spec

## Success Metrics
- All existing tests pass
- Error handling code reduced by >80%
- Consistent error format
- No performance regression
- Error buffer populated correctly

## Rollback Plan
1. Revert to previous error handling
2. Remove error handler dependency
3. Restore console.error calls if needed

## Lessons Learned Documentation
Document:
- Migration challenges encountered
- Pattern refinements needed
- Time estimates accuracy
- Test coverage gaps found