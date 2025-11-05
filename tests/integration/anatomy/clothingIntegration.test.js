/**
 * @file Integration tests for anatomy-clothing event-driven integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import { ClothingInstantiationService } from '../../../src/clothing/services/clothingInstantiationService.js';

describe('Anatomy-Clothing Integration', () => {
  let eventBus;
  let clothingService;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEquipmentOrchestrator;
  let mockSlotResolver;
  let mockClothingSlotValidator;
  let mockAnatomyBlueprintRepository;
  let mockBodyGraphService;
  let mockCache;
  let mockLayerResolutionService;

  beforeEach(() => {
    // Create real EventBus instance
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventBus = new EventBus({ logger: mockLogger });

    // Create mocks for ClothingInstantiationService dependencies
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      createEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn(),
    };

    mockSlotResolver = {
      resolveClothingSlot: jest.fn(),
      setSlotEntityMappings: jest.fn(),
    };

    mockClothingSlotValidator = {
      validateSlotCompatibility: jest.fn(),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn(),
    };

    mockBodyGraphService = {
      getAnatomyData: jest.fn(),
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    mockLayerResolutionService = {
      resolveAndValidateLayer: jest.fn(),
    };

    // Create ClothingInstantiationService
    clothingService = new ClothingInstantiationService({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      equipmentOrchestrator: mockEquipmentOrchestrator,
      slotResolver: mockSlotResolver,
      clothingSlotValidator: mockClothingSlotValidator,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      bodyGraphService: mockBodyGraphService,
      anatomyClothingCache: mockCache,
      layerResolutionService: mockLayerResolutionService,
      eventBus: eventBus,
    });
  });

  it('should subscribe to ANATOMY_GENERATED event on construction', () => {
    // Verify that subscription happened (check logger output)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ClothingInstantiationService: Subscribed to ANATOMY_GENERATED events'
    );
  });

  it('should handle ANATOMY_GENERATED event and instantiate clothing', async () => {
    const entityId = 'test-entity';
    const recipeId = 'core:adult_human';
    const partsMap = { head: 'head-entity', torso: 'torso-entity' };
    const slotEntityMappings = { slot1: 'slot-entity-1' };

    // Setup mocks
    const mockEntity = {
      getComponentData: jest.fn(() => ({ recipeId })),
    };

    const mockRecipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt',
          equip: true,
        },
      ],
    };

    const mockClothingEntity = {
      id: 'clothing-instance-1',
      getComponentData: jest.fn(() => ({
        equipmentSlots: { primary: 'torso' },
      })),
    };

    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockDataRegistry.get.mockReturnValue(mockRecipe);
    mockEntityManager.createEntityInstance.mockResolvedValue(
      mockClothingEntity
    );
    mockClothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
      valid: true,
    });
    mockEquipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
      success: true,
    });

    // Create a promise that resolves when clothing instantiation completes
    const clothingCompleted = new Promise((resolve) => {
      eventBus.subscribe('clothing:instantiation_completed', (event) => {
        resolve(event);
      });
    });

    // Dispatch ANATOMY_GENERATED event
    await eventBus.dispatch('ANATOMY_GENERATED', {
      entityId,
      blueprintId: 'core:humanoid_body',
      sockets: [{ id: 'socket1', orientation: 'neutral' }],
      timestamp: Date.now(),
      bodyParts: ['head-entity', 'torso-entity'],
      partsMap,
      slotEntityMappings,
    });

    // Wait for clothing instantiation to complete
    const event = await clothingCompleted;

    // Verify clothing was instantiated
    expect(event.payload.actorId).toBe(entityId);
    expect(event.payload.result.instantiated.length).toBeGreaterThan(0);
  });

  it('should handle ANATOMY_GENERATED event with no clothing entities', async () => {
    const entityId = 'test-entity';
    const recipeId = 'core:adult_human';
    const partsMap = { head: 'head-entity' };
    const slotEntityMappings = {};

    // Setup mocks
    const mockEntity = {
      getComponentData: jest.fn(() => ({ recipeId })),
    };

    const mockRecipe = {
      clothingEntities: [], // No clothing
    };

    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockDataRegistry.get.mockReturnValue(mockRecipe);

    // Dispatch event
    await eventBus.dispatch('ANATOMY_GENERATED', {
      entityId,
      blueprintId: 'core:humanoid_body',
      sockets: [],
      timestamp: Date.now(),
      bodyParts: ['head-entity'],
      partsMap,
      slotEntityMappings,
    });

    // Verify no clothing instantiation attempt
    expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();
  });

  it('should dispatch CLOTHING_INSTANTIATION_FAILED event on error', async () => {
    const entityId = 'test-entity';
    const recipeId = 'core:adult_human';

    // Setup mocks to cause an error
    mockEntityManager.getEntityInstance.mockReturnValue(null); // Entity not found

    // Create a promise that resolves when error event is dispatched
    const errorEventDispatched = new Promise((resolve) => {
      eventBus.subscribe('CLOTHING_INSTANTIATION_FAILED', (event) => {
        resolve(event);
      });
    });

    // Dispatch ANATOMY_GENERATED event
    await eventBus.dispatch('ANATOMY_GENERATED', {
      entityId,
      blueprintId: 'core:humanoid_body',
      sockets: [],
      timestamp: Date.now(),
      bodyParts: [],
      partsMap: {},
      slotEntityMappings: {},
    });

    // Wait for error event
    const errorEvent = await errorEventDispatched;

    // Verify error event was dispatched
    expect(errorEvent.payload.entityId).toBe(entityId);
    expect(errorEvent.payload.error).toBeDefined();
  });

  it('should convert plain object partsMap and slotEntityMappings to Maps', async () => {
    const entityId = 'test-entity';
    const recipeId = 'core:adult_human';

    // Plain objects instead of Maps
    const partsMap = { head: 'head-entity', torso: 'torso-entity' };
    const slotEntityMappings = { slot1: 'slot-entity-1' };

    const mockEntity = {
      getComponentData: jest.fn(() => ({ recipeId })),
    };

    const mockRecipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt',
          equip: true,
        },
      ],
    };

    const mockClothingEntity = {
      id: 'clothing-instance-1',
      getComponentData: jest.fn(() => ({
        equipmentSlots: { primary: 'torso' },
      })),
    };

    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockDataRegistry.get.mockReturnValue(mockRecipe);
    mockEntityManager.createEntityInstance.mockResolvedValue(
      mockClothingEntity
    );
    mockClothingSlotValidator.validateSlotCompatibility.mockResolvedValue({
      valid: true,
    });
    mockEquipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
      success: true,
    });

    // Dispatch event with plain objects
    await eventBus.dispatch('ANATOMY_GENERATED', {
      entityId,
      blueprintId: 'core:humanoid_body',
      sockets: [],
      timestamp: Date.now(),
      bodyParts: [],
      partsMap, // Plain object
      slotEntityMappings, // Plain object
    });

    // Give event time to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify slotResolver.setSlotEntityMappings was called with a Map
    expect(mockSlotResolver.setSlotEntityMappings).toHaveBeenCalled();
    const callArg = mockSlotResolver.setSlotEntityMappings.mock.calls[0][0];
    expect(callArg).toBeInstanceOf(Map);
  });
});
