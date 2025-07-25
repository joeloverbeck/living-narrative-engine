import { describe, it, expect, beforeEach } from '@jest/globals';
import createClothingStepResolver from '../../../../src/scopeDsl/nodes/clothingStepResolver.js';

describe('ClothingStepResolver', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockEquipmentData;
  let mockContext;

  beforeEach(() => {
    // Setup mocks and test data
    mockEquipmentData = {
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
        feet: {
          outer: 'boots_1',
        },
        legs: {
          base: 'leggings_1',
          underwear: 'underwear_legs_1',
        },
      },
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(mockEquipmentData),
    };

    resolver = createClothingStepResolver({
      entitiesGateway: mockEntitiesGateway,
    });

    mockContext = {
      dispatcher: {
        resolve: jest.fn().mockReturnValue(new Set(['actor_1'])),
      },
      trace: {
        addLog: jest.fn(),
      },
    };
  });

  describe('canResolve', () => {
    it('should return true for topmost_clothing field', () => {
      const node = { type: 'Step', field: 'topmost_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for all_clothing field', () => {
      const node = { type: 'Step', field: 'all_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for outer_clothing field', () => {
      const node = { type: 'Step', field: 'outer_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for base_clothing field', () => {
      const node = { type: 'Step', field: 'base_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for underwear field', () => {
      const node = { type: 'Step', field: 'underwear' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return false for non-clothing fields', () => {
      const node = { type: 'Step', field: 'regular_component' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for non-Step nodes', () => {
      const node = { type: 'Source', field: 'topmost_clothing' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for Step nodes without field', () => {
      const node = { type: 'Step' };
      expect(resolver.canResolve(node)).toBe(false);
    });
  });

  describe('resolve - clothing access objects', () => {
    it('should return clothing access object for topmost_clothing', () => {
      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return a Set containing one clothing access object
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.__isClothingAccessObject).toBe(true);
      expect(clothingAccess.mode).toBe('topmost');
      expect(clothingAccess.equipped).toBe(mockEquipmentData.equipped);
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'clothing:equipment'
      );
    });

    it('should return clothing access object for all_clothing', () => {
      const node = {
        type: 'Step',
        field: 'all_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return a Set containing one clothing access object with mode 'all'
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.__isClothingAccessObject).toBe(true);
      expect(clothingAccess.mode).toBe('all');
      expect(clothingAccess.equipped).toBe(mockEquipmentData.equipped);
    });

    it('should return clothing access object with empty equipped when no equipment exists', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.equipped).toEqual({});
      expect(clothingAccess.mode).toBe('topmost');
    });

    it('should return clothing access object with empty equipped when equipment has no equipped property', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue({});

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.equipped).toEqual({});
      expect(clothingAccess.mode).toBe('topmost');
    });

    it('should skip non-string parent results', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 123, null, { id: 'actor_2' }])
      );

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should only process the string entity ID
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledTimes(1);
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'clothing:equipment'
      );
      expect(result.size).toBe(1); // One clothing access object
    });
  });

  describe('layer-specific clothing access objects', () => {
    it('should create clothing access object with outer mode', () => {
      const node = {
        type: 'Step',
        field: 'outer_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.mode).toBe('outer');
    });

    it('should create clothing access object with base mode', () => {
      const node = {
        type: 'Step',
        field: 'base_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.mode).toBe('base');
    });

    it('should create clothing access object with underwear mode', () => {
      const node = {
        type: 'Step',
        field: 'underwear',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.mode).toBe('underwear');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple entities correctly', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 'actor_2'])
      );

      const equipment1 = {
        equipped: {
          torso_upper: { outer: 'jacket_1' },
        },
      };

      const equipment2 = {
        equipped: {
          torso_upper: { outer: 'jacket_2' },
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor_1') return equipment1;
        if (entityId === 'actor_2') return equipment2;
        return null;
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return two clothing access objects, one for each entity
      expect(result.size).toBe(2);
      const accessObjects = Array.from(result);
      expect(accessObjects[0].equipped).toBe(equipment1.equipped);
      expect(accessObjects[1].equipped).toBe(equipment2.equipped);
    });
  });

  describe('trace logging', () => {
    it('should log resolution steps when trace is provided', () => {
      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('ClothingStepResolver: Processing'),
        'ClothingStepResolver',
        expect.any(Object)
      );

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('ClothingStepResolver: Resolution complete'),
        'ClothingStepResolver',
        expect.any(Object)
      );
    });

    it('should log when no equipment component found', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('No equipment component found'),
        'ClothingStepResolver',
        expect.objectContaining({ entityId: 'actor_1' })
      );
    });

    it('should work without trace context', () => {
      mockContext.trace = null;

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      // Should not throw
      expect(() => resolver.resolve(node, mockContext)).not.toThrow();
    });
  });
});
