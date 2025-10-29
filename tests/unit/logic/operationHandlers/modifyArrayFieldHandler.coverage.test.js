/**
 * @file Comprehensive test suite for ModifyArrayFieldHandler coverage gaps
 * @description Tests focused on achieving near-total coverage for validation,
 * error handling, and context edge cases that are not exercised by the primary
 * behavior suite.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import ModifyArrayFieldHandler from '../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';

/**
 * Creates a mock IEntityManager compliant with the interface.
 *
 * @returns {import('../../../../src/interfaces/IEntityManager.js').IEntityManager}
 */
const makeMockEntityManager = () => ({
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
  hasComponent: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  getEntityInstance: jest.fn(),
  createEntityInstance: jest.fn(),
  getEntitiesWithComponent: jest.fn(),
  removeComponent: jest.fn(),
});

/**
 * Creates a mock ILogger compliant with the interface.
 *
 * @returns {import('../../../../src/interfaces/coreServices.js').ILogger}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('ModifyArrayFieldHandler - Coverage Tests', () => {
  let mockEntityManager;
  let mockLogger;
  let handler;
  let mockExecutionContext;
  let mockDispatcher;

  const ENTITY_ID = 'ent_player';
  const COMPONENT_TYPE = 'core:inventory';

  beforeEach(() => {
    mockEntityManager = makeMockEntityManager();
    mockLogger = makeMockLogger();
    mockDispatcher = { dispatch: jest.fn() };
    handler = new ModifyArrayFieldHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    mockExecutionContext = {
      evaluationContext: {
        actor: { id: 'actor_id' },
        target: { id: 'target_id' },
        context: {},
      },
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Parameter Validation Edge Cases', () => {
    // Covers line 183: Non-object params
    test('should return early when params is not an object', async () => {
      await handler.execute(null, mockExecutionContext);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should return early when params is undefined', async () => {
      await handler.execute(undefined, mockExecutionContext);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // Covers lines 208-211: Invalid field/mode validation
    test('should warn when field is empty string', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: '',
        mode: 'push',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${ENTITY_ID}.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should warn when field is only whitespace', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: '   ',
        mode: 'push',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${ENTITY_ID}.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should warn when mode is empty string', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: '',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${ENTITY_ID}.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should warn when mode is only whitespace', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: '   ',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${ENTITY_ID}.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // Covers lines 235-238: Invalid result_variable validation
    test('should warn when result_variable is empty string', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
        result_variable: '',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: "result_variable" must be a non-empty string when provided.'
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should warn when result_variable is only whitespace', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
        result_variable: '   ',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: "result_variable" must be a non-empty string when provided.'
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should warn when result_variable is a number', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
        result_variable: 123,
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: "result_variable" must be a non-empty string when provided.'
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('Mode Validation Edge Cases', () => {
    // Covers lines 88-89: Unknown mode in #applyModification method
    test('should return null when mode is unknown in applyModification', async () => {
      const originalComponent = { items: ['a', 'b'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'unknown_mode',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Unknown mode 'unknown_mode'."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // Covers lines 96-99: Missing value validation in #applyModification
    test('should return null when value is undefined for push in applyModification', async () => {
      const originalComponent = { items: ['a', 'b'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        // value is undefined
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push' mode requires a 'value' parameter."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should return null when value is undefined for push_unique in applyModification', async () => {
      const originalComponent = { items: ['a', 'b'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push_unique',
        // value is undefined
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push_unique' mode requires a 'value' parameter."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should return null when value is undefined for remove_by_value in applyModification', async () => {
      const originalComponent = { items: ['a', 'b'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'remove_by_value',
        // value is undefined
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'remove_by_value' mode requires a 'value' parameter."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Scenarios', () => {
    // Covers lines 152-161: addComponent failure and error dispatching
    test('should dispatch error event when addComponent throws', async () => {
      const originalComponent = { items: ['a'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const error = new Error('Database connection failed');
      mockEntityManager.addComponent.mockRejectedValue(error);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        {
          message:
            'MODIFY_ARRAY_FIELD: Failed to commit changes via addComponent.',
          details: {
            error: 'Database connection failed',
            entityId: ENTITY_ID,
            componentType: COMPONENT_TYPE,
          },
        }
      );
    });

    test('should not attempt to write result variable when addComponent fails', async () => {
      const originalComponent = { items: ['a'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const error = new Error('Save failed');
      mockEntityManager.addComponent.mockRejectedValue(error);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
        result_variable: 'result',
      };

      await handler.execute(params, mockExecutionContext);

      // The result variable should not be set since addComponent failed
      expect(
        mockExecutionContext.evaluationContext.context.result
      ).toBeUndefined();
    });
  });

  describe('Execution Flow Edge Cases', () => {
    test('should return early before modification when mode is invalid', async () => {
      const originalComponent = { items: ['a'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'invalid_mode',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // Covers line 332: Early return when commitChanges fails
    test('should return early when commitChanges returns false', async () => {
      const originalComponent = { items: ['a'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      // Make addComponent fail
      mockEntityManager.addComponent.mockRejectedValue(
        new Error('Commit failed')
      );

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
        result_variable: 'result',
      };

      await handler.execute(params, mockExecutionContext);

      // Should not try to write to result variable since commit failed
      expect(
        mockExecutionContext.evaluationContext.context.result
      ).toBeUndefined();
    });

    // Covers line 340: Early return when ensureEvaluationContext fails
    test('should return early when ensureEvaluationContext fails', async () => {
      const originalComponent = { items: ['a'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      mockEntityManager.addComponent.mockResolvedValue();

      // Create an execution context without evaluationContext to trigger failure
      const invalidExecutionContext = {
        logger: mockLogger,
        // Missing evaluationContext
      };

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
        result_variable: 'result',
      };

      await handler.execute(params, invalidExecutionContext);

      // Should not try to write context variable
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Stored result in context variable')
      );
    });
  });

  describe('Context Variable Writing Edge Cases', () => {
    test('should handle successful context variable writing', async () => {
      const originalComponent = { items: [] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      mockEntityManager.addComponent.mockResolvedValue();

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
        result_variable: 'result',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Stored result in context variable 'result'."
      );
      expect(mockExecutionContext.evaluationContext.context.result).toEqual([
        'new_item',
      ]);
    });

    test('should handle context variable writing with pop operation result', async () => {
      const originalComponent = { items: ['first', 'second'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      mockEntityManager.addComponent.mockResolvedValue();

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'pop',
        result_variable: 'popped_item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Stored result in context variable 'popped_item'."
      );
      expect(mockExecutionContext.evaluationContext.context.popped_item).toBe(
        'second'
      );
    });
  });

  describe('Field Trimming Validation', () => {
    test('should trim field parameter and use trimmed value', async () => {
      const originalComponent = { items: [] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      mockEntityManager.addComponent.mockResolvedValue();

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: '  items  ', // Field with whitespace
        mode: 'push',
        value: 'item',
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ENTITY_ID,
        COMPONENT_TYPE,
        { items: ['item'] }
      );
    });

    test('should trim result_variable parameter and use trimmed value', async () => {
      const originalComponent = { items: [] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      mockEntityManager.addComponent.mockResolvedValue();

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
        result_variable: '  result  ', // Result variable with whitespace
      };

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Stored result in context variable 'result'."
      );
      expect(mockExecutionContext.evaluationContext.context.result).toEqual([
        'item',
      ]);
    });
  });
});
