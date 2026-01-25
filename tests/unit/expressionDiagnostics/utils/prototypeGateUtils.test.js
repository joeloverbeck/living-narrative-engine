/**
 * @file Unit tests for prototypeGateUtils.js
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  extractPrototypeReferencesFromLogic,
  getPrototypeGates,
  convertGateToMoodConstraint,
  extractConstraintsFromPrototypeGates,
  hasOrPrototypeReferences,
} from '../../../../src/expressionDiagnostics/utils/prototypeGateUtils.js';

describe('prototypeGateUtils', () => {
  describe('extractPrototypeReferencesFromLogic', () => {
    it('should extract emotion references from simple var pattern', () => {
      const logic = { var: 'emotions.joy' };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        prototypeId: 'joy',
        type: 'emotion',
        varPath: 'emotions.joy',
      });
    });

    it('should extract sexual state references', () => {
      const logic = { var: 'sexualStates.aroused' };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        prototypeId: 'aroused',
        type: 'sexual',
        varPath: 'sexualStates.aroused',
      });
    });

    it('should extract multiple references from comparison logic', () => {
      const logic = {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '>=': [{ var: 'emotions.anger' }, 0.3] },
        ],
      };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(2);
      expect(refs.map((r) => r.prototypeId)).toContain('joy');
      expect(refs.map((r) => r.prototypeId)).toContain('anger');
    });

    it('should deduplicate same prototype references', () => {
      const logic = {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '<=': [{ var: 'emotions.joy' }, 0.9] },
        ],
      };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(1);
      expect(refs[0].prototypeId).toBe('joy');
    });

    it('should handle previousEmotions prefix', () => {
      const logic = { var: 'previousEmotions.joy' };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(1);
      expect(refs[0].type).toBe('emotion');
      expect(refs[0].prototypeId).toBe('joy');
    });

    it('should handle previousSexualStates prefix', () => {
      const logic = { var: 'previousSexualStates.aroused' };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(1);
      expect(refs[0].type).toBe('sexual');
      expect(refs[0].prototypeId).toBe('aroused');
    });

    it('should ignore non-emotion/sexual var patterns', () => {
      const logic = { var: 'moodAxes.valence' };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(0);
    });

    it('should return empty array for null/undefined input', () => {
      expect(extractPrototypeReferencesFromLogic(null)).toEqual([]);
      expect(extractPrototypeReferencesFromLogic(undefined)).toEqual([]);
    });

    it('should return empty array for primitive values', () => {
      expect(extractPrototypeReferencesFromLogic(42)).toEqual([]);
      expect(extractPrototypeReferencesFromLogic('string')).toEqual([]);
    });

    it('should handle deeply nested logic', () => {
      const logic = {
        or: [
          {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
            ],
          },
          { '>=': [{ var: 'emotions.anger' }, 0.7] },
        ],
      };
      const refs = extractPrototypeReferencesFromLogic(logic);

      expect(refs).toHaveLength(3);
      expect(refs.map((r) => r.prototypeId).sort()).toEqual([
        'anger',
        'aroused',
        'joy',
      ]);
    });
  });

  describe('getPrototypeGates', () => {
    let mockDataRegistry;

    beforeEach(() => {
      mockDataRegistry = {
        getLookupData: (key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                joy: {
                  weights: { valence: 0.8, arousal: 0.4 },
                  gates: ['valence >= 0.35'],
                },
                anger: {
                  weights: { valence: -0.6, arousal: 0.7 },
                  gates: ['arousal >= 0.30', 'threat >= 0.20'],
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

    it('should return gates for emotion prototype', () => {
      const gates = getPrototypeGates('joy', 'emotion', mockDataRegistry);
      expect(gates).toEqual(['valence >= 0.35']);
    });

    it('should return multiple gates for prototype with multiple gates', () => {
      const gates = getPrototypeGates('anger', 'emotion', mockDataRegistry);
      expect(gates).toEqual(['arousal >= 0.30', 'threat >= 0.20']);
    });

    it('should return gates for sexual prototype', () => {
      const gates = getPrototypeGates('aroused', 'sexual', mockDataRegistry);
      expect(gates).toEqual(['sex_excitation >= 0.40']);
    });

    it('should return empty array for unknown prototype', () => {
      const gates = getPrototypeGates('unknown', 'emotion', mockDataRegistry);
      expect(gates).toEqual([]);
    });

    it('should return empty array for null dataRegistry', () => {
      const gates = getPrototypeGates('joy', 'emotion', null);
      expect(gates).toEqual([]);
    });

    it('should return empty array for dataRegistry without getLookupData', () => {
      const gates = getPrototypeGates('joy', 'emotion', {});
      expect(gates).toEqual([]);
    });

    it('should return empty array when prototype has no gates', () => {
      mockDataRegistry.getLookupData = () => ({
        entries: {
          joy: { weights: { valence: 0.8 } },
        },
      });
      const gates = getPrototypeGates('joy', 'emotion', mockDataRegistry);
      expect(gates).toEqual([]);
    });
  });

  describe('convertGateToMoodConstraint', () => {
    it('should convert gate constraint to mood constraint format', () => {
      // Create a mock GateConstraint-like object
      const gateConstraint = {
        axis: 'valence',
        operator: '>=',
        value: 0.35,
      };

      const result = convertGateToMoodConstraint(gateConstraint);

      expect(result).toEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 35,
      });
    });

    it('should handle negative gate values', () => {
      const gateConstraint = {
        axis: 'threat',
        operator: '<=',
        value: -0.2,
      };

      const result = convertGateToMoodConstraint(gateConstraint);

      expect(result).toEqual({
        varPath: 'moodAxes.threat',
        operator: '<=',
        threshold: -20,
      });
    });

    it('should handle different operators', () => {
      const operators = ['>=', '<=', '>', '<', '=='];

      for (const op of operators) {
        const gateConstraint = {
          axis: 'valence',
          operator: op,
          value: 0.5,
        };

        const result = convertGateToMoodConstraint(gateConstraint);
        expect(result.operator).toBe(op);
      }
    });
  });

  describe('extractConstraintsFromPrototypeGates', () => {
    let mockDataRegistry;

    beforeEach(() => {
      mockDataRegistry = {
        getLookupData: (key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                joy: {
                  weights: { valence: 0.8 },
                  gates: ['valence >= 0.35'],
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

    it('should extract constraints from prerequisites with emotion refs', () => {
      const prerequisites = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];

      const constraints = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry
      );

      expect(constraints).toHaveLength(1);
      expect(constraints[0]).toEqual({
        varPath: 'moodAxes.valence',
        operator: '>=',
        threshold: 35,
      });
    });

    it('should extract constraints from multiple prototype references', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.anger' }, 0.3] },
            ],
          },
        },
      ];

      const constraints = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry
      );

      // joy has valence gate, anger has threat gate
      expect(constraints).toHaveLength(2);
      expect(constraints.map((c) => c.varPath).sort()).toEqual([
        'moodAxes.threat',
        'moodAxes.valence',
      ]);
    });

    it('should deduplicate constraints by axis when enabled', () => {
      // Both prototypes reference same axis with different thresholds
      mockDataRegistry.getLookupData = (key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: { gates: ['valence >= 0.35'] },
              ecstasy: { gates: ['valence >= 0.50'] },
            },
          };
        }
        return null;
      };

      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.ecstasy' }, 0.7] },
            ],
          },
        },
      ];

      const constraints = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry,
        { deduplicateByAxis: true }
      );

      // Should keep the more restrictive constraint (valence >= 0.50)
      expect(constraints).toHaveLength(1);
      expect(constraints[0].threshold).toBe(50);
    });

    it('should return empty array for null prerequisites', () => {
      const constraints = extractConstraintsFromPrototypeGates(
        null,
        mockDataRegistry
      );
      expect(constraints).toEqual([]);
    });

    it('should return empty array for null dataRegistry', () => {
      const prerequisites = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];
      const constraints = extractConstraintsFromPrototypeGates(prerequisites, null);
      expect(constraints).toEqual([]);
    });

    it('should skip prerequisites without logic property', () => {
      const prerequisites = [{ someOtherProp: 'value' }];
      const constraints = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry
      );
      expect(constraints).toEqual([]);
    });

    it('should handle sexual state references', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
      ];

      const constraints = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry
      );

      expect(constraints).toHaveLength(1);
      expect(constraints[0].varPath).toBe('sexualAxes.sex_excitation');
    });
  });

  describe('hasOrPrototypeReferences', () => {
    it('should return true for OR blocks with emotion references', () => {
      const prerequisites = [
        {
          logic: {
            or: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.anger' }, 0.5] },
            ],
          },
        },
      ];

      expect(hasOrPrototypeReferences(prerequisites)).toBe(true);
    });

    it('should return true for OR blocks with sexual references', () => {
      const prerequisites = [
        {
          logic: {
            or: [
              { '>=': [{ var: 'sexualStates.aroused' }, 0.5] },
              { '>=': [{ var: 'sexualStates.inhibited' }, 0.5] },
            ],
          },
        },
      ];

      expect(hasOrPrototypeReferences(prerequisites)).toBe(true);
    });

    it('should return false for AND blocks only', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.anger' }, 0.5] },
            ],
          },
        },
      ];

      expect(hasOrPrototypeReferences(prerequisites)).toBe(false);
    });

    it('should return false for simple comparison without OR', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
      ];

      expect(hasOrPrototypeReferences(prerequisites)).toBe(false);
    });

    it('should detect OR in nested AND blocks', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                  { '>=': [{ var: 'emotions.anger' }, 0.5] },
                ],
              },
              { '>=': [{ var: 'moodAxes.valence' }, 0.3] },
            ],
          },
        },
      ];

      expect(hasOrPrototypeReferences(prerequisites)).toBe(true);
    });

    it('should return false for null/undefined prerequisites', () => {
      expect(hasOrPrototypeReferences(null)).toBe(false);
      expect(hasOrPrototypeReferences(undefined)).toBe(false);
    });

    it('should return false for non-array prerequisites', () => {
      expect(hasOrPrototypeReferences('not an array')).toBe(false);
      expect(hasOrPrototypeReferences({})).toBe(false);
    });

    it('should return false for OR blocks with non-prototype references', () => {
      const prerequisites = [
        {
          logic: {
            or: [
              { '>=': [{ var: 'moodAxes.valence' }, 0.5] },
              { '>=': [{ var: 'moodAxes.arousal' }, 0.5] },
            ],
          },
        },
      ];

      expect(hasOrPrototypeReferences(prerequisites)).toBe(false);
    });
  });
});
