import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';

describe('BodyBlueprintFactory - Torso Override', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
  let mockEventDispatchService;
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
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockValidator = {
      validateGraph: jest
        .fn()
        .mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    };

    mockEventDispatchService = {
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    factory = new BodyBlueprintFactory({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      validator: mockValidator,
    });
  });

  describe('torso override functionality', () => {
    it('should use blueprint default torso when recipe has no torso override', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        return null;
      });

      const mockTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(result.rootId).toBe('torso-1');
      expect(result.entities).toEqual(['torso-1']);
    });

    it('should use recipe torso override when valid torso preferId is provided', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_female_torso',
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_female_torso') {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': { sockets: [] },
              'core:name': { text: 'torso' },
            },
          };
        }
        return null;
      });

      const mockFemaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_female_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockFemaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using recipe torso override: 'anatomy:human_female_torso' instead of blueprint default: 'anatomy:human_male_torso'"
      );
      expect(result.rootId).toBe('torso-1');
      expect(result.entities).toEqual(['torso-1']);
    });

    it('should fall back to blueprint default when recipe torso override entity does not exist', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:nonexistent_torso',
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:nonexistent_torso') {
          return null; // Entity doesn't exist
        }
        return null;
      });

      const mockMaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Recipe torso override 'anatomy:nonexistent_torso' not found in registry, using blueprint default"
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should fall back to blueprint default when recipe torso override is not a valid torso part', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_head', // Not a torso part
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_head') {
          return {
            id: 'anatomy:human_head',
            components: {
              'anatomy:part': { subType: 'head' }, // Not a torso
            },
          };
        }
        return null;
      });

      const mockMaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Recipe torso override 'anatomy:human_head' is not a valid torso part, using blueprint default"
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should fall back to blueprint default when recipe torso override has no anatomy:part component', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:invalid_entity',
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:invalid_entity') {
          return {
            id: 'anatomy:invalid_entity',
            components: {
              'core:name': { text: 'invalid' }, // No anatomy:part component
            },
          };
        }
        return null;
      });

      const mockMaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Recipe torso override 'anatomy:invalid_entity' is not a valid torso part, using blueprint default"
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use blueprint default when recipe has torso slot but no preferId', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          torso: {
            partType: 'torso',
            // No preferId specified
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        return null;
      });

      const mockMaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(result.rootId).toBe('torso-1');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Using recipe torso override')
      );
    });

    it('should still add ownership component when using torso override', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso',
        slots: {},
      };
      const recipe = {
        recipeId: 'test-recipe',
        blueprintId: 'test-blueprint',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_female_torso',
          },
        },
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'test-blueprint')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'test-recipe')
          return recipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_female_torso') {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
            },
          };
        }
        return null;
      });

      const mockFemaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_female_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockFemaleTorsoEntity);

      const ownerId = 'player-123';
      await factory.createAnatomyGraph('test-blueprint', 'test-recipe', {
        ownerId,
      });

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso'
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'torso-1',
        'core:owned_by',
        { ownerId }
      );
    });
  });
});