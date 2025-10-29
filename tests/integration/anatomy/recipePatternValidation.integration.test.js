/**
 * Integration tests for recipe pattern validation workflow.
 * Tests the complete validation flow with realistic recipe and blueprint scenarios.
 *
 * @see workflows/ANABLUNONHUM-016-recipe-pattern-validation.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('Recipe Pattern Validation Integration', () => {
  let testBed;
  let resolver;
  let mockLogger;
  let mockDataRegistry;
  let mockSlotGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockDataRegistry = testBed.createMock('DataRegistry', ['get']);
    mockSlotGenerator = testBed.createMock('SlotKeyGenerator', [
      'extractSlotKeysFromLimbSet',
      'extractSlotKeysFromAppendage',
    ]);

    resolver = new RecipePatternResolver({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      slotGenerator: mockSlotGenerator,
    });
  });

  describe('V1 Recipe Migration Scenarios', () => {
    it('should successfully process V1 recipe with matches array on V1 blueprint', () => {
      const recipe = {
        patterns: [
          {
            matches: ['leg_fl', 'leg_fr', 'leg_bl', 'leg_br'],
            partType: 'leg_segment',
          },
        ],
      };

      const blueprint = {
        // No schemaVersion = V1
        slots: {
          leg_fl: {},
          leg_fr: {},
          leg_bl: {},
          leg_br: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(Object.keys(result.slots)).toHaveLength(4);
      expect(result.slots.leg_fl).toEqual({ partType: 'leg_segment' });
    });

    it('should allow mixing V1 matches with V2 patterns', () => {
      const recipe = {
        patterns: [
          { matches: ['leg_fl'], partType: 'leg_segment' },
          { matchesPattern: 'arm_*', partType: 'arm_segment' },
        ],
      };

      const blueprint = {
        slots: { leg_fl: {}, arm_l: {}, arm_r: {} },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // V1 matches should work
      expect(result.slots.leg_fl).toEqual({ partType: 'leg_segment' });
      // V2 matchesPattern should work
      expect(result.slots.arm_l).toEqual({ partType: 'arm_segment' });
      expect(result.slots.arm_r).toEqual({ partType: 'arm_segment' });
    });
  });

  describe('V2 Pattern Type Enforcement', () => {
    it('should allow matchesPattern on V1 blueprint', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'leg_*', partType: 'leg_segment' }],
      };

      const blueprint = {
        // No schemaVersion = V1
        slots: { leg_fl: {}, leg_fr: {} },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(Object.keys(result.slots)).toHaveLength(2);
    });

    it('should allow matchesAll on V1 blueprint', () => {
      const recipe = {
        patterns: [
          {
            matchesAll: { slotType: 'segment' },
            partType: 'generic',
          },
        ],
      };

      const blueprint = {
        // No schemaVersion = V1
        slots: {
          slot1: { requirements: { partType: 'segment' } },
          slot2: { requirements: { partType: 'segment' } },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      expect(Object.keys(result.slots)).toHaveLength(2);
    });

    it('should reject matchesGroup on V1 blueprint', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        // No schemaVersion = V1
        structureTemplate: 'spider:body',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue({
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      });

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /matchesGroup.*requires schemaVersion '2\.0'/i
      );
    });

    it('should require structure template for matchesGroup', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:leg', partType: 'leg_segment' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        // Missing structureTemplate
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /no 'structureTemplate'/i
      );
    });
  });

  describe('Complex Multi-Pattern Recipes', () => {
    it('should handle recipe with explicit slots + matchesPattern + exclusions', () => {
      const recipe = {
        slots: {
          torso: { partType: 'torso_core' },
        },
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg_segment',
            exclude: {
              properties: {
                socket: 'hip',
              },
            },
          },
        ],
      };

      const blueprint = {
        slots: {
          torso: {},
          leg_fl: { socket: 'hip' },
          leg_fr: {},
          leg_bl: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // Explicit slot + 2 legs (leg_fl excluded by properties)
      expect(Object.keys(result.slots)).toHaveLength(3);
      expect(result.slots.torso).toEqual({ partType: 'torso_core' });
      expect(result.slots.leg_fl).toBeUndefined(); // Excluded
      expect(result.slots.leg_fr).toEqual({ partType: 'leg_segment' });
    });

    it('should throw when slotGroups exclusion removes all matches', () => {
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
        limbSet => {
          if (limbSet.id === 'front') return ['leg_fl', 'leg_fr'];
          if (limbSet.id === 'back') return ['leg_bl', 'leg_br'];
          return [];
        }
      );

      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg_segment',
            exclude: {
              slotGroups: ['limbSet:leg'], // Match front
            },
          },
        ],
      };

      const blueprint = {
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

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('matched 0 slots after applying exclusions')
      );
    });
  });

  describe('Pattern Precedence Validation', () => {
    it('should warn when explicit slot overrides pattern', () => {
      const recipe = {
        slots: {
          leg_fl: { partType: 'special_leg' },
        },
        patterns: [{ matchesPattern: 'leg_*', partType: 'generic_leg' }],
      };

      const blueprint = {
        slots: {
          leg_fl: {},
          leg_fr: {},
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // Explicit slot should win
      expect(result.slots.leg_fl).toEqual({ partType: 'special_leg' });
      expect(result.slots.leg_fr).toEqual({ partType: 'generic_leg' });

      // Should have logged info about override
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Explicit slot 'leg_fl' overrides")
      );
    });

    it('should apply matchesAll with lowest precedence', () => {
      const recipe = {
        patterns: [
          { matchesPattern: 'leg_*', partType: 'leg_segment' },
          {
            matchesAll: { slotType: 'segment' },
            partType: 'generic',
          },
        ],
      };

      const blueprint = {
        slots: {
          leg_fl: { requirements: { partType: 'segment' } },
          arm_l: { requirements: { partType: 'segment' } },
        },
      };

      const result = resolver.resolveRecipePatterns(recipe, blueprint);

      // matchesPattern should win for leg_fl
      expect(result.slots.leg_fl).toEqual({ partType: 'leg_segment' });
      // matchesAll should apply to arm_l
      expect(result.slots.arm_l).toEqual({ partType: 'generic' });
    });
  });

  describe('Error Scenarios', () => {
    it('should reject empty matchesPattern', () => {
      const recipe = {
        patterns: [{ matchesPattern: '', partType: 'part' }],
      };

      const blueprint = {
        slots: { slot1: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /must be a non-empty string/i
      );
    });

    it('should reject invalid matchesGroup format', () => {
      const recipe = {
        patterns: [{ matchesGroup: 'invalidformat', partType: 'part' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'spider:body',
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue({ topology: {} });

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /format invalid.*Expected 'limbSet:\{type\}'/i
      );
    });

    it('should reject non-existent slot group', () => {
      const template = {
        topology: {
          limbSets: [{ type: 'leg', id: 'front' }],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);

      const recipe = {
        patterns: [{ matchesGroup: 'limbSet:wing', partType: 'wing' }],
      };

      const blueprint = {
        schemaVersion: '2.0',
        structureTemplate: 'spider:body',
        slots: {},
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /not found in structure template/i
      );
    });

    it('should reject null exclusion properties', () => {
      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: {
              properties: null,
            },
          },
        ],
      };

      const blueprint = {
        slots: { leg_fl: {} },
      };

      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        ValidationError
      );
      expect(() => resolver.resolveRecipePatterns(recipe, blueprint)).toThrow(
        /must be a valid object/i
      );
    });
  });

  describe('Warning Scenarios', () => {
    it('should throw while warning when pattern matches zero slots', () => {
      const recipe = {
        patterns: [{ matchesPattern: 'nonexistent_*', partType: 'part' }],
      };

      const blueprint = {
        slots: {
          leg_fl: {},
          leg_fr: {},
        },
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow("Pattern 1: matchesPattern 'nonexistent_*' matched 0 slots");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('matched 0 slots')
      );
    });

    it('should throw while warning when matchesGroup matches zero slots', () => {
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
        structureTemplate: 'spider:body',
        slots: {},
      };

      expect(() =>
        resolver.resolveRecipePatterns(recipe, blueprint)
      ).toThrow(
        "Pattern 1: Slot group 'limbSet:leg' matched 0 slots in structure template 'spider:body'."
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('matched 0 slots')
      );
    });
  });
});
