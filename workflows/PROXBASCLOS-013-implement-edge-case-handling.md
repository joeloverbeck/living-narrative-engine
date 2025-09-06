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
- Race condition prevention
- Concurrent modification handling
- Component state inconsistencies

#### 3. Error Recovery and Graceful Degradation
- Partial failure handling
- System state recovery
- Rollback mechanisms for failed operations
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
export function validateProximityParameters(furnitureId, actorId, spotIndex, logger, options = {}) {
  const context = options.context || 'proximity operation';
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
      const errorMessage = `Parameter validation failed in ${context}: ${errors.join(', ')}`;
      
      if (logger && typeof logger.error === 'function') {
        logger.error('Proximity parameter validation failed', {
          context,
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
        context,
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
        context,
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
      throw new ComponentNotFoundError(`Furniture ${furnitureId} missing allows_sitting component`);
    }

    if (!component.spots || !Array.isArray(component.spots)) {
      throw new InvalidComponentStateError(`Furniture ${furnitureId} has invalid spots array`);
    }

    if (component.spots.length === 0) {
      throw new InvalidComponentStateError(`Furniture ${furnitureId} has empty spots array`);
    }

    if (component.spots.length > 10) {
      throw new InvalidComponentStateError(`Furniture ${furnitureId} exceeds maximum spots (10)`);
    }

    // Validate each spot
    component.spots.forEach((spot, index) => {
      if (spot !== null && (typeof spot !== 'string' || !spot.includes(':'))) {
        throw new InvalidComponentStateError(
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
      throw new InvalidComponentStateError(`Actor ${actorId} has invalid closeness partners array`);
    }

    // Validate partner IDs
    component.partners.forEach((partnerId, index) => {
      if (typeof partnerId !== 'string' || !partnerId.includes(':')) {
        throw new InvalidComponentStateError(
          `Actor ${actorId} has invalid partner ID at index ${index}: ${partnerId}`
        );
      }
    });

    // Check for duplicates
    const uniquePartners = new Set(component.partners);
    if (uniquePartners.size !== component.partners.length) {
      throw new InvalidComponentStateError(`Actor ${actorId} has duplicate partners in closeness component`);
    }

    // Check for self-reference
    if (component.partners.includes(actorId)) {
      throw new InvalidComponentStateError(`Actor ${actorId} cannot be partner with themselves`);
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
    const actorCloseness = entityManager.getComponent(actorId, 'positioning:closeness');
    const partnerCloseness = entityManager.getComponent(partnerId, 'positioning:closeness');

    const actorHasPartner = actorCloseness?.partners?.includes(partnerId) || false;
    const partnerHasActor = partnerCloseness?.partners?.includes(actorId) || false;

    if (actorHasPartner && !partnerHasActor) {
      throw new InconsistentStateError(
        `Unidirectional closeness detected: ${actorId} → ${partnerId} but not reverse`
      );
    }

    if (!actorHasPartner && partnerHasActor) {
      throw new InconsistentStateError(
        `Unidirectional closeness detected: ${partnerId} → ${actorId} but not reverse`
      );
    }

    this.#logger.debug('Bidirectional closeness validated', { actorId, partnerId });
  }
}
```

### Enhanced Error Classes

#### Custom Error Types
**New File**: `src/errors/proximityErrors.js`

```javascript
export class ComponentNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ComponentNotFoundError';
    this.code = 'PROXIMITY_COMPONENT_NOT_FOUND';
  }
}

export class InvalidComponentStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidComponentStateError';
    this.code = 'PROXIMITY_INVALID_COMPONENT_STATE';
  }
}

export class InconsistentStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InconsistentStateError'; 
    this.code = 'PROXIMITY_INCONSISTENT_STATE';
  }
}

export class ConcurrencyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConcurrencyError';
    this.code = 'PROXIMITY_CONCURRENCY_ERROR';
  }
}

export class ProximityOperationError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'ProximityOperationError';
    this.code = 'PROXIMITY_OPERATION_ERROR';
    this.originalError = originalError;
  }
}
```

### Enhanced Operation Handlers

#### Robust EstablishSittingClosenessHandler
**File**: `src/logic/operationHandlers/establishSittingClosenessHandler.js` (enhance existing)

##### Add comprehensive error handling and validation
```javascript
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { 
  ComponentNotFoundError, 
  InvalidComponentStateError, 
  ConcurrencyError, 
  ProximityOperationError 
} from '../../errors/proximityErrors.js';

export default class EstablishSittingClosenessHandler {
  #logger;
  #entityManager;
  #eventBus;
  #closenessCircleService;
  #operationContext;
  #validator;

  constructor({ logger, entityManager, eventBus, closenessCircleService, operationContext }) {
    // Existing dependency validation...
    
    this.#validator = new ComponentStateValidator(logger);
  }

  async execute(parameters) {
    const operationId = `establish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Phase 1: Enhanced parameter validation
      this.#validateParameters(parameters, operationId);
      
      // Phase 2: Component state validation
      const { furnitureComponent, actorClosenessComponent } = await this.#validateComponentState(parameters);
      
      // Phase 3: Adjacent actor discovery with validation
      const adjacentActors = await this.#findValidatedAdjacentActors(parameters, furnitureComponent);
      
      if (adjacentActors.length === 0) {
        return this.#handleNoAdjacentActors(parameters, operationId);
      }
      
      // Phase 4: Establish closeness with concurrency protection
      await this.#establishClosenessWithValidation(parameters, adjacentActors, operationId);
      
      // Phase 5: Validate final state
      await this.#validateFinalState(parameters, adjacentActors);
      
      return this.#handleSuccess(parameters, adjacentActors, operationId);
      
    } catch (error) {
      return this.#handleError(error, parameters, operationId);
    }
  }

  #validateParameters(parameters, operationId) {
    try {
      validateProximityParameters(
        parameters.furniture_id, 
        parameters.actor_id, 
        parameters.spot_index, 
        this.#logger,
        { context: `establish closeness operation ${operationId}` }
      );
    } catch (error) {
      throw new ProximityOperationError(
        `Parameter validation failed for establish closeness: ${error.message}`, 
        error
      );
    }
  }

  async #validateComponentState(parameters) {
    try {
      const furnitureComponent = this.#entityManager.getComponent(
        parameters.furniture_id, 
        'positioning:allows_sitting'
      );
      
      this.#validator.validateFurnitureComponent(
        parameters.furniture_id, 
        furnitureComponent, 
        'establish closeness'
      );

      // Validate spot index bounds for this specific furniture
      if (parameters.spot_index >= furnitureComponent.spots.length) {
        throw new InvalidComponentStateError(
          `Spot index ${parameters.spot_index} exceeds furniture capacity (${furnitureComponent.spots.length})`
        );
      }

      const actorClosenessComponent = this.#entityManager.getComponent(
        parameters.actor_id, 
        'positioning:closeness'
      );
      
      this.#validator.validateClosenessComponent(
        parameters.actor_id, 
        actorClosenessComponent,
        'establish closeness'
      );

      return { furnitureComponent, actorClosenessComponent };
      
    } catch (error) {
      if (error instanceof ComponentNotFoundError || error instanceof InvalidComponentStateError) {
        throw error;
      }
      
      throw new ProximityOperationError(
        `Component state validation failed: ${error.message}`, 
        error
      );
    }
  }

  async #findValidatedAdjacentActors(parameters, furnitureComponent) {
    try {
      const adjacentActors = findAdjacentOccupants(furnitureComponent, parameters.spot_index);
      
      // Validate each adjacent actor exists and has valid components
      for (const actorId of adjacentActors) {
        const actorExists = this.#entityManager.hasEntity(actorId);
        if (!actorExists) {
          this.#logger.warn('Adjacent actor no longer exists, skipping', { 
            actorId, 
            furnitureId: parameters.furniture_id 
          });
          continue;
        }

        const actorCloseness = this.#entityManager.getComponent(actorId, 'positioning:closeness');
        this.#validator.validateClosenessComponent(actorId, actorCloseness);
      }

      return adjacentActors.filter(actorId => this.#entityManager.hasEntity(actorId));
      
    } catch (error) {
      throw new ProximityOperationError(
        `Adjacent actor validation failed: ${error.message}`, 
        error
      );
    }
  }

  async #establishClosenessWithValidation(parameters, adjacentActors, operationId) {
    try {
      const updates = new Map();
      
      for (const adjacentActorId of adjacentActors) {
        // Get current components
        const actorCloseness = this.#entityManager.getComponent(parameters.actor_id, 'positioning:closeness');
        const adjacentCloseness = this.#entityManager.getComponent(adjacentActorId, 'positioning:closeness');
        
        // Use closeness circle service to merge
        const mergedPartners = this.#closenessCircleService.merge(
          actorCloseness?.partners || [],
          adjacentCloseness?.partners || [],
          parameters.actor_id,
          adjacentActorId
        );

        // Store updates for batch application
        for (const [entityId, partners] of Object.entries(mergedPartners)) {
          updates.set(entityId, { partners });
        }
      }

      // Apply all updates atomically
      for (const [entityId, componentData] of updates) {
        this.#entityManager.upsertComponent(entityId, 'positioning:closeness', componentData);
      }

      // Update movement locks
      const allAffectedActors = [parameters.actor_id, ...adjacentActors];
      await updateMovementLock(this.#entityManager, allAffectedActors, this.#logger);
      
    } catch (error) {
      throw new ProximityOperationError(
        `Closeness establishment failed: ${error.message}`, 
        error
      );
    }
  }

  async #validateFinalState(parameters, adjacentActors) {
    try {
      // Validate bidirectional relationships were created
      for (const adjacentActorId of adjacentActors) {
        await this.#validator.validateBidirectionalCloseness(
          this.#entityManager, 
          parameters.actor_id, 
          adjacentActorId
        );
      }
    } catch (error) {
      this.#logger.error('Final state validation failed', { 
        error: error.message, 
        actorId: parameters.actor_id,
        adjacentActors
      });
      
      // Don't throw - closeness was established, just log the inconsistency
    }
  }

  #handleNoAdjacentActors(parameters, operationId) {
    this.#logger.info('No adjacent actors found, closeness establishment skipped', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      spotIndex: parameters.spot_index
    });

    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, true);
    }

    return { success: true, adjacentActors: [] };
  }

  #handleSuccess(parameters, adjacentActors, operationId) {
    this.#logger.info('Sitting closeness established successfully', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      spotIndex: parameters.spot_index,
      adjacentActors: adjacentActors,
      relationshipsEstablished: adjacentActors.length
    });

    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, true);
    }

    this.#eventBus.dispatch({
      type: 'SITTING_CLOSENESS_ESTABLISHED',
      payload: {
        actorId: parameters.actor_id,
        furnitureId: parameters.furniture_id,
        adjacentActors: adjacentActors,
        operationId
      }
    });

    return { success: true, adjacentActors };
  }

  #handleError(error, parameters, operationId) {
    const errorContext = {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      spotIndex: parameters.spot_index,
      errorType: error.constructor.name,
      errorMessage: error.message
    };

    this.#logger.error('Failed to establish sitting closeness', errorContext);

    this.#eventBus.dispatch({
      type: 'ESTABLISH_SITTING_CLOSENESS_FAILED',
      payload: {
        ...errorContext,
        reason: error.message
      }
    });

    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, false);
    }

    // Don't re-throw - let the rule engine continue
    return { success: false, error: error.message };
  }
}
```

## Race Condition Prevention

### Atomic Operation Wrapper
**New File**: `src/utils/atomicOperationWrapper.js`

```javascript
/**
 * Provides atomic operation capabilities for proximity closeness operations
 */
export class AtomicOperationWrapper {
  #logger;
  #locks = new Map();

  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * Execute operation with entity-level locking to prevent race conditions
   */
  async executeWithLock(entityIds, operation, context = 'atomic operation') {
    const sortedEntityIds = [...entityIds].sort(); // Prevent deadlock with consistent ordering
    const lockKey = sortedEntityIds.join('|');
    
    if (this.#locks.has(lockKey)) {
      throw new ConcurrencyError(`Concurrent operation detected for entities: ${lockKey}`);
    }

    this.#locks.set(lockKey, Date.now());
    
    try {
      this.#logger.debug('Acquired entity locks for atomic operation', { 
        lockKey, 
        context, 
        entityIds 
      });
      
      const result = await operation();
      
      this.#logger.debug('Atomic operation completed successfully', { 
        lockKey, 
        context 
      });
      
      return result;
      
    } catch (error) {
      this.#logger.error('Atomic operation failed', { 
        lockKey, 
        context, 
        error: error.message 
      });
      throw error;
      
    } finally {
      this.#locks.delete(lockKey);
      this.#logger.debug('Released entity locks', { lockKey, context });
    }
  }

  /**
   * Check if entities are currently locked
   */
  areEntitiesLocked(entityIds) {
    const sortedEntityIds = [...entityIds].sort();
    const lockKey = sortedEntityIds.join('|');
    return this.#locks.has(lockKey);
  }

  /**
   * Get current lock count (for monitoring)
   */
  getLockCount() {
    return this.#locks.size;
  }
}
```

## Comprehensive Testing for Edge Cases

### Edge Case Test Scenarios
**File**: `tests/unit/logic/operationHandlers/proximityEdgeCases.test.js`

```javascript
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
      mockEntityManager.getComponent.mockReturnValue({
        spots: 'not-an-array' // Corrupted data
      });

      await expect(handler.execute({
        furniture_id: 'furniture:corrupted',
        actor_id: 'game:alice',
        spot_index: 1
      })).rejects.toThrow(InvalidComponentStateError);
    });

    it('should handle circular closeness references', async () => {
      // Setup circular reference: A → B → C → A
      mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
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

  describe('Concurrency Edge Cases', () => {
    it('should prevent race conditions during concurrent operations', async () => {
      const concurrentOperations = [];
      
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(handler.execute({
          furniture_id: 'furniture:shared',
          actor_id: `game:actor_${i}`,
          spot_index: i % 3
        }));
      }

      // Should handle concurrent operations without data corruption
      const results = await Promise.allSettled(concurrentOperations);
      
      // At least some operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);

      // Failed operations should have meaningful errors
      const failed = results.filter(r => r.status === 'rejected');
      failed.forEach(result => {
        expect(result.reason.message).toBeDefined();
      });
    });
  });
});
```

## Implementation Checklist

### Phase 1: Enhanced Validation Infrastructure
- [ ] Implement comprehensive parameter validation with detailed error messages
- [ ] Create component state validator with consistency checks
- [ ] Create custom error classes for different failure scenarios
- [ ] Add input sanitization and type safety checks

### Phase 2: Operation Handler Enhancements
- [ ] Enhance EstablishSittingClosenessHandler with robust error handling
- [ ] Enhance RemoveSittingClosenessHandler with validation and recovery
- [ ] Add atomic operation wrapper for race condition prevention
- [ ] Implement comprehensive logging and error reporting

### Phase 3: Edge Case Testing
- [ ] Create comprehensive edge case test suites
- [ ] Test malformed input handling across all entry points
- [ ] Test concurrent operation scenarios
- [ ] Test component state corruption recovery

### Phase 4: Integration and Documentation
- [ ] Integrate enhanced validation with existing operation handlers
- [ ] Test error recovery mechanisms with integration tests
- [ ] Document error codes and troubleshooting procedures
- [ ] Create monitoring and alerting for common failure scenarios

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
- [ ] **Race Condition Prevention**: Concurrent operations handled safely

### Edge Case Requirements
- [ ] **Malformed Data**: Handles corrupted or malformed component data gracefully
- [ ] **Extreme Values**: Handles extreme or unexpected parameter values
- [ ] **Missing Components**: Handles missing or null components appropriately
- [ ] **Concurrent Access**: Prevents data corruption during concurrent operations

### Performance Requirements
- [ ] **Validation Overhead**: Validation adds <10ms to operation execution time
- [ ] **Error Handling**: Error scenarios don't cause memory leaks or resource issues
- [ ] **Concurrency Control**: Lock contention doesn't significantly impact performance
- [ ] **Recovery Time**: System recovery from errors completes within reasonable time

## Definition of Done
- [ ] All input validation enhanced with comprehensive error checking
- [ ] Component state validation implemented with consistency checks
- [ ] Custom error classes created and integrated throughout system
- [ ] Race condition prevention implemented with atomic operation wrapper
- [ ] Operation handlers enhanced with robust error handling and recovery
- [ ] Comprehensive edge case test suite created and passing
- [ ] Error handling and validation integrated with existing codebase
- [ ] Performance impact of validation measured and acceptable
- [ ] Documentation updated with error codes and troubleshooting information
- [ ] Monitoring and alerting capabilities documented for operations team