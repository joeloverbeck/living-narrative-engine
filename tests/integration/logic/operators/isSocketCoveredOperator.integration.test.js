/**
 * @file Integration tests for IsSocketCoveredOperator
 * Tests with real EntityManager and production collaborators
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IsSocketCoveredOperator } from '../../../../src/logic/operators/isSocketCoveredOperator.js';
import { ClothingIntegrationTestBed } from '../../../common/clothing/clothingIntegrationTestBed.js';

describe('IsSocketCoveredOperator integration with EntityManager', () => {
  let testBed;
  let entityManager;
  let operator;

  beforeEach(async () => {
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();
    entityManager = testBed.getEntityManager();

    operator = new IsSocketCoveredOperator({
      entityManager,
      logger: testBed.logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Parameter validation', () => {
    it('should return false when params array is missing', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('should return false when socketId is null', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', null], context);

      expect(result).toBe(false);
    });

    it('should return false when socketId is not a string', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 123], context);

      expect(result).toBe(false);
    });
  });

  describe('Entity without clothing:equipment component', () => {
    it('should return false when entity has no clothing:equipment component', async () => {
      // Create entity with only slot_metadata but no equipment
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest', 'upper_back'],
                allowedLayers: ['underwear', 'base', 'outer'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });
  });

  describe('Entity with empty equipped structure', () => {
    it('should return false when equipment exists but equipped is not an object', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: null, // Invalid structure
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when equipment has no equipped property', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {}, // Missing equipped property
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });
  });

  describe('Socket not covered by any slot', () => {
    it('should return false when socket is not in any slot coveredSockets', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest', 'upper_back'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      // Check a socket that isn't covered by any defined slot
      const result = operator.evaluate(['actor', 'uncovered_socket'], context);

      expect(result).toBe(false);
    });
  });

  describe('Socket-to-slot mapping with slot metadata', () => {
    it('should return true when socket is covered by equipped item', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest', 'upper_back'],
                allowedLayers: ['base', 'outer'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'upper_back'], context)).toBe(true);
    });

    it('should use cached mapping on subsequent calls', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // First call - populates cache
      const result1 = operator.evaluate(['actor', 'chest'], context);
      // Second call - uses cache
      const result2 = operator.evaluate(['actor', 'chest'], context);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should handle multiple sockets mapping to same slot', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              legs: { base: 'pants-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              legs: {
                coveredSockets: ['thighs', 'calves', 'knees'],
                allowedLayers: ['underwear', 'base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      expect(operator.evaluate(['actor', 'thighs'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'calves'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'knees'], context)).toBe(true);
    });
  });

  describe('Slot metadata edge cases', () => {
    it('should return false when entity has no slot_metadata component', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          // No slot_metadata component
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when slot_metadata has no slotMappings', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {}, // No slotMappings
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when slotMappings is not an object', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: 'invalid', // Invalid structure
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });
  });

  describe('hasItemsInSlotExcludingAccessories edge cases', () => {
    it('should return false when slot does not exist in equipment', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_lower: {
                coveredSockets: ['abdomen'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      // abdomen is mapped to torso_lower, but torso_lower has no equipped items
      const result = operator.evaluate(['actor', 'abdomen'], context);

      expect(result).toBe(false);
    });

    it('should return false when slot exists but has invalid structure (array)', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: ['invalid', 'array', 'structure'], // Invalid - should be object with layers
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return true when non-accessories layer has items (array)', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: ['shirt-1', 'undershirt-1'],
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(true);
    });

    it('should return true when non-accessories layer has single item (string)', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: 'shirt-1', // Single string item
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(true);
    });

    it('should return true when non-accessories layer has object item', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: { itemId: 'shirt-1', equipped: true }, // Object structure
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(true);
    });

    it('should return false when only accessories layer has items', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                accessories: 'belt-1', // Only accessories, no actual coverage
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_lower: {
                coveredSockets: ['waist'],
                allowedLayers: ['accessories', 'base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'waist'], context);

      expect(result).toBe(false);
    });

    it('should return true when accessories and base layers both have items', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                accessories: 'belt-1',
                base: 'pants-1', // Has base layer item
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_lower: {
                coveredSockets: ['waist', 'hips'],
                allowedLayers: ['accessories', 'base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      expect(operator.evaluate(['actor', 'waist'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'hips'], context)).toBe(true);
    });
  });

  describe('Cache management', () => {
    it('should clear cache for specific entity', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { base: 'shirt-1' },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // First call populates cache
      operator.evaluate(['actor', 'chest'], context);

      // Clear cache for this entity
      operator.clearCache(entityId);

      // This should work with fresh lookup
      const result = operator.evaluate(['actor', 'chest'], context);
      expect(result).toBe(true);
    });

    it('should clear entire cache when no entity specified', async () => {
      const entity1 = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: { torso_upper: { base: 'shirt-1' } } },
          'clothing:slot_metadata': {
            slotMappings: { torso_upper: { coveredSockets: ['chest'] } },
          },
        },
      });

      const entity2 = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: { legs: { base: 'pants-1' } } },
          'clothing:slot_metadata': {
            slotMappings: { legs: { coveredSockets: ['thighs'] } },
          },
        },
      });

      // Populate cache for both entities
      operator.evaluate(['actor', 'chest'], { actor: { id: entity1 } });
      operator.evaluate(['actor', 'thighs'], { actor: { id: entity2 } });

      // Clear entire cache
      operator.clearCache();

      // Both should still work with fresh lookups
      expect(operator.evaluate(['actor', 'chest'], { actor: { id: entity1 } })).toBe(true);
      expect(operator.evaluate(['actor', 'thighs'], { actor: { id: entity2 } })).toBe(true);
    });
  });

  describe('Coverage mapping extension', () => {
    it('should return true when item with coverage_mapping covers the slot', async () => {
      // Create a cape item with coverage_mapping
      const capeId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': {
            slotId: 'shoulders',
            layer: 'outer',
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper', 'upper_back_slot'],
          },
        },
      });

      // Create entity with cape equipped on shoulders
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              shoulders: { outer: capeId },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              shoulders: {
                coveredSockets: ['shoulder_blades'],
                allowedLayers: ['outer'],
              },
              torso_upper: {
                coveredSockets: ['chest', 'upper_back'],
                allowedLayers: ['base', 'outer'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Should be covered because cape has coverage_mapping that covers torso_upper
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'upper_back'], context)).toBe(true);
    });

    it('should return false when coverage_mapping does not cover the target slot', async () => {
      // Create a cape that only covers specific slots
      const capeId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': {
            slotId: 'shoulders',
            layer: 'outer',
          },
          'clothing:coverage_mapping': {
            covers: ['upper_back_slot'], // Does NOT cover torso_lower
          },
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              shoulders: { outer: capeId },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              shoulders: {
                coveredSockets: ['shoulder_area'],
                allowedLayers: ['outer'],
              },
              torso_lower: {
                coveredSockets: ['abdomen', 'lower_back'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // abdomen is not covered because cape doesn't cover torso_lower
      expect(operator.evaluate(['actor', 'abdomen'], context)).toBe(false);
    });

    it('should handle multiple items with coverage_mappings', async () => {
      // Create cape covering torso
      const capeId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'shoulders', layer: 'outer' },
          'clothing:coverage_mapping': { covers: ['torso_upper'] },
        },
      });

      // Create long skirt covering legs
      const skirtId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'waist', layer: 'base' },
          'clothing:coverage_mapping': { covers: ['legs'] },
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              shoulders: { outer: capeId },
              waist: { base: skirtId },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              shoulders: { coveredSockets: ['shoulder_area'] },
              waist: { coveredSockets: ['waist_area'] },
              torso_upper: { coveredSockets: ['chest'] },
              legs: { coveredSockets: ['thighs', 'calves'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Chest covered by cape's coverage_mapping
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(true);
      // Thighs covered by skirt's coverage_mapping
      expect(operator.evaluate(['actor', 'thighs'], context)).toBe(true);
    });

    it('should ignore accessories layer items for coverage_mapping', async () => {
      // Create accessory with coverage_mapping (shouldn't provide coverage)
      const beltId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'waist', layer: 'accessories' },
          'clothing:coverage_mapping': { covers: ['torso_lower'] },
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              waist: { accessories: beltId },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              waist: { coveredSockets: ['waist_area'] },
              torso_lower: { coveredSockets: ['abdomen'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Abdomen not covered - belt is in accessories layer
      expect(operator.evaluate(['actor', 'abdomen'], context)).toBe(false);
    });

    it('should handle item ID as string in coverage_mapping check', async () => {
      const robeId = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'full_body', layer: 'outer' },
          'clothing:coverage_mapping': { covers: ['torso_upper', 'torso_lower', 'legs'] },
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              full_body: { outer: robeId }, // Single string item
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              full_body: { coveredSockets: ['body'] },
              torso_upper: { coveredSockets: ['chest'] },
              torso_lower: { coveredSockets: ['abdomen'] },
              legs: { coveredSockets: ['thighs'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      expect(operator.evaluate(['actor', 'chest'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'abdomen'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'thighs'], context)).toBe(true);
    });

    it('should handle item IDs as array in coverage_mapping check', async () => {
      const robe1 = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'full_body', layer: 'outer' },
          'clothing:coverage_mapping': { covers: ['torso_upper'] },
        },
      });

      const robe2 = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'full_body', layer: 'outer' },
          'clothing:coverage_mapping': { covers: ['legs'] },
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              full_body: { outer: [robe1, robe2] }, // Array of items
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              full_body: { coveredSockets: ['body'] },
              torso_upper: { coveredSockets: ['chest'] },
              legs: { coveredSockets: ['thighs'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Both slots covered by different robes
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(true);
      expect(operator.evaluate(['actor', 'thighs'], context)).toBe(true);
    });

    it('should skip invalid item IDs during coverage_mapping check', async () => {
      const validRobe = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'full_body', layer: 'outer' },
          'clothing:coverage_mapping': { covers: ['torso_upper'] },
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              full_body: {
                outer: [null, '', 123, validRobe], // Mix of invalid and valid
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              full_body: { coveredSockets: ['body'] },
              torso_upper: { coveredSockets: ['chest'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Should still find the valid robe
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(true);
    });

    it('should return false when coverage_mapping.covers is not an array', async () => {
      const badItem = await testBed.createClothingItem({
        components: {
          'clothing:wearable': { slotId: 'shoulders', layer: 'outer' },
          'clothing:coverage_mapping': { covers: 'torso_upper' }, // Invalid - string not array
        },
      });

      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              shoulders: { outer: badItem },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              shoulders: { coveredSockets: ['shoulder_area'] },
              torso_upper: { coveredSockets: ['chest'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Should not find coverage because covers is not an array
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(false);
    });

    it('should handle equipment with invalid slot structure in coverage_mapping', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              shoulders: null, // Invalid slot
              torso: 'invalid', // Invalid slot type
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              shoulders: { coveredSockets: ['shoulder_area'] },
              torso: { coveredSockets: ['chest'] },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };

      // Should handle gracefully and return false
      expect(operator.evaluate(['actor', 'chest'], context)).toBe(false);
    });
  });

  describe('Tracing integration', () => {
    it('should capture trace data when trace context is provided', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: { torso_upper: { base: 'shirt-1' } },
          },
          'clothing:slot_metadata': {
            slotMappings: { torso_upper: { coveredSockets: ['chest'] } },
          },
        },
      });

      const capturedData = [];
      const context = {
        actor: { id: entityId },
        trace: {
          captureOperatorEvaluation: (data) => capturedData.push(data),
        },
      };

      operator.evaluate(['actor', 'chest'], context);

      expect(capturedData.length).toBe(1);
      expect(capturedData[0]).toMatchObject({
        operator: 'isSocketCovered',
        entityId,
        socketId: 'chest',
        result: true,
      });
    });

    it('should capture trace data for failed evaluation', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': { equipped: {} },
          'clothing:slot_metadata': {
            slotMappings: { torso_upper: { coveredSockets: ['chest'] } },
          },
        },
      });

      const capturedData = [];
      const context = {
        actor: { id: entityId },
        trace: {
          captureOperatorEvaluation: (data) => capturedData.push(data),
        },
      };

      operator.evaluate(['actor', 'chest'], context);

      expect(capturedData.length).toBe(1);
      expect(capturedData[0]).toMatchObject({
        operator: 'isSocketCovered',
        entityId,
        socketId: 'chest',
        result: false,
      });
    });
  });

  describe('Error handling', () => {
    it('should return false and capture error trace when exception occurs', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: { torso_upper: { base: 'shirt-1' } },
          },
          'clothing:slot_metadata': {
            slotMappings: { torso_upper: { coveredSockets: ['chest'] } },
          },
        },
      });

      // Create a custom operator with throwing entityManager
      const throwingEntityManager = {
        ...entityManager,
        getComponentData: (id, component) => {
          if (component === 'clothing:equipment') {
            return { equipped: { torso_upper: { base: 'shirt-1' } } };
          }
          if (component === 'clothing:slot_metadata') {
            throw new Error('Database connection failed');
          }
          return null;
        },
      };

      const errorOperator = new IsSocketCoveredOperator({
        entityManager: throwingEntityManager,
        logger: testBed.logger,
      });

      const capturedData = [];
      const context = {
        actor: { id: entityId },
        trace: {
          captureOperatorEvaluation: (data) => capturedData.push(data),
        },
      };

      const result = errorOperator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
      expect(capturedData.length).toBe(1);
      expect(capturedData[0]).toMatchObject({
        operator: 'isSocketCovered',
        result: false,
        error: 'Database connection failed',
      });
    });
  });

  describe('Additional hasItemsInSlotExcludingAccessories edge cases', () => {
    it('should return false when layer item is empty string', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: '', // Empty string
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when layer item is empty array', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: [], // Empty array
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when layer item is empty object', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: {}, // Empty object
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when layer item is falsy (null)', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: null,
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });

    it('should return false when layer item is number (falsy zero)', async () => {
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                base: 0, // Falsy number
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });
  });

  describe('Coverage mapping with invalid equipment structure', () => {
    it('should return false when equipped is null in hasCoverageMappingCoveringSlot', async () => {
      // Create entity where equipment returns null for equipped check
      const entityId = await testBed.createTestEntity({
        components: {
          'clothing:equipment': {
            equipped: null, // Will trigger the guard in hasCoverageMappingCoveringSlot
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest'],
                allowedLayers: ['base'],
              },
            },
          },
        },
      });

      const context = { actor: { id: entityId } };
      const result = operator.evaluate(['actor', 'chest'], context);

      expect(result).toBe(false);
    });
  });
});
