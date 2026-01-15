/**
 * @file Unit tests for shared mood regime utilities.
 */

import { describe, expect, it } from '@jest/globals';
import {
  evaluateConstraint,
  extractMoodConstraints,
  filterContextsByConstraints,
  formatConstraints,
  hasOrMoodConstraints,
} from '../../../src/expressionDiagnostics/utils/moodRegimeUtils.js';

describe('moodRegimeUtils', () => {
  describe('extractMoodConstraints', () => {
    it('extracts AND-only mood constraints and respects mood alias', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 0.2] },
              { '<=': [{ var: 'mood.threat' }, 0.4] },
              {
                or: [
                  { '>=': [{ var: 'moodAxes.arousal' }, 0.8] },
                  { '<=': [{ var: 'mood.valence' }, -0.2] },
                ],
              },
            ],
          },
        },
      ];

      const constraints = extractMoodConstraints(prerequisites, {
        includeMoodAlias: true,
        andOnly: true,
      });

      expect(constraints).toEqual([
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.2 },
        { varPath: 'mood.threat', operator: '<=', threshold: 0.4 },
      ]);
    });

    it('can omit mood alias paths when configured', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 0.2] },
              { '<=': [{ var: 'mood.threat' }, 0.4] },
            ],
          },
        },
      ];

      const constraints = extractMoodConstraints(prerequisites, {
        includeMoodAlias: false,
        andOnly: true,
      });

      expect(constraints).toEqual([
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.2 },
      ]);
    });
  });

  describe('hasOrMoodConstraints', () => {
    it('detects mood constraints inside OR blocks', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 0.2] },
              {
                or: [
                  { '>=': [{ var: 'mood.threat' }, 0.8] },
                  { '>=': [{ var: 'emotions.joy' }, 0.1] },
                ],
              },
            ],
          },
        },
      ];

      expect(hasOrMoodConstraints(prerequisites, { includeMoodAlias: true })).toBe(true);
    });

    it('ignores non-mood OR constraints', () => {
      const prerequisites = [
        {
          logic: {
            or: [{ '>=': [{ var: 'emotions.joy' }, 0.2] }],
          },
        },
      ];

      expect(hasOrMoodConstraints(prerequisites, { includeMoodAlias: true })).toBe(false);
    });
  });

  describe('evaluateConstraint', () => {
    it('evaluates comparison operators consistently', () => {
      expect(evaluateConstraint(3, '>=', 2)).toBe(true);
      expect(evaluateConstraint(3, '>', 3)).toBe(false);
      expect(evaluateConstraint(3, '<=', 3)).toBe(true);
      expect(evaluateConstraint(3, '<', 2)).toBe(false);
      expect(evaluateConstraint(3, '==', 3)).toBe(true);
    });

    it('returns false for non-numeric values or operators', () => {
      expect(evaluateConstraint(null, '>=', 2)).toBe(false);
      expect(evaluateConstraint(2, '!=', 2)).toBe(false);
    });
  });

  describe('filterContextsByConstraints', () => {
    it('filters contexts based on all constraints', () => {
      const contexts = [
        { moodAxes: { valence: 0.3 }, mood: { threat: 0.2 } },
        { moodAxes: { valence: -0.1 }, mood: { threat: 0.2 } },
        { moodAxes: { valence: 0.4 }, mood: { threat: 0.8 } },
      ];
      const constraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0 },
        { varPath: 'mood.threat', operator: '<=', threshold: 0.5 },
      ];

      const filtered = filterContextsByConstraints(contexts, constraints);

      expect(filtered).toEqual([
        { moodAxes: { valence: 0.3 }, mood: { threat: 0.2 } },
      ]);
    });
  });

  describe('formatConstraints', () => {
    it('formats constraints deterministically', () => {
      const constraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.2 },
        { varPath: 'mood.threat', operator: '<=', threshold: 0.4 },
      ];

      expect(formatConstraints(constraints)).toBe(
        '`moodAxes.valence >= 0.2 (normalized >= 0.00)`, `mood.threat <= 0.4 (normalized <= 0.00)`'
      );
    });
  });
});
