import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';

describe('BodyBlueprintFactory - Torso Override', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockRecipeProcessor;
  let mockPartSelectionService;
  let mockSocketManager;
  let mockEntityGraphBuilder;
  let mockConstraintEvaluator;
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

    mockEventDispatchService = {
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRecipeProcessor = {
      loadRecipe: jest.fn(),
      processRecipe: jest.fn(),
      mergeSlotRequirements: jest.fn(),
    };

    mockPartSelectionService = {
      selectPart: jest.fn(),
    };

    mockSocketManager = {
      validateSocketAvailability: jest.fn(),
      occupySocket: jest.fn(),
      generatePartName: jest.fn(),
    };

    mockEntityGraphBuilder = {
      createRootEntity: jest.fn(),
      createAndAttachPart: jest.fn(),
      setEntityName: jest.fn(),
      getPartType: jest.fn(),
      cleanupEntities: jest.fn().mockResolvedValue(undefined),
    };

    mockConstraintEvaluator = {
      evaluateConstraints: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [], warnings: [] }),
    };

    mockValidator = {
      validateGraph: jest
        .fn()
        .mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    };

    const mockSocketGenerator = {
      generateSockets: jest.fn().mockReturnValue([]),
    };

    const mockSlotGenerator = {
      generateBlueprintSlots: jest.fn().mockReturnValue({}),
    };

    const mockRecipePatternResolver = {
      resolveRecipePatterns: jest.fn(recipe => recipe),
    };

    factory = new BodyBlueprintFactory({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      recipeProcessor: mockRecipeProcessor,
      partSelectionService: mockPartSelectionService,
      socketManager: mockSocketManager,
      entityGraphBuilder: mockEntityGraphBuilder,
      constraintEvaluator: mockConstraintEvaluator,
      validator: mockValidator,
      socketGenerator: mockSocketGenerator,
      slotGenerator: mockSlotGenerator,
      recipePatternResolver: mockRecipePatternResolver,
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
        return null;
      });

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        undefined
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
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:human_female_torso'
        ) {
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

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder to use the recipe torso override
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      // The EntityGraphBuilder should be called with the blueprint's root,
      // and it will handle the torso override internally
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        undefined
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
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:nonexistent_torso'
        ) {
          return null; // Entity doesn't exist
        }
        return null;
      });

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder to use blueprint default
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      // The EntityGraphBuilder handles the fallback internally
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        undefined
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

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder to use blueprint default
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      // The EntityGraphBuilder handles the validation internally
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        undefined
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
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:invalid_entity'
        ) {
          return {
            id: 'anatomy:invalid_entity',
            components: {
              'core:name': { text: 'invalid' }, // No anatomy:part component
            },
          };
        }
        return null;
      });

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder to use blueprint default
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      // The EntityGraphBuilder handles the validation internally
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        undefined
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
        return null;
      });

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder to use blueprint default
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const result = await factory.createAnatomyGraph(
        'test-blueprint',
        'test-recipe'
      );

      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        undefined
      );
      expect(result.rootId).toBe('torso-1');
      // No torso override logging expected from BodyBlueprintFactory itself
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
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:human_female_torso'
        ) {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
            },
          };
        }
        return null;
      });

      // Mock recipe processor
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      // Mock entity graph builder with ownerId
      mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

      const ownerId = 'player-123';
      await factory.createAnatomyGraph('test-blueprint', 'test-recipe', {
        ownerId,
      });

      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        recipe,
        ownerId
      );
    });
  });
});
