# MOULOCSYS-003: Implement Lock Mouth Engagement Handler

**Phase**: Core Infrastructure  
**Priority**: Critical  
**Complexity**: High  
**Dependencies**: MOULOCSYS-001 (component schema), MOULOCSYS-005 (utilities)  
**Estimated Time**: 6-8 hours

## Summary

Implement the `LockMouthEngagementHandler` class that processes the `LOCK_MOUTH_ENGAGEMENT` operation. This handler will lock mouth engagement for entities, handling both direct entity components and anatomy-based mouth parts. The implementation follows the proven pattern established by the movement lock system.

## Technical Requirements

### File to Create

`src/logic/operationHandlers/lockMouthEngagementHandler.js`

### Handler Architecture

#### Class Structure
```javascript
/**
 * @file Handler that locks mouth engagement for entities with mouth restrictions.
 * @description Handles the LOCK_MOUTH_ENGAGEMENT operation for entities
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { updateMouthEngagementLock } from '../../utils/mouthEngagementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../utils/logger/LoggerInterface.js').ILogger} ILogger */
/** @typedef {import('../../events/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./ExecutionContext.js').default} ExecutionContext */

/**
 * @class LockMouthEngagementHandler
 * @extends BaseOperationHandler
 * @description Handles the LOCK_MOUTH_ENGAGEMENT operation for entities.
 * Follows the resource lock pattern to prevent conflicting mouth-based actions.
 */
class LockMouthEngagementHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Error dispatcher.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('LockMouthEngagementHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasEntity'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validate parameters for execute.
   *
   * @param {object} params
   * @param {ExecutionContext} executionContext
   * @returns {{ actorId:string, logger:ILogger }|null}
   * @private
   */
  #validateParams(params, executionContext) {
    const { actor_id } = params || {};
    const log = this.getLogger(executionContext);

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        { params },
        log
      );
      return null;
    }

    const actorId = actor_id.trim();

    // Check if entity exists
    if (!this.#entityManager.hasEntity(actorId)) {
      safeDispatchError(
        this.#dispatcher,
        `LOCK_MOUTH_ENGAGEMENT: entity "${actorId}" not found`,
        { actor_id: actorId },
        log
      );
      return null;
    }

    return {
      actorId,
      logger: log,
    };
  }

  /**
   * Lock mouth engagement for the specified entity.
   *
   * @param {{ actor_id:string }} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;

    const { actorId, logger } = validated;

    try {
      // This utility handles both legacy and anatomy-based entities
      const result = await updateMouthEngagementLock(
        this.#entityManager,
        actorId,
        true // Lock the mouth
      );

      if (result) {
        logger.debug(
          `[LockMouthEngagementHandler] Successfully locked mouth engagement for entity: ${actorId}`,
          { 
            actorId, 
            result: result.updatedParts ? `Updated ${result.updatedParts.length} mouth parts` : 'Direct component updated'
          }
        );

        // Dispatch success event for other systems to react
        this.#dispatcher.dispatch({
          type: 'MOUTH_ENGAGEMENT_LOCKED',
          payload: {
            actorId,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.warn(
          `[LockMouthEngagementHandler] No mouth found to lock for entity: ${actorId}`
        );
      }
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `LOCK_MOUTH_ENGAGEMENT: failed to lock mouth engagement for entity ${actorId}`,
        { 
          actor_id: actorId, 
          error: err.message, 
          stack: err.stack 
        },
        logger
      );
    }
  }
}

export default LockMouthEngagementHandler;
```

### Method Implementation Details

#### Constructor Pattern
```javascript
constructor({ logger, entityManager, safeEventDispatcher }) {
  // Call parent with dependency validation
  super('LockMouthEngagementHandler', {
    logger: { 
      value: logger,
      // Inherits validation from BaseOperationHandler
    },
    entityManager: {
      value: entityManager,
      requiredMethods: ['getComponentData', 'addComponent', 'hasEntity'],
    },
    safeEventDispatcher: {
      value: safeEventDispatcher,
      requiredMethods: ['dispatch'],
    },
  });
  
  // Store validated dependencies
  this.#entityManager = entityManager;
  this.#dispatcher = safeEventDispatcher;
}
```

#### Parameter Validation
```javascript
#validateParams(params, executionContext) {
  // Extract and validate actor_id
  const { actor_id } = params || {};
  const log = this.getLogger(executionContext);

  // Check parameter type and content
  if (typeof actor_id !== 'string' || !actor_id.trim()) {
    safeDispatchError(
      this.#dispatcher,
      'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
      { params },
      log
    );
    return null;
  }

  const actorId = actor_id.trim();

  // Verify entity exists
  if (!this.#entityManager.hasEntity(actorId)) {
    safeDispatchError(
      this.#dispatcher,
      `LOCK_MOUTH_ENGAGEMENT: entity "${actorId}" not found`,
      { actor_id: actorId },
      log
    );
    return null;
  }

  return { actorId, logger: log };
}
```

#### Execute Method Flow
```javascript
async execute(params, executionContext) {
  // 1. Validate parameters
  const validated = this.#validateParams(params, executionContext);
  if (!validated) return; // Exit early if validation fails

  const { actorId, logger } = validated;

  try {
    // 2. Update mouth engagement lock (handles anatomy complexity)
    const result = await updateMouthEngagementLock(
      this.#entityManager,
      actorId,
      true // Lock state
    );

    // 3. Log and dispatch success
    if (result) {
      logger.debug(/* success message */);
      this.#dispatcher.dispatch({
        type: 'MOUTH_ENGAGEMENT_LOCKED',
        payload: { actorId, timestamp: new Date().toISOString() }
      });
    } else {
      logger.warn(/* no mouth warning */);
    }
  } catch (err) {
    // 4. Handle errors gracefully
    safeDispatchError(/* error details */);
  }
}
```

## Acceptance Criteria

### Core Functionality
- [ ] **Parameter Validation**: Properly validates actor_id parameter
- [ ] **Entity Verification**: Checks if entity exists before processing
- [ ] **Lock Application**: Successfully locks mouth engagement
- [ ] **Anatomy Support**: Handles anatomy-based mouth parts
- [ ] **Legacy Support**: Handles direct component entities
- [ ] **Event Dispatching**: Dispatches MOUTH_ENGAGEMENT_LOCKED event

### Error Handling
- [ ] **Invalid Parameters**: Handles missing or invalid actor_id
- [ ] **Missing Entity**: Handles non-existent entities gracefully
- [ ] **No Mouth**: Handles entities without mouths appropriately
- [ ] **Component Errors**: Handles component update failures
- [ ] **Async Errors**: Properly catches and reports async errors

### Integration Requirements
- [ ] **Base Class**: Properly extends BaseOperationHandler
- [ ] **Dependency Injection**: Validates all dependencies
- [ ] **Utility Integration**: Uses updateMouthEngagementLock correctly
- [ ] **Event System**: Integrates with safe event dispatcher
- [ ] **Logging**: Uses appropriate log levels

## Testing Strategy

### Unit Tests

File: `tests/unit/logic/operationHandlers/lockMouthEngagementHandler.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LockMouthEngagementHandler from '../../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import { createMockLogger } from '../../../common/mocks/mockLogger.js';
import { createMockEntityManager } from '../../../common/mocks/mockEntityManager.js';
import { createMockEventDispatcher } from '../../../common/mocks/mockEventDispatcher.js';

describe('LockMouthEngagementHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockExecutionContext;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEntityManager = createMockEntityManager();
    mockEventDispatcher = createMockEventDispatcher();
    
    handler = new LockMouthEngagementHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
    });

    mockExecutionContext = {
      logger: mockLogger,
    };
  });

  describe('Constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new LockMouthEngagementHandler({}))
        .toThrow('Missing required dependency');
    });

    it('should validate entityManager methods', () => {
      const invalidEntityManager = { getComponentData: jest.fn() };
      expect(() => new LockMouthEngagementHandler({
        logger: mockLogger,
        entityManager: invalidEntityManager,
        safeEventDispatcher: mockEventDispatcher,
      })).toThrow('Missing required method');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject missing actor_id', async () => {
      await handler.execute({}, mockExecutionContext);
      
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            message: expect.stringContaining('invalid "actor_id"'),
          }),
        })
      );
    });

    it('should reject empty actor_id', async () => {
      await handler.execute({ actor_id: '  ' }, mockExecutionContext);
      
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
        })
      );
    });

    it('should reject non-existent entity', async () => {
      mockEntityManager.hasEntity.mockReturnValue(false);
      
      await handler.execute(
        { actor_id: 'unknown_entity' },
        mockExecutionContext
      );
      
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            message: expect.stringContaining('entity "unknown_entity" not found'),
          }),
        })
      );
    });
  });

  describe('Successful Execution', () => {
    it('should lock mouth engagement for anatomy-based entity', async () => {
      // Setup
      mockEntityManager.hasEntity.mockReturnValue(true);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' }
          }
        })
        .mockReturnValueOnce({ // anatomy:part for mouth
          subType: 'mouth'
        })
        .mockReturnValueOnce(null); // No existing mouth_engagement

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Verify mouth engagement was added
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'mouth_1',
        'core:mouth_engagement',
        { locked: true, forcedOverride: false }
      );

      // Verify success event
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'MOUTH_ENGAGEMENT_LOCKED',
        payload: {
          actorId: 'actor_1',
          timestamp: expect.any(String),
        },
      });
    });

    it('should lock mouth engagement for legacy entity', async () => {
      // Setup - entity with direct mouth_engagement component
      mockEntityManager.hasEntity.mockReturnValue(true);
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No anatomy:body
        .mockReturnValueOnce({ locked: false }); // Existing mouth_engagement

      // Execute
      await handler.execute(
        { actor_id: 'legacy_actor' },
        mockExecutionContext
      );

      // Verify component was updated
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'legacy_actor',
        'core:mouth_engagement',
        { locked: true, forcedOverride: false }
      );
    });

    it('should handle entity without mouth gracefully', async () => {
      // Setup - entity with no mouth parts
      mockEntityManager.hasEntity.mockReturnValue(true);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ // anatomy:body without mouth
          body: {
            root: 'torso_1',
            parts: { head: 'head_1' } // No mouth
          }
        });

      // Execute
      await handler.execute(
        { actor_id: 'no_mouth_actor' },
        mockExecutionContext
      );

      // Should log warning but not error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No mouth found')
      );
      
      // Should not dispatch error
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYSTEM_ERROR_OCCURRED' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle component update failure', async () => {
      // Setup
      mockEntityManager.hasEntity.mockReturnValue(true);
      mockEntityManager.addComponent.mockRejectedValue(
        new Error('Component update failed')
      );

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Verify error was dispatched
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            message: expect.stringContaining('failed to lock mouth engagement'),
            error: 'Component update failed',
          }),
        })
      );
    });

    it('should handle utility function errors', async () => {
      // Mock utility to throw error
      jest.mock('../../utils/mouthEngagementUtils.js', () => ({
        updateMouthEngagementLock: jest.fn().mockRejectedValue(
          new Error('Utility error')
        ),
      }));

      // Test error handling...
    });
  });
});
```

### Integration Tests

File: `tests/integration/logic/operationHandlers/lockMouthEngagementIntegration.test.js`

```javascript
describe('LockMouthEngagementHandler - Integration', () => {
  let gameEngine;
  let entityManager;
  let operationInterpreter;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    entityManager = gameEngine.entityManager;
    operationInterpreter = gameEngine.operationInterpreter;
  });

  it('should integrate with operation interpreter', async () => {
    // Create test actor with mouth
    const actor = await createTestActor(entityManager, {
      hasMouth: true,
    });

    // Execute operation through interpreter
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id },
    });

    // Verify mouth is locked
    const mouthPart = getMouthPart(actor);
    const engagement = entityManager.getComponentData(
      mouthPart.id,
      'core:mouth_engagement'
    );
    
    expect(engagement.locked).toBe(true);
  });

  it('should prevent mouth-based actions when locked', async () => {
    // Create actors
    const actor1 = await createTestActor(entityManager, { hasMouth: true });
    const actor2 = await createTestActor(entityManager, { hasMouth: true });

    // Lock actor1's mouth
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor1.id },
    });

    // Try to perform action requiring mouth availability
    const canKneel = await actionSystem.canPerform(
      actor1.id,
      'positioning:kneel_before',
      { target: actor2.id }
    );

    expect(canKneel).toBe(false);
    expect(canKneel.failureReason).toContain('mouth is engaged');
  });
});
```

## Performance Considerations

### Optimization Strategies
- **Early Exit**: Return immediately on validation failure
- **Minimal Queries**: Cache component data during operation
- **Efficient Updates**: Use batch updates where possible
- **Event Batching**: Consider batching multiple lock events

### Performance Metrics
- **Target Execution Time**: < 10ms for single entity
- **Memory Usage**: Minimal allocation (reuse objects)
- **Event Overhead**: Single event dispatch per operation

## Error Recovery

### Error Handling Patterns
```javascript
try {
  // Main operation logic
  const result = await updateMouthEngagementLock(/* ... */);
  
  if (!result) {
    // Handle expected case (no mouth)
    logger.warn(/* ... */);
    return; // Not an error, just nothing to do
  }
  
  // Success path
} catch (err) {
  // Unexpected errors only
  safeDispatchError(/* ... */);
  
  // Don't rethrow - operation completes with error logged
}
```

### Recovery Strategies
- **Partial Success**: If multiple mouths, lock as many as possible
- **Rollback**: Not needed - locks are idempotent
- **Retry Logic**: Not implemented (caller can retry if needed)

## Dependencies

### Direct Dependencies
- `BaseOperationHandler` - Parent class
- `updateMouthEngagementLock` - Utility function (MOULOCSYS-005)
- `safeDispatchError` - Error handling utility
- `validateDependency` - Dependency validation

### System Dependencies
- Entity Manager service
- Safe Event Dispatcher service
- Logger service
- Mouth Engagement Utils (MOULOCSYS-005)

## Definition of Done

- [ ] Handler class implemented with all methods
- [ ] Extends BaseOperationHandler properly
- [ ] Parameter validation complete
- [ ] Entity existence checking works
- [ ] Mouth locking logic implemented
- [ ] Anatomy support verified
- [ ] Event dispatching functional
- [ ] Error handling comprehensive
- [ ] Unit tests written (>90% coverage)
- [ ] Integration tests written
- [ ] Performance acceptable (<10ms)
- [ ] JSDoc comments complete
- [ ] Code follows project standards