/**
 * @file Unit tests for RandomStateGenerator service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import RandomStateGenerator, {
  MOOD_AXES,
  AFFECT_TRAITS,
} from '../../../../src/expressionDiagnostics/services/RandomStateGenerator.js';

describe('RandomStateGenerator', () => {
  let mockLogger;
  let generator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    generator = new RandomStateGenerator({ logger: mockLogger });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return valid state structure with expected ranges', () => {
    const state = generator.generate('uniform', 'static');

    expect(state).toHaveProperty('current');
    expect(state).toHaveProperty('previous');
    expect(state).toHaveProperty('affectTraits');

    for (const axis of MOOD_AXES) {
      expect(state.current.mood).toHaveProperty(axis);
      expect(state.previous.mood).toHaveProperty(axis);
      expect(state.current.mood[axis]).toBeGreaterThanOrEqual(-100);
      expect(state.current.mood[axis]).toBeLessThanOrEqual(100);
      expect(state.previous.mood[axis]).toBeGreaterThanOrEqual(-100);
      expect(state.previous.mood[axis]).toBeLessThanOrEqual(100);
      expect(Number.isInteger(state.current.mood[axis])).toBe(true);
      expect(Number.isInteger(state.previous.mood[axis])).toBe(true);
    }

    const sexualAxes = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];
    for (const axis of sexualAxes) {
      expect(state.current.sexual).toHaveProperty(axis);
      expect(state.previous.sexual).toHaveProperty(axis);
      expect(Number.isInteger(state.current.sexual[axis])).toBe(true);
      expect(Number.isInteger(state.previous.sexual[axis])).toBe(true);
    }

    expect(state.current.sexual.sex_excitation).toBeGreaterThanOrEqual(0);
    expect(state.current.sexual.sex_excitation).toBeLessThanOrEqual(100);
    expect(state.current.sexual.sex_inhibition).toBeGreaterThanOrEqual(0);
    expect(state.current.sexual.sex_inhibition).toBeLessThanOrEqual(100);
    expect(state.current.sexual.baseline_libido).toBeGreaterThanOrEqual(-50);
    expect(state.current.sexual.baseline_libido).toBeLessThanOrEqual(50);

    expect(state.previous.sexual.sex_excitation).toBeGreaterThanOrEqual(0);
    expect(state.previous.sexual.sex_excitation).toBeLessThanOrEqual(100);
    expect(state.previous.sexual.sex_inhibition).toBeGreaterThanOrEqual(0);
    expect(state.previous.sexual.sex_inhibition).toBeLessThanOrEqual(100);
    expect(state.previous.sexual.baseline_libido).toBeGreaterThanOrEqual(-50);
    expect(state.previous.sexual.baseline_libido).toBeLessThanOrEqual(50);

    for (const trait of AFFECT_TRAITS) {
      expect(state.affectTraits).toHaveProperty(trait);
      expect(state.affectTraits[trait]).toBeGreaterThanOrEqual(0);
      expect(state.affectTraits[trait]).toBeLessThanOrEqual(100);
      expect(Number.isInteger(state.affectTraits[trait])).toBe(true);
    }
  });

  it('should use one random sample per value for uniform static sampling', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    generator.generate('uniform', 'static');

    expect(randomSpy).toHaveBeenCalledTimes(25);
  });

  it('should use two random samples per value for gaussian static sampling', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    generator.generate('gaussian', 'static');

    expect(randomSpy).toHaveBeenCalledTimes(50);
  });

  it('should derive current values from previous values in dynamic sampling', () => {
    const randomSequence = [
      ...Array(28).fill(0.5),
      0.25,
      0.5,
      ...Array(20).fill(0.5),
    ];
    const randomSpy = jest
      .spyOn(Math, 'random')
      .mockImplementation(() => randomSequence.shift());

    const state = generator.generate('gaussian', 'dynamic');

    const previousValence = state.previous.mood.valence;
    const delta =
      Math.sqrt(-2 * Math.log(0.25)) * Math.cos(2 * Math.PI * 0.5) * 15;
    const expectedValence = Math.round(
      Math.max(-100, Math.min(100, previousValence + delta))
    );

    expect(state.current.mood.valence).toBe(expectedValence);
    expect(randomSpy).toHaveBeenCalled();
  });
});
