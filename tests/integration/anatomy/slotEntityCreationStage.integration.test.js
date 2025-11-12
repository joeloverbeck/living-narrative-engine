import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { executeSlotEntityCreation } from '../../../src/anatomy/workflows/stages/slotEntityCreationStage.js';

const BLUEPRINT_ID = 'test:coverage_blueprint';
const COMPONENT_DEFINITIONS = {
  'anatomy:blueprintSlot': {
    id: 'anatomy:blueprintSlot',
    data: { slotId: '', socketId: '', requirements: {} },
  },
  'clothing:slot_metadata': {
    id: 'clothing:slot_metadata',
    data: { slotMappings: {} },
  },
  'core:name': { id: 'core:name', data: { text: '' } },
};

const ENTITY_DEFINITIONS = {
  'test:owner': {
    id: 'test:owner',
    description: 'Owner entity used for slot metadata coverage tests',
    components: {},
  },
  'anatomy:blueprint_slot': {
    id: 'anatomy:blueprint_slot',
    description: 'Blueprint slot entity definition',
    components: {},
  },
};

const BASE_BLUEPRINT = {
  id: BLUEPRINT_ID,
  slots: {
    torsoSlot: {
      socket: 'torso_socket',
      requirements: { category: 'core' },
    },
    accessorySlot: {
      socket: 'accessory_socket',
      requirements: { category: 'accessory' },
    },
  },
  clothingSlotMappings: {
    torsoSlot: {
      anatomySockets: ['torso_socket'],
      allowedLayers: ['base'],
    },
    accessorySlot: {
      anatomySockets: ['accessory_socket'],
      allowedLayers: ['outer'],
    },
  },
};

const SINGLE_SLOT_BLUEPRINT = {
  id: BLUEPRINT_ID,
  slots: {
    problematicSlot: {
      socket: 'problem_socket',
      requirements: { category: 'problematic' },
    },
  },
  clothingSlotMappings: {},
};

/**
 * Creates a shallow clone of an object to prevent mutation between tests.
 *
 * @param {object} value - Value to clone
 * @returns {object} Cloned value
 */
const clone = (value) => JSON.parse(JSON.stringify(value));

describe('slotEntityCreationStage integration', () => {
  let testBed;
  let entityManager;
  let dataRegistry;
  let logger;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    entityManager = testBed.entityManager;
    dataRegistry = testBed.registry;
    logger = testBed.logger;

    testBed.loadComponents(COMPONENT_DEFINITIONS);
    testBed.loadEntityDefinitions(ENTITY_DEFINITIONS);
    dataRegistry.store('anatomyBlueprints', BLUEPRINT_ID, clone(BASE_BLUEPRINT));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (testBed) {
      await testBed.cleanup();
    }
  });

  const createOwnerEntity = async (id = 'owner-entity') => {
    const entity = await entityManager.createEntityInstance('test:owner', {
      instanceId: id,
    });

    return typeof entity === 'string' ? entity : entity.id;
  };

  const createGraphResult = (entities = []) => ({
    entities: [...entities],
  });

  const runStage = (contextOverrides = {}, dependencyOverrides = {}) =>
    executeSlotEntityCreation(
      {
        blueprintId: BLUEPRINT_ID,
        graphResult: contextOverrides.graphResult || createGraphResult(),
        ownerId: contextOverrides.ownerId,
        ...contextOverrides,
      },
      {
        entityManager,
        dataRegistry,
        logger,
        ...dependencyOverrides,
      }
    );

  it('creates blueprint slot entities and clothing metadata using production services', async () => {
    const ownerId = await createOwnerEntity();
    const graphResult = createGraphResult();

    const { slotEntityMappings } = await runStage({ ownerId, graphResult });

    expect(slotEntityMappings.size).toBe(2);
    expect(graphResult.entities).toHaveLength(2);

    for (const [slotId, entityId] of slotEntityMappings.entries()) {
      expect(typeof entityId).toBe('string');
      const slotEntity = entityManager.getEntityInstance(entityId);
      expect(slotEntity).toBeDefined();
      expect(slotEntity.hasComponent('anatomy:blueprintSlot')).toBe(true);

      const component = slotEntity.getComponentData('anatomy:blueprintSlot');
      expect(component.slotId).toBe(slotId);
      expect(component.socketId).toBeDefined();
      expect(component.requirements).toEqual(
        BASE_BLUEPRINT.slots[slotId].requirements
      );
    }

    const ownerEntity = entityManager.getEntityInstance(ownerId);
    expect(ownerEntity).toBeDefined();

    const metadata = ownerEntity.getComponentData('clothing:slot_metadata');
    expect(metadata).toBeDefined();
    expect(metadata.slotMappings).toEqual({
      torsoSlot: {
        coveredSockets: ['torso_socket'],
        allowedLayers: ['base'],
      },
      accessorySlot: {
        coveredSockets: ['accessory_socket'],
        allowedLayers: ['outer'],
      },
    });
  });

  it('logs warnings when graph contains missing or invalid slot data', async () => {
    const ownerId = await createOwnerEntity();
    const invalidSlotId = 'invalid-slot';

    await entityManager.createEntityInstance('anatomy:blueprint_slot', {
      instanceId: invalidSlotId,
    });
    await entityManager.addComponent(invalidSlotId, 'anatomy:blueprintSlot', {
      slotId: null,
      socketId: 'dangling_socket',
      requirements: {},
    });

    const graphResult = createGraphResult(['ghost-slot', invalidSlotId]);

    const { slotEntityMappings } = await runStage({ ownerId, graphResult });

    expect(slotEntityMappings.size).toBe(2);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not retrieve entity instance for ID 'ghost-slot'")
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Component data missing or invalid for entity')
    );
  });

  it('throws when slot entity creation returns an unsupported type', async () => {
    dataRegistry.store('anatomyBlueprints', BLUEPRINT_ID, clone(SINGLE_SLOT_BLUEPRINT));

    const ownerId = await createOwnerEntity('owner-unsupported-type');
    const graphResult = createGraphResult();

    const originalCreate = entityManager.createEntityInstance.bind(entityManager);
    jest
      .spyOn(entityManager, 'createEntityInstance')
      .mockImplementationOnce(async (...args) => {
        if (args[0] === 'anatomy:blueprint_slot') {
          return 42;
        }
        return originalCreate(...args);
      });

    await expect(runStage({ ownerId, graphResult })).rejects.toThrow(
      'Invalid entity returned for slot problematicSlot'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected entity type returned')
    );
  });

  it('throws when the generated slot entity ID is not a string', async () => {
    dataRegistry.store('anatomyBlueprints', BLUEPRINT_ID, clone(SINGLE_SLOT_BLUEPRINT));

    const ownerId = await createOwnerEntity('owner-invalid-id');
    const graphResult = createGraphResult();

    const originalCreate = entityManager.createEntityInstance.bind(entityManager);
    jest
      .spyOn(entityManager, 'createEntityInstance')
      .mockImplementationOnce(async (...args) => {
        if (args[0] === 'anatomy:blueprint_slot') {
          return { id: '' };
        }
        return originalCreate(...args);
      });

    await expect(runStage({ ownerId, graphResult })).rejects.toThrow(
      'Invalid entity ID for slot problematicSlot'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid entity ID extracted')
    );
  });

  it('propagates failures when component verification does not pass', async () => {
    dataRegistry.store('anatomyBlueprints', BLUEPRINT_ID, clone(SINGLE_SLOT_BLUEPRINT));

    const ownerId = await createOwnerEntity('owner-component-verification');
    const graphResult = createGraphResult();

    const originalCreate = entityManager.createEntityInstance.bind(entityManager);
    const createdIds = [];

    jest
      .spyOn(entityManager, 'createEntityInstance')
      .mockImplementation(async (...args) => {
        const result = await originalCreate(...args);
        if (args[0] === 'anatomy:blueprint_slot') {
          const id = typeof result === 'string' ? result : result.id;
          createdIds.push(id);
        }
        return result;
      });

    const originalGet = entityManager.getEntityInstance.bind(entityManager);
    jest.spyOn(entityManager, 'getEntityInstance').mockImplementation((id) => {
      if (createdIds.includes(id)) {
        return {
          hasComponent: () => false,
          getComponentData: () => null,
        };
      }
      return originalGet(id);
    });

    await expect(runStage({ ownerId, graphResult })).rejects.toThrow(
      'Component addition verification failed for slot problematicSlot'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Component verification failed for slot')
    );
    const failureCall = logger.error.mock.calls.find(([message]) =>
      typeof message === 'string' &&
      message.includes('Failed to create blueprint slot entity for')
    );
    expect(failureCall).toBeDefined();
    expect(failureCall[1]).toBeInstanceOf(Error);
  });

  it('continues execution when clothing slot metadata creation fails', async () => {
    dataRegistry.store('anatomyBlueprints', BLUEPRINT_ID, clone(BASE_BLUEPRINT));

    const ownerId = await createOwnerEntity('owner-metadata-failure');
    const graphResult = createGraphResult();

    const originalAdd = entityManager.addComponent.bind(entityManager);
    jest
      .spyOn(entityManager, 'addComponent')
      .mockImplementation(async (entityId, componentTypeId, componentData) => {
        if (componentTypeId === 'clothing:slot_metadata') {
          throw new Error('metadata failure');
        }
        return originalAdd(entityId, componentTypeId, componentData);
      });

    const { slotEntityMappings } = await runStage({ ownerId, graphResult });

    expect(slotEntityMappings.size).toBe(2);

    const ownerEntity = entityManager.getEntityInstance(ownerId);
    expect(ownerEntity.hasComponent('clothing:slot_metadata')).toBe(false);

    const metadataFailureLog = logger.error.mock.calls.find(([message]) =>
      typeof message === 'string' &&
      message.includes('Failed to create clothing slot metadata')
    );

    expect(metadataFailureLog).toBeDefined();
    expect(metadataFailureLog[1]).toBeInstanceOf(Error);
  });
});
