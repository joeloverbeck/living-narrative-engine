/**
 * @file Unit tests for ModTestHandlerFactory
 * @description Comprehensive test coverage for the handler factory methods
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

describe('ModTestHandlerFactory', () => {
  let mockEntityManager;
  let mockEventBus;
  let mockLogger;
  let mockGameDataRepository;

  beforeEach(() => {
    // Create comprehensive mocks with all required methods based on SimpleEntityManager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
      modifyComponent: jest.fn(),
      hasComponent: jest.fn(),
      getAllEntities: jest.fn(),
      createEntity: jest.fn(),
      deleteEntity: jest.fn(),
      getEntityIds: jest.fn(() => []), // Added for createHandlersWithPerceptionLogging
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockGameDataRepository = {
      getComponentDefinition: jest.fn().mockReturnValue(null),
      get: jest.fn().mockReturnValue(null), // Required by QueryLookupHandler
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStandardHandlers', () => {
    it('should create all 9 standard handlers with correct configuration', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      // Verify all expected handlers are present
      const expectedHandlers = [
        'QUERY_COMPONENT',
        'QUERY_COMPONENTS',
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
        'SET_VARIABLE',
        'LOG_MESSAGE',
      ];

      expectedHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
        expect(handlers[handlerKey]).toBeDefined();
      });

      // Verify correct number of handlers (9 standard operations)
      expect(Object.keys(handlers)).toHaveLength(9);
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          null,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: entityManager is required'
      );

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          undefined,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: entityManager is required'
      );
    });

    it('should throw error when eventBus is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          mockEntityManager,
          null,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: eventBus is required'
      );

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          mockEntityManager,
          undefined,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: eventBus is required'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          mockEntityManager,
          mockEventBus,
          null
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: logger is required'
      );

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          mockEntityManager,
          mockEventBus,
          undefined
        );
      }).toThrow(
        'ModTestHandlerFactory.createStandardHandlers: logger is required'
      );
    });

    it('should throw error when entityManager lacks required methods', () => {
      const invalidEntityManager = { wrongMethod: jest.fn() };

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          invalidEntityManager,
          mockEventBus,
          mockLogger
        );
      }).toThrow();
    });

    it('should throw error when eventBus lacks required methods', () => {
      const invalidEventBus = { wrongMethod: jest.fn() };

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          mockEntityManager,
          invalidEventBus,
          mockLogger
        );
      }).toThrow();
    });

    it('should throw error when logger lacks required methods', () => {
      const invalidLogger = { wrongMethod: jest.fn() };

      expect(() => {
        ModTestHandlerFactory.createStandardHandlers(
          mockEntityManager,
          mockEventBus,
          invalidLogger
        );
      }).toThrow();
    });

    it('should configure handlers with correct dependencies', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      // Test that handlers receive the correct dependencies by checking their structure
      // Note: We can't easily test internal dependencies without introspection,
      // so we verify the handlers are properly instantiated
      expect(typeof handlers.QUERY_COMPONENT.execute).toBe('function');
      expect(typeof handlers.GET_NAME.execute).toBe('function');
      expect(typeof handlers.GET_TIMESTAMP.execute).toBe('function');
      expect(typeof handlers.DISPATCH_PERCEPTIBLE_EVENT.execute).toBe(
        'function'
      );
      expect(typeof handlers.DISPATCH_EVENT.execute).toBe('function');
      expect(typeof handlers.END_TURN.execute).toBe('function');
      expect(typeof handlers.SET_VARIABLE.execute).toBe('function');
    });
  });

  describe('createHandlersWithAddComponent', () => {
    it('should create standard handlers plus ADD_COMPONENT handler', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithAddComponent(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // Should have all standard handlers plus QUERY_LOOKUP and ADD_COMPONENT
      const expectedHandlers = [
        'QUERY_COMPONENT',
        'QUERY_COMPONENTS',
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
        'SET_VARIABLE',
        'LOG_MESSAGE',
        'QUERY_LOOKUP',
        'ADD_COMPONENT',
      ];

      expectedHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
        expect(handlers[handlerKey]).toBeDefined();
      });

      // Verify correct number of handlers (9 standard + 1 QUERY_LOOKUP + 1 ADD_COMPONENT)
      expect(Object.keys(handlers)).toHaveLength(11);
    });

    it('should configure ADD_COMPONENT handler correctly', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithAddComponent(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(handlers.ADD_COMPONENT).toBeDefined();
      expect(typeof handlers.ADD_COMPONENT.execute).toBe('function');
    });

    it('should throw error when dependencies are missing', () => {
      expect(() => {
        ModTestHandlerFactory.createHandlersWithAddComponent(
          null,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createHandlersWithAddComponent: entityManager is required'
      );
    });
  });

  describe('createHandlersWithComponentMutations', () => {
    it('should include standard handlers plus add/remove component support', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithComponentMutations(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      const expectedHandlers = [
        'QUERY_COMPONENT',
        'QUERY_COMPONENTS',
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
        'SET_VARIABLE',
        'LOG_MESSAGE',
        'QUERY_LOOKUP',
        'ADD_COMPONENT',
        'REMOVE_COMPONENT',
      ];

      expectedHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
        expect(handlers[handlerKey]).toBeDefined();
      });

      expect(Object.keys(handlers)).toHaveLength(12);
    });

    it('should configure mutation handlers with executable methods', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithComponentMutations(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(typeof handlers.ADD_COMPONENT.execute).toBe('function');
      expect(typeof handlers.REMOVE_COMPONENT.execute).toBe('function');
    });

    it('should throw error when dependencies are missing', () => {
      expect(() => {
        ModTestHandlerFactory.createHandlersWithComponentMutations(
          null,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createHandlersWithComponentMutations: entityManager is required'
      );
    });
  });

  describe('createMinimalHandlers', () => {
    it('should create only 4 essential handlers', () => {
      const handlers = ModTestHandlerFactory.createMinimalHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      const expectedHandlers = [
        'GET_NAME',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'END_TURN',
        'LOG_MESSAGE',
      ];

      expectedHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
        expect(handlers[handlerKey]).toBeDefined();
      });

      // Verify exactly 4 handlers
      expect(Object.keys(handlers)).toHaveLength(4);
    });

    it('should include GET_NAME, DISPATCH_PERCEPTIBLE_EVENT, END_TURN, LOG_MESSAGE', () => {
      const handlers = ModTestHandlerFactory.createMinimalHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      expect(handlers.GET_NAME).toBeDefined();
      expect(handlers.DISPATCH_PERCEPTIBLE_EVENT).toBeDefined();
      expect(handlers.END_TURN).toBeDefined();
      expect(handlers.LOG_MESSAGE).toBeDefined();

      // Should not include other handlers
      expect(handlers.QUERY_COMPONENT).toBeUndefined();
      expect(handlers.SET_VARIABLE).toBeUndefined();
      expect(handlers.ADD_COMPONENT).toBeUndefined();
    });

    it('should throw error when dependencies are missing', () => {
      expect(() => {
        ModTestHandlerFactory.createMinimalHandlers(
          null,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createMinimalHandlers: entityManager is required'
      );
    });
  });

  describe('createHandlersWithPerceptionLogging', () => {
    it('should create standard handlers plus 10 positioning-specific handlers', () => {
      const handlers =
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          mockEntityManager,
          mockEventBus,
          mockLogger,
          mockGameDataRepository
        );

      // Should have all standard handlers
      const standardHandlers = [
        'QUERY_COMPONENT',
        'QUERY_COMPONENTS',
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
        'SET_VARIABLE',
        'LOG_MESSAGE',
      ];

      standardHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
        expect(handlers[handlerKey]).toBeDefined();
      });

      // Should have positioning-specific handlers
      const positioningHandlers = [
        'ADD_COMPONENT',
        'ADD_PERCEPTION_LOG_ENTRY',
        'REMOVE_COMPONENT',
        'MERGE_CLOSENESS_CIRCLE',
        'LOCK_MOVEMENT',
        'UNLOCK_MOVEMENT',
        'MODIFY_ARRAY_FIELD',
        'MODIFY_COMPONENT',
        'ATOMIC_MODIFY_COMPONENT',
        'BREAK_CLOSENESS_WITH_TARGET',
      ];

      positioningHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
        expect(handlers[handlerKey]).toBeDefined();
      });

      // Verify correct total number of handlers (9 standard + 1 QUERY_LOOKUP + 10 positioning)
      expect(Object.keys(handlers)).toHaveLength(20);
    });

    it('should configure all handlers with execute functions', () => {
      const handlers =
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          mockEntityManager,
          mockEventBus,
          mockLogger,
          mockGameDataRepository
        );

      // Verify all handlers have execute functions
      Object.keys(handlers).forEach((handlerKey) => {
        expect(typeof handlers[handlerKey].execute).toBe('function');
      });
    });

    it('should add getEntitiesInLocation method to entityManager if missing', () => {
      const entityManagerWithoutMethod = { ...mockEntityManager };
      delete entityManagerWithoutMethod.getEntitiesInLocation;

      const handlers =
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          entityManagerWithoutMethod,
          mockEventBus,
          mockLogger,
          mockGameDataRepository
        );

      // Should have added the method
      expect(typeof entityManagerWithoutMethod.getEntitiesInLocation).toBe(
        'function'
      );
      expect(handlers.ADD_PERCEPTION_LOG_ENTRY).toBeDefined();
    });

    it('should not override existing getEntitiesInLocation method', () => {
      const customGetEntitiesInLocation = jest.fn();
      const entityManagerWithMethod = {
        ...mockEntityManager,
        getEntitiesInLocation: customGetEntitiesInLocation,
      };

      ModTestHandlerFactory.createHandlersWithPerceptionLogging(
        entityManagerWithMethod,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // Should still be the original method
      expect(entityManagerWithMethod.getEntitiesInLocation).toBe(
        customGetEntitiesInLocation
      );
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          null,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createHandlersWithPerceptionLogging: entityManager is required'
      );
    });

    it('should throw error when eventBus is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          mockEntityManager,
          null,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createHandlersWithPerceptionLogging: eventBus is required'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          mockEntityManager,
          mockEventBus,
          null
        );
      }).toThrow(
        'ModTestHandlerFactory.createHandlersWithPerceptionLogging: logger is required'
      );
    });
  });

  describe('createCustomHandlers', () => {
    it('should create handlers based on options configuration', () => {
      const options = {
        includeAddComponent: true,
        includeSetVariable: false,
        includeQueryComponent: true,
      };

      const handlers = ModTestHandlerFactory.createCustomHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository,
        options
      );

      // Should include requested handlers
      expect(handlers.QUERY_COMPONENT).toBeDefined();
      expect(handlers.ADD_COMPONENT).toBeDefined();

      // Should not include SET_VARIABLE
      expect(handlers.SET_VARIABLE).toBeUndefined();

      // Should always include core handlers
      expect(handlers.GET_NAME).toBeDefined();
      expect(handlers.DISPATCH_PERCEPTIBLE_EVENT).toBeDefined();
      expect(handlers.END_TURN).toBeDefined();
    });

    it('should handle empty options object with defaults', () => {
      const handlers = ModTestHandlerFactory.createCustomHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository,
        {}
      );

      // Should include defaults: includeSetVariable: true, includeQueryComponent: true, includeAddComponent: false
      expect(handlers.QUERY_COMPONENT).toBeDefined();
      expect(handlers.SET_VARIABLE).toBeDefined();
      expect(handlers.ADD_COMPONENT).toBeUndefined();
    });

    it('should support includeSetVariable: false for intimacy tests', () => {
      const handlers = ModTestHandlerFactory.createCustomHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository,
        { includeSetVariable: false }
      );

      expect(handlers.SET_VARIABLE).toBeUndefined();
      expect(handlers.GET_NAME).toBeDefined(); // Core handler should still be present
    });

    it('should support includeAddComponent: true for positioning tests', () => {
      const handlers = ModTestHandlerFactory.createCustomHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository,
        { includeAddComponent: true }
      );

      expect(handlers.ADD_COMPONENT).toBeDefined();
    });

    it('should support includeQueryComponent: false', () => {
      const handlers = ModTestHandlerFactory.createCustomHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository,
        { includeQueryComponent: false }
      );

      expect(handlers.QUERY_COMPONENT).toBeUndefined();
      expect(handlers.GET_NAME).toBeDefined(); // Core handler should still be present
    });

    it('should throw error when dependencies are missing', () => {
      expect(() => {
        ModTestHandlerFactory.createCustomHandlers(
          null,
          mockEventBus,
          mockLogger
        );
      }).toThrow(
        'ModTestHandlerFactory.createCustomHandlers: entityManager is required'
      );
    });
  });

  describe('getHandlerFactoryForCategory', () => {
    it('should return createHandlersWithPerceptionLogging for positioning', () => {
      const factory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('positioning');

      // Test by calling the factory and checking if it produces the expected result
      const handlers = factory(mockEntityManager, mockEventBus, mockLogger, mockGameDataRepository);

      // Verify positioning-specific handlers are present
      expect(handlers.ADD_COMPONENT).toBeDefined();
      expect(handlers.ADD_PERCEPTION_LOG_ENTRY).toBeDefined();
      expect(handlers.REMOVE_COMPONENT).toBeDefined();
      expect(handlers.MERGE_CLOSENESS_CIRCLE).toBeDefined();
      expect(handlers.LOCK_MOVEMENT).toBeDefined();
      expect(handlers.UNLOCK_MOVEMENT).toBeDefined();
      expect(handlers.MODIFY_ARRAY_FIELD).toBeDefined();
      expect(handlers.MODIFY_COMPONENT).toBeDefined();
      expect(handlers.ATOMIC_MODIFY_COMPONENT).toBeDefined();
      expect(handlers.BREAK_CLOSENESS_WITH_TARGET).toBeDefined();

      // Should have 9 standard + 1 QUERY_LOOKUP + 10 positioning-specific handlers
      expect(Object.keys(handlers)).toHaveLength(20);
    });

    it('should return createHandlersWithComponentMutations for affection', () => {
      const factory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('affection');
      const handlers = factory(mockEntityManager, mockEventBus, mockLogger, mockGameDataRepository);

      expect(handlers.ADD_COMPONENT).toBeDefined();
      expect(handlers.REMOVE_COMPONENT).toBeDefined();
      expect(Object.keys(handlers)).toHaveLength(12);
    });

    it('should return createStandardHandlers for other categories', () => {
      const categories = ['exercise', 'intimacy'];

      categories.forEach((category) => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        const handlers = factory(mockEntityManager, mockEventBus, mockLogger, mockGameDataRepository);

        // Standard handlers don't have positioning-specific handlers
        expect(handlers.ADD_COMPONENT).toBeUndefined();
        expect(handlers.ADD_PERCEPTION_LOG_ENTRY).toBeUndefined();
        expect(handlers.REMOVE_COMPONENT).toBeUndefined();
        expect(handlers.LOCK_MOVEMENT).toBeUndefined();
        expect(handlers.UNLOCK_MOVEMENT).toBeUndefined();
        expect(handlers.MODIFY_ARRAY_FIELD).toBeUndefined();
        expect(handlers.MODIFY_COMPONENT).toBeUndefined();
        expect(handlers.ATOMIC_MODIFY_COMPONENT).toBeUndefined();

        expect(Object.keys(handlers)).toHaveLength(10); // 9 standard + QUERY_LOOKUP handlers
      });
    });

    it('should return createHandlersWithComponentMutations for sex', () => {
      const factory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('sex');
      const handlers = factory(mockEntityManager, mockEventBus, mockLogger, mockGameDataRepository);

      expect(handlers.ADD_COMPONENT).toBeDefined();
      expect(handlers.REMOVE_COMPONENT).toBeDefined();
      expect(Object.keys(handlers)).toHaveLength(12);
    });

    it('should return createStandardHandlers for unknown categories', () => {
      const unknownCategories = ['unknown', 'test', ''];

      unknownCategories.forEach((category) => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        const handlers = factory(mockEntityManager, mockEventBus, mockLogger, mockGameDataRepository);

        // Unknown categories get standard handlers without positioning-specific ones
        expect(handlers.ADD_COMPONENT).toBeUndefined();
        expect(handlers.ADD_PERCEPTION_LOG_ENTRY).toBeUndefined();
        expect(Object.keys(handlers)).toHaveLength(10); // 9 standard + QUERY_LOOKUP handlers
      });
    });

    it('should return bound methods that can be called directly', () => {
      const factory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('positioning');

      // Should be able to call the returned factory method
      const handlers = factory(mockEntityManager, mockEventBus, mockLogger, mockGameDataRepository);
      expect(handlers.ADD_COMPONENT).toBeDefined();
    });
  });

  describe('createSafeDispatcher', () => {
    it('should create dispatcher with jest mock function', () => {
      const dispatcher =
        ModTestHandlerFactory.createSafeDispatcher(mockEventBus);

      expect(dispatcher).toHaveProperty('dispatch');
      expect(jest.isMockFunction(dispatcher.dispatch)).toBe(true);
    });

    it('should dispatch events through provided eventBus', () => {
      const dispatcher =
        ModTestHandlerFactory.createSafeDispatcher(mockEventBus);
      const eventType = 'TEST_EVENT';
      const payload = { test: 'data' };

      dispatcher.dispatch(eventType, payload);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventType, payload);
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should return Promise.resolve(true) from dispatch', async () => {
      const dispatcher =
        ModTestHandlerFactory.createSafeDispatcher(mockEventBus);

      const result = await dispatcher.dispatch('TEST_EVENT', {});

      expect(result).toBe(true);
    });

    it('should throw error when eventBus is missing', () => {
      expect(() => {
        ModTestHandlerFactory.createSafeDispatcher(null);
      }).toThrow(
        'ModTestHandlerFactory.createSafeDispatcher: eventBus is required'
      );

      expect(() => {
        ModTestHandlerFactory.createSafeDispatcher(undefined);
      }).toThrow(
        'ModTestHandlerFactory.createSafeDispatcher: eventBus is required'
      );
    });

    it('should throw error when eventBus lacks required methods', () => {
      const invalidEventBus = { wrongMethod: jest.fn() };

      expect(() => {
        ModTestHandlerFactory.createSafeDispatcher(invalidEventBus);
      }).toThrow();
    });
  });

  describe('Handler Integration', () => {
    it('should create consistent handler objects across different methods', () => {
      const standardHandlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      const customHandlers = ModTestHandlerFactory.createCustomHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository,
        { includeAddComponent: false }
      );

      // Both should have the same core handlers
      const commonHandlers = [
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
      ];

      commonHandlers.forEach((handlerKey) => {
        expect(standardHandlers[handlerKey]).toBeDefined();
        expect(customHandlers[handlerKey]).toBeDefined();
        // Both handlers should be instances of the same class
        expect(standardHandlers[handlerKey].constructor).toBe(
          customHandlers[handlerKey].constructor
        );
      });
    });

    it('should reuse safe dispatcher across handlers in the same factory call', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      // Multiple handlers should work with the same safe dispatcher pattern
      // This is more of a integration test to ensure consistency
      expect(handlers.QUERY_COMPONENT).toBeDefined();
      expect(handlers.GET_NAME).toBeDefined();
      expect(handlers.END_TURN).toBeDefined();
    });
  });
});
