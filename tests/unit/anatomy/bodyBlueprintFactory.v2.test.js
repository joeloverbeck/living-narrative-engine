import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('BodyBlueprintFactory - V2 Blueprint Processing', () => {
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
  let mockSocketGenerator;
  let mockSlotGenerator;
  let mockBlueprintProcessorService;

  beforeEach(() => {
    // Create base mocks
    mockEntityManager = {
      getComponentData: jest.fn().mockReturnValue(undefined),
    };

    mockDataRegistry = {
      get: jest.fn(),
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
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRecipeProcessor = {
      loadRecipe: jest.fn(),
      processRecipe: jest.fn(),
      mergeSlotRequirements: jest.fn((requirements) => requirements),
    };

    mockPartSelectionService = {
      selectPart: jest.fn().mockResolvedValue('anatomy:test_part'),
    };

    mockSocketManager = {
      validateSocketAvailability: jest.fn().mockReturnValue({
        valid: true,
        socket: {
          id: 'test_socket',
          orientation: 'left',
          allowedTypes: ['test'],
        },
      }),
      occupySocket: jest.fn(),
      generatePartName: jest.fn().mockReturnValue('Test Part'),
    };

    mockEntityGraphBuilder = {
      createRootEntity: jest.fn(),
      createAndAttachPart: jest.fn().mockResolvedValue('child-entity-1'),
      setEntityName: jest.fn(),
      getPartType: jest.fn().mockReturnValue('test_part_type'),
      cleanupEntities: jest.fn().mockResolvedValue(undefined),
      addSocketsToEntity: jest.fn().mockResolvedValue(undefined),
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

    // V2-specific mocks
    mockSocketGenerator = {
      generateSockets: jest.fn(),
    };

    mockSlotGenerator = {
      generateBlueprintSlots: jest.fn(),
    };

    mockBlueprintProcessorService = {
      processBlueprint: jest.fn((blueprint) => blueprint),
    };

    // Create factory instance
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
      recipePatternResolver: {
        resolveRecipePatterns: jest.fn((recipe) => recipe),
      },
      blueprintProcessorService: mockBlueprintProcessorService,
    });
  });

  describe('constructor validation', () => {
    it('should throw error if socketGenerator is not provided', () => {
      expect(
        () =>
          new BodyBlueprintFactory({
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
            slotGenerator: mockSlotGenerator,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if slotGenerator is not provided', () => {
      expect(
        () =>
          new BodyBlueprintFactory({
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
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('V1 Blueprint Processing (Backward Compatibility)', () => {
    it('should return v1 blueprint unchanged when schemaVersion is omitted', async () => {
      const v1Blueprint = {
        id: 'anatomy:humanoid_v1',
        root: 'anatomy:torso',
        slots: {
          left_arm: {
            socket: 'left_shoulder',
            requirements: { partType: 'arm' },
            optional: false,
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v1Blueprint;
        return null;
      });

      const recipe = { recipeId: 'anatomy:human_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await factory.createAnatomyGraph(
        'anatomy:humanoid_v1',
        'anatomy:human_standard'
      );

      // Verify blueprint was loaded but not processed through v2 path
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyBlueprints',
        'anatomy:humanoid_v1'
      );
      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });

    it('should return v1 blueprint unchanged when schemaVersion is "1.0"', async () => {
      const v1Blueprint = {
        id: 'anatomy:humanoid_v1',
        schemaVersion: '1.0',
        root: 'anatomy:torso',
        slots: {
          left_arm: {
            socket: 'left_shoulder',
            requirements: { partType: 'arm' },
            optional: false,
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v1Blueprint;
        return null;
      });

      const recipe = { recipeId: 'anatomy:human_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await factory.createAnatomyGraph(
        'anatomy:humanoid_v1',
        'anatomy:human_standard'
      );

      // Verify v2 processing was not triggered
      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });

    it('should not trigger v2 processing when schemaVersion is "2.0" but structureTemplate is missing', async () => {
      const malformedBlueprint = {
        id: 'anatomy:glitched_v2',
        schemaVersion: '2.0',
        root: 'anatomy:torso',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return malformedBlueprint;
        return null;
      });

      const recipe = { recipeId: 'anatomy:default', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await factory.createAnatomyGraph(
        'anatomy:glitched_v2',
        'anatomy:default'
      );

      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
      expect(mockEntityGraphBuilder.addSocketsToEntity).not.toHaveBeenCalled();
    });
  });

  describe('V2 Blueprint Processing', () => {
    it('should use processed blueprint from blueprintProcessorService', async () => {
      const v2Blueprint = {
        id: 'anatomy-creatures:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy-creatures:spider_body',
        structureTemplate: 'anatomy:template_spider_octopedal',
      };

      const generatedSockets = [
        {
          id: 'leg_anterior',
          orientation: 'anterior',
          allowedTypes: ['spider_leg'],
        },
        {
          id: 'leg_anterior_right',
          orientation: 'anterior_right',
          allowedTypes: ['spider_leg'],
        },
      ];

      const generatedSlots = {
        leg_anterior: {
          socket: 'leg_anterior',
          requirements: { partType: 'leg' },
          optional: false,
        },
        leg_anterior_right: {
          socket: 'leg_anterior_right',
          requirements: { partType: 'leg' },
          optional: false,
        },
      };

      // The processed blueprint returned by blueprintProcessorService
      const processedBlueprint = {
        ...v2Blueprint,
        slots: generatedSlots,
        _generatedSockets: generatedSockets,
        _generatedSlots: generatedSlots,
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      // Mock blueprintProcessorService to return processed blueprint
      mockBlueprintProcessorService.processBlueprint.mockReturnValue(
        processedBlueprint
      );

      const recipe = { recipeId: 'anatomy-creatures:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await factory.createAnatomyGraph(
        'anatomy-creatures:spider_v2',
        'anatomy-creatures:spider_standard'
      );

      // Verify blueprintProcessorService was called with the raw blueprint
      expect(
        mockBlueprintProcessorService.processBlueprint
      ).toHaveBeenCalledWith(v2Blueprint);

      // Verify sockets from processed blueprint were added to root entity
      expect(mockEntityGraphBuilder.addSocketsToEntity).toHaveBeenCalledWith(
        'root-entity-1',
        generatedSockets
      );
    });

    it('should use merged slots from blueprintProcessorService (additionalSlots merged)', async () => {
      const v2Blueprint = {
        id: 'anatomy-creatures:centaur_v2',
        schemaVersion: '2.0',
        root: 'anatomy-creatures:centaur_body',
        structureTemplate: 'anatomy:template_centaur',
        additionalSlots: {
          head: {
            socket: 'neck',
            requirements: { partType: 'head', tags: ['human'] },
            optional: false,
          },
        },
      };

      // The merged slots (generated + additionalSlots) returned by blueprintProcessorService
      const mergedSlots = {
        leg_left_front: {
          socket: 'leg_left_front',
          requirements: { partType: 'leg' },
          optional: false,
        },
        leg_right_front: {
          socket: 'leg_right_front',
          requirements: { partType: 'leg' },
          optional: false,
        },
        head: {
          socket: 'neck',
          requirements: { partType: 'head', tags: ['human'] },
          optional: false,
        },
      };

      // Processed blueprint returned by blueprintProcessorService
      const processedBlueprint = {
        ...v2Blueprint,
        slots: mergedSlots,
        _generatedSockets: [],
        _generatedSlots: mergedSlots,
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      // Mock blueprintProcessorService to return the processed blueprint with merged slots
      mockBlueprintProcessorService.processBlueprint.mockReturnValue(
        processedBlueprint
      );

      const recipe = { recipeId: 'anatomy-creatures:centaur_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await factory.createAnatomyGraph(
        'anatomy-creatures:centaur_v2',
        'anatomy-creatures:centaur_standard'
      );

      // Verify blueprintProcessorService was called with the raw blueprint
      expect(
        mockBlueprintProcessorService.processBlueprint
      ).toHaveBeenCalledWith(v2Blueprint);

      // Verify that mergeSlotRequirements was called for all 3 slots (2 generated + 1 additional)
      expect(mockRecipeProcessor.mergeSlotRequirements).toHaveBeenCalledTimes(
        3
      );
    });

    it('should use additionalSlots override from blueprintProcessorService', async () => {
      const v2Blueprint = {
        id: 'anatomy:griffin_v2',
        schemaVersion: '2.0',
        root: 'anatomy:griffin_body',
        structureTemplate: 'anatomy:template_griffin',
        additionalSlots: {
          wing_left: {
            socket: 'wing_left_socket',
            requirements: { partType: 'enchanted_wing' },
            optional: false,
          },
        },
      };

      // The processed blueprint has the additionalSlots merged (overriding generated ones)
      const processedSlots = {
        wing_left: {
          socket: 'wing_left_socket',
          requirements: { partType: 'enchanted_wing' }, // additionalSlots took precedence
          optional: false,
        },
      };

      const generatedSockets = [
        { id: 'wing_left_socket', orientation: 'left', allowedTypes: ['wing'] },
      ];

      const processedBlueprint = {
        ...v2Blueprint,
        slots: processedSlots,
        _generatedSockets: generatedSockets,
        _generatedSlots: processedSlots,
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      mockBlueprintProcessorService.processBlueprint.mockReturnValue(
        processedBlueprint
      );

      const recipe = { recipeId: 'anatomy:griffin_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('griffin-root');

      mockSocketManager.validateSocketAvailability.mockReturnValue({
        valid: true,
        socket: {
          id: 'wing_left_socket',
          orientation: 'left',
          allowedTypes: ['wing'],
        },
      });

      const result = await factory.createAnatomyGraph(
        'anatomy:griffin_v2',
        'anatomy:griffin_standard'
      );

      expect(result.rootId).toBe('griffin-root');
      expect(result.entities).toEqual(['griffin-root', 'child-entity-1']);
      expect(result.slotToPartMappings).toBeInstanceOf(Map);
      expect(Array.from(result.slotToPartMappings.entries())).toEqual([
        [null, 'griffin-root'],
        ['wing_left', 'child-entity-1'],
      ]);

      // Verify blueprintProcessorService was called
      expect(
        mockBlueprintProcessorService.processBlueprint
      ).toHaveBeenCalledWith(v2Blueprint);

      // Verify part selection used the overridden requirements (enchanted_wing)
      expect(mockPartSelectionService.selectPart).toHaveBeenCalledWith(
        { partType: 'enchanted_wing' }, // From additionalSlots override
        ['wing'],
        undefined,
        expect.any(Function)
      );

      expect(mockEntityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
        'griffin-root',
        'wing_left_socket',
        'anatomy:test_part',
        undefined,
        'left',
        {}
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw ValidationError if blueprintProcessorService throws on missing template', async () => {
      const v2Blueprint = {
        id: 'anatomy-creatures:dragon_v2',
        schemaVersion: '2.0',
        root: 'anatomy-creatures:dragon_body',
        structureTemplate: 'anatomy:template_dragon_missing',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      // Create a factory with a blueprintProcessorService that throws on missing template
      const errorFactory = new BodyBlueprintFactory({
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
        recipePatternResolver: {
          resolveRecipePatterns: jest.fn((recipe) => recipe),
        },
        blueprintProcessorService: {
          processBlueprint: jest.fn().mockImplementation(() => {
            throw new ValidationError(
              'Structure template not found: anatomy:template_dragon_missing'
            );
          }),
        },
      });

      const recipe = { recipeId: 'anatomy-creatures:dragon_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      await expect(
        errorFactory.createAnatomyGraph(
          'anatomy-creatures:dragon_v2',
          'anatomy-creatures:dragon_standard'
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        errorFactory.createAnatomyGraph(
          'anatomy-creatures:dragon_v2',
          'anatomy-creatures:dragon_standard'
        )
      ).rejects.toThrow(
        'Structure template not found: anatomy:template_dragon_missing'
      );
    });

    it('should handle errors from blueprintProcessorService during socket generation', async () => {
      const v2Blueprint = {
        id: 'anatomy-creatures:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy-creatures:spider_body',
        structureTemplate: 'anatomy:template_spider',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      // Create a factory with a blueprintProcessorService that throws during socket generation
      const errorFactory = new BodyBlueprintFactory({
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
        recipePatternResolver: {
          resolveRecipePatterns: jest.fn((recipe) => recipe),
        },
        blueprintProcessorService: {
          processBlueprint: jest.fn().mockImplementation(() => {
            throw new Error('Invalid template structure');
          }),
        },
      });

      const recipe = { recipeId: 'anatomy-creatures:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      await expect(
        errorFactory.createAnatomyGraph(
          'anatomy-creatures:spider_v2',
          'anatomy-creatures:spider_standard'
        )
      ).rejects.toThrow('Invalid template structure');
    });

    it('should handle errors from blueprintProcessorService during slot generation', async () => {
      const v2Blueprint = {
        id: 'anatomy-creatures:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy-creatures:spider_body',
        structureTemplate: 'anatomy:template_spider',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      // Create a factory with a blueprintProcessorService that throws during slot generation
      const errorFactory = new BodyBlueprintFactory({
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
        recipePatternResolver: {
          resolveRecipePatterns: jest.fn((recipe) => recipe),
        },
        blueprintProcessorService: {
          processBlueprint: jest.fn().mockImplementation(() => {
            throw new Error('Invalid slot generation');
          }),
        },
      });

      const recipe = { recipeId: 'anatomy-creatures:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      await expect(
        errorFactory.createAnatomyGraph(
          'anatomy-creatures:spider_v2',
          'anatomy-creatures:spider_standard'
        )
      ).rejects.toThrow('Invalid slot generation');
    });
  });

  describe('Schema Version Detection', () => {
    it('should call blueprintProcessorService.processBlueprint for all blueprints', async () => {
      const v2Blueprint = {
        id: 'anatomy:test_v2',
        schemaVersion: '2.0',
        root: 'anatomy:test_body',
        structureTemplate: 'anatomy:template_test',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        return null;
      });

      // Create a factory with a spy on blueprintProcessorService
      const mockProcessBlueprint = jest.fn((blueprint) => ({
        ...blueprint,
        slots: {},
        _generatedSockets: [],
        _generatedSlots: {},
      }));

      const testFactory = new BodyBlueprintFactory({
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
        recipePatternResolver: {
          resolveRecipePatterns: jest.fn((recipe) => recipe),
        },
        blueprintProcessorService: { processBlueprint: mockProcessBlueprint },
      });

      const recipe = { recipeId: 'anatomy:test_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await testFactory.createAnatomyGraph(
        'anatomy:test_v2',
        'anatomy:test_standard'
      );

      expect(mockProcessBlueprint).toHaveBeenCalledWith(v2Blueprint);
    });

    it('should use blueprint slots from blueprintProcessorService for v2 blueprints without structureTemplate', async () => {
      const v2BlueprintNoTemplate = {
        id: 'anatomy:test_v2_no_template',
        schemaVersion: '2.0',
        root: 'anatomy:test_body',
        slots: {
          arm: {
            socket: 'shoulder',
            requirements: { partType: 'arm' },
            optional: false,
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2BlueprintNoTemplate;
        return null;
      });

      const recipe = { recipeId: 'anatomy:test_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      // Blueprint processor returns the blueprint unchanged (v1 path for blueprints without template)
      await factory.createAnatomyGraph(
        'anatomy:test_v2_no_template',
        'anatomy:test_standard'
      );

      // Factory still processes the slots from the blueprint
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalled();
    });

    it('should process v1 blueprint through blueprintProcessorService', async () => {
      const v1Blueprint = {
        id: 'anatomy:test_v1',
        schemaVersion: '1.0',
        root: 'anatomy:test_body',
        structureTemplate: 'anatomy:template_test', // Present but should be ignored by v1 processing
        slots: {
          arm: {
            socket: 'shoulder',
            requirements: { partType: 'arm' },
            optional: false,
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v1Blueprint;
        return null;
      });

      const recipe = { recipeId: 'anatomy:test_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue(
        'root-entity-1'
      );

      await factory.createAnatomyGraph(
        'anatomy:test_v1',
        'anatomy:test_standard'
      );

      // Factory processes the blueprint and creates entities
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalled();
    });
  });
});
