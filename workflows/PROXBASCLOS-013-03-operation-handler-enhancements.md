# PROXBASCLOS-013-03: Operation Handler Enhancements

**Parent Ticket**: PROXBASCLOS-013  
**Phase**: Edge Case Handling - Part 3  
**Priority**: Critical  
**Complexity**: High  
**Dependencies**: PROXBASCLOS-013-01, PROXBASCLOS-013-02  
**Estimated Time**: 3 hours

## Summary

Refactor `EstablishSittingClosenessHandler` to use the enhanced validation from previous tickets and implement comprehensive error handling with phased execution. This ensures robust operation handling with proper error recovery and detailed logging.

## Current State

The existing handler:
- Has basic error handling in a try-catch block
- Validates parameters using `validateProximityParameters`
- Establishes closeness relationships
- Updates movement locks
- Limited error context and recovery

## Implementation Requirements

### 1. Phased Execution Pattern

Refactor the `execute` method to use distinct phases:
1. **Parameter Validation Phase**
2. **Component State Validation Phase**
3. **Adjacent Actor Discovery Phase**
4. **Closeness Establishment Phase**
5. **Final State Validation Phase**
6. **Success/Error Handling Phase**

### 2. New Private Methods to Implement

#### 2.1 #validateParameters(parameters, operationId, logger)
```javascript
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
```

#### 2.2 #validateComponentState(parameters, logger)
```javascript
async #validateComponentState(parameters, logger) {
  const validator = new ComponentStateValidator(logger);
  
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
}
```

#### 2.3 #findValidatedAdjacentActors(parameters, furnitureComponent, logger)
```javascript
async #findValidatedAdjacentActors(parameters, furnitureComponent, logger) {
  const validator = new ComponentStateValidator(logger);
  const adjacentActors = findAdjacentOccupants(furnitureComponent, parameters.spot_index);
  
  // Validate each adjacent actor exists and has valid components
  const validActors = [];
  for (const actorId of adjacentActors) {
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
}
```

#### 2.4 #establishClosenessWithValidation(parameters, adjacentActors, operationId, executionContext, logger)

**Important**: This method needs to correctly use the `closenessCircleService.merge()` which returns an array:

```javascript
async #establishClosenessWithValidation(parameters, adjacentActors, operationId, executionContext, logger) {
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
    await this.#entityManager.addComponent(entityId, 'positioning:closeness', componentData);
  }

  // Update movement locks (entityId + boolean)
  for (const actorId of [parameters.actor_id, ...adjacentActors]) {
    await updateMovementLock(this.#entityManager, actorId, true);
  }
}
```

#### 2.5 #validateFinalState(parameters, adjacentActors, logger)
```javascript
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
```

#### 2.6 #handleNoAdjacentActors(parameters, operationId, executionContext, logger)
```javascript
#handleNoAdjacentActors(parameters, operationId, executionContext, logger) {
  logger.info('No adjacent actors found, closeness establishment skipped', {
    operationId,
    actorId: parameters.actor_id,
    furnitureId: parameters.furniture_id,
    spotIndex: parameters.spot_index
  });

  if (parameters.result_variable) {
    tryWriteContextVariable(
      parameters.result_variable,
      true, // Operation succeeded (no actors is valid)
      executionContext,
      this.#dispatcher,
      logger
    );
  }

  return { success: true, adjacentActors: [] };
}
```

#### 2.7 #handleSuccess and #handleError Methods

Success handler with proper event dispatching:
```javascript
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
    tryWriteContextVariable(
      parameters.result_variable,
      true,
      executionContext,
      this.#dispatcher,
      logger
    );
  }

  // Dispatch success event
  this.#dispatcher.dispatch({
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
```

### 3. Main Execute Method Refactor

```javascript
async execute(parameters, executionContext) {
  const logger = this.getLogger(executionContext);
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
```

## API Usage Corrections

### 1. tryWriteContextVariable
Correct usage with 5 parameters:
```javascript
tryWriteContextVariable(
  variableName,    // string
  value,           // any
  executionContext,// object
  dispatcher,      // object
  logger          // object
)
```

### 2. safeDispatchError
Correct usage:
```javascript
safeDispatchError(
  dispatcher,      // object
  message,         // string
  details,         // object
  logger          // object
)
```

### 3. updateMovementLock
Correct usage:
```javascript
await updateMovementLock(
  entityManager,   // object
  entityId,        // string
  locked          // boolean
)
```

### 4. closenessCircleService.merge()
Returns an array, not an object:
```javascript
const mergedArray = this.#closenessCircleService.merge(
  array1,
  array2,
  // ... more arrays
);
// Result is a deduplicated array of all unique items
```

## Testing Requirements

Update `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`:

1. **Phased Execution Tests**:
   - Test each phase independently
   - Verify phase order and data flow
   - Test early exit on validation failures

2. **Error Handling Tests**:
   - Parameter validation errors
   - Component state validation errors
   - Adjacent actor validation failures
   - Final state validation issues

3. **Edge Case Tests**:
   - No adjacent actors scenario
   - Single adjacent actor
   - Multiple adjacent actors
   - Corrupted component data
   - Missing entities

4. **Event Dispatching Tests**:
   - Success event dispatching
   - Error event dispatching
   - Context variable writing

## Acceptance Criteria

- [ ] **Phased Execution**: Handler uses distinct phases for clarity
- [ ] **Enhanced Validation**: Uses ComponentStateValidator from ticket 02
- [ ] **Proper API Usage**: All utility functions called correctly
- [ ] **Comprehensive Error Handling**: Each phase has appropriate error handling
- [ ] **Detailed Logging**: Rich context in all log messages
- [ ] **Event Dispatching**: Success/error events dispatched correctly
- [ ] **No Breaking Changes**: Existing valid operations continue to work
- [ ] **Test Coverage**: 95%+ branch coverage for handler

## Files to Modify

1. `src/logic/operationHandlers/establishSittingClosenessHandler.js` - Complete refactor
2. `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js` - Enhanced tests

## Required Imports

Add to the handler:
```javascript
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
```

## Definition of Done

- [ ] Handler refactored with all private methods
- [ ] Phased execution implemented and tested
- [ ] ComponentStateValidator integrated
- [ ] All API calls use correct signatures
- [ ] Error handling comprehensive with recovery
- [ ] Logging provides rich debugging context
- [ ] Unit tests updated with new scenarios
- [ ] ESLint and prettier checks pass
- [ ] Integration tests still pass

## Notes for Implementation

- Generate unique operation IDs for tracking
- Don't re-throw non-critical errors in final validation
- Log warnings for skipped actors during validation
- Ensure backwards compatibility
- Consider performance impact of additional validation

## Next Steps

After completing this ticket, proceed to:
- **PROXBASCLOS-013-04**: State Consistency Validator (system-wide validation)