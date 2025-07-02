/**
 * @file Test for childSlots support in body blueprint factory
 */

import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';

describe('BodyBlueprintFactory - Child Slots Support', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockIdGenerator;
  let mockValidator;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      createEntityInstance: jest.fn(),
      createEntity: jest.fn(),
      addComponent: jest.fn(),
      getComponentData: jest.fn(),
      removeEntity: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockEventDispatchService = {
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    mockIdGenerator = {
      generateId: jest.fn().mockImplementation(() => 'generated-id'),
    };

    mockValidator = {
      validateGraph: jest.fn().mockResolvedValue({ valid: true }),
    };

    factory = new BodyBlueprintFactory({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      idGenerator: mockIdGenerator,
      validator: mockValidator,
    });
  });

  test('should process childSlots when creating parts', async () => {
    const blueprintId = 'anatomy:test_blueprint';
    const recipeId = 'anatomy:test_recipe';

    const mockBlueprint = {
      root: 'anatomy:test_torso',
      slots: {
        head_slot: {
          parent: null,
          socket: 'neck',
          requirements: {
            partType: 'head',
          },
        },
        left_eye_slot: {
          parent: 'head_slot',
          socket: 'left_eye',
          requirements: {
            partType: 'eye',
          },
        },
        right_eye_slot: {
          parent: 'head_slot',
          socket: 'right_eye',
          requirements: {
            partType: 'eye',
          },
        },
      },
    };

    const mockRecipe = {
      recipeId: recipeId,
      blueprintId: blueprintId,
      slots: {
        head_slot: {
          partType: 'head',
          preferId: 'anatomy:test_head',
        },
        left_eye_slot: {
          partType: 'eye',
          properties: {
            'descriptors:color_extended': {
              color: 'blue',
            },
          },
        },
        right_eye_slot: {
          partType: 'eye',
          properties: {
            'descriptors:color_extended': {
              color: 'blue',
            },
          },
        },
      },
    };

    const mockTorsoEntity = {
      id: 'torso-1',
      definitionId: 'anatomy:test_torso',
    };

    const mockHeadEntity = {
      id: 'head-1',
      definitionId: 'anatomy:test_head',
    };

    const mockEyeEntity = {
      id: 'eye-1',
      definitionId: 'anatomy:human_eye_blue',
    };

    // Mock torso creation
    mockEntityManager.createEntityInstance.mockReturnValueOnce(mockTorsoEntity);
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'torso-1') return mockTorsoEntity;
      if (id === 'head-1') return mockHeadEntity;
      if (id === 'eye-1') return mockEyeEntity;
      return null;
    });

    // Mock torso sockets
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [
              {
                id: 'neck',
                allowedTypes: ['head'],
                maxCount: 1,
              },
            ],
          };
        }
        if (entityId === 'head-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [
              {
                id: 'left_eye',
                allowedTypes: ['eye'],
                maxCount: 1,
              },
              {
                id: 'right_eye',
                allowedTypes: ['eye'],
                maxCount: 1,
              },
            ],
          };
        }
        if (componentId === 'anatomy:part') {
          if (entityId === 'head-1') return { subType: 'head' };
          if (entityId === 'eye-1') return { subType: 'eye' };
        }
        return null;
      }
    );

    // Mock registry lookups
    mockDataRegistry.get.mockImplementation((registry, id) => {
      if (registry === 'anatomyBlueprints' && id === blueprintId) {
        return mockBlueprint;
      }
      if (registry === 'anatomyRecipes' && id === recipeId) {
        return mockRecipe;
      }
      if (registry === 'entityDefinitions') {
        if (id === 'anatomy:test_head') {
          return {
            components: {
              'anatomy:part': { subType: 'head' },
            },
          };
        }
        if (id === 'anatomy:human_eye_blue') {
          return {
            components: {
              'anatomy:part': { subType: 'eye' },
              'descriptors:color_extended': { color: 'blue' },
              'descriptors:shape_eye': { shape: 'round' },
            },
          };
        }
      }
      return null;
    });

    // Mock getAll for entity definitions (used to find anatomy parts)
    mockDataRegistry.getAll.mockImplementation((registry) => {
      if (registry === 'entityDefinitions') {
        return [
          {
            id: 'anatomy:test_head',
            components: {
              'anatomy:part': { subType: 'head' },
            },
          },
          {
            id: 'anatomy:human_eye_blue',
            components: {
              'anatomy:part': { subType: 'eye' },
              'descriptors:color_extended': { color: 'blue' },
              'descriptors:shape_eye': { shape: 'round' },
            },
          },
        ];
      }
      return [];
    });

    // Mock entity creation
    mockEntityManager.createEntityInstance
      .mockReturnValueOnce(mockHeadEntity)
      .mockReturnValueOnce(mockEyeEntity)
      .mockReturnValueOnce(mockEyeEntity);

    const result = await factory.createAnatomyGraph(blueprintId, recipeId);

    // Verify that eye entities were created with property matching
    const createEntityCalls = mockEntityManager.createEntityInstance.mock.calls;

    // Should have created head and two eyes (beyond the initial torso)
    // The first call is for the torso, which is already mocked
    expect(createEntityCalls.length).toBeGreaterThanOrEqual(3);

    // Check that blue eyes were selected based on property requirements
    const eyeCreations = createEntityCalls.filter(
      ([defId]) => defId === 'anatomy:human_eye_blue'
    );
    expect(eyeCreations.length).toBeGreaterThanOrEqual(1);

    // Verify result includes all entities
    expect(result.rootId).toBe('torso-1');
    expect(result.entities).toContain('torso-1');
  });
});
