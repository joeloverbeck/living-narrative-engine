/**
 * @file Unit tests for VariablePathValidator.
 * @see src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import VariablePathValidator, {
  SAMPLING_COVERAGE_DOMAIN_RANGES,
} from '../../../../../src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js';

describe('VariablePathValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new VariablePathValidator();
  });

  describe('constructor', () => {
    it('should create an instance without dependencies (stateless)', () => {
      expect(() => new VariablePathValidator()).not.toThrow();
    });
  });

  describe('SAMPLING_COVERAGE_DOMAIN_RANGES export', () => {
    it('should export the constant', () => {
      expect(SAMPLING_COVERAGE_DOMAIN_RANGES).toBeDefined();
      expect(Array.isArray(SAMPLING_COVERAGE_DOMAIN_RANGES)).toBe(true);
    });

    it('should contain expected domain configurations', () => {
      expect(SAMPLING_COVERAGE_DOMAIN_RANGES.length).toBeGreaterThan(0);

      // Check structure of first entry
      const first = SAMPLING_COVERAGE_DOMAIN_RANGES[0];
      expect(first).toHaveProperty('pattern');
      expect(first).toHaveProperty('domain');
      expect(first).toHaveProperty('min');
      expect(first).toHaveProperty('max');
      expect(first.pattern instanceof RegExp).toBe(true);
    });

    it('should include moodAxes domain', () => {
      const moodAxesDomain = SAMPLING_COVERAGE_DOMAIN_RANGES.find(
        (d) => d.domain === 'moodAxes'
      );
      expect(moodAxesDomain).toBeDefined();
    });

    it('should include emotions domain', () => {
      const emotionsDomain = SAMPLING_COVERAGE_DOMAIN_RANGES.find(
        (d) => d.domain === 'emotions'
      );
      expect(emotionsDomain).toBeDefined();
      expect(emotionsDomain.min).toBe(0);
      expect(emotionsDomain.max).toBe(1);
    });

    it('should include sexualStates domain', () => {
      const sexualStatesDomain = SAMPLING_COVERAGE_DOMAIN_RANGES.find(
        (d) => d.domain === 'sexualStates'
      );
      expect(sexualStatesDomain).toBeDefined();
      expect(sexualStatesDomain.min).toBe(0);
      expect(sexualStatesDomain.max).toBe(1);
    });
  });

  describe('validateVarPath', () => {
    const createKnownKeys = () => ({
      topLevel: new Set(['emotions', 'moodAxes', 'intensity', 'sexualStates']),
      scalarKeys: new Set(['intensity']),
      nestedKeys: {
        emotions: new Set(['joy', 'anger', 'sadness']),
        moodAxes: new Set(['valence', 'arousal']),
        sexualStates: new Set(['arousal', 'desire']),
      },
    });

    it('should return isValid: true for known root with valid nested key', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateVarPath('emotions.joy', knownKeys);
      expect(result.isValid).toBe(true);
    });

    it('should return isValid: true for known root without nesting', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateVarPath('intensity', knownKeys);
      expect(result.isValid).toBe(true);
    });

    it('should return isValid: false for unknown root', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateVarPath('unknown.field', knownKeys);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('unknown_root');
      expect(result.suggestion).toContain('Unknown root variable');
      expect(result.suggestion).toContain('unknown');
    });

    it('should return isValid: false for invalid nesting on scalar', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateVarPath('intensity.nested', knownKeys);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('invalid_nesting');
      expect(result.suggestion).toContain('scalar value');
    });

    it('should return isValid: false for unknown nested key', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateVarPath('emotions.unknown', knownKeys);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('unknown_nested_key');
      expect(result.suggestion).toContain('Unknown key');
      expect(result.suggestion).toContain('emotions');
    });

    it('should truncate known keys list with ellipsis when > 5 keys', () => {
      const knownKeys = {
        topLevel: new Set(['emotions']),
        scalarKeys: new Set(),
        nestedKeys: {
          emotions: new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
        },
      };
      const result = validator.validateVarPath('emotions.unknown', knownKeys);
      expect(result.suggestion).toContain('...');
    });

    it('should show "(none available)" when no nested keys exist', () => {
      const knownKeys = {
        topLevel: new Set(['emotions']),
        scalarKeys: new Set(),
        nestedKeys: {
          emotions: new Set(),
        },
      };
      const result = validator.validateVarPath('emotions.unknown', knownKeys);
      expect(result.suggestion).toContain('(none available)');
    });

    it('should allow nested key when validNestedKeys is undefined for root', () => {
      const knownKeys = {
        topLevel: new Set(['custom']),
        scalarKeys: new Set(),
        nestedKeys: {},
      };
      // If nestedKeys[root] is undefined, we don't restrict nested keys
      const result = validator.validateVarPath('custom.anything', knownKeys);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateExpressionVarPaths', () => {
    const createKnownKeys = () => ({
      topLevel: new Set(['emotions', 'moodAxes']),
      scalarKeys: new Set(),
      nestedKeys: {
        emotions: new Set(['joy', 'anger']),
        moodAxes: new Set(['valence', 'arousal']),
      },
    });

    it('should return empty warnings for null expression', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateExpressionVarPaths(null, knownKeys);
      expect(result).toEqual([]);
    });

    it('should return empty warnings for expression without prerequisites', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateExpressionVarPaths({}, knownKeys);
      expect(result).toEqual([]);
    });

    it('should return empty warnings for expression with null prerequisites', () => {
      const knownKeys = createKnownKeys();
      const result = validator.validateExpressionVarPaths(
        { prerequisites: null },
        knownKeys
      );
      expect(result).toEqual([]);
    });

    it('should return empty warnings when all paths are valid', () => {
      const knownKeys = createKnownKeys();
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
        ],
      };
      const result = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(result).toEqual([]);
    });

    it('should return warnings for invalid paths', () => {
      const knownKeys = createKnownKeys();
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'unknown.field' }, 0.5] } },
        ],
      };
      const result = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('unknown.field');
      expect(result[0].reason).toBe('unknown_root');
      expect(result[0].suggestion).toBeDefined();
    });

    it('should deduplicate warnings for repeated paths', () => {
      const knownKeys = createKnownKeys();
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'unknown.field' }, 0.5] } },
          { logic: { '<=': [{ var: 'unknown.field' }, 0.8] } },
        ],
      };
      const result = validator.validateExpressionVarPaths(expression, knownKeys);
      // Should only have 1 warning for 'unknown.field' despite 2 occurrences
      expect(result).toHaveLength(1);
    });

    it('should skip prerequisites without logic', () => {
      const knownKeys = createKnownKeys();
      const expression = {
        prerequisites: [
          { description: 'No logic here' },
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };
      const result = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(result).toEqual([]);
    });
  });

  describe('collectSamplingCoverageVariables', () => {
    it('should return empty array for null expression', () => {
      const result = validator.collectSamplingCoverageVariables(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for expression without prerequisites', () => {
      const result = validator.collectSamplingCoverageVariables({});
      expect(result).toEqual([]);
    });

    it('should collect mood axis variables with domain info', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
      expect(result[0].variablePath).toBe('moodAxes.valence');
      expect(result[0].domain).toBe('moodAxes');
      expect(typeof result[0].min).toBe('number');
      expect(typeof result[0].max).toBe('number');
    });

    it('should collect emotion variables with 0-1 range', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
      expect(result[0].variablePath).toBe('emotions.joy');
      expect(result[0].domain).toBe('emotions');
      expect(result[0].min).toBe(0);
      expect(result[0].max).toBe(1);
    });

    it('should collect sexual state variables with 0-1 range', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'sexualStates.arousal' }, 0.3] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
      expect(result[0].variablePath).toBe('sexualStates.arousal');
      expect(result[0].domain).toBe('sexualStates');
      expect(result[0].min).toBe(0);
      expect(result[0].max).toBe(1);
    });

    it('should handle previousEmotions prefix', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'previousEmotions.anger' }, 0.5] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('previousEmotions');
    });

    it('should handle mood. alias for moodAxes', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'mood.valence' }, 50] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('moodAxes');
    });

    it('should handle sexual. alias for sexualStates', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'sexual.arousal' }, 0.3] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('sexualStates');
    });

    it('should deduplicate variables from multiple prerequisites', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
          { logic: { '<=': [{ var: 'emotions.joy' }, 0.9] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(1);
    });

    it('should skip unrecognized variable paths', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'custom.field' }, 0.5] } },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toEqual([]);
    });

    it('should collect multiple variables from complex expression', () => {
      const expression = {
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.5] },
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
              ],
            },
          },
        ],
      };
      const result = validator.collectSamplingCoverageVariables(expression);
      expect(result).toHaveLength(2);
      const paths = result.map((r) => r.variablePath);
      expect(paths).toContain('emotions.joy');
      expect(paths).toContain('moodAxes.valence');
    });
  });

  describe('resolveSamplingCoverageVariable', () => {
    it('should return null for null input', () => {
      const result = validator.resolveSamplingCoverageVariable(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = validator.resolveSamplingCoverageVariable(undefined);
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      const result = validator.resolveSamplingCoverageVariable(123);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = validator.resolveSamplingCoverageVariable('');
      expect(result).toBeNull();
    });

    it('should return null for unrecognized path', () => {
      const result = validator.resolveSamplingCoverageVariable('custom.field');
      expect(result).toBeNull();
    });

    it('should resolve moodAxes path', () => {
      const result = validator.resolveSamplingCoverageVariable('moodAxes.valence');
      expect(result).not.toBeNull();
      expect(result.variablePath).toBe('moodAxes.valence');
      expect(result.domain).toBe('moodAxes');
      expect(typeof result.min).toBe('number');
      expect(typeof result.max).toBe('number');
    });

    it('should resolve emotions path', () => {
      const result = validator.resolveSamplingCoverageVariable('emotions.joy');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('emotions');
      expect(result.min).toBe(0);
      expect(result.max).toBe(1);
    });

    it('should resolve previousMoodAxes path', () => {
      const result = validator.resolveSamplingCoverageVariable('previousMoodAxes.arousal');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('previousMoodAxes');
    });

    it('should resolve previousEmotions path', () => {
      const result = validator.resolveSamplingCoverageVariable('previousEmotions.anger');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('previousEmotions');
    });

    it('should resolve previousSexualStates path', () => {
      const result = validator.resolveSamplingCoverageVariable('previousSexualStates.desire');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('previousSexualStates');
    });

    it('should resolve mood. alias to moodAxes domain', () => {
      const result = validator.resolveSamplingCoverageVariable('mood.valence');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('moodAxes');
    });

    it('should resolve sexual. alias to sexualStates domain', () => {
      const result = validator.resolveSamplingCoverageVariable('sexual.arousal');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('sexualStates');
    });
  });

  describe('extractReferencedEmotions', () => {
    it('should return empty Set for null expression', () => {
      const result = validator.extractReferencedEmotions(null);
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBe(0);
    });

    it('should return empty Set for expression without prerequisites', () => {
      const result = validator.extractReferencedEmotions({});
      expect(result.size).toBe(0);
    });

    it('should extract emotion name from simple var reference', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.size).toBe(1);
      expect(result.has('joy')).toBe(true);
    });

    it('should extract emotion name from previousEmotions reference', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'previousEmotions.anger' }, 0.5] } },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.has('anger')).toBe(true);
    });

    it('should handle case variation in Emotions', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'Emotions.fear' }, 0.5] } },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.has('fear')).toBe(true);
    });

    it('should extract multiple emotions from complex logic', () => {
      const expression = {
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.5] },
                { '>=': [{ var: 'emotions.anger' }, 0.3] },
              ],
            },
          },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.size).toBe(2);
      expect(result.has('joy')).toBe(true);
      expect(result.has('anger')).toBe(true);
    });

    it('should extract emotions from nested arrays', () => {
      const expression = {
        prerequisites: [
          {
            logic: {
              or: [
                { and: [{ '>=': [{ var: 'emotions.sadness' }, 0.5] }] },
                { '>=': [{ var: 'emotions.fear' }, 0.5] },
              ],
            },
          },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.has('sadness')).toBe(true);
      expect(result.has('fear')).toBe(true);
    });

    it('should deduplicate emotion names', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
          { logic: { '<=': [{ var: 'emotions.joy' }, 0.9] } },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.size).toBe(1);
    });

    it('should not extract non-emotion var references', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.size).toBe(0);
    });

    it('should handle null logic in prerequisite', () => {
      const expression = {
        prerequisites: [
          { logic: null },
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };
      const result = validator.extractReferencedEmotions(expression);
      expect(result.has('joy')).toBe(true);
    });

    it('should handle non-object logic values', () => {
      const expression = {
        prerequisites: [
          { logic: 'not an object' },
          { logic: 123 },
        ],
      };
      expect(() => validator.extractReferencedEmotions(expression)).not.toThrow();
      const result = validator.extractReferencedEmotions(expression);
      expect(result.size).toBe(0);
    });
  });

  describe('filterEmotions', () => {
    it('should return empty object for null allEmotions', () => {
      const result = validator.filterEmotions(null, new Set(['joy']));
      expect(result).toEqual({});
    });

    it('should return empty object for undefined allEmotions', () => {
      const result = validator.filterEmotions(undefined, new Set(['joy']));
      expect(result).toEqual({});
    });

    it('should return empty object for empty referencedNames', () => {
      const allEmotions = { joy: 0.8, anger: 0.3 };
      const result = validator.filterEmotions(allEmotions, new Set());
      expect(result).toEqual({});
    });

    it('should filter to only referenced emotions', () => {
      const allEmotions = { joy: 0.8, anger: 0.3, sadness: 0.5, fear: 0.2 };
      const referencedNames = new Set(['joy', 'fear']);
      const result = validator.filterEmotions(allEmotions, referencedNames);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result.joy).toBe(0.8);
      expect(result.fear).toBe(0.2);
      expect(result.anger).toBeUndefined();
      expect(result.sadness).toBeUndefined();
    });

    it('should skip referenced names not in allEmotions', () => {
      const allEmotions = { joy: 0.8 };
      const referencedNames = new Set(['joy', 'nonexistent']);
      const result = validator.filterEmotions(allEmotions, referencedNames);
      expect(Object.keys(result)).toHaveLength(1);
      expect(result.joy).toBe(0.8);
    });

    it('should preserve emotion values exactly', () => {
      const allEmotions = { joy: 0.123456789 };
      const referencedNames = new Set(['joy']);
      const result = validator.filterEmotions(allEmotions, referencedNames);
      expect(result.joy).toBe(0.123456789);
    });

    it('should handle empty allEmotions object', () => {
      const result = validator.filterEmotions({}, new Set(['joy']));
      expect(result).toEqual({});
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical expression analysis workflow', () => {
      const expression = {
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.5] },
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
                { '<=': [{ var: 'previousEmotions.anger' }, 0.3] },
              ],
            },
          },
        ],
      };

      // Extract referenced emotions
      const referencedEmotions = validator.extractReferencedEmotions(expression);
      expect(referencedEmotions.size).toBe(2); // joy, anger

      // Collect sampling coverage variables
      const coverageVars = validator.collectSamplingCoverageVariables(expression);
      expect(coverageVars.length).toBe(3);

      // Validate with known context
      const knownKeys = {
        topLevel: new Set(['emotions', 'moodAxes', 'previousEmotions']),
        scalarKeys: new Set(),
        nestedKeys: {
          emotions: new Set(['joy', 'anger', 'sadness']),
          moodAxes: new Set(['valence', 'arousal']),
          previousEmotions: new Set(['joy', 'anger', 'sadness']),
        },
      };
      const warnings = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(warnings).toEqual([]);
    });

    it('should detect validation issues in expression', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.unknownEmotion' }, 0.5] } },
        ],
      };

      const knownKeys = {
        topLevel: new Set(['emotions']),
        scalarKeys: new Set(),
        nestedKeys: {
          emotions: new Set(['joy', 'anger']),
        },
      };

      const warnings = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].path).toBe('emotions.unknownEmotion');
      expect(warnings[0].reason).toBe('unknown_nested_key');
    });
  });
});
