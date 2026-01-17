/**
 * @file FitFeasibilityConflict.test.js
 * @description Unit tests for FitFeasibilityConflict data model
 */

import { describe, it, expect } from '@jest/globals';
import {
  CONFLICT_TYPES,
  isValidConflictType,
  createPrototypeScore,
  createFitFeasibilityConflict,
} from '../../../../src/expressionDiagnostics/models/FitFeasibilityConflict.js';

describe('FitFeasibilityConflict', () => {
  describe('CONFLICT_TYPES', () => {
    it('should be exported', () => {
      expect(CONFLICT_TYPES).toBeDefined();
    });

    it('should contain exactly two conflict types', () => {
      expect(CONFLICT_TYPES).toHaveLength(2);
    });

    it('should contain fit_vs_clause_impossible', () => {
      expect(CONFLICT_TYPES).toContain('fit_vs_clause_impossible');
    });

    it('should contain gate_contradiction', () => {
      expect(CONFLICT_TYPES).toContain('gate_contradiction');
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(CONFLICT_TYPES)).toBe(true);
    });
  });

  describe('isValidConflictType', () => {
    it('should return true for fit_vs_clause_impossible', () => {
      expect(isValidConflictType('fit_vs_clause_impossible')).toBe(true);
    });

    it('should return true for gate_contradiction', () => {
      expect(isValidConflictType('gate_contradiction')).toBe(true);
    });

    it('should return false for invalid type', () => {
      expect(isValidConflictType('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidConflictType('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidConflictType(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidConflictType(undefined)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidConflictType(123)).toBe(false);
    });
  });

  describe('createPrototypeScore', () => {
    it('should create a valid prototype score', () => {
      const score = createPrototypeScore('flow', 0.85);
      expect(score).toEqual({ prototypeId: 'flow', score: 0.85 });
    });

    it('should return a frozen object', () => {
      const score = createPrototypeScore('anger', 0.75);
      expect(Object.isFrozen(score)).toBe(true);
    });

    it('should throw on missing prototypeId', () => {
      expect(() => createPrototypeScore(null, 0.5)).toThrow(
        'prototypeId is required and must be a non-empty string'
      );
    });

    it('should throw on empty string prototypeId', () => {
      expect(() => createPrototypeScore('', 0.5)).toThrow(
        'prototypeId is required and must be a non-empty string'
      );
    });

    it('should throw on non-string prototypeId', () => {
      expect(() => createPrototypeScore(123, 0.5)).toThrow(
        'prototypeId is required and must be a non-empty string'
      );
    });

    it('should throw on missing score', () => {
      expect(() => createPrototypeScore('flow', undefined)).toThrow(
        'score is required and must be a number'
      );
    });

    it('should throw on non-number score', () => {
      expect(() => createPrototypeScore('flow', 'high')).toThrow(
        'score is required and must be a number'
      );
    });

    it('should throw on NaN score', () => {
      expect(() => createPrototypeScore('flow', NaN)).toThrow(
        'score is required and must be a number'
      );
    });

    it('should allow negative scores', () => {
      const score = createPrototypeScore('flow', -0.5);
      expect(score.score).toBe(-0.5);
    });

    it('should allow zero score', () => {
      const score = createPrototypeScore('flow', 0);
      expect(score.score).toBe(0);
    });
  });

  describe('createFitFeasibilityConflict', () => {
    describe('required fields validation', () => {
      it('should throw on missing type', () => {
        expect(() =>
          createFitFeasibilityConflict({
            explanation: 'Test explanation',
          })
        ).toThrow('type must be one of');
      });

      it('should throw on invalid type', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'invalid_type',
            explanation: 'Test explanation',
          })
        ).toThrow('type must be one of');
      });

      it('should throw on missing explanation', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
          })
        ).toThrow('explanation is required and must be a string');
      });

      it('should throw on non-string explanation', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 123,
          })
        ).toThrow('explanation is required and must be a string');
      });

      it('should throw on empty string explanation', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: '',
          })
        ).toThrow('explanation is required and must be a string');
      });
    });

    describe('default values', () => {
      it('should default topPrototypes to empty array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
        });
        expect(conflict.topPrototypes).toEqual([]);
      });

      it('should default impossibleClauseIds to empty array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
        });
        expect(conflict.impossibleClauseIds).toEqual([]);
      });

      it('should default suggestedFixes to empty array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
        });
        expect(conflict.suggestedFixes).toEqual([]);
      });
    });

    describe('immutability', () => {
      it('should return a frozen object', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
        });
        expect(Object.isFrozen(conflict)).toBe(true);
      });

      it('should freeze topPrototypes array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
          topPrototypes: [{ prototypeId: 'flow', score: 0.85 }],
        });
        expect(Object.isFrozen(conflict.topPrototypes)).toBe(true);
      });

      it('should freeze each prototype score object in topPrototypes', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
          topPrototypes: [
            { prototypeId: 'flow', score: 0.85 },
            { prototypeId: 'anger', score: 0.75 },
          ],
        });
        conflict.topPrototypes.forEach((proto) => {
          expect(Object.isFrozen(proto)).toBe(true);
        });
      });

      it('should freeze impossibleClauseIds array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
          impossibleClauseIds: ['clause_1', 'clause_2'],
        });
        expect(Object.isFrozen(conflict.impossibleClauseIds)).toBe(true);
      });

      it('should freeze suggestedFixes array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test explanation',
          suggestedFixes: ['Fix 1', 'Fix 2'],
        });
        expect(Object.isFrozen(conflict.suggestedFixes)).toBe(true);
      });
    });

    describe('successful creation', () => {
      it('should create a valid conflict with all fields', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          topPrototypes: [
            { prototypeId: 'flow', score: 0.85 },
            { prototypeId: 'anger', score: 0.75 },
          ],
          impossibleClauseIds: ['clause_abc123', 'clause_xyz789'],
          explanation: 'Mood signature matches but clauses impossible',
          suggestedFixes: ['Lower threshold', 'Remove emotion condition'],
        });

        expect(conflict.type).toBe('fit_vs_clause_impossible');
        expect(conflict.topPrototypes).toHaveLength(2);
        expect(conflict.topPrototypes[0].prototypeId).toBe('flow');
        expect(conflict.topPrototypes[0].score).toBe(0.85);
        expect(conflict.impossibleClauseIds).toEqual([
          'clause_abc123',
          'clause_xyz789',
        ]);
        expect(conflict.explanation).toBe(
          'Mood signature matches but clauses impossible'
        );
        expect(conflict.suggestedFixes).toHaveLength(2);
      });

      it('should create a valid gate_contradiction conflict', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'gate_contradiction',
          topPrototypes: [{ prototypeId: 'fear', score: 0.65 }],
          impossibleClauseIds: ['gate:anger:valence'],
          explanation: 'Gate contradicts mood regime',
          suggestedFixes: ['Adjust mood regime constraint'],
        });

        expect(conflict.type).toBe('gate_contradiction');
        expect(conflict.impossibleClauseIds).toContain('gate:anger:valence');
      });
    });

    describe('topPrototypes validation', () => {
      it('should throw when topPrototypes is not an array', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: 'not an array',
          })
        ).toThrow('topPrototypes must be an array');
      });

      it('should throw when topPrototypes item is not an object', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: ['invalid'],
          })
        ).toThrow('topPrototypes[0] must be an object');
      });

      it('should throw when topPrototypes item is null', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: [null],
          })
        ).toThrow('topPrototypes[0] must be an object');
      });

      it('should throw when topPrototypes item lacks prototypeId', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: [{ score: 0.5 }],
          })
        ).toThrow('topPrototypes[0].prototypeId is required');
      });

      it('should throw when topPrototypes item lacks score', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: [{ prototypeId: 'flow' }],
          })
        ).toThrow('topPrototypes[0].score is required');
      });

      it('should throw when topPrototypes item has NaN score', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: [{ prototypeId: 'flow', score: NaN }],
          })
        ).toThrow('topPrototypes[0].score is required');
      });

      it('should indicate correct index in error message', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            topPrototypes: [
              { prototypeId: 'flow', score: 0.85 },
              { prototypeId: 'fear', score: NaN },
            ],
          })
        ).toThrow('topPrototypes[1].score is required');
      });
    });

    describe('impossibleClauseIds validation', () => {
      it('should throw when impossibleClauseIds is not an array', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            impossibleClauseIds: 'not an array',
          })
        ).toThrow('impossibleClauseIds must be an array');
      });

      it('should accept empty impossibleClauseIds array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test',
          impossibleClauseIds: [],
        });
        expect(conflict.impossibleClauseIds).toEqual([]);
      });
    });

    describe('suggestedFixes validation', () => {
      it('should throw when suggestedFixes is not an array', () => {
        expect(() =>
          createFitFeasibilityConflict({
            type: 'fit_vs_clause_impossible',
            explanation: 'Test',
            suggestedFixes: 'not an array',
          })
        ).toThrow('suggestedFixes must be an array');
      });

      it('should accept empty suggestedFixes array', () => {
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test',
          suggestedFixes: [],
        });
        expect(conflict.suggestedFixes).toEqual([]);
      });
    });

    describe('defensive copying', () => {
      it('should not be affected by mutations to input topPrototypes array', () => {
        const inputPrototypes = [{ prototypeId: 'flow', score: 0.85 }];
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test',
          topPrototypes: inputPrototypes,
        });

        // Mutate input array
        inputPrototypes.push({ prototypeId: 'fear', score: 0.5 });

        expect(conflict.topPrototypes).toHaveLength(1);
      });

      it('should not be affected by mutations to input impossibleClauseIds array', () => {
        const inputIds = ['clause_1'];
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test',
          impossibleClauseIds: inputIds,
        });

        // Mutate input array
        inputIds.push('clause_2');

        expect(conflict.impossibleClauseIds).toHaveLength(1);
      });

      it('should not be affected by mutations to input suggestedFixes array', () => {
        const inputFixes = ['Fix 1'];
        const conflict = createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Test',
          suggestedFixes: inputFixes,
        });

        // Mutate input array
        inputFixes.push('Fix 2');

        expect(conflict.suggestedFixes).toHaveLength(1);
      });
    });
  });

  describe('invariants', () => {
    it('should always have type as one of 2 valid conflict types', () => {
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });
      expect(isValidConflictType(conflict.type)).toBe(true);
    });

    it('should always have topPrototypes as an array (never undefined)', () => {
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });
      expect(Array.isArray(conflict.topPrototypes)).toBe(true);
    });

    it('should always have impossibleClauseIds as an array (never undefined)', () => {
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });
      expect(Array.isArray(conflict.impossibleClauseIds)).toBe(true);
    });

    it('should always have suggestedFixes as an array (never undefined)', () => {
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });
      expect(Array.isArray(conflict.suggestedFixes)).toBe(true);
    });
  });
});
