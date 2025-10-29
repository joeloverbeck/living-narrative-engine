/**
 * @file Unit tests for RecipePatternResolver validation methods
 * Tests the ANABLUNONHUM-016 validation enhancements
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('RecipePatternResolver - Pattern Validation (ANABLUNONHUM-016)', () => {
  let resolver;
  let mockDataRegistry;
  let mockSlotGenerator;
  let mockLogger;

  beforeEach(() => {
    // Mock logger with spy capabilities
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

  describe('Mutual Exclusivity Validation', () => {
    it('should accept valid matchesGroup pattern', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_left',
      ]);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'spider_leg' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: { leg_left: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept valid matchesPattern pattern', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'leg_*', partType: 'quadruped_leg' }],
      };

      const blueprint = {
        slots: { leg_left: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept valid matchesAll pattern', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'leg', orientation: 'left_*' },
            partType: 'left_leg',
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {
            requirements: { partType: 'leg' },
            orientation: 'left_front',
          },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept valid matches (V1) pattern', () => {
      const recipe = {
        patterns: [{ matches: ['leg_1', 'leg_2'], partType: 'spider_leg' }],
      };

      const blueprint = {
        slots: { leg_1: {}, leg_2: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should throw error when pattern has multiple matchers', () => {
      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            matchesPattern: 'leg_*',
            partType: 'leg',
          },
        ],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /multiple matchers.*matchesGroup.*matchesPattern/
      );
    });

    it('should throw error when pattern has no matcher', () => {
      const recipe = {
        patterns: [{ partType: 'spider_leg' }],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /no matcher.*must specify exactly one/
      );
    });

    it('should throw error when pattern has all three V2 matchers', () => {
      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            matchesPattern: 'leg_*',
            matchesAll: { slotType: 'leg' },
            partType: 'leg',
          },
        ],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /multiple matchers/
      );
    });
  });

  describe('Blueprint Version Validation', () => {
    it('should accept V2 pattern with valid V2 blueprint', () => {
      const template = {
        topology: { limbSets: [{ type: 'leg', id: 'front' }] },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_left',
      ]);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        id: 'anatomy:spider_v2',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_spider',
        slots: { leg_left: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should throw error for matchesGroup on V1 blueprint', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        id: 'anatomy:spider_v1',
        schemaVersion: '1.0',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /uses 'matchesGroup'.*schemaVersion '1.0'.*requires.*'2.0'/
      );
    });

    it('should throw error for matchesGroup blueprint without structureTemplate', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        id: 'anatomy:dragon_v2',
        schemaVersion: '2.0',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /schemaVersion '2.0'.*no 'structureTemplate'.*requires a structure template/
      );
    });

    it('should throw error when structure template not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        id: 'anatomy:spider',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:nonexistent',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /Structure template.*not found.*loaded before blueprint/
      );
    });

    it('should allow V1 patterns without version checks', () => {
      const recipe = {
        patterns: [{ matches: ['leg_1', 'leg_2'], partType: 'leg' }],
      };

      const blueprint = {
        id: 'anatomy:spider_v1',
        schemaVersion: '1.0',
        slots: { leg_1: {}, leg_2: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should allow matchesPattern without V2 requirements', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'leg_*', partType: 'leg' }],
      };

      const blueprint = {
        slots: { leg_left: {}, leg_right: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should allow matchesAll without V2 requirements', () => {
      const recipe = {
        patterns: [{ matchesAll: { slotType: 'leg' }, partType: 'leg' }],
      };

      const blueprint = {
        slots: {
          leg_left: { requirements: { partType: 'leg' } },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });
  });

  describe('matchesGroup Validation', () => {
    it('should accept valid limbSet group', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_left',
      ]);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: { leg_left: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept valid appendage group', () => {
      const template = {
        topology: {
          appendages: [{ type: 'tail', id: 'main' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromAppendage.mockReturnValue([
        'tail_base',
      ]);

      const recipe = {
        patterns: [{ matchesGroup: 'appendage:tail', partType: 'tail' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:dragon',
        slots: { tail_base: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should throw error for invalid group format (missing type)', () => {
      mockDataRegistry.get.mockReturnValue({
        topology: { limbSets: [] },
      });

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet', partType: 'leg' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /format invalid.*Expected 'limbSet:\{type\}'/
      );
    });

    it('should throw error for invalid group type', () => {
      mockDataRegistry.get.mockReturnValue({
        topology: {},
      });

      const recipe = {
        patterns: [{ matchesGroup: 'invalidType:leg', partType: 'leg' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /format invalid.*Expected 'limbSet:\{type\}'/
      );
    });

    it('should throw error for non-existent group', () => {
      mockDataRegistry.get.mockReturnValue({
        topology: {
          limbSets: [{ type: 'arm', id: 'arms' }],
        },
      });

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:tentacle', partType: 'tentacle' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /not found in structure template.*Available groups/
      );
    });

    it('should warn for zero matches but not throw', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([]);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {},
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/matched 0 slots/)
      );
    });

    it('should throw when limb set topology data is missing', () => {
      mockDataRegistry.get.mockReturnValue({});

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });

    it('should throw when appendage topology data is missing', () => {
      mockDataRegistry.get.mockReturnValue({});

      const recipe = {
        patterns: [{ matchesGroup: 'appendage:tail', partType: 'tail' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:wyrm',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });
  });

  describe('matchesPattern Validation', () => {
    it('should accept valid wildcard patterns', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg' },
          { matchesPattern: '*_left', partType: 'left' },
          { matchesPattern: '*tentacle*', partType: 'tentacle' },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          arm_left: {},
          front_tentacle_1: {},
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should throw error for empty pattern', () => {
      const recipe = {
        patterns: [{ matchesPattern: '', partType: 'leg' }],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /Pattern must be a non-empty string/
      );
    });

    it('should warn for non-matching pattern but not throw', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'wing_*', partType: 'wing' }],
      };

      const blueprint = {
        slots: { leg_left: {}, leg_right: {} },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/matched 0 slots/)
      );
    });

    it('should handle case-sensitive matching', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'Leg_*', partType: 'leg' }],
      };

      const blueprint = {
        slots: { Leg_left: {}, leg_right: {} },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // Should only match Leg_left (case-sensitive)
      expect(result.slots.Leg_left).toBeDefined();
      expect(result.slots.leg_right).toBeUndefined();
    });
  });

  describe('matchesAll Validation', () => {
    it('should accept valid single filter', () => {
      const recipe = {
        patterns: [{ matchesAll: { slotType: 'leg' }, partType: 'leg' }],
      };

      const blueprint = {
        slots: {
          leg_left: { requirements: { partType: 'leg' } },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept valid multiple filters', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'leg', orientation: 'left_*' },
            partType: 'left_leg',
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {
            requirements: { partType: 'leg' },
            orientation: 'left_front',
          },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept wildcards in orientation', () => {
      const recipe = {
        patterns: [
          { matchesAll: { orientation: 'left_*' }, partType: 'left' },
        ],
      };

      const blueprint = {
        slots: {
          slot1: { orientation: 'left_front' },
          slot2: { orientation: 'left_back' },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept wildcards in socketId', () => {
      const recipe = {
        patterns: [{ matchesAll: { socketId: 'leg_*' }, partType: 'leg' }],
      };

      const blueprint = {
        slots: {
          slot1: { socket: 'leg_upper' },
          slot2: { socket: 'leg_lower' },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should throw error for empty filter object', () => {
      const recipe = {
        patterns: [{ matchesAll: {}, partType: 'leg' }],
      };

      const blueprint = { slots: {} };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /must have at least one filter property/
      );
    });

    it('should throw error for wildcard on slotType', () => {
      const recipe = {
        patterns: [{ matchesAll: { slotType: 'leg_*' }, partType: 'leg' }],
      };

      const blueprint = {
        slots: {
          leg_left: { requirements: { partType: 'leg_segment' } },
        },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /wildcard pattern on 'slotType' is not supported/
      );
    });

    it('should warn for non-matching filters but not throw', () => {
      const recipe = {
        patterns: [{ matchesAll: { slotType: 'wing' }, partType: 'wing' }],
      };

      const blueprint = {
        slots: {
          leg_left: { requirements: { partType: 'leg' } },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/matched 0 slots/)
      );
    });
  });

  describe('Exclusion Validation', () => {
    it('should accept valid exclusion by slot groups', () => {
      const template = {
        topology: {
          limbSets: [
            { type: 'leg', id: 'front' },
            { type: 'leg', id: 'back' },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      // Mock for all limbSet extractions - pattern and exclusion resolution
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockImplementation((limbSet) => {
        // Return slot keys based on limbSet id
        if (limbSet.id === 'front') {
          return ['leg_fl', 'leg_fr'];
        } else if (limbSet.id === 'back') {
          return ['leg_bl', 'leg_br'];
        }
        return [];
      });

      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg',
            exclude: { slotGroups: ['limbSet:leg'] },
          },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {
          leg_fl: {},
          leg_fr: {},
          leg_bl: {},
          leg_br: {},
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should accept valid exclusion by properties', () => {
      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: { properties: { orientation: 'mid' } },
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: { orientation: 'left' },
          leg_mid: { orientation: 'mid' },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should throw error for non-existent exclusion group', () => {
      mockDataRegistry.get.mockReturnValue({
        topology: {
          limbSets: [{ type: 'leg', id: 'legs' }],
        },
      });

      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: { slotGroups: ['limbSet:wing'] },
          },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: { leg_left: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /Exclusion slot group.*not found/
      );
    });

    it('should throw error for invalid exclusion properties', () => {
      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: { properties: null },
          },
        ],
      };

      const blueprint = {
        slots: { leg_left: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /Exclusion property filter must be a valid object/
      );
    });

    it('should validate exclusion slot groups when topology is missing', () => {
      mockDataRegistry.get.mockReturnValue({});

      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: { slotGroups: ['appendage:tail'] },
          },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:wyrm',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });

    it('should validate limb set exclusions when topology data is missing', () => {
      mockDataRegistry.get.mockReturnValue({});

      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: { slotGroups: ['limbSet:leg'] },
          },
        ],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
    });
  });

  describe('Pattern Precedence Validation', () => {
    it('should not warn for different specificity patterns', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg' },
          { matchesAll: { slotType: 'leg' }, partType: 'specific_leg' },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: { requirements: { partType: 'leg' } },
        },
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      // Should not warn because matchesAll > matchesPattern in specificity
      const warningCalls = mockLogger.warn.mock.calls.filter((call) =>
        call[0].includes('equal specificity')
      );
      expect(warningCalls.length).toBe(0);
    });

    it('should warn for equal specificity patterns with overlap', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg1' },
          { matchesPattern: '*_left', partType: 'leg2' },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
          arm_left: {},
        },
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      // Should warn because both patterns match leg_left
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/equal specificity.*may match the same slots/)
      );
    });

    it('should log info when explicit slot overrides pattern', () => {
      const infoSpy = jest.spyOn(mockLogger, 'info');

      const recipe = {
        slots: { leg_left: { partType: 'special_leg' } },
        patterns: [{ matchesPattern: 'leg_*', partType: 'normal_leg' }],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
        },
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      // Should log info about explicit override
      const infoCalls = infoSpy.mock.calls.filter((call) =>
        call[0].includes('overrides')
      );
      expect(infoCalls.length).toBeGreaterThan(0);
    });

    it('should not warn for non-overlapping equal specificity patterns', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg' },
          { matchesPattern: 'arm_*', partType: 'arm' },
        ],
      };

      const blueprint = {
        slots: {
          leg_left: {},
          arm_left: {},
        },
      };

      resolver.resolveRecipePatterns(recipe, blueprint);

      // Should not warn because patterns don't overlap
      const warningCalls = mockLogger.warn.mock.calls.filter((call) =>
        call[0].includes('equal specificity')
      );
      expect(warningCalls.length).toBe(0);
    });

    it('should handle precedence evaluation when blueprint slots are undefined', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg' },
          { matchesAll: { slotType: 'leg' }, partType: 'specific_leg' },
        ],
      };

      const blueprint = {};

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).not.toThrow();

      const zeroMatchWarnings = mockLogger.warn.mock.calls.filter((call) =>
        typeof call[0] === 'string' && call[0].includes('matched 0 slots')
      );
      expect(zeroMatchWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Integration - Multiple Validations', () => {
    it('should validate all aspects of a complex pattern', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_left',
        'leg_right',
      ]);

      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg',
            exclude: { properties: { orientation: 'mid' } },
          },
        ],
      };

      const blueprint = {
        id: 'anatomy:spider',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:spider_template',
        slots: {
          leg_left: { orientation: 'left' },
          leg_right: { orientation: 'right' },
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).not.toThrow();
    });

    it('should fail fast on first validation error', () => {
      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            matchesPattern: 'leg_*', // Multiple matchers - should fail first
            partType: 'leg',
          },
        ],
      };

      const blueprint = {
        schemaVersion: '1.0', // Would also fail version check
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /multiple matchers/
      );
    });

    it('should validate all patterns in a multi-pattern recipe', () => {
      const recipe = {
        patterns: [
          { matches: ['slot1'], partType: 'type1' }, // Valid V1
          { matchesPattern: '', partType: 'type2' }, // Invalid - empty pattern
        ],
      };

      const blueprint = {
        slots: { slot1: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /non-empty string/
      );
    });
  });
});
