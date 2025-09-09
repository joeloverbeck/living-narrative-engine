# PROXBASCLOS-013-02: Component State Validator

**Parent Ticket**: PROXBASCLOS-013  
**Phase**: Edge Case Handling - Part 2  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-013-01 (enhanced parameter validation)  
**Estimated Time**: 2 hours

## Summary

Create a new `ComponentStateValidator` class to validate component states for consistency and handle edge cases in furniture and closeness components. This validator ensures data integrity throughout proximity operations.

## Implementation Requirements

### 1. Create ComponentStateValidator Class

**New File**: `src/utils/componentStateValidator.js`

The class should provide methods to:
- Validate furniture component structure and data
- Validate closeness component consistency
- Check bidirectional relationship integrity
- Handle edge cases gracefully

### 2. Core Validation Methods

#### 2.1 validateFurnitureComponent(furnitureId, component, context)

Validates furniture `allows_sitting` component:
- **Null Check**: Component must exist
- **Spots Array**: Must be present and be an array
- **Empty Check**: Spots array cannot be empty
- **Maximum Capacity**: Cannot exceed 10 spots
- **Spot Validation**: Each occupied spot must have valid entity ID format
- **Error Reporting**: Clear messages with furniture ID and context

#### 2.2 validateClosenessComponent(actorId, component, context)

Validates actor `closeness` component:
- **Null Handling**: Null component is valid (no relationships)
- **Partners Array**: Must be array if present
- **Partner ID Format**: Each partner must be valid namespaced ID
- **Duplicate Check**: No duplicate partners allowed
- **Self-Reference Check**: Actor cannot be partner with themselves
- **Error Reporting**: Detailed messages with actor ID

#### 2.3 validateBidirectionalCloseness(entityManager, actorId, partnerId)

Ensures closeness relationships are bidirectional:
- Check both actors have each other as partners
- Detect unidirectional relationships
- Report specific direction of inconsistency
- Handle missing components gracefully

## Implementation Template

```javascript
/**
 * @file Validates component state consistency for proximity operations
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../errors/entityNotFoundError.js';

export class ComponentStateValidator {
  #logger;

  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * Validates furniture component state
   * @param {string} furnitureId - ID of the furniture entity
   * @param {object} component - Furniture's allows_sitting component
   * @param {string} [context='furniture validation'] - Validation context
   * @throws {EntityNotFoundError} If component is missing
   * @throws {InvalidArgumentError} If component is invalid
   */
  validateFurnitureComponent(furnitureId, component, context = 'furniture validation') {
    if (!component) {
      throw new EntityNotFoundError(`Furniture ${furnitureId} missing allows_sitting component`);
    }

    if (!component.spots || !Array.isArray(component.spots)) {
      throw new InvalidArgumentError(`Furniture ${furnitureId} has invalid spots array`);
    }

    if (component.spots.length === 0) {
      throw new InvalidArgumentError(`Furniture ${furnitureId} has empty spots array`);
    }

    if (component.spots.length > 10) {
      throw new InvalidArgumentError(`Furniture ${furnitureId} exceeds maximum spots (10)`);
    }

    // Validate each spot
    component.spots.forEach((spot, index) => {
      if (spot !== null && (typeof spot !== 'string' || !spot.includes(':'))) {
        throw new InvalidArgumentError(
          `Furniture ${furnitureId} spot ${index} has invalid occupant ID: ${spot}`
        );
      }
    });

    this.#logger.debug('Furniture component validated', { 
      furnitureId, 
      spotsCount: component.spots.length,
      context
    });
  }

  /**
   * Validates closeness component state
   * @param {string} actorId - ID of the actor entity
   * @param {object|null} component - Actor's closeness component
   * @param {string} [context='closeness validation'] - Validation context
   * @throws {InvalidArgumentError} If component is invalid
   */
  validateClosenessComponent(actorId, component, context = 'closeness validation') {
    if (!component) {
      return; // Null closeness component is valid (no relationships)
    }

    if (!component.partners || !Array.isArray(component.partners)) {
      throw new InvalidArgumentError(`Actor ${actorId} has invalid closeness partners array`);
    }

    // Validate partner IDs
    component.partners.forEach((partnerId, index) => {
      if (typeof partnerId !== 'string' || !partnerId.includes(':')) {
        throw new InvalidArgumentError(
          `Actor ${actorId} has invalid partner ID at index ${index}: ${partnerId}`
        );
      }
    });

    // Check for duplicates
    const uniquePartners = new Set(component.partners);
    if (uniquePartners.size !== component.partners.length) {
      throw new InvalidArgumentError(`Actor ${actorId} has duplicate partners in closeness component`);
    }

    // Check for self-reference
    if (component.partners.includes(actorId)) {
      throw new InvalidArgumentError(`Actor ${actorId} cannot be partner with themselves`);
    }

    this.#logger.debug('Closeness component validated', { 
      actorId, 
      partnerCount: component.partners.length,
      context
    });
  }

  /**
   * Validates bidirectional closeness consistency
   * @param {object} entityManager - Entity manager instance
   * @param {string} actorId - First actor ID
   * @param {string} partnerId - Second actor ID
   * @throws {InvalidArgumentError} If relationship is unidirectional
   */
  async validateBidirectionalCloseness(entityManager, actorId, partnerId) {
    const actorCloseness = entityManager.getComponentData(actorId, 'positioning:closeness');
    const partnerCloseness = entityManager.getComponentData(partnerId, 'positioning:closeness');

    const actorHasPartner = actorCloseness?.partners?.includes(partnerId) || false;
    const partnerHasActor = partnerCloseness?.partners?.includes(actorId) || false;

    if (actorHasPartner && !partnerHasActor) {
      throw new InvalidArgumentError(
        `Unidirectional closeness detected: ${actorId} → ${partnerId} but not reverse`
      );
    }

    if (!actorHasPartner && partnerHasActor) {
      throw new InvalidArgumentError(
        `Unidirectional closeness detected: ${partnerId} → ${actorId} but not reverse`
      );
    }

    this.#logger.debug('Bidirectional closeness validated', { actorId, partnerId });
  }
}
```

## Edge Cases to Handle

### 1. Furniture Component Edge Cases
- Missing component (entity exists but no allows_sitting)
- Null or undefined spots array
- Empty spots array (0 spots)
- Single spot furniture (1 spot)
- Maximum capacity (10 spots)
- Corrupted spots data (non-array)
- Invalid occupant IDs in spots

### 2. Closeness Component Edge Cases
- Missing component (valid case - no relationships)
- Null partners array
- Empty partners array (valid - isolated actor)
- Duplicate partners in array
- Self-reference in partners
- Invalid partner ID format
- Corrupted partners data (non-array)

### 3. Bidirectional Validation Edge Cases
- One actor missing closeness component
- Both actors missing closeness components
- Unidirectional relationship (A→B but not B→A)
- Partial data corruption

## Testing Requirements

Create test file: `tests/unit/utils/componentStateValidator.test.js`

### Test Scenarios

1. **Furniture Validation Tests**:
   - Valid furniture with various spot configurations
   - Missing component error
   - Invalid spots array types
   - Empty spots array error
   - Exceeding maximum capacity
   - Invalid occupant IDs

2. **Closeness Validation Tests**:
   - Valid closeness with partners
   - Null component (should pass)
   - Invalid partners array
   - Duplicate partners error
   - Self-reference error
   - Invalid partner ID formats

3. **Bidirectional Validation Tests**:
   - Valid bidirectional relationships
   - Unidirectional A→B detection
   - Unidirectional B→A detection
   - Missing components handling

## Acceptance Criteria

- [ ] **Class Creation**: ComponentStateValidator class created with all methods
- [ ] **Furniture Validation**: Validates all furniture component edge cases
- [ ] **Closeness Validation**: Handles all closeness component scenarios
- [ ] **Bidirectional Check**: Detects and reports unidirectional relationships
- [ ] **Error Messages**: Clear, actionable error messages with context
- [ ] **Logging**: Debug logging for successful validations
- [ ] **Test Coverage**: 100% branch coverage for validator class
- [ ] **Performance**: Validation adds <2ms overhead per component

## Files to Create/Modify

1. **Create**: `src/utils/componentStateValidator.js` - New validator class
2. **Create**: `tests/unit/utils/componentStateValidator.test.js` - Comprehensive tests

## Integration Points

This validator will be used by:
- EstablishSittingClosenessHandler (PROXBASCLOS-013-03)
- RemoveSittingClosenessHandler (future)
- StateConsistencyValidator (PROXBASCLOS-013-04)

## Definition of Done

- [ ] ComponentStateValidator class implemented with all methods
- [ ] All edge cases handled with appropriate errors
- [ ] Unit tests achieve 100% coverage
- [ ] Error messages are clear and helpful
- [ ] JSDoc comments complete for all methods
- [ ] ESLint and prettier checks pass
- [ ] Performance validated <2ms per validation

## Notes for Implementation

- Use existing error classes (InvalidArgumentError, EntityNotFoundError)
- Keep validator stateless except for logger
- Methods should be pure where possible
- Consider creating helper methods for complex validation logic
- Ensure error messages include entity IDs for debugging

## Next Steps

After completing this ticket, proceed to:
- **PROXBASCLOS-013-03**: Operation Handler Enhancements (uses this validator)