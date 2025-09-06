# MOULOCSYS-004: Implement Unlock Mouth Engagement Handler

**Phase**: Core Infrastructure  
**Priority**: Critical  
**Complexity**: High  
**Dependencies**: MOULOCSYS-001 (component schema), MOULOCSYS-005 (utilities)  
**Estimated Time**: 6-8 hours

## Summary

Implement the `UnlockMouthEngagementHandler` class that processes the `UNLOCK_MOUTH_ENGAGEMENT` operation. This handler unlocks mouth engagement for entities, handling both direct entity components and anatomy-based mouth parts. Critical for releasing mouth locks when activities like kissing or eating complete.

## Technical Requirements

### File to Create

`src/logic/operationHandlers/unlockMouthEngagementHandler.js`

### Handler Architecture

#### Class Structure
```javascript
/**
 * @file Handler that unlocks mouth engagement for entities.
 * @description Handles the UNLOCK_MOUTH_ENGAGEMENT operation for entities
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
 * @class UnlockMouthEngagementHandler
 * @extends BaseOperationHandler
 * @description Handles the UNLOCK_MOUTH_ENGAGEMENT operation for entities.
 * Releases mouth locks to allow mouth-based actions to resume.
 */
class UnlockMouthEngagementHandler extends BaseOperationHandler {
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
    super('UnlockMouthEngagementHandler', {
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
        'UNLOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
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
        `UNLOCK_MOUTH_ENGAGEMENT: entity "${actorId}" not found`,
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
   * Unlock mouth engagement for the specified entity.
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
        false // Unlock the mouth
      );

      if (result) {
        logger.debug(
          `[UnlockMouthEngagementHandler] Successfully unlocked mouth engagement for entity: ${actorId}`,
          { 
            actorId, 
            result: result.updatedParts ? `Updated ${result.updatedParts.length} mouth parts` : 'Direct component updated'
          }
        );

        // Dispatch success event for other systems to react
        this.#dispatcher.dispatch({
          type: 'MOUTH_ENGAGEMENT_UNLOCKED',
          payload: {
            actorId,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.warn(
          `[UnlockMouthEngagementHandler] No mouth found to unlock for entity: ${actorId}`
        );
      }
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `UNLOCK_MOUTH_ENGAGEMENT: failed to unlock mouth engagement for entity ${actorId}`,
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

export default UnlockMouthEngagementHandler;
```

## Acceptance Criteria

### Core Functionality
- [ ] **Parameter Validation**: Properly validates actor_id parameter
- [ ] **Entity Verification**: Checks if entity exists before processing
- [ ] **Unlock Application**: Successfully unlocks mouth engagement
- [ ] **Anatomy Support**: Handles anatomy-based mouth parts
- [ ] **Legacy Support**: Handles direct component entities
- [ ] **Event Dispatching**: Dispatches MOUTH_ENGAGEMENT_UNLOCKED event

### Error Handling
- [ ] **Invalid Parameters**: Handles missing or invalid actor_id
- [ ] **Missing Entity**: Handles non-existent entities gracefully
- [ ] **No Mouth**: Handles entities without mouths appropriately
- [ ] **Already Unlocked**: Handles already unlocked mouths (idempotent)
- [ ] **Component Errors**: Handles component update failures

### Edge Cases
- [ ] **Double Unlock**: Unlocking already unlocked mouth is safe
- [ ] **No Component**: Creates component if missing (unlocked state)
- [ ] **Multiple Mouths**: Unlocks all mouth parts
- [ ] **Concurrent Operations**: Thread-safe with lock operations

## Testing Strategy

### Unit Tests

File: `tests/unit/logic/operationHandlers/unlockMouthEngagementHandler.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import { createMockLogger } from '../../../common/mocks/mockLogger.js';
import { createMockEntityManager } from '../../../common/mocks/mockEntityManager.js';
import { createMockEventDispatcher } from '../../../common/mocks/mockEventDispatcher.js';

describe('UnlockMouthEngagementHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockExecutionContext;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEntityManager = createMockEntityManager();
    mockEventDispatcher = createMockEventDispatcher();
    
    handler = new UnlockMouthEngagementHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
    });

    mockExecutionContext = {
      logger: mockLogger,
    };
  });

  describe('Successful Execution', () => {
    it('should unlock locked mouth engagement', async () => {
      // Setup - entity with locked mouth
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
        .mockReturnValueOnce({ // Existing locked mouth_engagement
          locked: true,
          forcedOverride: false
        });

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Verify mouth engagement was unlocked
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'mouth_1',
        'core:mouth_engagement',
        { locked: false, forcedOverride: false }
      );

      // Verify success event
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'MOUTH_ENGAGEMENT_UNLOCKED',
        payload: {
          actorId: 'actor_1',
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle already unlocked mouth (idempotent)', async () => {
      // Setup - entity with already unlocked mouth
      mockEntityManager.hasEntity.mockReturnValue(true);
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No anatomy:body
        .mockReturnValueOnce({ // Already unlocked
          locked: false,
          forcedOverride: false
        });

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Should still update (idempotent operation)
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor_1',
        'core:mouth_engagement',
        { locked: false, forcedOverride: false }
      );

      // Should not error
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYSTEM_ERROR_OCCURRED' })
      );
    });

    it('should create component if missing', async () => {
      // Setup - entity with no mouth_engagement component
      mockEntityManager.hasEntity.mockReturnValue(true);
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No anatomy:body
        .mockReturnValueOnce(null); // No existing component

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Should create component in unlocked state
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor_1',
        'core:mouth_engagement',
        { locked: false, forcedOverride: false }
      );
    });
  });

  describe('Error Cases', () => {
    it('should handle missing actor_id', async () => {
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

    it('should handle non-existent entity', async () => {
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
});
```

### Integration Tests

```javascript
describe('UnlockMouthEngagementHandler - Integration', () => {
  it('should restore action availability after unlock', async () => {
    // Lock mouth
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id },
    });

    // Verify action unavailable
    let canKneel = await actionSystem.canPerform(
      actor.id,
      'positioning:kneel_before'
    );
    expect(canKneel).toBe(false);

    // Unlock mouth
    await operationInterpreter.execute({
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id },
    });

    // Verify action available again
    canKneel = await actionSystem.canPerform(
      actor.id,
      'positioning:kneel_before'
    );
    expect(canKneel).toBe(true);
  });
});
```

## Definition of Done

- [ ] Handler class implemented with all methods
- [ ] Extends BaseOperationHandler properly
- [ ] Parameter validation complete
- [ ] Entity existence checking works
- [ ] Mouth unlocking logic implemented
- [ ] Anatomy support verified
- [ ] Event dispatching functional
- [ ] Idempotent behavior confirmed
- [ ] Error handling comprehensive
- [ ] Unit tests written (>90% coverage)
- [ ] Integration tests written
- [ ] JSDoc comments complete
- [ ] Code follows project standards