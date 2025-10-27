/**
 * @file Unit tests for RecipePatternResolver
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('RecipePatternResolver', () => {
  let resolver;
  let mockDataRegistry;
  let mockSlotGenerator;
  let mockLogger;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Mock SlotGenerator
    mockSlotGenerator = {
      generateSlotsFromLimbSet: jest.fn(),
      generateSlotsFromAppendage: jest.fn(),
    };

    // Mock DataRegistry
    mockDataRegistry = {
      get: jest.fn(),
    };

    resolver = new RecipePatternResolver({
      dataRegistry: mockDataRegistry,
      slotGenerator: mockSlotGenerator,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(
        () =>
          new RecipePatternResolver({
            dataRegistry: null,
            slotGenerator: mockSlotGenerator,
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('resolveRecipePatterns - V1 Compatibility', () => {
    it('should handle V1 patterns with explicit matches array', () => {
      const recipe = {
        slots: { existing: { partType: 'torso' } },
        patterns: [
          {
            matches: ['leg_left', 'leg_right'],
            partType: 'leg_segment',
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        existing: { partType: 'torso' },
        leg_left: { partType: 'leg_segment' },
        leg_right: { partType: 'leg_segment' },
      });
    });

    it('should not override explicitly defined slots', () => {
      const recipe = {
        slots: { leg_left: { partType: 'special_leg' } },
        patterns: [
          {
            matches: ['leg_left', 'leg_right'],
            partType: 'leg_segment',
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // leg_left should retain special_leg, not be overridden by pattern
      expect(result.slots.leg_left.partType).toBe('special_leg');
      expect(result.slots.leg_right.partType).toBe('leg_segment');
    });

    it('should return unchanged recipe when no patterns present', () => {
      const recipe = {
        slots: { torso: { partType: 'torso_segment' } },
      };

      const blueprint = {
        slots: { torso: {} },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result).toEqual(recipe);
    });
  });

  describe('matchesGroup Resolution', () => {
    it('should resolve limbSet:leg to correct slot keys', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'frontLeft' },
            { type: 'leg', id: 'frontRight' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.generateSlotsFromLimbSet
        .mockReturnValueOnce(['leg_fl_upper', 'leg_fl_lower'])
        .mockReturnValueOnce(['leg_fr_upper', 'leg_fr_lower']);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        structureTemplate: 'spider:body',
        slots: {
          leg_fl_upper: {},
          leg_fl_lower: {},
          leg_fr_upper: {},
          leg_fr_lower: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_fl_upper: { partType: 'leg_segment' },
        leg_fl_lower: { partType: 'leg_segment' },
        leg_fr_upper: { partType: 'leg_segment' },
        leg_fr_lower: { partType: 'leg_segment' },
      });
      expect(mockSlotGenerator.generateSlotsFromLimbSet).toHaveBeenCalledTimes(
        2
      );
    });

    it('should resolve appendage:tail to correct slot keys', () => {
      const template = {
        topology: {
          appendages: [{ type: 'tail', id: 'main_tail' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.generateSlotsFromAppendage.mockReturnValue([
        'tail_base',
        'tail_mid',
        'tail_tip',
      ]);

      const recipe = {
        patterns: [
          { matchesGroup: 'appendage:tail', partType: 'tail_segment' },
        ],
      };

      const blueprint = {
        structureTemplate: 'dragon:body',
        slots: {
          tail_base: {},
          tail_mid: {},
          tail_tip: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        tail_base: { partType: 'tail_segment' },
        tail_mid: { partType: 'tail_segment' },
        tail_tip: { partType: 'tail_segment' },
      });
    });

    it('should handle multiple limb sets with same type', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'left' },
            { type: 'leg', id: 'right' },
            { type: 'leg', id: 'mid' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.generateSlotsFromLimbSet
        .mockReturnValueOnce(['leg_left'])
        .mockReturnValueOnce(['leg_right'])
        .mockReturnValueOnce(['leg_mid']);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        structureTemplate: 'spider:body',
        slots: {
          leg_left: {},
          leg_right: {},
          leg_mid: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(Object.keys(result.slots)).toHaveLength(3);
    });

    it('should return empty array with warning for non-existent group', () => {
      const template = {
        topology: {
          limbSets: [],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);

      const warnSpy = jest.spyOn(mockLogger, 'warn');

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:wing', partType: 'wing_segment' }],
      };

      const blueprint = {
        structureTemplate: 'spider:body',
        slots: {},
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({});
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should throw ValidationError for missing structure template', () => {
      mockDataRegistry.get.mockReturnValue(null);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        structureTemplate: 'nonexistent:template',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });

    it('should warn and return empty when blueprint has no structure template', () => {
      const warnSpy = jest.spyOn(mockLogger, 'warn');

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        slots: {},
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({});
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid group reference format', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'invalidformat', partType: 'leg_segment' }],
      };

      const blueprint = {
        structureTemplate: 'spider:body',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue({ topology: {} });

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid group type', () => {
      const recipe = {
        patterns: [
          { matchesGroup: 'invalidType:leg', partType: 'leg_segment' },
        ],
      };

      const blueprint = {
        structureTemplate: 'spider:body',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue({ topology: {} });

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });
  });

  describe('matchesPattern Resolution', () => {
    it('should resolve wildcard pattern leg_*', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'leg_*', partType: 'leg_segment' }],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
          arm_left: {},
          leg_middle: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_left: { partType: 'leg_segment' },
        leg_right: { partType: 'leg_segment' },
        leg_middle: { partType: 'leg_segment' },
      });
    });

    it('should resolve wildcard pattern *_left', () => {
      const recipe = {
        patterns: [{ matchesPattern: '*_left', partType: 'left_part' }],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          arm_left: {},
          leg_right: {},
          wing_left: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_left: { partType: 'left_part' },
        arm_left: { partType: 'left_part' },
        wing_left: { partType: 'left_part' },
      });
    });

    it('should resolve wildcard pattern *tentacle*', () => {
      const recipe = {
        patterns: [
          { matchesPattern: '*tentacle*', partType: 'tentacle_segment' },
        ],
      };

      const blueprint = {
        slots: {
          front_tentacle_left: {},
          rear_tentacle_right: {},
          leg_left: {},
          tentacle_tip: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        front_tentacle_left: { partType: 'tentacle_segment' },
        rear_tentacle_right: { partType: 'tentacle_segment' },
        tentacle_tip: { partType: 'tentacle_segment' },
      });
    });

    it('should handle exact match with no wildcard', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'torso', partType: 'torso_segment' }],
      };

      const blueprint = {
        slots: {
          torso: {},
          leg_left: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        torso: { partType: 'torso_segment' },
      });
    });

    it('should return empty when no matches', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'wing_*', partType: 'wing_segment' }],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({});
    });
  });

  describe('matchesAll Resolution', () => {
    it('should filter by slotType', () => {
      const recipe = {
        patterns: [
          { matchesAll: { slotType: 'leg_segment' }, partType: 'leg_part' },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: { requirements: { partType: 'leg_segment' } },
          leg_right: { requirements: { partType: 'leg_segment' } },
          arm_left: { requirements: { partType: 'arm_segment' } },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_left: { partType: 'leg_part' },
        leg_right: { partType: 'leg_part' },
      });
    });

    it('should filter by orientation with wildcards', () => {
      const recipe = {
        patterns: [
          { matchesAll: { orientation: 'left_*' }, partType: 'left_part' },
        ],
      };

      const blueprint = {
        slots: {
          leg_fl: { orientation: 'left_front' },
          leg_fr: { orientation: 'right_front' },
          arm_bl: { orientation: 'left_back' },
          arm_br: { orientation: 'right_back' },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_fl: { partType: 'left_part' },
        arm_bl: { partType: 'left_part' },
      });
    });

    it('should filter by socketId with wildcards', () => {
      const recipe = {
        patterns: [
          { matchesAll: { socketId: 'torso_*' }, partType: 'torso_part' },
        ],
      };

      const blueprint = {
        slots: {
          slot1: { socket: 'torso_upper' },
          slot2: { socket: 'torso_lower' },
          slot3: { socket: 'head_neck' },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        slot1: { partType: 'torso_part' },
        slot2: { partType: 'torso_part' },
      });
    });

    it('should handle combined filters', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: {
              slotType: 'leg_segment',
              orientation: 'left_*',
            },
            partType: 'left_leg',
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_fl: {
            requirements: { partType: 'leg_segment' },
            orientation: 'left_front',
          },
          leg_fr: {
            requirements: { partType: 'leg_segment' },
            orientation: 'right_front',
          },
          arm_bl: {
            requirements: { partType: 'arm_segment' },
            orientation: 'left_back',
          },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_fl: { partType: 'left_leg' },
      });
    });

    it('should exclude slots without required orientation', () => {
      const recipe = {
        patterns: [
          { matchesAll: { orientation: 'left' }, partType: 'left_part' },
        ],
      };

      const blueprint = {
        slots: {
          slot1: { orientation: 'left' },
          slot2: {}, // no orientation
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        slot1: { partType: 'left_part' },
      });
    });

    it('should exclude slots without required socket', () => {
      const recipe = {
        patterns: [
          { matchesAll: { socketId: 'torso' }, partType: 'torso_part' },
        ],
      };

      const blueprint = {
        slots: {
          slot1: { socket: 'torso' },
          slot2: {}, // no socket
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        slot1: { partType: 'torso_part' },
      });
    });
  });

  describe('Pattern Exclusions', () => {
    it('should exclude by slot groups', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'front' },
            { type: 'leg', id: 'back' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.generateSlotsFromLimbSet
        .mockReturnValueOnce(['leg_fl', 'leg_fr']) // all legs
        .mockReturnValueOnce(['leg_fl', 'leg_fr']) // all legs again for pattern
        .mockReturnValueOnce(['leg_bl', 'leg_br']) // all legs third time
        .mockReturnValueOnce(['leg_fl', 'leg_fr']); // front legs exclusion

      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg_segment',
            exclude: {
              slotGroups: ['limbSet:leg'], // This seems weird but tests the exclusion
            },
          },
        ],
      };

      const blueprint = {
        structureTemplate: 'spider:body',
        slots: {
          leg_fl: {},
          leg_fr: {},
          leg_bl: {},
          leg_br: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // Should be empty since we're excluding all legs
      expect(result.slots).toEqual({});
    });

    it('should exclude by properties', () => {
      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg_segment',
            exclude: {
              properties: { orientation: 'left_front' },
            },
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_fl: { orientation: 'left_front' },
          leg_fr: { orientation: 'right_front' },
          leg_bl: { orientation: 'left_back' },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_fr: { partType: 'leg_segment' },
        leg_bl: { partType: 'leg_segment' },
      });
    });

    it('should handle combined exclusions', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'arm', id: 'arms' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.generateSlotsFromLimbSet
        .mockReturnValueOnce(['arm_left', 'arm_right']) // pattern match
        .mockReturnValueOnce(['arm_left']); // exclusion

      const recipe = {
        patterns: [
          {
            matchesPattern: '*_*',
            partType: 'part',
            exclude: {
              slotGroups: ['limbSet:arm'],
              properties: { orientation: 'right' },
            },
          },
        ],
      };

      const blueprint = {
        structureTemplate: 'humanoid:body',
        slots: {
          arm_left: {},
          arm_right: { orientation: 'right' },
          leg_left: {},
          leg_right: { orientation: 'right' },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // arm_left excluded by slotGroups
      // arm_right excluded by both
      // leg_right excluded by properties
      // Only leg_left should remain
      expect(result.slots).toEqual({
        leg_left: { partType: 'part' },
      });
    });
  });

  describe('Pattern Integration', () => {
    it('should copy all pattern fields to slot definitions', () => {
      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg_segment',
            preferId: 'special:leg',
            tags: ['tag1', 'tag2'],
            notTags: ['tag3'],
            properties: { color: 'blue' },
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots.leg_left).toEqual({
        partType: 'leg_segment',
        preferId: 'special:leg',
        tags: ['tag1', 'tag2'],
        notTags: ['tag3'],
        properties: { color: 'blue' },
      });
    });

    it('should handle multiple patterns matching same slot', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg_segment' },
          { matchesPattern: '*_left', partType: 'left_part' },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // First pattern wins (leg_segment)
      expect(result.slots.leg_left.partType).toBe('leg_segment');
    });

    it('should handle mixed V1 and V2 patterns', () => {
      const recipe = {
        patterns: [
          { matches: ['slot1'], partType: 'type1' },
          { matchesPattern: 'slot*', partType: 'type2' },
        ],
      };

      const blueprint = {
        slots: {
          slot1: {},
          slot2: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots.slot1.partType).toBe('type1'); // V1 pattern wins
      expect(result.slots.slot2.partType).toBe('type2'); // V2 pattern
    });
  });
});
