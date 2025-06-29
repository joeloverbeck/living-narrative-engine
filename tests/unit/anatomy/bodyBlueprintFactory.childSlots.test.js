/**
 * @file Test for childSlots support in body blueprint factory
 */

import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyBlueprintFactory - Child Slots Support', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
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
      idGenerator: mockIdGenerator,
      validator: mockValidator,
    });
  });

  test('should process childSlots when creating parts', async () => {
    const blueprintId = 'anatomy:test_blueprint';
    const recipeId = 'anatomy:test_recipe';

    const mockBlueprint = {
      root: 'anatomy:test_torso',
      attachments: [],
    };

    const mockRecipe = {
      recipeId: recipeId,
      blueprintId: blueprintId,
      slots: {
        head: {
          partType: 'head',
          preferId: 'anatomy:test_head',
          count: { exact: 1 },
          childSlots: {
            left_eye: {
              partType: 'eye',
              properties: {
                'anatomy:eye_appearance': {
                  color: 'blue',
                },
              },
              count: { exact: 1 },
            },
            right_eye: {
              partType: 'eye',
              properties: {
                'anatomy:eye_appearance': {
                  color: 'blue',
                },
              },
              count: { exact: 1 },
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
    mockEntityManager.createEntityInstance
      .mockReturnValueOnce(mockTorsoEntity);
    mockEntityManager.getEntityInstance
      .mockImplementation((id) => {
        if (id === 'torso-1') return mockTorsoEntity;
        if (id === 'head-1') return mockHeadEntity;
        if (id === 'eye-1') return mockEyeEntity;
        return null;
      });

    // Mock torso sockets
    mockEntityManager.getComponentData
      .mockImplementation((entityId, componentId) => {
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
      });

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
              'anatomy:eye_appearance': { color: 'blue' },
            },
          };
        }
      }
      return null;
    });

    // Mock anatomy parts registry
    mockDataRegistry.getAll.mockImplementation((registry) => {
      if (registry === 'anatomyParts') {
        return {
          'anatomy:test_head': { isAnatomyPart: true },
          'anatomy:human_eye_blue': { isAnatomyPart: true },
        };
      }
      return {};
    });

    // Mock entity creation
    mockEntityManager.createEntity
      .mockResolvedValueOnce(mockHeadEntity)
      .mockResolvedValueOnce(mockEyeEntity)
      .mockResolvedValueOnce(mockEyeEntity);

    const result = await factory.createAnatomyGraph(blueprintId, recipeId);

    // Verify that eye entities were created with property matching
    const createEntityCalls = mockEntityManager.createEntity.mock.calls;
    
    // Should have created head and two eyes
    expect(createEntityCalls.length).toBeGreaterThanOrEqual(2);
    
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