/**
 * @file NonAxisClauseFeasibility.test.js
 * @description Unit tests for NonAxisClauseFeasibility data model
 */

import { describe, it, expect } from '@jest/globals';
import {
  FEASIBILITY_CLASSIFICATIONS,
  createNonAxisClauseFeasibility,
  isValidClassification,
} from '../../../../src/expressionDiagnostics/models/NonAxisClauseFeasibility.js';

describe('NonAxisClauseFeasibility', () => {
  describe('FEASIBILITY_CLASSIFICATIONS', () => {
    it('should be exported as an array', () => {
      expect(Array.isArray(FEASIBILITY_CLASSIFICATIONS)).toBe(true);
    });

    it('should contain exactly four classification values', () => {
      expect(FEASIBILITY_CLASSIFICATIONS).toHaveLength(4);
    });

    it('should contain IMPOSSIBLE', () => {
      expect(FEASIBILITY_CLASSIFICATIONS).toContain('IMPOSSIBLE');
    });

    it('should contain RARE', () => {
      expect(FEASIBILITY_CLASSIFICATIONS).toContain('RARE');
    });

    it('should contain OK', () => {
      expect(FEASIBILITY_CLASSIFICATIONS).toContain('OK');
    });

    it('should contain UNKNOWN', () => {
      expect(FEASIBILITY_CLASSIFICATIONS).toContain('UNKNOWN');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(FEASIBILITY_CLASSIFICATIONS)).toBe(true);
    });

    it('should not allow modification', () => {
      expect(() => {
        FEASIBILITY_CLASSIFICATIONS.push('INVALID');
      }).toThrow();
    });
  });

  describe('createNonAxisClauseFeasibility', () => {
    describe('required field validation', () => {
      it('should throw error when clauseId is missing', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            varPath: 'emotions.confusion',
            threshold: 0.25,
          })
        ).toThrow('clauseId is required and must be a non-empty string');
      });

      it('should throw error when clauseId is empty string', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: '',
            varPath: 'emotions.confusion',
            threshold: 0.25,
          })
        ).toThrow('clauseId is required and must be a non-empty string');
      });

      it('should throw error when clauseId is not a string', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 123,
            varPath: 'emotions.confusion',
            threshold: 0.25,
          })
        ).toThrow('clauseId is required and must be a non-empty string');
      });

      it('should throw error when varPath is missing', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            threshold: 0.25,
          })
        ).toThrow('varPath is required and must be a non-empty string');
      });

      it('should throw error when varPath is empty string', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: '',
            threshold: 0.25,
          })
        ).toThrow('varPath is required and must be a non-empty string');
      });

      it('should throw error when varPath is not a string', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 123,
            threshold: 0.25,
          })
        ).toThrow('varPath is required and must be a non-empty string');
      });

      it('should throw error when threshold is missing', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
          })
        ).toThrow('threshold is required and must be a number');
      });

      it('should throw error when threshold is not a number', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: '0.25',
          })
        ).toThrow('threshold is required and must be a number');
      });

      it('should throw error when threshold is NaN', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: NaN,
          })
        ).toThrow('threshold is required and must be a number');
      });
    });

    describe('returns frozen object', () => {
      it('should return a frozen object', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(Object.isFrozen(result)).toBe(true);
      });

      it('should not allow modification of result properties', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(() => {
          result.classification = 'OK';
        }).toThrow();
      });

      it('should return frozen evidence object', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(Object.isFrozen(result.evidence)).toBe(true);
      });
    });

    describe('default values', () => {
      it('should default population to "in_regime"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.population).toBe('in_regime');
      });

      it('should default signal to "final"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.signal).toBe('final');
      });

      it('should default operator to ">="', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.operator).toBe('>=');
      });

      it('should default passRate to null', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.passRate).toBeNull();
      });

      it('should default maxValue to null', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.maxValue).toBeNull();
      });

      it('should default p95Value to null', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.p95Value).toBeNull();
      });

      it('should default marginMax to null', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.marginMax).toBeNull();
      });

      it('should default classification to "UNKNOWN"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.classification).toBe('UNKNOWN');
      });

      it('should default sourcePath to empty string', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.sourcePath).toBe('');
      });

      it('should default evidence.bestSampleRef to null', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.evidence.bestSampleRef).toBeNull();
      });

      it('should default evidence.note to empty string', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
        });

        expect(result.evidence.note).toBe('');
      });
    });

    describe('optional field validation', () => {
      it('should accept valid operator ">"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          operator: '>',
        });

        expect(result.operator).toBe('>');
      });

      it('should accept valid operator "<="', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          operator: '<=',
        });

        expect(result.operator).toBe('<=');
      });

      it('should accept valid operator "<"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          operator: '<',
        });

        expect(result.operator).toBe('<');
      });

      it('should accept valid operator "=="', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          operator: '==',
        });

        expect(result.operator).toBe('==');
      });

      it('should accept valid operator "!="', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          operator: '!=',
        });

        expect(result.operator).toBe('!=');
      });

      it('should throw error for invalid operator', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: 0.25,
            operator: '===',
          })
        ).toThrow('operator must be one of');
      });

      it('should accept valid signal "delta"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          signal: 'delta',
        });

        expect(result.signal).toBe('delta');
      });

      it('should accept valid signal "raw"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          signal: 'raw',
        });

        expect(result.signal).toBe('raw');
      });

      it('should throw error for invalid signal', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: 0.25,
            signal: 'invalid',
          })
        ).toThrow('signal must be one of');
      });

      it('should accept valid classification "IMPOSSIBLE"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          classification: 'IMPOSSIBLE',
        });

        expect(result.classification).toBe('IMPOSSIBLE');
      });

      it('should accept valid classification "RARE"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          classification: 'RARE',
        });

        expect(result.classification).toBe('RARE');
      });

      it('should accept valid classification "OK"', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          classification: 'OK',
        });

        expect(result.classification).toBe('OK');
      });

      it('should throw error for invalid classification', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: 0.25,
            classification: 'INVALID',
          })
        ).toThrow('classification must be one of');
      });

      it('should accept passRate of 0', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          passRate: 0,
        });

        expect(result.passRate).toBe(0);
      });

      it('should accept passRate of 1', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          passRate: 1,
        });

        expect(result.passRate).toBe(1);
      });

      it('should accept passRate between 0 and 1', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          passRate: 0.5,
        });

        expect(result.passRate).toBe(0.5);
      });

      it('should throw error for passRate less than 0', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: 0.25,
            passRate: -0.1,
          })
        ).toThrow('passRate must be a number in [0, 1] or null');
      });

      it('should throw error for passRate greater than 1', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: 0.25,
            passRate: 1.1,
          })
        ).toThrow('passRate must be a number in [0, 1] or null');
      });

      it('should throw error for non-numeric passRate', () => {
        expect(() =>
          createNonAxisClauseFeasibility({
            clauseId: 'clause_abc123',
            varPath: 'emotions.confusion',
            threshold: 0.25,
            passRate: '0.5',
          })
        ).toThrow('passRate must be a number in [0, 1] or null');
      });
    });

    describe('evidence structure', () => {
      it('should accept evidence with bestSampleRef', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          evidence: {
            bestSampleRef: 'sample_42',
            note: 'Test note',
          },
        });

        expect(result.evidence.bestSampleRef).toBe('sample_42');
      });

      it('should accept evidence with note', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          evidence: {
            bestSampleRef: null,
            note: 'This is a test note',
          },
        });

        expect(result.evidence.note).toBe('This is a test note');
      });

      it('should handle partial evidence object', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          evidence: {
            note: 'Only note provided',
          },
        });

        expect(result.evidence.bestSampleRef).toBeNull();
        expect(result.evidence.note).toBe('Only note provided');
      });

      it('should handle empty evidence object', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          evidence: {},
        });

        expect(result.evidence.bestSampleRef).toBeNull();
        expect(result.evidence.note).toBe('');
      });
    });

    describe('complete object creation', () => {
      it('should create a complete object with all fields provided', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          sourcePath: 'prereqs[0].and[1]',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.25,
          signal: 'final',
          passRate: 0,
          maxValue: 0.18,
          p95Value: 0.15,
          marginMax: -0.07,
          classification: 'IMPOSSIBLE',
          evidence: {
            bestSampleRef: null,
            note: 'emotions.confusion >= 0.250 but max(final)=0.180 in-regime (0.070 short, 0.0% pass)',
          },
        });

        expect(result).toEqual({
          clauseId: 'clause_abc123',
          sourcePath: 'prereqs[0].and[1]',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.25,
          signal: 'final',
          population: 'in_regime',
          passRate: 0,
          maxValue: 0.18,
          p95Value: 0.15,
          marginMax: -0.07,
          classification: 'IMPOSSIBLE',
          evidence: {
            bestSampleRef: null,
            note: 'emotions.confusion >= 0.250 but max(final)=0.180 in-regime (0.070 short, 0.0% pass)',
          },
        });
      });

      it('should allow negative threshold values', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: -0.5,
        });

        expect(result.threshold).toBe(-0.5);
      });

      it('should allow zero threshold values', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0,
        });

        expect(result.threshold).toBe(0);
      });

      it('should allow negative maxValue', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          maxValue: -0.5,
        });

        expect(result.maxValue).toBe(-0.5);
      });

      it('should allow negative marginMax', () => {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          marginMax: -0.1,
        });

        expect(result.marginMax).toBe(-0.1);
      });
    });
  });

  describe('isValidClassification', () => {
    it('should return true for IMPOSSIBLE', () => {
      expect(isValidClassification('IMPOSSIBLE')).toBe(true);
    });

    it('should return true for RARE', () => {
      expect(isValidClassification('RARE')).toBe(true);
    });

    it('should return true for OK', () => {
      expect(isValidClassification('OK')).toBe(true);
    });

    it('should return true for UNKNOWN', () => {
      expect(isValidClassification('UNKNOWN')).toBe(true);
    });

    it('should return false for invalid classification', () => {
      expect(isValidClassification('invalid')).toBe(false);
    });

    it('should return false for lowercase valid classification', () => {
      expect(isValidClassification('impossible')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidClassification('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidClassification(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidClassification(undefined)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidClassification(0)).toBe(false);
    });
  });

  describe('invariants', () => {
    it('should always set population to "in_regime" regardless of input', () => {
      // The model always uses 'in_regime' - verify this is true even with explicit props
      const result = createNonAxisClauseFeasibility({
        clauseId: 'clause_abc123',
        varPath: 'emotions.confusion',
        threshold: 0.25,
        // Note: population is not in the props interface, it's always 'in_regime'
      });

      expect(result.population).toBe('in_regime');
    });

    it('should ensure evidence object is always present', () => {
      const result = createNonAxisClauseFeasibility({
        clauseId: 'clause_abc123',
        varPath: 'emotions.confusion',
        threshold: 0.25,
      });

      expect(result.evidence).toBeDefined();
      expect(typeof result.evidence).toBe('object');
      expect(result.evidence).not.toBeNull();
    });

    it('should ensure evidence.note is always a string', () => {
      const result = createNonAxisClauseFeasibility({
        clauseId: 'clause_abc123',
        varPath: 'emotions.confusion',
        threshold: 0.25,
      });

      expect(typeof result.evidence.note).toBe('string');
    });

    it('should ensure all returned classification values are in FEASIBILITY_CLASSIFICATIONS', () => {
      for (const classification of FEASIBILITY_CLASSIFICATIONS) {
        const result = createNonAxisClauseFeasibility({
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          threshold: 0.25,
          classification,
        });

        expect(FEASIBILITY_CLASSIFICATIONS).toContain(result.classification);
      }
    });
  });
});
