/**
 * @file Test for childSlots support in body blueprint factory
 */

import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';

describe('BodyBlueprintFactory - Child Slots Support', () => {
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
      blueprintProcessorService: {
        processBlueprint: jest.fn((blueprint) => blueprint),
      },
    });
  });

  test('should process simple slots when creating parts', async () => {
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
        left_arm_slot: {
          parent: null,
          socket: 'left_shoulder',
          requirements: {
            partType: 'arm',
          },
        },
        right_arm_slot: {
          parent: null,
          socket: 'right_shoulder',
          requirements: {
            partType: 'arm',
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
        left_arm_slot: {
          partType: 'arm',
          preferId: 'anatomy:test_arm',
        },
        right_arm_slot: {
          partType: 'arm',
          preferId: 'anatomy:test_arm',
        },
      },
    };

    // Mock recipe processor
    mockRecipeProcessor.loadRecipe.mockReturnValue(mockRecipe);
    mockRecipeProcessor.processRecipe.mockReturnValue(mockRecipe);
    mockRecipeProcessor.mergeSlotRequirements.mockReturnValue({});

    // Mock entity graph builder
    mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

    // Track which entities have been created to simulate parent-child relationships
    const createdEntities = new Set(['torso-1']);

    mockEntityGraphBuilder.createAndAttachPart.mockImplementation(
      (parentId, socketId) => {
        // All parts attach to torso
        if (socketId === 'neck') {
          createdEntities.add('head-1');
          return 'head-1';
        }
        if (socketId === 'left_shoulder') {
          createdEntities.add('arm-1');
          return 'arm-1';
        }
        if (socketId === 'right_shoulder') {
          createdEntities.add('arm-2');
          return 'arm-2';
        }
        return null;
      }
    );

    mockEntityGraphBuilder.getPartType.mockImplementation((entityId) => {
      if (entityId === 'head-1') return 'head';
      if (entityId === 'arm-1' || entityId === 'arm-2') return 'arm';
      return 'torso';
    });

    // Mock socket manager to validate parent existence
    mockSocketManager.validateSocketAvailability.mockImplementation(
      (parentId, socketId) => {
        // Return proper validation object
        if (createdEntities.has(parentId)) {
          return {
            valid: true,
            socket: {
              id: socketId,
              allowedTypes: ['head', 'arm', 'leg', 'eye'],
            },
          };
        }
        return {
          valid: false,
          error: 'Parent not found',
        };
      }
    );
    mockSocketManager.generatePartName.mockReturnValue('Generated Name');

    // Mock part selection service
    mockPartSelectionService.selectPart
      .mockResolvedValueOnce('anatomy:test_head')
      .mockResolvedValueOnce('anatomy:test_arm')
      .mockResolvedValueOnce('anatomy:test_arm');

    // Mock registry lookups
    mockDataRegistry.get.mockImplementation((registry, id) => {
      if (registry === 'anatomyBlueprints' && id === blueprintId) {
        return mockBlueprint;
      }
      return null;
    });

    let result;
    let error;
    try {
      result = await factory.createAnatomyGraph(blueprintId, recipeId);
    } catch (e) {
      error = e;
      console.error('Test failed with error:', e.message, e.stack);
    }

    expect(error).toBeUndefined();
    expect(result).toBeDefined();

    // Verify part selection was called for child slots
    expect(mockPartSelectionService.selectPart).toHaveBeenCalledTimes(3);

    // Verify entities were created and attached
    expect(mockEntityGraphBuilder.createAndAttachPart).toHaveBeenCalledTimes(3);

    // Verify result includes all entities
    expect(result.rootId).toBe('torso-1');
    expect(result.entities).toEqual(['torso-1', 'head-1', 'arm-1', 'arm-2']);
    expect(result.slotToPartMappings).toBeInstanceOf(Map);
    expect(result.slotToPartMappings.get('head_slot')).toBe('head-1');
    expect(result.slotToPartMappings.get('left_arm_slot')).toBe('arm-1');
    expect(result.slotToPartMappings.get('right_arm_slot')).toBe('arm-2');
  });

  test('should process parent-child slot relationships', async () => {
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
          preferId: 'anatomy:test_eye',
        },
      },
    };

    // Mock registry lookups
    mockDataRegistry.get.mockImplementation((registry, id) => {
      if (registry === 'anatomyBlueprints' && id === blueprintId) {
        return mockBlueprint;
      }
      return null;
    });

    // Mock recipe processor
    mockRecipeProcessor.loadRecipe.mockReturnValue(mockRecipe);
    mockRecipeProcessor.processRecipe.mockReturnValue(mockRecipe);
    mockRecipeProcessor.mergeSlotRequirements.mockReturnValue({});

    // Mock entity graph builder
    mockEntityGraphBuilder.createRootEntity.mockReturnValue('torso-1');

    // The issue is that the real implementation maintains slot-to-entity mapping
    // internally via the context. We need to properly mock this behavior.
    const createdEntities = ['torso-1'];
    const slotToEntityMap = new Map();

    // When slots are processed, the context tracks which entity was created for each slot
    mockEntityGraphBuilder.createAndAttachPart.mockImplementation(
      (parentId, socketId) => {
        if (socketId === 'neck' && parentId === 'torso-1') {
          createdEntities.push('head-1');
          return 'head-1';
        }
        if (socketId === 'left_eye' && parentId === 'head-1') {
          createdEntities.push('eye-1');
          return 'eye-1';
        }
        return null;
      }
    );

    mockEntityGraphBuilder.getPartType.mockImplementation((entityId) => {
      if (entityId === 'head-1') return 'head';
      if (entityId === 'eye-1') return 'eye';
      return 'torso';
    });

    // Mock socket manager to return the actual socket ID from the slot
    mockSocketManager.validateSocketAvailability.mockImplementation(
      (parentId, socketId) => {
        return {
          valid: true,
          socket: { id: socketId, allowedTypes: ['any'] },
        };
      }
    );
    mockSocketManager.generatePartName.mockReturnValue('Generated Name');

    // Mock part selection service
    mockPartSelectionService.selectPart
      .mockResolvedValueOnce('anatomy:test_head')
      .mockResolvedValueOnce('anatomy:test_eye');

    // Import AnatomyGraphContext to spy on it
    const { AnatomyGraphContext } = await import(
      '../../../src/anatomy/anatomyGraphContext.js'
    );

    // Create spy on AnatomyGraphContext prototype methods
    const originalMapSlotToEntity =
      AnatomyGraphContext.prototype.mapSlotToEntity;
    const originalGetEntityForSlot =
      AnatomyGraphContext.prototype.getEntityForSlot;

    // Override the methods to ensure slot mappings work correctly
    AnatomyGraphContext.prototype.mapSlotToEntity = function (
      slotKey,
      entityId
    ) {
      // Call the original method to update internal state
      originalMapSlotToEntity.call(this, slotKey, entityId);
      // Also track in our map for debugging
      slotToEntityMap.set(slotKey, entityId);
    };

    AnatomyGraphContext.prototype.getEntityForSlot = function (slotKey) {
      // Call the original method to get from internal state
      return originalGetEntityForSlot.call(this, slotKey);
    };

    try {
      const result = await factory.createAnatomyGraph(blueprintId, recipeId);

      // Verify parts were created in correct order with correct parents
      expect(mockEntityGraphBuilder.createAndAttachPart).toHaveBeenCalledTimes(
        2
      );
      expect(
        mockEntityGraphBuilder.createAndAttachPart
      ).toHaveBeenNthCalledWith(
        1,
        'torso-1',
        'neck',
        'anatomy:test_head',
        undefined,
        undefined,
        {}
      );
      expect(
        mockEntityGraphBuilder.createAndAttachPart
      ).toHaveBeenNthCalledWith(
        2,
        'head-1',
        'left_eye',
        'anatomy:test_eye',
        undefined,
        'left',
        {}
      );

      // Verify result includes all entities
      expect(result.rootId).toBe('torso-1');
      expect(result.entities).toEqual(['torso-1', 'head-1', 'eye-1']);
      expect(result.slotToPartMappings).toBeInstanceOf(Map);
      expect(result.slotToPartMappings.get('head_slot')).toBe('head-1');
      expect(result.slotToPartMappings.get('left_eye_slot')).toBe('eye-1');
    } finally {
      // Restore original methods
      AnatomyGraphContext.prototype.mapSlotToEntity = originalMapSlotToEntity;
      AnatomyGraphContext.prototype.getEntityForSlot = originalGetEntityForSlot;
    }
  });
});
