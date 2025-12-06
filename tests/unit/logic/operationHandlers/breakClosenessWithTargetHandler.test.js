/**
 * @file Unit tests for BreakClosenessWithTargetHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BreakClosenessWithTargetHandler from '../../../../src/logic/operationHandlers/breakClosenessWithTargetHandler.js';
import * as movementUtils from '../../../../src/utils/movementUtils.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

// Mock dependencies
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');
jest.mock('../../../../src/errors/invalidArgumentError.js');
jest.mock('../../../../src/logic/services/closenessCircleService.js');

describe('BreakClosenessWithTargetHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };

    // Setup mock dispatcher
    mockDispatcher = {
      dispatch: jest.fn(),
    };

    // Setup mock closeness circle service
    closenessCircleService.repair = jest.fn((partners) => {
      // Mock the repair function to dedupe and sort
      return [...new Set(partners)].sort();
    });
    closenessCircleService.merge = jest.fn(); // Required by constructor validation

    // Setup execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };

    // Create handler instance
    handler = new BreakClosenessWithTargetHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService: closenessCircleService,
    });

    // Setup default mocks
    contextVariableUtils.tryWriteContextVariable.mockReturnValue({
      success: true,
    });

    // Setup error class mock
    InvalidArgumentError.mockImplementation((message) => {
      const error = new Error(message);
      error.name = 'InvalidArgumentError';
      return error;
    });
  });

  describe('Parameter Validation', () => {
    it('should reject missing actor_id', async () => {
      const parameters = {
        target_id: 'target1',
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should reject missing target_id', async () => {
      const parameters = {
        actor_id: 'actor1',
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should reject when actor_id equals target_id', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'actor1',
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should reject blank actor_id', async () => {
      const parameters = {
        actor_id: '   ',
        target_id: 'target1',
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should reject blank target_id', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: '   ',
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Single Partner Scenario - Component Removal', () => {
    it('should remove closeness component from actor when target is only partner', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      // Actor has only target as partner
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['target1'] };
          }
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);

      // Actor component should be removed (empty partners)
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'actor1',
        'positioning:closeness'
      );

      // Target component should be removed (empty partners)
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'target1',
        'positioning:closeness'
      );

      // Should not call addComponent for either entity
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();

      // Movement unlock no longer performed when breaking closeness
    });

    it('should dispatch success event after removing components', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:closeness') {
            return { partners: [entityId === 'actor1' ? 'target1' : 'actor1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'positioning:closeness_with_target_broken',
        expect.objectContaining({
          actorId: 'actor1',
          targetId: 'target1',
        })
      );
    });
  });

  describe('Multi-Partner Scenario - Component Preservation', () => {
    it('should preserve actor closeness when other partners remain', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      // Actor has multiple partners
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['partner2', 'target1'] };
          }
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);

      // Actor component should be updated (still has partner2)
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor1',
        'positioning:closeness',
        { partners: ['partner2'] }
      );

      // Target component should be removed (no partners left)
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'target1',
        'positioning:closeness'
      );

      // Movement unlock no longer performed when breaking closeness
    });

    it('should preserve target closeness when other partners remain', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      // Both have multiple partners
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['target1'] };
          }
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1', 'partner3'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);

      // Actor component should be removed (no partners left)
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'actor1',
        'positioning:closeness'
      );

      // Target component should be updated (still has partner3)
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'target1',
        'positioning:closeness',
        { partners: ['partner3'] }
      );

      // Target movement should NOT be unlocked (still has partners)
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalledWith(
        mockEntityManager,
        'target1',
        false
      );
    });

    it('should handle both entities having multiple partners', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['partner2', 'target1'] };
          }
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1', 'partner3'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);

      // Both components should be updated, not removed
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor1',
        'positioning:closeness',
        { partners: ['partner2'] }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'target1',
        'positioning:closeness',
        { partners: ['partner3'] }
      );

      // Neither should be removed
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();

      // Neither should have movement unlocked
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalledWith(
        mockEntityManager,
        'actor1',
        false
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalledWith(
        mockEntityManager,
        'target1',
        false
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle actor with no closeness component gracefully', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor has no closeness component'),
        expect.any(Object)
      );
    });

    it('should handle target with no closeness component gracefully', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['target1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Target has no closeness component'),
        expect.any(Object)
      );
    });

    it('should handle actor with invalid partners array', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: 'not-an-array' };
          }
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid partners array'),
        expect.any(Object)
      );
    });

    it('should use closeness circle service repair function', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'actor1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['target1', 'partner2', 'partner2'] }; // Duplicates
          }
          if (
            entityId === 'target1' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['actor1'] };
          }
          return undefined;
        }
      );

      await handler.execute(parameters, executionContext);

      // Repair should be called to dedupe and sort
      expect(closenessCircleService.repair).toHaveBeenCalled();
    });
  });

  describe('Result Variable Handling', () => {
    it('should write success to result variable when provided', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
        result_variable: 'breakResult',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:closeness') {
            return { partners: [entityId === 'actor1' ? 'target1' : 'actor1'] };
          }
          return undefined;
        }
      );

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'breakResult',
        true,
        executionContext,
        mockDispatcher,
        expect.any(Object)
      );
    });

    it('should write failure to result variable on error', async () => {
      const parameters = {
        actor_id: '',
        target_id: 'target1',
        result_variable: 'breakResult',
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'breakResult',
        false,
        executionContext,
        mockDispatcher,
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should dispatch error event on failure', async () => {
      const parameters = {
        actor_id: '',
        target_id: 'target1',
      };

      await handler.execute(parameters, executionContext);

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'Break closeness with target failed',
        expect.objectContaining({
          actorId: '',
          targetId: 'target1',
        }),
        expect.any(Object)
      );
    });

    it('should log error with operation context', async () => {
      const parameters = {
        actor_id: 'actor1',
        target_id: 'target1',
      };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Component lookup failed');
      });

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Break closeness with target failed'),
        expect.objectContaining({
          actorId: 'actor1',
          targetId: 'target1',
          error: 'Component lookup failed',
        })
      );
    });
  });
});
