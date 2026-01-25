/**
 * @file Unit tests for deterministic ordering in moodRegimeUtils.js
 * Tests that extractMergedMoodConstraints and related functions return
 * deterministically ordered results across multiple calls.
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  extractMergedMoodConstraints,
  mergeConstraints,
} from '../../../../src/expressionDiagnostics/utils/moodRegimeUtils.js';
import { extractConstraintsFromPrototypeGates } from '../../../../src/expressionDiagnostics/utils/prototypeGateUtils.js';

describe('moodRegimeUtils - deterministic ordering', () => {
  let mockDataRegistry;

  beforeEach(() => {
    mockDataRegistry = {
      getLookupData: (key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                weights: { valence: 0.6, arousal: 0.2 },
                gates: ['valence >= 0.35', 'arousal >= 0.20'],
              },
              joy: {
                weights: { valence: 0.8 },
                gates: ['valence >= 0.40'],
              },
              anger: {
                weights: { valence: -0.6, threat: 0.8 },
                gates: ['threat >= 0.20', 'valence <= 0.30'],
              },
              sadness: {
                weights: { valence: -0.5 },
                gates: ['valence <= 0.25'],
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
              intimate: {
                weights: { sex_excitation: 0.5, intimacy: 0.8 },
                gates: ['intimacy >= 0.30', 'sex_excitation >= 0.20'],
              },
            },
          };
        }
        return null;
      },
    };
  });

  describe('extractMergedMoodConstraints determinism', () => {
    it('should return identical results across multiple calls with same input', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
              { '>=': [{ var: 'emotions.anger' }, 0.3] },
              { '>=': [{ var: 'emotions.joy' }, 0.4] },
            ],
          },
        },
      ];

      // Call 10 times and verify all results are identical
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          extractMergedMoodConstraints(prerequisites, mockDataRegistry)
        );
      }

      // All results should be deeply equal
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it('should return results sorted by varPath, then operator, then threshold', () => {
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
        mockDataRegistry,
        { deduplicateByAxis: false }
      );

      // Verify sorted order by checking varPaths are in ascending order
      const varPaths = result.map((c) => c.varPath);
      const sortedVarPaths = [...varPaths].sort();
      expect(varPaths).toEqual(sortedVarPaths);
    });

    it('should produce consistent JSON serialization across calls', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
              { '>=': [{ var: 'sexualStates.aroused' }, 0.4] },
              { '>=': [{ var: 'emotions.joy' }, 0.3] },
            ],
          },
        },
      ];

      const json1 = JSON.stringify(
        extractMergedMoodConstraints(prerequisites, mockDataRegistry)
      );
      const json2 = JSON.stringify(
        extractMergedMoodConstraints(prerequisites, mockDataRegistry)
      );
      const json3 = JSON.stringify(
        extractMergedMoodConstraints(prerequisites, mockDataRegistry)
      );

      expect(json1).toBe(json2);
      expect(json2).toBe(json3);
    });
  });

  describe('extractConstraintsFromPrototypeGates determinism', () => {
    it('should return deterministically ordered constraints', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
              { '>=': [{ var: 'emotions.anger' }, 0.3] },
              { '>=': [{ var: 'sexualStates.intimate' }, 0.4] },
            ],
          },
        },
      ];

      // Call multiple times
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          extractConstraintsFromPrototypeGates(
            prerequisites,
            mockDataRegistry,
            { deduplicateByAxis: false }
          )
        );
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it('should sort constraints alphabetically by varPath', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'sexualStates.intimate' }, 0.4] },
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
            ],
          },
        },
      ];

      const result = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry,
        { deduplicateByAxis: false }
      );

      const varPaths = result.map((c) => c.varPath);
      const sortedVarPaths = [...varPaths].sort();
      expect(varPaths).toEqual(sortedVarPaths);
    });
  });

  describe('mergeConstraints determinism', () => {
    it('should return deterministically ordered merged constraints', () => {
      const directConstraints = [
        { varPath: 'moodAxes.threat', operator: '>=', threshold: 30 },
        { varPath: 'moodAxes.arousal', operator: '>=', threshold: 40 },
      ];

      const prototypeConstraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 35 },
        { varPath: 'moodAxes.sex_excitation', operator: '>=', threshold: 20 },
      ];

      // Call multiple times
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(mergeConstraints(directConstraints, prototypeConstraints));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it('should produce sorted output regardless of input order', () => {
      const directConstraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 50 },
        { varPath: 'moodAxes.arousal', operator: '>=', threshold: 30 },
      ];

      const prototypeConstraints = [
        { varPath: 'moodAxes.threat', operator: '>=', threshold: 20 },
        { varPath: 'moodAxes.intimacy', operator: '>=', threshold: 40 },
      ];

      const result = mergeConstraints(directConstraints, prototypeConstraints);

      // Verify sorted order by varPath
      for (let i = 1; i < result.length; i++) {
        const prevPath = result[i - 1].varPath;
        const currPath = result[i].varPath;
        expect(prevPath.localeCompare(currPath)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('hash consistency for complex expressions', () => {
    it('should produce identical constraint arrays for expressions with many prototype refs', () => {
      // Simulate flow_absorption-like expression with multiple emotion references
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.6] },
              { '>=': [{ var: 'emotions.joy' }, 0.3] },
              { '<=': [{ var: 'emotions.anger' }, 0.2] },
              { '>=': [{ var: 'sexualStates.aroused' }, 0.1] },
            ],
          },
        },
      ];

      // Run extraction 20 times and collect JSON representations
      const jsonStrings = new Set();
      for (let i = 0; i < 20; i++) {
        const result = extractMergedMoodConstraints(
          prerequisites,
          mockDataRegistry
        );
        jsonStrings.add(JSON.stringify(result));
      }

      // Should only have ONE unique JSON string (all calls identical)
      expect(jsonStrings.size).toBe(1);
    });
  });
});
