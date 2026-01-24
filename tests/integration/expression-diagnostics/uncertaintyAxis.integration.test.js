/**
 * @file Integration tests for uncertainty mood axis
 * Verifies uncertainty axis works correctly across Monte Carlo pipeline.
 * @see specs/uncertainty-mood-axis.md
 * @see UNCMOOAXI-007
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RandomStateGenerator, {
  MOOD_AXES,
} from '../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import { normalizeMoodAxes } from '../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('Uncertainty Axis Integration', () => {
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

  describe('MOOD_AXES Constant', () => {
    it('should include uncertainty as the 11th axis', () => {
      expect(MOOD_AXES).toContain('uncertainty');
      expect(MOOD_AXES).toHaveLength(14);
      expect(MOOD_AXES[10]).toBe('uncertainty');
    });
  });

  describe('State Generation Pipeline', () => {
    it('should generate states with uncertainty axis', () => {
      const state = randomStateGenerator.generate('uniform', 'static');

      expect(state.current.mood).toHaveProperty('uncertainty');
      expect(state.previous.mood).toHaveProperty('uncertainty');

      // Verify range [-100, 100]
      expect(state.current.mood.uncertainty).toBeGreaterThanOrEqual(-100);
      expect(state.current.mood.uncertainty).toBeLessThanOrEqual(100);

      // Verify integer type
      expect(Number.isInteger(state.current.mood.uncertainty)).toBe(true);
    });
  });

  describe('Normalization Pipeline', () => {
    it('should normalize uncertainty from [-100, 100] to [-1, 1]', () => {
      const mood = { uncertainty: 75 };
      const normalized = normalizeMoodAxes(mood);
      expect(normalized.uncertainty).toBeCloseTo(0.75, 6);
    });

    it('should normalize negative uncertainty correctly', () => {
      const mood = { uncertainty: -50 };
      const normalized = normalizeMoodAxes(mood);
      expect(normalized.uncertainty).toBeCloseTo(-0.5, 6);
    });

    it('should normalize extreme uncertainty values', () => {
      expect(normalizeMoodAxes({ uncertainty: 100 }).uncertainty).toBeCloseTo(
        1.0,
        6
      );
      expect(normalizeMoodAxes({ uncertainty: -100 }).uncertainty).toBeCloseTo(
        -1.0,
        6
      );
      expect(normalizeMoodAxes({ uncertainty: 0 }).uncertainty).toBeCloseTo(
        0,
        6
      );
    });
  });

  describe('Sampling Distribution', () => {
    it('should produce varied uncertainty values across samples', () => {
      const samples = Array.from({ length: 100 }, () =>
        randomStateGenerator.generate('uniform', 'static')
      );

      const values = samples.map((s) => s.current.mood.uncertainty);
      const uniqueValues = new Set(values);

      expect(uniqueValues.size).toBeGreaterThan(50);
    });

    it('should produce gaussian-distributed uncertainty values centered near zero', () => {
      const samples = Array.from({ length: 1000 }, () =>
        randomStateGenerator.generate('gaussian', 'static')
      );

      const values = samples.map((s) => s.current.mood.uncertainty);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      expect(mean).toBeGreaterThan(-20);
      expect(mean).toBeLessThan(20);
    });
  });

  describe('Dynamic Sampling', () => {
    it('should maintain temporal coherence for uncertainty', () => {
      const state = randomStateGenerator.generate('uniform', 'dynamic');

      expect(Number.isInteger(state.current.mood.uncertainty)).toBe(true);
      expect(Number.isInteger(state.previous.mood.uncertainty)).toBe(true);

      expect(state.current.mood.uncertainty).toBeGreaterThanOrEqual(-100);
      expect(state.current.mood.uncertainty).toBeLessThanOrEqual(100);
    });

    it('should apply delta-based changes in dynamic mode', () => {
      const samples = Array.from({ length: 50 }, () =>
        randomStateGenerator.generate('gaussian', 'dynamic')
      );

      const hasDifferences = samples.some(
        (s) => s.current.mood.uncertainty !== s.previous.mood.uncertainty
      );

      expect(hasDifferences).toBe(true);
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should produce valid normalized context with uncertainty', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);

      const context = {
        moodAxes: normalizedMood,
      };

      expect(context.moodAxes.uncertainty).toBeDefined();
      expect(context.moodAxes.uncertainty).toBeGreaterThanOrEqual(-1);
      expect(context.moodAxes.uncertainty).toBeLessThanOrEqual(1);
    });

    it('should maintain 14-axis count through pipeline', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);

      expect(Object.keys(state.current.mood)).toHaveLength(14);
      expect(Object.keys(normalizedMood)).toHaveLength(14);
    });
  });
});
