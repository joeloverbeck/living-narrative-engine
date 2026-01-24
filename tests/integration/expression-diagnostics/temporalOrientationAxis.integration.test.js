/**
 * @file Integration tests for temporal_orientation mood axis
 * Verifies temporal_orientation axis works correctly across Monte Carlo pipeline.
 * @see specs/temporal-orientation-axis.md
 * @see TEMORIAXI-007
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RandomStateGenerator, {
  MOOD_AXES,
} from '../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import { normalizeMoodAxes } from '../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('Temporal Orientation Axis Integration', () => {
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
    it('should include temporal_orientation as the 7th axis (after future_expectancy)', () => {
      expect(MOOD_AXES).toContain('temporal_orientation');
      expect(MOOD_AXES).toHaveLength(11);
      expect(MOOD_AXES[6]).toBe('temporal_orientation');
    });

    it('should have temporal_orientation positioned after future_expectancy', () => {
      const futureExpectancyIndex = MOOD_AXES.indexOf('future_expectancy');
      const temporalOrientationIndex = MOOD_AXES.indexOf('temporal_orientation');
      expect(temporalOrientationIndex).toBe(futureExpectancyIndex + 1);
    });
  });

  describe('State Generation Pipeline', () => {
    it('should generate states with temporal_orientation axis', () => {
      const state = randomStateGenerator.generate('uniform', 'static');

      expect(state.current.mood).toHaveProperty('temporal_orientation');
      expect(state.previous.mood).toHaveProperty('temporal_orientation');

      // Verify range [-100, 100]
      expect(state.current.mood.temporal_orientation).toBeGreaterThanOrEqual(
        -100
      );
      expect(state.current.mood.temporal_orientation).toBeLessThanOrEqual(100);

      // Verify integer type
      expect(Number.isInteger(state.current.mood.temporal_orientation)).toBe(
        true
      );
    });
  });

  describe('Normalization Pipeline', () => {
    it('should normalize temporal_orientation from [-100, 100] to [-1, 1]', () => {
      const mood = { temporal_orientation: 75 };
      const normalized = normalizeMoodAxes(mood);
      expect(normalized.temporal_orientation).toBeCloseTo(0.75, 6);
    });

    it('should normalize negative temporal_orientation correctly', () => {
      const mood = { temporal_orientation: -50 };
      const normalized = normalizeMoodAxes(mood);
      expect(normalized.temporal_orientation).toBeCloseTo(-0.5, 6);
    });

    it('should normalize extreme temporal_orientation values', () => {
      expect(
        normalizeMoodAxes({ temporal_orientation: 100 }).temporal_orientation
      ).toBeCloseTo(1.0, 6);
      expect(
        normalizeMoodAxes({ temporal_orientation: -100 }).temporal_orientation
      ).toBeCloseTo(-1.0, 6);
      expect(
        normalizeMoodAxes({ temporal_orientation: 0 }).temporal_orientation
      ).toBeCloseTo(0, 6);
    });

    it('should correctly represent present-focused (0) as normalized 0', () => {
      const mood = { temporal_orientation: 0 };
      const normalized = normalizeMoodAxes(mood);
      expect(normalized.temporal_orientation).toBe(0);
    });
  });

  describe('Sampling Distribution', () => {
    it('should produce varied temporal_orientation values across samples', () => {
      const samples = Array.from({ length: 100 }, () =>
        randomStateGenerator.generate('uniform', 'static')
      );

      const values = samples.map((s) => s.current.mood.temporal_orientation);
      const uniqueValues = new Set(values);

      expect(uniqueValues.size).toBeGreaterThan(50);
    });

    it('should produce gaussian-distributed temporal_orientation values centered near zero', () => {
      const samples = Array.from({ length: 1000 }, () =>
        randomStateGenerator.generate('gaussian', 'static')
      );

      const values = samples.map((s) => s.current.mood.temporal_orientation);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      // Gaussian distribution should cluster around 0 (present-focused)
      expect(mean).toBeGreaterThan(-20);
      expect(mean).toBeLessThan(20);
    });
  });

  describe('Dynamic Sampling', () => {
    it('should maintain temporal coherence for temporal_orientation', () => {
      const state = randomStateGenerator.generate('uniform', 'dynamic');

      expect(Number.isInteger(state.current.mood.temporal_orientation)).toBe(
        true
      );
      expect(Number.isInteger(state.previous.mood.temporal_orientation)).toBe(
        true
      );

      expect(state.current.mood.temporal_orientation).toBeGreaterThanOrEqual(
        -100
      );
      expect(state.current.mood.temporal_orientation).toBeLessThanOrEqual(100);
    });

    it('should apply delta-based changes in dynamic mode', () => {
      const samples = Array.from({ length: 50 }, () =>
        randomStateGenerator.generate('gaussian', 'dynamic')
      );

      const hasDifferences = samples.some(
        (s) =>
          s.current.mood.temporal_orientation !==
          s.previous.mood.temporal_orientation
      );

      expect(hasDifferences).toBe(true);
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should produce valid normalized context with temporal_orientation', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);

      const context = {
        moodAxes: normalizedMood,
      };

      expect(context.moodAxes.temporal_orientation).toBeDefined();
      expect(context.moodAxes.temporal_orientation).toBeGreaterThanOrEqual(-1);
      expect(context.moodAxes.temporal_orientation).toBeLessThanOrEqual(1);
    });

    it('should maintain 11-axis count through pipeline', () => {
      const state = randomStateGenerator.generate('uniform', 'static');
      const normalizedMood = normalizeMoodAxes(state.current.mood);

      expect(Object.keys(state.current.mood)).toHaveLength(11);
      expect(Object.keys(normalizedMood)).toHaveLength(11);
    });
  });

  describe('Semantic Validation', () => {
    it('positive values should represent future-focused states', () => {
      // +100 = strongly future-focused (planning, anticipation)
      const futureFocused = { temporal_orientation: 100 };
      const normalized = normalizeMoodAxes(futureFocused);
      expect(normalized.temporal_orientation).toBe(1);
    });

    it('negative values should represent past-focused states', () => {
      // -100 = strongly past-focused (reminiscence, nostalgia)
      const pastFocused = { temporal_orientation: -100 };
      const normalized = normalizeMoodAxes(pastFocused);
      expect(normalized.temporal_orientation).toBe(-1);
    });

    it('zero should represent present-focused states', () => {
      // 0 = present-focused (flow, mindfulness)
      const presentFocused = { temporal_orientation: 0 };
      const normalized = normalizeMoodAxes(presentFocused);
      expect(normalized.temporal_orientation).toBe(0);
    });
  });
});
