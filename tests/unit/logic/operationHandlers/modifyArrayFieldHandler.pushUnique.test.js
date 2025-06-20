import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import ModifyArrayFieldHandler from '../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import { resolveEntityId } from '../../../../src/utils/entityRefUtils.js';

// Mock the entire module
jest.mock('../../../../src/utils/entityRefUtils.js');

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeEntityManager = () => {
  const components = {}; // In-memory store: entityId -> componentType -> data

  return {
    // A test-only method to seed the component store
    _setComponent(entityId, componentType, data) {
      if (!components[entityId]) {
        components[entityId] = {};
      }
      // Store a deep copy to simulate real behavior where methods return copies
      components[entityId][componentType] = JSON.parse(JSON.stringify(data));
    },
    getComponentData: jest.fn((entityId, componentType) => {
      if (components[entityId] && components[entityId][componentType]) {
        // Return a deep copy to prevent tests from modifying the "database" directly
        return JSON.parse(JSON.stringify(components[entityId][componentType]));
      }
      return undefined;
    }),
    addComponent: jest.fn((entityId, componentType, data) => {
      if (!components[entityId]) {
        components[entityId] = {};
      }
      // addComponent in the real implementation replaces the component
      components[entityId][componentType] = data;
    }),
    _getComponentDataDirect: (entityId, componentType) => {
      return components[entityId]?.[componentType];
    },
  };
};

const makeDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('ModifyArrayFieldHandler', () => {
  let logger;
  let entityManager;
  let dispatcher;
  let handler;
  let executionContext;

  beforeEach(() => {
    logger = makeLogger();
    entityManager = makeEntityManager();
    dispatcher = makeDispatcher();
    handler = new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: dispatcher,
    });
    executionContext = { logger, variables: new Map() };
    // Clear mock history before each test
    jest.clearAllMocks();
    // Provide a default mock implementation for resolveEntityId
    resolveEntityId.mockImplementation((ref) => {
      if (typeof ref === 'object' && ref.entityId) return ref.entityId;
      return ref;
    });
  });

  describe('push_unique mode', () => {
    const entityId = 'player';
    const componentType = 'core:inventory';
    const field = 'items';

    test('should add a primitive value to an empty array', () => {
      // Arrange
      entityManager._setComponent(entityId, componentType, { [field]: [] });
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field,
        mode: 'push_unique',
        value: 'sword',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      const expectedData = { [field]: ['sword'] };
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        componentType,
        expectedData
      );

      const finalData = entityManager._getComponentDataDirect(
        entityId,
        componentType
      );
      expect(finalData[field]).toHaveLength(1);
      expect(finalData[field]).toContain('sword');
    });

    test('should not add a duplicate primitive value', () => {
      // Arrange
      entityManager._setComponent(entityId, componentType, {
        [field]: ['sword', 'shield'],
      });
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field,
        mode: 'push_unique',
        value: 'sword',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      const expectedData = { [field]: ['sword', 'shield'] };
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        componentType,
        expectedData
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already exists in array')
      );

      const finalData = entityManager._getComponentDataDirect(
        entityId,
        componentType
      );
      expect(finalData[field]).toHaveLength(2);
    });

    test('should add an object value to an empty array', () => {
      // Arrange
      entityManager._setComponent(entityId, componentType, { [field]: [] });
      const potion = { id: 'potion_health', quantity: 1 };
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field,
        mode: 'push_unique',
        value: potion,
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      const expectedData = { [field]: [potion] };
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        componentType,
        expectedData
      );

      const finalData = entityManager._getComponentDataDirect(
        entityId,
        componentType
      );
      expect(finalData[field]).toHaveLength(1);
      expect(finalData[field][0]).toEqual(potion);
    });

    test('should not add a duplicate object value', () => {
      // Arrange
      const potion = { id: 'potion_health', quantity: 1 };
      entityManager._setComponent(entityId, componentType, {
        [field]: [potion],
      });
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field,
        mode: 'push_unique',
        // A new object with the same value, but different reference
        value: { id: 'potion_health', quantity: 1 },
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      const expectedData = { [field]: [potion] };
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        componentType,
        expectedData
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already exists in array')
      );

      const finalData = entityManager._getComponentDataDirect(
        entityId,
        componentType
      );
      expect(finalData[field]).toHaveLength(1);
    });

    test('should add a new object if it is different from existing ones', () => {
      // Arrange
      const existingPotion = { id: 'potion_health', quantity: 1 };
      const newPotion = { id: 'potion_mana', quantity: 5 };
      entityManager._setComponent(entityId, componentType, {
        [field]: [existingPotion],
      });
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field,
        mode: 'push_unique',
        value: newPotion,
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      const expectedData = { [field]: [existingPotion, newPotion] };
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        componentType,
        expectedData
      );

      const finalData = entityManager._getComponentDataDirect(
        entityId,
        componentType
      );
      expect(finalData[field]).toHaveLength(2);
      expect(finalData[field]).toContainEqual(newPotion);
    });

    test('should warn and do nothing if value is missing', () => {
      // Arrange
      entityManager._setComponent(entityId, componentType, {
        [field]: ['item1'],
      });
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field,
        mode: 'push_unique',
        // no value
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: 'push_unique' mode requires a 'value' parameter."
      );
      expect(entityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('General Error Handling', () => {
    test('should warn and exit if component does not exist', () => {
      // Arrange
      const params = {
        entity_ref: 'non_existent_entity',
        component_type: 'core:inventory',
        field: 'items',
        mode: 'push_unique',
        value: 'some_item',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Component 'core:inventory' not found on entity 'non_existent_entity'."
      );
      expect(entityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should warn and exit if field path does not resolve to an array', () => {
      // Arrange
      const entityId = 'player';
      const componentType = 'core:stats';
      entityManager._setComponent(entityId, componentType, {
        name: 'Bob',
        stats: { strength: 10 },
      });
      const params = {
        entity_ref: entityId,
        component_type: componentType,
        field: 'stats.strength', // This is a number, not an array
        mode: 'push_unique',
        value: 5,
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "MODIFY_ARRAY_FIELD: Field path 'stats.strength' in component 'core:stats' on entity 'player' does not point to an array."
      );
      expect(entityManager.addComponent).not.toHaveBeenCalled();
    });
  });
});
