/**
 * @file Test suite to cover the behavior of QueryEntitiesHandler.
 * @see tests/logic/operationHandlers/queryEntitiesHandler.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import QueryEntitiesHandler from '../../../../src/logic/operationHandlers/queryEntitiesHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

// 1. Test Harness Setup
/**
 * Creates a mock IEntityManager.
 *
 * @returns {import('../../../../src/interfaces/IEntityManager.js').IEntityManager}
 */
const makeMockEntityManager = () => {
  const manager = {
    activeEntities: new Map(),
    getEntitiesInLocation: jest.fn(),
    hasComponent: jest.fn(),
    getComponentData: jest.fn(),
    getEntityInstance: jest.fn(),
    createEntityInstance: jest.fn(),
    getEntitiesWithComponent: jest.fn(),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
  };
  Object.defineProperty(manager, 'entities', {
    get() {
      // Return an array of entity objects with id fields matching the keys in activeEntities
      return Array.from(manager.activeEntities.keys()).map((id) => ({ id }));
    },
    enumerable: true,
    configurable: true,
  });
  return manager;
};

/**
 * Creates a mock ILogger.
 *
 * @returns {import('../../../../src/interfaces/coreServices.js').ILogger}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock JsonLogicEvaluationService.
 *
 * @returns {import('../../../../src/logic/jsonLogicEvaluationService.js').default}
 */
const makeMockJsonLogicService = () => ({
  evaluate: jest.fn(),
  addOperation: jest.fn(), // Include other methods for a complete mock
});

describe('QueryEntitiesHandler', () => {
  let mockEntityManager;
  let mockLogger;
  let mockJsonLogicService;
  let handler;
  let mockExecutionContext;
  let dispatcher;

  beforeEach(() => {
    // 2. Create Mocks and Handler Instance
    mockEntityManager = makeMockEntityManager();
    mockLogger = makeMockLogger();
    mockJsonLogicService = makeMockJsonLogicService();
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    // Prepare a default set of active entities for tests
    mockEntityManager.activeEntities = new Map([
      ['ent_player', {}],
      ['ent_goblin_1', {}],
      ['ent_goblin_2', {}],
      ['ent_chest', {}],
      ['ent_dragon', {}],
    ]);

    handler = new QueryEntitiesHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      safeEventDispatcher: dispatcher,
    });

    // 3. Prepare mock execution context
    mockExecutionContext = {
      evaluationContext: {
        context: {},
      },
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 4. Tests for Individual Filters
  describe('Individual Filters', () => {
    test('should filter entities by location using "by_location"', () => {
      // Arrange
      const locationId = 'loc_dungeon_room_1';
      const entitiesInLocation = new Set(['ent_goblin_1', 'ent_chest']);
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        entitiesInLocation
      );
      const params = {
        result_variable: 'found_entities',
        filters: [{ by_location: locationId }],
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.getEntitiesInLocation).toHaveBeenCalledWith(
        locationId
      );
      const result =
        mockExecutionContext.evaluationContext.context.found_entities;
      expect(result).toEqual(
        expect.arrayContaining(['ent_goblin_1', 'ent_chest'])
      );
      expect(result.length).toBe(2);
    });

    test('should filter entities by component presence using "with_component"', () => {
      // Arrange
      const componentType = 'core:monster';
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, compType) => {
          return (
            compType === componentType &&
            (entityId === 'ent_goblin_1' || entityId === 'ent_goblin_2')
          );
        }
      );
      const params = {
        result_variable: 'monsters',
        filters: [{ with_component: componentType }],
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'ent_goblin_1',
        componentType
      );
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'ent_goblin_2',
        componentType
      );
      const result = mockExecutionContext.evaluationContext.context.monsters;
      expect(result).toEqual(
        expect.arrayContaining(['ent_goblin_1', 'ent_goblin_2'])
      );
      expect(result.length).toBe(2);
    });

    test('should filter by component data where jsonLogic evaluation is true using "with_component_data"', () => {
      // Arrange
      const componentType = 'core:health';
      const condition = { '<': [{ var: 'current' }, 10] };
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, compType) => {
          if (compType === componentType && entityId === 'ent_goblin_1')
            return { current: 5, max: 20 };
          return undefined; // Other entities don't have the component
        }
      );
      mockJsonLogicService.evaluate.mockReturnValue(true);
      const params = {
        result_variable: 'injured_entities',
        filters: [
          { with_component_data: { component_type: componentType, condition } },
        ],
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'ent_goblin_1',
        componentType
      );
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(condition, {
        current: 5,
        max: 20,
      });
      const result =
        mockExecutionContext.evaluationContext.context.injured_entities;
      expect(result).toEqual(['ent_goblin_1']);
    });

    test('should exclude entities where jsonLogic evaluation is false using "with_component_data"', () => {
      // Arrange
      const componentType = 'core:health';
      const condition = { '>': [{ var: 'current' }, 100] };
      mockEntityManager.getComponentData.mockReturnValue({
        current: 5,
        max: 20,
      });
      mockJsonLogicService.evaluate.mockReturnValue(false); // The condition is not met
      const params = {
        result_variable: 'super_healthy_entities',
        filters: [
          { with_component_data: { component_type: componentType, condition } },
        ],
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result =
        mockExecutionContext.evaluationContext.context.super_healthy_entities;
      expect(result).toEqual([]);
    });
  });

  // 5. Tests for Filter Combinations
  describe('Filter Combinations', () => {
    test('should return the intersection of multiple filters (by_location and with_component)', () => {
      // Arrange
      const locationId = 'loc_lair';
      const componentType = 'core:lootable';
      // Goblins and chest are in the lair
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['ent_goblin_1', 'ent_goblin_2', 'ent_chest'])
      );
      // Only the chest is lootable
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, compType) =>
          compType === componentType && entityId === 'ent_chest'
      );

      const params = {
        result_variable: 'final_set',
        filters: [
          { by_location: locationId },
          { with_component: componentType },
        ],
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.final_set;
      expect(result).toEqual(['ent_chest']);
    });
  });

  // 6. Test for the 'limit' Parameter
  describe('Limit Parameter', () => {
    test('should limit the number of results when limit parameter is provided', () => {
      // Arrange
      // All 5 active entities will match this filter
      mockEntityManager.hasComponent.mockReturnValue(true);
      const params = {
        result_variable: 'limited_results',
        filters: [{ with_component: 'core:exists' }],
        limit: 2,
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result =
        mockExecutionContext.evaluationContext.context.limited_results;
      expect(result.length).toBe(2);
      // Check that the logger reported the limit application
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Applied limit: 2.')
      );
    });
  });

  // 7. Tests for Edge Cases
  describe('Edge Cases', () => {
    test('should return an empty array if no entities match the filters', () => {
      // Arrange
      mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set()); // No one is here
      const params = {
        result_variable: 'no_one_home',
        filters: [{ by_location: 'loc_empty_void' }],
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.no_one_home;
      expect(result).toEqual([]);
    });

    test('should return all active entities if the filters array is empty', () => {
      // Arrange
      const params = {
        result_variable: 'all_entities',
        filters: [], // No filters
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result =
        mockExecutionContext.evaluationContext.context.all_entities;
      expect(result.length).toBe(5);
      expect(result).toEqual(
        expect.arrayContaining(
          Array.from(mockEntityManager.entities).map((e) => e.id)
        )
      );
    });

    test('should log a warning and return early if "result_variable" is missing', () => {
      // Arrange
      const params = { filters: [] }; // Missing result_variable

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'QUERY_ENTITIES: Missing or invalid "result_variable" parameter.'
      );
      expect(mockExecutionContext.evaluationContext.context).toEqual({}); // Nothing should be added
    });

    test('should log a warning and return early if "filters" is missing', () => {
      // Arrange
      const params = { result_variable: 'my_var' }; // Missing filters

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'QUERY_ENTITIES: Missing or invalid "filters" array parameter.'
      );
      expect(mockExecutionContext.evaluationContext.context).toEqual({});
    });

    test('should log a warning and skip an invalid filter', () => {
      // Arrange
      const params = {
        result_variable: 'should_be_all',
        filters: [{ by_location: null }], // Invalid value for the filter
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "QUERY_ENTITIES: Invalid value for 'by_location' filter. Skipping."
      );
      // The invalid filter is skipped, so all entities should be returned
      const result =
        mockExecutionContext.evaluationContext.context.should_be_all;
      expect(result.length).toBe(5);
    });

    test('should dispatch an error when context for storage is missing', () => {
      mockExecutionContext.evaluationContext.context = null;
      const params = {
        result_variable: 'x',
        filters: [],
      };

      handler.execute(params, mockExecutionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Cannot store result'),
          details: { resultVariable: 'x' },
        })
      );
    });
  });
});
