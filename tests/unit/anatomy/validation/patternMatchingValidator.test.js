/**
 * @file Unit tests for Pattern Matching Dry-Run Validator
 * @see src/anatomy/validation/patternMatchingValidator.js
 * @see workflows/ANASYSIMP-005-pattern-matching-dry-run.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validatePatternMatching,
  findMatchingSlots,
  getPatternDescription,
  extractMatcherInfo,
  identifyBlockingMatcher,
  suggestPatternFix,
} from '../../../../src/anatomy/validation/patternMatchingValidator.js';

describe('Pattern Matching Validator - Unit Tests', () => {
  let mockLogger;
  let mockDataRegistry;
  let mockSlotGenerator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockSlotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest.fn(),
    };
  });

  describe('validatePatternMatching', () => {
    it('should return empty array when recipe has no patterns', () => {
      const recipe = { recipeId: 'test:recipe', patterns: [] };
      const blueprint = { id: 'test:blueprint', slots: {} };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(warnings).toEqual([]);
    });

    it('should return empty array when all patterns have matches', () => {
      const recipe = {
        recipeId: 'test:recipe',
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
          },
        ],
      };
      const blueprint = {
        id: 'test:blueprint',
        slots: {
          leg_1: { socket: 'leg_1', requirements: { partType: 'leg' } },
          leg_2: { socket: 'leg_2', requirements: { partType: 'leg' } },
        },
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(warnings).toEqual([]);
    });

    it('should return warning when pattern has no matches', () => {
      const recipe = {
        recipeId: 'test:recipe',
        patterns: [
          {
            matchesPattern: 'wing_*',
            partType: 'wing',
          },
        ],
      };
      const blueprint = {
        id: 'test:blueprint',
        slots: {
          leg_1: { socket: 'leg_1', requirements: { partType: 'leg' } },
        },
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        type: 'NO_MATCHING_SLOTS',
        severity: 'warning',
        matcher: { type: 'matchesPattern', value: 'wing_*' },
      });
    });
  });

  describe('findMatchingSlots - V1 Patterns (explicit matches)', () => {
    it('should match existing slots with explicit matches array', () => {
      const pattern = {
        matches: ['leg_1', 'leg_2', 'leg_3'],
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_1: { socket: 'leg_1' },
          leg_2: { socket: 'leg_2' },
          leg_3: { socket: 'leg_3' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['leg_1', 'leg_2', 'leg_3']);
      expect(result.matcherType).toBe('v1_explicit');
    });

    it('should return zero matches when explicit slots do not exist', () => {
      const pattern = {
        matches: ['wing_left', 'wing_right'],
        partType: 'wing',
      };
      const blueprint = {
        slots: {
          leg_1: { socket: 'leg_1' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.matcherType).toBe('v1_explicit');
    });

    it('should handle empty matches array', () => {
      const pattern = {
        matches: [],
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_1: { socket: 'leg_1' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.matcherType).toBe('v1_explicit');
    });
  });

  describe('findMatchingSlots - matchesGroup', () => {
    it('should resolve limbSet group to slot keys', () => {
      const pattern = {
        matchesGroup: 'limbSet:leg',
        partType: 'leg',
      };
      const blueprint = {
        id: 'test:blueprint',
        structureTemplate: 'test:structure',
        slots: {
          leg_1: { socket: 'leg_1' },
          leg_2: { socket: 'leg_2' },
        },
      };

      // Mock structure template
      const template = {
        id: 'test:structure',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
              },
            },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue([
        'leg_1',
        'leg_2',
      ]);

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['leg_1', 'leg_2']);
      expect(result.matcherType).toBe('matchesGroup');
      expect(result.matcherValue).toBe('limbSet:leg');
    });

    it('should resolve appendage group to slot keys', () => {
      const pattern = {
        matchesGroup: 'appendage:tail',
        partType: 'tail',
      };
      const blueprint = {
        id: 'test:blueprint',
        structureTemplate: 'test:structure',
        slots: {
          tail: { socket: 'tail' },
        },
      };

      const template = {
        id: 'test:structure',
        topology: {
          appendages: [
            {
              type: 'tail',
              count: 1,
              socketPattern: { idTemplate: 'tail' },
            },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromAppendage.mockReturnValue(['tail']);

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['tail']);
      expect(result.matcherType).toBe('matchesGroup');
    });

    it('should return zero matches when slot group not found', () => {
      const pattern = {
        matchesGroup: 'limbSet:wing',
        partType: 'wing',
      };
      const blueprint = {
        id: 'test:blueprint',
        structureTemplate: 'test:structure',
        slots: {
          leg_1: { socket: 'leg_1' },
        },
      };

      const template = {
        id: 'test:structure',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 1,
            },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(template);
      mockSlotGenerator.extractSlotKeysFromLimbSet.mockReturnValue(['leg_1']);

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.matcherType).toBe('matchesGroup');
    });

    it('should handle blueprint without structureTemplate', () => {
      const pattern = {
        matchesGroup: 'limbSet:leg',
        partType: 'leg',
      };
      const blueprint = {
        id: 'test:blueprint',
        slots: {},
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.matcherType).toBe('matchesGroup');
    });
  });

  describe('findMatchingSlots - matchesPattern', () => {
    it('should match wildcard pattern with prefix', () => {
      const pattern = {
        matchesPattern: 'leg_*',
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_1: { socket: 'leg_1' },
          leg_2: { socket: 'leg_2' },
          leg_front_left: { socket: 'leg_front_left' },
          arm_left: { socket: 'arm_left' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([
        'leg_1',
        'leg_2',
        'leg_front_left',
      ]);
      expect(result.matcherType).toBe('matchesPattern');
    });

    it('should match wildcard pattern with suffix', () => {
      const pattern = {
        matchesPattern: '*_left',
        partType: 'limb',
      };
      const blueprint = {
        slots: {
          leg_left: { socket: 'leg_left' },
          arm_left: { socket: 'arm_left' },
          leg_right: { socket: 'leg_right' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['leg_left', 'arm_left']);
      expect(result.matcherType).toBe('matchesPattern');
    });

    it('should match complex wildcard patterns', () => {
      const pattern = {
        matchesPattern: 'leg_*_front',
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_left_front: { socket: 'leg_left_front' },
          leg_right_front: { socket: 'leg_right_front' },
          leg_left_rear: { socket: 'leg_left_rear' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([
        'leg_left_front',
        'leg_right_front',
      ]);
    });

    it('should return zero matches when pattern does not match', () => {
      const pattern = {
        matchesPattern: 'wing_*',
        partType: 'wing',
      };
      const blueprint = {
        slots: {
          leg_1: { socket: 'leg_1' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.matcherType).toBe('matchesPattern');
    });

    it('should handle blueprint with no slots', () => {
      const pattern = {
        matchesPattern: 'leg_*',
        partType: 'leg',
      };
      const blueprint = {
        slots: {},
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.availableSlots).toEqual([]);
    });
  });

  describe('findMatchingSlots - matchesAll', () => {
    it('should filter by slotType', () => {
      const pattern = {
        matchesAll: { slotType: 'leg' },
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_left: {
            socket: 'leg_left',
            requirements: { partType: 'leg' },
          },
          arm_left: {
            socket: 'arm_left',
            requirements: { partType: 'arm' },
          },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['leg_left']);
      expect(result.matcherType).toBe('matchesAll');
    });

    it('should filter by orientation', () => {
      const pattern = {
        matchesAll: { orientation: 'left*' },
        partType: 'limb',
      };
      const blueprint = {
        slots: {
          leg_left_front: {
            socket: 'leg_left_front',
            orientation: 'left_front',
          },
          leg_right_front: {
            socket: 'leg_right_front',
            orientation: 'right_front',
          },
          arm_left: { socket: 'arm_left', orientation: 'left' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['leg_left_front', 'arm_left']);
    });

    it('should filter by multiple properties', () => {
      const pattern = {
        matchesAll: { slotType: 'leg', orientation: '*_left' },
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_front_left: {
            socket: 'leg_front_left',
            requirements: { partType: 'leg' },
            orientation: 'front_left',
          },
          leg_front_right: {
            socket: 'leg_front_right',
            requirements: { partType: 'leg' },
            orientation: 'front_right',
          },
          arm_front_left: {
            socket: 'arm_front_left',
            requirements: { partType: 'arm' },
            orientation: 'front_left',
          },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual(['leg_front_left']);
    });

    it('should return zero matches when no slots match filter', () => {
      const pattern = {
        matchesAll: { slotType: 'wing' },
        partType: 'wing',
      };
      const blueprint = {
        slots: {
          leg_1: {
            socket: 'leg_1',
            requirements: { partType: 'leg' },
          },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
    });
  });

  describe('findMatchingSlots - No matcher', () => {
    it('should return no matches and matcherType "none" when pattern has no matcher', () => {
      const pattern = {
        partType: 'leg',
      };
      const blueprint = {
        slots: {
          leg_1: { socket: 'leg_1' },
        },
      };

      const result = findMatchingSlots(
        pattern,
        blueprint,
        mockDataRegistry,
        mockSlotGenerator,
        mockLogger
      );

      expect(result.matches).toEqual([]);
      expect(result.matcherType).toBe('none');
    });
  });

  describe('getPatternDescription', () => {
    it('should describe matchesGroup pattern', () => {
      const desc = getPatternDescription({ matchesGroup: 'limbSet:leg' });
      expect(desc).toBe("matchesGroup 'limbSet:leg'");
    });

    it('should describe matchesPattern pattern', () => {
      const desc = getPatternDescription({ matchesPattern: 'leg_*' });
      expect(desc).toBe("matchesPattern 'leg_*'");
    });

    it('should describe matchesAll pattern', () => {
      const desc = getPatternDescription({
        matchesAll: { slotType: 'leg' },
      });
      expect(desc).toBe('matchesAll {"slotType":"leg"}');
    });

    it('should describe explicit matches pattern', () => {
      const desc = getPatternDescription({
        matches: ['leg_1', 'leg_2'],
      });
      expect(desc).toBe('explicit matches [leg_1, leg_2]');
    });

    it('should describe pattern with no matcher', () => {
      const desc = getPatternDescription({ partType: 'leg' });
      expect(desc).toBe('no matcher defined');
    });
  });

  describe('extractMatcherInfo', () => {
    it('should extract matchesGroup info', () => {
      const info = extractMatcherInfo({ matchesGroup: 'limbSet:leg' });
      expect(info).toEqual({ type: 'matchesGroup', value: 'limbSet:leg' });
    });

    it('should extract matchesPattern info', () => {
      const info = extractMatcherInfo({ matchesPattern: 'leg_*' });
      expect(info).toEqual({ type: 'matchesPattern', value: 'leg_*' });
    });

    it('should extract matchesAll info', () => {
      const info = extractMatcherInfo({ matchesAll: { slotType: 'leg' } });
      expect(info).toEqual({
        type: 'matchesAll',
        value: { slotType: 'leg' },
      });
    });

    it('should extract explicit matches info', () => {
      const info = extractMatcherInfo({ matches: ['leg_1', 'leg_2'] });
      expect(info).toEqual({
        type: 'v1_explicit',
        value: ['leg_1', 'leg_2'],
      });
    });

    it('should return none for pattern without matcher', () => {
      const info = extractMatcherInfo({ partType: 'leg' });
      expect(info).toEqual({ type: 'none', value: null });
    });
  });

  describe('identifyBlockingMatcher', () => {
    it('should identify missing matcher', () => {
      const pattern = { partType: 'leg' };
      const result = { matcherType: 'none', matches: [] };
      const blueprint = { id: 'test:blueprint' };

      const reason = identifyBlockingMatcher(pattern, result, blueprint);

      expect(reason).toContain('No matcher defined');
    });

    it('should identify slot group not found', () => {
      const pattern = { matchesGroup: 'limbSet:wing' };
      const result = {
        matcherType: 'matchesGroup',
        matcherValue: 'limbSet:wing',
        matches: [],
      };
      const blueprint = {
        id: 'test:blueprint',
        structureTemplate: 'test:structure',
      };

      const reason = identifyBlockingMatcher(pattern, result, blueprint);

      expect(reason).toContain('limbSet:wing');
      expect(reason).toContain('test:structure');
    });

    it('should identify pattern not matching any slots', () => {
      const pattern = { matchesPattern: 'wing_*' };
      const result = {
        matcherType: 'matchesPattern',
        matcherValue: 'wing_*',
        matches: [],
        availableSlots: ['leg_1', 'leg_2'],
      };
      const blueprint = { id: 'test:blueprint' };

      const reason = identifyBlockingMatcher(pattern, result, blueprint);

      expect(reason).toContain('wing_*');
      expect(reason).toContain('does not match any');
    });

    it('should identify blueprint with no slots', () => {
      const pattern = { matchesPattern: 'leg_*' };
      const result = {
        matcherType: 'matchesPattern',
        matcherValue: 'leg_*',
        matches: [],
        availableSlots: [],
      };
      const blueprint = { id: 'test:blueprint' };

      const reason = identifyBlockingMatcher(pattern, result, blueprint);

      expect(reason).toContain('Blueprint has no slots');
    });
  });

  describe('suggestPatternFix', () => {
    it('should suggest adding matcher when none defined', () => {
      const pattern = { partType: 'leg' };
      const result = { matcherType: 'none', matches: [] };
      const blueprint = { id: 'test:blueprint' };

      const fix = suggestPatternFix(pattern, result, blueprint);

      expect(fix).toContain('Add a matcher property');
      expect(fix).toContain('matchesGroup');
      expect(fix).toContain('matchesPattern');
    });

    it('should suggest adding slot group to template', () => {
      const pattern = { matchesGroup: 'limbSet:wing' };
      const result = {
        matcherType: 'matchesGroup',
        matcherValue: 'limbSet:wing',
        matches: [],
      };
      const blueprint = {
        id: 'test:blueprint',
        structureTemplate: 'test:structure',
      };

      const fix = suggestPatternFix(pattern, result, blueprint);

      expect(fix).toContain('limbSet');
      expect(fix).toContain('wing');
      expect(fix).toContain('test:structure');
    });

    it('should suggest adjusting pattern to match available slots', () => {
      const pattern = { matchesPattern: 'wing_*' };
      const result = {
        matcherType: 'matchesPattern',
        matcherValue: 'wing_*',
        matches: [],
        availableSlots: ['leg_1', 'leg_2', 'arm_left'],
      };
      const blueprint = { id: 'test:blueprint' };

      const fix = suggestPatternFix(pattern, result, blueprint);

      expect(fix).toContain('Adjust pattern');
      expect(fix).toContain('leg_1');
      expect(fix).toContain('leg_2');
    });

    it('should handle blueprint with no slots', () => {
      const pattern = { matchesPattern: 'leg_*' };
      const result = {
        matcherType: 'matchesPattern',
        matcherValue: 'leg_*',
        matches: [],
        availableSlots: [],
      };
      const blueprint = { id: 'test:blueprint' };

      const fix = suggestPatternFix(pattern, result, blueprint);

      expect(fix).toContain('Blueprint has no slots');
      expect(fix).toContain('structureTemplate');
    });
  });
});
