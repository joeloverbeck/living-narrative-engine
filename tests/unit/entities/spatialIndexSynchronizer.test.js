/**
 * @file Test suite for the corrected SpatialIndexSynchronizer
 * @see tests/entities/spatialIndexSynchronizer.test.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import { SpatialIndexSynchronizer } from '../../../src/entities/spatialIndexSynchronizer.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../src/constants/eventIds.js';

// Helper to create a mock entity
const createMockEntity = (id, positionData) => {
  return {
    id,
    getComponentData: jest.fn((componentTypeId) => {
      if (componentTypeId === POSITION_COMPONENT_ID) {
        return positionData;
      }
      return undefined;
    }),
  };
};

describe('SpatialIndexSynchronizer', () => {
  /** @type {import('jest-mock-extended').MockProxy<import('../../src/interfaces/ISpatialIndexManager.js').ISpatialIndexManager>} */
  let mockSpatialIndexManager;
  /** @type {import('jest-mock-extended').MockProxy<import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher>} */
  let mockSafeEventDispatcher;
  /** @type {import('jest-mock-extended').MockProxy<import('../../src/interfaces/coreServices.js').ILogger>} */
  let mockLogger;
  let synchronizer;

  // To capture the handlers passed to subscribe
  let handlers = {};

  beforeEach(() => {
    mockSpatialIndexManager = mock();
    mockLogger = mock();
    handlers = {};

    // Mock the dispatcher to capture the subscribed handlers
    mockSafeEventDispatcher = mock();
    mockSafeEventDispatcher.subscribe.mockImplementation(
      (eventName, handler) => {
        handlers[eventName] = handler;
        return () => {}; // Return a mock unsubscribe function
      }
    );
  });

  const initializeSynchronizer = (overrides = {}) => {
    return new SpatialIndexSynchronizer({
      spatialIndexManager: mockSpatialIndexManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger,
      ...overrides,
    });
  };

  it('should subscribe to all relevant entity events upon construction', () => {
    // Act
    synchronizer = initializeSynchronizer();

    // Assert
    expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_CREATED_ID,
      expect.any(Function)
    );
    expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_REMOVED_ID,
      expect.any(Function)
    );
    expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(
      COMPONENT_ADDED_ID,
      expect.any(Function)
    );
    expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(
      COMPONENT_REMOVED_ID,
      expect.any(Function)
    );
    expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledTimes(4);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'SpatialIndexSynchronizer initialized and listening for events.'
    );
  });

  describe('constructor bootstrapping behaviour', () => {
    it('should log and skip bootstrapping when no entity manager is provided', () => {
      initializeSynchronizer();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SpatialIndexSynchronizer: No entity manager provided, skipping bootstrap of existing entities.'
      );
    });

    it('should warn when the provided entity manager is not iterable', () => {
      initializeSynchronizer({ entityManager: {} });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SpatialIndexSynchronizer: Provided entity manager cannot be iterated. Skipping bootstrap.'
      );
    });

    it('should use buildIndex when available and avoid manual indexing', () => {
      const entity = {
        id: 'entity-1',
        getComponentData: jest.fn(() => ({ locationId: '  dungeon  ' })),
      };

      const spatialIndex = {
        addEntity: jest.fn(),
        buildIndex: jest.fn(),
        clearIndex: jest.fn(),
      };

      const entityManager = {
        entities: [entity],
      };

      initializeSynchronizer({
        spatialIndexManager: spatialIndex,
        entityManager,
      });

      expect(spatialIndex.buildIndex).toHaveBeenCalledWith(entityManager);
      expect(spatialIndex.addEntity).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SpatialIndexSynchronizer: Bootstrapped 1 existing entities into spatial index.'
      );
    });

    it('should clear the index and manually add entities when buildIndex is unavailable', () => {
      const validEntity = createMockEntity('entity-1', { locationId: 'castle' });
      const invalidIdEntity = { id: '   ', getComponentData: jest.fn(() => ({ locationId: 'ignored' })) };
      const noComponentEntity = { id: 'entity-2', getComponentData: 'not-a-function' };
      const numericIdEntity = {
        id: 123,
        getComponentData: jest.fn(() => ({ locationId: 'numeric-land' })),
      };

      const spatialIndex = {
        addEntity: jest.fn(),
        clearIndex: jest.fn(),
      };

      const entityManager = {
        entities: [
          validEntity,
          invalidIdEntity,
          noComponentEntity,
          numericIdEntity,
        ],
      };

      initializeSynchronizer({
        spatialIndexManager: spatialIndex,
        entityManager,
      });

      expect(spatialIndex.clearIndex).toHaveBeenCalledTimes(1);
      expect(spatialIndex.addEntity).toHaveBeenCalledWith(
        'entity-1',
        'castle'
      );
      expect(spatialIndex.addEntity).toHaveBeenCalledTimes(1);
    });

    it('should query by component when only getEntitiesWithComponent is available', () => {
      const entity = createMockEntity('entity-5', { locationId: 'fields' });
      const iterableResult = {
        [Symbol.iterator]: function* () {
          yield entity;
        },
      };

      const spatialIndex = {
        addEntity: jest.fn(),
        clearIndex: jest.fn(),
      };

      const entityManager = {
        getEntitiesWithComponent: jest
          .fn()
          .mockReturnValue(iterableResult),
      };

      initializeSynchronizer({
        spatialIndexManager: spatialIndex,
        entityManager,
      });

      expect(entityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        POSITION_COMPONENT_ID
      );
      expect(spatialIndex.clearIndex).toHaveBeenCalledTimes(1);
      expect(spatialIndex.addEntity).toHaveBeenCalledWith(
        'entity-5',
        'fields'
      );
    });

    it('should support component queries even when clearIndex is not provided', () => {
      const entity = createMockEntity('entity-7', { locationId: 'tower' });
      const iterableResult = {
        [Symbol.iterator]: function* () {
          yield entity;
        },
      };

      const spatialIndex = {
        addEntity: jest.fn(),
      };

      const entityManager = {
        getEntitiesWithComponent: jest
          .fn()
          .mockReturnValue(iterableResult),
      };

      initializeSynchronizer({
        spatialIndexManager: spatialIndex,
        entityManager,
      });

      expect(entityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        POSITION_COMPONENT_ID
      );
      expect(spatialIndex.addEntity).toHaveBeenCalledWith('entity-7', 'tower');
    });

    it('should warn when the resolved seed source is not iterable', () => {
      const spatialIndex = {
        addEntity: jest.fn(),
        clearIndex: jest.fn(),
      };
      const entityManager = {
        getEntitiesWithComponent: jest.fn().mockReturnValue({}),
      };

      initializeSynchronizer({
        spatialIndexManager: spatialIndex,
        entityManager,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SpatialIndexSynchronizer: Unable to iterate existing entities during bootstrap.'
      );
    });

    it('should log an error if bootstrapping throws', () => {
      const iteratorError = new Error('iteration failed');
      const badIterable = {
        [Symbol.iterator]: () => {
          throw iteratorError;
        },
      };

      const entityManager = {
        entities: badIterable,
      };

      initializeSynchronizer({
        spatialIndexManager: { addEntity: jest.fn() },
        entityManager,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'SpatialIndexSynchronizer: Failed to bootstrap spatial index from existing entities.',
        iteratorError
      );
    });
  });

  describe('onEntityAdded (entity:created event)', () => {
    it('should add an entity to the spatial index when it has a location', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { locationId: 'location-a' });
      const payload = { entity, wasReconstructed: false };
      const eventObject = { type: ENTITY_CREATED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[ENTITY_CREATED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith(
        'entity-1',
        'location-a'
      );
    });

    it('should not add an entity if it has no locationId', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', {});
      const payload = { entity, wasReconstructed: false };
      const eventObject = { type: ENTITY_CREATED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[ENTITY_CREATED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
    });

    it('should not add an entity if the locationId trims to an empty string', () => {
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { locationId: '   ' });
      const payload = { entity, wasReconstructed: false };

      handlers[ENTITY_CREATED_ID](payload);

      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
    });

    it('should handle invalid payload gracefully and log warning', () => {
      // Arrange
      synchronizer = initializeSynchronizer();

      // Act - pass invalid payload
      handlers[ENTITY_CREATED_ID](null);
      handlers[ENTITY_CREATED_ID](undefined);
      handlers[ENTITY_CREATED_ID]('invalid');
      handlers[ENTITY_CREATED_ID](123);

      // Assert
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(4);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid payload received'),
        null
      );
    });

    it('should ignore payloads that do not include an entity', () => {
      synchronizer = initializeSynchronizer();

      handlers[ENTITY_CREATED_ID]({ type: ENTITY_CREATED_ID, payload: {} });

      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
    });

    it('should handle both EventBus format and direct payload format', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { locationId: 'location-a' });
      const payload = { entity, wasReconstructed: false };

      // Act - test both formats
      handlers[ENTITY_CREATED_ID]({ type: ENTITY_CREATED_ID, payload }); // EventBus format
      handlers[ENTITY_CREATED_ID](payload); // Direct payload format

      // Assert
      expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledTimes(2);
      expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith(
        'entity-1',
        'location-a'
      );
    });
  });

  describe('onEntityRemoved (entity:removed event)', () => {
    it('should remove an entity from the spatial index if it had a location', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { locationId: 'location-a' });
      // First add the entity so it's tracked
      synchronizer.onEntityAdded({
        type: ENTITY_CREATED_ID,
        payload: { entity },
      });

      const payload = { instanceId: 'entity-1' };
      const eventObject = { type: ENTITY_REMOVED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[ENTITY_REMOVED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.removeEntity).toHaveBeenCalledWith(
        'entity-1',
        'location-a'
      );
    });

    it('should not attempt to remove an entity if it had no locationId', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', {});
      // Entity was never added, so no position is tracked
      const payload = { instanceId: 'entity-1' };
      const eventObject = { type: ENTITY_REMOVED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[ENTITY_REMOVED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
    });

    it('should handle invalid payload gracefully and log warning', () => {
      // Arrange
      synchronizer = initializeSynchronizer();

      // Act - pass invalid payloads
      handlers[ENTITY_REMOVED_ID](null);
      handlers[ENTITY_REMOVED_ID](undefined);
      handlers[ENTITY_REMOVED_ID]('invalid');
      handlers[ENTITY_REMOVED_ID](123);

      // Assert
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(4);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'SpatialIndexSynchronizer.onEntityRemoved: Invalid payload received'
        ),
        null
      );
    });

    it('should ignore removal payloads without an instanceId', () => {
      synchronizer = initializeSynchronizer();

      handlers[ENTITY_REMOVED_ID]({ type: ENTITY_REMOVED_ID, payload: {} });

      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
    });
  });

  describe('onPositionChanged (component:added/removed events)', () => {
    beforeEach(() => {
      synchronizer = initializeSynchronizer();
    });

    it('should call updateEntityLocation when an entity moves from one location to another', () => {
      // Arrange
      const entity = createMockEntity('entity-1', null); // Entity state is irrelevant here, payload is key
      const payload = {
        entity,
        componentTypeId: POSITION_COMPONENT_ID,
        componentData: { locationId: 'location-b' },
        oldComponentData: { locationId: 'location-a' },
      };
      const eventObject = { type: COMPONENT_ADDED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[COMPONENT_ADDED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.updateEntityLocation).toHaveBeenCalledWith(
        'entity-1',
        'location-a',
        'location-b'
      );
    });

    it('should call updateEntityLocation when an entity gains a location for the first time', () => {
      // Arrange
      const entity = createMockEntity('entity-1', null);
      const payload = {
        entity,
        componentTypeId: POSITION_COMPONENT_ID,
        componentData: { locationId: 'new-dungeon' },
        oldComponentData: undefined, // It had no position component before
      };
      const eventObject = { type: COMPONENT_ADDED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[COMPONENT_ADDED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.updateEntityLocation).toHaveBeenCalledWith(
        'entity-1',
        null,
        'new-dungeon'
      );
    });

    it('should call updateEntityLocation when an entity loses its location', () => {
      // Arrange
      const entity = createMockEntity('entity-1', null);
      const payload = {
        entity,
        componentTypeId: POSITION_COMPONENT_ID,
        oldComponentData: { locationId: 'old-dungeon' },
        // componentData is absent for remove events
      };
      const eventObject = { type: COMPONENT_REMOVED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[COMPONENT_REMOVED_ID](eventObject);

      // Assert
      expect(mockSpatialIndexManager.updateEntityLocation).toHaveBeenCalledWith(
        'entity-1',
        'old-dungeon',
        null
      );
    });

    it('should NOT call updateEntityLocation if the locationId has not changed', () => {
      // Arrange
      const entity = createMockEntity('entity-1', null);
      const payload = {
        entity,
        componentTypeId: POSITION_COMPONENT_ID,
        componentData: { locationId: 'location-a' },
        oldComponentData: { locationId: 'location-a' },
      };
      const eventObject = { type: COMPONENT_ADDED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[COMPONENT_ADDED_ID](eventObject);

      // Assert
      expect(
        mockSpatialIndexManager.updateEntityLocation
      ).not.toHaveBeenCalled();
    });

    it('should do nothing if a non-position component is changed', () => {
      // Arrange
      const entity = createMockEntity('entity-1', null);
      const payload = {
        entity,
        componentTypeId: 'core:health',
        componentData: { hp: 10 },
        oldComponentData: { hp: 20 },
      };
      const eventObject = { type: COMPONENT_ADDED_ID, payload };

      // Act - simulate real EventBus behavior
      handlers[COMPONENT_ADDED_ID](eventObject);

      // Assert
      expect(
        mockSpatialIndexManager.updateEntityLocation
      ).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
    });

    it('should handle invalid payload gracefully and log warning', () => {
      // Arrange
      synchronizer = initializeSynchronizer();

      // Act - pass invalid payloads to position change handlers
      handlers[COMPONENT_ADDED_ID](null);
      handlers[COMPONENT_ADDED_ID](undefined);
      handlers[COMPONENT_ADDED_ID]('invalid');
      handlers[COMPONENT_ADDED_ID](123);

      // Assert
      expect(
        mockSpatialIndexManager.updateEntityLocation
      ).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(4);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'SpatialIndexSynchronizer.onPositionChanged: Invalid payload received'
        ),
        null
      );
    });

    it('should handle invalid entity ID gracefully and log warning', () => {
      // Arrange
      synchronizer = initializeSynchronizer();

      // Test cases for invalid entity IDs
      const testCases = [
        { entity: null, description: 'null entity' },
        { entity: {}, description: 'entity without id' },
        { entity: { id: null }, description: 'entity with null id' },
        { entity: { id: 123 }, description: 'entity with non-string id' },
        { entity: { id: '' }, description: 'entity with empty string id' },
        {
          entity: { id: '   ' },
          description: 'entity with whitespace-only id',
        },
      ];

      testCases.forEach(({ entity, description }) => {
        const payload = {
          entity,
          componentTypeId: POSITION_COMPONENT_ID,
          componentData: { locationId: 'new-location' },
          oldComponentData: { locationId: 'old-location' },
        };
        const eventObject = { type: COMPONENT_ADDED_ID, payload };

        // Act - simulate real EventBus behavior
        handlers[COMPONENT_ADDED_ID](eventObject);
      });

      // Assert
      expect(
        mockSpatialIndexManager.updateEntityLocation
      ).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(testCases.length);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID, skipping position update'
        ),
        expect.objectContaining({ componentTypeId: POSITION_COMPONENT_ID })
      );
    });
  });
});
