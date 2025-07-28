/**
 * @file Integration tests for ModifyArrayFieldHandler
 * @description Comprehensive integration tests to achieve full coverage,
 * testing real system interactions that unit tests cannot cover.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

// Core system components
import EventBus from '../../../../src/events/eventBus.js';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import ModifyArrayFieldHandler from '../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';

// Test utilities
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createSimpleMockDataRegistry } from '../../../common/mockFactories.js';

describe('ModifyArrayFieldHandler - Integration Tests', () => {
  let eventBus;
  let entityManager;
  let operationRegistry;
  let operationInterpreter;
  let systemLogicInterpreter;
  let jsonLogicService;
  let handler;
  let mockLogger;
  let mockDispatcher;
  let executionContext;
  let dataRegistry;

  const ENTITY_ID = 'test_entity';
  const COMPONENT_TYPE = 'core:inventory';

  beforeEach(() => {
    // Create logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create event bus and dispatcher
    eventBus = new EventBus();
    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    // Create entity manager with test data
    entityManager = new SimpleEntityManager();

    // Add test entity with component
    entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, {
      items: ['sword', 'shield'],
      nested: {
        equipment: ['helmet', 'boots'],
      },
    });

    // Create operation system
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry,
    });
    jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });

    // Create handler and register it
    handler = new ModifyArrayFieldHandler({
      entityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    operationRegistry.register(
      'MODIFY_ARRAY_FIELD',
      handler.execute.bind(handler)
    );

    // Setup data registry
    dataRegistry = createSimpleMockDataRegistry();
    dataRegistry.getAllSystemRules = jest.fn().mockReturnValue([]);

    // Create system logic interpreter
    systemLogicInterpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus,
      dataRegistry,
      jsonLogicEvaluationService: jsonLogicService,
      entityManager,
      operationInterpreter,
      bodyGraphService: {
        hasPartWithComponentValue: jest.fn().mockReturnValue({ found: false }),
      },
    });

    // Create execution context
    executionContext = {
      evaluationContext: {
        actor: { id: 'actor_1' },
        target: { id: 'target_1' },
        context: {},
      },
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full System Integration', () => {
    test('should handle component not found in real entity manager', async () => {
      const params = {
        entity_ref: 'nonexistent_entity',
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 52-55: Component not found warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Component '${COMPONENT_TYPE}' not found on entity 'nonexistent_entity'.`
      );
    });

    test('should handle non-array field in real component data', async () => {
      // Add component with non-array field
      entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, {
        items: 'not_an_array',
      });

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'new_item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 60-63: Non-array field warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Field path 'items' in component '${COMPONENT_TYPE}' on entity '${ENTITY_ID}' does not point to an array.`
      );
    });

    test('should successfully modify array and persist changes', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'magic_wand',
      };

      await handler.execute(params, executionContext);

      // Verify the change persisted in the entity manager
      const updatedComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(updatedComponent.items).toEqual(['sword', 'shield', 'magic_wand']);
    });

    test('should handle nested field paths with real data structures', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'nested.equipment',
        mode: 'push',
        value: 'gauntlets',
      };

      await handler.execute(params, executionContext);

      const updatedComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(updatedComponent.nested.equipment).toEqual([
        'helmet',
        'boots',
        'gauntlets',
      ]);
    });
  });

  describe('Error Handling Integration', () => {
    test('should dispatch error event when addComponent fails', async () => {
      // Mock addComponent to throw an error
      const originalAddComponent = entityManager.addComponent;
      entityManager.addComponent = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'cursed_item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 152-161: Error dispatching
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

      // Restore original method
      entityManager.addComponent = originalAddComponent;
    });

    test('should not write result variable when commit fails', async () => {
      // Mock addComponent to throw an error
      const originalAddComponent = entityManager.addComponent;
      entityManager.addComponent = jest.fn().mockImplementation(() => {
        throw new Error('Save failed');
      });

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'failed_item',
        result_variable: 'failed_result',
      };

      await handler.execute(params, executionContext);

      // Covers line 332: Early return when commitChanges fails
      expect(
        executionContext.evaluationContext.context.failed_result
      ).toBeUndefined();

      // Restore original method
      entityManager.addComponent = originalAddComponent;
    });
  });

  describe('Parameter Validation Integration', () => {
    test('should handle null params in real execution context', async () => {
      const spy = jest.spyOn(entityManager, 'getComponentData');
      await handler.execute(null, executionContext);

      // Covers line 183: Non-object params validation
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('should handle undefined params in real execution context', async () => {
      await handler.execute(undefined, executionContext);

      // Covers line 183: Non-object params validation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: params missing or invalid.',
        { params: undefined }
      );
    });

    test('should validate empty field parameter', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: '',
        mode: 'push',
        value: 'item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 208-211: Field validation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${ENTITY_ID}.`
      );
    });

    test('should validate whitespace-only field parameter', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: '   ',
        mode: 'push',
        value: 'item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 208-211: Field validation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Missing required parameters (component_type, field, or mode) for entity ${ENTITY_ID}.`
      );
    });

    test('should validate unknown mode parameter', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'unknown_mode',
        value: 'item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 217-218: Unknown mode validation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Unknown mode 'unknown_mode'."
      );
    });

    test('should validate missing value for push mode', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        // value is undefined
      };

      await handler.execute(params, executionContext);

      // Covers lines 225-228: Value validation for push
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push' mode requires a 'value' parameter."
      );
    });

    test('should validate missing value for push_unique mode', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push_unique',
        // value is undefined
      };

      await handler.execute(params, executionContext);

      // Covers lines 225-228: Value validation for push_unique
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push_unique' mode requires a 'value' parameter."
      );
    });

    test('should validate missing value for remove_by_value mode', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'remove_by_value',
        // value is undefined
      };

      await handler.execute(params, executionContext);

      // Covers lines 225-228: Value validation for remove_by_value
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'remove_by_value' mode requires a 'value' parameter."
      );
    });

    test('should validate empty result_variable parameter', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
        result_variable: '',
      };

      await handler.execute(params, executionContext);

      // Covers lines 235-238: Result variable validation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: "result_variable" must be a non-empty string when provided.'
      );
    });

    test('should validate non-string result_variable parameter', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
        result_variable: 123,
      };

      await handler.execute(params, executionContext);

      // Covers lines 235-238: Result variable validation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: "result_variable" must be a non-empty string when provided.'
      );
    });
  });

  describe('Execution Flow Integration', () => {
    test('should return early when validateParams fails', async () => {
      const params = {
        entity_ref: null, // This will cause validation to fail
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
      };

      const spy = jest.spyOn(entityManager, 'getComponentData');
      await handler.execute(params, executionContext);

      // Covers line 292: Early return when validateParams fails
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('should return early when fetchTargetArray fails', async () => {
      const params = {
        entity_ref: 'nonexistent_entity',
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item',
      };

      const spy = jest.spyOn(entityManager, 'addComponent');
      await handler.execute(params, executionContext);

      // Covers line 305: Early return when fetchTargetArray fails
      expect(spy).not.toHaveBeenCalled();
    });

    test('should return early when applyModification fails', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'invalid_mode',
        value: 'item',
      };

      const spy = jest.spyOn(entityManager, 'addComponent');
      await handler.execute(params, executionContext);

      // Covers line 319: Early return when applyModification fails
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Context Variable Integration', () => {
    test('should handle missing evaluationContext gracefully', async () => {
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

      // Covers lines 337-350: Early return when ensureEvaluationContext fails
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Stored result in context variable')
      );
    });

    test('should successfully write result variable with push operation', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'magic_staff',
        result_variable: 'updated_items',
      };

      await handler.execute(params, executionContext);

      // Covers lines 337-350: Successful context variable writing
      expect(executionContext.evaluationContext.context.updated_items).toEqual([
        'sword',
        'shield',
        'magic_staff',
      ]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Stored result in context variable 'updated_items'."
      );
    });

    test('should write correct result for pop operation', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'pop',
        result_variable: 'popped_item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 337-350: Pop result writing
      expect(executionContext.evaluationContext.context.popped_item).toBe(
        'shield'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Stored result in context variable 'popped_item'."
      );
    });
  });

  describe('Array Operation Debug Logging', () => {
    test('should log debug message when popping from empty array', async () => {
      // Create entity with empty array
      entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, {
        items: [],
      });

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'pop',
      };

      await handler.execute(params, executionContext);

      // Covers line 103: Pop empty array debug
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Attempted to 'pop' from an empty array on field 'items'."
      );
    });

    test('should log debug message when push_unique value already exists', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push_unique',
        value: 'sword', // Already exists in array
      };

      await handler.execute(params, executionContext);

      // Covers line 116: Push unique already exists debug
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Value for 'push_unique' already exists in array on field 'items'."
      );
    });

    test('should log debug message when remove_by_value value not found', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'remove_by_value',
        value: 'nonexistent_item',
      };

      await handler.execute(params, executionContext);

      // Covers line 122: Remove by value not found debug
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Value for 'remove_by_value' not found in array on field 'items'."
      );
    });
  });

  describe('Mode Validation in Apply Modification', () => {
    test('should handle unknown mode in applyModification method', async () => {
      // Create a handler that bypasses initial validation to reach applyModification
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'completely_unknown_mode',
        value: 'item',
      };

      await handler.execute(params, executionContext);

      // Covers lines 88-89: Unknown mode in applyModification
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Unknown mode 'completely_unknown_mode'."
      );
    });

    test('should handle missing value in applyModification for push', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        // value is undefined - this tests the validation in applyModification
      };

      await handler.execute(params, executionContext);

      // Covers lines 96-99: Missing value validation in applyModification
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push' mode requires a 'value' parameter."
      );
    });

    test('should cover line 319 when applyModification returns null', async () => {
      // This test specifically targets line 319 by ensuring applyModification returns null
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push_unique',
        // No value provided to force applyModification to return null
      };

      const spy = jest.spyOn(entityManager, 'addComponent');
      await handler.execute(params, executionContext);

      // Covers line 319: Early return when applyModification returns null
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Cross-System Integration', () => {
    test('should work within system logic interpreter framework', async () => {
      // Setup a rule that uses MODIFY_ARRAY_FIELD
      const rule = {
        rule_id: 'test_array_modification',
        event_type: 'test:modify_array',
        actions: [
          {
            type: 'MODIFY_ARRAY_FIELD',
            parameters: {
              entity_ref: { entityId: ENTITY_ID },
              component_type: COMPONENT_TYPE,
              field: 'items',
              mode: 'push',
              value: 'system_added_item',
            },
          },
        ],
      };

      dataRegistry.getAllSystemRules.mockReturnValue([rule]);
      systemLogicInterpreter.initialize();

      // Trigger the event
      await eventBus.dispatch('test:modify_array', {});

      // Verify the modification happened
      const updatedComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(updatedComponent.items).toContain('system_added_item');
    });

  });

  describe('Field Path Integration', () => {
    test('should handle complex nested field paths', async () => {
      // Setup deeply nested structure
      entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, {
        player: {
          inventory: {
            bags: {
              main: ['coin', 'key'],
            },
          },
        },
      });

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'player.inventory.bags.main',
        mode: 'push',
        value: 'potion',
      };

      await handler.execute(params, executionContext);

      const updatedComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(updatedComponent.player.inventory.bags.main).toEqual([
        'coin',
        'key',
        'potion',
      ]);
    });

    test('should trim field parameter and handle whitespace', async () => {
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: '  items  ', // Field with surrounding whitespace
        mode: 'push',
        value: 'trimmed_item',
      };

      await handler.execute(params, executionContext);

      const updatedComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(updatedComponent.items).toContain('trimmed_item');
    });
  });
});
