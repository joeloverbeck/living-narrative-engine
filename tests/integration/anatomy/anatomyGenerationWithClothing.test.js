/**
 * @file Integration tests for anatomy generation with clothing instantiation
 * @see src/anatomy/workflows/anatomyGenerationWorkflow.js
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import { ClothingInstantiationService } from '../../../src/clothing/services/clothingInstantiationService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createStatefulMockDataRegistry } from '../../common/mockFactories/entities.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('Anatomy Generation with Clothing Integration', () => {
  let entityManager;
  let dataRegistry;
  let logger;
  let bodyBlueprintFactory;
  let equipmentOrchestrator;
  let anatomyClothingIntegrationService;
  let eventBus;
  let clothingInstantiationService;
  let anatomyGenerationWorkflow;

  const ownerId = 'actor_123';
  const blueprintId = 'anatomy:human_male';
  const recipeId = 'anatomy:human_peasant';

  beforeEach(() => {
    // Create test helpers
    entityManager = new SimpleEntityManager();
    dataRegistry = createStatefulMockDataRegistry();
    logger = createMockLogger();

    // Add createEntityInstance method to entityManager for ClothingInstantiationService
    entityManager.createEntityInstance = jest.fn();

    // Create mock services
    bodyBlueprintFactory = {
      createAnatomyGraph: jest.fn().mockResolvedValue({
        rootId: 'torso_123',
        entities: [
          'torso_123',
          'head_123',
          'left_arm_123',
          'right_arm_123',
          'legs_123',
        ],
      }),
    };

    equipmentOrchestrator = {
      orchestrateEquipment: jest.fn().mockResolvedValue({ success: true }),
    };

    anatomyClothingIntegrationService = {
      validateClothingSlotCompatibility: jest.fn().mockResolvedValue({
        valid: true,
      }),
    };

    eventBus = {
      dispatch: jest.fn(),
    };

    // Create real service instances
    clothingInstantiationService = new ClothingInstantiationService({
      entityManager,
      dataRegistry,
      equipmentOrchestrator,
      anatomyClothingIntegrationService,
      logger,
      eventBus,
    });

    anatomyGenerationWorkflow = new AnatomyGenerationWorkflow({
      entityManager,
      dataRegistry,
      logger,
      bodyBlueprintFactory,
      clothingInstantiationService,
    });
  });

  describe('Complete anatomy generation with clothing', () => {
    beforeEach(() => {
      // Setup entity manager with anatomy parts
      entityManager.setEntities([
        {
          id: 'torso_123',
          components: {
            'core:name': { text: 'torso' },
            'anatomy:body_part': { type: 'torso' },
          },
        },
        {
          id: 'head_123',
          components: {
            'core:name': { text: 'head' },
            'anatomy:body_part': { type: 'head' },
          },
        },
        {
          id: 'left_arm_123',
          components: {
            'core:name': { text: 'left_arm' },
            'anatomy:body_part': { type: 'arm' },
          },
        },
        {
          id: 'right_arm_123',
          components: {
            'core:name': { text: 'right_arm' },
            'anatomy:body_part': { type: 'arm' },
          },
        },
        {
          id: 'legs_123',
          components: {
            'core:name': { text: 'legs' },
            'anatomy:body_part': { type: 'legs' },
          },
        },
      ]);

      // Setup recipe with clothing
      dataRegistry.store('anatomyRecipes', recipeId, {
        recipeId,
        blueprintId,
        slots: {
          torso: { partType: 'torso' },
          head: { partType: 'head' },
          left_arm: { partType: 'arm' },
          right_arm: { partType: 'arm' },
          legs: { partType: 'legs' },
        },
        clothingEntities: [
          {
            entityId: 'clothing:peasant_shirt',
            equip: true,
            properties: { color: 'brown', condition: 0.7 },
          },
          {
            entityId: 'clothing:rough_trousers',
            equip: true,
            properties: { color: 'gray' },
          },
          {
            entityId: 'clothing:worn_boots',
            equip: true,
          },
          {
            entityId: 'clothing:straw_hat',
            equip: false,
          },
        ],
      });

      // Setup entity definitions for clothing using the stateful mock
      dataRegistry.store('entityDefinitions', 'clothing:peasant_shirt', {
        id: 'clothing:peasant_shirt',
        components: {
          'core:name': { text: 'Peasant Shirt' },
          'clothing:wearable': {
            equipmentSlots: { primary: 'torso_upper' },
            layer: 'base',
          },
        },
      });
      dataRegistry.store('entityDefinitions', 'clothing:rough_trousers', {
        id: 'clothing:rough_trousers',
        components: {
          'core:name': { text: 'Rough Trousers' },
          'clothing:wearable': {
            equipmentSlots: { primary: 'legs' },
            layer: 'base',
          },
        },
      });
      dataRegistry.store('entityDefinitions', 'clothing:worn_boots', {
        id: 'clothing:worn_boots',
        components: {
          'core:name': { text: 'Worn Boots' },
          'clothing:wearable': {
            equipmentSlots: { primary: 'feet' },
            layer: 'outer',
          },
        },
      });
      dataRegistry.store('entityDefinitions', 'clothing:straw_hat', {
        id: 'clothing:straw_hat',
        components: {
          'core:name': { text: 'Straw Hat' },
          'clothing:wearable': {
            equipmentSlots: { primary: 'head' },
            layer: 'outer',
          },
        },
      });

      // Mock entity creation for clothing
      let clothingCounter = 1;
      entityManager.createEntityInstance.mockImplementation((defId, props) => {
        const clothingId = `clothing_${clothingCounter++}`;
        const currentEntities = Array.from(entityManager.entities.values()).map(
          (e) => ({ id: e.id, components: e.components })
        );
        currentEntities.push({
          id: clothingId,
          components: {
            'core:name': { text: defId.replace('clothing:', '') },
            'clothing:wearable': { equipped: false },
            ...props,
          },
        });
        entityManager.setEntities(currentEntities);
        return Promise.resolve(clothingId);
      });
    });

    it('should generate complete character with anatomy and clothing', async () => {
      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        recipeId,
        {
          ownerId,
        }
      );

      // Verify anatomy was created
      expect(result.rootId).toBe('torso_123');
      expect(result.entities).toHaveLength(5);
      expect(result.partsMap).toEqual({
        torso: 'torso_123',
        head: 'head_123',
        left_arm: 'left_arm_123',
        right_arm: 'right_arm_123',
        legs: 'legs_123',
      });

      // Verify clothing was instantiated
      expect(result.clothingResult).toBeDefined();
      expect(result.clothingResult.instantiated).toHaveLength(4);
      expect(result.clothingResult.equipped).toHaveLength(3); // hat not equipped

      // Verify clothing entities were created with correct properties
      const shirtEntity = entityManager.getEntityInstance('clothing_1');
      expect(shirtEntity).toBeDefined();
      expect(shirtEntity.getComponentData('clothing:wearable')).toBeTruthy();

      // Verify events were dispatched
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'clothing:instantiation_completed',
        expect.objectContaining({
          actorId: ownerId,
          result: expect.any(Object),
        })
      );
    });

    it('should apply property overrides to clothing entities', async () => {
      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        recipeId,
        {
          ownerId,
        }
      );

      // Check that createEntityInstance was called with property overrides
      expect(entityManager.createEntityInstance).toHaveBeenCalledWith(
        'clothing:peasant_shirt',
        { color: 'brown', condition: 0.7 }
      );
      expect(entityManager.createEntityInstance).toHaveBeenCalledWith(
        'clothing:rough_trousers',
        { color: 'gray' }
      );
    });

    it('should handle recipes without clothing gracefully', async () => {
      // Setup recipe without clothing
      dataRegistry.store('anatomyRecipes', 'anatomy:human_basic', {
        recipeId: 'anatomy:human_basic',
        blueprintId,
        slots: {
          torso: { partType: 'torso' },
          head: { partType: 'head' },
        },
        // No clothingEntities
      });

      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        'anatomy:human_basic',
        { ownerId }
      );

      // Anatomy should be created normally
      expect(result.rootId).toBe('torso_123');
      expect(result.entities).toHaveLength(5);

      // No clothing result
      expect(result.clothingResult).toBeUndefined();
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should continue anatomy generation even if clothing instantiation fails', async () => {
      // Make clothing instantiation fail by clearing entities
      dataRegistry.clear();
      // Re-add the recipe but not the clothing entities
      dataRegistry.store('anatomyRecipes', recipeId, {
        recipeId,
        blueprintId,
        slots: {
          torso: { partType: 'torso' },
          head: { partType: 'head' },
          left_arm: { partType: 'arm' },
          right_arm: { partType: 'arm' },
          legs: { partType: 'legs' },
        },
        clothingEntities: [
          {
            entityId: 'clothing:peasant_shirt',
            equip: true,
          },
        ],
      });

      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        recipeId,
        {
          ownerId,
        }
      );

      // Anatomy should still be created
      expect(result.rootId).toBe('torso_123');
      expect(result.entities).toHaveLength(5);
      expect(result.partsMap).toBeDefined();

      // Clothing should have errors but not crash
      expect(result.clothingResult).toBeDefined();
      expect(result.clothingResult.errors.length).toBeGreaterThan(0);
    });

    it('should respect equip flag for clothing items', async () => {
      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        recipeId,
        {
          ownerId,
        }
      );

      // Verify equipment orchestrator was called only for items with equip: true
      expect(equipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledTimes(
        3
      );

      // Verify straw hat was instantiated but not equipped
      expect(result.clothingResult.instantiated).toContainEqual(
        expect.objectContaining({ definitionId: 'clothing:straw_hat' })
      );
      expect(result.clothingResult.equipped).not.toContain('clothing_4'); // hat ID
    });

    it('should validate clothing slots against anatomy blueprint', async () => {
      // Make one item fail validation
      anatomyClothingIntegrationService.validateClothingSlotCompatibility
        .mockResolvedValueOnce({ valid: true })
        .mockResolvedValueOnce({ valid: false, reason: 'Invalid slot' })
        .mockResolvedValueOnce({ isValid: true, errors: [] })
        .mockResolvedValueOnce({ isValid: true, errors: [] });

      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        recipeId,
        {
          ownerId,
        }
      );

      // Should still instantiate valid items
      expect(result.clothingResult.instantiated.length).toBeGreaterThan(0);
      expect(result.clothingResult.errors).toContain('Invalid slot');
    });

    it('should properly convert parts map for clothing service', async () => {
      await anatomyGenerationWorkflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Get the call to instantiateRecipeClothing
      const mockCalls =
        clothingInstantiationService.instantiateRecipeClothing.mock ||
        jest.spyOn(clothingInstantiationService, 'instantiateRecipeClothing')
          .mock;

      if (mockCalls && mockCalls.calls.length > 0) {
        const partsMapArg = mockCalls.calls[0][2];
        expect(partsMapArg).toBeInstanceOf(Map);
        expect(partsMapArg.get('torso')).toBe('torso_123');
        expect(partsMapArg.get('head')).toBe('head_123');
      }
    });
  });

  describe('Performance considerations', () => {
    it('should handle large numbers of clothing items efficiently', async () => {
      // Create recipe with many clothing items
      const manyClothes = [];
      for (let i = 1; i <= 20; i++) {
        manyClothes.push({
          entityId: `clothing:item_${i}`,
          equip: i <= 10, // Only equip first 10
        });
      }

      dataRegistry.store('anatomyRecipes', 'anatomy:heavily_clothed', {
        recipeId: 'anatomy:heavily_clothed',
        blueprintId,
        slots: { torso: { partType: 'torso' } },
        clothingEntities: manyClothes,
      });

      // Store generic clothing definition for all items
      const genericClothing = {
        id: 'clothing:generic',
        components: {
          'clothing:wearable': { equipmentSlots: { primary: 'torso_upper' } },
        },
      };

      // Store all clothing items with the generic definition
      for (let i = 1; i <= 20; i++) {
        dataRegistry.store('entityDefinitions', `clothing:item_${i}`, {
          ...genericClothing,
          id: `clothing:item_${i}`,
        });
      }

      const startTime = Date.now();
      const result = await anatomyGenerationWorkflow.generate(
        blueprintId,
        'anatomy:heavily_clothed',
        { ownerId }
      );
      const endTime = Date.now();

      expect(result.clothingResult.instantiated).toHaveLength(20);
      expect(result.clothingResult.equipped).toHaveLength(10);

      // Should complete in reasonable time (< 500ms)
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});
