/**
 * @file Unit tests for GateConstraint validation methods.
 * @description Tests gate threshold value validation against axis type ranges.
 * Ensures modders get clear errors when specifying invalid gate thresholds.
 * @see src/expressionDiagnostics/models/GateConstraint.js
 */

import { describe, it, expect } from '@jest/globals';
import GateConstraint from '../../../../src/expressionDiagnostics/models/GateConstraint.js';

describe('GateConstraint Validation', () => {
  describe('getAxisType()', () => {
    describe('affect traits [0..1]', () => {
      it('identifies affective_empathy as affect_trait', () => {
        const constraint = GateConstraint.parse('affective_empathy >= 0.25');
        expect(constraint.getAxisType()).toBe('affect_trait');
      });

      it('identifies cognitive_empathy as affect_trait', () => {
        const constraint = GateConstraint.parse('cognitive_empathy >= 0.10');
        expect(constraint.getAxisType()).toBe('affect_trait');
      });

      it('identifies harm_aversion as affect_trait', () => {
        const constraint = GateConstraint.parse('harm_aversion <= 0.20');
        expect(constraint.getAxisType()).toBe('affect_trait');
      });

      it('identifies self_control as affect_trait', () => {
        const constraint = GateConstraint.parse('self_control >= 0.50');
        expect(constraint.getAxisType()).toBe('affect_trait');
      });
    });

    describe('mood axes [-1..1]', () => {
      it('identifies valence as mood', () => {
        const constraint = GateConstraint.parse('valence >= 0.20');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies arousal as mood', () => {
        const constraint = GateConstraint.parse('arousal >= 0.10');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies threat as mood', () => {
        const constraint = GateConstraint.parse('threat <= 0.30');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies engagement as mood', () => {
        const constraint = GateConstraint.parse('engagement >= 0.25');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies agency_control as mood', () => {
        const constraint = GateConstraint.parse('agency_control >= 0.10');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies self_evaluation as mood', () => {
        const constraint = GateConstraint.parse('self_evaluation <= -0.10');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies affiliation as mood', () => {
        const constraint = GateConstraint.parse('affiliation >= 0.30');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies inhibitory_control as mood', () => {
        const constraint = GateConstraint.parse('inhibitory_control >= 0.20');
        expect(constraint.getAxisType()).toBe('mood');
      });

      it('identifies future_expectancy as mood', () => {
        const constraint = GateConstraint.parse('future_expectancy >= -0.50');
        expect(constraint.getAxisType()).toBe('mood');
      });
    });

    describe('sexual axes [0..1]', () => {
      it('identifies sexual_arousal as sexual', () => {
        const constraint = GateConstraint.parse('sexual_arousal >= 0.30');
        expect(constraint.getAxisType()).toBe('sexual');
      });

      it('identifies sex_excitation as sexual', () => {
        const constraint = GateConstraint.parse('sex_excitation >= 0.20');
        expect(constraint.getAxisType()).toBe('sexual');
      });

      it('identifies sex_inhibition as sexual', () => {
        const constraint = GateConstraint.parse('sex_inhibition <= 0.50');
        expect(constraint.getAxisType()).toBe('sexual');
      });

      it('identifies sexual_inhibition as sexual', () => {
        const constraint = GateConstraint.parse('sexual_inhibition <= 0.50');
        expect(constraint.getAxisType()).toBe('sexual');
      });

      it('identifies baseline_libido as sexual', () => {
        const constraint = GateConstraint.parse('baseline_libido >= 0.10');
        expect(constraint.getAxisType()).toBe('sexual');
      });
    });

    describe('intensity axes [0..1]', () => {
      it('identifies unknown axes as intensity (default)', () => {
        const constraint = GateConstraint.parse('some_unknown_axis >= 0.50');
        expect(constraint.getAxisType()).toBe('intensity');
      });
    });
  });

  describe('getValidRange()', () => {
    it('returns [0..1] for affect traits', () => {
      const constraint = GateConstraint.parse('self_control >= 0.25');
      expect(constraint.getValidRange()).toEqual({ min: 0, max: 1 });
    });

    it('returns [-1..1] for mood axes', () => {
      const constraint = GateConstraint.parse('valence >= -0.50');
      expect(constraint.getValidRange()).toEqual({ min: -1, max: 1 });
    });

    it('returns [0..1] for sexual axes', () => {
      const constraint = GateConstraint.parse('sexual_arousal >= 0.30');
      expect(constraint.getValidRange()).toEqual({ min: 0, max: 1 });
    });

    it('returns [0..1] for intensity axes', () => {
      const constraint = GateConstraint.parse('unknown_axis >= 0.50');
      expect(constraint.getValidRange()).toEqual({ min: 0, max: 1 });
    });
  });

  describe('validateValueRange()', () => {
    describe('valid affect trait gates', () => {
      it('accepts self_control >= 0.25 (within [0..1])', () => {
        const constraint = GateConstraint.parse('self_control >= 0.25');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts affective_empathy >= 0.0 (at minimum)', () => {
        const constraint = GateConstraint.parse('affective_empathy >= 0.0');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts harm_aversion <= 1.0 (at maximum)', () => {
        const constraint = GateConstraint.parse('harm_aversion <= 1.0');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts cognitive_empathy >= 0.50 (midrange)', () => {
        const constraint = GateConstraint.parse('cognitive_empathy >= 0.50');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });
    });

    describe('invalid affect trait gates - negative values', () => {
      it('rejects self_control <= -0.10 (below [0..1])', () => {
        const constraint = GateConstraint.parse('self_control <= -0.10');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('below minimum 0');
        expect(result.issue).toContain('affect_trait');
        expect(result.issue).toContain('self_control');
        expect(result.issue).toContain('normalized from [0..100] to [0..1]');
      });

      it('rejects affective_empathy >= -0.25 (below [0..1])', () => {
        const constraint = GateConstraint.parse('affective_empathy >= -0.25');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('below minimum 0');
      });

      it('rejects harm_aversion <= -0.001 (just below zero)', () => {
        const constraint = GateConstraint.parse('harm_aversion <= -0.001');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('below minimum 0');
      });
    });

    describe('invalid affect trait gates - exceeding maximum', () => {
      it('rejects affective_empathy >= 1.5 (exceeds [0..1])', () => {
        const constraint = GateConstraint.parse('affective_empathy >= 1.5');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('exceeds maximum 1');
        expect(result.issue).toContain('affect_trait');
        expect(result.issue).toContain('normalized from [0..100] to [0..1]');
      });

      it('rejects self_control >= 1.01 (just above max)', () => {
        const constraint = GateConstraint.parse('self_control >= 1.01');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('exceeds maximum 1');
      });
    });

    describe('valid mood axis gates - negative values allowed', () => {
      it('accepts valence >= -0.50 (within [-1..1])', () => {
        const constraint = GateConstraint.parse('valence >= -0.50');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts threat <= -0.30 (within [-1..1])', () => {
        const constraint = GateConstraint.parse('threat <= -0.30');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts self_evaluation <= -1.0 (at minimum)', () => {
        const constraint = GateConstraint.parse('self_evaluation <= -1.0');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts arousal >= 1.0 (at maximum)', () => {
        const constraint = GateConstraint.parse('arousal >= 1.0');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });
    });

    describe('invalid mood axis gates - exceeding range', () => {
      it('rejects valence >= 1.5 (exceeds [-1..1])', () => {
        const constraint = GateConstraint.parse('valence >= 1.5');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('exceeds maximum 1');
        expect(result.issue).toContain('mood');
      });

      it('rejects threat <= -1.5 (below [-1..1])', () => {
        const constraint = GateConstraint.parse('threat <= -1.5');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('below minimum -1');
        expect(result.issue).toContain('mood');
      });
    });

    describe('valid sexual axis gates', () => {
      it('accepts sexual_arousal >= 0.30 (within [0..1])', () => {
        const constraint = GateConstraint.parse('sexual_arousal >= 0.30');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });

      it('accepts sex_inhibition <= 0.50 (within [0..1])', () => {
        const constraint = GateConstraint.parse('sex_inhibition <= 0.50');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(true);
        expect(result.issue).toBeNull();
      });
    });

    describe('invalid sexual axis gates', () => {
      it('rejects sexual_arousal >= -0.10 (below [0..1])', () => {
        const constraint = GateConstraint.parse('sexual_arousal >= -0.10');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('below minimum 0');
        expect(result.issue).toContain('sexual');
      });

      it('rejects sex_excitation >= 1.2 (exceeds [0..1])', () => {
        const constraint = GateConstraint.parse('sex_excitation >= 1.2');
        const result = constraint.validateValueRange();
        expect(result.valid).toBe(false);
        expect(result.issue).toContain('exceeds maximum 1');
      });
    });
  });

  describe('parseAndValidate()', () => {
    describe('valid gates', () => {
      it('returns valid result for valid affect trait gate', () => {
        const result = GateConstraint.parseAndValidate('self_control >= 0.25');
        expect(result.constraint).toBeInstanceOf(GateConstraint);
        expect(result.validation.valid).toBe(true);
        expect(result.validation.issue).toBeNull();
      });

      it('returns valid result for valid mood gate with negative value', () => {
        const result = GateConstraint.parseAndValidate('valence >= -0.50');
        expect(result.constraint).toBeInstanceOf(GateConstraint);
        expect(result.validation.valid).toBe(true);
      });
    });

    describe('invalid gates', () => {
      it('returns invalid result for out-of-range affect trait gate', () => {
        const result = GateConstraint.parseAndValidate('self_control <= -0.10');
        expect(result.constraint).toBeInstanceOf(GateConstraint);
        expect(result.validation.valid).toBe(false);
        expect(result.validation.issue).toContain('below minimum 0');
      });

      it('does not throw by default for invalid gates', () => {
        expect(() => {
          GateConstraint.parseAndValidate('affective_empathy >= 1.5');
        }).not.toThrow();
      });

      it('throws when throwOnInvalid is true', () => {
        expect(() => {
          GateConstraint.parseAndValidate('self_control <= -0.10', {
            throwOnInvalid: true,
          });
        }).toThrow('Invalid gate "self_control <= -0.10"');
      });

      it('includes issue in thrown error message', () => {
        expect(() => {
          GateConstraint.parseAndValidate('affective_empathy >= 1.5', {
            throwOnInvalid: true,
          });
        }).toThrow('exceeds maximum 1');
      });
    });

    describe('parse errors (malformed gates)', () => {
      it('throws for malformed gate string', () => {
        expect(() => {
          GateConstraint.parseAndValidate('not a valid gate');
        }).toThrow('Cannot parse gate string');
      });

      it('throws for missing operator', () => {
        expect(() => {
          GateConstraint.parseAndValidate('self_control 0.25');
        }).toThrow('Cannot parse gate string');
      });
    });
  });

  describe('Real-world gate patterns from emotion_prototypes', () => {
    const realGates = [
      // Affect trait gates from actual prototypes
      { gate: 'affective_empathy >= 0.25', shouldBeValid: true },
      { gate: 'affective_empathy >= 0.15', shouldBeValid: true },
      { gate: 'affective_empathy >= 0.30', shouldBeValid: true },
      { gate: 'cognitive_empathy >= 0.10', shouldBeValid: true },
      { gate: 'cognitive_empathy >= 0.20', shouldBeValid: true },
      { gate: 'harm_aversion <= 0.20', shouldBeValid: true },
      // Mood gates that allow negative values
      { gate: 'valence >= -0.20', shouldBeValid: true },
      { gate: 'valence <= -0.10', shouldBeValid: true },
      { gate: 'valence >= 0.35', shouldBeValid: true },
      { gate: 'self_evaluation <= -0.10', shouldBeValid: true },
      { gate: 'threat <= 0.50', shouldBeValid: true },
      { gate: 'engagement >= 0.30', shouldBeValid: true },
      // Invalid patterns (should be caught)
      { gate: 'self_control <= -0.10', shouldBeValid: false },
      { gate: 'affective_empathy >= 1.5', shouldBeValid: false },
    ];

    it.each(realGates)(
      'validates "$gate" as $shouldBeValid',
      ({ gate, shouldBeValid }) => {
        const result = GateConstraint.parseAndValidate(gate);
        expect(result.validation.valid).toBe(shouldBeValid);
      }
    );
  });
});
