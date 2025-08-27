# SCODSLERR-013: Migrate Remaining Resolvers

## Overview
Complete the migration of remaining resolvers (slotAccessResolver and clothingStepResolver) to use the centralized error handling system.

## Objectives
- Migrate slotAccessResolver
- Migrate clothingStepResolver
- Apply consistent error patterns
- Complete Phase 2 migration

## Implementation Details

### Resolvers to Migrate
1. `src/scopeDsl/resolvers/slotAccessResolver.js`
2. `src/scopeDsl/resolvers/clothingStepResolver.js`

## Part 1: SlotAccessResolver

### Location
`src/scopeDsl/resolvers/slotAccessResolver.js`

### Error Scenarios
- Invalid slot identifier
- Slot not found on entity
- Null/undefined slot values
- Invalid slot access syntax

### Error Mapping
| Error Type | Error Code | Category |
|-----------|------------|----------|
| Invalid slot ID | SCOPE_2001 | INVALID_DATA |
| Slot not found | SCOPE_3002 | RESOLUTION_FAILURE |
| Null slot value | SCOPE_2003 | INVALID_DATA |
| Invalid syntax | SCOPE_2001 | INVALID_DATA |

### Example Migration
```javascript
// Before
if (!entity.slots || !entity.slots[slotId]) {
  console.error('Slot not found', { slotId, entity });
  throw new Error(`Slot ${slotId} not found on entity`);
}

// After
if (!entity.slots || !entity.slots[slotId]) {
  errorHandler.handleError(
    `Slot ${slotId} not found on entity`,
    { ...ctx, slotId, entityId: entity.id },
    'SlotAccessResolver',
    ErrorCodes.SCOPE_NOT_FOUND
  );
}
```

## Part 2: ClothingStepResolver

### Location
`src/scopeDsl/resolvers/clothingStepResolver.js`

### Error Scenarios
- Invalid clothing reference
- Missing clothing component
- Invalid step operation
- Clothing slot conflicts

### Error Mapping
| Error Type | Error Code | Category |
|-----------|------------|----------|
| Invalid clothing ref | SCOPE_2001 | INVALID_DATA |
| Missing component | SCOPE_1001 | MISSING_CONTEXT |
| Invalid operation | SCOPE_2001 | INVALID_DATA |
| Slot conflict | SCOPE_3001 | RESOLUTION_FAILURE |

### Example Migration
```javascript
// Before
if (!clothingComponent) {
  console.error('No clothing component', { 
    entity, 
    requestedSlot: slot 
  });
  throw new Error('Entity has no clothing component');
}

// After
if (!clothingComponent) {
  errorHandler.handleError(
    'Entity has no clothing component',
    { ...ctx, entityId: entity.id, requestedSlot: slot },
    'ClothingStepResolver',
    ErrorCodes.MISSING_CONTEXT
  );
}
```

## Common Migration Tasks

### 1. Update Constructor
```javascript
export default function createResolver({
  // existing deps...
  errorHandler // Add this
}) {
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError']
  });
  // ...
}
```

### 2. Remove Debug Code
- Remove all console.error calls
- Remove debug condition blocks
- Remove verbose object logging
- Keep only essential error information

### 3. Update Tests
- Expect ScopeDslError instead of Error
- Check for error codes
- Verify error handler called
- Test error buffer population

## Acceptance Criteria
- [ ] SlotAccessResolver migrated
- [ ] ClothingStepResolver migrated
- [ ] All console.error removed
- [ ] Debug blocks eliminated
- [ ] Error codes properly assigned
- [ ] Tests updated and passing
- [ ] Integration tests verify behavior
- [ ] No performance regression

## Testing Requirements
- Unit tests for each resolver
- Integration tests with scope engine
- Error code verification
- Error buffer validation
- Performance comparison
- Memory usage check

## Dependencies
- SCODSLERR-006: Pilot pattern established
- SCODSLERR-003: Error codes defined
- SCODSLERR-005: Container configuration
- Previous resolver migrations (008-012)

## Estimated Effort
- SlotAccessResolver: 2 hours
- ClothingStepResolver: 2 hours
- Test updates: 2 hours
- Integration validation: 1 hour
- Total: 7 hours

## Risk Assessment
- **Low Risk**: Following established patterns
- **Consideration**: Domain-specific error cases

## Related Spec Sections
- Section 3.3: Resolver Integration Pattern
- Section 6: Implementation Phases
- Phase 2 completion criteria

## Completion Checklist
- [ ] All resolvers use error handler
- [ ] No console.error in any resolver
- [ ] All tests updated and passing
- [ ] Integration tests comprehensive
- [ ] Performance validated
- [ ] Ready for Phase 3 cleanup