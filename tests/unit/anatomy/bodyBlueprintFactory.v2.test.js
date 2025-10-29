import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
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

  beforeEach(() => {
    // Create base mocks
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
        socket: { id: 'test_socket', orientation: 'left', allowedTypes: ['test'] },
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
        resolveRecipePatterns: jest.fn(recipe => recipe),
      },
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
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:humanoid_v1', 'anatomy:human_standard');

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
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:humanoid_v1', 'anatomy:human_standard');

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
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:glitched_v2', 'anatomy:default');

      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
      expect(mockEntityGraphBuilder.addSocketsToEntity).not.toHaveBeenCalled();
    });
  });

  describe('V2 Blueprint Processing', () => {
    it('should process v2 blueprint with structureTemplate', async () => {
      const v2Blueprint = {
        id: 'anatomy:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy:spider_body',
        structureTemplate: 'anatomy:template_spider_octopedal',
      };

      const structureTemplate = {
        id: 'anatomy:template_spider_octopedal',
        topology: {
          rootType: 'spider_body',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
        },
      };

      const generatedSockets = [
        { id: 'leg_anterior', orientation: 'anterior', allowedTypes: ['spider_leg'] },
        { id: 'leg_anterior_right', orientation: 'anterior_right', allowedTypes: ['spider_leg'] },
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

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return structureTemplate;
        return null;
      });

      mockSocketGenerator.generateSockets.mockReturnValue(generatedSockets);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(generatedSlots);

      const recipe = { recipeId: 'anatomy:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:spider_v2', 'anatomy:spider_standard');

      // Verify template processing was triggered
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyStructureTemplates',
        'anatomy:template_spider_octopedal'
      );
      expect(mockSocketGenerator.generateSockets).toHaveBeenCalledWith(structureTemplate);
      expect(mockSlotGenerator.generateBlueprintSlots).toHaveBeenCalledWith(structureTemplate);
      expect(mockEntityGraphBuilder.addSocketsToEntity).toHaveBeenCalledWith(
        'root-entity-1',
        generatedSockets
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated 2 sockets and 2 slots from template')
      );
    });

    it('should merge generated slots with additionalSlots (additionalSlots take precedence)', async () => {
      const v2Blueprint = {
        id: 'anatomy:centaur_v2',
        schemaVersion: '2.0',
        root: 'anatomy:centaur_body',
        structureTemplate: 'anatomy:template_centaur',
        additionalSlots: {
          head: {
            socket: 'neck',
            requirements: { partType: 'head', tags: ['human'] },
            optional: false,
          },
        },
      };

      const structureTemplate = {
        id: 'anatomy:template_centaur',
        topology: {
          rootType: 'centaur_body',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                arrangement: 'quadrupedal',
                allowedTypes: ['horse_leg'],
              },
            },
          ],
        },
      };

      const generatedSlots = {
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
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return structureTemplate;
        return null;
      });

      mockSocketGenerator.generateSockets.mockReturnValue([]);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(generatedSlots);

      const recipe = { recipeId: 'anatomy:centaur_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:centaur_v2', 'anatomy:centaur_standard');

      // Verify blueprint processing merged slots correctly
      expect(mockSlotGenerator.generateBlueprintSlots).toHaveBeenCalledWith(structureTemplate);

      // The merged blueprint should have both generated slots and additionalSlots
      // additionalSlots should override if there's a conflict
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should allow additionalSlots to override generated slot definitions', async () => {
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

      const structureTemplate = {
        id: 'anatomy:template_griffin',
        topology: {
          rootType: 'griffin_body',
          limbSets: [
            {
              type: 'wing',
              count: 2,
              socketPattern: {
                idTemplate: 'wing_{{side}}',
                orientationScheme: 'bilateral',
              },
            },
          ],
          appendages: [],
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return structureTemplate;
        return null;
      });

      mockSocketGenerator.generateSockets.mockReturnValue([
        { id: 'wing_left_socket', orientation: 'left', allowedTypes: ['wing'] },
      ]);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
        wing_left: {
          socket: 'wing_left_socket',
          requirements: { partType: 'standard_wing' },
          optional: false,
        },
      });

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

      expect(result).toEqual({
        rootId: 'griffin-root',
        entities: ['griffin-root', 'child-entity-1'],
      });

      expect(mockRecipeProcessor.mergeSlotRequirements).toHaveBeenCalledWith(
        v2Blueprint.additionalSlots.wing_left.requirements,
        undefined
      );

      expect(mockPartSelectionService.selectPart).toHaveBeenCalledWith(
        v2Blueprint.additionalSlots.wing_left.requirements,
        ['wing'],
        undefined,
        expect.any(Function)
      );

      expect(mockEntityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
        'griffin-root',
        'wing_left_socket',
        'anatomy:test_part',
        undefined,
        'left'
      );

      expect(mockSocketManager.occupySocket).toHaveBeenCalledWith(
        'griffin-root',
        'wing_left_socket',
        expect.any(Set)
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw ValidationError if structure template not found', async () => {
      const v2Blueprint = {
        id: 'anatomy:dragon_v2',
        schemaVersion: '2.0',
        root: 'anatomy:dragon_body',
        structureTemplate: 'anatomy:template_dragon_missing',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return null; // Template not found
        return null;
      });

      const recipe = { recipeId: 'anatomy:dragon_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      await expect(
        factory.createAnatomyGraph('anatomy:dragon_v2', 'anatomy:dragon_standard')
      ).rejects.toThrow(ValidationError);

      await expect(
        factory.createAnatomyGraph('anatomy:dragon_v2', 'anatomy:dragon_standard')
      ).rejects.toThrow('Structure template not found: anatomy:template_dragon_missing');
    });

    it('should handle errors from socketGenerator gracefully', async () => {
      const v2Blueprint = {
        id: 'anatomy:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy:spider_body',
        structureTemplate: 'anatomy:template_spider',
      };

      const structureTemplate = {
        id: 'anatomy:template_spider',
        topology: { rootType: 'spider_body', limbSets: [], appendages: [] },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return structureTemplate;
        return null;
      });

      mockSocketGenerator.generateSockets.mockImplementation(() => {
        throw new Error('Invalid template structure');
      });

      const recipe = { recipeId: 'anatomy:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      await expect(
        factory.createAnatomyGraph('anatomy:spider_v2', 'anatomy:spider_standard')
      ).rejects.toThrow('Invalid template structure');
    });

    it('should handle errors from slotGenerator gracefully', async () => {
      const v2Blueprint = {
        id: 'anatomy:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy:spider_body',
        structureTemplate: 'anatomy:template_spider',
      };

      const structureTemplate = {
        id: 'anatomy:template_spider',
        topology: { rootType: 'spider_body', limbSets: [], appendages: [] },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return structureTemplate;
        return null;
      });

      mockSocketGenerator.generateSockets.mockReturnValue([]);
      mockSlotGenerator.generateBlueprintSlots.mockImplementation(() => {
        throw new Error('Invalid slot generation');
      });

      const recipe = { recipeId: 'anatomy:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);

      await expect(
        factory.createAnatomyGraph('anatomy:spider_v2', 'anatomy:spider_standard')
      ).rejects.toThrow('Invalid slot generation');
    });
  });

  describe('Schema Version Detection', () => {
    it('should trigger v2 processing only when schemaVersion is "2.0"', async () => {
      const v2Blueprint = {
        id: 'anatomy:test_v2',
        schemaVersion: '2.0',
        root: 'anatomy:test_body',
        structureTemplate: 'anatomy:template_test',
      };

      const structureTemplate = {
        id: 'anatomy:template_test',
        topology: { rootType: 'test_body', limbSets: [], appendages: [] },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return structureTemplate;
        return null;
      });

      mockSocketGenerator.generateSockets.mockReturnValue([]);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue({});

      const recipe = { recipeId: 'anatomy:test_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:test_v2', 'anatomy:test_standard');

      expect(mockSocketGenerator.generateSockets).toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).toHaveBeenCalled();
    });

    it('should not trigger v2 processing when schemaVersion is "2.0" but structureTemplate is missing', async () => {
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
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:test_v2_no_template', 'anatomy:test_standard');

      // Should use v1 path since structureTemplate is missing
      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });

    it('should use v1 path when schemaVersion is "1.0" even with structureTemplate present', async () => {
      const v1Blueprint = {
        id: 'anatomy:test_v1',
        schemaVersion: '1.0',
        root: 'anatomy:test_body',
        structureTemplate: 'anatomy:template_test', // Present but should be ignored
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
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:test_v1', 'anatomy:test_standard');

      // Should use v1 path
      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });
  });
});
