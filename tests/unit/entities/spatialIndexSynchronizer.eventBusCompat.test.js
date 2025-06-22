const { SpatialIndexSynchronizer } = require('../../../src/entities/spatialIndexSynchronizer');
const { ENTITY_CREATED_ID } = require('../../../src/constants/eventIds');

// Mocks
const mockSpatialIndex = { addEntity: jest.fn() };
const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() };

/**
 *
 * @param id
 * @param locationId
 */
function makeEntity(id, locationId) {
  return {
    id,
    getComponentData: jest.fn((componentId) => {
      if (componentId === 'core:position') {
        return { locationId };
      }
      return undefined;
    }),
  };
}

describe('SpatialIndexSynchronizer - EventBus compatibility', () => {
  it('should extract entity from payload when event is passed as {type, payload}', () => {
    // Arrange
    const mockDispatcher = { subscribe: jest.fn() };
    const synchronizer = new SpatialIndexSynchronizer({
      spatialIndexManager: mockSpatialIndex,
      safeEventDispatcher: mockDispatcher,
      logger: mockLogger,
    });

    // Find the actual handler registered for ENTITY_CREATED_ID
    const handler = mockDispatcher.subscribe.mock.calls.find(
      ([eventId]) => eventId === ENTITY_CREATED_ID
    )[1];

    const entity = makeEntity('e1', 'loc1');
    const eventObject = {
      type: ENTITY_CREATED_ID,
      payload: {
        instanceId: 'e1',
        definitionId: 'def1',
        wasReconstructed: false,
        entity,
      },
    };

    // Act
    handler(eventObject.payload);

    // Assert
    expect(entity.getComponentData).toHaveBeenCalledWith('core:position');
    expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith('e1', 'loc1');
  });

  it('should not throw if entity is missing in payload', () => {
    const mockDispatcher = { subscribe: jest.fn() };
    const synchronizer = new SpatialIndexSynchronizer({
      spatialIndexManager: mockSpatialIndex,
      safeEventDispatcher: mockDispatcher,
      logger: mockLogger,
    });
    const handler = mockDispatcher.subscribe.mock.calls.find(
      ([eventId]) => eventId === ENTITY_CREATED_ID
    )[1];
    const eventObject = {
      type: ENTITY_CREATED_ID,
      payload: {
        instanceId: 'e2',
        definitionId: 'def2',
        wasReconstructed: false,
        // entity missing
      },
    };
    expect(() => handler(eventObject.payload)).not.toThrow();
  });
}); 