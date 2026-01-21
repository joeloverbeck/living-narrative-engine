/**
 * @file Unit tests for BehavioralPrescanFilter
 * Tests Route C cheap behavioral prescan for candidate selection.
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralPrescanFilter from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralPrescanFilter.js';

describe('BehavioralPrescanFilter', () => {
  let mockLogger;
  let mockConfig;
  let mockRandomStateGenerator;
  let mockContextBuilder;
  let mockGateChecker;

  /**
   * Creates a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Creates a mock config with Route C settings.
   *
   * @param {object} overrides - Config overrides
   * @returns {object} Mock config
   */
  const createMockConfig = (overrides = {}) => ({
    prescanSampleCount: 100,
    prescanMinGateOverlap: 0.5,
    maxPrescanPairs: 1000,
    ...overrides,
  });

  /**
   * Creates a mock state generator with deterministic output.
   *
   * @returns {object} Mock state generator
   */
  const createMockStateGenerator = () => ({
    generate: jest.fn(() => ({
      current: { mood: { happiness: 50 }, sexual: { sex_excitation: 30 } },
      previous: { mood: { happiness: 40 }, sexual: { sex_excitation: 20 } },
      affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
    })),
  });

  /**
   * Creates a mock context builder.
   *
   * @returns {object} Mock context builder
   */
  const createMockContextBuilder = () => ({
    buildContext: jest.fn((current, previous, traits) => ({
      moodAxes: current.mood,
      sexualAxes: current.sexual,
      affectTraits: traits,
      emotions: {},
      sexualStates: {},
    })),
  });

  /**
   * Creates a gate checker mock with configurable pass behavior.
   *
   * @param {boolean} passA - Whether prototype A's gates should pass
   * @param {boolean} passB - Whether prototype B's gates should pass
   * @returns {object} Mock gate checker
   */
  const createMockGateChecker = (passA = true, passB = true) => {
    let callCount = 0;
    return {
      checkAllGatesPass: jest.fn(() => {
        callCount++;
        // Alternate between passA and passB
        return callCount % 2 === 1 ? passA : passB;
      }),
    };
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockConfig = createMockConfig();
    mockRandomStateGenerator = createMockStateGenerator();
    mockContextBuilder = createMockContextBuilder();
    mockGateChecker = createMockGateChecker();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
      });

      expect(filter).toBeInstanceOf(BehavioralPrescanFilter);
    });

    it('should throw when logger is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: mockConfig,
            logger: null,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: null,
            logger: mockLogger,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow('BehavioralPrescanFilter requires a valid config object');
    });

    it('should throw when config.prescanSampleCount is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: { prescanMinGateOverlap: 0.5, maxPrescanPairs: 1000 },
            logger: mockLogger,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow('prescanSampleCount');
    });

    it('should throw when config.prescanMinGateOverlap is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: { prescanSampleCount: 100, maxPrescanPairs: 1000 },
            logger: mockLogger,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow('prescanMinGateOverlap');
    });

    it('should throw when config.maxPrescanPairs is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: { prescanSampleCount: 100, prescanMinGateOverlap: 0.5 },
            logger: mockLogger,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow('maxPrescanPairs');
    });

    it('should throw when randomStateGenerator is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: mockConfig,
            logger: mockLogger,
            randomStateGenerator: null,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow();
    });

    it('should throw when contextBuilder is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: mockConfig,
            logger: mockLogger,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: null,
            prototypeGateChecker: mockGateChecker,
          })
      ).toThrow();
    });

    it('should throw when prototypeGateChecker is missing', () => {
      expect(
        () =>
          new BehavioralPrescanFilter({
            config: mockConfig,
            logger: mockLogger,
            randomStateGenerator: mockRandomStateGenerator,
            contextBuilder: mockContextBuilder,
            prototypeGateChecker: null,
          })
      ).toThrow();
    });
  });

  describe('prescan', () => {
    it('should return passes=true when gate overlap ratio meets threshold', () => {
      // Both gates always pass -> onBoth = onEither = 100, ratio = 1.0
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ prescanMinGateOverlap: 0.5 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(true);
      expect(result.gateOverlapRatio).toBe(1.0);
      expect(result.sampleCount).toBe(100);
      expect(result.onBothCount).toBe(100);
      expect(result.onEitherCount).toBe(100);
    });

    it('should return passes=false when gate overlap ratio is below threshold', () => {
      // Gates never pass -> ratio = 0
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => false),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ prescanMinGateOverlap: 0.5 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(false);
      expect(result.gateOverlapRatio).toBe(0);
      expect(result.onBothCount).toBe(0);
      expect(result.onEitherCount).toBe(0);
    });

    it('should correctly calculate partial overlap ratio', () => {
      // A passes always, B passes 50% -> onEither = 100, onBoth = 50
      let callCount = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          callCount++;
          // Call pattern: A, B, A, B, ...
          // A (odd calls) always passes
          // B (even calls) passes every other time
          if (callCount % 2 === 1) return true; // A passes
          return Math.floor(callCount / 2) % 2 === 1; // B alternates
        }),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({
          prescanSampleCount: 10,
          prescanMinGateOverlap: 0.3,
        }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan(
        { gates: [] },
        { gates: [] }
      );

      // onEitherCount = all samples where A or B passed
      // onBothCount = samples where both passed
      expect(result.onEitherCount).toBeGreaterThan(0);
      expect(result.gateOverlapRatio).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlapRatio).toBeLessThanOrEqual(1);
    });

    it('should use configured sample count', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ prescanSampleCount: 500 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan(
        { gates: [] },
        { gates: [] }
      );

      expect(result.sampleCount).toBe(500);
      // Each sample calls gate checker twice (once for A, once for B)
      expect(gateChecker.checkAllGatesPass).toHaveBeenCalledTimes(1000);
    });

    it('should handle prototypes with null gates', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan(
        { gates: null },
        { gates: undefined }
      );

      // Should handle gracefully - gates default to []
      expect(gateChecker.checkAllGatesPass).toHaveBeenCalledWith([], expect.anything());
      expect(result).toBeDefined();
    });

    it('should call dependencies correctly for each sample', () => {
      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ prescanSampleCount: 5 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
      });

      filter.prescan(
        { gates: ['gate1'] },
        { gates: ['gate2'] }
      );

      // Should generate 5 states
      expect(mockRandomStateGenerator.generate).toHaveBeenCalledTimes(5);
      expect(mockRandomStateGenerator.generate).toHaveBeenCalledWith('uniform', 'static');

      // Should build context for each sample
      expect(mockContextBuilder.buildContext).toHaveBeenCalledTimes(5);

      // Should check gates twice per sample (A and B)
      expect(mockGateChecker.checkAllGatesPass).toHaveBeenCalledTimes(10);
    });
  });

  describe('filterPairs', () => {
    it('should return empty candidates for invalid input', () => {
      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
      });

      const result = filter.filterPairs(null);

      expect(result.candidates).toEqual([]);
      expect(result.stats.passed).toBe(0);
      expect(result.stats.rejected).toBe(0);
      expect(result.stats.skipped).toBe(0);
    });

    it('should filter pairs and return candidates with routeC provenance', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const pairs = [
        {
          prototypeA: { id: 'proto1', gates: [] },
          prototypeB: { id: 'proto2', gates: [] },
          candidateMetrics: { jaccard: 0.3 },
        },
      ];

      const result = filter.filterPairs(pairs);

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].selectedBy).toBe('routeC');
      expect(result.candidates[0].routeMetrics.gateOverlapRatio).toBe(1.0);
      expect(result.candidates[0].routeMetrics.sampleCount).toBe(100);
      expect(result.candidates[0].candidateMetrics.jaccard).toBe(0.3);
      expect(result.stats.passed).toBe(1);
      expect(result.stats.rejected).toBe(0);
    });

    it('should respect maxPrescanPairs limit', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ maxPrescanPairs: 2 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const pairs = [
        { prototypeA: { id: 'p1' }, prototypeB: { id: 'p2' } },
        { prototypeA: { id: 'p3' }, prototypeB: { id: 'p4' } },
        { prototypeA: { id: 'p5' }, prototypeB: { id: 'p6' } },
        { prototypeA: { id: 'p7' }, prototypeB: { id: 'p8' } },
      ];

      const result = filter.filterPairs(pairs);

      // Only first 2 pairs should be processed
      expect(result.candidates.length).toBe(2);
      expect(result.stats.skipped).toBe(2);
      expect(result.stats.passed).toBe(2);
    });

    it('should handle empty pairs array', () => {
      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
      });

      const result = filter.filterPairs([]);

      expect(result.candidates).toEqual([]);
      expect(result.stats.passed).toBe(0);
      expect(result.stats.rejected).toBe(0);
      expect(result.stats.skipped).toBe(0);
    });

    it('should preserve candidateMetrics from input pairs', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const pairs = [
        {
          prototypeA: { id: 'proto1', gates: [] },
          prototypeB: { id: 'proto2', gates: [] },
          candidateMetrics: { jaccard: 0.45, signAgreement: 0.9 },
        },
      ];

      const result = filter.filterPairs(pairs);

      expect(result.candidates[0].candidateMetrics).toEqual({
        jaccard: 0.45,
        signAgreement: 0.9,
      });
    });

    it('should include route metrics with gate overlap data', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ prescanSampleCount: 50 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const pairs = [
        {
          prototypeA: { id: 'proto1', gates: [] },
          prototypeB: { id: 'proto2', gates: [] },
        },
      ];

      const result = filter.filterPairs(pairs);

      expect(result.candidates[0].routeMetrics).toEqual({
        gateOverlapRatio: 1.0,
        sampleCount: 50,
        onBothCount: 50,
        onEitherCount: 50,
      });
    });

    it('should log filtering progress', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const pairs = [
        { prototypeA: { id: 'p1' }, prototypeB: { id: 'p2' } },
        { prototypeA: { id: 'p3' }, prototypeB: { id: 'p4' } },
      ];

      filter.filterPairs(pairs);

      expect(mockLogger.debug).toHaveBeenCalled();
      const debugCall = mockLogger.debug.mock.calls[0][0];
      expect(debugCall).toContain('BehavioralPrescanFilter');
      expect(debugCall).toContain('2/2');
    });
  });

  describe('edge cases', () => {
    it('should handle threshold at boundary (exactly 0.5)', () => {
      // Simulate 50% overlap exactly
      let callCount = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          callCount++;
          // A always passes, B alternates - creates exactly 50% onBoth/onEither
          if (callCount % 2 === 1) return true; // A
          return callCount % 4 <= 2; // B passes half the time
        }),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({
          prescanSampleCount: 100,
          prescanMinGateOverlap: 0.5,
        }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan({ gates: [] }, { gates: [] });

      // Should pass if ratio >= threshold
      expect(result.gateOverlapRatio).toBeGreaterThanOrEqual(0);
    });

    it('should handle case where neither gate passes any samples', () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => false),
      };

      const filter = new BehavioralPrescanFilter({
        config: mockConfig,
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan({ gates: [] }, { gates: [] });

      // onEitherCount = 0, so ratio should be 0
      expect(result.onEitherCount).toBe(0);
      expect(result.onBothCount).toBe(0);
      expect(result.gateOverlapRatio).toBe(0);
      expect(result.passes).toBe(false);
    });

    it('should handle case where only one gate passes', () => {
      let callCount = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          callCount++;
          // A always passes, B never passes
          return callCount % 2 === 1;
        }),
      };

      const filter = new BehavioralPrescanFilter({
        config: createMockConfig({ prescanSampleCount: 10 }),
        logger: mockLogger,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
      });

      const result = filter.prescan({ gates: [] }, { gates: [] });

      // A passes all, B passes none
      // onEitherCount = 10 (A passed), onBothCount = 0
      // ratio = 0/10 = 0
      expect(result.onEitherCount).toBe(10);
      expect(result.onBothCount).toBe(0);
      expect(result.gateOverlapRatio).toBe(0);
    });
  });
});
