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

  const initializeSynchronizer = () => {
    return new SpatialIndexSynchronizer({
      spatialIndexManager: mockSpatialIndexManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger,
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

  describe('onEntityAdded (entity:created event)', () => {
    it('should add an entity to the spatial index when it has a location', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { locationId: 'location-a' });
      const payload = { entity, wasReconstructed: false };

      // Act
      handlers[ENTITY_CREATED_ID](payload);

      // Assert
      expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith(
        'entity-1',
        'location-a'
      );
    });

    it('should not add an entity if it has no locationId', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { x: 5, y: 10 });
      const payload = { entity, wasReconstructed: false };

      // Act
      handlers[ENTITY_CREATED_ID](payload);

      // Assert
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
    });
  });

  describe('onEntityRemoved (entity:removed event)', () => {
    it('should remove an entity from the spatial index if it had a location', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { locationId: 'location-a' });
      const payload = { entity };

      // Act
      handlers[ENTITY_REMOVED_ID](payload);

      // Assert
      expect(mockSpatialIndexManager.removeEntity).toHaveBeenCalledWith(
        'entity-1',
        'location-a'
      );
    });

    it('should not attempt to remove an entity if it had no locationId', () => {
      // Arrange
      synchronizer = initializeSynchronizer();
      const entity = createMockEntity('entity-1', { x: 5, y: 10 });
      const payload = { entity };

      // Act
      handlers[ENTITY_REMOVED_ID](payload);

      // Assert
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
    });
  });

  describe('onComponentChanged (component:added/removed events)', () => {
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

      // Act
      handlers[COMPONENT_ADDED_ID](payload);

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

      // Act
      handlers[COMPONENT_ADDED_ID](payload);

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

      // Act
      handlers[COMPONENT_REMOVED_ID](payload);

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
        componentData: { locationId: 'location-a', x: 2 },
        oldComponentData: { locationId: 'location-a', x: 1 },
      };

      // Act
      handlers[COMPONENT_ADDED_ID](payload);

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

      // Act
      handlers[COMPONENT_ADDED_ID](payload);

      // Assert
      expect(
        mockSpatialIndexManager.updateEntityLocation
      ).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.addEntity).not.toHaveBeenCalled();
      expect(mockSpatialIndexManager.removeEntity).not.toHaveBeenCalled();
    });
  });
});
