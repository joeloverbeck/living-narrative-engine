/**
 * @file Unit tests for WitnessState model
 * @description Tests the data model for representing satisfying states that cause expressions to trigger.
 */

import { describe, it, expect } from '@jest/globals';
import WitnessState from '../../../../src/expressionDiagnostics/models/WitnessState.js';

/**
 * Creates a valid mood state object for testing
 *
 * @param {object} [overrides] - Values to override
 * @returns {object} Valid mood state
 */
function createValidMood(overrides = {}) {
  return {
    valence: 0,
    arousal: 0,
    agency_control: 0,
    threat: 0,
    engagement: 0,
    future_expectancy: 0,
    self_evaluation: 0,
    ...overrides,
  };
}

/**
 * Creates a valid sexual state object for testing
 *
 * @param {object} [overrides] - Values to override
 * @returns {object} Valid sexual state
 */
function createValidSexual(overrides = {}) {
  return {
    sex_excitation: 50,
    sex_inhibition: 50,
    baseline_libido: 0,
    ...overrides,
  };
}

describe('WitnessState Model', () => {
  describe('Constructor Validation', () => {
    it('should throw if mood is missing', () => {
      expect(
        () =>
          new WitnessState({
            sexual: createValidSexual(),
          })
      ).toThrow('WitnessState requires mood object');
    });

    it('should throw if mood is null', () => {
      expect(
        () =>
          new WitnessState({
            mood: null,
            sexual: createValidSexual(),
          })
      ).toThrow('WitnessState requires mood object');
    });

    it('should throw if sexual is missing', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
          })
      ).toThrow('WitnessState requires sexual object');
    });

    it('should throw if sexual is null', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: null,
          })
      ).toThrow('WitnessState requires sexual object');
    });

    it('should throw if mood axis is out of range (too low)', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood({ valence: -101 }),
            sexual: createValidSexual(),
          })
      ).toThrow('Mood axis "valence" must be in range [-100, 100], got -101');
    });

    it('should throw if mood axis is out of range (too high)', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood({ threat: 101 }),
            sexual: createValidSexual(),
          })
      ).toThrow('Mood axis "threat" must be in range [-100, 100], got 101');
    });

    it('should throw if sexual axis sex_excitation is out of range', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: createValidSexual({ sex_excitation: -1 }),
          })
      ).toThrow(
        'Sexual axis "sex_excitation" must be in range [0, 100], got -1'
      );
    });

    it('should throw if sexual axis sex_inhibition is out of range', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: createValidSexual({ sex_inhibition: 101 }),
          })
      ).toThrow(
        'Sexual axis "sex_inhibition" must be in range [0, 100], got 101'
      );
    });

    it('should throw if baseline_libido is below -50', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: createValidSexual({ baseline_libido: -51 }),
          })
      ).toThrow(
        'Sexual axis "baseline_libido" must be in range [-50, 50], got -51'
      );
    });

    it('should throw if baseline_libido is above 50', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: createValidSexual({ baseline_libido: 51 }),
          })
      ).toThrow(
        'Sexual axis "baseline_libido" must be in range [-50, 50], got 51'
      );
    });

    it('should throw if mood axis is NaN', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood({ arousal: NaN }),
            sexual: createValidSexual(),
          })
      ).toThrow('Mood axis "arousal" must be a number');
    });

    it('should throw if sexual axis is NaN', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: createValidSexual({ sex_excitation: NaN }),
          })
      ).toThrow('Sexual axis "sex_excitation" must be a number');
    });

    it('should throw if mood axis is not a number', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood({ engagement: 'high' }),
            sexual: createValidSexual(),
          })
      ).toThrow('Mood axis "engagement" must be a number');
    });

    it('should throw if sexual axis is not a number', () => {
      expect(
        () =>
          new WitnessState({
            mood: createValidMood(),
            sexual: createValidSexual({ sex_inhibition: 'low' }),
          })
      ).toThrow('Sexual axis "sex_inhibition" must be a number');
    });

    it('should accept valid mood and sexual state', () => {
      const mood = createValidMood({ valence: 50, threat: -30 });
      const sexual = createValidSexual({
        sex_excitation: 70,
        baseline_libido: -25,
      });

      expect(() => new WitnessState({ mood, sexual })).not.toThrow();
    });

    it('should accept boundary values for mood axes', () => {
      const mood = createValidMood({
        valence: -100,
        arousal: 100,
        agency_control: -100,
        threat: 100,
        engagement: -100,
        future_expectancy: 100,
        self_evaluation: -100,
      });

      expect(
        () => new WitnessState({ mood, sexual: createValidSexual() })
      ).not.toThrow();
    });

    it('should accept boundary values for sexual axes', () => {
      const sexual = {
        sex_excitation: 0,
        sex_inhibition: 100,
        baseline_libido: -50,
      };

      expect(
        () => new WitnessState({ mood: createValidMood(), sexual })
      ).not.toThrow();
    });

    it('should use default values for optional parameters', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      expect(state.fitness).toBe(1);
      expect(state.isExact).toBe(true);
      expect(state.expressionId).toBeNull();
    });

    it('should accept custom optional parameters', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
        fitness: 0.85,
        isExact: false,
        expressionId: 'test:expression1',
      });

      expect(state.fitness).toBe(0.85);
      expect(state.isExact).toBe(false);
      expect(state.expressionId).toBe('test:expression1');
    });
  });

  describe('Getters', () => {
    it('mood getter should return copy, not reference', () => {
      const originalMood = createValidMood({ valence: 42 });
      const state = new WitnessState({
        mood: originalMood,
        sexual: createValidSexual(),
      });

      const retrievedMood = state.mood;
      retrievedMood.valence = 999;

      expect(state.mood.valence).toBe(42);
    });

    it('sexual getter should return copy, not reference', () => {
      const originalSexual = createValidSexual({ sex_excitation: 75 });
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: originalSexual,
      });

      const retrievedSexual = state.sexual;
      retrievedSexual.sex_excitation = 999;

      expect(state.sexual.sex_excitation).toBe(75);
    });
  });

  describe('isWitness Property', () => {
    it('should return true when isExact and fitness=1', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
        isExact: true,
        fitness: 1,
      });

      expect(state.isWitness).toBe(true);
    });

    it('should return false when isExact=false', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
        isExact: false,
        fitness: 1,
      });

      expect(state.isWitness).toBe(false);
    });

    it('should return false when fitness<1', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
        isExact: true,
        fitness: 0.99,
      });

      expect(state.isWitness).toBe(false);
    });

    it('should return false when both isExact=false and fitness<1', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
        isExact: false,
        fitness: 0.5,
      });

      expect(state.isWitness).toBe(false);
    });
  });

  describe('getMoodAxis()', () => {
    it('should return correct value for existing axis', () => {
      const state = new WitnessState({
        mood: createValidMood({ valence: 42, threat: -30 }),
        sexual: createValidSexual(),
      });

      expect(state.getMoodAxis('valence')).toBe(42);
      expect(state.getMoodAxis('threat')).toBe(-30);
    });

    it('should return undefined for non-existent axis', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      expect(state.getMoodAxis('nonexistent')).toBeUndefined();
    });
  });

  describe('getSexualAxis()', () => {
    it('should return correct value for existing axis', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual({
          sex_excitation: 80,
          baseline_libido: -25,
        }),
      });

      expect(state.getSexualAxis('sex_excitation')).toBe(80);
      expect(state.getSexualAxis('baseline_libido')).toBe(-25);
    });

    it('should return undefined for non-existent axis', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      expect(state.getSexualAxis('nonexistent')).toBeUndefined();
    });
  });

  describe('withChanges()', () => {
    it('should create new instance with modified mood values', () => {
      const original = new WitnessState({
        mood: createValidMood({ valence: 10 }),
        sexual: createValidSexual(),
      });

      const modified = original.withChanges({
        mood: { valence: 50 },
      });

      expect(modified).not.toBe(original);
      expect(modified.mood.valence).toBe(50);
      expect(original.mood.valence).toBe(10);
    });

    it('should create new instance with modified sexual values', () => {
      const original = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual({ sex_excitation: 30 }),
      });

      const modified = original.withChanges({
        sexual: { sex_excitation: 80 },
      });

      expect(modified).not.toBe(original);
      expect(modified.sexual.sex_excitation).toBe(80);
      expect(original.sexual.sex_excitation).toBe(30);
    });

    it('should preserve unchanged values', () => {
      const original = new WitnessState({
        mood: createValidMood({ valence: 10, arousal: 20 }),
        sexual: createValidSexual(),
        fitness: 0.8,
        isExact: false,
        expressionId: 'test:expr',
      });

      const modified = original.withChanges({
        mood: { valence: 50 },
      });

      expect(modified.mood.arousal).toBe(20);
      expect(modified.fitness).toBe(0.8);
      expect(modified.isExact).toBe(false);
      expect(modified.expressionId).toBe('test:expr');
    });

    it('should allow changing fitness, isExact, and expressionId', () => {
      const original = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      const modified = original.withChanges({
        fitness: 0.5,
        isExact: false,
        expressionId: 'new:expression',
      });

      expect(modified.fitness).toBe(0.5);
      expect(modified.isExact).toBe(false);
      expect(modified.expressionId).toBe('new:expression');
    });
  });

  describe('toDisplayString()', () => {
    it('should format mood and sexual values correctly', () => {
      const state = new WitnessState({
        mood: createValidMood({ valence: 42.5, threat: -15.123 }),
        sexual: createValidSexual({ sex_excitation: 75.999 }),
      });

      const display = state.toDisplayString();

      expect(display).toContain('Mood:');
      expect(display).toContain('Sexual:');
      expect(display).toContain('valence: 42.5');
      expect(display).toContain('threat: -15.1');
      expect(display).toContain('sex_excitation: 76.0');
    });

    it('should include all 7 mood axes', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      const display = state.toDisplayString();

      expect(display).toContain('valence');
      expect(display).toContain('arousal');
      expect(display).toContain('agency_control');
      expect(display).toContain('threat');
      expect(display).toContain('engagement');
      expect(display).toContain('future_expectancy');
      expect(display).toContain('self_evaluation');
    });

    it('should include all 3 sexual axes', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      const display = state.toDisplayString();

      expect(display).toContain('sex_excitation');
      expect(display).toContain('sex_inhibition');
      expect(display).toContain('baseline_libido');
    });
  });

  describe('toJSON()', () => {
    it('should include all fields', () => {
      const state = new WitnessState({
        mood: createValidMood({ valence: 25 }),
        sexual: createValidSexual({ sex_excitation: 60 }),
        fitness: 0.9,
        isExact: false,
        expressionId: 'test:expr',
      });

      const json = state.toJSON();

      expect(json).toHaveProperty('mood');
      expect(json).toHaveProperty('sexual');
      expect(json).toHaveProperty('fitness', 0.9);
      expect(json).toHaveProperty('isExact', false);
      expect(json).toHaveProperty('expressionId', 'test:expr');
      expect(json.mood.valence).toBe(25);
      expect(json.sexual.sex_excitation).toBe(60);
    });

    it('should return copies of mood and sexual (immutability)', () => {
      const state = new WitnessState({
        mood: createValidMood({ valence: 10 }),
        sexual: createValidSexual(),
      });

      const json = state.toJSON();
      json.mood.valence = 999;

      expect(state.mood.valence).toBe(10);
    });
  });

  describe('toClipboardJSON()', () => {
    it('should return valid JSON string', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      const jsonString = state.toClipboardJSON();

      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it('should only include mood and sexual (compact format)', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
        fitness: 0.5,
        isExact: false,
        expressionId: 'test:expr',
      });

      const parsed = JSON.parse(state.toClipboardJSON());

      expect(parsed).toHaveProperty('mood');
      expect(parsed).toHaveProperty('sexual');
      expect(parsed).not.toHaveProperty('fitness');
      expect(parsed).not.toHaveProperty('isExact');
      expect(parsed).not.toHaveProperty('expressionId');
    });

    it('should be formatted with indentation', () => {
      const state = new WitnessState({
        mood: createValidMood(),
        sexual: createValidSexual(),
      });

      const jsonString = state.toClipboardJSON();

      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');
    });
  });

  describe('fromJSON()', () => {
    it('should reconstruct state correctly', () => {
      const original = new WitnessState({
        mood: createValidMood({ valence: 42, threat: -20 }),
        sexual: createValidSexual({
          sex_excitation: 80,
          baseline_libido: -30,
        }),
        fitness: 0.75,
        isExact: false,
        expressionId: 'test:reconstructed',
      });

      const json = original.toJSON();
      const reconstructed = WitnessState.fromJSON(json);

      expect(reconstructed.mood.valence).toBe(42);
      expect(reconstructed.mood.threat).toBe(-20);
      expect(reconstructed.sexual.sex_excitation).toBe(80);
      expect(reconstructed.sexual.baseline_libido).toBe(-30);
      expect(reconstructed.fitness).toBe(0.75);
      expect(reconstructed.isExact).toBe(false);
      expect(reconstructed.expressionId).toBe('test:reconstructed');
    });

    it('should use defaults for missing optional fields', () => {
      const json = {
        mood: createValidMood(),
        sexual: createValidSexual(),
      };

      const state = WitnessState.fromJSON(json);

      expect(state.fitness).toBe(1);
      expect(state.isExact).toBe(true);
      expect(state.expressionId).toBeNull();
    });

    it('should roundtrip correctly (fromJSON(toJSON()))', () => {
      const original = new WitnessState({
        mood: createValidMood({ valence: 55, arousal: -33 }),
        sexual: createValidSexual({ baseline_libido: 25 }),
        fitness: 0.88,
        isExact: true,
        expressionId: 'roundtrip:test',
      });

      const roundtripped = WitnessState.fromJSON(original.toJSON());

      expect(roundtripped.toJSON()).toEqual(original.toJSON());
    });
  });

  describe('createRandom()', () => {
    it('should return valid state', () => {
      const state = WitnessState.createRandom();

      expect(state).toBeInstanceOf(WitnessState);
      expect(state.mood).toBeDefined();
      expect(state.sexual).toBeDefined();
    });

    it('should generate values within valid mood range', () => {
      for (let i = 0; i < 10; i++) {
        const state = WitnessState.createRandom();
        const mood = state.mood;

        for (const axis of WitnessState.MOOD_AXES) {
          expect(mood[axis]).toBeGreaterThanOrEqual(-100);
          expect(mood[axis]).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should generate values within valid sexual ranges (per-axis)', () => {
      for (let i = 0; i < 10; i++) {
        const state = WitnessState.createRandom();
        const sexual = state.sexual;

        expect(sexual.sex_excitation).toBeGreaterThanOrEqual(0);
        expect(sexual.sex_excitation).toBeLessThanOrEqual(100);
        expect(sexual.sex_inhibition).toBeGreaterThanOrEqual(0);
        expect(sexual.sex_inhibition).toBeLessThanOrEqual(100);
        expect(sexual.baseline_libido).toBeGreaterThanOrEqual(-50);
        expect(sexual.baseline_libido).toBeLessThanOrEqual(50);
      }
    });

    it('should set fitness to 0 and isExact to false', () => {
      const state = WitnessState.createRandom();

      expect(state.fitness).toBe(0);
      expect(state.isExact).toBe(false);
    });
  });

  describe('createNeutral()', () => {
    it('should return state with all mood axes at 0', () => {
      const state = WitnessState.createNeutral();
      const mood = state.mood;

      for (const axis of WitnessState.MOOD_AXES) {
        expect(mood[axis]).toBe(0);
      }
    });

    it('should return state with sexual axes at middle of their ranges', () => {
      const state = WitnessState.createNeutral();
      const sexual = state.sexual;

      expect(sexual.sex_excitation).toBe(50);
      expect(sexual.sex_inhibition).toBe(50);
      expect(sexual.baseline_libido).toBe(0);
    });

    it('should set fitness to 0 and isExact to false', () => {
      const state = WitnessState.createNeutral();

      expect(state.fitness).toBe(0);
      expect(state.isExact).toBe(false);
    });
  });

  describe('Static Constants', () => {
    it('MOOD_AXES should be frozen', () => {
      expect(Object.isFrozen(WitnessState.MOOD_AXES)).toBe(true);
    });

    it('SEXUAL_AXES should be frozen', () => {
      expect(Object.isFrozen(WitnessState.SEXUAL_AXES)).toBe(true);
    });

    it('MOOD_RANGE should be frozen', () => {
      expect(Object.isFrozen(WitnessState.MOOD_RANGE)).toBe(true);
    });

    it('SEXUAL_RANGES should be frozen', () => {
      expect(Object.isFrozen(WitnessState.SEXUAL_RANGES)).toBe(true);
    });

    it('MOOD_AXES should contain all 7 axes', () => {
      expect(WitnessState.MOOD_AXES).toHaveLength(7);
      expect(WitnessState.MOOD_AXES).toContain('valence');
      expect(WitnessState.MOOD_AXES).toContain('arousal');
      expect(WitnessState.MOOD_AXES).toContain('agency_control');
      expect(WitnessState.MOOD_AXES).toContain('threat');
      expect(WitnessState.MOOD_AXES).toContain('engagement');
      expect(WitnessState.MOOD_AXES).toContain('future_expectancy');
      expect(WitnessState.MOOD_AXES).toContain('self_evaluation');
    });

    it('SEXUAL_AXES should contain all 3 axes', () => {
      expect(WitnessState.SEXUAL_AXES).toHaveLength(3);
      expect(WitnessState.SEXUAL_AXES).toContain('sex_excitation');
      expect(WitnessState.SEXUAL_AXES).toContain('sex_inhibition');
      expect(WitnessState.SEXUAL_AXES).toContain('baseline_libido');
    });

    it('MOOD_RANGE should be [-100, 100]', () => {
      expect(WitnessState.MOOD_RANGE.min).toBe(-100);
      expect(WitnessState.MOOD_RANGE.max).toBe(100);
    });

    it('SEXUAL_RANGES should have correct per-axis ranges', () => {
      expect(WitnessState.SEXUAL_RANGES.sex_excitation).toEqual({
        min: 0,
        max: 100,
      });
      expect(WitnessState.SEXUAL_RANGES.sex_inhibition).toEqual({
        min: 0,
        max: 100,
      });
      expect(WitnessState.SEXUAL_RANGES.baseline_libido).toEqual({
        min: -50,
        max: 50,
      });
    });
  });
});
