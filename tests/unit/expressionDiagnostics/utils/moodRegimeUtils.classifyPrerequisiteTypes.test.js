/**
 * @file Unit tests for moodRegimeUtils.js - classifyPrerequisiteTypes
 */

import { describe, expect, it } from '@jest/globals';
import { classifyPrerequisiteTypes } from '../../../../src/expressionDiagnostics/utils/moodRegimeUtils.js';

describe('moodRegimeUtils', () => {
  describe('classifyPrerequisiteTypes', () => {
    // Edge cases - empty/invalid inputs
    describe('edge cases', () => {
      it('should return default values for null prerequisites', () => {
        const result = classifyPrerequisiteTypes(null);

        expect(result).toEqual({
          hasDirectMoodConstraints: false,
          hasPrototypeConstraints: false,
          isPrototypeOnly: false,
          prototypeRefs: [],
        });
      });

      it('should return default values for undefined prerequisites', () => {
        const result = classifyPrerequisiteTypes(undefined);

        expect(result).toEqual({
          hasDirectMoodConstraints: false,
          hasPrototypeConstraints: false,
          isPrototypeOnly: false,
          prototypeRefs: [],
        });
      });

      it('should return default values for empty array', () => {
        const result = classifyPrerequisiteTypes([]);

        expect(result).toEqual({
          hasDirectMoodConstraints: false,
          hasPrototypeConstraints: false,
          isPrototypeOnly: false,
          prototypeRefs: [],
        });
      });

      it('should return default values for non-array input', () => {
        const result = classifyPrerequisiteTypes({});

        expect(result).toEqual({
          hasDirectMoodConstraints: false,
          hasPrototypeConstraints: false,
          isPrototypeOnly: false,
          prototypeRefs: [],
        });
      });

      it('should handle prerequisites with no logic', () => {
        const prerequisites = [{ someOtherField: 'value' }];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasDirectMoodConstraints).toBe(false);
        expect(result.hasPrototypeConstraints).toBe(false);
        expect(result.isPrototypeOnly).toBe(false);
      });
    });

    // Direct moodAxes constraints
    describe('direct moodAxes constraints', () => {
      it('should detect direct moodAxes.X constraints', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasDirectMoodConstraints).toBe(true);
        expect(result.hasPrototypeConstraints).toBe(false);
        expect(result.isPrototypeOnly).toBe(false);
      });

      it('should detect mood.X alias constraints', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'mood.arousal' }, 30] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasDirectMoodConstraints).toBe(true);
        expect(result.hasPrototypeConstraints).toBe(false);
        expect(result.isPrototypeOnly).toBe(false);
      });

      it('should detect moodAxes constraints in AND blocks', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
                { '<=': [{ var: 'moodAxes.arousal' }, 70] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasDirectMoodConstraints).toBe(true);
      });

      it('should detect moodAxes constraints in OR blocks', () => {
        const prerequisites = [
          {
            logic: {
              or: [
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
                { '>=': [{ var: 'moodAxes.arousal' }, 60] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasDirectMoodConstraints).toBe(true);
      });
    });

    // Prototype references
    describe('prototype references', () => {
      it('should detect emotions.X references', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'emotions.flow' }, 0.62] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(1);
        expect(result.prototypeRefs[0]).toEqual({
          prototypeId: 'flow',
          type: 'emotion',
          varPath: 'emotions.flow',
        });
      });

      it('should detect sexualStates.X references', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(1);
        expect(result.prototypeRefs[0]).toEqual({
          prototypeId: 'aroused',
          type: 'sexual',
          varPath: 'sexualStates.aroused',
        });
      });

      it('should detect previousEmotions.X references', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'previousEmotions.joy' }, 0.4] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(1);
        expect(result.prototypeRefs[0].prototypeId).toBe('joy');
        expect(result.prototypeRefs[0].type).toBe('emotion');
      });

      it('should detect previousSexualStates.X references', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'previousSexualStates.aroused' }, 0.3] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(1);
        expect(result.prototypeRefs[0].prototypeId).toBe('aroused');
        expect(result.prototypeRefs[0].type).toBe('sexual');
      });

      it('should handle multiple prototype references', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'emotions.joy' }, 0.3] },
                { '>=': [{ var: 'sexualStates.aroused' }, 0.4] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(3);
      });

      it('should deduplicate prototype references', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '<=': [{ var: 'emotions.flow' }, 0.9] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.prototypeRefs).toHaveLength(1);
        expect(result.prototypeRefs[0].prototypeId).toBe('flow');
      });
    });

    // Prototype-only classification
    describe('isPrototypeOnly classification', () => {
      it('should classify as prototype-only when only emotions.X refs exist', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'emotions.flow' }, 0.62] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.isPrototypeOnly).toBe(true);
        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.hasDirectMoodConstraints).toBe(false);
      });

      it('should classify as prototype-only when only sexualStates.X refs exist', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.isPrototypeOnly).toBe(true);
      });

      it('should NOT classify as prototype-only when both exist', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.isPrototypeOnly).toBe(false);
        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.hasDirectMoodConstraints).toBe(true);
      });

      it('should NOT classify as prototype-only when only direct moodAxes exist', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.isPrototypeOnly).toBe(false);
        expect(result.hasPrototypeConstraints).toBe(false);
        expect(result.hasDirectMoodConstraints).toBe(true);
      });
    });

    // Determinism
    describe('determinism', () => {
      it('should return prototype refs in deterministic order', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'sexualStates.aroused' }, 0.4] },
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'emotions.anger' }, 0.3] },
              ],
            },
          },
        ];

        const result1 = classifyPrerequisiteTypes(prerequisites);
        const result2 = classifyPrerequisiteTypes(prerequisites);

        // Results should be identical
        expect(result1.prototypeRefs).toEqual(result2.prototypeRefs);

        // Results should be sorted deterministically (type first, then prototypeId)
        expect(result1.prototypeRefs[0].type).toBe('emotion');
        expect(result1.prototypeRefs[0].prototypeId).toBe('anger');
        expect(result1.prototypeRefs[1].type).toBe('emotion');
        expect(result1.prototypeRefs[1].prototypeId).toBe('flow');
        expect(result1.prototypeRefs[2].type).toBe('sexual');
        expect(result1.prototypeRefs[2].prototypeId).toBe('aroused');
      });

      it('should produce consistent results across multiple calls', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.5] },
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
              ],
            },
          },
        ];

        const results = Array.from({ length: 5 }, () =>
          classifyPrerequisiteTypes(prerequisites)
        );

        // All results should be identical
        for (let i = 1; i < results.length; i++) {
          expect(results[i]).toEqual(results[0]);
        }
      });
    });

    // Complex nested structures
    describe('complex nested structures', () => {
      it('should handle deeply nested AND/OR structures', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.flow' }, 0.5] },
                    { '>=': [{ var: 'emotions.joy' }, 0.4] },
                  ],
                },
                { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(3);
        expect(result.isPrototypeOnly).toBe(true);
      });

      it('should handle multiple prerequisites', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } },
          { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.4] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.prototypeRefs).toHaveLength(2);
        expect(result.isPrototypeOnly).toBe(true);
      });

      it('should handle mixed constraints across multiple prerequisites', () => {
        const prerequisites = [
          { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } },
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.hasDirectMoodConstraints).toBe(true);
        expect(result.isPrototypeOnly).toBe(false);
      });
    });

    // Non-mood/non-prototype constraints
    describe('non-mood/non-prototype constraints', () => {
      it('should ignore non-mood variable references', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '==': [{ var: 'actorTraits.aggressive' }, true] },
                { '>=': [{ var: 'inventory.gold' }, 100] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasDirectMoodConstraints).toBe(false);
        expect(result.hasPrototypeConstraints).toBe(false);
        expect(result.isPrototypeOnly).toBe(false);
      });

      it('should detect prototype refs when mixed with non-mood constraints', () => {
        const prerequisites = [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '==': [{ var: 'actorTraits.aggressive' }, true] },
              ],
            },
          },
        ];

        const result = classifyPrerequisiteTypes(prerequisites);

        expect(result.hasPrototypeConstraints).toBe(true);
        expect(result.hasDirectMoodConstraints).toBe(false);
        expect(result.isPrototypeOnly).toBe(true);
      });
    });

    // All comparison operators
    describe('comparison operators', () => {
      const operators = ['>=', '<=', '>', '<', '=='];

      operators.forEach((op) => {
        it(`should detect moodAxes constraint with ${op} operator`, () => {
          const prerequisites = [
            { logic: { [op]: [{ var: 'moodAxes.valence' }, 50] } },
          ];

          const result = classifyPrerequisiteTypes(prerequisites);

          expect(result.hasDirectMoodConstraints).toBe(true);
        });

        it(`should detect prototype ref with ${op} operator`, () => {
          const prerequisites = [
            { logic: { [op]: [{ var: 'emotions.flow' }, 0.5] } },
          ];

          const result = classifyPrerequisiteTypes(prerequisites);

          expect(result.hasPrototypeConstraints).toBe(true);
        });
      });
    });
  });
});
