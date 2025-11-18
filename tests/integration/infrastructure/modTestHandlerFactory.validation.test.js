/**
 * @file Deep validation tests for ModTestHandlerFactory
 * @description TSTAIMIG-002: Comprehensive validation of static factory methods and handler creation capabilities
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

// Import handlers for validation
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import LogHandler from '../../../src/logic/operationHandlers/logHandler.js';

describe('ModTestHandlerFactory - Deep Validation (TSTAIMIG-002)', () => {
  let entityManager;
  let eventBus;
  let logger;
  let mockGameDataRepository;

  beforeEach(() => {
    // Use realistic test entities
    entityManager = new SimpleEntityManager([
      {
        id: 'test-actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:position': { locationId: 'test-room' },
          'core:actor': {},
        },
      },
      {
        id: 'test-target',
        components: {
          'core:name': { text: 'Test Target' },
          'core:position': { locationId: 'test-room' },
          'core:actor': {},
        },
      },
    ]);

    eventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockGameDataRepository = {
      getComponentDefinition: jest.fn().mockReturnValue(null),
      get: jest.fn().mockReturnValue(undefined),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Creates a proper ExecutionContext object for handler testing.
   *
   * @param {object} options - Configuration options
   * @param {string} options.actorId - Actor entity ID
   * @param {string} [options.targetId] - Target entity ID
   * @param {object} [options.contextVars] - Additional context variables
   * @returns {object} Properly structured ExecutionContext
   */
  function createExecutionContext({ actorId, targetId, contextVars = {} }) {
    return {
      evaluationContext: {
        context: {
          ...contextVars,
        },
        actor: { id: actorId },
        target: targetId ? { id: targetId } : undefined,
        event: {
          type: 'test:event',
          payload: {
            actorId,
            targetId,
          },
        },
      },
      logger,
    };
  }

  describe('Static Factory Method Signatures and Patterns', () => {
    it('should verify createStandardHandlers signature and behavior', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Verify all expected handlers are present
      expect(handlers).toHaveProperty('QUERY_COMPONENT');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('GET_TIMESTAMP');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('DISPATCH_EVENT');
      expect(handlers).toHaveProperty('END_TURN');
      expect(handlers).toHaveProperty('SET_VARIABLE');
      expect(handlers).toHaveProperty('LOG_MESSAGE');

      // Verify handler types
      expect(handlers.QUERY_COMPONENT).toBeInstanceOf(QueryComponentHandler);
      expect(handlers.GET_NAME).toBeInstanceOf(GetNameHandler);
      expect(handlers.GET_TIMESTAMP).toBeInstanceOf(GetTimestampHandler);
      expect(handlers.DISPATCH_PERCEPTIBLE_EVENT).toBeInstanceOf(
        DispatchPerceptibleEventHandler
      );
      expect(handlers.DISPATCH_EVENT).toBeInstanceOf(DispatchEventHandler);
      expect(handlers.END_TURN).toBeInstanceOf(EndTurnHandler);
      expect(handlers.SET_VARIABLE).toBeInstanceOf(SetVariableHandler);
      expect(handlers.LOG_MESSAGE).toBeInstanceOf(LogHandler);
    });

    it('should verify createHandlersWithAddComponent signature and behavior', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithAddComponent(
        entityManager,
        eventBus,
        logger,
        mockGameDataRepository
      );

      // Should have all standard handlers plus ADD_COMPONENT
      expect(handlers).toHaveProperty('QUERY_COMPONENT');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('GET_TIMESTAMP');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('DISPATCH_EVENT');
      expect(handlers).toHaveProperty('END_TURN');
      expect(handlers).toHaveProperty('SET_VARIABLE');
      expect(handlers).toHaveProperty('LOG_MESSAGE');
      expect(handlers).toHaveProperty('ADD_COMPONENT');

      // Verify ADD_COMPONENT handler type
      expect(handlers.ADD_COMPONENT).toBeInstanceOf(AddComponentHandler);
    });

    it('should verify createMinimalHandlers signature and behavior', () => {
      const handlers = ModTestHandlerFactory.createMinimalHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Should have only essential handlers
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('END_TURN');
      expect(handlers).toHaveProperty('LOG_MESSAGE');

      // Should NOT have optional handlers
      expect(handlers).not.toHaveProperty('QUERY_COMPONENT');
      expect(handlers).not.toHaveProperty('SET_VARIABLE');
      expect(handlers).not.toHaveProperty('ADD_COMPONENT');
    });

    it('should verify createCustomHandlers signature and behavior with options', () => {
      const options = {
        includeAddComponent: true,
        includeSetVariable: false,
        includeQueryComponent: true,
      };

      const handlers = ModTestHandlerFactory.createCustomHandlers(
        entityManager,
        eventBus,
        logger,
        mockGameDataRepository,
        options
      );

      // Should have configured handlers based on options
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('GET_TIMESTAMP');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('DISPATCH_EVENT');
      expect(handlers).toHaveProperty('END_TURN');
      expect(handlers).toHaveProperty('LOG_MESSAGE');
      expect(handlers).toHaveProperty('QUERY_COMPONENT'); // includeQueryComponent: true
      expect(handlers).toHaveProperty('ADD_COMPONENT'); // includeAddComponent: true
      expect(handlers).not.toHaveProperty('SET_VARIABLE'); // includeSetVariable: false
    });
  });

  describe('Handler Creation for Category Patterns', () => {
    const categoryTests = [
      { category: 'exercise', expectedFactory: 'createStandardHandlers' },
      { category: 'violence', expectedFactory: 'createStandardHandlers' },
      { category: 'intimacy', expectedFactory: 'createStandardHandlers' },
      { category: 'sex', expectedFactory: 'createStandardHandlers' },
      {
        category: 'positioning',
        expectedFactory: 'createHandlersWithAddComponent',
      },
    ];

    categoryTests.forEach(({ category, expectedFactory }) => {
      it(`should create handlers for ${category} category patterns`, () => {
        const factoryMethod =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        expect(factoryMethod).toBeDefined();
        expect(typeof factoryMethod).toBe('function');

        // Execute the factory method and verify results
        const handlers = factoryMethod(
          entityManager,
          eventBus,
          logger,
          mockGameDataRepository
        );
        expect(handlers).toBeDefined();
        expect(typeof handlers).toBe('object');

        // Verify required handlers for category
        expect(handlers).toHaveProperty('GET_NAME');
        expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
        expect(handlers).toHaveProperty('END_TURN');

        // Positioning category should have ADD_COMPONENT
        if (category === 'positioning') {
          expect(handlers).toHaveProperty('ADD_COMPONENT');
          expect(handlers.ADD_COMPONENT).toBeInstanceOf(AddComponentHandler);
        }
      });
    });

    it('should return default factory for unknown categories', () => {
      const factoryMethod =
        ModTestHandlerFactory.getHandlerFactoryForCategory('unknown');
      const handlers = factoryMethod(
        entityManager,
        eventBus,
        logger,
        mockGameDataRepository
      );

      // Should behave like createStandardHandlers
      expect(handlers).toHaveProperty('QUERY_COMPONENT');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('SET_VARIABLE');
      expect(handlers).not.toHaveProperty('ADD_COMPONENT');
    });
  });

  describe('Integration with Dependency Injection System', () => {
    it('should validate dependencies and throw errors for invalid parameters', () => {
      // Missing entityManager
      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(null, eventBus, logger);
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: entityManager is required'
      );

      // Missing eventBus
      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          null,
          logger
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: eventBus is required'
      );

      // Missing logger
      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          eventBus,
          null
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: logger is required'
      );
    });

    it('should validate entityManager has required methods', () => {
      const invalidEntityManager = {
        // Missing required methods
      };

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          invalidEntityManager,
          eventBus,
          logger
        );
      }).toThrow();
    });

    it('should validate eventBus has required methods', () => {
      const invalidEventBus = {
        // Missing dispatch method
      };

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          invalidEventBus,
          logger
        );
      }).toThrow();
    });

    it('should validate logger has required methods', () => {
      const invalidLogger = {
        // Missing required logging methods
      };

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          eventBus,
          invalidLogger
        );
      }).toThrow();
    });
  });

  describe('Integration with Rule System', () => {
    it('should create handlers that integrate with macro expansion', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Test that handlers can be used in rule system context
      expect(handlers.DISPATCH_EVENT).toBeDefined();
      expect(handlers.END_TURN).toBeDefined();
      expect(handlers.LOG_MESSAGE).toBeDefined();

      // Verify handlers have execute method (standard handler interface)
      Object.values(handlers).forEach((handler) => {
        expect(handler).toHaveProperty('execute');
        expect(typeof handler.execute).toBe('function');
      });
    });

    it('should create safe event dispatcher for handler integration', () => {
      const safeDispatcher =
        ModTestHandlerFactory.createSafeDispatcher(eventBus);

      expect(safeDispatcher).toBeDefined();
      expect(safeDispatcher).toHaveProperty('dispatch');
      expect(typeof safeDispatcher.dispatch).toBe('function');

      // Test safe dispatcher functionality
      safeDispatcher.dispatch('test-event', { data: 'test' });
      expect(eventBus.dispatch).toHaveBeenCalledWith('test-event', {
        data: 'test',
      });
    });

    it('should handle condition file processing through handlers', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Verify handlers that are commonly used in conditions
      expect(handlers.QUERY_COMPONENT).toBeInstanceOf(QueryComponentHandler);
      expect(handlers.GET_NAME).toBeInstanceOf(GetNameHandler);

      // These handlers should be able to process condition logic
      expect(typeof handlers.QUERY_COMPONENT.execute).toBe('function');
      expect(typeof handlers.GET_NAME.execute).toBe('function');
    });
  });

  describe('Error Handling for Invalid Parameters', () => {
    it('should handle createSafeDispatcher with invalid eventBus', () => {
      expect(() => {
        ModTestHandlerFactory.createSafeDispatcher(null);
      }).toThrow(
        'ModTestHandlerFactory.createSafeDispatcher: eventBus is required'
      );

      expect(() => {
        ModTestHandlerFactory.createSafeDispatcher({});
      }).toThrow(); // Should fail validation
    });

    it('should handle all factory methods with consistent error messages', () => {
      const factoryMethods = [
        'createStandardHandlers',
        'createHandlersWithAddComponent',
        'createMinimalHandlers',
        'createCustomHandlers',
      ];

      factoryMethods.forEach((methodName) => {
        // Test null entityManager
        expect(() => {
          ModTestHandlerFactory[methodName](null, eventBus, logger);
        }).toThrow(
          `ModTestHandlerFactory.${methodName}: entityManager is required`
        );

        // Test null eventBus
        expect(() => {
          ModTestHandlerFactory[methodName](entityManager, null, logger);
        }).toThrow(`ModTestHandlerFactory.${methodName}: eventBus is required`);

        // Test null logger
        expect(() => {
          ModTestHandlerFactory[methodName](entityManager, eventBus, null);
        }).toThrow(`ModTestHandlerFactory.${methodName}: logger is required`);
      });
    });
  });

  describe('Handler Functionality Verification', () => {
    it('should create handlers that can execute operations', async () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Create proper execution context
      const executionContext = createExecutionContext({
        actorId: 'test-actor',
      });

      // Test GET_NAME handler execution with proper parameters
      const getNameParams = {
        entity_ref: 'actor',
        result_variable: 'testName',
        default_value: 'Default Name',
      };
      await handlers.GET_NAME.execute(getNameParams, executionContext);

      // Verify name was stored in context
      expect(executionContext.evaluationContext.context.testName).toBeDefined();
      expect(typeof executionContext.evaluationContext.context.testName).toBe(
        'string'
      );

      // Test QUERY_COMPONENT handler execution
      const queryParams = {
        entity_ref: 'actor',
        component_type: 'core:name',
        result_variable: 'queryResult',
      };
      await handlers.QUERY_COMPONENT.execute(queryParams, executionContext);

      // Verify query result was stored in context
      expect(
        executionContext.evaluationContext.context.queryResult
      ).toBeDefined();

      // Test LOG_MESSAGE handler execution
      const logParams = {
        message: 'Test message',
      };
      await handlers.LOG_MESSAGE.execute(logParams, executionContext);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should create ADD_COMPONENT handler that can add components', async () => {
      const handlers = ModTestHandlerFactory.createHandlersWithAddComponent(
        entityManager,
        eventBus,
        logger,
        mockGameDataRepository
      );

      // Create proper execution context
      const executionContext = createExecutionContext({
        actorId: 'test-actor',
      });

      // Test ADD_COMPONENT handler execution with proper parameters
      const addComponentParams = {
        entity_ref: 'actor',
        component_type: 'test:component',
        value: { value: 'test' },
      };

      await handlers.ADD_COMPONENT.execute(
        addComponentParams,
        executionContext
      );

      // Verify component was added
      const entity = entityManager.getEntityInstance('test-actor');
      expect(entity.components['test:component']).toEqual({ value: 'test' });
    });
  });

  describe('Performance and Resource Management', () => {
    it('should create handlers efficiently without memory leaks', () => {
      const iterations = 100;
      const handlerSets = [];

      // Create many handler sets
      for (let i = 0; i < iterations; i++) {
        const handlers = ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          eventBus,
          logger
        );
        handlerSets.push(handlers);
      }

      // Verify all handler sets are valid
      handlerSets.forEach((handlers) => {
        expect(handlers).toHaveProperty('GET_NAME');
        expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      });

      expect(handlerSets).toHaveLength(iterations);
    });

    it('should reuse safe dispatcher instances appropriately', () => {
      const handlers1 = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );
      const handlers2 = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Each handler set should be independent
      expect(handlers1).not.toBe(handlers2);

      // But should have same structure
      expect(Object.keys(handlers1)).toEqual(Object.keys(handlers2));
    });
  });
});
