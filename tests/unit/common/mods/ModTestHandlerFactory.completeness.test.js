/**
 * @file Completeness tests for ModTestHandlerFactory
 * @description Verifies that factory methods register handlers as documented and
 * catches gaps between documented operations and actual registrations.
 *
 * This test file was created as part of ROBOPEHANVAL-007 to prevent silent failures
 * in tests due to missing handlers.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModTestHandlerFactory } from '../../../common/mods/ModTestHandlerFactory.js';

describe('ModTestHandlerFactory - Completeness', () => {
  let mockEntityManager;
  let mockEventBus;
  let mockLogger;
  let mockGameDataRepository;

  beforeEach(() => {
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
      getEntityIds: jest.fn(() => []),
      // Required by TransferItemHandler and other item handlers
      batchAddComponentsOptimized: jest.fn().mockResolvedValue({ results: [], errors: [], updateCount: 0 }),
      removeEntityInstance: jest.fn(),
      hasEntity: jest.fn().mockReturnValue(true),
      getEntitiesInLocation: jest.fn().mockReturnValue(new Set()),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
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
      get: jest.fn().mockReturnValue(null),
    };
  });

  describe('createStandardHandlers completeness', () => {
    it('should register all documented standard handlers', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // These are the core handlers documented in the factory
      const documentedHandlers = [
        'QUERY_COMPONENT',
        'QUERY_COMPONENTS',
        'GET_NAME',
        'GET_TIMESTAMP',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'DISPATCH_EVENT',
        'END_TURN',
        'SET_VARIABLE',
        'LOG_MESSAGE',
        'FOR_EACH',
        'IF',
      ];

      documentedHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(
          handlerKey,
          expect.objectContaining({ execute: expect.any(Function) })
        );
      });
    });

    it('should not have duplicate handler registrations', () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      const handlerKeys = Object.keys(handlers);
      const uniqueKeys = new Set(handlerKeys);

      expect(handlerKeys.length).toBe(uniqueKeys.size);
    });
  });

  describe('createHandlersWithItemsSupport completeness', () => {
    it('should register all item-related handlers including UNWIELD_ITEM', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithItemsSupport(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // These are the item-specific handlers that should be present
      const itemHandlers = [
        'TRANSFER_ITEM',
        'VALIDATE_INVENTORY_CAPACITY',
        'VALIDATE_CONTAINER_CAPACITY',
        'DROP_ITEM_AT_LOCATION',
        'PICK_UP_ITEM_FROM_LOCATION',
        'OPEN_CONTAINER',
        'TAKE_FROM_CONTAINER',
        'PUT_IN_CONTAINER',
        'DRINK_FROM',
        'DRINK_ENTIRELY',
        'UNWIELD_ITEM', // Critical: This was the handler that triggered ROBOPEHANVAL-007
        'MODIFY_ARRAY_FIELD',
      ];

      itemHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(
          handlerKey,
          expect.objectContaining({ execute: expect.any(Function) })
        );
      });
    });

    it('should include component mutation handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithItemsSupport(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // Items mod needs component mutation support
      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('REMOVE_COMPONENT');
    });

    it('should inherit all standard handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithItemsSupport(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // Should include standard handlers
      const standardHandlers = [
        'GET_NAME',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'END_TURN',
        'LOG_MESSAGE',
      ];

      standardHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(handlerKey);
      });
    });
  });

  describe('createHandlersWithPerceptionLogging completeness', () => {
    it('should register all positioning and closeness handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithPerceptionLogging(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      const positioningHandlers = [
        'MERGE_CLOSENESS_CIRCLE',
        'ESTABLISH_LYING_CLOSENESS',
        'ESTABLISH_SITTING_CLOSENESS',
        'REMOVE_LYING_CLOSENESS',
        'LOCK_MOVEMENT',
        'UNLOCK_MOVEMENT',
        'BREAK_CLOSENESS_WITH_TARGET',
      ];

      positioningHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(
          handlerKey,
          expect.objectContaining({ execute: expect.any(Function) })
        );
      });
    });

    it('should register perception and logging handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithPerceptionLogging(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(handlers).toHaveProperty('ADD_PERCEPTION_LOG_ENTRY');
      expect(handlers).toHaveProperty('REGENERATE_DESCRIPTION');
      expect(handlers).toHaveProperty('CONSUME_ITEM');
    });

    it('should register component modification handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithPerceptionLogging(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      const modificationHandlers = [
        'ADD_COMPONENT',
        'REMOVE_COMPONENT',
        'MODIFY_ARRAY_FIELD',
        'MODIFY_COMPONENT',
        'ATOMIC_MODIFY_COMPONENT',
      ];

      modificationHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(
          handlerKey,
          expect.objectContaining({ execute: expect.any(Function) })
        );
      });
    });
  });

  describe('createHandlersWithMouthEngagement completeness', () => {
    it('should register mouth engagement handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithMouthEngagement(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(handlers).toHaveProperty(
        'LOCK_MOUTH_ENGAGEMENT',
        expect.objectContaining({ execute: expect.any(Function) })
      );
      expect(handlers).toHaveProperty(
        'UNLOCK_MOUTH_ENGAGEMENT',
        expect.objectContaining({ execute: expect.any(Function) })
      );
    });

    it('should inherit component mutation handlers', () => {
      const handlers = ModTestHandlerFactory.createHandlersWithMouthEngagement(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('REMOVE_COMPONENT');
    });
  });

  describe('createMinimalHandlers completeness', () => {
    it('should register exactly the documented minimal handlers', () => {
      const handlers = ModTestHandlerFactory.createMinimalHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger
      );

      const minimalHandlers = [
        'GET_NAME',
        'DISPATCH_PERCEPTIBLE_EVENT',
        'END_TURN',
        'LOG_MESSAGE',
      ];

      // Minimal handlers should have exactly these 4
      expect(Object.keys(handlers)).toHaveLength(4);

      minimalHandlers.forEach((handlerKey) => {
        expect(handlers).toHaveProperty(
          handlerKey,
          expect.objectContaining({ execute: expect.any(Function) })
        );
      });
    });
  });

  describe('Factory method consistency', () => {
    it('should return handlers with execute method for all registered keys', () => {
      const factoryMethods = [
        () =>
          ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
        () =>
          ModTestHandlerFactory.createHandlersWithAddComponent(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
        () =>
          ModTestHandlerFactory.createHandlersWithComponentMutations(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
        () =>
          ModTestHandlerFactory.createHandlersWithMouthEngagement(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
        () =>
          ModTestHandlerFactory.createMinimalHandlers(
            mockEntityManager,
            mockEventBus,
            mockLogger
          ),
        () =>
          ModTestHandlerFactory.createHandlersWithItemsSupport(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
        () =>
          ModTestHandlerFactory.createHandlersWithDescriptionRegeneration(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
        () =>
          ModTestHandlerFactory.createHandlersWithPerceptionLogging(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          ),
      ];

      factoryMethods.forEach((factoryMethod, index) => {
        const handlers = factoryMethod();
        const handlerKeys = Object.keys(handlers);

        handlerKeys.forEach((key) => {
          expect(handlers[key]).toHaveProperty(
            'execute',
            expect.any(Function),
            `Factory method ${index} handler ${key} missing execute`
          );
        });
      });
    });

    it('should provide consistent handler interfaces across factory methods', () => {
      const standardHandlers = ModTestHandlerFactory.createStandardHandlers(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      const itemHandlers = ModTestHandlerFactory.createHandlersWithItemsSupport(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // Common handlers should have the same structure
      const commonKeys = Object.keys(standardHandlers).filter((key) =>
        Object.prototype.hasOwnProperty.call(itemHandlers, key)
      );

      commonKeys.forEach((key) => {
        expect(typeof standardHandlers[key].execute).toBe('function');
        expect(typeof itemHandlers[key].execute).toBe('function');
      });
    });
  });

  describe('Category mapping completeness', () => {
    it('should return appropriate factory method for each documented category', () => {
      const categories = [
        'positioning',
        'items',
        'exercise',
        'violence',
        'physical-control',
        'sex',
        'intimacy',
        'affection',
        'hand-holding',
        'hugging',
        'kissing',
        'vampirism',
        'music',
        'patrol',
        'movement',
        'metabolism',
        'weapons',
      ];

      categories.forEach((category) => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        expect(typeof factory).toBe('function');

        // Verify factory produces valid handlers
        const handlers = factory(
          mockEntityManager,
          mockEventBus,
          mockLogger,
          mockGameDataRepository
        );
        expect(handlers).toBeDefined();
        expect(Object.keys(handlers).length).toBeGreaterThan(0);
      });
    });

    it('should handle sex- prefixed categories correctly', () => {
      const sexCategories = [
        'sex-oral',
        'sex-penile-manual',
        'sex-penile-oral',
        'sex-physical-control',
      ];

      sexCategories.forEach((category) => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        expect(typeof factory).toBe('function');

        const handlers = factory(
          mockEntityManager,
          mockEventBus,
          mockLogger,
          mockGameDataRepository
        );

        // Sex categories should include component mutation support
        expect(handlers).toHaveProperty('ADD_COMPONENT');
        expect(handlers).toHaveProperty('REMOVE_COMPONENT');
      });
      });

    it('should return superset handlers for unknown categories', () => {
      const factory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('unknown-category');
      expect(typeof factory).toBe('function');

      const handlers = factory(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      // Unknown categories should fall back to the superset profile
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('LOG_MESSAGE');
      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('ADD_PERCEPTION_LOG_ENTRY');
    });

    it('should autodetect component mutation needs for distress mod data', () => {
      const factory =
        ModTestHandlerFactory.getHandlerFactoryForCategory('distress');
      const handlers = factory(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('ADD_PERCEPTION_LOG_ENTRY');
      expect(handlers).toHaveProperty('REGENERATE_DESCRIPTION');
    });

    it('should pull item handlers when item operations are present', () => {
      const factory = ModTestHandlerFactory.getHandlerFactoryForCategory('items');
      const handlers = factory(
        mockEntityManager,
        mockEventBus,
        mockLogger,
        mockGameDataRepository
      );

      expect(handlers).toHaveProperty('TRANSFER_ITEM');
      expect(handlers).toHaveProperty('VALIDATE_INVENTORY_CAPACITY');
      expect(handlers).toHaveProperty('UNWIELD_ITEM');
    });
  });
});
