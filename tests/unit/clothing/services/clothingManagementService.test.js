import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { ClothingManagementService } from '../../../../src/clothing/services/clothingManagementService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/** Helper to create minimal mocks for dependencies */
function createMocks() {
  return {
    entityManager: {
      getComponentData: jest.fn(),
      setComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    eventDispatcher: {
      dispatch: jest.fn(),
    },
    equipmentOrchestrator: {
      orchestrateEquipment: jest.fn(),
      orchestrateUnequipment: jest.fn(),
      validateEquipmentCompatibility: jest.fn(),
    },
    anatomyBlueprintRepository: {
      getBlueprintByRecipeId: jest.fn(),
    },
    clothingSlotValidator: {
      validateSlotCompatibility: jest.fn(),
    },
    bodyGraphService: {
      getAnatomyData: jest.fn(),
      getBodyGraph: jest.fn(),
    },
    anatomyClothingCache: {
      get: jest.fn(),
      set: jest.fn(),
      invalidateCacheForEntity: jest.fn(),
    },
  };
}

describe('ClothingManagementService', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let equipmentOrchestrator;
  let anatomyBlueprintRepository;
  let clothingSlotValidator;
  let bodyGraphService;
  let anatomyClothingCache;
  let service;

  beforeEach(() => {
    ({
      entityManager,
      logger,
      eventDispatcher,
      equipmentOrchestrator,
      anatomyBlueprintRepository,
      clothingSlotValidator,
      bodyGraphService,
      anatomyClothingCache,
    } = createMocks());

    service = new ClothingManagementService({
      entityManager,
      logger,
      eventDispatcher,
      equipmentOrchestrator,
      anatomyBlueprintRepository,
      clothingSlotValidator,
      bodyGraphService,
      anatomyClothingCache,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeInstanceOf(ClothingManagementService);
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            logger,
            eventDispatcher,
            equipmentOrchestrator,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            eventDispatcher,
            equipmentOrchestrator,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when eventDispatcher is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            equipmentOrchestrator,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when equipmentOrchestrator is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            eventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when required dependencies are missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            eventDispatcher,
            equipmentOrchestrator,
          })
      ).toThrow('anatomyBlueprintRepository is required');
    });

    it('should throw error when clothingSlotValidator is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            eventDispatcher,
            equipmentOrchestrator,
            anatomyBlueprintRepository,
            bodyGraphService,
          })
      ).toThrow('clothingSlotValidator is required');
    });

    it('should throw error when bodyGraphService is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            eventDispatcher,
            equipmentOrchestrator,
            anatomyBlueprintRepository,
            clothingSlotValidator,
          })
      ).toThrow('bodyGraphService is required');
    });

    it('should use decomposed architecture when all dependencies are provided', () => {
      expect(service).toBeInstanceOf(ClothingManagementService);
      expect(logger.info).toHaveBeenCalledWith(
        'ClothingManagementService: Using decomposed services architecture'
      );
    });
  });

  describe('equipClothing', () => {
    it('should successfully equip clothing item', async () => {
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
        equipped: true,
      });

      const result = await service.equipClothing('entity1', 'clothing1');

      expect(result.success).toBe(true);
      expect(result.equipped).toBe(true);
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith({
        entityId: 'entity1',
        clothingItemId: 'clothing1',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        "ClothingManagementService: Equipping clothing 'clothing1' on entity 'entity1'",
        { options: {} }
      );
    });

    it('should handle equipment failure', async () => {
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: false,
        errors: ['Coverage validation failed'],
      });

      const result = await service.equipClothing('entity1', 'clothing1');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Coverage validation failed']);
      expect(logger.warn).toHaveBeenCalledWith(
        "ClothingManagementService: Failed to equip clothing 'clothing1' on entity 'entity1'",
        { errors: ['Coverage validation failed'] }
      );
    });

    it('should handle equipment with options', async () => {
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
        equipped: true,
      });

      const options = {
        layer: 'outer',
        conflictResolution: 'prompt_user',
        validateCoverage: false,
      };

      const result = await service.equipClothing(
        'entity1',
        'clothing1',
        options
      );

      expect(result.success).toBe(true);
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith({
        entityId: 'entity1',
        clothingItemId: 'clothing1',
        ...options,
      });
    });

    it('should throw error for missing entityId', async () => {
      const result = await service.equipClothing('', 'clothing1');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['entityId is required']);
    });

    it('should throw error for missing clothingItemId', async () => {
      const result = await service.equipClothing('entity1', '');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['clothingItemId is required']);
    });

    it('should handle orchestrator throwing error', async () => {
      equipmentOrchestrator.orchestrateEquipment.mockRejectedValue(
        new Error('Orchestrator error')
      );

      const result = await service.equipClothing('entity1', 'clothing1');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Orchestrator error']);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('unequipClothing', () => {
    it('should successfully unequip clothing item', async () => {
      equipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
        unequipped: true,
        cascadeItems: [],
      });

      const result = await service.unequipClothing('entity1', 'clothing1');

      expect(result.success).toBe(true);
      expect(result.unequipped).toBe(true);
      expect(equipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith(
        {
          entityId: 'entity1',
          clothingItemId: 'clothing1',
        }
      );
    });

    it('should handle unequipment with cascade', async () => {
      equipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
        unequipped: true,
        cascadeItems: ['jacket1'],
      });

      const options = {
        cascadeUnequip: true,
        reason: 'forced',
      };

      const result = await service.unequipClothing(
        'entity1',
        'clothing1',
        options
      );

      expect(result.success).toBe(true);
      expect(result.cascadeItems).toEqual(['jacket1']);
      expect(equipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith(
        {
          entityId: 'entity1',
          clothingItemId: 'clothing1',
          ...options,
        }
      );
    });

    it('should handle unequipment failure', async () => {
      equipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: false,
        errors: ['Item not equipped'],
      });

      const result = await service.unequipClothing('entity1', 'clothing1');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Item not equipped']);
    });

    it('should throw error for missing parameters', async () => {
      const result1 = await service.unequipClothing('', 'clothing1');
      const result2 = await service.unequipClothing('entity1', '');

      expect(result1.success).toBe(false);
      expect(result1.errors).toEqual(['entityId is required']);
      expect(result2.success).toBe(false);
      expect(result2.errors).toEqual(['clothingItemId is required']);
    });
  });

  describe('getEquippedItems', () => {
    it('should return equipped items when equipment component exists', async () => {
      const mockEquipment = {
        equipped: {
          torso_clothing: {
            base: 'shirt1',
            outer: 'jacket1',
          },
        },
      };

      entityManager.getComponentData.mockReturnValue(mockEquipment);

      const result = await service.getEquippedItems('entity1');

      expect(result.success).toBe(true);
      expect(result.equipped).toEqual(mockEquipment.equipped);
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'entity1',
        'clothing:equipment'
      );
    });

    it('should return empty object when no equipment component', async () => {
      entityManager.getComponentData.mockReturnValue(null);

      const result = await service.getEquippedItems('entity1');

      expect(result.success).toBe(true);
      expect(result.equipped).toEqual({});
    });

    it('should handle empty equipment component', async () => {
      entityManager.getComponentData.mockReturnValue({ equipped: undefined });

      const result = await service.getEquippedItems('entity1');

      expect(result.success).toBe(true);
      expect(result.equipped).toEqual({});
    });

    it('should throw error for missing entityId', async () => {
      const result = await service.getEquippedItems('');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['entityId is required']);
    });

    it('should handle entityManager throwing error', async () => {
      entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Entity manager error');
      });

      const result = await service.getEquippedItems('entity1');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Entity manager error']);
    });
  });

  describe('validateCompatibility', () => {
    it('should validate compatibility successfully', async () => {
      equipmentOrchestrator.validateEquipmentCompatibility.mockResolvedValue({
        valid: true,
        compatibility: {
          coverage: { valid: true },
          layers: { hasConflicts: false },
        },
      });

      const result = await service.validateCompatibility(
        'entity1',
        'clothing1'
      );

      expect(result.valid).toBe(true);
      expect(result.compatibility).toBeDefined();
      expect(
        equipmentOrchestrator.validateEquipmentCompatibility
      ).toHaveBeenCalledWith({
        entityId: 'entity1',
        clothingItemId: 'clothing1',
      });
    });

    it('should handle validation failure', async () => {
      equipmentOrchestrator.validateEquipmentCompatibility.mockResolvedValue({
        valid: false,
        errors: ['Size mismatch'],
        warnings: ['Layer conflict detected'],
      });

      const result = await service.validateCompatibility(
        'entity1',
        'clothing1'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Size mismatch']);
      expect(result.warnings).toEqual(['Layer conflict detected']);
    });

    it('should throw error for missing parameters', async () => {
      const result1 = await service.validateCompatibility('', 'clothing1');
      const result2 = await service.validateCompatibility('entity1', '');

      expect(result1.valid).toBe(false);
      expect(result1.errors).toEqual(['entityId is required']);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toEqual(['clothingItemId is required']);
    });
  });

  describe('transferClothing', () => {
    it('should successfully transfer clothing between entities', async () => {
      // Mock successful unequip
      equipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
        unequipped: true,
      });

      // Mock successful equip
      equipmentOrchestrator.orchestrateEquipment.mockResolvedValue({
        success: true,
        equipped: true,
      });

      const result = await service.transferClothing(
        'entity1',
        'entity2',
        'clothing1'
      );

      expect(result.success).toBe(true);
      expect(result.transferred).toBe(true);

      // Should call unequip first, then equip
      expect(equipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith(
        {
          entityId: 'entity1',
          clothingItemId: 'clothing1',
          reason: 'transfer',
        }
      );

      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith({
        entityId: 'entity2',
        clothingItemId: 'clothing1',
      });
    });

    it('should handle failed unequip from source', async () => {
      equipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: false,
        errors: ['Item not equipped'],
      });

      const result = await service.transferClothing(
        'entity1',
        'entity2',
        'clothing1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        'Failed to unequip from source: Item not equipped',
      ]);
      expect(equipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
    });

    it('should handle failed equip on target and re-equip on source', async () => {
      // Mock successful unequip
      equipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
        unequipped: true,
      });

      // Mock failed equip on target, then successful re-equip on source
      equipmentOrchestrator.orchestrateEquipment
        .mockResolvedValueOnce({
          success: false,
          errors: ['Coverage validation failed'],
        })
        .mockResolvedValueOnce({
          success: true,
          equipped: true,
        });

      const result = await service.transferClothing(
        'entity1',
        'entity2',
        'clothing1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        'Failed to equip on target: Coverage validation failed',
      ]);

      // Should attempt to re-equip on source
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledTimes(
        2
      );
      expect(
        equipmentOrchestrator.orchestrateEquipment
      ).toHaveBeenLastCalledWith({
        entityId: 'entity1',
        clothingItemId: 'clothing1',
      });
    });

    it('should throw error for missing parameters', async () => {
      const result1 = await service.transferClothing(
        '',
        'entity2',
        'clothing1'
      );
      const result2 = await service.transferClothing(
        'entity1',
        '',
        'clothing1'
      );
      const result3 = await service.transferClothing('entity1', 'entity2', '');

      expect(result1.success).toBe(false);
      expect(result1.errors).toEqual(['fromEntityId is required']);
      expect(result2.success).toBe(false);
      expect(result2.errors).toEqual(['toEntityId is required']);
      expect(result3.success).toBe(false);
      expect(result3.errors).toEqual(['clothingItemId is required']);
    });
  });

  describe('getAvailableSlots', () => {
    it('should get available clothing slots', async () => {
      const mockSlotsMap = new Map([
        [
          'torso_clothing',
          {
            allowedLayers: ['underwear', 'base', 'outer'],
          },
        ],
        [
          'lower_torso_clothing',
          {
            allowedLayers: ['underwear', 'base'],
          },
        ],
      ]);

      const expectedSlots = [
        {
          slotId: 'torso_clothing',
          allowedLayers: ['underwear', 'base', 'outer'],
          anatomySockets: ['*'],
        },
        {
          slotId: 'lower_torso_clothing',
          allowedLayers: ['underwear', 'base'],
          anatomySockets: ['*'],
        },
      ];

      // Mock the decomposed service dependencies
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' }) // anatomy:body call
        .mockReturnValue({ sockets: [] }); // anatomy:sockets calls

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          torso_clothing: {
            allowedLayers: ['underwear', 'base', 'outer'],
            anatomySockets: ['*'], // Wildcard allows any anatomy structure
          },
          lower_torso_clothing: {
            allowedLayers: ['underwear', 'base'],
            anatomySockets: ['*'], // Wildcard allows any anatomy structure
          },
        },
        slots: {}, // Empty slots object to satisfy validation
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      anatomyClothingCache.get.mockReturnValue(null); // Cache miss

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toEqual(expectedSlots);
    });

    it('should handle error getting slots', async () => {
      // Mock error in decomposed service
      entityManager.getComponentData.mockReturnValue({
        recipeId: 'test-recipe',
      });
      anatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
        new Error('Slot retrieval error')
      );
      anatomyClothingCache.get.mockReturnValue(null); // Cache miss

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Slot retrieval error']);
    });

    it('should throw error for missing entityId', async () => {
      const result = await service.getAvailableSlots('');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['entityId is required']);
    });

    it('should return cached data when available', async () => {
      const cachedSlots = new Map([
        ['cached_slot', { allowedLayers: ['base'], cached: true }],
      ]);

      anatomyClothingCache.get.mockReturnValue(cachedSlots);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([
        { slotId: 'cached_slot', allowedLayers: ['base'], cached: true },
      ]);
      expect(
        anatomyBlueprintRepository.getBlueprintByRecipeId
      ).not.toHaveBeenCalled();
    });

    it('should return empty slots when entity has no recipeId', async () => {
      entityManager.getComponentData.mockReturnValue({ recipeId: null });
      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([]);
      expect(
        anatomyBlueprintRepository.getBlueprintByRecipeId
      ).not.toHaveBeenCalled();
    });

    it('should return empty slots when blueprint has no clothingSlotMappings', async () => {
      entityManager.getComponentData.mockReturnValue({
        recipeId: 'test-recipe',
      });
      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        // No clothingSlotMappings property
        slots: {},
      });
      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'No clothing slot mappings for entity entity1'
      );
    });

    it('should collect sockets from root entity', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' }) // anatomy:body
        .mockReturnValueOnce({
          // root entity anatomy:sockets
          sockets: [{ id: 'root_socket_1' }, { id: 'root_socket_2' }],
        })
        .mockReturnValue({ sockets: [] }); // Other calls

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          test_slot: {
            allowedLayers: ['base'],
            anatomySockets: ['root_socket_1'],
          },
        },
        slots: {},
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('test_slot');
    });

    it('should collect sockets from child parts', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' }) // anatomy:body
        .mockReturnValueOnce({ sockets: [] }) // root entity sockets
        .mockReturnValueOnce({
          // child part 1 sockets
          sockets: [{ id: 'child_socket_1' }],
        })
        .mockReturnValueOnce({
          // child part 2 sockets
          sockets: [{ id: 'child_socket_2' }],
        });

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          test_slot: {
            allowedLayers: ['base'],
            anatomySockets: ['child_socket_1', 'child_socket_2'],
          },
        },
        slots: {},
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => ['part1', 'part2'],
      });

      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'part1',
        'anatomy:sockets'
      );
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'part2',
        'anatomy:sockets'
      );
    });

    it('should validate blueprint slots correctly', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' })
        .mockReturnValue({ sockets: [] });

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          valid_slot: {
            allowedLayers: ['base'],
            blueprintSlots: ['existing_slot'],
          },
          invalid_slot: {
            allowedLayers: ['base'],
            blueprintSlots: ['non_existing_slot'],
          },
        },
        slots: {
          existing_slot: {
            /* slot data */
          },
        },
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('valid_slot');
      expect(logger.debug).toHaveBeenCalledWith(
        "Blueprint slot 'non_existing_slot' not found in blueprint"
      );
    });

    it('should handle wildcard sockets', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' })
        .mockReturnValue({ sockets: [] });

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          wildcard_slot: {
            allowedLayers: ['base'],
            anatomySockets: ['*'], // Wildcard
          },
        },
        slots: {},
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('wildcard_slot');
    });

    it('should validate direct sockets and log when not found', async () => {
      // Mock body component call first
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' }) // anatomy:body
        .mockReturnValueOnce({
          // root entity anatomy:sockets
          sockets: [{ id: 'existing_socket' }],
        })
        .mockReturnValue({ sockets: [] }); // child parts have no sockets

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          invalid_socket_slot: {
            allowedLayers: ['base'],
            anatomySockets: ['missing_socket'],
          },
          valid_socket_slot: {
            allowedLayers: ['base'],
            anatomySockets: ['existing_socket', 'missing_socket'],
          },
        },
        slots: {},
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('valid_socket_slot');
      expect(logger.debug).toHaveBeenCalledWith(
        "Socket 'missing_socket' not found in anatomy structure"
      );
    });

    it('should skip slots with neither blueprintSlots nor anatomySockets', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({ recipeId: 'test-recipe' })
        .mockReturnValue({ sockets: [] });

      anatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
        clothingSlotMappings: {
          valid_slot: {
            allowedLayers: ['base'],
            anatomySockets: ['*'],
          },
          invalid_slot: {
            allowedLayers: ['base'],
            // Neither blueprintSlots nor anatomySockets
          },
        },
        slots: {},
      });

      bodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      anatomyClothingCache.get.mockReturnValue(null);

      const result = await service.getAvailableSlots('entity1');

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('valid_slot');
    });
  });
});
