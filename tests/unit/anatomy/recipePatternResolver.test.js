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
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock SlotGenerator
    mockSlotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest.fn(),
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
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockImplementation(
        (limbSet) => {
          if (limbSet.id === 'frontLeft') {
            return ['leg_fl_upper', 'leg_fl_lower'];
          } else if (limbSet.id === 'frontRight') {
            return ['leg_fr_upper', 'leg_fr_lower'];
          }
          return [];
        }
      );

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
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
      // Validation phase + resolution phase = 2 calls per limbSet = 4 total
      expect(mockSlotGenerator.extractSlotKeysFromLimbSet).toHaveBeenCalledTimes(
        4
      );
    });

    it('should resolve appendage:tail to correct slot keys', () => {
      const template = {
        topology: {
          appendages: [{ type: 'tail', id: 'main_tail' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromAppendage.mockReturnValue([
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
        schemaVersion: '2.0',
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
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockImplementation(
        (limbSet) => {
          if (limbSet.id === 'left') {
            return ['leg_left'];
          } else if (limbSet.id === 'right') {
            return ['leg_right'];
          } else if (limbSet.id === 'mid') {
            return ['leg_mid'];
          }
          return [];
        }
      );

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
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

    it('should throw ValidationError for non-existent group', () => {
      const template = {
        topology: {
          limbSets: [],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:wing', partType: 'wing_segment' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'spider:body',
        slots: {},
      };

      const resolve = () => resolver.resolveRecipePatterns(recipe, blueprint);

      expect(resolve).toThrow(ValidationError);
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

      const resolve = () => resolver.resolveRecipePatterns(recipe, blueprint);

      expect(resolve).toThrow(ValidationError);
    });

    it('should throw ValidationError when blueprint has no structure template', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        slots: {},
      };

      const resolve = () => resolver.resolveRecipePatterns(recipe, blueprint);

      expect(resolve).toThrow(ValidationError);
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

    it('should throw when appendage data disappears after validation', () => {
      const validationTemplate = {
        topology: {
          appendages: [{ type: 'tail', id: 'main_tail' }],
        },
      };

      const emptyTemplate = { topology: {} };

      mockDataRegistry.get
        .mockImplementationOnce(() => validationTemplate)
        .mockImplementationOnce(() => validationTemplate)
        .mockImplementation(() => emptyTemplate);

      const recipe = {
        patterns: [{ matchesGroup: 'appendage:tail', partType: 'tail_segment' }],
      };

      const blueprint = {
        id: 'dragon:body_blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'dragon:body',
        slots: {},
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern 1: Slot group 'appendage:tail' not found in structure template 'dragon:body'."
      );
    });

    it('should throw when limb set data disappears after validation', () => {
      const validationTemplate = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      const emptyTemplate = { topology: {} };

      mockDataRegistry.get
        .mockImplementationOnce(() => validationTemplate)
        .mockImplementationOnce(() => validationTemplate)
        .mockImplementation(() => emptyTemplate);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        id: 'beast:body_blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'beast:body',
        slots: {},
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern 1: Slot group 'limbSet:leg' not found in structure template 'beast:body'."
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

    it('should throw when no slots match the wildcard pattern', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'wing_*', partType: 'wing_segment' }],
      };

      const blueprint = {
        id: 'anatomy:test_blueprint',
        slots: {
          leg_left: {},
          leg_right: {},
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow("Pattern 1: matchesPattern 'wing_*' matched 0 slots");
    });

    it('should throw when wildcard pattern matches no blueprint slots', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'wing_*', partType: 'wing_segment' }],
      };

      const blueprint = {};

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow("Pattern 1: matchesPattern 'wing_*' matched 0 slots");
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

    it('should throw for matchesAll when blueprint lacks slot definitions', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'wing_segment' },
            partType: 'wing_segment',
          },
        ],
      };

      const blueprint = { id: 'anatomy:wingless' };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow("matchesAll filter {\"slotType\":\"wing_segment\"} matched 0 slots");
    });
  });

  describe('Pattern Exclusions', () => {
    it('should throw when exclusions remove all slot group matches', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'front' },
            { type: 'leg', id: 'back' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockImplementation(
        (limbSet) => {
          if (limbSet.id === 'front') {
            return ['leg_fl', 'leg_fr'];
          } else if (limbSet.id === 'back') {
            return ['leg_bl', 'leg_br'];
          }
          return [];
        }
      );

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
        id: 'spider:body_blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'spider:body',
        slots: {
          leg_fl: {},
          leg_fr: {},
          leg_bl: {},
          leg_br: {},
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern matchesGroup: 'limbSet:leg' matched 0 slots after applying exclusions"
      );
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

    it('should throw when matchesAll exclusions remove all resolved slots', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'front' },
            { type: 'leg', id: 'rear' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockImplementation(
        (limbSet) => {
          if (limbSet.id === 'front') {
            return ['leg_front_left', 'leg_front_right'];
          }
          if (limbSet.id === 'rear') {
            return ['leg_rear_left', 'leg_rear_right'];
          }
          return [];
        }
      );

      const recipe = {
        patterns: [
          {
            matchesAll: {
              slotType: 'leg_segment',
              orientation: '*_left',
            },
            partType: 'left_leg',
            exclude: {
              slotGroups: ['limbSet:leg'],
            },
          },
        ],
      };

      const blueprint = {
        id: 'beast:body_blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'beast:body',
        slots: {
          leg_front_left: {
            orientation: 'front_left',
            requirements: { partType: 'leg_segment' },
          },
          leg_front_right: {
            orientation: 'front_right',
            requirements: { partType: 'leg_segment' },
          },
          leg_rear_left: {
            orientation: 'rear_left',
            requirements: { partType: 'leg_segment' },
          },
          leg_rear_right: {
            orientation: 'rear_right',
            requirements: { partType: 'leg_segment' },
          },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        'Pattern matchesAll: {"slotType":"leg_segment","orientation":"*_left"} matched 0 slots after applying exclusions'
      );
    });

    it('should handle combined exclusions', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'arm', id: 'arms' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet
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

    it('should retain slots when exclusions reference undefined blueprint entries', () => {
      const recipe = {
        patterns: [
          {
            matches: ['phantom_slot'],
            partType: 'phantom_part',
            exclude: { properties: { orientation: 'left' } },
          },
        ],
      };

      const blueprint = {
        slots: {},
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        phantom_slot: { partType: 'phantom_part' },
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

  describe('Validation guard rails', () => {
    it('should throw when pattern defines no matcher', () => {
      const recipe = {
        patterns: [{ partType: 'arm_segment' }],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "has no matcher"
      );
    });

    it('should throw when pattern defines multiple matchers', () => {
      const recipe = {
        patterns: [
          {
            matches: ['slot1'],
            matchesPattern: 'slot*',
            partType: 'conflicting',
          },
        ],
      };

      const blueprint = {
        slots: { slot1: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        'multiple matchers'
      );
    });

    it('should throw when structure template is missing from registry', () => {
      const recipe = {
        patterns: [
          { matchesGroup: 'limbSet:leg', partType: 'leg_segment' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'missing:template',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue(null);

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "Structure template 'missing:template' not found"
      );
    });

    it('should throw when matchesGroup format is invalid for V2 blueprints', () => {
      const recipe = {
        patterns: [
          { matchesGroup: 'invalidformat', partType: 'leg_segment' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'creature:body',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue({ topology: {} });

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "Slot group 'invalidformat' format invalid"
      );
    });

    it('should throw when matchesGroup type is invalid for V2 blueprints', () => {
      const recipe = {
        patterns: [
          { matchesGroup: 'unknownType:leg', partType: 'leg_segment' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'creature:body',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue({
        topology: { limbSets: [], appendages: [] },
      });

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "Slot group 'unknownType:leg' format invalid"
      );
    });

    it('should list available groups when requested group is missing', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'arm' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);

      const recipe = {
        patterns: [
          { matchesGroup: 'limbSet:wing', partType: 'wing_segment' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'avian:body',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "Available groups: 'limbSet:arm'"
      );
    });

    it('should throw when matchesPattern is not a non-empty string', () => {
      const recipe = {
        patterns: [{ matchesPattern: 123, partType: 'invalid' }],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        'Pattern 1: Pattern must be a non-empty string'
      );
    });

    it('should throw when matchesAll has no filter properties', () => {
      const recipe = {
        patterns: [{ matchesAll: {}, partType: 'invalid' }],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        'matchesAll must have at least one filter property'
      );
    });

    it('should throw when matchesAll uses wildcard slotType', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'arm*' },
            partType: 'invalid',
          },
        ],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "matchesAll wildcard pattern on 'slotType' is not supported"
      );
    });

    it('should throw when matchesAll filter yields no slots', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'tail' },
            partType: 'tail_segment',
          },
        ],
      };

      const blueprint = {
        slots: {
          arm_slot: {
            requirements: { partType: 'arm' },
            orientation: 'left',
            socket: 'arm_l',
          },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow("matchesAll filter {\"slotType\":\"tail\"} matched 0 slots");
    });

    it('should throw when exclusion slot group is missing in template', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);

      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg_segment',
            exclude: { slotGroups: ['limbSet:wing'] },
          },
        ],
      };

      const blueprint = {
        id: 'golem:body_blueprint',
        structureTemplate: 'golem:body',
        slots: {
          leg_front: {},
        },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        "Exclusion slot group 'limbSet:wing' not found"
      );
    });

    it('should throw when exclusion properties are not an object', () => {
      const recipe = {
        patterns: [
          {
            matches: ['slot1'],
            partType: 'component',
            exclude: { properties: null },
          },
        ],
      };

      const blueprint = {
        slots: { slot1: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        'Exclusion property filter must be a valid object'
      );
    });

    it('should throw when a slot group resolves to zero slots', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([]);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        id: 'statue:body_blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'statue:body',
        slots: {},
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern 1: Slot group 'limbSet:leg' matched 0 slots in structure template 'statue:body'."
      );
    });

    it('should describe matchesAll patterns in precedence warnings', () => {
      const blueprint = {
        slots: {
          arm_left: {
            requirements: { partType: 'arm' },
            orientation: 'left_forward',
          },
          arm_right: {
            requirements: { partType: 'arm' },
            orientation: 'right_forward',
          },
        },
      };

      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'arm', orientation: 'left*' },
            partType: 'alpha',
          },
          {
            matchesAll: { slotType: 'arm', orientation: 'left*' },
            partType: 'beta',
          },
        ],
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      expect(
        mockLogger.warn.mock.calls.some(call =>
          typeof call[0] === 'string' && call[0].includes('matchesAll:')
        )
      ).toBe(true);
    });

    it('should treat matcherless precedence patterns as specificity zero', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);

      const fragilePatternA = {
        partType: 'leg_fragment',
        matchesGroup: 'limbSet:leg',
      };

      const fragilePatternB = {
        partType: 'leg_backup',
        matchesGroup: 'limbSet:leg',
      };

      let slotCall = 0;
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockImplementation(() => {
        slotCall += 1;
        if (slotCall === 1) {
          fragilePatternA.matchesGroup = undefined;
        } else if (slotCall === 2) {
          fragilePatternB.matchesGroup = undefined;
        }
        return ['leg_front'];
      });

      const result = resolver.resolveRecipePatterns(
        {
          patterns: [fragilePatternA, fragilePatternB],
        },
        {
          schemaVersion: '2.0',
          structureTemplate: 'colossus:body',
          slots: { leg_front: {} },
        }
      );

      expect(
        mockLogger.warn.mock.calls.filter(call =>
          typeof call[0] === 'string' &&
          call[0].includes('no recognized matcher type')
        ).length
      ).toBeGreaterThan(0);

      expect(result.slots).toEqual({});
    });

  });

  describe('Advanced matcher coverage', () => {
    it('should throw when appendage exclusions remove all resolved slots', () => {
      const template = {
        topology: {
          appendages: [
            {
              type: 'tail',
              id: 'primaryTail',
            },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromAppendage.mockReturnValue([
        'tail_base',
        'tail_tip',
      ]);

      const recipe = {
        patterns: [
          {
            matchesGroup: 'appendage:tail',
            partType: 'tail_segment',
            exclude: {
              slotGroups: ['appendage:tail'],
            },
          },
        ],
      };

      const blueprint = {
        id: 'dragon:body_blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'dragon:body',
        slots: {
          tail_base: {},
          tail_tip: {},
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern matchesGroup: 'appendage:tail' matched 0 slots after applying exclusions"
      );
    });

    it('should warn when patterns of equal specificity overlap', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'frontLeft' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_fl',
      ]);

      const recipe = {
        patterns: [
          { matchesGroup: 'limbSet:leg', partType: 'primary_leg' },
          { matchesGroup: 'limbSet:leg', partType: 'secondary_leg' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'arachnid:body',
        slots: {
          leg_fl: {},
        },
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      expect(
        mockLogger.warn.mock.calls.some(
          call => typeof call[0] === 'string' && call[0].includes('equal specificity')
        )
      ).toBe(true);
    });

    it('should still resolve patterns when precedence loses matcher context', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let accessCount = 0;
      const pattern = { partType: 'leg_segment' };
      Object.defineProperty(pattern, 'matchesGroup', {
        get() {
          accessCount += 1;
          if (accessCount === 5) {
            return undefined;
          }
          return 'limbSet:leg';
        },
      });

      const recipe = {
        patterns: [
          pattern,
          { matches: ['explicit_slot'], partType: 'explicit' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'titan:body',
        slots: {
          leg_front: {},
          explicit_slot: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots.leg_front).toEqual({ partType: 'leg_segment' });
      expect(result.slots.explicit_slot).toEqual({ partType: 'explicit' });
    });

    it('should treat patterns without matcher during precedence as lowest specificity', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let groupAccess = 0;
      const groupPattern = { partType: 'leg_primary' };
      Object.defineProperty(groupPattern, 'matchesGroup', {
        get() {
          groupAccess += 1;
          if (groupAccess === 6) {
            return undefined;
          }
          return 'limbSet:leg';
        },
      });

      let wildcardAccess = 0;
      const wildcardPattern = { partType: 'leg_secondary' };
      Object.defineProperty(wildcardPattern, 'matchesPattern', {
        get() {
          wildcardAccess += 1;
          if (wildcardAccess === 4) {
            return undefined;
          }
          return 'leg_*';
        },
      });

      const result = resolver.resolveRecipePatterns(
        {
          patterns: [groupPattern, wildcardPattern],
        },
        {
          schemaVersion: '2.0',
          structureTemplate: 'leviathan:body',
          slots: {
            leg_front: {},
          },
        }
      );

      expect(result.slots.leg_front).toEqual({ partType: 'leg_primary' });
    });

    it('should continue precedence validation when slot resolution fails temporarily', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get
        .mockReturnValueOnce(template) // blueprint version validation
        .mockReturnValueOnce(template) // matchesGroup validation
        .mockReturnValueOnce(template) // zero-match warning resolution
        .mockReturnValueOnce(null) // precedence resolution fails
        .mockReturnValue(template); // resolution phase

      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      const recipe = {
        slots: {},
        patterns: [
          { matchesGroup: 'limbSet:leg', partType: 'leg_segment' },
          { matchesPattern: 'leg_*', partType: 'leg_backup' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'beast:body',
        slots: {
          leg_front: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(result.slots).toEqual({
        leg_front: { partType: 'leg_segment' },
      });
    });

    it('should warn and skip patterns that lose their matcher after validation', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let accessCount = 0;
      const flakyPattern = {
        partType: 'leg_segment',
      };

      Object.defineProperty(flakyPattern, 'matchesGroup', {
        get() {
          accessCount += 1;
          if (accessCount >= 7) {
            return undefined;
          }
          return 'limbSet:leg';
        },
      });

      const recipe = {
        patterns: [
          flakyPattern,
          { matches: ['explicit_slot'], partType: 'explicit' },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'creature:body',
        slots: {
          leg_front: {},
          explicit_slot: {},
        },
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      expect(
        mockLogger.warn.mock.calls.some(
          call =>
            typeof call[0] === 'string' &&
            call[0].includes('no recognized matcher type') &&
            call[1] === flakyPattern
        )
      ).toBe(true);
    });

    it('should throw when blueprint loses structure template before resolution', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let templateAccess = 0;
      const blueprint = {
        schemaVersion: '2.0',
        slots: {
          leg_front: {},
        },
        get structureTemplate() {
          templateAccess += 1;
          if (templateAccess >= 4) {
            return undefined;
          }
          return 'chimera:body';
        },
      };

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern 1: Cannot resolve slot group 'limbSet:leg': blueprint has no structure template"
      );
    });

    it('should throw when structure template disappears during resolution', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get
        .mockReturnValueOnce(template)
        .mockReturnValueOnce(template)
        .mockReturnValueOnce(template)
        .mockReturnValueOnce(null);

      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'wyvern:body',
        slots: {
          leg_front: {},
        },
      };

      expect.assertions(2);
      try {
        resolver.resolveRecipePatterns(
          { patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }] },
          blueprint
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Structure template not found: wyvern:body');
      }
    });

    it('should throw when slot group format becomes invalid during resolution', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let accessCount = 0;
      const pattern = { partType: 'leg' };
      Object.defineProperty(pattern, 'matchesGroup', {
        get() {
          accessCount += 1;
          if (accessCount >= 5) {
            return 'invalidformat';
          }
          return 'limbSet:leg';
        },
      });

      expect(() =>
        resolver.resolveRecipePatterns(
          {
            patterns: [pattern],
          },
          {
            schemaVersion: '2.0',
            structureTemplate: 'gryphon:body',
            slots: {
              leg_front: {},
            },
          }
        )
      ).toThrow("Invalid slot group reference format: 'invalidformat'");
    });

    it('should throw when slot group type becomes invalid during resolution', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let accessCount = 0;
      const pattern = { partType: 'leg' };
      Object.defineProperty(pattern, 'matchesGroup', {
        get() {
          accessCount += 1;
          if (accessCount >= 5) {
            return 'unknownType:leg';
          }
          return 'limbSet:leg';
        },
      });

      expect(() =>
        resolver.resolveRecipePatterns(
          {
            patterns: [pattern],
          },
          {
            schemaVersion: '2.0',
            structureTemplate: 'golem:body',
            slots: {
              leg_front: {},
            },
          }
        )
      ).toThrow("Invalid slot group type: 'unknownType'. Expected 'limbSet' or 'appendage'");
    });

    it('should surface default hints when matcher disappears before override logging', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_front',
      ]);

      let accessCount = 0;
      const pattern = { partType: 'leg_segment' };
      Object.defineProperty(pattern, 'matchesGroup', {
        get() {
          accessCount += 1;
          if (accessCount >= 7) {
            return undefined;
          }
          return 'limbSet:leg';
        },
      });

      const result = resolver.resolveRecipePatterns(
        {
          slots: {
            leg_front: { partType: 'existing' },
          },
          patterns: [pattern],
        },
        {
          schemaVersion: '2.0',
          structureTemplate: 'minotaur:body',
          slots: {
            leg_front: {},
          },
        }
      );

      expect(result.slots).toEqual({
        leg_front: { partType: 'existing' },
      });
      expect(result._patternHints).toEqual([
        'Pattern skipped: no matcher defined. Use matchesGroup selectors such as limbSet:leg or appendage:tail, matchesPattern wildcards, or matchesAll filters.',
      ]);
      expect(
        mockLogger.info.mock.calls.some(
          call =>
            typeof call[0] === 'string' &&
            call[0].includes('Pattern resolution added 0 slot definitions')
        )
      ).toBe(true);
    });
  });
});
