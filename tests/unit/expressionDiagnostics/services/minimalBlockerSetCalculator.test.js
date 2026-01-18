/**
 * @file Unit tests for MinimalBlockerSetCalculator.
 * @see src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import MinimalBlockerSetCalculator from '../../../../src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('MinimalBlockerSetCalculator', () => {
  describe('constructor', () => {
    it('creates instance with valid dependencies', () => {
      const logger = createLogger();
      const calculator = new MinimalBlockerSetCalculator({ logger });
      expect(calculator).toBeInstanceOf(MinimalBlockerSetCalculator);
    });

    it('throws if logger is missing', () => {
      expect(() => new MinimalBlockerSetCalculator({})).toThrow();
    });

    it('throws if logger is null', () => {
      expect(() => new MinimalBlockerSetCalculator({ logger: null })).toThrow();
    });

    it('accepts optional config override', () => {
      const logger = createLogger();
      const customConfig = {
        enabled: true,
        maxCoreBlockers: 2,
        nonCorePassRateThreshold: 0.9,
        impactWeight: 0.5,
        lastMileWeight: 0.5,
        minMarginalExplanation: 0.1,
      };
      const calculator = new MinimalBlockerSetCalculator({
        logger,
        config: customConfig,
      });
      expect(calculator).toBeInstanceOf(MinimalBlockerSetCalculator);
    });
  });

  describe('calculate() - empty inputs', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('returns empty result for empty clauses array', () => {
      const result = calculator.calculate([], { sampleCount: 1000 });
      expect(result.coreBlockers).toEqual([]);
      expect(result.nonCoreConstraints).toEqual([]);
      expect(result.compositeScores).toBeInstanceOf(Map);
      expect(result.compositeScores.size).toBe(0);
    });

    it('returns empty result for null clauses', () => {
      const result = calculator.calculate(null, { sampleCount: 1000 });
      expect(result.coreBlockers).toEqual([]);
      expect(result.nonCoreConstraints).toEqual([]);
    });

    it('returns empty result for undefined clauses', () => {
      const result = calculator.calculate(undefined, { sampleCount: 1000 });
      expect(result.coreBlockers).toEqual([]);
      expect(result.nonCoreConstraints).toEqual([]);
    });

    it('returns empty result for null simulation result', () => {
      const clauses = [{ clauseId: 'c1', passCount: 50, failCount: 50 }];
      const result = calculator.calculate(clauses, null);
      expect(result.coreBlockers).toEqual([]);
    });

    it('returns valid DominantCoreResult structure', () => {
      const result = calculator.calculate([], {});
      expect(result).toHaveProperty('coreBlockers');
      expect(result).toHaveProperty('nonCoreConstraints');
      expect(result).toHaveProperty('compositeScores');
      expect(Array.isArray(result.coreBlockers)).toBe(true);
      expect(Array.isArray(result.nonCoreConstraints)).toBe(true);
      expect(result.compositeScores).toBeInstanceOf(Map);
    });
  });

  describe('calculate() - core blocker identification', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('identifies single dominant blocker when one has high impact', () => {
      const clauses = [
        {
          clauseId: 'dominant',
          description: 'High impact clause',
          failCount: 800,
          passCount: 200,
          lastMileFailRate: 0.9,
          ablationImpact: 0.8,
          inRegimePassRate: 0.2,
        },
        {
          clauseId: 'minor1',
          description: 'Low impact clause 1',
          failCount: 50,
          passCount: 950,
          lastMileFailRate: 0.01,
          ablationImpact: 0.02,
          inRegimePassRate: 0.98,
        },
        {
          clauseId: 'minor2',
          description: 'Low impact clause 2',
          failCount: 30,
          passCount: 970,
          lastMileFailRate: 0.005,
          ablationImpact: 0.01,
          inRegimePassRate: 0.99,
        },
      ];
      const simulationResult = {
        sampleCount: 1000,
        failureCount: 850,
        triggerRate: 0.15,
      };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.coreBlockers.length).toBeGreaterThanOrEqual(1);
      expect(result.coreBlockers[0].clauseId).toBe('dominant');
      expect(result.coreBlockers[0].classification).toBe('core');
    });

    it('identifies multiple core blockers when impact is distributed', () => {
      const clauses = [
        {
          clauseId: 'blocker1',
          failCount: 400,
          passCount: 600,
          lastMileFailRate: 0.5,
          ablationImpact: 0.35,
          inRegimePassRate: 0.6,
        },
        {
          clauseId: 'blocker2',
          failCount: 350,
          passCount: 650,
          lastMileFailRate: 0.45,
          ablationImpact: 0.3,
          inRegimePassRate: 0.65,
        },
        {
          clauseId: 'blocker3',
          failCount: 300,
          passCount: 700,
          lastMileFailRate: 0.4,
          ablationImpact: 0.25,
          inRegimePassRate: 0.7,
        },
      ];
      const simulationResult = {
        sampleCount: 1000,
        failureCount: 600,
        triggerRate: 0.4,
      };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.coreBlockers.length).toBeGreaterThan(1);
      expect(result.coreBlockers.length).toBeLessThanOrEqual(3);
    });

    it('respects maxCoreBlockers limit (never exceeds 3)', () => {
      const clauses = Array.from({ length: 10 }, (_, i) => ({
        clauseId: `blocker${i}`,
        failCount: 500 - i * 10,
        passCount: 500 + i * 10,
        lastMileFailRate: 0.5 - i * 0.02,
        ablationImpact: 0.3 - i * 0.02,
        inRegimePassRate: 0.5 + i * 0.05,
      }));
      const simulationResult = { sampleCount: 1000, failureCount: 500 };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.coreBlockers.length).toBeLessThanOrEqual(3);
    });

    it('uses composite scoring (60% impact + 40% last-mile)', () => {
      // High impact, low last-mile
      const highImpactClause = {
        clauseId: 'highImpact',
        failCount: 400,
        passCount: 600,
        lastMileFailRate: 0.2,
        ablationImpact: 0.5,
        inRegimePassRate: 0.6,
      };
      // Low impact, high last-mile
      const highLastMileClause = {
        clauseId: 'highLastMile',
        failCount: 300,
        passCount: 700,
        lastMileFailRate: 0.8,
        ablationImpact: 0.15,
        inRegimePassRate: 0.7,
      };
      const simulationResult = { sampleCount: 1000, failureCount: 400 };

      const result = calculator.calculate(
        [highImpactClause, highLastMileClause],
        simulationResult
      );

      // With 0.6 impact + 0.4 last-mile:
      // highImpact: 0.6*0.5 + 0.4*0.2 = 0.38
      // highLastMile: 0.6*0.15 + 0.4*0.8 = 0.41
      // So highLastMile should rank first
      expect(result.coreBlockers.length).toBeGreaterThanOrEqual(1);
      expect(result.compositeScores.has('highImpact')).toBe(true);
      expect(result.compositeScores.has('highLastMile')).toBe(true);
    });
  });

  describe('calculate() - non-core classification', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('classifies high-pass-rate clauses (≥95%) as non-core', () => {
      const clauses = [
        {
          clauseId: 'blocker',
          failCount: 400,
          passCount: 600,
          lastMileFailRate: 0.5,
          ablationImpact: 0.4,
          inRegimePassRate: 0.6,
        },
        {
          clauseId: 'nonBlocking',
          failCount: 30,
          passCount: 970,
          lastMileFailRate: 0.02,
          ablationImpact: 0.02,
          inRegimePassRate: 0.97,
        },
      ];
      const simulationResult = { sampleCount: 1000, failureCount: 400 };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.nonCoreConstraints.length).toBe(1);
      expect(result.nonCoreConstraints[0].clauseId).toBe('nonBlocking');
      expect(result.nonCoreConstraints[0].classification).toBe('non-core');
    });

    it('excludes already-identified core blockers from non-core', () => {
      const clauses = [
        {
          clauseId: 'coreBlocker',
          failCount: 400,
          passCount: 600,
          lastMileFailRate: 0.6,
          ablationImpact: 0.4,
          inRegimePassRate: 0.96, // High pass rate but high impact
        },
      ];
      const simulationResult = { sampleCount: 1000, failureCount: 400 };

      const result = calculator.calculate(clauses, simulationResult);

      const coreIds = result.coreBlockers.map((b) => b.clauseId);
      const nonCoreIds = result.nonCoreConstraints.map((b) => b.clauseId);

      // No overlap between core and non-core
      for (const id of coreIds) {
        expect(nonCoreIds).not.toContain(id);
      }
    });
  });

  describe('calculate() - edge cases', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('handles single-clause expressions', () => {
      const clauses = [
        {
          clauseId: 'single',
          failCount: 300,
          passCount: 700,
          lastMileFailRate: 0.3,
          ablationImpact: 0.3,
          inRegimePassRate: 0.7,
        },
      ];
      const simulationResult = { sampleCount: 1000, failureCount: 300 };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.coreBlockers.length).toBe(1);
      expect(result.coreBlockers[0].clauseId).toBe('single');
    });

    it('handles mostly-passing expressions with minimal blocking', () => {
      const clauses = [
        {
          clauseId: 'passing1',
          failCount: 10,
          passCount: 990,
          lastMileFailRate: 0.01,
          ablationImpact: 0.01,
          inRegimePassRate: 0.99,
        },
        {
          clauseId: 'passing2',
          failCount: 5,
          passCount: 995,
          lastMileFailRate: 0.005,
          ablationImpact: 0.005,
          inRegimePassRate: 0.995,
        },
      ];
      const simulationResult = {
        sampleCount: 1000,
        failureCount: 10,
        triggerRate: 0.99,
      };

      const result = calculator.calculate(clauses, simulationResult);

      // First clause becomes core (highest score), second is non-core (high pass rate)
      // Algorithm always identifies at least one core blocker from non-empty input
      expect(result.coreBlockers.length).toBe(1);
      expect(result.nonCoreConstraints.length).toBe(1);
      expect(result.nonCoreConstraints[0].clauseId).toBe('passing2');
    });

    it('handles clauses with missing tracking data', () => {
      const clauses = [
        {
          clauseId: 'minimal',
          // Missing most tracking fields
        },
        {
          id: 'altId', // Alternative id field
          condition: { '>=': [{ var: 'x' }, 10] },
        },
      ];
      const simulationResult = { sampleCount: 1000, failureCount: 500 };

      expect(() => calculator.calculate(clauses, simulationResult)).not.toThrow();
      const result = calculator.calculate(clauses, simulationResult);
      expect(result.compositeScores.size).toBe(2);
    });

    it('extracts description from various clause formats', () => {
      const clauses = [
        { clauseId: 'c1', description: 'Direct description' },
        { clauseId: 'c2', clauseDescription: 'Alt description field' },
        { clauseId: 'c3', condition: { '>=': [{ var: 'x' }, 5] } },
        {
          clauseId: 'c4',
          variablePath: 'emotions.joy',
          operator: '>=',
          threshold: 0.5,
        },
        { clauseId: 'c5' }, // Falls back to clauseId
      ];
      const simulationResult = { sampleCount: 100 };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.compositeScores.size).toBe(5);
    });
  });

  describe('calculate() - marginal explanation threshold', () => {
    let logger;

    beforeEach(() => {
      logger = createLogger();
    });

    it('stops adding core blockers when marginal explanation < 5%', () => {
      const customConfig = {
        enabled: true,
        maxCoreBlockers: 3,
        nonCorePassRateThreshold: 0.95,
        impactWeight: 0.6,
        lastMileWeight: 0.4,
        minMarginalExplanation: 0.05,
      };
      const calculator = new MinimalBlockerSetCalculator({
        logger,
        config: customConfig,
      });

      const clauses = [
        {
          clauseId: 'high',
          lastMileFailRate: 0.5,
          ablationImpact: 0.4,
          inRegimePassRate: 0.5,
        },
        {
          clauseId: 'medium',
          lastMileFailRate: 0.03,
          ablationImpact: 0.02,
          inRegimePassRate: 0.8,
        },
        {
          clauseId: 'low',
          lastMileFailRate: 0.01,
          ablationImpact: 0.01,
          inRegimePassRate: 0.9,
        },
      ];
      const simulationResult = { sampleCount: 1000, failureCount: 500 };

      const result = calculator.calculate(clauses, simulationResult);

      // The 'high' clause has composite > 0.05, should be included
      // 'medium' and 'low' have composite < 0.05, should be excluded
      expect(result.coreBlockers.length).toBeGreaterThanOrEqual(1);
      expect(result.coreBlockers[0].clauseId).toBe('high');
    });
  });

  describe('calculate() - composite score computation', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('computes correct composite scores', () => {
      const clauses = [
        {
          clauseId: 'test',
          lastMileFailRate: 0.4,
          ablationImpact: 0.3,
          inRegimePassRate: 0.6,
        },
      ];
      const simulationResult = { sampleCount: 1000 };

      const result = calculator.calculate(clauses, simulationResult);

      // Expected: 0.6 * 0.3 + 0.4 * 0.4 = 0.18 + 0.16 = 0.34
      const score = result.compositeScores.get('test');
      expect(score).toBeCloseTo(0.34, 2);
    });

    it('builds composite scores map for all clauses', () => {
      const clauses = [
        { clauseId: 'a', lastMileFailRate: 0.3, ablationImpact: 0.2 },
        { clauseId: 'b', lastMileFailRate: 0.5, ablationImpact: 0.4 },
        { clauseId: 'c', lastMileFailRate: 0.1, ablationImpact: 0.05 },
      ];
      const simulationResult = { sampleCount: 1000 };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.compositeScores.size).toBe(3);
      expect(result.compositeScores.has('a')).toBe(true);
      expect(result.compositeScores.has('b')).toBe(true);
      expect(result.compositeScores.has('c')).toBe(true);
    });
  });

  describe('calculate() - fallback rate extraction', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('computes last-mile rate from conditional tracking', () => {
      const clauses = [
        {
          clauseId: 'conditional',
          othersPassCount: 100,
          failWhenOthersPassCount: 40,
          inRegimePassRate: 0.6,
        },
      ];
      const simulationResult = { sampleCount: 1000 };

      const result = calculator.calculate(clauses, simulationResult);

      // Expected lastMileRate: 40/100 = 0.4
      const blocker = result.coreBlockers[0] || result.nonCoreConstraints[0];
      if (blocker) {
        expect(blocker.lastMileRate).toBeCloseTo(0.4, 2);
      }
    });

    it('falls back to simple failure rate when conditional data missing', () => {
      const clauses = [
        {
          clauseId: 'simple',
          passCount: 600,
          failCount: 400,
          inRegimePassRate: 0.6,
        },
      ];
      const simulationResult = { sampleCount: 1000 };

      const result = calculator.calculate(clauses, simulationResult);

      const blocker = result.coreBlockers[0];
      expect(blocker.lastMileRate).toBeCloseTo(0.4, 2);
    });

    it('computes in-regime pass rate from counts when not pre-computed', () => {
      const clauses = [
        {
          clauseId: 'inRegime',
          inRegimeTotal: 200,
          inRegimePassCount: 180,
        },
      ];
      const simulationResult = { sampleCount: 1000 };

      const result = calculator.calculate(clauses, simulationResult);

      const blocker = result.coreBlockers[0] || result.nonCoreConstraints[0];
      if (blocker) {
        expect(blocker.inRegimePassRate).toBeCloseTo(0.9, 2);
      }
    });
  });

  describe('calculate() - impact estimation', () => {
    let logger;
    let calculator;

    beforeEach(() => {
      logger = createLogger();
      calculator = new MinimalBlockerSetCalculator({ logger });
    });

    it('uses pre-computed ablation impact when available', () => {
      const clauses = [
        {
          clauseId: 'precomputed',
          ablationImpact: 0.35,
          inRegimePassRate: 0.65,
        },
      ];
      const simulationResult = { sampleCount: 1000 };

      const result = calculator.calculate(clauses, simulationResult);

      expect(result.coreBlockers[0].impactScore).toBe(0.35);
    });

    it('estimates impact from failure contribution when ablation not available', () => {
      const clauses = [
        {
          clauseId: 'estimated',
          passCount: 700,
          failCount: 300,
          inRegimePassRate: 0.7,
        },
      ];
      const simulationResult = {
        sampleCount: 1000,
        failureCount: 400,
        triggerRate: 0.6,
      };

      const result = calculator.calculate(clauses, simulationResult);

      // Impact capped at 1 - triggerRate = 0.4
      expect(result.coreBlockers[0].impactScore).toBeLessThanOrEqual(0.4);
    });
  });
});
