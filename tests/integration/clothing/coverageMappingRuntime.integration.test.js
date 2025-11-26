/**
 * @file Runtime integration tests for clothing:coverage_mapping component
 * @see workflows/INTCLOTCOV-003-validate-component-integration.md
 * @see data/mods/clothing/components/coverage_mapping.component.json
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { ClothingIntegrationTestBed } from '../../common/clothing/clothingIntegrationTestBed.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('Coverage Mapping Runtime Integration', () => {
  let testBed;
  let entityManager;
  let logger;

  beforeEach(async () => {
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();

    entityManager = testBed.entityManager;
    logger = createMockLogger();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Entity File Loading', () => {
    it('should load clothing entities with coverage mapping from file system', async () => {
      // Entity migrated to base-clothing mod (CLOLAYMIG-013)
      const entityPath = path.resolve(
        './data/mods/base-clothing/entities/definitions/dark_indigo_denim_jeans.entity.json'
      );

      const content = await fs.readFile(entityPath, 'utf8');
      const entity = JSON.parse(content);

      expect(entity.id).toBe('base-clothing:dark_indigo_denim_jeans');
      expect(entity.components['clothing:coverage_mapping']).toBeDefined();
      expect(entity.components['clothing:coverage_mapping'].covers).toEqual([
        'torso_lower',
      ]);
      expect(
        entity.components['clothing:coverage_mapping'].coveragePriority
      ).toBe('base');
    });

    it('should validate all clothing items with coverage mapping', async () => {
      // Note: indigo_denim_trucker_jacket, dark_olive_cotton_twill_chore_jacket, white_structured_linen_blazer
      // migrated to outer-clothing mod - see CLOLAYMIG-007
      // Note: white_thigh_high_socks_pink_hearts migrated to underwear mod - see CLOLAYMIG-010
      // Note: All base-clothing items migrated to base-clothing mod - see CLOLAYMIG-013
      const itemIds = [
        'dark_indigo_denim_jeans',
        'graphite_wool_wide_leg_trousers',
        'pink_off_shoulder_crop_top',
        'charcoal_wool_tshirt',
        'white_cotton_crew_tshirt',
        'forest_green_cotton_linen_button_down',
        'high_compression_leggings',
        'black_stretch_silk_bodysuit',
        'sand_beige_cotton_chinos',
      ];

      for (const itemId of itemIds) {
        const entityPath = path.resolve(
          `./data/mods/base-clothing/entities/definitions/${itemId}.entity.json`
        );

        const content = await fs.readFile(entityPath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.components['clothing:coverage_mapping']).toBeDefined();
        expect(
          entity.components['clothing:coverage_mapping'].covers
        ).toBeDefined();
        expect(
          Array.isArray(entity.components['clothing:coverage_mapping'].covers)
        ).toBe(true);
        expect(
          entity.components['clothing:coverage_mapping'].covers.length
        ).toBeGreaterThan(0);
        expect(
          entity.components['clothing:coverage_mapping'].coveragePriority
        ).toBeDefined();
        expect(['outer', 'base', 'underwear', 'accessories']).toContain(
          entity.components['clothing:coverage_mapping'].coveragePriority
        );
      }
    });

    it('should validate coverage mapping data structure for all items', async () => {
      // Note: indigo_denim_trucker_jacket, dark_olive_cotton_twill_chore_jacket, white_structured_linen_blazer
      // migrated to outer-clothing mod - see CLOLAYMIG-007
      // Note: white_thigh_high_socks_pink_hearts migrated to underwear mod - see CLOLAYMIG-010
      // Note: All base-clothing items migrated to base-clothing mod - see CLOLAYMIG-013
      const itemIds = [
        'dark_indigo_denim_jeans',
        'graphite_wool_wide_leg_trousers',
        'pink_off_shoulder_crop_top',
        'charcoal_wool_tshirt',
        'white_cotton_crew_tshirt',
        'forest_green_cotton_linen_button_down',
        'high_compression_leggings',
        'black_stretch_silk_bodysuit',
        'sand_beige_cotton_chinos',
      ];

      const validSlots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      for (const itemId of itemIds) {
        const entityPath = path.resolve(
          `./data/mods/base-clothing/entities/definitions/${itemId}.entity.json`
        );

        const content = await fs.readFile(entityPath, 'utf8');
        const entity = JSON.parse(content);

        const coverageMapping = entity.components['clothing:coverage_mapping'];

        // Validate covers array
        coverageMapping.covers.forEach((slot) => {
          expect(validSlots).toContain(slot);
        });

        // Ensure no duplicate slots
        const uniqueSlots = new Set(coverageMapping.covers);
        expect(uniqueSlots.size).toBe(coverageMapping.covers.length);
      }
    });
  });

  describe('Runtime Component Access', () => {
    it('should access coverage mapping data through entity manager', async () => {
      // Create mock entity with coverage mapping
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'base',
          },
        },
      });

      const coverageData = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      expect(coverageData).toBeDefined();
      expect(coverageData.covers).toEqual(['torso_lower']);
      expect(coverageData.coveragePriority).toBe('base');
    });

    it('should handle missing coverage data gracefully', async () => {
      const entityId = await testBed.createTestEntity({
        components: {},
      });

      const coverageData = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      expect(coverageData).toBeNull();
    });

    it('should handle multiple coverage slots correctly', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:coverage_mapping': {
            covers: [
              'torso_upper',
              'torso_lower',
              'left_arm_clothing',
              'right_arm_clothing',
            ],
            coveragePriority: 'outer',
          },
        },
      });

      const coverageData = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      expect(coverageData).toBeDefined();
      expect(coverageData.covers).toHaveLength(4);
      expect(coverageData.covers).toContain('torso_upper');
      expect(coverageData.covers).toContain('torso_lower');
      expect(coverageData.covers).toContain('left_arm_clothing');
      expect(coverageData.covers).toContain('right_arm_clothing');
      expect(coverageData.coveragePriority).toBe('outer');
    });

    it('should update coverage mapping data correctly', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'base',
          },
        },
      });

      // Update coverage data
      entityManager.setComponentData(entityId, 'clothing:coverage_mapping', {
        covers: ['torso_upper', 'torso_lower'],
        coveragePriority: 'outer',
      });

      const updatedData = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      expect(updatedData.covers).toEqual(['torso_upper', 'torso_lower']);
      expect(updatedData.coveragePriority).toBe('outer');
    });
  });

  describe('Equipment Integration', () => {
    it('should equip items with coverage mapping', async () => {
      // Create character entity
      const characterId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      // Create clothing item with coverage mapping
      const itemId = await testBed.createClothingItem({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'base',
          },
          'clothing:wearable': {
            layer: 'base',
            equipmentSlots: {
              primary: 'legs',
            },
          },
        },
      });

      // Manually equip the item (simulating equipment orchestrator)
      const equipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      equipment.equipped['legs'] = itemId;
      entityManager.setComponentData(
        characterId,
        'clothing:equipment',
        equipment
      );

      // Verify equipment
      const updatedEquipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      expect(updatedEquipment.equipped.legs).toBe(itemId);

      // Verify coverage data is accessible
      const coverageData = entityManager.getComponentData(
        itemId,
        'clothing:coverage_mapping'
      );
      expect(coverageData).toBeDefined();
      expect(coverageData.covers).toEqual(['torso_lower']);
      expect(coverageData.coveragePriority).toBe('base');
    });

    it('should maintain existing clothing functionality for items without coverage', async () => {
      const characterId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      // Create item without coverage mapping
      const itemId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': {
            layer: 'underwear',
            equipmentSlots: {
              primary: 'torso_lower',
            },
          },
        },
      });

      // Equip item without coverage mapping
      const equipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      equipment.equipped['torso_lower'] = itemId;
      entityManager.setComponentData(
        characterId,
        'clothing:equipment',
        equipment
      );

      // Verify equipment still works
      const updatedEquipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      expect(updatedEquipment.equipped.torso_lower).toBe(itemId);

      // Verify no coverage data exists
      const coverageData = entityManager.getComponentData(
        itemId,
        'clothing:coverage_mapping'
      );
      expect(coverageData).toBeNull();
    });

    it('should handle multiple equipped items with coverage mapping', async () => {
      const characterId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      // Create jeans with coverage mapping
      const jeansId = await testBed.createClothingItem({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'base',
          },
          'clothing:wearable': {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          },
        },
      });

      // Create jacket with coverage mapping
      const jacketId = await testBed.createClothingItem({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper', 'left_arm_clothing', 'right_arm_clothing'],
            coveragePriority: 'outer',
          },
          'clothing:wearable': {
            layer: 'outer',
            equipmentSlots: { primary: 'torso_upper' },
          },
        },
      });

      // Equip both items
      const equipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      equipment.equipped['legs'] = jeansId;
      equipment.equipped['torso_upper'] = jacketId;
      entityManager.setComponentData(
        characterId,
        'clothing:equipment',
        equipment
      );

      // Verify both items are equipped
      const updatedEquipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      expect(updatedEquipment.equipped.legs).toBe(jeansId);
      expect(updatedEquipment.equipped.torso_upper).toBe(jacketId);

      // Verify both coverage mappings are accessible
      const jeansCoverage = entityManager.getComponentData(
        jeansId,
        'clothing:coverage_mapping'
      );
      expect(jeansCoverage.covers).toEqual(['torso_lower']);
      expect(jeansCoverage.coveragePriority).toBe('base');

      const jacketCoverage = entityManager.getComponentData(
        jacketId,
        'clothing:coverage_mapping'
      );
      expect(jacketCoverage.covers).toEqual([
        'torso_upper',
        'left_arm_clothing',
        'right_arm_clothing',
      ]);
      expect(jacketCoverage.coveragePriority).toBe('outer');
    });

    it('should handle equipment with mixed coverage and non-coverage items', async () => {
      const characterId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      // Create item with coverage mapping
      const coverageItemId = await testBed.createClothingItem({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'base',
          },
          'clothing:wearable': {
            layer: 'base',
            equipmentSlots: { primary: 'torso_upper' },
          },
        },
      });

      // Create item without coverage mapping
      const noCoverageItemId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': {
            layer: 'accessories',
            equipmentSlots: { primary: 'head_gear' },
          },
        },
      });

      // Equip both items
      const equipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      equipment.equipped['torso_upper'] = coverageItemId;
      equipment.equipped['head_gear'] = noCoverageItemId;
      entityManager.setComponentData(
        characterId,
        'clothing:equipment',
        equipment
      );

      // Verify both items are equipped
      const updatedEquipment = entityManager.getComponentData(
        characterId,
        'clothing:equipment'
      );
      expect(updatedEquipment.equipped.torso_upper).toBe(coverageItemId);
      expect(updatedEquipment.equipped.head_gear).toBe(noCoverageItemId);

      // Verify coverage data for item with coverage mapping
      const coverageData = entityManager.getComponentData(
        coverageItemId,
        'clothing:coverage_mapping'
      );
      expect(coverageData).toBeDefined();
      expect(coverageData.covers).toEqual(['torso_upper']);

      // Verify no coverage data for item without coverage mapping
      const noCoverageData = entityManager.getComponentData(
        noCoverageItemId,
        'clothing:coverage_mapping'
      );
      expect(noCoverageData).toBeNull();
    });
  });

  describe('Component Data Integrity', () => {
    it('should preserve coverage mapping data integrity during entity operations', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper', 'torso_lower'],
            coveragePriority: 'outer',
          },
        },
      });

      // Retrieve data twice to test integrity
      const firstRetrieval = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      const secondRetrieval = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      // Both should have same data
      expect(firstRetrieval).toEqual(secondRetrieval);
      expect(firstRetrieval.covers).toEqual(['torso_upper', 'torso_lower']);
      expect(firstRetrieval.coveragePriority).toBe('outer');

      // Test that modifying one doesn't affect the other
      if (firstRetrieval !== secondRetrieval) {
        // Only test if they are different references
        firstRetrieval.covers.push('legs');
        expect(secondRetrieval.covers).toEqual(['torso_upper', 'torso_lower']);
        expect(secondRetrieval.covers).not.toContain('legs');
      }
    });

    it('should handle invalid coverage priority gracefully', async () => {
      // Note: In a real scenario, this should be validated by the schema
      // But we're testing runtime behavior here
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'invalid_priority', // This would fail schema validation
          },
        },
      });

      const coverageData = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      // Data is stored as-is at runtime (schema validation happens elsewhere)
      expect(coverageData).toBeDefined();
      expect(coverageData.coveragePriority).toBe('invalid_priority');
    });

    it('should handle empty covers array correctly', async () => {
      // Note: Schema requires minItems: 1, but testing runtime behavior
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:coverage_mapping': {
            covers: [],
            coveragePriority: 'base',
          },
        },
      });

      const coverageData = entityManager.getComponentData(
        entityId,
        'clothing:coverage_mapping'
      );

      expect(coverageData).toBeDefined();
      expect(coverageData.covers).toEqual([]);
      expect(Array.isArray(coverageData.covers)).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of coverage-mapped items efficiently', async () => {
      const startTime = Date.now();
      const itemCount = 100;
      const createdIds = [];

      // Create many items with coverage mapping
      for (let i = 0; i < itemCount; i++) {
        const entityId = await testBed.createTestEntity({
          components: {
            'clothing:coverage_mapping': {
              covers: ['torso_upper', 'torso_lower'],
              coveragePriority: i % 2 === 0 ? 'base' : 'outer',
            },
          },
        });
        createdIds.push(entityId);
      }

      // Retrieve all coverage data
      for (const entityId of createdIds) {
        const coverageData = entityManager.getComponentData(
          entityId,
          'clothing:coverage_mapping'
        );
        expect(coverageData).toBeDefined();
      }

      const endTime = Date.now();
      const elapsedTime = endTime - startTime;

      // Should complete in reasonable time (< 200ms for 100 items considering async operations)
      expect(elapsedTime).toBeLessThan(200);
    });
  });
});
