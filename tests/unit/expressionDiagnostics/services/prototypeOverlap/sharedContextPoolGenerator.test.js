/**
 * @file Unit tests for SharedContextPoolGenerator.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { describe, expect, it, jest } from '@jest/globals';
import SharedContextPoolGenerator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js';
import RandomStateGenerator from '../../../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import { MOOD_AXIS_RANGE } from '../../../../../src/constants/moodAffectConstants.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockContextBuilder = () => ({
  buildContext: jest.fn((current, previous, traits) => ({
    moodAxes: { ...current.mood },
    previousMoodAxes: { ...previous.mood },
    affectTraits: { ...traits },
  })),
});

const buildGenerator = (overrides = {}) => {
  const logger = createMockLogger();
  const randomStateGenerator = new RandomStateGenerator({ logger });
  const contextBuilder = createMockContextBuilder();

  return new SharedContextPoolGenerator({
    logger,
    randomStateGenerator,
    contextBuilder,
    poolSize: 10,
    ...overrides,
  });
};

const getStratumRange = (stratumIndex, stratumCount) => {
  const { min, max } = MOOD_AXIS_RANGE;
  const step = (max - min) / stratumCount;
  return {
    min: min + step * stratumIndex,
    max: stratumIndex === stratumCount - 1 ? max : min + step * (stratumIndex + 1),
  };
};

describe('SharedContextPoolGenerator', () => {
  it('generates a pool with default options', async () => {
    const generator = buildGenerator({ poolSize: 5, stratified: false });
    const pool = await generator.generate();

    expect(pool).toHaveLength(5);
    expect(generator.getStratum('default')).toHaveLength(5);
  });

  it('returns a Promise from generate()', () => {
    const generator = buildGenerator({ poolSize: 5, stratified: false });
    const result = generator.generate();

    expect(result).toBeInstanceOf(Promise);
  });

  it('produces deterministic pools with the same seed', async () => {
    const options = {
      poolSize: 3,
      stratified: false,
      randomSeed: 1234,
    };

    const poolA = await buildGenerator(options).generate();
    const poolB = await buildGenerator(options).generate();

    expect(poolA).toEqual(poolB);
  });

  it('preserves determinism with seeded random across async chunks', async () => {
    // Test with a pool size larger than CHUNK_SIZE (500) to verify async chunking
    const options = {
      poolSize: 1200, // More than 2 chunks
      stratified: false,
      randomSeed: 9999,
    };

    const poolA = await buildGenerator(options).generate();
    const poolB = await buildGenerator(options).generate();

    expect(poolA).toEqual(poolB);
    expect(poolA).toHaveLength(1200);
  });

  it.each(['uniform', 'mood-regime'])(
    'stratifies contexts by valence band for %s strategy',
    async (strategy) => {
      const stratumCount = 3;
      const poolSize = 9;
      const generator = buildGenerator({
        poolSize,
        stratified: true,
        stratumCount,
        stratificationStrategy: strategy,
        randomSeed: 42,
      });

      const pool = await generator.generate();
      expect(pool).toHaveLength(poolSize);

      for (let i = 0; i < stratumCount; i += 1) {
        const stratumId = `valence-${i}`;
        const contexts = generator.getStratum(stratumId);
        const { min, max } = getStratumRange(i, stratumCount);

        expect(contexts).toHaveLength(3);
        for (const context of contexts) {
          expect(context.moodAxes.valence).toBeGreaterThanOrEqual(min);
          expect(context.moodAxes.valence).toBeLessThanOrEqual(max);
        }
      }
    }
  );

  it('boosts edge strata for extremes-enhanced strategy', async () => {
    const stratumCount = 5;
    const poolSize = 20;
    const generator = buildGenerator({
      poolSize,
      stratified: true,
      stratumCount,
      stratificationStrategy: 'extremes-enhanced',
      randomSeed: 77,
    });

    await generator.generate();

    const first = generator.getStratum('valence-0').length;
    const middle = generator.getStratum('valence-2').length;
    const last = generator.getStratum('valence-4').length;

    expect(first).toBeGreaterThan(middle);
    expect(last).toBeGreaterThan(middle);
  });

  it('returns metadata after generation', async () => {
    const generator = buildGenerator({
      poolSize: 4,
      stratified: true,
      stratumCount: 2,
      stratificationStrategy: 'uniform',
      randomSeed: 9,
    });

    await generator.generate();
    const metadata = generator.getMetadata();

    expect(metadata.poolSize).toBe(4);
    expect(metadata.seed).toBe(9);
    expect(metadata.stratified).toBe(true);
    expect(typeof metadata.timestamp).toBe('number');
  });

  it('handles poolSize 0 without errors', async () => {
    const generator = buildGenerator({ poolSize: 0, stratified: false });
    const pool = await generator.generate();

    expect(pool).toEqual([]);
    expect(generator.getStratum('default')).toEqual([]);
  });

  it('throws on invalid options', () => {
    expect(() => buildGenerator({ poolSize: -1 })).toThrow('poolSize');
    expect(() => buildGenerator({ stratumCount: 0 })).toThrow('stratumCount');
    expect(() =>
      buildGenerator({ stratificationStrategy: 'invalid' })
    ).toThrow('stratificationStrategy');
    expect(() => buildGenerator({ randomSeed: 'nope' })).toThrow('randomSeed');
  });

  describe('progress callback', () => {
    it('calls progress callback with current and total', async () => {
      const onProgress = jest.fn();
      const generator = buildGenerator({ poolSize: 10, stratified: false });

      await generator.generate(onProgress);

      expect(onProgress).toHaveBeenCalled();
      // Final call should have current === total
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(10); // current
      expect(lastCall[1]).toBe(10); // total
    });

    it('reports progress incrementally for large pools', async () => {
      const onProgress = jest.fn();
      // Pool size of 1500 should result in 3 chunks (500 each)
      const generator = buildGenerator({ poolSize: 1500, stratified: false });

      await generator.generate(onProgress);

      // Should be called at least 3 times (once per chunk)
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3);

      // Verify progress is monotonically increasing
      let prevCurrent = 0;
      for (const [current, total] of onProgress.mock.calls) {
        expect(current).toBeGreaterThanOrEqual(prevCurrent);
        expect(total).toBe(1500);
        prevCurrent = current;
      }
    });

    it('calls progress callback even for poolSize 0', async () => {
      const onProgress = jest.fn();
      const generator = buildGenerator({ poolSize: 0, stratified: false });

      await generator.generate(onProgress);

      expect(onProgress).toHaveBeenCalledWith(0, 0);
    });

    it('does not fail if no progress callback is provided', async () => {
      const generator = buildGenerator({ poolSize: 10, stratified: false });

      // Should not throw
      const pool = await generator.generate();
      expect(pool).toHaveLength(10);
    });

    it('does not fail if progress callback is null', async () => {
      const generator = buildGenerator({ poolSize: 10, stratified: false });

      // Should not throw
      const pool = await generator.generate(null);
      expect(pool).toHaveLength(10);
    });
  });
});
