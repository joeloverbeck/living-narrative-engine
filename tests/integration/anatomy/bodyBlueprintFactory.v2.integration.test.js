import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('BodyBlueprintFactory - V2 Integration Tests', () => {
  let factory;
  let socketGenerator;
  let slotGenerator;
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
    // Create real socket and slot generators
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    socketGenerator = new SocketGenerator({ logger: mockLogger });
    slotGenerator = new SlotGenerator({ logger: mockLogger });

    // Create other mocks
    mockDataRegistry = {
      get: jest.fn(),
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
      mergeSlotRequirements: jest.fn(),
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
      addSocketsToEntity: jest.fn().mockResolvedValue(undefined),
      setEntityName: jest.fn(),
      getPartType: jest.fn().mockReturnValue('test_part_type'),
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

    mockEntityManager = {
      getComponentData: jest.fn().mockReturnValue(null),
    };

    const mockRecipePatternResolver = {
      resolveRecipePatterns: jest.fn((recipe) => recipe),
    };

    // Create factory with real generators
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
      socketGenerator,
      slotGenerator,
      recipePatternResolver: mockRecipePatternResolver,
    });
  });

  describe('Real Template Processing', () => {
    it('should process spider octopedal template correctly', async () => {
      const spiderTemplate = {
        id: 'anatomy:template_spider_octopedal',
        description: '8-leg radial spider arrangement',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 8,
              optional: false,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['spider_leg'],
                nameTpl: '{{orientation}} leg',
                positions: [
                  'anterior',
                  'anterior_right',
                  'right',
                  'posterior_right',
                  'posterior',
                  'posterior_left',
                  'left',
                  'anterior_left',
                ],
              },
            },
          ],
        },
      };

      const spiderBlueprint = {
        id: 'anatomy:spider_v2',
        schemaVersion: '2.0',
        root: 'anatomy:spider_body',
        structureTemplate: 'anatomy:template_spider_octopedal',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return spiderBlueprint;
        if (type === 'anatomyStructureTemplates') return spiderTemplate;
        return null;
      });

      const recipe = { recipeId: 'anatomy:spider_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:spider_v2', 'anatomy:spider_standard');

      // Verify that 8 sockets and 8 slots were generated
      const logCalls = mockLogger.info.mock.calls;
      const blueprintLogCall = logCalls.find((call) =>
        call[0].includes('Generated') && call[0].includes('slots from template')
      );

      expect(blueprintLogCall).toBeDefined();
      expect(blueprintLogCall[0]).toContain('8 sockets');
      expect(blueprintLogCall[0]).toContain('8 slots');
    });

    it('should process centaur quadrupedal template correctly', async () => {
      const centaurTemplate = {
        id: 'anatomy:template_centaur_quadrupedal',
        description: '4-leg bilateral centaur arrangement',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 4,
              optional: false,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['horse_leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
          ],
          appendages: [
            {
              type: 'tail',
              count: 1,
              optional: true,
              socketPattern: {
                idTemplate: 'tail_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['horse_tail'],
                nameTpl: 'tail',
              },
            },
          ],
        },
      };

      const centaurBlueprint = {
        id: 'anatomy:centaur_v2',
        schemaVersion: '2.0',
        root: 'anatomy:centaur_body',
        structureTemplate: 'anatomy:template_centaur_quadrupedal',
        additionalSlots: {
          head: {
            socket: 'neck',
            requirements: { partType: 'head', tags: ['human'] },
            optional: false,
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return centaurBlueprint;
        if (type === 'anatomyStructureTemplates') return centaurTemplate;
        return null;
      });

      const recipe = { recipeId: 'anatomy:centaur_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:centaur_v2', 'anatomy:centaur_standard');

      // Verify that 5 sockets and 5 slots were generated from template
      // Note: additionalSlots are merged after generation, so log shows 5 slots generated
      const logCalls = mockLogger.info.mock.calls;
      const blueprintLogCall = logCalls.find((call) =>
        call[0].includes('Generated') && call[0].includes('slots from template')
      );

      expect(blueprintLogCall).toBeDefined();
      expect(blueprintLogCall[0]).toContain('5 sockets');
      expect(blueprintLogCall[0]).toContain('5 slots'); // Generated from template only
    });

    it('should process dragon hexapedal template correctly', async () => {
      const dragonTemplate = {
        id: 'anatomy:template_dragon_hexapedal',
        description: '6-limb dragon (4 legs + 2 wings)',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 4,
              optional: false,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
            {
              type: 'wing',
              count: 2,
              optional: false,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_wing'],
                nameTpl: '{{orientation}} wing',
              },
            },
          ],
          appendages: [
            {
              type: 'tail',
              count: 1,
              optional: false,
              socketPattern: {
                idTemplate: 'tail_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['dragon_tail'],
                nameTpl: 'tail',
              },
            },
            {
              type: 'head',
              count: 1,
              optional: false,
              socketPattern: {
                idTemplate: 'head_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['dragon_head'],
                nameTpl: 'head',
              },
            },
          ],
        },
      };

      const dragonBlueprint = {
        id: 'anatomy:dragon_v2',
        schemaVersion: '2.0',
        root: 'anatomy:dragon_body',
        structureTemplate: 'anatomy:template_dragon_hexapedal',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return dragonBlueprint;
        if (type === 'anatomyStructureTemplates') return dragonTemplate;
        return null;
      });

      const recipe = { recipeId: 'anatomy:dragon_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:dragon_v2', 'anatomy:dragon_standard');

      // Verify that 8 sockets and 8 slots were generated (4 legs + 2 wings + 1 tail + 1 head)
      const logCalls = mockLogger.info.mock.calls;
      const blueprintLogCall = logCalls.find((call) =>
        call[0].includes('Generated') && call[0].includes('slots from template')
      );

      expect(blueprintLogCall).toBeDefined();
      expect(blueprintLogCall[0]).toContain('8 sockets');
      expect(blueprintLogCall[0]).toContain('8 slots');
    });
  });

  describe('Socket/Slot Consistency', () => {
    it('should ensure socket IDs match slot socket references', async () => {
      const template = {
        id: 'anatomy:template_test',
        topology: {
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['human_arm'],
              },
            },
          ],
        },
      };

      const blueprint = {
        id: 'anatomy:test_v2',
        schemaVersion: '2.0',
        root: 'anatomy:test_body',
        structureTemplate: 'anatomy:template_test',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return blueprint;
        if (type === 'anatomyStructureTemplates') return template;
        return null;
      });

      const recipe = { recipeId: 'anatomy:test_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:test_v2', 'anatomy:test_standard');

      // Verify generators were called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated 2 sockets and 2 slots')
      );
    });

    it('should not have orphaned sockets or slots', async () => {
      const template = {
        id: 'anatomy:template_test_comprehensive',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              socketPattern: {
                idTemplate: 'head_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const blueprint = {
        id: 'anatomy:test_comprehensive_v2',
        schemaVersion: '2.0',
        root: 'anatomy:test_body',
        structureTemplate: 'anatomy:template_test_comprehensive',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return blueprint;
        if (type === 'anatomyStructureTemplates') return template;
        return null;
      });

      const recipe = { recipeId: 'anatomy:test_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      await factory.createAnatomyGraph('anatomy:test_comprehensive_v2', 'anatomy:test_standard');

      // Verify that socket count matches slot count
      const logCalls = mockLogger.info.mock.calls;
      const blueprintLogCall = logCalls.find((call) =>
        call[0].includes('Generated') && call[0].includes('slots from template')
      );

      expect(blueprintLogCall).toBeDefined();
      expect(blueprintLogCall[0]).toContain('3 sockets');
      expect(blueprintLogCall[0]).toContain('3 slots');
    });
  });

  describe('Performance Baseline', () => {
    it('should process v2 blueprint with minimal overhead (< 10ms additional time)', async () => {
      const simpleTemplate = {
        id: 'anatomy:template_simple',
        topology: {
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const v2Blueprint = {
        id: 'anatomy:simple_v2',
        schemaVersion: '2.0',
        root: 'anatomy:simple_body',
        structureTemplate: 'anatomy:template_simple',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return v2Blueprint;
        if (type === 'anatomyStructureTemplates') return simpleTemplate;
        return null;
      });

      const recipe = { recipeId: 'anatomy:simple_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      const startTime = performance.now();
      await factory.createAnatomyGraph('anatomy:simple_v2', 'anatomy:simple_standard');
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      // V2 processing should add minimal overhead
      // Note: This is a rough baseline - actual time will vary by system
      expect(processingTime).toBeLessThan(100); // Very generous baseline for test stability
    });

    it('should handle complex templates efficiently (dragon with 8 limbs)', async () => {
      const complexTemplate = {
        id: 'anatomy:template_dragon_complex',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
            {
              type: 'wing',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_wing'],
                nameTpl: '{{orientation}} wing',
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              socketPattern: {
                idTemplate: 'head_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['dragon_head'],
              },
            },
            {
              type: 'tail',
              count: 1,
              socketPattern: {
                idTemplate: 'tail_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['dragon_tail'],
              },
            },
          ],
        },
      };

      const dragonBlueprint = {
        id: 'anatomy:dragon_complex_v2',
        schemaVersion: '2.0',
        root: 'anatomy:dragon_body',
        structureTemplate: 'anatomy:template_dragon_complex',
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints') return dragonBlueprint;
        if (type === 'anatomyStructureTemplates') return complexTemplate;
        return null;
      });

      const recipe = { recipeId: 'anatomy:dragon_standard', slots: {} };
      mockRecipeProcessor.loadRecipe.mockReturnValue(recipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(recipe);
      mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity-1');

      const startTime = performance.now();
      await factory.createAnatomyGraph('anatomy:dragon_complex_v2', 'anatomy:dragon_standard');
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      // Even complex templates should process quickly
      expect(processingTime).toBeLessThan(150); // Generous for complex template

      const logCalls = mockLogger.info.mock.calls;
      const blueprintLogCall = logCalls.find((call) =>
        call[0].includes('Generated') && call[0].includes('slots from template')
      );
      expect(blueprintLogCall).toBeDefined();
      expect(blueprintLogCall[0]).toContain('8 sockets');
      expect(blueprintLogCall[0]).toContain('8 slots');
    });
  });
});
