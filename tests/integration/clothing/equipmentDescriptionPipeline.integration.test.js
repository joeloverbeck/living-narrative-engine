/**
 * @file Integration tests for the complete clothing description pipeline
 * Tests the full flow from clothing data retrieval to final description generation
 */

import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import EquipmentDescriptionService from '../../../src/clothing/services/equipmentDescriptionService.js';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import { ClothingIntegrationTestBed } from '../../common/clothing/clothingIntegrationTestBed.js';

describe('Equipment Description Pipeline Integration', () => {
  let testBed;
  let equipmentDescriptionService;
  let clothingManagementService;

  beforeEach(async () => {
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();

    // Get services from testBed
    equipmentDescriptionService = testBed.getService(
      'equipmentDescriptionService'
    );
    clothingManagementService = testBed.getService('clothingManagementService');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Complete pipeline flow', () => {
    it('should generate equipment description for entity with equipped items', async () => {
      // Arrange - Create test entity with equipped clothing
      const entityId = await testBed.createTestEntity({
        name: 'Test Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
        },
      });

      // Create clothing items
      const shirtId = await testBed.createClothingItem({
        name: 'Cotton Shirt',
        components: {
          'core:description': { text: 'shirt' },
          'core:material': { material: 'cotton' },
          'descriptors:color_basic': { color: 'blue' },
          'clothing:wearable': {
            slotId: 'torso_clothing',
            layer: 'base',
          },
        },
      });

      const bootsId = await testBed.createClothingItem({
        name: 'Leather Boots',
        components: {
          'core:description': { text: 'boots' },
          'core:material': { material: 'leather' },
          'descriptors:color_basic': { color: 'brown' },
          'clothing:wearable': {
            slotId: 'feet_clothing',
            layer: 'base',
          },
        },
      });

      // Set up equipped items on the entity
      await testBed.equipClothingItem(entityId, shirtId);
      await testBed.equipClothingItem(entityId, bootsId);

      // Act - Generate equipment description
      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert
      expect(result).toBeDefined();
      expect(result).not.toBe('');
      expect(result).toContain('Wearing:');
      expect(result).toContain('cotton');
      expect(result).toContain('blue');
      expect(result).toContain('shirt');
      expect(result).toContain('leather');
      expect(result).toContain('brown');
      expect(result).toContain('boots');
    });

    it('should handle entity with no equipped items', async () => {
      // Arrange - Create test entity without equipped items
      const entityId = await testBed.createTestEntity({
        name: 'Naked Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
        },
      });

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert
      expect(result).toBe('');
    });

    it('should handle entity with single equipped item', async () => {
      // Arrange
      const entityId = await testBed.createTestEntity({
        name: 'Single Item Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
        },
      });

      const jacketId = await testBed.createClothingItem({
        name: 'Leather Jacket',
        components: {
          'core:description': { text: 'jacket' },
          'core:material': { material: 'leather' },
          'descriptors:color_basic': { color: 'black' },
          'clothing:wearable': {
            slotId: 'jacket_clothing',
            layer: 'outer',
          },
        },
      });

      await testBed.equipClothingItem(entityId, jacketId);

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert
      expect(result).toBe('Wearing: leather, black jacket.');
    });

    it('should handle multiple items in same slot with different layers', async () => {
      // Arrange
      const entityId = await testBed.createTestEntity({
        name: 'Layered Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
        },
      });

      const shirtId = await testBed.createClothingItem({
        name: 'Base Shirt',
        components: {
          'core:description': { text: 'shirt' },
          'core:material': { material: 'cotton' },
          'clothing:wearable': {
            slotId: 'torso_clothing',
            layer: 'base',
          },
        },
      });

      const jacketId = await testBed.createClothingItem({
        name: 'Outer Jacket',
        components: {
          'core:description': { text: 'jacket' },
          'core:material': { material: 'leather' },
          'clothing:wearable': {
            slotId: 'torso_clothing',
            layer: 'outer',
          },
        },
      });

      await testBed.equipClothingItem(entityId, shirtId);
      await testBed.equipClothingItem(entityId, jacketId);

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert
      expect(result).toBeDefined();
      expect(result).toContain('Wearing:');
      expect(result).toContain('jacket');
      expect(result).toContain('shirt');
      // Should list outer layer first
      expect(result.indexOf('jacket')).toBeLessThan(result.indexOf('shirt'));
    });

    it('should include embellishment descriptors when present', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Embellished Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
        },
      });

      const embellishedItemId = await testBed.createClothingItem({
        name: 'Crystal Flats',
        components: {
          'core:description': { text: 'flats' },
          'core:material': { material: 'satin' },
          'descriptors:color_basic': { color: 'blush' },
          'descriptors:embellishment': { embellishment: 'crystals' },
          'clothing:wearable': {
            slotId: 'feet_clothing',
            layer: 'base',
          },
        },
      });

      await testBed.equipClothingItem(entityId, embellishedItemId);

      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(result).toContain('embellished with crystals');
      expect(result).toContain('flats');
    });
  });

  describe('Error scenarios', () => {
    it('should handle missing clothing entities gracefully', async () => {
      // Arrange - Create entity with invalid clothing reference
      const entityId = await testBed.createTestEntity({
        name: 'Broken Equipment Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
          'clothing:equipment': {
            equipped: {
              torso_clothing: {
                base: 'non-existent-item-id',
              },
            },
          },
        },
      });

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert
      expect(result).toBe('');
    });

    it('should handle malformed equipment data gracefully', async () => {
      // Arrange - Create entity with malformed equipment data
      const entityId = await testBed.createTestEntity({
        name: 'Malformed Equipment Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
          'clothing:equipment': {
            equipped: 'invalid-data-structure',
          },
        },
      });

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert
      expect(result).toBe('');
    });
  });

  describe('Service interaction verification', () => {
    it('should use ClothingManagementService correctly', async () => {
      // Arrange
      const entityId = await testBed.createTestEntity({
        name: 'Service Test Character',
        components: {
          'anatomy:body': {
            recipeId: 'test:basic_humanoid',
            root: 'test-root-id',
          },
        },
      });

      const hatId = await testBed.createClothingItem({
        name: 'Test Hat',
        components: {
          'core:description': { text: 'hat' },
          'core:material': { material: 'wool' },
          'clothing:wearable': {
            slotId: 'head_clothing',
            layer: 'base',
          },
        },
      });

      await testBed.equipClothingItem(entityId, hatId);

      // Act - First verify service returns correct data
      const serviceResponse =
        await clothingManagementService.getEquippedItems(entityId);

      // Assert service response
      expect(serviceResponse.success).toBe(true);
      expect(serviceResponse.equipped).toBeDefined();
      expect(serviceResponse.equipped.head_clothing).toBeDefined();
      expect(serviceResponse.equipped.head_clothing.base).toBe(hatId);

      // Act - Then verify equipment description service uses it correctly
      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      // Assert final description
      expect(description).toBe('Wearing: wool hat.');
    });
  });
});
