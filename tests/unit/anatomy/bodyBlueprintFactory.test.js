import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('BodyBlueprintFactory', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
  let mockIdGenerator;
  let mockValidator;

  beforeEach(() => {
    // Create mocks
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
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockIdGenerator = {
      generateId: jest.fn().mockImplementation(() => 'generated-id'),
    };

    mockValidator = {
      validateGraph: jest.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    };

    // Create factory instance
    factory = new BodyBlueprintFactory({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      idGenerator: mockIdGenerator,
      validator: mockValidator,
    });
  });

  describe('constructor', () => {
    it('should throw error if entityManager is not provided', () => {
      expect(() => new BodyBlueprintFactory({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        idGenerator: mockIdGenerator,
        validator: mockValidator,
      })).toThrow(InvalidArgumentError);
    });

    it('should throw error if dataRegistry is not provided', () => {
      expect(() => new BodyBlueprintFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        idGenerator: mockIdGenerator,
        validator: mockValidator,
      })).toThrow(InvalidArgumentError);
    });

    it('should throw error if logger is not provided', () => {
      expect(() => new BodyBlueprintFactory({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        eventDispatcher: mockEventDispatcher,
        idGenerator: mockIdGenerator,
        validator: mockValidator,
      })).toThrow(InvalidArgumentError);
    });

    it('should throw error if eventDispatcher is not provided', () => {
      expect(() => new BodyBlueprintFactory({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        idGenerator: mockIdGenerator,
        validator: mockValidator,
      })).toThrow(InvalidArgumentError);
    });

    it('should throw error if idGenerator is not provided', () => {
      expect(() => new BodyBlueprintFactory({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        validator: mockValidator,
      })).toThrow(InvalidArgumentError);
    });

    it('should throw error if validator is not provided', () => {
      expect(() => new BodyBlueprintFactory({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        idGenerator: mockIdGenerator,
      })).toThrow(InvalidArgumentError);
    });
  });

  describe('createAnatomyGraph', () => {
    it('should create a simple anatomy graph', async () => {
      // Setup blueprint and recipe
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      const mockRootEntity = { id: 'root-1', definitionId: 'anatomy:torso' };
      mockEntityManager.createEntityInstance.mockReturnValue(mockRootEntity);

      // Act
      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      // Assert
      expect(result).toEqual({
        rootId: 'root-1',
        entities: ['root-1'],
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "BodyBlueprintFactory: Successfully created anatomy graph with 1 entities"
      );
    });

    it('should throw error if blueprint not found', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      await expect(factory.createAnatomyGraph('missing-blueprint', 'test-recipe'))
        .rejects.toThrow(InvalidArgumentError);
    });

    it('should throw error if recipe not found', async () => {
      const blueprint = { root: 'anatomy:torso' };
      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints') return blueprint;
        return null;
      });

      await expect(factory.createAnatomyGraph('test-blueprint', 'missing-recipe'))
        .rejects.toThrow(InvalidArgumentError);
    });

    it('should handle validation errors', async () => {
      const blueprint = { root: 'anatomy:torso' };
      const recipe = { recipeId: 'test-recipe', blueprintId: 'test-blueprint', slots: {} };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      mockEntityManager.createEntityInstance.mockReturnValue({ id: 'root-1' });
      mockValidator.validateGraph.mockResolvedValue({
        valid: false,
        errors: ['Test validation error'],
        warnings: [],
      });

      await expect(factory.createAnatomyGraph('test-blueprint', 'test-recipe'))
        .rejects.toThrow('Anatomy graph validation failed: Test validation error');
    });

    it('should handle validation warnings', async () => {
      const blueprint = { root: 'anatomy:torso' };
      const recipe = { recipeId: 'test-recipe', blueprintId: 'test-blueprint', slots: {} };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      mockEntityManager.createEntityInstance.mockReturnValue({ id: 'root-1' });
      mockValidator.validateGraph.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['Test warning'],
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(result.rootId).toBe('root-1');
      // Warnings are not logged by the factory, just returned by validator
    });

    it('should handle entity creation errors and cleanup', async () => {
      const blueprint = { root: 'anatomy:torso' };
      const recipe = { recipeId: 'test-recipe', blueprintId: 'test-blueprint', slots: {} };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      const error = new Error('Entity creation failed');
      mockEntityManager.createEntityInstance.mockImplementation(() => {
        throw error;
      });

      await expect(factory.createAnatomyGraph('test-blueprint', 'test-recipe'))
        .rejects.toThrow('Entity creation failed');

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: {
          error: error.message,
          context: 'BodyBlueprintFactory.createAnatomyGraph',
        },
      });
    });

    it('should process static attachments', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [
          { parent: 'anatomy:torso', socket: 'neck', child: 'anatomy:head' },
        ],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      const mockHeadEntity = { id: 'head-1', definitionId: 'anatomy:head' };
      
      mockEntityManager.createEntityInstance
        .mockReturnValueOnce(mockTorsoEntity)
        .mockReturnValueOnce(mockHeadEntity);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return mockTorsoEntity;
        if (id === 'head-1') return mockHeadEntity;
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [{ id: 'neck', allowedTypes: ['head'], maxCount: 1 }],
          };
        }
        if (componentId === 'anatomy:part') {
          if (entityId === 'head-1') return { subType: 'head' };
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(result.entities).toContain('torso-1');
      expect(result.entities).toContain('head-1');
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'head-1',
        'anatomy:joint',
        expect.objectContaining({
          parentId: 'torso-1',
          socketId: 'neck',
        })
      );
    });

    it('should process recipe slots', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          arms: {
            partType: 'arm',
            count: { exact: 2 },
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_arm') {
          return {
            components: {
              'anatomy:part': { subType: 'arm' },
            },
          };
        }
        return null;
      });

      mockDataRegistry.getAll.mockImplementation((registry) => {
        if (registry === 'entityDefinitions') {
          return [
            {
              id: 'anatomy:human_arm',
              components: {
                'anatomy:part': { subType: 'arm' },
              },
            },
          ];
        }
        return [];
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      const mockArmEntity1 = { id: 'arm-1', definitionId: 'anatomy:human_arm' };
      const mockArmEntity2 = { id: 'arm-2', definitionId: 'anatomy:human_arm' };
      
      mockEntityManager.createEntityInstance
        .mockReturnValueOnce(mockTorsoEntity)
        .mockReturnValueOnce(mockArmEntity1)
        .mockReturnValueOnce(mockArmEntity2);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return mockTorsoEntity;
        if (id === 'arm-1') return mockArmEntity1;
        if (id === 'arm-2') return mockArmEntity2;
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [
              { id: 'left_shoulder', allowedTypes: ['arm'], maxCount: 1 },
              { id: 'right_shoulder', allowedTypes: ['arm'], maxCount: 1 },
            ],
          };
        }
        if (componentId === 'anatomy:part') {
          if (entityId.startsWith('arm-')) return { subType: 'arm' };
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(result.entities).toHaveLength(3); // torso + 2 arms
      expect(result.entities).toContain('arm-1');
      expect(result.entities).toContain('arm-2');
    });

    it('should handle slot with preferId', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          head: {
            partType: 'head',
            preferId: 'anatomy:special_head',
            count: { exact: 1 },
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:special_head') {
          return {
            components: {
              'anatomy:part': { subType: 'head' },
            },
          };
        }
        return null;
      });

      // Need getAll for finding candidate parts
      mockDataRegistry.getAll.mockImplementation((registry) => {
        if (registry === 'entityDefinitions') {
          return [{
            id: 'anatomy:special_head',
            components: {
              'anatomy:part': { subType: 'head' },
            },
          }];
        }
        return [];
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      const mockHeadEntity = { id: 'head-1', definitionId: 'anatomy:special_head' };
      
      mockEntityManager.createEntityInstance
        .mockReturnValueOnce(mockTorsoEntity)
        .mockReturnValueOnce(mockHeadEntity);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return mockTorsoEntity;
        if (id === 'head-1') return mockHeadEntity;
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [{ id: 'neck', allowedTypes: ['head'], maxCount: 1 }],
          };
        }
        if (componentId === 'anatomy:part' && entityId === 'head-1') {
          return { subType: 'head' };
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith('anatomy:special_head');
      expect(result.entities).toContain('head-1');
    });

    it('should handle slot with tags filtering', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          eye: {
            partType: 'eye',
            tags: ['tag:blue'],
            count: { exact: 1 },
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:eye_blue') {
          return {
            components: {
              'anatomy:part': { subType: 'eye' },
              'tag:blue': {},
            },
          };
        }
        return null;
      });

      mockDataRegistry.getAll.mockImplementation((registry) => {
        if (registry === 'entityDefinitions') {
          return [
            {
              id: 'anatomy:eye_blue',
              components: {
                'anatomy:part': { subType: 'eye' },
                'tag:blue': {},
              },
            },
            {
              id: 'anatomy:eye_green',
              components: {
                'anatomy:part': { subType: 'eye' },
                'tag:green': {},
              },
            },
          ];
        }
        return [];
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      const mockEyeEntity = { id: 'eye-1', definitionId: 'anatomy:eye_blue' };
      
      mockEntityManager.createEntityInstance
        .mockReturnValueOnce(mockTorsoEntity)
        .mockReturnValueOnce(mockEyeEntity);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return mockTorsoEntity;
        if (id === 'eye-1') return mockEyeEntity;
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [{ id: 'eye_socket', allowedTypes: ['eye'], maxCount: 1 }],
          };
        }
        if (componentId === 'anatomy:part' && entityId === 'eye-1') {
          return { subType: 'eye' };
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(mockEntityManager.createEntityInstance).toHaveBeenNthCalledWith(2, 'anatomy:eye_blue');
      expect(result.entities).toContain('eye-1');
    });

    it('should handle slot with notTags filtering', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          eye: {
            partType: 'eye',
            notTags: ['tag:damaged'],
            count: { exact: 1 },
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:eye_healthy') {
          return {
            components: {
              'anatomy:part': { subType: 'eye' },
            },
          };
        }
        return null;
      });

      mockDataRegistry.getAll.mockImplementation((registry) => {
        if (registry === 'entityDefinitions') {
          return [
            {
              id: 'anatomy:eye_healthy',
              components: {
                'anatomy:part': { subType: 'eye' },
              },
            },
            {
              id: 'anatomy:eye_damaged',
              components: {
                'anatomy:part': { subType: 'eye' },
                'tag:damaged': {},
              },
            },
          ];
        }
        return [];
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      const mockEyeEntity = { id: 'eye-1', definitionId: 'anatomy:eye_healthy' };
      
      mockEntityManager.createEntityInstance
        .mockReturnValueOnce(mockTorsoEntity)
        .mockReturnValueOnce(mockEyeEntity);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return mockTorsoEntity;
        if (id === 'eye-1') return mockEyeEntity;
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [{ id: 'eye_socket', allowedTypes: ['eye'], maxCount: 1 }],
          };
        }
        if (componentId === 'anatomy:part' && entityId === 'eye-1') {
          return { subType: 'eye' };
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(mockEntityManager.createEntityInstance).toHaveBeenNthCalledWith(2, 'anatomy:eye_healthy');
      expect(result.entities).toContain('eye-1');
    });

    it('should warn when no parts match slot criteria', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          wing: {
            partType: 'wing',
            count: { exact: 2 },
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      mockDataRegistry.getAll.mockImplementation((registry) => {
        if (registry === 'entityDefinitions') {
          return []; // No wing definitions
        }
        return [];
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      mockEntityManager.createEntityInstance.mockReturnValue(mockTorsoEntity);
      
      // Mock entity and sockets so it tries to fill the wing slot
      mockEntityManager.getEntityInstance.mockReturnValue(mockTorsoEntity);
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return {
            sockets: [{ id: 'wing_socket', allowedTypes: ['wing'], maxCount: 2 }],
          };
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No candidate parts found for slot with type 'wing'"
      );
      expect(result.entities).toEqual(['torso-1']);
    });

    it('should handle entity cleanup on validation error', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      mockEntityManager.createEntityInstance.mockReturnValue(mockTorsoEntity);
      mockEntityManager.getEntityInstance.mockReturnValue(mockTorsoEntity);
      
      // Make validation fail
      mockValidator.validateGraph.mockResolvedValue({
        valid: false,
        errors: ['Test validation error'],
        warnings: [],
      });

      await expect(factory.createAnatomyGraph('test-blueprint', 'test-recipe'))
        .rejects.toThrow('Anatomy graph validation failed: Test validation error');

      // Should attempt to clean up the created torso
      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith('torso-1');
    });

    it('should handle missing sockets gracefully', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          arm: {
            partType: 'arm',
            count: { exact: 1 },
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:arm') {
          return {
            components: {
              'anatomy:part': { subType: 'arm' },
            },
          };
        }
        return null;
      });

      mockDataRegistry.getAll.mockImplementation((registry) => {
        if (registry === 'entityDefinitions') {
          return [
            {
              id: 'anatomy:arm',
              components: {
                'anatomy:part': { subType: 'arm' },
              },
            },
          ];
        }
        return [];
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      mockEntityManager.createEntityInstance.mockReturnValue(mockTorsoEntity);
      mockEntityManager.getEntityInstance.mockReturnValue(mockTorsoEntity);

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
          return null; // No sockets component
        }
        return null;
      });

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe');

      // No warning is logged when there are no sockets - it just silently skips
      expect(result.entities).toEqual(['torso-1']);
    });

    it('should use seeded random number generator when seed provided', async () => {
      const blueprint = {
        root: 'anatomy:torso',
        attachments: [],
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint') return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe') return recipe;
        return null;
      });

      const mockTorsoEntity = { id: 'torso-1', definitionId: 'anatomy:torso' };
      mockEntityManager.createEntityInstance.mockReturnValue(mockTorsoEntity);

      const result = await factory.createAnatomyGraph('test-blueprint', 'test-recipe', { seed: 12345 });

      expect(result.rootId).toBe('torso-1');
      // The seed should be used internally for consistent random selection
    });
  });
});