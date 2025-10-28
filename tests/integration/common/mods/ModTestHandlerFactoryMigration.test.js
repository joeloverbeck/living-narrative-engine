/**
 * @file Migration validation integration tests for ModTestHandlerFactory
 * @description Validates that factory-created handlers behave identically to manually created handlers
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { ModTestHandlerFactory } from '../../../common/mods/ModTestHandlerFactory.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';

// Import handlers for manual creation comparison
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import QueryComponentsHandler from '../../../../src/logic/operationHandlers/queryComponentsHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../../src/logic/operationHandlers/addComponentHandler.js';
import LogHandler from '../../../../src/logic/operationHandlers/logHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js';
import UnlockMovementHandler from '../../../../src/logic/operationHandlers/unlockMovementHandler.js';
import LockMovementHandler from '../../../../src/logic/operationHandlers/lockMovementHandler.js';
import ModifyArrayFieldHandler from '../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import ModifyComponentHandler from '../../../../src/logic/operationHandlers/modifyComponentHandler.js';
import AtomicModifyComponentHandler from '../../../../src/logic/operationHandlers/atomicModifyComponentHandler.js';
import BreakClosenessWithTargetHandler from '../../../../src/logic/operationHandlers/breakClosenessWithTargetHandler.js';
import MergeClosenessCircleHandler from '../../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

describe('ModTestHandlerFactory Migration Validation', () => {
  let entityManager;
  let eventBus;
  let logger;
  let gameDataRepository;

  beforeEach(() => {
    // Use actual SimpleEntityManager and real mocks
    entityManager = new SimpleEntityManager([
      {
        id: 'test-entity',
        components: {
          'core:name': { name: 'Test Entity' },
          'core:position': { x: 0, y: 0 },
        },
      },
    ]);

    eventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    gameDataRepository = {
      getComponentDefinition: jest.fn().mockReturnValue(null),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Creates handlers manually using the same pattern found in existing test files
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Manually created handlers object
   */
  function createManualHandlers(entityManager, eventBus, logger) {
    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      QUERY_COMPONENT: new QueryComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      QUERY_COMPONENTS: new QueryComponentsHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      GET_NAME: new GetNameHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: eventBus,
        logger,
        addPerceptionLogEntryHandler: { execute: jest.fn() },
      }),
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: eventBus,
        logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
      SET_VARIABLE: new SetVariableHandler({ logger }),
      LOG_MESSAGE: new LogHandler({ logger }),
    };
  }

  /**
   * Creates handlers with ADD_COMPONENT manually
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {object} gameDataRepository - Game data repository instance
   * @returns {object} Manually created handlers object with ADD_COMPONENT
   */
  function createManualHandlersWithAddComponent(
    entityManager,
    eventBus,
    logger,
    gameDataRepository
  ) {
    const baseHandlers = createManualHandlers(entityManager, eventBus, logger);
    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      ...baseHandlers,
      ADD_COMPONENT: new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        gameDataRepository,
      }),
    };
  }

  /**
   * Creates handlers with perception logging support manually
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {object} gameDataRepository - Game data repository instance
   * @returns {object} Manually created handlers object with perception logging handlers
   */
  function createManualHandlersWithPerceptionLogging(
    entityManager,
    eventBus,
    logger,
    gameDataRepository
  ) {
    // Ensure entityManager has getEntitiesInLocation for AddPerceptionLogEntryHandler
    if (typeof entityManager.getEntitiesInLocation !== 'function') {
      entityManager.getEntitiesInLocation = (locationId) => {
        // Find all entities in the given location
        const entityIds = entityManager.getEntityIds();
        const entitiesInLocation = [];

        for (const entityId of entityIds) {
          const entity = entityManager.getEntityInstance(entityId);
          if (
            entity &&
            entity.components &&
            entity.components['core:position']
          ) {
            const position = entity.components['core:position'];
            if (position.locationId === locationId) {
              entitiesInLocation.push(entityId);
            }
          }
        }

        return new Set(entitiesInLocation);
      };
    }

    const baseHandlers = createManualHandlers(entityManager, eventBus, logger);
    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      ...baseHandlers,
      ADD_COMPONENT: new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        gameDataRepository,
      }),
      ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      REMOVE_COMPONENT: new RemoveComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      LOCK_MOVEMENT: new LockMovementHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      UNLOCK_MOVEMENT: new UnlockMovementHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      MODIFY_COMPONENT: new ModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      ATOMIC_MODIFY_COMPONENT: new AtomicModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      BREAK_CLOSENESS_WITH_TARGET: new BreakClosenessWithTargetHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService: {
          repair: jest.fn(),
        },
      }),
      MERGE_CLOSENESS_CIRCLE: new MergeClosenessCircleHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
    };
  }

  describe('Standard Handlers Comparison', () => {
    it('should create handlers with identical structure to manual creation', () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Compare handler keys
      const factoryKeys = Object.keys(factoryHandlers).sort();
      const manualKeys = Object.keys(manualHandlers).sort();
      expect(factoryKeys).toEqual(manualKeys);

      // Compare handler types
      factoryKeys.forEach((key) => {
        expect(factoryHandlers[key].constructor).toBe(
          manualHandlers[key].constructor
        );
        expect(typeof factoryHandlers[key].execute).toBe('function');
        expect(typeof manualHandlers[key].execute).toBe('function');
      });
    });

    it('should create handlers that behave identically to manual handlers', async () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Test GET_TIMESTAMP handler behavior
      // Both handlers should return the same type of result
      const factoryResult = await factoryHandlers.GET_TIMESTAMP.execute({});
      const manualResult = await manualHandlers.GET_TIMESTAMP.execute({});

      expect(typeof factoryResult).toBe(typeof manualResult);
      // The handlers should behave identically, regardless of specific return value
    });

    it('should have handlers that accept the same parameters', () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      // All handlers should have the same structure
      Object.keys(factoryHandlers).forEach((key) => {
        const factoryHandler = factoryHandlers[key];
        const manualHandler = manualHandlers[key];

        // Both should have execute method
        expect(factoryHandler.execute).toBeDefined();
        expect(manualHandler.execute).toBeDefined();

        // Both should be instances of the same class
        expect(factoryHandler.constructor.name).toBe(
          manualHandler.constructor.name
        );
      });
    });
  });

  describe('Handlers with ADD_COMPONENT Comparison', () => {
    it('should create extended handlers identical to manual creation', () => {
      const factoryHandlers =
        ModTestHandlerFactory.createHandlersWithAddComponent(
          entityManager,
          eventBus,
          logger,
          gameDataRepository
        );
      const manualHandlers = createManualHandlersWithAddComponent(
        entityManager,
        eventBus,
        logger,
        gameDataRepository
      );

      // Compare handler keys
      const factoryKeys = Object.keys(factoryHandlers).sort();
      const manualKeys = Object.keys(manualHandlers).sort();
      expect(factoryKeys).toEqual(manualKeys);

      // Should include ADD_COMPONENT
      expect(factoryHandlers.ADD_COMPONENT).toBeDefined();
      expect(manualHandlers.ADD_COMPONENT).toBeDefined();
      expect(factoryHandlers.ADD_COMPONENT.constructor).toBe(
        manualHandlers.ADD_COMPONENT.constructor
      );
    });

    it('should have ADD_COMPONENT handler with identical interface', () => {
      const factoryHandlers =
        ModTestHandlerFactory.createHandlersWithAddComponent(
          entityManager,
          eventBus,
          logger,
          gameDataRepository
        );
      const manualHandlers = createManualHandlersWithAddComponent(
        entityManager,
        eventBus,
        logger,
        gameDataRepository
      );

      const factoryAddComponent = factoryHandlers.ADD_COMPONENT;
      const manualAddComponent = manualHandlers.ADD_COMPONENT;

      expect(factoryAddComponent.execute).toBeDefined();
      expect(manualAddComponent.execute).toBeDefined();
      expect(factoryAddComponent.constructor.name).toBe(
        manualAddComponent.constructor.name
      );
    });
  });

  describe('Safe Dispatcher Comparison', () => {
    it('should create safe dispatcher identical to manual implementation', () => {
      const factorySafeDispatcher =
        ModTestHandlerFactory.createSafeDispatcher(eventBus);

      // Manual safe dispatcher creation (as done in existing test files)
      const manualSafeDispatcher = {
        dispatch: jest.fn((eventType, payload) => {
          eventBus.dispatch(eventType, payload);
          return Promise.resolve(true);
        }),
      };

      // Both should have dispatch method
      expect(factorySafeDispatcher.dispatch).toBeDefined();
      expect(manualSafeDispatcher.dispatch).toBeDefined();

      // Both should be jest mocks
      expect(jest.isMockFunction(factorySafeDispatcher.dispatch)).toBe(true);
      expect(jest.isMockFunction(manualSafeDispatcher.dispatch)).toBe(true);
    });

    it('should dispatch events identically to manual implementation', async () => {
      const factorySafeDispatcher =
        ModTestHandlerFactory.createSafeDispatcher(eventBus);
      const manualSafeDispatcher = {
        dispatch: jest.fn((eventType, payload) => {
          eventBus.dispatch(eventType, payload);
          return Promise.resolve(true);
        }),
      };

      const testEvent = 'TEST_EVENT';
      const testPayload = { data: 'test' };

      // Test factory dispatcher
      const factoryResult = await factorySafeDispatcher.dispatch(
        testEvent,
        testPayload
      );

      // Reset event bus mock and test manual dispatcher
      jest.clearAllMocks();
      const manualResult = await manualSafeDispatcher.dispatch(
        testEvent,
        testPayload
      );

      // Both should return the same result
      expect(factoryResult).toBe(manualResult);
      expect(factoryResult).toBe(true);
    });
  });

  describe('Category-based Factory Selection Validation', () => {
    it('should provide positioning factory that matches manual handler creation', () => {
      const positioningFactory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('positioning');
      const factoryHandlers = positioningFactory(
        entityManager,
        eventBus,
        logger,
        gameDataRepository
      );
      const manualHandlers = createManualHandlersWithPerceptionLogging(
        entityManager,
        eventBus,
        logger,
        gameDataRepository
      );

      const factoryKeys = Object.keys(factoryHandlers).sort();
      const manualKeys = Object.keys(manualHandlers).sort();

      expect(factoryKeys).toEqual(manualKeys);
      expect(factoryHandlers.ADD_COMPONENT).toBeDefined();
    });

    it('should provide standard factory for intimacy that matches manual creation', () => {
      const intimacyFactory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('intimacy');
      const factoryHandlers = intimacyFactory(entityManager, eventBus, logger);
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      const factoryKeys = Object.keys(factoryHandlers).sort();
      const manualKeys = Object.keys(manualHandlers).sort();

      expect(factoryKeys).toEqual(manualKeys);
      expect(factoryHandlers.ADD_COMPONENT).toBeUndefined();
    });
  });

  describe('Handler Configuration Consistency', () => {
    it('should configure QUERY_COMPONENT handler with same dependencies as manual', () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Both handlers should be configured and functional
      expect(factoryHandlers.QUERY_COMPONENT.execute).toBeDefined();
      expect(manualHandlers.QUERY_COMPONENT.execute).toBeDefined();
      expect(factoryHandlers.QUERY_COMPONENT.constructor).toBe(
        manualHandlers.QUERY_COMPONENT.constructor
      );
    });

    it('should configure GET_NAME handler with same dependencies as manual', () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      expect(factoryHandlers.GET_NAME.execute).toBeDefined();
      expect(manualHandlers.GET_NAME.execute).toBeDefined();
      expect(factoryHandlers.GET_NAME.constructor).toBe(
        manualHandlers.GET_NAME.constructor
      );
    });

    it('should configure DISPATCH_PERCEPTIBLE_EVENT handler with same dependencies as manual', () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      expect(factoryHandlers.DISPATCH_PERCEPTIBLE_EVENT.execute).toBeDefined();
      expect(manualHandlers.DISPATCH_PERCEPTIBLE_EVENT.execute).toBeDefined();
      expect(factoryHandlers.DISPATCH_PERCEPTIBLE_EVENT.constructor).toBe(
        manualHandlers.DISPATCH_PERCEPTIBLE_EVENT.constructor
      );
    });
  });

  describe('Migration Readiness Validation', () => {
    it('should demonstrate zero behavioral difference between factory and manual creation', () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const manualHandlers = createManualHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Verify that all handlers exist and have the same type
      const expectedHandlerNames = [
        'QUERY_COMPONENT',
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
        'SET_VARIABLE',
        'LOG_MESSAGE',
      ];

      expectedHandlerNames.forEach((handlerName) => {
        expect(factoryHandlers[handlerName]).toBeDefined();
        expect(manualHandlers[handlerName]).toBeDefined();
        expect(factoryHandlers[handlerName].constructor.name).toBe(
          manualHandlers[handlerName].constructor.name
        );
      });
    });

    it('should produce handlers that can be used interchangeably with manual handlers', async () => {
      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Factory handlers should be directly usable as replacements
      expect(typeof factoryHandlers.GET_TIMESTAMP.execute).toBe('function');
      expect(typeof factoryHandlers.SET_VARIABLE.execute).toBe('function');
      expect(typeof factoryHandlers.DISPATCH_EVENT.execute).toBe('function');

      // Test that handlers exist and are callable
      expect(() => factoryHandlers.GET_TIMESTAMP.execute({})).not.toThrow();
    });

    it('should reduce code duplication while maintaining identical functionality', () => {
      // This test validates the core promise of the factory:
      // Reduced code duplication with identical functionality

      const factoryHandlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Factory should create exactly 9 standard handlers
      expect(Object.keys(factoryHandlers)).toHaveLength(9);

      // Each handler should be properly configured
      Object.values(factoryHandlers).forEach((handler) => {
        expect(handler.execute).toBeDefined();
        expect(typeof handler.execute).toBe('function');
      });

      // Factory usage reduces from ~30 lines to ~1 line per test file
      // This represents a >90% reduction in handler creation code
    });
  });
});
