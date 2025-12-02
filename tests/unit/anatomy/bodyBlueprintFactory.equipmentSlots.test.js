import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';

describe('BodyBlueprintFactory equipment slot handling', () => {
  const blueprintId = 'core:test-blueprint';
  const recipeId = 'core:test-recipe';

  let factory;
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
      dispatch: jest.fn(),
    };

    mockEventDispatchService = {
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRecipeProcessor = {
      loadRecipe: jest.fn().mockReturnValue({ recipeId, slots: {} }),
      processRecipe: jest.fn().mockImplementation((recipe) => ({ ...recipe })),
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
      createRootEntity: jest.fn().mockResolvedValue('root-entity'),
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

    factory = new BodyBlueprintFactory({
      entityManager: undefined,
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
      blueprintProcessorService: {
        processBlueprint: jest.fn((blueprint) => blueprint),
      },
    });
  });

  const setBlueprint = (slots) => {
    const blueprint = {
      id: blueprintId,
      root: 'core:torso',
      slots,
    };

    mockDataRegistry.get.mockImplementation((type, id) => {
      if (type === 'anatomyBlueprints' && id === blueprintId) {
        return blueprint;
      }
      return null;
    });
  };

  it('skips slots whose sockets are reserved for equipment', async () => {
    setBlueprint({
      weaponHand: {
        parent: null,
        socket: 'grip',
        requirements: { partType: 'weapon-grip' },
      },
    });

    mockSocketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: { id: 'grip', allowedTypes: ['weapon'], orientation: null },
    });

    const result = await factory.createAnatomyGraph(blueprintId, recipeId);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'SlotResolutionOrchestrator: Skipping equipment slot \'weaponHand\' (socket: grip)',
    );
    expect(mockRecipeProcessor.mergeSlotRequirements).not.toHaveBeenCalled();
    expect(mockPartSelectionService.selectPart).not.toHaveBeenCalled();
    expect(mockEntityGraphBuilder.createAndAttachPart).not.toHaveBeenCalled();
    expect(result).toEqual({ rootId: 'root-entity', entities: ['root-entity'] });
  });

  it('treats slots with equipment-focused requirements as equipment', async () => {
    setBlueprint({
      accessorySlot: {
        parent: null,
        socket: 'arm_mount',
        requirements: { partType: 'attachment', strength: 5 },
      },
    });

    mockSocketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: { id: 'arm_mount', allowedTypes: ['attachment'], orientation: null },
    });

    const result = await factory.createAnatomyGraph(blueprintId, recipeId);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'SlotResolutionOrchestrator: Skipping equipment slot \'accessorySlot\' (socket: arm_mount)',
    );
    expect(mockRecipeProcessor.mergeSlotRequirements).not.toHaveBeenCalled();
    expect(mockPartSelectionService.selectPart).not.toHaveBeenCalled();
    expect(mockEntityGraphBuilder.createAndAttachPart).not.toHaveBeenCalled();
    expect(result).toEqual({ rootId: 'root-entity', entities: ['root-entity'] });
  });
});
