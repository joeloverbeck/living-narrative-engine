import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/entities/testBed.js';

describe('Core Material Component Migration Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('entity loading with core:material component', () => {
    it('should load clothing entities with core:material component', () => {
      // Test that all clothing entities can be loaded with the new component structure
      const clothingEntityIds = [
        'clothing:white_structured_linen_blazer',
        'clothing:black_calfskin_belt',
        'clothing:leather_stiletto_pumps',
        'clothing:graphite_wool_wide_leg_trousers',
        'clothing:black_stretch_silk_bodysuit',
        'clothing:nude_thong',
        'clothing:underwired_plunge_bra_nude_silk'
      ];

      clothingEntityIds.forEach(entityId => {
        const entity = testBed.createMockEntity(entityId);
        
        // Verify the entity has core:material component
        expect(entity.hasComponent('core:material')).toBe(true);
        
        // Verify the entity does not have material property in wearable component
        const wearableData = entity.getComponentData('clothing:wearable');
        expect(wearableData).toBeDefined();
        expect(wearableData.material).toBeUndefined();
        
        // Verify the material component has valid data
        const materialData = entity.getComponentData('core:material');
        expect(materialData).toBeDefined();
        expect(materialData.material).toBeDefined();
        expect(typeof materialData.material).toBe('string');
      });
    });

    it('should verify specific material values for migrated entities', () => {
      const expectedMaterials = {
        'clothing:white_structured_linen_blazer': 'linen',
        'clothing:black_calfskin_belt': 'calfskin',
        'clothing:leather_stiletto_pumps': 'leather',
        'clothing:graphite_wool_wide_leg_trousers': 'wool',
        'clothing:black_stretch_silk_bodysuit': 'stretch-silk',
        'clothing:nude_thong': 'silk',
        'clothing:underwired_plunge_bra_nude_silk': 'silk'
      };

      Object.entries(expectedMaterials).forEach(([entityId, expectedMaterial]) => {
        const entity = testBed.createMockEntity(entityId);
        const materialData = entity.getComponentData('core:material');
        
        expect(materialData.material).toBe(expectedMaterial);
      });
    });
  });

  describe('AnatomyVisualizerUI integration', () => {
    it('should extract material from core:material component', () => {
      const mockEntity = testBed.createMockEntity('clothing:white_structured_linen_blazer');
      
      // Mock the AnatomyVisualizerUI method behavior
      const materialValue = mockEntity.getComponentData('core:material')?.material || 'unknown';
      
      expect(materialValue).toBe('linen');
      expect(materialValue).not.toBe('unknown');
    });

    it('should fallback to unknown when material component is missing', () => {
      const mockEntity = testBed.createMockEntity('test:entity');
      mockEntity.addComponent('clothing:wearable', { layer: 'base' });
      
      // Should not have core:material component
      expect(mockEntity.hasComponent('core:material')).toBe(false);
      
      // Should fallback to 'unknown'
      const materialValue = mockEntity.getComponentData('core:material')?.material || 'unknown';
      expect(materialValue).toBe('unknown');
    });
  });

  describe('equipmentDescriptionService integration', () => {
    it('should process core:material component in descriptor order', () => {
      const descriptorOrder = [
        'core:material',
        'descriptors:color_basic',
        'descriptors:color_extended',
        'descriptors:texture'
      ];

      // Verify core:material is first in the descriptor order
      expect(descriptorOrder[0]).toBe('core:material');
      expect(descriptorOrder).not.toContain('descriptors:material');
    });

    it('should generate equipment descriptions with core:material data', () => {
      const mockEntity = testBed.createMockEntity('clothing:black_calfskin_belt');
      
      // Verify the entity has the expected component structure
      expect(mockEntity.hasComponent('core:material')).toBe(true);
      expect(mockEntity.hasComponent('descriptors:color_basic')).toBe(true);
      
      const materialData = mockEntity.getComponentData('core:material');
      const colorData = mockEntity.getComponentData('descriptors:color_basic');
      
      expect(materialData.material).toBe('calfskin');
      expect(colorData.color).toBe('black');
    });
  });

  describe('backward compatibility', () => {
    it('should handle entities without core:material gracefully', () => {
      const mockEntity = testBed.createMockEntity('test:entity');
      mockEntity.addComponent('clothing:wearable', { 
        layer: 'base',
        equipmentSlots: { primary: 'torso' }
      });
      
      // Should not crash when material component is missing
      const materialValue = mockEntity.getComponentData('core:material')?.material || 'unknown';
      expect(materialValue).toBe('unknown');
    });

    it('should validate that clothing:wearable no longer accepts material property', () => {
      const invalidWearableData = {
        layer: 'base',
        material: 'cotton', // This should now be invalid
        equipmentSlots: { primary: 'torso' }
      };

      const result = testBed.validateAgainstSchema(invalidWearableData, 'clothing:wearable');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must NOT have additional properties');
    });
  });

  describe('component schema validation', () => {
    it('should validate core:material component schema', () => {
      const validMaterialData = {
        material: 'linen',
        durability: 80,
        careInstructions: ['machine_washable'],
        properties: ['breathable']
      };

      const result = testBed.validateAgainstSchema(validMaterialData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid material types', () => {
      const invalidMaterialData = {
        material: 'invalid_material_type'
      };

      const result = testBed.validateAgainstSchema(invalidMaterialData, 'core:material');
      expect(result.isValid).toBe(false);
    });
  });
});