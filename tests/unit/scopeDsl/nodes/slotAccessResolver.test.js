import { describe, it, expect, beforeEach } from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';

describe('SlotAccessResolver', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockContext;
  let mockClothingAccessObject;

  beforeEach(() => {
    // Setup mock clothing access object (from ClothingStepResolver)
    mockClothingAccessObject = {
      __clothingSlotAccess: true,
      equipped: {
        torso_upper: {
          outer: 'jacket_1',
          base: 'shirt_1',
          underwear: 'undershirt_1',
        },
        torso_lower: {
          outer: 'pants_1',
          base: 'shorts_1',
        },
        legs: {
          base: 'leggings_1',
          underwear: 'underwear_legs_1',
        },
        feet: {
          outer: 'boots_1',
        },
        hands: {},
        head_gear: null,
      },
      mode: 'topmost',
      type: 'clothing_slot_access',
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(null),
    };

    resolver = createSlotAccessResolver({
      entitiesGateway: mockEntitiesGateway,
    });

    mockContext = {
      dispatcher: {
        resolve: jest.fn().mockReturnValue(new Set([mockClothingAccessObject])),
      },
      trace: {
        addLog: jest.fn(),
      },
    };
  });

  describe('canResolve', () => {
    it('should return true for clothing slot fields', () => {
      const slots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      slots.forEach((slot) => {
        const node = { type: 'Step', field: slot };
        expect(resolver.canResolve(node)).toBe(true);
      });
    });

    it('should return false for non-clothing slot fields', () => {
      const node = { type: 'Step', field: 'regular_component' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for non-Step nodes', () => {
      const node = { type: 'Source', field: 'torso_upper' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for Step nodes without field', () => {
      const node = { type: 'Step' };
      expect(resolver.canResolve(node)).toBe(false);
    });
  });

  describe('resolve - slot access from clothing objects', () => {
    it('should resolve torso_upper slot with topmost mode', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return the topmost item (outer layer)
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should resolve torso_lower slot with topmost mode', () => {
      const node = {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return the topmost item (outer layer)
      expect(result).toEqual(new Set(['pants_1']));
    });

    it('should resolve legs slot with no outer layer', () => {
      const node = {
        type: 'Step',
        field: 'legs',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return the base layer (no outer layer)
      expect(result).toEqual(new Set(['leggings_1']));
    });

    it('should handle empty slot data gracefully', () => {
      const node = {
        type: 'Step',
        field: 'hands',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set for empty slot
      expect(result).toEqual(new Set());
    });

    it('should handle null slot data gracefully', () => {
      const node = {
        type: 'Step',
        field: 'head_gear',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set for null slot
      expect(result).toEqual(new Set());
    });

    it('should handle missing slot gracefully', () => {
      const node = {
        type: 'Step',
        field: 'left_arm_clothing',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set for missing slot
      expect(result).toEqual(new Set());
    });
  });

  describe('layer priority handling', () => {
    it('should respect topmost mode priority', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return outer layer for topmost mode
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should handle all mode correctly', () => {
      mockClothingAccessObject.mode = 'all';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // For 'all' mode, still returns topmost (first in priority)
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should handle outer mode correctly', () => {
      mockClothingAccessObject.mode = 'outer';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return outer layer only
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should handle base mode correctly', () => {
      mockClothingAccessObject.mode = 'base';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return base layer only
      expect(result).toEqual(new Set(['shirt_1']));
    });

    it('should handle underwear mode correctly', () => {
      mockClothingAccessObject.mode = 'underwear';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return underwear layer only
      expect(result).toEqual(new Set(['undershirt_1']));
    });

    it('should return empty when requested layer not present', () => {
      mockClothingAccessObject.mode = 'outer';

      const node = {
        type: 'Step',
        field: 'legs',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // legs slot has no outer layer
      expect(result).toEqual(new Set());
    });
  });

  describe('backward compatibility with regular entities', () => {
    it('should handle regular entity strings', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue('component_value');

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'entity_1',
        'torso_upper'
      );
      expect(result).toEqual(new Set(['component_value']));
    });

    it('should handle array component data', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue([
        'item_1',
        'item_2',
      ]);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set(['item_1', 'item_2']));
    });

    it('should handle null component data', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
    });

    it('should handle undefined component data', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue(undefined);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
    });

    it('should handle non-string non-null values', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue(42);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set([42]));
    });
  });

  describe('mixed parent results', () => {
    it('should handle mix of clothing access objects and regular entities', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([mockClothingAccessObject, 'entity_1'])
      );
      mockEntitiesGateway.getComponentData.mockReturnValue(
        'regular_component_value'
      );

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should have both clothing item and regular component value
      expect(result).toEqual(new Set(['jacket_1', 'regular_component_value']));
    });

    it('should skip invalid parent values', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([mockClothingAccessObject, null, undefined, 123, 'entity_1'])
      );
      mockEntitiesGateway.getComponentData.mockReturnValue('component_value');

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should process valid items only
      expect(result).toEqual(new Set(['jacket_1', 'component_value']));
    });
  });

  describe('trace logging', () => {
    it('should log resolution steps when trace is provided', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('SlotAccessResolver: Processing slot'),
        'SlotAccessResolver',
        expect.any(Object)
      );

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('SlotAccessResolver: Resolution complete'),
        'SlotAccessResolver',
        expect.any(Object)
      );
    });

    it('should log when item found in slot', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('Found item in slot'),
        'SlotAccessResolver',
        expect.objectContaining({
          slotName: 'torso_upper',
          layer: 'outer',
          itemId: 'jacket_1',
        })
      );
    });

    it('should log when no data found for slot', () => {
      const node = {
        type: 'Step',
        field: 'left_arm_clothing',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('No data found for slot'),
        'SlotAccessResolver',
        expect.objectContaining({
          slotName: 'left_arm_clothing',
        })
      );
    });

    it('should work without trace context', () => {
      mockContext.trace = null;

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      // Should not throw
      expect(() => resolver.resolve(node, mockContext)).not.toThrow();
    });
  });
});
