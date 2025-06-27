const EntityManager = require('../../../src/entities/entityManager').default;
const Entity = require('../../../src/entities/entity').default;
const EntityDefinition =
  require('../../../src/entities/entityDefinition').default;
const { ENTITY_CREATED_ID } = require('../../../src/constants/eventIds');
const {
  createSimpleMockDataRegistry,
  createMockLogger,
  createMockSchemaValidator,
  createCapturingEventBus,
} = require('../../common/mockFactories.js');

const mockRegistry = createSimpleMockDataRegistry();
const mockLogger = createMockLogger();
const mockValidator = createMockSchemaValidator();

const createDispatcher = () => createCapturingEventBus();

describe('EntityManager - core:entity_created event payload', () => {
  it('should include the entity object and all required fields in the event payload', () => {
    const dispatcher = createDispatcher();
    const entityManager = new EntityManager({
      registry: mockRegistry,
      logger: mockLogger,
      validator: mockValidator,
      dispatcher,
    });
    const definition = new EntityDefinition('test:def', {
      description: 'Test entity',
      components: { 'core:position': { locationId: 'loc1' } },
    });
    mockRegistry.getEntityDefinition.mockReturnValue(definition);

    const entity = entityManager.createEntityInstance('test:def');
    const event = dispatcher.events[0];

    expect(event).toBeTruthy();
    const receivedPayload = event.payload;
    expect(receivedPayload).toHaveProperty('entity');
    expect(receivedPayload).toHaveProperty('instanceId', entity.id);
    expect(receivedPayload).toHaveProperty('definitionId', entity.definitionId);
    expect(receivedPayload).toHaveProperty('wasReconstructed', false);
    expect(receivedPayload.entity).toBeInstanceOf(Entity);
    expect(receivedPayload.entity.id).toBe(entity.id);
    expect(receivedPayload.entity.getComponentData('core:position')).toEqual({
      locationId: 'loc1',
    });
  });

  it('should allow a consumer to call getComponentData on the entity in the payload', () => {
    const dispatcher = createDispatcher();
    const entityManager = new EntityManager({
      registry: mockRegistry,
      logger: mockLogger,
      validator: mockValidator,
      dispatcher,
    });
    const definition = new EntityDefinition('test:def', {
      description: 'Test entity',
      components: { 'core:position': { locationId: 'loc2' } },
    });
    mockRegistry.getEntityDefinition.mockReturnValue(definition);

    entityManager.createEntityInstance('test:def');
    const event = dispatcher.events[0];
    const pos = event.payload.entity.getComponentData('core:position');
    expect(pos).toEqual({ locationId: 'loc2' });
  });
});
