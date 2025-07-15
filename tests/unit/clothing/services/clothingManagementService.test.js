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

    it('should throw error when no anatomy integration service is provided', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            eventDispatcher,
            equipmentOrchestrator,
          })
      ).toThrow(
        'Either anatomyClothingIntegrationService or anatomyBlueprintRepository must be provided'
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
      expect(logger.info).toHaveBeenCalledWith(
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
  });
});
