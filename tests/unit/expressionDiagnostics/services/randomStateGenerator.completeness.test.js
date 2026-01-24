/**
 * @file RandomStateGenerator Axis Completeness Tests (B3)
 *
 * Verifies that RandomStateGenerator emits ALL required axes
 * by cross-referencing with the canonical moodAffectConstants.
 * These tests catch issues where:
 * - New axes are added to constants but not to generation
 * - Axes are accidentally removed from generation
 * - Import paths diverge between generator and constants
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RandomStateGenerator from '../../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import {
  MOOD_AXES as CANONICAL_MOOD_AXES,
  AFFECT_TRAITS as CANONICAL_AFFECT_TRAITS,
} from '../../../../src/constants/moodAffectConstants.js';

describe('RandomStateGenerator - Axis Completeness (B3)', () => {
  let generator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    generator = new RandomStateGenerator({ logger: mockLogger });
  });

  describe('mood axis completeness', () => {
    it('should emit all 14 canonical mood axes in current state', () => {
      const state = generator.generate('uniform', 'static');

      // Verify count matches canonical definition
      const generatedAxes = Object.keys(state.current.mood);
      expect(generatedAxes.length).toBe(CANONICAL_MOOD_AXES.length);
      expect(generatedAxes.length).toBe(14);

      // Verify each canonical axis is present
      for (const axis of CANONICAL_MOOD_AXES) {
        expect(state.current.mood).toHaveProperty(
          axis,
          expect.any(Number)
        );
      }
    });

    it('should emit all 14 canonical mood axes in previous state', () => {
      const state = generator.generate('uniform', 'static');

      const generatedAxes = Object.keys(state.previous.mood);
      expect(generatedAxes.length).toBe(CANONICAL_MOOD_AXES.length);

      for (const axis of CANONICAL_MOOD_AXES) {
        expect(state.previous.mood).toHaveProperty(
          axis,
          expect.any(Number)
        );
      }
    });

    it('should not emit any extra non-canonical mood axes', () => {
      const state = generator.generate('uniform', 'static');
      const canonicalSet = new Set(CANONICAL_MOOD_AXES);

      for (const axis of Object.keys(state.current.mood)) {
        expect(canonicalSet.has(axis)).toBe(true);
      }
    });

    it('should emit mood axes with correct value ranges', () => {
      // Run multiple times to increase confidence
      for (let i = 0; i < 10; i++) {
        const state = generator.generate('uniform', 'static');

        for (const axis of CANONICAL_MOOD_AXES) {
          const value = state.current.mood[axis];
          expect(value).toBeGreaterThanOrEqual(-100);
          expect(value).toBeLessThanOrEqual(100);
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    });
  });

  describe('affect trait completeness', () => {
    it('should emit all 7 canonical affect traits', () => {
      const state = generator.generate('uniform', 'static');

      // Verify count matches canonical definition
      const generatedTraits = Object.keys(state.affectTraits);
      expect(generatedTraits.length).toBe(CANONICAL_AFFECT_TRAITS.length);
      expect(generatedTraits.length).toBe(7);

      // Verify each canonical trait is present
      for (const trait of CANONICAL_AFFECT_TRAITS) {
        expect(state.affectTraits).toHaveProperty(
          trait,
          expect.any(Number)
        );
      }
    });

    it('should not emit any extra non-canonical affect traits', () => {
      const state = generator.generate('uniform', 'static');
      const canonicalSet = new Set(CANONICAL_AFFECT_TRAITS);

      for (const trait of Object.keys(state.affectTraits)) {
        expect(canonicalSet.has(trait)).toBe(true);
      }
    });

    it('should emit affect traits with correct value ranges', () => {
      // Run multiple times to increase confidence
      for (let i = 0; i < 10; i++) {
        const state = generator.generate('uniform', 'static');

        for (const trait of CANONICAL_AFFECT_TRAITS) {
          const value = state.affectTraits[trait];
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    });

    it('should include self_control in affect traits', () => {
      const state = generator.generate('uniform', 'static');
      expect(state.affectTraits).toHaveProperty('self_control');
      expect(CANONICAL_AFFECT_TRAITS).toContain('self_control');
    });
  });

  describe('sexual axis completeness', () => {
    const EXPECTED_SEXUAL_AXES = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
    ];

    it('should emit all sexual axes in current state', () => {
      const state = generator.generate('uniform', 'static');

      for (const axis of EXPECTED_SEXUAL_AXES) {
        expect(state.current.sexual).toHaveProperty(
          axis,
          expect.any(Number)
        );
      }
    });

    it('should emit all sexual axes in previous state', () => {
      const state = generator.generate('uniform', 'static');

      for (const axis of EXPECTED_SEXUAL_AXES) {
        expect(state.previous.sexual).toHaveProperty(
          axis,
          expect.any(Number)
        );
      }
    });

    it('should emit sexual axes with correct value ranges', () => {
      const state = generator.generate('uniform', 'static');

      // sex_excitation: 0-100
      expect(state.current.sexual.sex_excitation).toBeGreaterThanOrEqual(0);
      expect(state.current.sexual.sex_excitation).toBeLessThanOrEqual(100);

      // sex_inhibition: 0-100
      expect(state.current.sexual.sex_inhibition).toBeGreaterThanOrEqual(0);
      expect(state.current.sexual.sex_inhibition).toBeLessThanOrEqual(100);

      // baseline_libido: -50 to 50
      expect(state.current.sexual.baseline_libido).toBeGreaterThanOrEqual(-50);
      expect(state.current.sexual.baseline_libido).toBeLessThanOrEqual(50);
    });
  });

  describe('distribution mode completeness', () => {
    it('should emit all axes in uniform distribution mode', () => {
      const state = generator.generate('uniform', 'static');

      expect(Object.keys(state.current.mood).length).toBe(14);
      expect(Object.keys(state.affectTraits).length).toBe(7);
    });

    it('should emit all axes in gaussian distribution mode', () => {
      const state = generator.generate('gaussian', 'static');

      expect(Object.keys(state.current.mood).length).toBe(14);
      expect(Object.keys(state.affectTraits).length).toBe(7);
    });

    it('should emit all axes in dynamic sampling mode', () => {
      const state = generator.generate('uniform', 'dynamic');

      expect(Object.keys(state.current.mood).length).toBe(14);
      expect(Object.keys(state.affectTraits).length).toBe(7);
    });
  });

  describe('critical axis presence (regression)', () => {
    it('should always include inhibitory_control (previously missing bug)', () => {
      // This is a regression test for the bug where inhibitory_control
      // was missing from MOOD_AXES, causing prototype intensity to be crushed
      for (let i = 0; i < 5; i++) {
        const state = generator.generate('uniform', 'static');
        expect(state.current.mood).toHaveProperty('inhibitory_control');
        expect(state.previous.mood).toHaveProperty('inhibitory_control');
      }
    });

    it('should always include self_control in affect traits', () => {
      // Regression test ensuring self_control is always present
      for (let i = 0; i < 5; i++) {
        const state = generator.generate('uniform', 'static');
        expect(state.affectTraits).toHaveProperty('self_control');
      }
    });
  });
});
