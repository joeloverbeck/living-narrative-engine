/**
 * @file This file contains the test suite for ModifyArrayFieldHandler.
 * @see tests/logic/operationHandlers/modifyArrayFieldHandler.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import ModifyArrayFieldHandler from '../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';

/**
 * Creates a mock IEntityManager compliant with the interface.
 *
 * @returns {import('../../../src/interfaces/IEntityManager.js').IEntityManager}
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
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('ModifyArrayFieldHandler', () => {
  let mockEntityManager;
  let mockLogger;
  let handler;
  let mockExecutionContext;

  const ENTITY_ID = 'ent_player';
  const COMPONENT_TYPE = 'core:inventory';

  beforeEach(() => {
    mockEntityManager = makeMockEntityManager();
    mockLogger = makeMockLogger();
    handler = new ModifyArrayFieldHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
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

  describe('Setup & Validation', () => {
    test("constructor should throw an error if 'entityManager' dependency is missing", () => {
      expect(() => new ModifyArrayFieldHandler({ logger: mockLogger })).toThrow(
        "Dependency 'IEntityManager' with getComponentData and addComponent methods is required."
      );
    });

    test("constructor should throw an error if 'logger' dependency is missing", () => {
      expect(
        () => new ModifyArrayFieldHandler({ entityManager: mockEntityManager })
      ).toThrow("Dependency 'ILogger' with a 'warn' method is required.");
    });

    test('constructor should throw an error if dependencies are malformed', () => {
      const malformedEntityManager = { getComponentData: 'not a function' };
      const malformedLogger = { warn: 'not a function' };
      expect(
        () =>
          new ModifyArrayFieldHandler({
            entityManager: malformedEntityManager,
            logger: mockLogger,
          })
      ).toThrow();
      expect(
        () =>
          new ModifyArrayFieldHandler({
            entityManager: mockEntityManager,
            logger: malformedLogger,
          })
      ).toThrow();
    });

    test('execute should return early and log a warning if entity_ref cannot be resolved', () => {
      handler.execute({ entity_ref: null }, mockExecutionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_ARRAY_FIELD: Could not resolve entity_ref: null'
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should return early and log a warning if the target component does not exist', () => {
      mockEntityManager.getComponentData.mockReturnValue(undefined);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item_1',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Component '${COMPONENT_TYPE}' not found on entity '${ENTITY_ID}'.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should return early and log a warning if the field path does not resolve to an array', () => {
      const componentData = { items: { not: 'an array' } };
      mockEntityManager.getComponentData.mockReturnValue(componentData);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'item_1',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `MODIFY_ARRAY_FIELD: Field path 'items' in component '${COMPONENT_TYPE}' on entity '${ENTITY_ID}' does not point to an array.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should return early and warn for an unknown mode', () => {
      const originalComponent = { items: [1, 2, 3] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'INVALID_MODE',
        value: 1,
      };

      handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Unknown mode 'INVALID_MODE'."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('push Mode', () => {
    test('should add a primitive value to an empty array', () => {
      const originalComponent = { items: [] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'sword',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [entityId, compType, newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(entityId).toBe(ENTITY_ID);
      expect(compType).toBe(COMPONENT_TYPE);
      expect(newComponentData).toEqual({ items: ['sword'] });
      expect(newComponentData).not.toBe(originalComponent); // Verify clone-and-replace
    });

    test('should add an object to an existing array', () => {
      const originalComponent = { items: [{ id: 1, name: 'potion' }] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const newItem = { id: 2, name: 'elixir' };
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: newItem,
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({
        items: [
          { id: 1, name: 'potion' },
          { id: 2, name: 'elixir' },
        ],
      });
      expect(newComponentData).not.toBe(originalComponent);
    });

    test('should work on a nested array', () => {
      const originalComponent = { data: { effects: ['blessed'] } };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'data.effects',
        mode: 'push',
        value: 'cursed',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({
        data: { effects: ['blessed', 'cursed'] },
      });
      expect(newComponentData).not.toBe(originalComponent);
    });

    test('should store the entire modified array in result_variable', () => {
      const originalComponent = { items: ['apple'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
        value: 'orange',
        result_variable: 'inventory_state',
      };

      handler.execute(params, mockExecutionContext);

      expect(
        mockExecutionContext.evaluationContext.context.inventory_state
      ).toEqual(['apple', 'orange']);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Stored result in context variable 'inventory_state'."
      );
    });

    test('should return early and warn if value is not provided for push', () => {
      const originalComponent = { items: [1] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'push',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push' mode requires a 'value' parameter."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('pop Mode', () => {
    test('should remove the last item from a populated array and update the component', () => {
      const originalComponent = { items: ['a', 'b', 'c'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'pop',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({ items: ['a', 'b'] });
      expect(newComponentData).not.toBe(originalComponent);
    });

    test('should store the popped item in result_variable', () => {
      const originalComponent = { items: ['a', 'b', 'c'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'pop',
        result_variable: 'last_item',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockExecutionContext.evaluationContext.context.last_item).toBe(
        'c'
      );
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({ items: ['a', 'b'] });
    });

    test('pop on an empty array should not throw, results in undefined, and still calls addComponent', () => {
      const originalComponent = { items: [] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'pop',
        result_variable: 'popped_item',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Attempted to 'pop' from an empty array on field 'items'."
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({ items: [] });
      expect(
        mockExecutionContext.evaluationContext.context.popped_item
      ).toBeUndefined();
    });
  });

  describe('remove_by_value Mode', () => {
    test('should remove a primitive value that exists', () => {
      const originalComponent = { quest_ids: [101, 202, 303] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'quest_ids',
        mode: 'remove_by_value',
        value: 202,
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({ quest_ids: [101, 303] });
      expect(newComponentData).not.toBe(originalComponent);
    });

    test('should not change the array if value is not found', () => {
      const originalComponent = { quest_ids: [101, 202, 303] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'quest_ids',
        mode: 'remove_by_value',
        value: 999,
      };

      handler.execute(params, mockExecutionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Value for 'remove_by_value' not found in array on field 'quest_ids'."
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({ quest_ids: [101, 202, 303] });
    });

    test('should remove only the first occurrence of a duplicate value', () => {
      const originalComponent = { loot: ['gold', 'gem', 'gold', 'sword'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'loot',
        mode: 'remove_by_value',
        value: 'gold',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData).toEqual({ loot: ['gem', 'gold', 'sword'] });
    });

    test('should remove an object by reference (as per Array.indexOf behavior)', () => {
      const item1 = { id: 1 };
      const item2 = { id: 2 }; // This is what we will remove
      const item3 = { id: 3 };
      const originalComponent = { items: [item1, item2, item3] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'remove_by_value',
        value: item2, // Using the exact same object reference
      };

      handler.execute(params, mockExecutionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      const [, , newComponentData] =
        mockEntityManager.addComponent.mock.calls[0];
      expect(newComponentData.items).toEqual([item1, item3]); // `toEqual` does a deep comparison
      expect(newComponentData.items.length).toBe(2);
    });

    test('should return early and warn if value is not provided', () => {
      const originalComponent = { items: [1, 2, 3] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'remove_by_value',
      };

      handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'remove_by_value' mode requires a 'value' parameter."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should store the modified array in result_variable', () => {
      const originalComponent = { items: ['a', 'b', 'c'] };
      mockEntityManager.getComponentData.mockReturnValue(originalComponent);
      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'items',
        mode: 'remove_by_value',
        value: 'b',
        result_variable: 'items_after_removal',
      };

      handler.execute(params, mockExecutionContext);

      expect(
        mockExecutionContext.evaluationContext.context.items_after_removal
      ).toEqual(['a', 'c']);
    });
  });
});
