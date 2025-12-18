/**
 * @file Unit tests for IfCoLocatedHandler
 * @see tests/unit/logic/operationHandlers/ifCoLocatedHandler.test.js
 */

import IfCoLocatedHandler from '../../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import { POSITION_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';

describe('IfCoLocatedHandler', () => {
  let mockEntityManager;
  let mockOperationInterpreter;
  let mockSafeEventDispatcher;
  let mockLogger;
  let handler;
  let executionContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockOperationInterpreter = {
      execute: jest.fn().mockResolvedValue(true),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    executionContext = {
      evaluationContext: {
        context: {},
        actor: { id: 'actor-123' },
        target: { id: 'target-456' },
      },
      logger: mockLogger,
    };

    handler = new IfCoLocatedHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      operationInterpreter: mockOperationInterpreter,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create handler with valid dependencies', () => {
      expect(handler).toBeInstanceOf(IfCoLocatedHandler);
      expect(handler.logger).toBeDefined();
    });

    test('should validate required dependencies', () => {
      expect(() => {
        new IfCoLocatedHandler({
          logger: mockLogger,
          entityManager: null,
          operationInterpreter: mockOperationInterpreter,
          safeEventDispatcher: mockSafeEventDispatcher,
        });
      }).toThrow();
    });

    test('should accept lazy resolver function for operationInterpreter', async () => {
      // Create a lazy resolver function that returns the mock interpreter
      const lazyResolver = () => mockOperationInterpreter;

      const handlerWithResolver = new IfCoLocatedHandler({
        logger: mockLogger,
        entityManager: mockEntityManager,
        operationInterpreter: lazyResolver,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      expect(handlerWithResolver).toBeInstanceOf(IfCoLocatedHandler);

      // Verify it works by executing with co-located entities
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [{ type: 'TEST_ACTION', params: {} }],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handlerWithResolver.execute(params, executionContext);

      // The lazy resolver should be invoked and execute nested operations
      expect(mockOperationInterpreter.execute).toHaveBeenCalled();
    });
  });

  describe('Parameter Validation', () => {
    test('should handle null params', async () => {
      await handler.execute(null, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params missing or invalid'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should handle undefined params', async () => {
      await handler.execute(undefined, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params missing or invalid'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should handle non-object params', async () => {
      await handler.execute('invalid', executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params missing or invalid'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should require entity_ref_a', async () => {
      const params = {
        entity_ref_b: 'entity-2',
        then_actions: [],
      };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'IF_CO_LOCATED: entity_ref_a and entity_ref_b are required',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should require entity_ref_b', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        then_actions: [],
      };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'IF_CO_LOCATED: entity_ref_a and entity_ref_b are required',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should handle empty string entity references', async () => {
      const params = {
        entity_ref_a: '',
        entity_ref_b: '',
        then_actions: [],
      };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'IF_CO_LOCATED: entity_ref_a and entity_ref_b are required',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Entity Reference Resolution', () => {
    test('should resolve string entity IDs', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-1',
        POSITION_COMPONENT_ID
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-2',
        POSITION_COMPONENT_ID
      );
    });

    test('should resolve "actor" keyword', async () => {
      const params = {
        entity_ref_a: 'actor',
        entity_ref_b: 'entity-2',
        then_actions: [],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-123',
        POSITION_COMPONENT_ID
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-2',
        POSITION_COMPONENT_ID
      );
    });

    test('should resolve "target" keyword', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'target',
        then_actions: [],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-1',
        POSITION_COMPONENT_ID
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target-456',
        POSITION_COMPONENT_ID
      );
    });

    test('should handle failed entity resolution', async () => {
      const params = {
        entity_ref_a: '   ', // Empty string that will fail resolution
        entity_ref_b: 'entity-2',
        then_actions: [],
      };

      await handler.execute(params, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('failed to resolve entity IDs')
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Co-location Logic', () => {
    test('should execute then_actions when entities are co-located', async () => {
      const thenAction = { type: 'TEST_ACTION', params: {} };
      const elseAction = { type: 'ELSE_ACTION', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [thenAction],
        else_actions: [elseAction],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        thenAction,
        executionContext
      );
      expect(mockOperationInterpreter.execute).not.toHaveBeenCalledWith(
        elseAction,
        executionContext
      );
    });

    test('should execute else_actions when entities are not co-located', async () => {
      const thenAction = { type: 'TEST_ACTION', params: {} };
      const elseAction = { type: 'ELSE_ACTION', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [thenAction],
        else_actions: [elseAction],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-2' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        elseAction,
        executionContext
      );
      expect(mockOperationInterpreter.execute).not.toHaveBeenCalledWith(
        thenAction,
        executionContext
      );
    });

    test('should handle entities with missing position components', async () => {
      const elseAction = { type: 'ELSE_ACTION', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        else_actions: [elseAction],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        elseAction,
        executionContext
      );
    });

    test('should handle entities with missing locationId', async () => {
      const elseAction = { type: 'ELSE_ACTION', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        else_actions: [elseAction],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ someOtherField: 'value' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        elseAction,
        executionContext
      );
    });

    test('should handle empty locationId', async () => {
      const elseAction = { type: 'ELSE_ACTION', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        else_actions: [elseAction],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: '' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        elseAction,
        executionContext
      );
    });
  });

  describe('Action Execution', () => {
    test('should handle empty then_actions array', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).not.toHaveBeenCalled();
    });

    test('should handle empty else_actions array', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        else_actions: [],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-2' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).not.toHaveBeenCalled();
    });

    test('should handle non-array actions gracefully', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: 'not-an-array',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).not.toHaveBeenCalled();
    });

    test('should execute multiple actions in sequence', async () => {
      const action1 = { type: 'ACTION_1', params: {} };
      const action2 = { type: 'ACTION_2', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [action1, action2],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledTimes(2);
      expect(mockOperationInterpreter.execute).toHaveBeenNthCalledWith(
        1,
        action1,
        executionContext
      );
      expect(mockOperationInterpreter.execute).toHaveBeenNthCalledWith(
        2,
        action2,
        executionContext
      );
    });

    test('should default to empty arrays when actions not provided', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      await handler.execute(params, executionContext);

      expect(mockOperationInterpreter.execute).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors when getting position components', async () => {
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        else_actions: [{ type: 'ELSE_ACTION', params: {} }],
      };

      const error = new Error('Database error');
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'IF_CO_LOCATED: error reading positions'
          ),
          details: expect.objectContaining({
            error: error.message,
            stack: error.stack,
          }),
        })
      );

      // Should default to not co-located (false) and execute else_actions
      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        { type: 'ELSE_ACTION', params: {} },
        executionContext
      );
    });

    test('should handle errors during action execution', async () => {
      const action1 = { type: 'ACTION_1', params: {} };
      const action2 = { type: 'ACTION_2', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [action1, action2],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      const error = new Error('Action execution failed');
      mockOperationInterpreter.execute
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(error);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'IF_CO_LOCATED: nested operation threw',
          details: expect.objectContaining({
            error: error.message,
            stack: error.stack,
            op: action2,
          }),
        })
      );

      // Should execute first action but stop at second due to error
      expect(mockOperationInterpreter.execute).toHaveBeenCalledTimes(2);
    });

    test('should handle action execution error with minimal error object', async () => {
      const action = { type: 'ACTION', params: {} };
      const params = {
        entity_ref_a: 'entity-1',
        entity_ref_b: 'entity-2',
        then_actions: [action],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location-1' })
        .mockReturnValueOnce({ locationId: 'location-1' });

      const error = {};
      mockOperationInterpreter.execute.mockRejectedValueOnce(error);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'IF_CO_LOCATED: nested operation threw',
          details: expect.objectContaining({
            error: undefined,
            stack: undefined,
            op: action,
          }),
        })
      );
    });
  });

  describe('Logger Integration', () => {
    test('should use execution context logger when available', async () => {
      const contextLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const contextWithLogger = {
        ...executionContext,
        logger: contextLogger,
      };

      const params = {
        entity_ref_a: '   ', // Empty string that will fail resolution
        entity_ref_b: 'entity-2',
      };

      await handler.execute(params, contextWithLogger);

      expect(contextLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('failed to resolve entity IDs')
      );
    });
  });
});
