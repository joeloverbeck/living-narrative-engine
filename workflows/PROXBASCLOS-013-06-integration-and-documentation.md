# PROXBASCLOS-013-06: Integration and Documentation

**Parent Ticket**: PROXBASCLOS-013  
**Phase**: Edge Case Handling - Part 6 (Final)  
**Priority**: Medium  
**Complexity**: Low  
**Dependencies**: PROXBASCLOS-013-01 through PROXBASCLOS-013-05  
**Estimated Time**: 1 hour

## Summary

Final integration ticket to ensure all edge case handling components work together seamlessly. This includes updating existing handlers to use the new validators, documenting error codes, and creating troubleshooting guides for common issues.

## Integration Tasks

### 1. Update RemoveSittingClosenessHandler

Integrate the same validation patterns into the remove handler:

**File**: `src/logic/operationHandlers/removeSittingClosenessHandler.js`

```javascript
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { validateProximityParameters } from '../../utils/proximityUtils.js';

// Add similar phased execution pattern:
// - Parameter validation
// - Component state validation
// - Safe removal with error handling
// - Final state validation
```

### 2. Update Other Proximity-Related Handlers

Check and update these handlers if they exist:
- `sitDownHandler.js` - Add furniture validation
- `standUpHandler.js` - Add movement lock validation
- `getCloseHandler.js` - Add closeness validation
- `stepBackHandler.js` - Add bidirectional validation

### 3. Create Error Code Documentation

**New File**: `docs/error-codes/proximity-errors.md`

```markdown
# Proximity System Error Codes

## Parameter Validation Errors

### PROX-001: Invalid Furniture ID Format
**Message**: "Furniture ID must be in namespaced format (modId:identifier)"
**Cause**: Furniture ID doesn't follow the required format
**Solution**: Ensure furniture ID follows pattern: `modId:identifier`
**Example**: `furniture:couch`, `custom_mod:bench`

### PROX-002: Invalid Actor ID Format
**Message**: "Actor ID must be in namespaced format (modId:identifier)"
**Cause**: Actor ID doesn't follow the required format
**Solution**: Ensure actor ID follows pattern: `modId:identifier`
**Example**: `game:alice`, `npc:bob`

### PROX-003: Invalid Spot Index
**Message**: "Spot index must be a non-negative integer between 0 and 9"
**Cause**: Spot index is out of valid range
**Solution**: Use integer values 0-9 for spot index

## Component State Errors

### PROX-101: Missing Furniture Component
**Message**: "Furniture {id} missing allows_sitting component"
**Cause**: Furniture entity exists but lacks allows_sitting component
**Solution**: Ensure furniture has been properly initialized with allows_sitting

### PROX-102: Empty Spots Array
**Message**: "Furniture {id} has empty spots array"
**Cause**: Furniture component has spots=[] (no capacity)
**Solution**: Initialize furniture with at least one spot

### PROX-103: Duplicate Partners
**Message**: "Actor {id} has duplicate partners in closeness component"
**Cause**: Partners array contains duplicate entity IDs
**Solution**: Remove duplicates from partners array

### PROX-104: Self-Reference in Closeness
**Message**: "Actor {id} cannot be partner with themselves"
**Cause**: Actor's partners array includes their own ID
**Solution**: Remove self-reference from partners array

## Consistency Errors

### PROX-201: Unidirectional Closeness
**Message**: "Unidirectional closeness detected: {A} → {B} but not reverse"
**Cause**: Closeness relationship exists in only one direction
**Solution**: Ensure both actors have each other as partners

### PROX-202: Orphaned Movement Lock
**Message**: "{id} has movement locked but no closeness partners or sitting state"
**Cause**: Entity has locked movement without justification
**Solution**: Unlock movement or establish proper relationships

### PROX-203: Sitting Component Mismatch
**Message**: "Sitting component mismatch for {id}"
**Cause**: Actor's sitting component doesn't match furniture occupancy
**Solution**: Synchronize sitting component with furniture spots
```

### 4. Create Troubleshooting Guide

**New File**: `docs/troubleshooting/proximity-issues.md`

```markdown
# Proximity System Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Parameter validation failed" errors

**Symptoms**: 
- Operations fail with InvalidArgumentError
- Error message mentions parameter validation

**Diagnosis Steps**:
1. Check entity ID format (must include colon)
2. Verify spot index is 0-9
3. Ensure logger object has all required methods

**Solution**:
```javascript
// Correct format
{
  furniture_id: 'furniture:couch',  // namespace:id
  actor_id: 'game:alice',           // namespace:id
  spot_index: 1                     // integer 0-9
}
```

### Issue: Closeness relationships not establishing

**Symptoms**:
- Actors sit adjacent but no closeness created
- Movement not locked after sitting

**Diagnosis Steps**:
1. Run StateConsistencyValidator to check system state
2. Verify furniture has allows_sitting component
3. Check if actors already have conflicting relationships

**Solution**:
```javascript
// Debug with consistency validator
const validator = new StateConsistencyValidator(logger, entityManager);
const report = validator.performFullValidation();
console.log('Issues found:', report);
```

### Issue: Unidirectional relationships detected

**Symptoms**:
- Warning logs about unidirectional closeness
- Actor A has B as partner but not vice versa

**Diagnosis Steps**:
1. Check if relationship establishment was interrupted
2. Verify both actors exist and have closeness components
3. Look for errors during update operations

**Solution**:
```javascript
// Repair unidirectional relationships
const issues = validator.validateAllClosenessRelationships();
await validator.repairIssues(issues);
```

### Issue: Movement locks not releasing

**Symptoms**:
- Actors remain locked after standing up
- Orphaned movement locks detected

**Diagnosis Steps**:
1. Check if stand up operation completed successfully
2. Verify closeness relationships were properly removed
3. Look for errors in movement update operations

**Solution**:
```javascript
// Manually unlock orphaned movement
await updateMovementLock(entityManager, actorId, false);
```

## Debugging Tools

### Enable Debug Logging
```javascript
// Set logger to debug level
logger.level = 'debug';

// Validation will log detailed information
validateProximityParameters(furnitureId, actorId, spotIndex, logger);
```

### State Inspection
```javascript
// Inspect current state
const furniture = entityManager.getComponentData(furnitureId, 'positioning:allows_sitting');
const closeness = entityManager.getComponentData(actorId, 'positioning:closeness');
const movement = entityManager.getComponentData(actorId, 'positioning:movement');

console.log('Furniture spots:', furniture?.spots);
console.log('Actor partners:', closeness?.partners);
console.log('Movement locked:', movement?.locked);
```

### Consistency Check Command
```javascript
// Add as debug command in game
function debugCheckConsistency() {
  const validator = new StateConsistencyValidator(logger, entityManager);
  const report = validator.performFullValidation();
  
  if (report.totalIssues > 0) {
    console.warn(`Found ${report.totalIssues} consistency issues`);
    console.table(report.closenessIssues);
    console.table(report.movementLockIssues);
    console.table(report.furnitureOccupancyIssues);
  } else {
    console.log('System state is consistent');
  }
}
```
```

### 5. Update Project Documentation

**Update**: `README.md` or relevant documentation

Add section on edge case handling:
```markdown
## Proximity System Robustness

The proximity-based closeness system includes comprehensive edge case handling:

- **Input Validation**: All parameters validated with detailed error messages
- **Component Validation**: State consistency checks for all components
- **Error Recovery**: Graceful degradation on failures
- **State Consistency**: System-wide validation tools available

### Key Features:
- Validates entity ID namespace format
- Ensures bidirectional relationship integrity
- Detects and reports orphaned movement locks
- Handles corrupted component data gracefully
- Provides detailed error codes and troubleshooting guides

See `docs/error-codes/proximity-errors.md` for error code reference.
See `docs/troubleshooting/proximity-issues.md` for troubleshooting guide.
```

### 6. Performance Validation

Create performance benchmark:
```javascript
// tests/performance/proximityValidation.performance.test.js

describe('Proximity Validation Performance', () => {
  it('should validate parameters in <5ms', () => {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      validateProximityParameters(
        'furniture:couch',
        'game:alice',
        1,
        mockLogger
      );
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / 1000;
    
    expect(avgTime).toBeLessThan(5);
  });

  it('should validate 1000 entities in <100ms', () => {
    // Setup 1000 entities
    const validator = new StateConsistencyValidator(logger, entityManager);
    
    const start = performance.now();
    validator.performFullValidation();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
});
```

## Integration Checklist

### Code Integration
- [ ] RemoveSittingClosenessHandler updated with validators
- [ ] Other proximity handlers checked and updated
- [ ] All handlers use enhanced validateProximityParameters
- [ ] ComponentStateValidator integrated where needed
- [ ] StateConsistencyValidator available for debugging

### Documentation
- [ ] Error codes documented with examples
- [ ] Troubleshooting guide created
- [ ] README updated with robustness features
- [ ] JSDoc comments complete for all new code
- [ ] API changes documented if any

### Testing
- [ ] All unit tests passing
- [ ] Integration tests updated and passing
- [ ] Performance benchmarks meet requirements
- [ ] Edge case test suite comprehensive
- [ ] No regression in existing functionality

### Code Quality
- [ ] ESLint checks pass for all modified files
- [ ] Prettier formatting applied
- [ ] TypeScript type checking passes
- [ ] Test coverage meets requirements (80%+ branches)

## Acceptance Criteria

- [ ] **Integration Complete**: All validators integrated with handlers
- [ ] **Documentation**: Error codes and troubleshooting guides created
- [ ] **Performance**: Validation overhead <10ms per operation
- [ ] **Testing**: All tests pass with required coverage
- [ ] **Quality**: Code meets project standards
- [ ] **Backward Compatibility**: No breaking changes to existing API
- [ ] **Debugging Tools**: Consistency validator available for maintenance

## Files to Create/Modify

### Create
1. `docs/error-codes/proximity-errors.md` - Error code reference
2. `docs/troubleshooting/proximity-issues.md` - Troubleshooting guide
3. `tests/performance/proximityValidation.performance.test.js` - Performance tests

### Modify
1. `src/logic/operationHandlers/removeSittingClosenessHandler.js` - Add validation
2. Other proximity handlers as needed
3. `README.md` or main documentation - Add robustness section

## Definition of Done

- [ ] All validators integrated into relevant handlers
- [ ] Error documentation complete and accurate
- [ ] Troubleshooting guide provides practical solutions
- [ ] Performance validated and within requirements
- [ ] All tests pass including new edge cases
- [ ] Code review completed
- [ ] Documentation updated
- [ ] No regression issues

## Final Validation

Run complete test suite:
```bash
# Unit tests with coverage
npm run test:unit -- --coverage

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Linting and formatting
npx eslint src/utils/proximityUtils.js src/utils/componentStateValidator.js src/utils/stateConsistencyValidator.js
npm run format
```

## Notes for Implementation

- Focus on integration, not new features
- Ensure backward compatibility
- Document any API changes clearly
- Create practical debugging tools
- Consider adding debug commands for development
- Test in realistic scenarios

## Completion

This completes the PROXBASCLOS-013 edge case handling implementation. The system now has:
- Comprehensive input validation
- Component state validation
- System consistency checking
- Detailed error reporting
- Practical troubleshooting tools
- Performance-optimized validation

The proximity-based closeness system is now robust and production-ready with excellent error handling and debugging capabilities.