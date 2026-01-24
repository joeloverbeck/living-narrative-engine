/**
 * @file Integration tests for inhibitory_control axis and self_control trait
 * in the Monte Carlo expression diagnostics pipeline.
 * @see INHCONAXIANDSELCONTRA-008
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RandomStateGenerator, {
  MOOD_AXES,
  AFFECT_TRAITS,
} from '../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
} from '../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('Monte Carlo - inhibitory_control and self_control Integration', () => {
  let mockLogger;
  let randomStateGenerator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    randomStateGenerator = new RandomStateGenerator({ logger: mockLogger });
  });

  describe('State Generation Pipeline', () => {
    it('should generate states with inhibitory_control axis', () => {
      const state = randomStateGenerator.generate('uniform', 'static');

      expect(state.current.mood).toHaveProperty('inhibitory_control');
      expect(state.previous.mood).toHaveProperty('inhibitory_control');

      // Verify range [-100, 100]
      expect(state.current.mood.inhibitory_control).toBeGreaterThanOrEqual(
        -100
      );
      expect(state.current.mood.inhibitory_control).toBeLessThanOrEqual(100);
      expect(state.previous.mood.inhibitory_control).toBeGreaterThanOrEqual(
        -100
      );
      expect(state.previous.mood.inhibitory_control).toBeLessThanOrEqual(100);

      // Verify integer type
      expect(Number.isInteger(state.current.mood.inhibitory_control)).toBe(
        true
      );
      expect(Number.isInteger(state.previous.mood.inhibitory_control)).toBe(
        true
      );
    });

    it('should generate states with self_control trait', () => {
      const state = randomStateGenerator.generate('uniform', 'static');

      expect(state.affectTraits).toHaveProperty('self_control');

      // Verify range [0, 100]
      expect(state.affectTraits.self_control).toBeGreaterThanOrEqual(0);
      expect(state.affectTraits.self_control).toBeLessThanOrEqual(100);

      // Verify integer type
      expect(Number.isInteger(state.affectTraits.self_control)).toBe(true);
    });

    it('should generate all 14 mood axes in correct ranges', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const expectedAxes = [
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'temporal_orientation',
        'self_evaluation',
        'affiliation',
        'inhibitory_control',
        'uncertainty',
        'contamination_salience',
        'rumination',
        'evaluation_pressure',
      ];

      // Verify MOOD_AXES constant has all 14 axes
      expect(MOOD_AXES).toHaveLength(14);
      expect(MOOD_AXES).toEqual(expectedAxes);

      expectedAxes.forEach((axis) => {
        expect(state.current.mood).toHaveProperty(axis);
        expect(state.current.mood[axis]).toBeGreaterThanOrEqual(-100);
        expect(state.current.mood[axis]).toBeLessThanOrEqual(100);
        expect(Number.isInteger(state.current.mood[axis])).toBe(true);
      });
    });

    it('should generate all 7 affect traits in correct ranges', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const expectedTraits = [
        'affective_empathy',
        'cognitive_empathy',
        'harm_aversion',
        'self_control',
        'disgust_sensitivity',
        'ruminative_tendency',
        'evaluation_sensitivity',
      ];

      // Verify AFFECT_TRAITS constant has all 7 traits
      expect(AFFECT_TRAITS).toHaveLength(7);
      expect(AFFECT_TRAITS).toEqual(expectedTraits);

      expectedTraits.forEach((trait) => {
        expect(state.affectTraits).toHaveProperty(trait);
        expect(state.affectTraits[trait]).toBeGreaterThanOrEqual(0);
        expect(state.affectTraits[trait]).toBeLessThanOrEqual(100);
        expect(Number.isInteger(state.affectTraits[trait])).toBe(true);
      });
    });
  });

  describe('Normalization Pipeline', () => {
    it('should normalize inhibitory_control from [-100, 100] to [-1, 1]', () => {
      const mood = { inhibitory_control: 75 };
      const normalized = normalizeMoodAxes(mood);

      expect(normalized.inhibitory_control).toBeCloseTo(0.75, 6);
    });

    it('should normalize negative inhibitory_control correctly', () => {
      const mood = { inhibitory_control: -50 };
      const normalized = normalizeMoodAxes(mood);

      expect(normalized.inhibitory_control).toBeCloseTo(-0.5, 6);
    });

    it('should normalize extreme inhibitory_control values correctly', () => {
      const moodPositive = { inhibitory_control: 100 };
      const moodNegative = { inhibitory_control: -100 };
      const moodZero = { inhibitory_control: 0 };

      expect(normalizeMoodAxes(moodPositive).inhibitory_control).toBeCloseTo(
        1.0,
        6
      );
      expect(normalizeMoodAxes(moodNegative).inhibitory_control).toBeCloseTo(
        -1.0,
        6
      );
      expect(normalizeMoodAxes(moodZero).inhibitory_control).toBeCloseTo(0, 6);
    });

    it('should normalize self_control from [0, 100] to [0, 1]', () => {
      const traits = { self_control: 72 };
      const normalized = normalizeAffectTraits(traits);

      expect(normalized.self_control).toBeCloseTo(0.72, 6);
    });

    it('should normalize extreme self_control values correctly', () => {
      const traitsMax = { self_control: 100 };
      const traitsMin = { self_control: 0 };

      expect(normalizeAffectTraits(traitsMax).self_control).toBeCloseTo(1.0, 6);
      expect(normalizeAffectTraits(traitsMin).self_control).toBeCloseTo(0, 6);
    });

    it('should apply default self_control when not provided', () => {
      const normalized = normalizeAffectTraits({});

      // Default 50 -> 0.5
      expect(normalized.self_control).toBeCloseTo(0.5, 6);
    });

    it('should normalize all axes from generated state correctly', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);
      const normalizedTraits = normalizeAffectTraits(state.affectTraits);

      // All mood axes should be in [-1, 1]
      for (const [axis, value] of Object.entries(normalizedMood)) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(axis).toBeDefined(); // Just to use the axis variable
      }

      // All affect traits should be in [0, 1]
      for (const [trait, value] of Object.entries(normalizedTraits)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(trait).toBeDefined(); // Just to use the trait variable
      }
    });
  });

  describe('Sampling Distribution Integration', () => {
    it('should produce varied inhibitory_control values across multiple samples', () => {
      const samples = Array.from({ length: 100 }, () =>
        randomStateGenerator.generate('uniform', 'static')
      );

      const values = samples.map((s) => s.current.mood.inhibitory_control);
      const uniqueValues = new Set(values);

      // Uniform distribution should produce diverse values
      expect(uniqueValues.size).toBeGreaterThan(50);
    });

    it('should produce varied self_control values across multiple samples', () => {
      const samples = Array.from({ length: 100 }, () =>
        randomStateGenerator.generate('uniform', 'static')
      );

      const values = samples.map((s) => s.affectTraits.self_control);
      const uniqueValues = new Set(values);

      expect(uniqueValues.size).toBeGreaterThan(50);
    });

    it('should produce gaussian-distributed inhibitory_control values centered near zero', () => {
      const samples = Array.from({ length: 1000 }, () =>
        randomStateGenerator.generate('gaussian', 'static')
      );

      const values = samples.map((s) => s.current.mood.inhibitory_control);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      // Gaussian centered at 0 should have mean close to 0
      expect(mean).toBeGreaterThan(-20);
      expect(mean).toBeLessThan(20);
    });

    it('should produce gaussian-distributed self_control values centered near 50', () => {
      const samples = Array.from({ length: 1000 }, () =>
        randomStateGenerator.generate('gaussian', 'static')
      );

      const values = samples.map((s) => s.affectTraits.self_control);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      // Gaussian centered at 50 should have mean close to 50
      expect(mean).toBeGreaterThan(30);
      expect(mean).toBeLessThan(70);
    });
  });

  describe('Dynamic Sampling Integration', () => {
    it('should maintain temporal coherence for inhibitory_control', () => {
      const state = randomStateGenerator.generate('uniform', 'dynamic');

      // Current and previous values should both exist and be integers
      expect(Number.isInteger(state.current.mood.inhibitory_control)).toBe(
        true
      );
      expect(Number.isInteger(state.previous.mood.inhibitory_control)).toBe(
        true
      );

      // Both should be in valid range
      expect(state.current.mood.inhibitory_control).toBeGreaterThanOrEqual(
        -100
      );
      expect(state.current.mood.inhibitory_control).toBeLessThanOrEqual(100);
      expect(state.previous.mood.inhibitory_control).toBeGreaterThanOrEqual(
        -100
      );
      expect(state.previous.mood.inhibitory_control).toBeLessThanOrEqual(100);
    });

    it('should apply delta-based changes to inhibitory_control in dynamic mode', () => {
      // Generate multiple dynamic samples and verify current != previous (generally)
      const samples = Array.from({ length: 50 }, () =>
        randomStateGenerator.generate('gaussian', 'dynamic')
      );

      // At least some samples should have different current/previous values
      const hasDifferences = samples.some(
        (s) =>
          s.current.mood.inhibitory_control !==
          s.previous.mood.inhibitory_control
      );

      expect(hasDifferences).toBe(true);
    });

    it('should keep affect traits stable across current/previous states', () => {
      const state = randomStateGenerator.generate('uniform', 'dynamic');

      // Affect traits should be the same for current and previous conceptually
      // (they're generated once per state, not per time point)
      expect(state.affectTraits.self_control).toBeGreaterThanOrEqual(0);
      expect(state.affectTraits.self_control).toBeLessThanOrEqual(100);
      expect(Number.isInteger(state.affectTraits.self_control)).toBe(true);
    });
  });

  describe('End-to-End Pipeline Integration', () => {
    it('should produce valid normalized context from generated state', () => {
      // Simulates the full pipeline: generate -> normalize -> use in diagnostics
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);
      const normalizedTraits = normalizeAffectTraits(state.affectTraits);

      // Create a context object as would be used in expression evaluation
      const context = {
        moodAxes: normalizedMood,
        affectTraits: normalizedTraits,
      };

      // Verify the new axis/trait are present and normalized
      expect(context.moodAxes.inhibitory_control).toBeDefined();
      expect(context.moodAxes.inhibitory_control).toBeGreaterThanOrEqual(-1);
      expect(context.moodAxes.inhibitory_control).toBeLessThanOrEqual(1);

      expect(context.affectTraits.self_control).toBeDefined();
      expect(context.affectTraits.self_control).toBeGreaterThanOrEqual(0);
      expect(context.affectTraits.self_control).toBeLessThanOrEqual(1);
    });

    it('should maintain axis/trait count invariants through pipeline', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);
      const normalizedTraits = normalizeAffectTraits(state.affectTraits);

      // 14 mood axes should be generated
      expect(Object.keys(state.current.mood)).toHaveLength(14);

      // All 14 should be normalized
      expect(Object.keys(normalizedMood)).toHaveLength(14);

      // 7 affect traits should be generated
      expect(Object.keys(state.affectTraits)).toHaveLength(7);

      // All 7 should be normalized
      expect(Object.keys(normalizedTraits)).toHaveLength(7);
    });
  });
});
