/**
 * @file Unit tests for moodRegimeUtils.js - extractMergedMoodConstraints
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { extractMergedMoodConstraints } from '../../../../src/expressionDiagnostics/utils/moodRegimeUtils.js';

describe('moodRegimeUtils', () => {
  describe('extractMergedMoodConstraints', () => {
    let mockDataRegistry;

    beforeEach(() => {
      mockDataRegistry = {
        getLookupData: (key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                flow: {
                  weights: { valence: 0.6 },
                  gates: ['valence >= 0.35'],
                },
                joy: {
                  weights: { valence: 0.8 },
                  gates: ['valence >= 0.40'],
                },
                anger: {
                  weights: { valence: -0.6 },
                  gates: ['threat >= 0.20'],
                },
              },
            };
          }
          if (key === 'core:sexual_prototypes') {
            return {
              entries: {
                aroused: {
                  weights: { sex_excitation: 0.9 },
                  gates: ['sex_excitation >= 0.40'],
                },
              },
            };
          }
          return null;
        },
      };
    });

    it('should return only direct constraints when no prototype references exist', () => {
      const prerequisites = [
        {
          logic: {
            and: [{ '>=': [{ var: 'moodAxes.valence' }, 50] }],
          },
        },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 50,
      });
    });

    it('should derive constraints from prototype gates when only emotion refs exist', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 35,
      });
    });

    it('should merge direct and prototype-derived constraints', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
            ],
          },
        },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        varPath: 'moodAxes.arousal',
        operator: '>=',
        threshold: 30,
      });
      expect(result).toContainEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 35,
      });
    });

    it('should give direct constraints precedence over prototype-derived for same axis and operator', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 60] },
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
            ],
          },
        },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      // Direct valence >= 60 should take precedence over prototype valence >= 35
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 60,
      });
    });

    it('should return only direct constraints when dataRegistry is null (backward compat)', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 50] },
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
            ],
          },
        },
      ];

      const result = extractMergedMoodConstraints(prerequisites, null);

      // Should only have direct constraint since dataRegistry is null
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 50,
      });
    });

    it('should return empty array for empty prerequisites', () => {
      const result = extractMergedMoodConstraints([], mockDataRegistry);
      expect(result).toEqual([]);
    });

    it('should return empty array for null prerequisites', () => {
      const result = extractMergedMoodConstraints(null, mockDataRegistry);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined prerequisites', () => {
      const result = extractMergedMoodConstraints(undefined, mockDataRegistry);
      expect(result).toEqual([]);
    });

    it('should handle multiple prototype references with different axes', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
              { '>=': [{ var: 'emotions.anger' }, 0.3] },
            ],
          },
        },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.varPath).sort()).toEqual([
        'moodAxes.threat',
        'moodAxes.valence',
      ]);
    });

    it('should handle sexual state prototype references', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      expect(result).toHaveLength(1);
      expect(result[0].varPath).toBe('sexualAxes.sex_excitation');
    });

    it('should respect includeMoodAlias option', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'mood.valence' }, 50] } },
      ];

      const resultWithAlias = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry,
        { includeMoodAlias: true }
      );

      expect(resultWithAlias).toHaveLength(1);
      expect(resultWithAlias[0].varPath).toBe('mood.valence');

      const resultWithoutAlias = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry,
        { includeMoodAlias: false }
      );

      expect(resultWithoutAlias).toHaveLength(0);
    });

    it('should use default options when not provided', () => {
      const prerequisites = [
        {
          logic: {
            and: [{ '>=': [{ var: 'moodAxes.valence' }, 50] }],
          },
        },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      expect(result).toHaveLength(1);
    });

    it('should deduplicate prototype constraints by axis', () => {
      // Both prototypes reference valence with different thresholds
      mockDataRegistry.getLookupData = (key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: { gates: ['valence >= 0.35'] },
              joy: { gates: ['valence >= 0.50'] },
            },
          };
        }
        return null;
      };

      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
              { '>=': [{ var: 'emotions.joy' }, 0.7] },
            ],
          },
        },
      ];

      const result = extractMergedMoodConstraints(
        prerequisites,
        mockDataRegistry
      );

      // Should keep the more restrictive constraint (valence >= 50)
      expect(result).toHaveLength(1);
      expect(result[0].threshold).toBe(50);
    });
  });
});
