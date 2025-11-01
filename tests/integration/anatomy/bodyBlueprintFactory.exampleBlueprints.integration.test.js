import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';

import giantSpiderBlueprint from '../../../data/mods/anatomy/blueprints/giant_spider.blueprint.json';
import redDragonBlueprint from '../../../data/mods/anatomy/blueprints/red_dragon.blueprint.json';
import krakenBlueprint from '../../../data/mods/anatomy/blueprints/kraken.blueprint.json';
import centaurBlueprint from '../../../data/mods/anatomy/blueprints/centaur_warrior.blueprint.json';

import structureArachnidTemplate from '../../../data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json';
import structureWingedQuadrupedTemplate from '../../../data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json';
import structureOctopoidTemplate from '../../../data/mods/anatomy/structure-templates/structure_octopoid.structure-template.json';
import structureCentauroidTemplate from '../../../data/mods/anatomy/structure-templates/structure_centauroid.structure-template.json';

const TEST_RECIPE_ID = 'anatomy:test_recipe';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const slotKeyCollector = new SlotGenerator({ logger: silentLogger });

const collectTemplateSlots = (template) => {
  if (!template?.topology) {
    return {};
  }

  return slotKeyCollector.generateBlueprintSlots(JSON.parse(JSON.stringify(template)));
};

const collectTemplateSlotKeys = (template) => Object.keys(collectTemplateSlots(template));

const countTemplateSockets = (template) => {
  if (!template?.topology) {
    return 0;
  }

  const { limbSets = [], appendages = [] } = template.topology;
  const limbCount = limbSets.reduce((sum, set) => sum + (set.count || 0), 0);
  const appendageCount = appendages.reduce((sum, app) => sum + (app.count || 0), 0);
  return limbCount + appendageCount;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

describe('BodyBlueprintFactory - Example blueprint coverage', () => {
  let factory;
  let mockDataRegistry;
  let mockRecipeProcessor;
  let mockPartSelectionService;
  let mockSocketManager;
  let mockEntityManager;
  let mockEntityGraphBuilder;
  let mockConstraintEvaluator;
  let mockValidator;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockLogger;
  let socketGenerator;
  let slotGenerator;
  let mockRecipePatternResolver;
  let baseRecipe;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn().mockReturnValue(null),
    };

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
      selectPart: jest.fn(),
    };

    mockSocketManager = {
      validateSocketAvailability: jest.fn(),
      occupySocket: jest.fn(),
      generatePartName: jest.fn().mockReturnValue('Generated Part'),
    };

    mockEntityGraphBuilder = {
      createRootEntity: jest.fn(),
      addSocketsToEntity: jest.fn(),
      createAndAttachPart: jest.fn(),
      setEntityName: jest.fn(),
      getPartType: jest.fn(),
      cleanupEntities: jest.fn(),
    };

    mockConstraintEvaluator = {
      evaluateConstraints: jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      }),
    };

    mockValidator = {
      validateGraph: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      }),
    };

    mockRecipePatternResolver = {
      resolveRecipePatterns: jest.fn((recipe) => recipe),
    };

    socketGenerator = new SocketGenerator({ logger: mockLogger });
    slotGenerator = new SlotGenerator({ logger: mockLogger });

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

    baseRecipe = { recipeId: TEST_RECIPE_ID, slots: {} };
    mockRecipeProcessor.loadRecipe.mockReturnValue(baseRecipe);
    mockRecipeProcessor.processRecipe.mockReturnValue(baseRecipe);
    mockRecipeProcessor.mergeSlotRequirements.mockImplementation((requirements) => requirements);
    mockSocketManager.validateSocketAvailability.mockImplementation((parentId, socketId) => ({
      valid: true,
      socket: { id: socketId, orientation: null, allowedTypes: ['anatomy:part'] },
    }));
    mockPartSelectionService.selectPart.mockResolvedValue('anatomy:test_part');
    mockEntityGraphBuilder.createRootEntity.mockResolvedValue('root-entity');
    mockEntityGraphBuilder.addSocketsToEntity.mockResolvedValue(undefined);
    mockEntityGraphBuilder.createAndAttachPart.mockResolvedValue('child-entity');
    mockEntityGraphBuilder.getPartType.mockReturnValue('test_part_type');
    mockEntityGraphBuilder.cleanupEntities.mockResolvedValue(undefined);
  });

  const scenarios = [
    {
      name: 'giant spider blueprint',
      blueprint: giantSpiderBlueprint,
      template: structureArachnidTemplate,
      optionalSkips: new Set(['venom_gland']),
    },
    {
      name: 'red dragon blueprint',
      blueprint: redDragonBlueprint,
      template: structureWingedQuadrupedTemplate,
      optionalSkips: new Set(),
    },
    {
      name: 'kraken blueprint',
      blueprint: krakenBlueprint,
      template: structureOctopoidTemplate,
      optionalSkips: new Set(['beak']),
    },
    {
      name: 'centaur warrior blueprint',
      blueprint: centaurBlueprint,
      template: structureCentauroidTemplate,
      optionalSkips: new Set(),
    },
  ];

  it.each(scenarios)('processes %s via structure templates', async (scenario) => {
    const blueprint = clone(scenario.blueprint);
    const template = clone(scenario.template);

    const generatedSlots = collectTemplateSlots(template);
    const expectedTemplateSocketCount = countTemplateSockets(template);
    const combinedSlots = {
      ...generatedSlots,
      ...(blueprint.additionalSlots || {}),
    };
    const expectedTotalSlotCount = Object.keys(combinedSlots).length;
    const expectedSocketIds = Object.values(combinedSlots).map((slot) => slot.socket);

    mockDataRegistry.get.mockImplementation((type, id) => {
      if (type === 'anatomyBlueprints' && id === blueprint.id) {
        return blueprint;
      }
      if (type === 'anatomyStructureTemplates' && id === blueprint.structureTemplate) {
        return template;
      }
      return undefined;
    });

    mockPartSelectionService.selectPart.mockImplementation(async (requirements) => {
      if (scenario.optionalSkips.has(requirements.partType)) {
        return undefined;
      }
      return 'anatomy:test_part';
    });

    await factory.createAnatomyGraph(blueprint.id, TEST_RECIPE_ID);

    expect(mockEntityGraphBuilder.addSocketsToEntity).toHaveBeenCalledTimes(1);
    const socketsArg = mockEntityGraphBuilder.addSocketsToEntity.mock.calls[0][1];
    expect(Array.isArray(socketsArg)).toBe(true);
    expect(socketsArg).toHaveLength(expectedTemplateSocketCount);

    expect(mockRecipeProcessor.mergeSlotRequirements).toHaveBeenCalledTimes(
      expectedTotalSlotCount
    );

    const validatedSockets = mockSocketManager.validateSocketAvailability.mock.calls.map(
      (call) => call[1]
    );
    expect(validatedSockets).toHaveLength(expectedTotalSlotCount);
    expect(new Set(validatedSockets)).toEqual(new Set(expectedSocketIds));

    const expectedAttachments = Object.values(combinedSlots).filter((slot) => {
      if (!slot?.optional) {
        return true;
      }
      return !scenario.optionalSkips.has(slot.requirements?.partType);
    }).length;
    expect(mockEntityGraphBuilder.createAndAttachPart).toHaveBeenCalledTimes(
      expectedAttachments
    );

    if (scenario.optionalSkips.size > 0) {
      scenario.optionalSkips.forEach((partType) => {
        expect(
          mockPartSelectionService.selectPart.mock.calls.some(
            (call) => call[0]?.partType === partType
          )
        ).toBe(true);
      });
    }
  });
});
