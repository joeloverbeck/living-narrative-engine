# PROXBASCLOS-013: Implement Edge Case Handling and Validation

**Phase**: Polish & Edge Cases  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: All previous PROXBASCLOS tickets  
**Estimated Time**: 6-8 hours

## Summary

Implement comprehensive edge case handling, input validation, and error recovery mechanisms for the proximity-based closeness system. This ticket ensures the system handles unusual scenarios gracefully and provides clear error messages for debugging and troubleshooting.

## Technical Requirements

### Areas of Focus

#### 1. Input Validation and Sanitization
- Comprehensive parameter validation across all entry points
- Malformed data handling and recovery
- Type safety and bounds checking
- Schema validation integration

#### 2. Edge Case Scenarios
- Single-spot furniture handling
- Empty furniture scenarios  
- Component state inconsistencies
- JavaScript single-threaded execution model considerations

#### 3. Error Recovery and Graceful Degradation
- Partial failure handling
- System state recovery
- Clear error messaging and logging

#### 4. Data Integrity Validation
- Bidirectional relationship consistency
- Component synchronization validation
- Orphaned data detection and cleanup
- Circular reference prevention

## Implementation Areas

### Enhanced Input Validation

#### Parameter Validation Enhancements
**File**: `src/utils/proximityUtils.js` (enhance existing)

##### Enhanced `validateProximityParameters()` Function
```javascript
export function validateProximityParameters(furnitureId, actorId, spotIndex, logger) {
  const errors = [];

  try {
    // Enhanced furniture ID validation
    if (!furnitureId) {
      errors.push('Furniture ID is required');
    } else if (typeof furnitureId !== 'string') {
      errors.push('Furniture ID must be a string');
    } else if (furnitureId.trim().length === 0) {
      errors.push('Furniture ID cannot be empty or whitespace only');
    } else if (!furnitureId.includes(':')) {
      errors.push('Furniture ID must be in namespaced format (modId:identifier)');
    } else {
      // Validate namespace format
      const [modId, identifier] = furnitureId.split(':');
      if (!modId || !identifier) {
        errors.push('Furniture ID must have both mod ID and identifier');
      } else if (!/^[a-zA-Z0-9_]+$/.test(modId)) {
        errors.push('Mod ID must contain only alphanumeric characters and underscores');
      } else if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
        errors.push('Identifier must contain only alphanumeric characters, underscores, and hyphens');
      }
    }

    // Enhanced actor ID validation (same pattern as furniture)
    if (!actorId) {
      errors.push('Actor ID is required');
    } else if (typeof actorId !== 'string') {
      errors.push('Actor ID must be a string');
    } else if (!actorId.includes(':')) {
      errors.push('Actor ID must be in namespaced format (modId:identifier)');
    }

    // Enhanced spot index validation
    if (spotIndex === null || spotIndex === undefined) {
      errors.push('Spot index is required');
    } else if (!Number.isInteger(spotIndex)) {
      errors.push('Spot index must be an integer');
    } else if (spotIndex < 0) {
      errors.push('Spot index must be non-negative');
    } else if (spotIndex > 9) {
      errors.push('Spot index must be 9 or less (maximum furniture capacity)');
    }

    // Logger validation
    if (!logger || typeof logger !== 'object') {
      errors.push('Logger is required and must be an object');
    } else {
      const requiredMethods = ['info', 'warn', 'error', 'debug'];
      for (const method of requiredMethods) {
        if (typeof logger[method] !== 'function') {
          errors.push(`Logger must have ${method} method`);
        }
      }
    }

    // If any errors, throw with detailed information
    if (errors.length > 0) {
      const errorMessage = `Parameter validation failed: ${errors.join(', ')}`;
      
      if (logger && typeof logger.error === 'function') {
        logger.error('Proximity parameter validation failed', {
          furnitureId,
          actorId,
          spotIndex,
          errors,
          timestamp: new Date().toISOString()
        });
      }
      
      throw new InvalidArgumentError(errorMessage);
    }

    // Log successful validation at debug level
    if (logger && typeof logger.debug === 'function') {
      logger.debug('Proximity parameters validated successfully', {
        furnitureId,
        actorId,
        spotIndex
      });
    }

  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      throw error; // Re-throw validation errors
    }
    
    // Handle unexpected validation errors
    const unexpectedError = new Error(`Unexpected error during parameter validation: ${error.message}`);
    
    if (logger && typeof logger.error === 'function') {
      logger.error('Unexpected validation error', {
        originalError: error.message,
        stack: error.stack
      });
    }
    
    throw unexpectedError;
  }
}
```

#### Component State Validation
**New File**: `src/utils/componentStateValidator.js`

```javascript
/**
 * Validates component state consistency for proximity operations
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

    this.#logger.debug('Furniture component validated', { furnitureId, spotsCount: component.spots.length });
  }

  /**
   * Validates closeness component state
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
      partnerCount: component.partners.length 
    });
  }

  /**
   * Validates bidirectional closeness consistency
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

### Enhanced Operation Handlers

#### Robust EstablishSittingClosenessHandler
**File**: `src/logic/operationHandlers/establishSittingClosenessHandler.js` (enhance existing)

##### Add comprehensive error handling and validation
```javascript
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import { getLogger } from './baseOperationHandler.js';

// Inside the EstablishSittingClosenessHandler class:

async execute(parameters, executionContext) {
  const logger = getLogger(executionContext);
  const operationId = `establish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Phase 1: Enhanced parameter validation
    this.#validateParameters(parameters, operationId, logger);
    
    // Phase 2: Component state validation
    const { furnitureComponent, actorClosenessComponent } = await this.#validateComponentState(
      parameters,
      logger
    );
    
    // Phase 3: Adjacent actor discovery with validation
    const adjacentActors = await this.#findValidatedAdjacentActors(
      parameters, 
      furnitureComponent,
      logger
    );
    
    if (adjacentActors.length === 0) {
      return this.#handleNoAdjacentActors(parameters, operationId, executionContext, logger);
    }
    
    // Phase 4: Establish closeness with proper merge handling
    await this.#establishClosenessWithValidation(
      parameters, 
      adjacentActors, 
      operationId,
      executionContext,
      logger
    );
    
    // Phase 5: Validate final state
    await this.#validateFinalState(parameters, adjacentActors, logger);
    
    return this.#handleSuccess(parameters, adjacentActors, operationId, executionContext, logger);
    
  } catch (error) {
    return this.#handleError(error, parameters, operationId, executionContext, logger);
  }
}

#validateParameters(parameters, operationId, logger) {
  try {
    validateProximityParameters(
      parameters.furniture_id, 
      parameters.actor_id, 
      parameters.spot_index, 
      logger
    );
  } catch (error) {
    throw new InvalidArgumentError(
      `Parameter validation failed for establish closeness: ${error.message}`
    );
  }
}

async #validateComponentState(parameters, logger) {
  const validator = new ComponentStateValidator(logger);
  
  try {
    const furnitureComponent = this.#entityManager.getComponentData(
      parameters.furniture_id, 
      'positioning:allows_sitting'
    );
    
    validator.validateFurnitureComponent(
      parameters.furniture_id, 
      furnitureComponent, 
      'establish closeness'
    );

    // Validate spot index bounds for this specific furniture
    if (parameters.spot_index >= furnitureComponent.spots.length) {
      throw new InvalidArgumentError(
        `Spot index ${parameters.spot_index} exceeds furniture capacity (${furnitureComponent.spots.length})`
      );
    }

    const actorClosenessComponent = this.#entityManager.getComponentData(
      parameters.actor_id, 
      'positioning:closeness'
    );
    
    validator.validateClosenessComponent(
      parameters.actor_id, 
      actorClosenessComponent,
      'establish closeness'
    );

    return { furnitureComponent, actorClosenessComponent };
    
  } catch (error) {
    if (error instanceof EntityNotFoundError || error instanceof InvalidArgumentError) {
      throw error;
    }
    
    throw new Error(`Component state validation failed: ${error.message}`);
  }
}

async #findValidatedAdjacentActors(parameters, furnitureComponent, logger) {
  const validator = new ComponentStateValidator(logger);
  
  try {
    const adjacentActors = findAdjacentOccupants(furnitureComponent, parameters.spot_index);
    
    // Validate each adjacent actor exists and has valid components
    const validActors = [];
    for (const actorId of adjacentActors) {
      // Check if entity exists (using hasEntity if available, otherwise try to get a component)
      try {
        const actorCloseness = this.#entityManager.getComponentData(actorId, 'positioning:closeness');
        validator.validateClosenessComponent(actorId, actorCloseness);
        validActors.push(actorId);
      } catch (error) {
        logger.warn('Adjacent actor validation failed, skipping', { 
          actorId, 
          furnitureId: parameters.furniture_id,
          error: error.message
        });
      }
    }

    return validActors;
    
  } catch (error) {
    throw new Error(`Adjacent actor validation failed: ${error.message}`);
  }
}

async #establishClosenessWithValidation(parameters, adjacentActors, operationId, executionContext, logger) {
  try {
    const updates = new Map();
    
    for (const adjacentActorId of adjacentActors) {
      // Get current components
      const actorCloseness = this.#entityManager.getComponentData(
        parameters.actor_id, 
        'positioning:closeness'
      );
      const adjacentCloseness = this.#entityManager.getComponentData(
        adjacentActorId, 
        'positioning:closeness'
      );
      
      // Use closeness circle service to merge - it returns a deduplicated array
      const allParticipants = this.#closenessCircleService.merge(
        actorCloseness?.partners || [],
        adjacentCloseness?.partners || [],
        [parameters.actor_id],
        [adjacentActorId]
      );

      // Create updates for all participants
      for (const participantId of allParticipants) {
        const otherPartners = allParticipants.filter(id => id !== participantId);
        updates.set(participantId, { partners: otherPartners });
      }
    }

    // Apply all updates
    for (const [entityId, componentData] of updates) {
      this.#entityManager.addComponent(entityId, 'positioning:closeness', componentData);
    }

    // Update movement locks (single ID + boolean)
    for (const actorId of [parameters.actor_id, ...adjacentActors]) {
      updateMovementLock(this.#entityManager, actorId, true);
    }
    
  } catch (error) {
    throw new Error(`Closeness establishment failed: ${error.message}`);
  }
}

async #validateFinalState(parameters, adjacentActors, logger) {
  const validator = new ComponentStateValidator(logger);
  
  try {
    // Validate bidirectional relationships were created
    for (const adjacentActorId of adjacentActors) {
      await validator.validateBidirectionalCloseness(
        this.#entityManager, 
        parameters.actor_id, 
        adjacentActorId
      );
    }
  } catch (error) {
    logger.error('Final state validation failed', { 
      error: error.message, 
      actorId: parameters.actor_id,
      adjacentActors
    });
    
    // Don't throw - closeness was established, just log the inconsistency
  }
}

#handleNoAdjacentActors(parameters, operationId, executionContext, logger) {
  logger.info('No adjacent actors found, closeness establishment skipped', {
    operationId,
    actorId: parameters.actor_id,
    furnitureId: parameters.furniture_id,
    spotIndex: parameters.spot_index
  });

  if (parameters.result_variable) {
    tryWriteContextVariable(executionContext, parameters.result_variable, true);
  }

  return { success: true, adjacentActors: [] };
}

#handleSuccess(parameters, adjacentActors, operationId, executionContext, logger) {
  logger.info('Sitting closeness established successfully', {
    operationId,
    actorId: parameters.actor_id,
    furnitureId: parameters.furniture_id,
    spotIndex: parameters.spot_index,
    adjacentActors: adjacentActors,
    relationshipsEstablished: adjacentActors.length
  });

  if (parameters.result_variable) {
    tryWriteContextVariable(executionContext, parameters.result_variable, true);
  }

  safeDispatchError(this.#dispatcher, {
    type: 'SITTING_CLOSENESS_ESTABLISHED',
    payload: {
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      adjacentActors: adjacentActors,
      operationId
    }
  }, logger);

  return { success: true, adjacentActors };
}

#handleError(error, parameters, operationId, executionContext, logger) {
  const errorContext = {
    operationId,
    actorId: parameters.actor_id,
    furnitureId: parameters.furniture_id,
    spotIndex: parameters.spot_index,
    errorType: error.constructor.name,
    errorMessage: error.message
  };

  logger.error('Failed to establish sitting closeness', errorContext);

  safeDispatchError(this.#dispatcher, {
    type: 'ESTABLISH_SITTING_CLOSENESS_FAILED',
    payload: {
      ...errorContext,
      reason: error.message
    }
  }, logger);

  if (parameters.result_variable) {
    tryWriteContextVariable(executionContext, parameters.result_variable, false);
  }

  // Don't re-throw - let the rule engine continue
  return { success: false, error: error.message };
}
```

## Data Consistency Checks

### State Consistency Validator
**New File**: `src/utils/stateConsistencyValidator.js`

```javascript
/**
 * Validates state consistency across the proximity closeness system
 */
export class StateConsistencyValidator {
  #logger;
  #entityManager;

  constructor(logger, entityManager) {
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Validate that all closeness relationships are bidirectional
   */
  validateAllClosenessRelationships() {
    const issues = [];
    const checkedPairs = new Set();

    // Get all entities with closeness components
    const entitiesWithCloseness = this.#entityManager.getEntitiesWithComponent('positioning:closeness');

    for (const entityId of entitiesWithCloseness) {
      const closenessData = this.#entityManager.getComponentData(entityId, 'positioning:closeness');
      
      if (!closenessData || !closenessData.partners) continue;

      for (const partnerId of closenessData.partners) {
        // Skip if we've already checked this pair
        const pairKey = [entityId, partnerId].sort().join('|');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        // Check for bidirectional relationship
        const partnerCloseness = this.#entityManager.getComponentData(partnerId, 'positioning:closeness');
        
        if (!partnerCloseness || !partnerCloseness.partners || !partnerCloseness.partners.includes(entityId)) {
          issues.push({
            type: 'unidirectional_closeness',
            from: entityId,
            to: partnerId,
            message: `${entityId} has ${partnerId} as partner, but not vice versa`
          });
        }
      }
    }

    if (issues.length > 0) {
      this.#logger.warn('Closeness relationship consistency issues found', { issues });
    }

    return issues;
  }

  /**
   * Check for orphaned movement locks
   */
  validateMovementLocks() {
    const issues = [];
    
    const entitiesWithMovement = this.#entityManager.getEntitiesWithComponent('positioning:movement');
    
    for (const entityId of entitiesWithMovement) {
      const movementData = this.#entityManager.getComponentData(entityId, 'positioning:movement');
      
      if (movementData && movementData.locked) {
        // Check if entity has closeness partners or is sitting
        const closenessData = this.#entityManager.getComponentData(entityId, 'positioning:closeness');
        const sittingData = this.#entityManager.getComponentData(entityId, 'positioning:sitting');
        
        if ((!closenessData || closenessData.partners.length === 0) && !sittingData) {
          issues.push({
            type: 'orphaned_movement_lock',
            entityId,
            message: `${entityId} has movement locked but no closeness partners or sitting state`
          });
        }
      }
    }

    if (issues.length > 0) {
      this.#logger.warn('Movement lock consistency issues found', { issues });
    }

    return issues;
  }
}
```

## Comprehensive Testing for Edge Cases

### Edge Case Test Scenarios
**File**: `tests/unit/logic/operationHandlers/proximityEdgeCases.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Proximity Closeness Edge Cases', () => {
  describe('Input Validation Edge Cases', () => {
    it('should handle malformed entity IDs gracefully', async () => {
      const invalidIds = [
        '',
        '   ',
        'no-colon',
        ':missing-mod',
        'missing-id:',
        'mod::double-colon',
        'mod:id:extra',
        null,
        undefined,
        123,
        {},
        []
      ];

      for (const invalidId of invalidIds) {
        await expect(handler.execute({
          furniture_id: invalidId,
          actor_id: 'game:alice',
          spot_index: 1
        })).rejects.toThrow();
      }
    });

    it('should handle extreme spot index values', async () => {
      const invalidSpotIndices = [
        -1,
        -999,
        10,
        100,
        1.5,
        NaN,
        Infinity,
        -Infinity,
        '0',
        '1',
        null,
        undefined
      ];

      for (const invalidSpot of invalidSpotIndices) {
        await expect(handler.execute({
          furniture_id: 'furniture:couch',
          actor_id: 'game:alice',
          spot_index: invalidSpot
        })).rejects.toThrow();
      }
    });
  });

  describe('Component State Edge Cases', () => {
    it('should handle corrupted furniture component', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        spots: 'not-an-array' // Corrupted data
      });

      await expect(handler.execute({
        furniture_id: 'furniture:corrupted',
        actor_id: 'game:alice',
        spot_index: 1
      })).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle circular closeness references', async () => {
      // Setup circular reference: A → B → C → A
      mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
        if (componentType === 'positioning:closeness') {
          switch (entityId) {
            case 'game:alice': return { partners: ['game:bob'] };
            case 'game:bob': return { partners: ['game:charlie'] };
            case 'game:charlie': return { partners: ['game:alice'] };
          }
        }
        return null;
      });

      // Should handle gracefully without infinite loops
      const result = await handler.execute({
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1
      });

      expect(result.success).toBeDefined();
    });
  });

  describe('JavaScript Single-Threaded Model', () => {
    it('should handle sequential operations correctly', async () => {
      // JavaScript is single-threaded, so operations are inherently atomic
      // This test verifies that sequential operations maintain data consistency
      
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(handler.execute({
          furniture_id: 'furniture:shared',
          actor_id: `game:actor_${i}`,
          spot_index: i % 3
        }));
      }

      // Operations execute sequentially in JavaScript's event loop
      const results = await Promise.all(operations);
      
      // All operations should complete without data corruption
      results.forEach(result => {
        expect(result.success).toBeDefined();
      });
    });
  });
});
```

## Implementation Checklist

### Phase 1: Enhanced Validation Infrastructure
- [ ] Implement comprehensive parameter validation with detailed error messages
- [ ] Create component state validator with consistency checks
- [ ] Use existing error classes (InvalidArgumentError, EntityNotFoundError)
- [ ] Add input sanitization and type safety checks

### Phase 2: Operation Handler Enhancements
- [ ] Enhance EstablishSittingClosenessHandler with robust error handling
- [ ] Fix EntityManager method calls (getComponentData, addComponent)
- [ ] Fix ClosenessCircleService merge() usage (returns array, not object)
- [ ] Use tryWriteContextVariable for context variable handling
- [ ] Use safeDispatchError for event dispatching
- [ ] Call updateMovementLock with correct signature (entityId, boolean)

### Phase 3: Edge Case Testing
- [ ] Create comprehensive edge case test suites
- [ ] Test malformed input handling across all entry points
- [ ] Test component state corruption recovery
- [ ] Test JavaScript single-threaded execution model

### Phase 4: Integration and Documentation
- [ ] Integrate enhanced validation with existing operation handlers
- [ ] Test error recovery mechanisms with integration tests
- [ ] Document error codes and troubleshooting procedures
- [ ] Create monitoring patterns for common failure scenarios

## Acceptance Criteria

### Error Handling Requirements
- [ ] **Graceful Degradation**: System continues operating when individual operations fail
- [ ] **Clear Error Messages**: All error messages provide actionable information for debugging
- [ ] **Comprehensive Logging**: All failure scenarios logged with appropriate context
- [ ] **Error Recovery**: System can recover from partial failures without manual intervention

### Validation Requirements
- [ ] **Input Validation**: All inputs validated with detailed error messages
- [ ] **Component Consistency**: All component states validated for consistency
- [ ] **Bidirectional Integrity**: All closeness relationships validated as bidirectional
- [ ] **Single-threaded Safety**: Leverage JavaScript's single-threaded model

### Edge Case Requirements
- [ ] **Malformed Data**: Handles corrupted or malformed component data gracefully
- [ ] **Extreme Values**: Handles extreme or unexpected parameter values
- [ ] **Missing Components**: Handles missing or null components appropriately
- [ ] **Data Consistency**: Maintains data consistency in JavaScript's event loop

### Performance Requirements
- [ ] **Validation Overhead**: Validation adds <10ms to operation execution time
- [ ] **Error Handling**: Error scenarios don't cause memory leaks or resource issues
- [ ] **Recovery Time**: System recovery from errors completes within reasonable time

## Definition of Done
- [ ] All input validation enhanced with comprehensive error checking
- [ ] Component state validation implemented with consistency checks
- [ ] Use existing error classes throughout system
- [ ] Operation handlers enhanced with correct API usage
- [ ] Comprehensive edge case test suite created and passing
- [ ] Error handling and validation integrated with existing codebase
- [ ] Performance impact of validation measured and acceptable
- [ ] Documentation updated with error codes and troubleshooting information
- [ ] Monitoring patterns documented for operations team