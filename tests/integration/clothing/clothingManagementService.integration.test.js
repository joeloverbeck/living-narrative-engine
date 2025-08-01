/**
 * @file Integration tests for ClothingManagementService
 * Tests the complete clothing management workflows with real dependencies
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

describe('ClothingManagementService Integration', () => {
  let clothingManagementService;
  let entityManager;
  let eventDispatcher;
  let logger;
  let equipmentOrchestrator;
  let anatomyBlueprintRepository;
  let clothingSlotValidator;
  let bodyGraphService;
  let anatomyClothingCache;

  beforeEach(async () => {
    // Create core dependencies
    logger = createMockLogger();
    eventDispatcher = createMockSafeEventDispatcher();

    // Create mock schema validator
    const schemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      validateAgainstSchema: jest.fn().mockReturnValue({ valid: true }),
      getSchema: jest.fn(),
      hasSchema: jest.fn().mockReturnValue(true),
      loadSchemaDirectory: jest.fn(),
      loadSchema: jest.fn(),
    };

    // Create entity manager mock
    const entities = new Map();
    entityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        const entity = entities.get(entityId);
        return entity?.components?.[componentId] || null;
      }),
      setComponentData: jest.fn((entityId, componentId, data) => {
        const entity = entities.get(entityId);
        if (entity) {
          entity.components[componentId] = data;
        }
      }),
      createEntity: jest.fn((id) => {
        const entity = {
          id,
          components: {},
          getComponentData: jest.fn(
            (componentId) => entity.components[componentId]
          ),
        };
        entities.set(id, entity);
        return entity;
      }),
      addComponent: jest.fn((entityId, { componentId, data }) => {
        const entity = entities.get(entityId);
        if (entity) {
          entity.components[componentId] = data;
        }
      }),
      entities, // Expose for test access
    };

    // Create mock services for dependencies
    const layerCompatibilityService = {
      checkLayerConflicts: jest.fn().mockResolvedValue({ hasConflicts: false }),
      validateLayerOrder: jest.fn().mockReturnValue({ valid: true }),
    };

    equipmentOrchestrator = {
      orchestrateEquipment: jest
        .fn()
        .mockResolvedValue({ success: true, equipped: true }),
      orchestrateUnequipment: jest
        .fn()
        .mockResolvedValue({ success: true, unequipped: true }),
      validateEquipmentCompatibility: jest
        .fn()
        .mockResolvedValue({ valid: true }),
    };

    anatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn().mockResolvedValue(null),
      getAllBlueprints: jest.fn().mockResolvedValue([]),
    };

    clothingSlotValidator = {
      validateSlotCompatibility: jest.fn().mockReturnValue({ valid: true }),
      getValidSlots: jest.fn().mockReturnValue([]),
    };

    bodyGraphService = {
      getBodyGraph: jest.fn().mockResolvedValue({
        getAllPartIds: () => [],
        getRootEntityId: () => 'root',
      }),
      getAnatomyData: jest.fn().mockResolvedValue({ recipeId: 'human_base' }),
    };

    anatomyClothingCache = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      delete: jest.fn(),
      clear: jest.fn(),
    };

    // Create the service under test
    clothingManagementService = new ClothingManagementService({
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

  afterEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('constructor validation', () => {
    it('should throw error when anatomyBlueprintRepository is missing', () => {
      expect(
        () =>
          new ClothingManagementService({
            entityManager,
            logger,
            eventDispatcher,
            equipmentOrchestrator,
            // anatomyBlueprintRepository missing
            clothingSlotValidator,
            bodyGraphService,
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
            // clothingSlotValidator missing
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
            // bodyGraphService missing
          })
      ).toThrow('bodyGraphService is required');
    });
  });

  describe('equipClothing', () => {
    let actorId;
    let clothingItemId;

    beforeEach(() => {
      actorId = 'test-actor';
      clothingItemId = 'test-shirt';

      // Create actor with equipment component
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'clothing:equipment',
        data: { equipped: {} },
      });

      // Create clothing item
      entityManager.createEntity(clothingItemId);
      entityManager.addComponent(clothingItemId, {
        componentId: 'clothing:item',
        data: {
          slot: 'torso_upper',
          layer: 'base',
          coverageAreas: ['torso'],
        },
      });
    });

    it('should successfully equip clothing item', async () => {
      // Mock orchestrator to simulate successful equipment
      equipmentOrchestrator.orchestrateEquipment = jest.fn().mockResolvedValue({
        success: true,
        equipped: true,
      });

      const result = await clothingManagementService.equipClothing(
        actorId,
        clothingItemId
      );

      expect(result.success).toBe(true);
      expect(result.equipped).toBe(true);
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith({
        entityId: actorId,
        clothingItemId,
      });
    });

    it('should handle equipment with layer options', async () => {
      // Mock orchestrator to simulate successful equipment
      equipmentOrchestrator.orchestrateEquipment = jest.fn().mockResolvedValue({
        success: true,
        equipped: true,
      });

      const result = await clothingManagementService.equipClothing(
        actorId,
        clothingItemId,
        { layer: 'mid', validateCoverage: true }
      );

      expect(result.success).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Equipping clothing '${clothingItemId}'`),
        expect.objectContaining({
          options: { layer: 'mid', validateCoverage: true },
        })
      );
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith({
        entityId: actorId,
        clothingItemId,
        layer: 'mid',
        validateCoverage: true,
      });
    });

    it('should handle equipment failures', async () => {
      // Mock orchestrator to return failure
      equipmentOrchestrator.orchestrateEquipment = jest.fn().mockResolvedValue({
        success: false,
        errors: ['Slot already occupied'],
      });

      const result = await clothingManagementService.equipClothing(
        actorId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Slot already occupied');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to equip clothing'),
        expect.objectContaining({ errors: ['Slot already occupied'] })
      );
    });

    it('should handle missing entityId', async () => {
      const result = await clothingManagementService.equipClothing(
        null,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('entityId is required');
    });

    it('should handle missing clothingItemId', async () => {
      const result = await clothingManagementService.equipClothing(
        actorId,
        null
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('clothingItemId is required');
    });

    it('should handle orchestrator exceptions', async () => {
      equipmentOrchestrator.orchestrateEquipment = jest
        .fn()
        .mockRejectedValue(new Error('Orchestrator error'));

      const result = await clothingManagementService.equipClothing(
        actorId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Orchestrator error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error equipping clothing'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('unequipClothing', () => {
    let actorId;
    let clothingItemId;

    beforeEach(() => {
      actorId = 'test-actor';
      clothingItemId = 'test-shirt';

      // Create actor with equipped item
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'clothing:equipment',
        data: { equipped: { torso_upper: clothingItemId } },
      });

      // Create clothing item
      entityManager.createEntity(clothingItemId);
      entityManager.addComponent(clothingItemId, {
        componentId: 'clothing:item',
        data: {
          slot: 'torso_upper',
          layer: 'base',
        },
      });
    });

    it('should successfully unequip clothing item', async () => {
      // Mock orchestrator to simulate successful unequipment
      equipmentOrchestrator.orchestrateUnequipment = jest
        .fn()
        .mockResolvedValue({
          success: true,
          unequipped: true,
        });

      const result = await clothingManagementService.unequipClothing(
        actorId,
        clothingItemId
      );

      expect(result.success).toBe(true);
      expect(result.unequipped).toBe(true);
      expect(equipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith(
        {
          entityId: actorId,
          clothingItemId,
        }
      );
    });

    it('should handle cascade unequip option', async () => {
      // Mock orchestrator to simulate successful unequipment
      equipmentOrchestrator.orchestrateUnequipment = jest
        .fn()
        .mockResolvedValue({
          success: true,
          unequipped: true,
          cascadeItems: ['other-item-1', 'other-item-2'],
        });

      const result = await clothingManagementService.unequipClothing(
        actorId,
        clothingItemId,
        { cascadeUnequip: true, reason: 'player_action' }
      );

      expect(result.success).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Unequipping clothing '${clothingItemId}'`),
        expect.objectContaining({
          options: { cascadeUnequip: true, reason: 'player_action' },
        })
      );
      expect(equipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith(
        {
          entityId: actorId,
          clothingItemId,
          cascadeUnequip: true,
          reason: 'player_action',
        }
      );
    });

    it('should handle unequipment failures', async () => {
      equipmentOrchestrator.orchestrateUnequipment = jest
        .fn()
        .mockResolvedValue({
          success: false,
          errors: ['Item is cursed'],
        });

      const result = await clothingManagementService.unequipClothing(
        actorId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is cursed');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to unequip clothing'),
        expect.objectContaining({ errors: ['Item is cursed'] })
      );
    });

    it('should handle missing entityId', async () => {
      const result = await clothingManagementService.unequipClothing(
        null,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('entityId is required');
    });

    it('should handle missing clothingItemId', async () => {
      const result = await clothingManagementService.unequipClothing(
        actorId,
        null
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('clothingItemId is required');
    });

    it('should handle orchestrator exceptions', async () => {
      equipmentOrchestrator.orchestrateUnequipment = jest
        .fn()
        .mockRejectedValue(new Error('Unequip error'));

      const result = await clothingManagementService.unequipClothing(
        actorId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unequip error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error unequipping clothing'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('getEquippedItems', () => {
    it('should return equipped items for entity', async () => {
      const actorId = 'test-actor';
      const equippedData = {
        torso_upper: 'shirt-id',
        legs: 'pants-id',
        feet: 'shoes-id',
      };

      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'clothing:equipment',
        data: { equipped: equippedData },
      });

      const result = await clothingManagementService.getEquippedItems(actorId);

      expect(result.success).toBe(true);
      expect(result.equipped).toEqual(equippedData);
    });

    it('should return empty object for entity without equipment', async () => {
      const actorId = 'test-actor';
      entityManager.createEntity(actorId);

      const result = await clothingManagementService.getEquippedItems(actorId);

      expect(result.success).toBe(true);
      expect(result.equipped).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no equipment component')
      );
    });

    it('should handle missing entityId', async () => {
      const result = await clothingManagementService.getEquippedItems(null);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('entityId is required');
    });

    it('should handle errors during retrieval', async () => {
      const actorId = 'test-actor';
      entityManager.getComponentData = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await clothingManagementService.getEquippedItems(actorId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting equipped items'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('validateCompatibility', () => {
    let actorId;
    let clothingItemId;

    beforeEach(() => {
      actorId = 'test-actor';
      clothingItemId = 'test-shirt';

      entityManager.createEntity(actorId);
      entityManager.createEntity(clothingItemId);
    });

    it('should validate compatible clothing', async () => {
      equipmentOrchestrator.validateEquipmentCompatibility = jest
        .fn()
        .mockResolvedValue({
          valid: true,
          compatibility: { slot: 'torso_upper', layer: 'base' },
        });

      const result = await clothingManagementService.validateCompatibility(
        actorId,
        clothingItemId
      );

      expect(result.valid).toBe(true);
      expect(result.compatibility).toBeDefined();
    });

    it('should validate with options', async () => {
      const options = { checkLayerConflicts: true };

      equipmentOrchestrator.validateEquipmentCompatibility = jest
        .fn()
        .mockResolvedValue({
          valid: false,
          errors: ['Layer conflict detected'],
          warnings: ['Consider removing outer layer first'],
        });

      const result = await clothingManagementService.validateCompatibility(
        actorId,
        clothingItemId,
        options
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Layer conflict detected');
      expect(result.warnings).toContain('Consider removing outer layer first');
      expect(
        equipmentOrchestrator.validateEquipmentCompatibility
      ).toHaveBeenCalledWith({
        entityId: actorId,
        clothingItemId,
        ...options,
      });
    });

    it('should handle missing entityId', async () => {
      const result = await clothingManagementService.validateCompatibility(
        null,
        clothingItemId
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('entityId is required');
    });

    it('should handle missing clothingItemId', async () => {
      const result = await clothingManagementService.validateCompatibility(
        actorId,
        null
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('clothingItemId is required');
    });

    it('should handle validation exceptions', async () => {
      equipmentOrchestrator.validateEquipmentCompatibility = jest
        .fn()
        .mockRejectedValue(new Error('Validation error'));

      const result = await clothingManagementService.validateCompatibility(
        actorId,
        clothingItemId
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error validating compatibility'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('getAvailableSlots', () => {
    let actorId;

    beforeEach(() => {
      actorId = 'test-actor';
      entityManager.createEntity(actorId);
    });

    it('should return available slots from blueprint', async () => {
      // Setup anatomy body component
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'humanoid_base' },
      });

      // Mock blueprint with clothing slots
      const mockBlueprint = {
        clothingSlotMappings: {
          torso_upper: {
            blueprintSlots: ['chest'],
            allowedLayers: ['base', 'mid', 'outer'],
          },
          legs: {
            blueprintSlots: ['waist', 'thighs'],
            allowedLayers: ['base', 'outer'],
          },
        },
        slots: {
          chest: { id: 'chest' },
          waist: { id: 'waist' },
          thighs: { id: 'thighs' },
        },
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      // Mock body graph
      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => ['torso-part', 'leg-part'],
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(2);
      expect(result.slots[0]).toEqual({
        slotId: 'torso_upper',
        blueprintSlots: ['chest'],
        allowedLayers: ['base', 'mid', 'outer'],
      });
      expect(result.slots[1]).toEqual({
        slotId: 'legs',
        blueprintSlots: ['waist', 'thighs'],
        allowedLayers: ['base', 'outer'],
      });
    });

    it('should use cache for repeated calls', async () => {
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'humanoid_base' },
      });

      const mockBlueprint = {
        clothingSlotMappings: {
          torso_upper: {
            blueprintSlots: ['chest'],
            allowedLayers: ['base'],
          },
        },
        slots: { chest: { id: 'chest' } },
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => [],
      });

      // Mock cache to return null on first call, then return cached value
      let cacheCallCount = 0;
      anatomyClothingCache.get = jest.fn().mockImplementation(() => {
        cacheCallCount++;
        if (cacheCallCount === 1) {
          return null; // First call, no cache
        }
        // Second call, return cached slots
        return new Map([
          [
            'torso_upper',
            { blueprintSlots: ['chest'], allowedLayers: ['base'] },
          ],
        ]);
      });

      // First call
      await clothingManagementService.getAvailableSlots(actorId);

      // Second call should use cache
      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(anatomyClothingCache.get).toHaveBeenCalledTimes(2);
      expect(anatomyClothingCache.set).toHaveBeenCalledTimes(1);
      // Repository should only be called once since second call uses cache
      expect(
        anatomyBlueprintRepository.getBlueprintByRecipeId
      ).toHaveBeenCalledTimes(1);
    });

    it('should handle entity without body component', async () => {
      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([]);
    });

    it('should handle missing entityId', async () => {
      const result = await clothingManagementService.getAvailableSlots(null);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('entityId is required');
    });

    it('should handle errors during slot retrieval', async () => {
      entityManager.getComponentData = jest.fn().mockImplementation(() => {
        throw new Error('Component error');
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Component error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting available slots'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should validate socket-based slots', async () => {
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'humanoid_base' },
      });

      entityManager.addComponent(actorId, {
        componentId: 'anatomy:sockets',
        data: {
          sockets: [
            { id: 'head_socket', type: 'equipment' },
            { id: 'neck_socket', type: 'equipment' },
          ],
        },
      });

      const mockBlueprint = {
        clothingSlotMappings: {
          head: {
            anatomySockets: ['head_socket'],
            allowedLayers: ['base'],
          },
          neck: {
            anatomySockets: ['neck_socket', 'collar_socket'], // One exists, one doesn't
            allowedLayers: ['accessories'],
          },
          wildcard: {
            anatomySockets: ['*'], // Wildcard should always match
            allowedLayers: ['special'],
          },
        },
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => [],
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(3); // head, neck, and wildcard
      expect(result.slots.map((s) => s.slotId)).toContain('head');
      expect(result.slots.map((s) => s.slotId)).toContain('neck');
      expect(result.slots.map((s) => s.slotId)).toContain('wildcard');
    });
  });

  describe('transferClothing', () => {
    let fromEntityId;
    let toEntityId;
    let clothingItemId;

    beforeEach(() => {
      fromEntityId = 'source-actor';
      toEntityId = 'target-actor';
      clothingItemId = 'test-shirt';

      // Create source entity with equipped item
      entityManager.createEntity(fromEntityId);
      entityManager.addComponent(fromEntityId, {
        componentId: 'clothing:equipment',
        data: { equipped: { torso_upper: clothingItemId } },
      });
      entityManager.addComponent(fromEntityId, {
        componentId: 'core:position',
        data: { locationId: 'test-location' },
      });

      // Create target entity
      entityManager.createEntity(toEntityId);
      entityManager.addComponent(toEntityId, {
        componentId: 'clothing:equipment',
        data: { equipped: {} },
      });

      // Create clothing item
      entityManager.createEntity(clothingItemId);
      entityManager.addComponent(clothingItemId, {
        componentId: 'clothing:item',
        data: { slot: 'torso_upper', layer: 'base' },
      });
    });

    it('should successfully transfer clothing between entities', async () => {
      // Mock unequip and equip operations
      clothingManagementService.unequipClothing = jest.fn().mockResolvedValue({
        success: true,
        unequipped: true,
      });

      clothingManagementService.equipClothing = jest.fn().mockResolvedValue({
        success: true,
        equipped: true,
      });

      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        toEntityId,
        clothingItemId
      );

      expect(result.success).toBe(true);
      expect(result.transferred).toBe(true);

      // Verify unequip was called first
      expect(clothingManagementService.unequipClothing).toHaveBeenCalledWith(
        fromEntityId,
        clothingItemId,
        { reason: 'transfer' }
      );

      // Verify equip was called second
      expect(clothingManagementService.equipClothing).toHaveBeenCalledWith(
        toEntityId,
        clothingItemId,
        {}
      );
    });

    it('should handle transfer with options', async () => {
      const options = { layer: 'mid', validateCoverage: true };

      // Mock unequip and equip operations
      clothingManagementService.unequipClothing = jest.fn().mockResolvedValue({
        success: true,
        unequipped: true,
      });

      clothingManagementService.equipClothing = jest.fn().mockResolvedValue({
        success: true,
        equipped: true,
      });

      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        toEntityId,
        clothingItemId,
        options
      );

      expect(result.success).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Transferring clothing '${clothingItemId}'`),
        expect.objectContaining({ options })
      );

      // Verify equip was called with options
      expect(clothingManagementService.equipClothing).toHaveBeenCalledWith(
        toEntityId,
        clothingItemId,
        options
      );
    });

    it('should rollback on equip failure', async () => {
      // Make unequip succeed
      clothingManagementService.unequipClothing = jest.fn().mockResolvedValue({
        success: true,
        unequipped: true,
      });

      // Make target equip fail, then succeed on rollback
      let equipCallCount = 0;
      clothingManagementService.equipClothing = jest
        .fn()
        .mockImplementation(async () => {
          equipCallCount++;
          if (equipCallCount === 1) {
            return { success: false, errors: ['Target incompatible'] };
          }
          return { success: true, equipped: true };
        });

      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        toEntityId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Failed to equip on target: Target incompatible'
      );

      // Item should be re-equipped on source
      expect(clothingManagementService.equipClothing).toHaveBeenCalledTimes(2);
      expect(clothingManagementService.equipClothing).toHaveBeenLastCalledWith(
        fromEntityId,
        clothingItemId,
        {}
      );
    });

    it('should handle unequip failure', async () => {
      clothingManagementService.unequipClothing = jest
        .fn()
        .mockResolvedValue({ success: false, errors: ['Item is bound'] });

      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        toEntityId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Failed to unequip from source: Item is bound'
      );
    });

    it('should handle missing fromEntityId', async () => {
      const result = await clothingManagementService.transferClothing(
        null,
        toEntityId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('fromEntityId is required');
    });

    it('should handle missing toEntityId', async () => {
      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        null,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('toEntityId is required');
    });

    it('should handle missing clothingItemId', async () => {
      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        toEntityId,
        null
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('clothingItemId is required');
    });

    it('should handle transfer exceptions', async () => {
      clothingManagementService.unequipClothing = jest
        .fn()
        .mockRejectedValue(new Error('Transfer error'));

      const result = await clothingManagementService.transferClothing(
        fromEntityId,
        toEntityId,
        clothingItemId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Transfer error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error transferring clothing'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('private method coverage', () => {
    it('should handle entities with child parts having sockets', async () => {
      const actorId = 'test-actor';
      const childPartId = 'arm-part';

      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'humanoid_base' },
      });

      // Create child part with sockets
      entityManager.createEntity(childPartId);
      entityManager.addComponent(childPartId, {
        componentId: 'anatomy:sockets',
        data: {
          sockets: [{ id: 'wrist_socket', type: 'equipment' }],
        },
      });

      const mockBlueprint = {
        clothingSlotMappings: {
          wrist: {
            anatomySockets: ['wrist_socket'],
            allowedLayers: ['accessories'],
          },
        },
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => [childPartId],
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('wrist');
    });

    it('should handle blueprint without clothingSlotMappings', async () => {
      const actorId = 'test-actor';

      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'simple_base' },
      });

      const mockBlueprint = {
        // No clothingSlotMappings
        slots: {},
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => [],
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No clothing slot mappings')
      );
    });

    it('should log when blueprint slots are not found', async () => {
      const actorId = 'test-actor';

      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'humanoid_base' },
      });

      const mockBlueprint = {
        clothingSlotMappings: {
          torso_upper: {
            blueprintSlots: ['missing_slot'], // This slot doesn't exist in blueprint
            allowedLayers: ['base'],
          },
        },
        slots: {
          chest: { id: 'chest' }, // Different slot exists
        },
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => [],
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([]); // No valid slots
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Blueprint slot 'missing_slot' not found")
      );
    });

    it('should log when anatomy sockets are not found', async () => {
      const actorId = 'test-actor';

      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, {
        componentId: 'anatomy:body',
        data: { recipeId: 'humanoid_base' },
      });

      entityManager.addComponent(actorId, {
        componentId: 'anatomy:sockets',
        data: {
          sockets: [{ id: 'head_socket', type: 'equipment' }],
        },
      });

      const mockBlueprint = {
        clothingSlotMappings: {
          neck: {
            anatomySockets: ['neck_socket'], // This socket doesn't exist
            allowedLayers: ['accessories'],
          },
        },
      };

      anatomyBlueprintRepository.getBlueprintByRecipeId = jest
        .fn()
        .mockResolvedValue(mockBlueprint);

      bodyGraphService.getBodyGraph = jest.fn().mockResolvedValue({
        getAllPartIds: () => [],
      });

      const result = await clothingManagementService.getAvailableSlots(actorId);

      expect(result.success).toBe(true);
      expect(result.slots).toEqual([]); // No valid slots
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Socket 'neck_socket' not found")
      );
    });
  });
});
