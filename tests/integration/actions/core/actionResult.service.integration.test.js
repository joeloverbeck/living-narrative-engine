/**
 * @file Integration tests for ActionResult usage with real services
 * @description Tests ActionResult integration with TargetResolutionService, UnifiedScopeResolver, and other services
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import '../../../common/actionResultMatchers.js';

/**
 * Simulates a target resolution service that returns ActionResults
 */
class MockTargetResolutionService {
  constructor({ scopeResolver, logger, entityManager }) {
    this.scopeResolver = scopeResolver;
    this.logger = logger;
    this.entityManager = entityManager;
  }

  resolveTargets(scopeName, actorEntity, discoveryContext) {
    try {
      this.logger.debug(`Resolving targets for scope: ${scopeName}`);

      // Validate inputs
      if (!scopeName) {
        return ActionResult.failure('Scope name is required');
      }

      if (!actorEntity || !actorEntity.id) {
        return ActionResult.failure('Valid actor entity is required');
      }

      // Use scope resolver to find entities
      const resolveResult = this.scopeResolver.resolve(
        scopeName,
        actorEntity,
        discoveryContext
      );

      if (!resolveResult.success) {
        return ActionResult.failure(resolveResult.errors);
      }

      // Convert resolved entities to target contexts
      const targetContexts = resolveResult.value.map(
        (entity) => new ActionTargetContext('entity', { entityId: entity.id })
      );

      if (targetContexts.length === 0) {
        return ActionResult.failure('No valid targets found for scope');
      }

      return ActionResult.success(targetContexts);
    } catch (error) {
      this.logger.error('Target resolution failed', error);
      return ActionResult.failure(`Target resolution error: ${error.message}`);
    }
  }

  validateTargetAccess(actorEntity, targetEntities) {
    try {
      const validationResults = targetEntities.map((target) => {
        // Simulate access validation
        if (!target || !target.id) {
          return ActionResult.failure(`Invalid target: ${target}`);
        }

        // Check if target exists in entity manager
        const existingTarget = this.entityManager.getEntity(target.id);
        if (!existingTarget) {
          return ActionResult.failure(`Target ${target.id} not found`);
        }

        // Check location-based access
        const actorLocation =
          actorEntity.components?.['core:location']?.currentLocation;
        const targetLocation =
          existingTarget.components?.['core:location']?.currentLocation;

        if (actorLocation !== targetLocation) {
          return ActionResult.failure(
            `Target ${target.id} not accessible from current location`
          );
        }

        return ActionResult.success({ targetId: target.id, accessible: true });
      });

      // Combine all validation results
      return ActionResult.combine(validationResults);
    } catch (error) {
      return ActionResult.failure(`Validation error: ${error.message}`);
    }
  }
}

/**
 * Simulates an action processing service using ActionResults
 */
class MockActionProcessingService {
  constructor({ targetResolver, entityManager, logger }) {
    this.targetResolver = targetResolver;
    this.entityManager = entityManager;
    this.logger = logger;
  }

  processAction(actionDefinition, actorEntity, discoveryContext) {
    try {
      // Step 1: Validate action
      const validationResult = this.validateAction(
        actionDefinition,
        actorEntity
      );
      if (!validationResult.success) {
        return validationResult;
      }

      // Step 2: Resolve targets
      const targetResult = this.targetResolver.resolveTargets(
        actionDefinition.targetScope,
        actorEntity,
        discoveryContext
      );
      if (!targetResult.success) {
        return targetResult;
      }

      // Step 3: Execute action
      const executionResult = this.executeAction(
        actionDefinition,
        actorEntity,
        targetResult.value
      );

      return executionResult;
    } catch (error) {
      this.logger.error('Action processing failed', error);
      return ActionResult.failure(`Processing error: ${error.message}`);
    }
  }

  validateAction(actionDefinition, actorEntity) {
    const errors = [];

    if (!actionDefinition?.id) {
      errors.push('Action definition must have an ID');
    }

    if (!actionDefinition?.targetScope) {
      errors.push('Action definition must specify target scope');
    }

    if (!actorEntity?.id) {
      errors.push('Actor entity must have an ID');
    }

    if (errors.length > 0) {
      return ActionResult.failure(errors);
    }

    return ActionResult.success({
      actionId: actionDefinition.id,
      actorId: actorEntity.id,
      validated: true,
    });
  }

  executeAction(actionDefinition, actorEntity, targetContexts) {
    try {
      const results = [];

      for (const targetContext of targetContexts) {
        // Simulate action execution on each target
        const executionResult = this.executeOnTarget(
          actionDefinition,
          actorEntity,
          targetContext
        );

        results.push(executionResult);
      }

      // Combine all execution results
      const combinedResult = ActionResult.combine(results);

      if (combinedResult.success) {
        return ActionResult.success({
          actionId: actionDefinition.id,
          actorId: actorEntity.id,
          targetResults: combinedResult.value,
          executedAt: Date.now(),
        });
      } else {
        return combinedResult; // Return the failed combination
      }
    } catch (error) {
      return ActionResult.failure(`Execution error: ${error.message}`);
    }
  }

  executeOnTarget(actionDefinition, actorEntity, targetContext) {
    // Simulate different action outcomes
    if (actionDefinition.id === 'failing-action') {
      return ActionResult.failure(
        `Action failed on target ${targetContext.entityId}`
      );
    }

    if (actionDefinition.id === 'conditional-action') {
      // Simulate conditional success based on target properties
      // For this test, we'll check if the target ID contains 'invalid'
      if (targetContext.entityId?.includes('invalid')) {
        return ActionResult.failure(
          `Cannot execute on invalid target ${targetContext.entityId}`
        );
      }
    }

    // Simulate successful execution
    return ActionResult.success({
      targetId: targetContext.entityId,
      effect: `${actionDefinition.id} executed successfully`,
      changes: [`${targetContext.entityId}-updated`],
    });
  }
}

describe('ActionResult - Service Integration', () => {
  let mockLogger;
  let mockEntityManager;
  let mockScopeResolver;
  let mockActor;
  let mockTarget;
  let mockDiscoveryContext;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      entities: new Map(),
      getEntity(id) {
        return this.entities.get(id) || null;
      },
      addEntity(entity) {
        this.entities.set(entity.id, entity);
      },
      updateEntity(id, updates) {
        const entity = this.entities.get(id);
        if (entity) {
          Object.assign(entity, updates);
          return true;
        }
        return false;
      },
    };

    mockScopeResolver = {
      resolve: jest.fn(),
    };

    mockActor = {
      id: 'actor-123',
      components: {
        'core:actor': { name: 'Test Actor' },
        'core:location': { currentLocation: 'room-456' },
      },
    };

    mockTarget = {
      id: 'target-789',
      components: {
        'core:actor': { name: 'Target Actor' },
        'core:location': { currentLocation: 'room-456' },
      },
    };

    mockDiscoveryContext = {
      currentLocation: { id: 'room-456' },
      availableActions: [],
      gameState: { turnNumber: 1 },
    };

    // Setup entities in mock entity manager
    mockEntityManager.addEntity(mockActor);
    mockEntityManager.addEntity(mockTarget);
  });

  afterEach(() => {
    // Clean up any global state
    mockEntityManager.entities.clear();
    jest.clearAllMocks();
  });

  describe('Target Resolution Service Integration', () => {
    it('should integrate with target resolution service for successful resolution', () => {
      // Setup mock scope resolver to return targets
      mockScopeResolver.resolve.mockReturnValue(
        ActionResult.success([mockTarget])
      );

      const service = new MockTargetResolutionService({
        scopeResolver: mockScopeResolver,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      const result = service.resolveTargets(
        'test-scope',
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toBeSuccessfulActionResultWithAnyValue();
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toBeInstanceOf(ActionTargetContext);
      expect(result.value[0].entityId).toBe('target-789');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Resolving targets for scope: test-scope'
      );
    });

    it('should handle target resolution failures gracefully', () => {
      // Setup mock scope resolver to fail
      mockScopeResolver.resolve.mockReturnValue(
        ActionResult.failure(['Scope not found', 'Invalid query'])
      );

      const service = new MockTargetResolutionService({
        scopeResolver: mockScopeResolver,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      const result = service.resolveTargets(
        'invalid-scope',
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toBeFailedActionResult([
        'Scope not found',
        'Invalid query',
      ]);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should validate target access with location constraints', () => {
      const service = new MockTargetResolutionService({
        scopeResolver: mockScopeResolver,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      // Test accessible target (same location)
      const accessibleResult = service.validateTargetAccess(mockActor, [
        mockTarget,
      ]);
      expect(accessibleResult).toBeSuccessfulActionResultWithAnyValue();
      expect(accessibleResult.value[0].accessible).toBe(true);

      // Test inaccessible target (different location)
      const inaccessibleTarget = {
        ...mockTarget,
        id: 'distant-target',
        components: {
          ...mockTarget.components,
          'core:location': { currentLocation: 'distant-room' },
        },
      };
      mockEntityManager.addEntity(inaccessibleTarget);

      const inaccessibleResult = service.validateTargetAccess(mockActor, [
        inaccessibleTarget,
      ]);
      expect(inaccessibleResult).toBeFailedActionResultWithAnyError();
      expect(inaccessibleResult.errors[0].message).toContain(
        'not accessible from current location'
      );
    });

    it('should handle service exceptions and convert to ActionResults', () => {
      // Create a service that throws exceptions
      const throwingService = new MockTargetResolutionService({
        scopeResolver: {
          resolve() {
            throw new Error('Scope resolver internal error');
          },
        },
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      const result = throwingService.resolveTargets(
        'test-scope',
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toBeFailedActionResultWithAnyError();
      expect(result.errors[0].message).toContain('Target resolution error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Target resolution failed',
        expect.any(Error)
      );
    });

    it('should test getOrThrow and ifSuccess/ifFailure methods', () => {
      const service = new MockTargetResolutionService({
        scopeResolver: mockScopeResolver,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      // Test successful case with getOrThrow
      mockScopeResolver.resolve.mockReturnValue(
        ActionResult.success([mockTarget])
      );

      const successResult = service.resolveTargets(
        'test-scope',
        mockActor,
        mockDiscoveryContext
      );

      // Test getOrThrow
      expect(() => successResult.getOrThrow()).not.toThrow();
      const value = successResult.getOrThrow();
      expect(value).toHaveLength(1);

      // Test ifSuccess
      let successCallbackCalled = false;
      successResult.ifSuccess((val) => {
        successCallbackCalled = true;
        expect(val).toHaveLength(1);
      });
      expect(successCallbackCalled).toBe(true);

      // Test ifFailure (should not be called)
      let failureCallbackCalled = false;
      successResult.ifFailure(() => {
        failureCallbackCalled = true;
      });
      expect(failureCallbackCalled).toBe(false);

      // Test failure case
      mockScopeResolver.resolve.mockReturnValue(
        ActionResult.failure('Test error')
      );

      const failureResult = service.resolveTargets(
        'test-scope',
        mockActor,
        mockDiscoveryContext
      );

      // Test getOrThrow throws
      expect(() => failureResult.getOrThrow()).toThrow(
        'ActionResult failure: Test error'
      );

      // Test ifFailure
      let failureCallbackCalledOnFailure = false;
      failureResult.ifFailure((errors) => {
        failureCallbackCalledOnFailure = true;
        expect(errors).toHaveLength(1);
      });
      expect(failureCallbackCalledOnFailure).toBe(true);
    });
  });

  describe('Action Processing Service Integration', () => {
    it('should process actions end-to-end with ActionResult chains', () => {
      // Setup target resolver
      const targetResolver = new MockTargetResolutionService({
        scopeResolver: mockScopeResolver,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      mockScopeResolver.resolve.mockReturnValue(
        ActionResult.success([mockTarget])
      );

      const actionProcessor = new MockActionProcessingService({
        targetResolver,
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      const actionDefinition = {
        id: 'test-action',
        targetScope: 'nearby-actors',
        type: 'interaction',
      };

      const result = actionProcessor.processAction(
        actionDefinition,
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toBeSuccessfulActionResultWithAnyValue();
      expect(result.value.actionId).toBe('test-action');
      expect(result.value.actorId).toBe('actor-123');
      expect(result.value.targetResults).toHaveLength(1);
      expect(result.value.targetResults[0].targetId).toBe('target-789');
    });

    it('should handle validation failures in action processing', () => {
      const actionProcessor = new MockActionProcessingService({
        targetResolver: null, // Won't be used due to validation failure
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      const invalidAction = {
        // Missing id and targetScope
        type: 'invalid',
      };

      const result = actionProcessor.processAction(
        invalidAction,
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toBeFailedActionResult([
        'Action definition must have an ID',
        'Action definition must specify target scope',
      ]);
    });
  });
});
