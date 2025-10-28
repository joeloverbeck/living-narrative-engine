import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RecipeProcessor } from '../../../src/anatomy/recipeProcessor.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('RecipeProcessor', () => {
  let processor;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    mockDataRegistry = {
      get: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
    };

    processor = new RecipeProcessor({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should throw error if dataRegistry is not provided', () => {
      expect(() => new RecipeProcessor({ logger: mockLogger })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () => new RecipeProcessor({ dataRegistry: mockDataRegistry })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('loadRecipe', () => {
    it('should load recipe from registry', () => {
      const mockRecipe = {
        recipeId: 'test:recipe',
        slots: {
          head: { partType: 'head' },
        },
      };

      mockDataRegistry.get.mockReturnValue(mockRecipe);

      const result = processor.loadRecipe('test:recipe');

      expect(result).toBe(mockRecipe);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'test:recipe'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "RecipeProcessor: Loaded recipe 'test:recipe' with 1 slots"
      );
    });

    it('should throw error if recipe not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      expect(() => processor.loadRecipe('invalid:recipe')).toThrow(
        InvalidArgumentError
      );
      expect(() => processor.loadRecipe('invalid:recipe')).toThrow(
        "Recipe 'invalid:recipe' not found in registry"
      );
    });

    it('should handle recipe with undefined slots property', () => {
      const mockRecipe = {
        recipeId: 'test:recipe',
        // No slots property defined
      };

      mockDataRegistry.get.mockReturnValue(mockRecipe);

      const result = processor.loadRecipe('test:recipe');

      expect(result).toBe(mockRecipe);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'test:recipe'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "RecipeProcessor: Loaded recipe 'test:recipe' with 0 slots"
      );
    });
  });

  describe('processRecipe', () => {
    it('should return recipe as-is if no patterns', () => {
      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          head: { partType: 'head' },
        },
      };

      const result = processor.processRecipe(recipe);

      expect(result).toEqual(recipe);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "RecipeProcessor: Recipe 'test:recipe' has no patterns to expand"
      );
    });

    it('should expand patterns into slots', () => {
      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'test:arm',
            tags: ['tag1'],
            notTags: ['tag2'],
            properties: { prop: 'value' },
          },
        ],
      };

      const result = processor.processRecipe(recipe);

      expect(result.slots.left_arm).toEqual({
        partType: 'arm',
        preferId: 'test:arm',
        tags: ['tag1'],
        notTags: ['tag2'],
        properties: { prop: 'value' },
      });
      expect(result.slots.right_arm).toEqual({
        partType: 'arm',
        preferId: 'test:arm',
        tags: ['tag1'],
        notTags: ['tag2'],
        properties: { prop: 'value' },
      });
      expect(result.slots.head).toEqual({ partType: 'head' });
    });

    it('should not override existing slot definitions', () => {
      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          left_arm: { partType: 'special_arm' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
          },
        ],
      };

      const result = processor.processRecipe(recipe);

      expect(result.slots.left_arm).toEqual({ partType: 'special_arm' });
      expect(result.slots.right_arm).toEqual({ partType: 'arm' });
    });
  });

  describe('mergeSlotRequirements', () => {
    it('should return blueprint requirements if no recipe slot', () => {
      const blueprintReqs = {
        components: ['comp1'],
        properties: { prop1: 'value1' },
      };

      const result = processor.mergeSlotRequirements(blueprintReqs, null);

      expect(result).toEqual(blueprintReqs);
    });

    it('should handle undefined blueprint requirements', () => {
      const result = processor.mergeSlotRequirements(undefined, null);

      expect(result).toEqual({});
    });

    it('should handle null blueprint requirements with recipe slot', () => {
      const recipeSlot = {
        tags: ['tag1'],
        properties: { prop1: 'value1' },
      };

      const result = processor.mergeSlotRequirements(null, recipeSlot);

      expect(result).toEqual({
        components: ['tag1'],
        properties: { prop1: 'value1' },
      });
    });

    it('should handle empty blueprint requirements with recipe slot', () => {
      const recipeSlot = {
        tags: ['tag1'],
        properties: { prop1: 'value1' },
      };

      const result = processor.mergeSlotRequirements({}, recipeSlot);

      expect(result).toEqual({
        components: ['tag1'],
        properties: { prop1: 'value1' },
      });
    });

    it('should override partType when provided in recipe slot', () => {
      const blueprintReqs = {
        partType: 'original_part',
        components: ['existing'],
      };
      const recipeSlot = {
        partType: 'override_part',
      };

      const result = processor.mergeSlotRequirements(blueprintReqs, recipeSlot);

      expect(result).toEqual({
        partType: 'override_part',
        components: ['existing'],
      });
    });

    it('should merge recipe tags with blueprint components', () => {
      const blueprintReqs = {
        components: ['comp1'],
      };
      const recipeSlot = {
        tags: ['tag1', 'tag2'],
      };

      const result = processor.mergeSlotRequirements(blueprintReqs, recipeSlot);

      expect(result).toEqual({
        components: ['comp1', 'tag1', 'tag2'],
      });
    });

    it('should handle blueprint without components when adding recipe tags', () => {
      const blueprintReqs = {
        // No components property
        properties: { prop1: 'value1' },
      };
      const recipeSlot = {
        tags: ['tag1', 'tag2'],
      };

      const result = processor.mergeSlotRequirements(blueprintReqs, recipeSlot);

      expect(result).toEqual({
        properties: { prop1: 'value1' },
        components: ['tag1', 'tag2'],
      });
    });

    it('should merge recipe properties with blueprint properties', () => {
      const blueprintReqs = {
        properties: { prop1: 'value1' },
      };
      const recipeSlot = {
        properties: { prop2: 'value2' },
      };

      const result = processor.mergeSlotRequirements(blueprintReqs, recipeSlot);

      expect(result).toEqual({
        properties: {
          prop1: 'value1',
          prop2: 'value2',
        },
      });
    });

    it('should handle blueprint without properties when adding recipe properties', () => {
      const blueprintReqs = {
        components: ['comp1'],
        // No properties property
      };
      const recipeSlot = {
        properties: { prop1: 'value1' },
      };

      const result = processor.mergeSlotRequirements(blueprintReqs, recipeSlot);

      expect(result).toEqual({
        components: ['comp1'],
        properties: { prop1: 'value1' },
      });
    });
  });

  describe('matchesPropertyRequirements', () => {
    it('should return true if all properties match', () => {
      const entityDef = {
        components: {
          comp1: { prop1: 'value1', prop2: 'value2' },
          comp2: { prop3: 'value3' },
        },
      };
      const propertyReqs = {
        comp1: { prop1: 'value1' },
        comp2: { prop3: 'value3' },
      };

      const result = processor.matchesPropertyRequirements(
        entityDef,
        propertyReqs
      );

      expect(result).toBe(true);
    });

    it('should return false if component missing', () => {
      const entityDef = {
        components: {
          comp1: { prop1: 'value1' },
        },
      };
      const propertyReqs = {
        comp2: { prop1: 'value1' },
      };

      const result = processor.matchesPropertyRequirements(
        entityDef,
        propertyReqs
      );

      expect(result).toBe(false);
    });

    it('should return false if property value does not match', () => {
      const entityDef = {
        components: {
          comp1: { prop1: 'value1' },
        },
      };
      const propertyReqs = {
        comp1: { prop1: 'value2' },
      };

      const result = processor.matchesPropertyRequirements(
        entityDef,
        propertyReqs
      );

      expect(result).toBe(false);
    });
  });

  describe('pattern expansion', () => {
    it('should skip V2 patterns that lack matches', () => {
      const recipe = {
        recipeId: 'test:recipe',
        slots: {},
        patterns: [
          {
            partType: 'arm',
          },
        ],
      };

      const result = processor.processRecipe(recipe);

      expect(result.slots).toEqual({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RecipeProcessor: Skipping V2 pattern (will be resolved by RecipePatternResolver)'
      );
    });
  });
});
