const EntityManager = require('../../../src/entities/entityManager').default;
const Entity = require('../../../src/entities/entity').default;
const EntityDefinition = require('../../../src/entities/entityDefinition').default;
const { ENTITY_CREATED_ID } = require('../../../src/constants/eventIds');

// Minimal mock registry, logger, and validator
const mockRegistry = {
  getEntityDefinition: jest.fn(),
};
const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() };
const mockValidator = { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) };

// Minimal event dispatcher
class TestEventDispatcher {
  constructor() { this.listeners = {}; }
  subscribe(eventId, fn) {
    this.listeners[eventId] = this.listeners[eventId] || [];
    this.listeners[eventId].push(fn);
  }
  dispatch(eventId, payload) {
    (this.listeners[eventId] || []).forEach(fn => fn(payload));
  }
}

describe('EntityManager - core:entity_created event payload', () => {
  it('should include the entity object and all required fields in the event payload', () => {
    // Arrange
    const dispatcher = new TestEventDispatcher();
    const entityManager = new EntityManager({
      registry: mockRegistry,
      logger: mockLogger,
      validator: mockValidator,
      dispatcher,
    });
    const definition = new EntityDefinition(
      'test:def',
      {
        description: 'Test entity',
        components: { 'core:position': { locationId: 'loc1' } },
      }
    );
    mockRegistry.getEntityDefinition.mockReturnValue(definition);

    let receivedPayload = null;
    dispatcher.subscribe(ENTITY_CREATED_ID, (payload) => {
      receivedPayload = payload;
    });

    // Act
    const entity = entityManager.createEntityInstance('test:def');

    // Assert
    expect(receivedPayload).toBeTruthy();
    expect(receivedPayload).toHaveProperty('entity');
    expect(receivedPayload).toHaveProperty('instanceId', entity.id);
    expect(receivedPayload).toHaveProperty('definitionId', entity.definitionId);
    expect(receivedPayload).toHaveProperty('wasReconstructed', false);
    expect(receivedPayload.entity).toBeInstanceOf(Entity);
    expect(receivedPayload.entity.id).toBe(entity.id);
    expect(receivedPayload.entity.getComponentData('core:position')).toEqual({ locationId: 'loc1' });
  });

  it('should allow a consumer to call getComponentData on the entity in the payload', () => {
    // Arrange
    const dispatcher = new TestEventDispatcher();
    const entityManager = new EntityManager({
      registry: mockRegistry,
      logger: mockLogger,
      validator: mockValidator,
      dispatcher,
    });
    const definition = new EntityDefinition(
      'test:def',
      {
        description: 'Test entity',
        components: { 'core:position': { locationId: 'loc2' } },
      }
    );
    mockRegistry.getEntityDefinition.mockReturnValue(definition);

    let called = false;
    dispatcher.subscribe(ENTITY_CREATED_ID, (payload) => {
      // Simulate SpatialIndexSynchronizer
      const pos = payload.entity.getComponentData('core:position');
      expect(pos).toEqual({ locationId: 'loc2' });
      called = true;
    });

    // Act
    entityManager.createEntityInstance('test:def');
    expect(called).toBe(true);
  });
}); 