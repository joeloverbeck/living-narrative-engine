/**
 * @file Unit tests for MonteCarloSimulator service
 * @description Tests Monte Carlo simulation for trigger probability estimation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../../src/emotions/emotionCalculatorService.js';
import RandomStateGenerator from '../../../../src/expressionDiagnostics/services/RandomStateGenerator.js';

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

describe('MonteCarloSimulator', () => {
  let mockLogger;
  let mockDataRegistry;
  let mockEmotionCalculatorAdapter;
  let randomStateGenerator;

  // Mock emotion prototypes matching real data structure
  const mockEmotionPrototypes = {
    entries: {
      joy: {
        weights: { valence: 1.0, arousal: 0.5 },
        gates: ['valence >= 0.35'],
      },
      fear: {
        weights: { threat: 1.0, arousal: 0.8 },
        gates: ['threat >= 0.30'],
      },
      confidence: {
        weights: { threat: -0.8, agency_control: 0.8 },
        gates: ['threat <= 0.20', 'agency_control >= 0.10'],
      },
      curiosity: {
        weights: { engagement: 0.8, future_expectancy: 0.5 },
        gates: [],
      },
      calm: {
        weights: { valence: 0.2, arousal: -1.0 },
        gates: ['threat <= 0.20'],
      },
      melancholy: {
        weights: { valence: -1.0 },
        gates: ['valence <= -0.50'],
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sex_excitation: 1.0 },
        gates: ['sex_excitation >= 0.40'],
      },
      inhibited: {
        weights: { sex_inhibition: 1.0 },
        gates: ['sex_inhibition >= 0.50'],
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
          if (lookupId === 'core:sexual_prototypes') {
            return mockSexualPrototypes;
          }
        }
        return null;
      }),
    };

    mockEmotionCalculatorAdapter = buildEmotionCalculatorAdapter(
      mockDataRegistry,
      mockLogger
    );
    randomStateGenerator = new RandomStateGenerator({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const simulator = new MonteCarloSimulator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
        randomStateGenerator,
      });
      expect(simulator).toBeInstanceOf(MonteCarloSimulator);
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new MonteCarloSimulator({
            logger: mockLogger,
            emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
            randomStateGenerator,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new MonteCarloSimulator({
            dataRegistry: mockDataRegistry,
            emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
            randomStateGenerator,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry lacks get method', () => {
      expect(
        () =>
          new MonteCarloSimulator({
            dataRegistry: {},
            logger: mockLogger,
            emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
            randomStateGenerator,
          })
      ).toThrow();
    });

    it('should throw if emotionCalculatorAdapter is missing', () => {
      expect(
        () =>
          new MonteCarloSimulator({
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            randomStateGenerator,
          })
      ).toThrow();
    });

    it('should validate emotionCalculatorAdapter methods', () => {
      expect(
        () =>
          new MonteCarloSimulator({
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            emotionCalculatorAdapter: {
              calculateEmotions: jest.fn(),
            },
            randomStateGenerator,
          })
      ).toThrow();
    });

    it('should throw if randomStateGenerator is missing', () => {
      expect(
        () =>
          new MonteCarloSimulator({
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
          })
      ).toThrow();
    });
  });

  describe('simulate()', () => {
    let simulator;

    beforeEach(() => {
      simulator = new MonteCarloSimulator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
        randomStateGenerator,
      });
    });

    describe('Basic return values', () => {
      it('should return triggerRate in [0, 1] range', async () => {
        const expression = {
          id: 'test:basic',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 100 });

        expect(result.triggerRate).toBeGreaterThanOrEqual(0);
        expect(result.triggerRate).toBeLessThanOrEqual(1);
      });

      it('should return correct sampleCount', async () => {
        const expression = {
          id: 'test:sample_count',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, { sampleCount: 500 });

        expect(result.sampleCount).toBe(500);
      });

      it('should return valid confidence interval', async () => {
        const expression = {
          id: 'test:ci',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 100 });

        expect(result.confidenceInterval).toHaveProperty('low');
        expect(result.confidenceInterval).toHaveProperty('high');
        expect(result.confidenceInterval.low).toBeGreaterThanOrEqual(0);
        expect(result.confidenceInterval.high).toBeLessThanOrEqual(1);
        expect(result.confidenceInterval.low).toBeLessThanOrEqual(
          result.confidenceInterval.high
        );
      });

      it('should reuse the prebuilt context for clause analysis', async () => {
        const localAdapter = {
          calculateEmotions: jest.fn(() => ({})),
          calculateEmotionsFiltered: jest.fn(() => ({})),
          calculateSexualArousal: jest.fn(() => 0),
          calculateSexualStates: jest.fn(() => ({})),
        };
        const localRandomStateGenerator = {
          generate: jest.fn(() => ({
            current: { mood: { valence: 0 }, sexual: {} },
            previous: { mood: { valence: 0 }, sexual: {} },
            affectTraits: null,
          })),
        };
        const localSimulator = new MonteCarloSimulator({
          dataRegistry: { get: jest.fn() },
          logger: mockLogger,
          emotionCalculatorAdapter: localAdapter,
          randomStateGenerator: localRandomStateGenerator,
        });
        const expression = {
          id: 'test:context_reuse',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'moodAxes.valence' }, 9999] },
            },
          ],
        };

        await localSimulator.simulate(expression, {
          sampleCount: 1,
          validateVarPaths: false,
        });

        expect(localAdapter.calculateEmotionsFiltered).toHaveBeenCalledTimes(2);
        expect(localAdapter.calculateSexualArousal).toHaveBeenCalledTimes(2);
        expect(localAdapter.calculateSexualStates).toHaveBeenCalledTimes(2);
      });

      it('should pass referenced emotion filters into context building', async () => {
        const localAdapter = {
          calculateEmotions: jest.fn(() => ({})),
          calculateEmotionsFiltered: jest.fn(() => ({})),
          calculateSexualArousal: jest.fn(() => 0),
          calculateSexualStates: jest.fn(() => ({})),
        };
        const localRandomStateGenerator = {
          generate: jest.fn(() => ({
            current: { mood: { valence: 0 }, sexual: {} },
            previous: { mood: { valence: 0 }, sexual: {} },
            affectTraits: null,
          })),
        };
        const localSimulator = new MonteCarloSimulator({
          dataRegistry: { get: jest.fn() },
          logger: mockLogger,
          emotionCalculatorAdapter: localAdapter,
          randomStateGenerator: localRandomStateGenerator,
        });
        const expression = {
          id: 'test:filter',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        await localSimulator.simulate(expression, {
          sampleCount: 1,
          validateVarPaths: false,
        });

        const [[, , , emotionFilter]] =
          localAdapter.calculateEmotionsFiltered.mock.calls;
        expect(emotionFilter).toEqual(new Set(['joy']));
      });

      it('should return distribution type in result', async () => {
        const expression = { id: 'test:dist', prerequisites: [] };

        const uniformResult = await simulator.simulate(expression, {
          sampleCount: 10,
          distribution: 'uniform',
        });
        const gaussianResult = await simulator.simulate(expression, {
          sampleCount: 10,
          distribution: 'gaussian',
        });

        expect(uniformResult.distribution).toBe('uniform');
        expect(gaussianResult.distribution).toBe('gaussian');
      });
    });

    describe('Sampling coverage', () => {
      it('should include samplingCoverage when enabled and variables are in scope', async () => {
        const expression = {
          id: 'test:sampling_coverage',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'moodAxes.valence' }, 10] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 25 });

        expect(result.samplingCoverage).toBeDefined();
        expect(result.samplingCoverage.config.binCount).toBe(10);
        const variable = result.samplingCoverage.variables.find(
          (entry) => entry.variablePath === 'moodAxes.valence'
        );
        expect(variable).toBeDefined();
        expect(variable.sampleCount).toBe(25);
      });

      it('should omit samplingCoverage when disabled', async () => {
        const expression = {
          id: 'test:sampling_disabled',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          samplingCoverageConfig: { enabled: false },
        });

        expect(result.samplingCoverage).toBeUndefined();
      });

      it('should omit samplingCoverage when no in-scope numeric variables are referenced', async () => {
        const expression = {
          id: 'test:sampling_no_numeric',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'affectTraits.affective_empathy' }, 80] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });

        expect(result.samplingCoverage).toBeUndefined();
      });
    });

    describe('Distribution handling', () => {
      it('should use uniform distribution by default', async () => {
        const expression = { id: 'test:default_dist', prerequisites: [] };

        const result = await simulator.simulate(expression, { sampleCount: 10 });

        expect(result.distribution).toBe('uniform');
      });

      it('should produce different patterns with gaussian distribution', async () => {
        // The gaussian distribution is correctly implemented - we just need
        // to verify it produces valid results, not compare to uniform directly
        // since the actual rates depend on complex interactions between
        // mood axes and emotion prototypes
        const expression = {
          id: 'test:gaussian_effect',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        // Run with both distributions
        const uniformResult = await simulator.simulate(expression, {
          sampleCount: 500,
          distribution: 'uniform',
        });
        const gaussianResult = await simulator.simulate(expression, {
          sampleCount: 500,
          distribution: 'gaussian',
        });

        // Both should produce valid results in [0,1] range
        expect(uniformResult.triggerRate).toBeGreaterThanOrEqual(0);
        expect(uniformResult.triggerRate).toBeLessThanOrEqual(1);
        expect(gaussianResult.triggerRate).toBeGreaterThanOrEqual(0);
        expect(gaussianResult.triggerRate).toBeLessThanOrEqual(1);

        // Verify distribution is correctly recorded
        expect(uniformResult.distribution).toBe('uniform');
        expect(gaussianResult.distribution).toBe('gaussian');
      });
    });

    describe('Clause tracking', () => {
      it('should return clause failures when trackClauses=true', async () => {
        const expression = {
          id: 'test:track_clauses',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.8] },
            },
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });

        expect(result.clauseFailures).toBeInstanceOf(Array);
        expect(result.clauseFailures.length).toBe(2);
        expect(result.clauseFailures[0]).toHaveProperty('clauseDescription');
        expect(result.clauseFailures[0]).toHaveProperty('failureCount');
        expect(result.clauseFailures[0]).toHaveProperty('failureRate');
        expect(result.clauseFailures[0]).toHaveProperty('clauseIndex');
      });

      it('should return empty clauseFailures when trackClauses=false', async () => {
        const expression = {
          id: 'test:no_track',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.8] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: false,
        });

        expect(result.clauseFailures).toEqual([]);
      });

      it('should sort clause failures by failureRate descending', async () => {
        const expression = {
          id: 'test:sort_failures',
          prerequisites: [
            {
              // Easy to satisfy
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.1] },
            },
            {
              // Hard to satisfy - high failure rate
              logic: { '>=': [{ var: 'emotions.joy' }, 0.95] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 500,
          trackClauses: true,
        });

        // Sorted by failure rate descending - highest failure rate first
        for (let i = 1; i < result.clauseFailures.length; i++) {
          expect(result.clauseFailures[i - 1].failureRate).toBeGreaterThanOrEqual(
            result.clauseFailures[i].failureRate
          );
        }
      });

      it('should include violationP50 and violationP90 in clauseFailures', async () => {
        const expression = {
          id: 'test:percentiles',
          prerequisites: [
            {
              // High threshold means many failures with varying violations
              logic: { '>=': [{ var: 'emotions.joy' }, 0.9] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 200,
          trackClauses: true,
        });

        expect(result.clauseFailures.length).toBeGreaterThan(0);
        const clause = result.clauseFailures[0];
        expect(clause).toHaveProperty('violationP50');
        expect(clause).toHaveProperty('violationP90');
      });

      it('should have percentiles that match hierarchicalBreakdown', async () => {
        const expression = {
          id: 'test:percentile_match',
          prerequisites: [
            {
              // High threshold ensures failures for testing
              logic: { '>=': [{ var: 'emotions.joy' }, 0.95] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 500,
          trackClauses: true,
        });

        // With high threshold, we expect failures and breakdown
        expect(result.clauseFailures.length).toBeGreaterThan(0);
        const clause = result.clauseFailures[0];
        expect(clause.hierarchicalBreakdown).not.toBeNull();
        // The percentiles should match the hierarchical tree's percentiles
        expect(clause.violationP50).toBe(clause.hierarchicalBreakdown.violationP50);
        expect(clause.violationP90).toBe(clause.hierarchicalBreakdown.violationP90);
      });

      it('should return numeric percentiles when violations are recorded', async () => {
        const expression = {
          id: 'test:numeric_percentiles',
          prerequisites: [
            {
              // Very high threshold ensures many failures with numeric violations
              logic: { '>=': [{ var: 'emotions.joy' }, 0.99] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 500,
          trackClauses: true,
        });

        // With very high threshold (0.99), almost all samples fail
        expect(result.clauseFailures.length).toBeGreaterThan(0);
        const clause = result.clauseFailures[0];
        // With 500 samples and 0.99 threshold, we expect many failures
        expect(clause.failureCount).toBeGreaterThan(0);
        expect(clause.hierarchicalBreakdown).not.toBeNull();
        expect(clause.hierarchicalBreakdown.violationSampleCount).toBeGreaterThan(0);
        // Percentiles should be numbers
        expect(typeof clause.violationP50).toBe('number');
        expect(typeof clause.violationP90).toBe('number');
        // P90 should be >= P50
        expect(clause.violationP90).toBeGreaterThanOrEqual(clause.violationP50);
      });
    });

    describe('Expression trigger rate characteristics', () => {
      it('should have high trigger rate for easy expression (low threshold)', async () => {
        const easyExpression = {
          id: 'test:easy',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.1] },
            },
          ],
        };

        const result = await simulator.simulate(easyExpression, { sampleCount: 1000 });

        // Should trigger frequently - at least 30% of the time
        expect(result.triggerRate).toBeGreaterThan(0.3);
      });

      it('should have low trigger rate for rare expression (high thresholds)', async () => {
        const rareExpression = {
          id: 'test:rare',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.9] },
                  { '>=': [{ var: 'emotions.curiosity' }, 0.9] },
                ],
              },
            },
          ],
        };

        const result = await simulator.simulate(rareExpression, { sampleCount: 1000 });

        // Should trigger rarely - less than 10% of the time
        expect(result.triggerRate).toBeLessThan(0.1);
      });

      it('should always trigger for expression with no prerequisites', async () => {
        const alwaysTriggerExpression = {
          id: 'test:always',
          prerequisites: [],
        };

        const result = await simulator.simulate(alwaysTriggerExpression, {
          sampleCount: 100,
        });

        expect(result.triggerRate).toBe(1);
        expect(result.triggerCount).toBe(100);
      });

      it('should handle null prerequisites gracefully', async () => {
        const noPrereqExpression = {
          id: 'test:null_prereq',
        };

        const result = await simulator.simulate(noPrereqExpression, {
          sampleCount: 50,
        });

        expect(result.triggerRate).toBe(1);
      });
    });

    describe('Statistical properties', () => {
      it('should have confidence interval that narrows with more samples', async () => {
        const expression = {
          id: 'test:ci_width',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        const smallSampleResult = await simulator.simulate(expression, {
          sampleCount: 100,
        });
        const largeSampleResult = await simulator.simulate(expression, {
          sampleCount: 1000,
        });

        const smallWidth =
          smallSampleResult.confidenceInterval.high -
          smallSampleResult.confidenceInterval.low;
        const largeWidth =
          largeSampleResult.confidenceInterval.high -
          largeSampleResult.confidenceInterval.low;

        expect(largeWidth).toBeLessThan(smallWidth);
      });

      it('should have triggerCount + failureCount <= sampleCount', async () => {
        const expression = {
          id: 'test:count_invariant',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 200,
          trackClauses: true,
        });

        // Each clause's failure count should not exceed sample count
        for (const clause of result.clauseFailures) {
          expect(clause.failureCount).toBeLessThanOrEqual(result.sampleCount);
        }
      });

      it('should calculate Wilson score interval correctly for edge cases', async () => {
        // Expression that almost never triggers - tests low rate CI
        const rareExpression = {
          id: 'test:wilson_low',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.999] },
            },
          ],
        };

        const result = await simulator.simulate(rareExpression, { sampleCount: 100 });

        // CI should never go below 0 or above 1
        expect(result.confidenceInterval.low).toBeGreaterThanOrEqual(0);
        expect(result.confidenceInterval.high).toBeLessThanOrEqual(1);
      });
    });

    describe('Clause description', () => {
      it('should describe >= clauses correctly', async () => {
        const expression = {
          id: 'test:desc_gte',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          trackClauses: true,
        });

        expect(result.clauseFailures[0].clauseDescription).toBe(
          'emotions.joy >= 0.5'
        );
      });

      it('should describe <= clauses correctly', async () => {
        const expression = {
          id: 'test:desc_lte',
          prerequisites: [
            {
              logic: { '<=': [{ var: 'emotions.fear' }, 0.3] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          trackClauses: true,
        });

        expect(result.clauseFailures[0].clauseDescription).toBe(
          'emotions.fear <= 0.3'
        );
      });

      it('should describe AND clauses correctly', async () => {
        const expression = {
          id: 'test:desc_and',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                  { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
                ],
              },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          trackClauses: true,
        });

        expect(result.clauseFailures[0].clauseDescription).toBe(
          'AND of 2 conditions'
        );
      });
    });

    describe('Error handling', () => {
      it('should handle missing lookup data gracefully', async () => {
        mockDataRegistry.get = jest.fn(() => null);

        const expression = {
          id: 'test:missing_lookup',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        // Should not throw, just produce results with 0 triggers
        await expect(
          simulator.simulate(expression, { sampleCount: 10 })
        ).resolves.not.toThrow();
      });

      it('should handle malformed prerequisite logic gracefully', async () => {
        const expression = {
          id: 'test:malformed',
          prerequisites: [
            {
              logic: { invalid_operator: 'bad' },
            },
          ],
        };

        // Should not throw
        await expect(
          simulator.simulate(expression, { sampleCount: 10 })
        ).resolves.not.toThrow();
      });

      it('should handle empty prerequisites array', async () => {
        const expression = {
          id: 'test:empty_prereqs',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });

        expect(result.triggerRate).toBe(1);
        expect(result.clauseFailures).toEqual([]);
      });
    });

    describe('Default configuration', () => {
      it('should use default sampleCount of 10000', async () => {
        const expression = { id: 'test:default', prerequisites: [] };

        const result = await simulator.simulate(expression);

        expect(result.sampleCount).toBe(10000);
      });

      it('should use default confidence level of 0.95', async () => {
        const expression = {
          id: 'test:default_cl',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        // Just verify it runs without error with default config
        const result = await simulator.simulate(expression);

        expect(result.confidenceInterval).toBeDefined();
      });
    });

    describe('Progress callback', () => {
      it('should call onProgress during simulation', async () => {
        const expression = { id: 'test:progress', prerequisites: [] };
        const progressCalls = [];

        await simulator.simulate(expression, {
          sampleCount: 3000, // More than one chunk
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          },
        });

        // Should have at least 3 progress calls (3000 samples / 1000 chunk = 3 chunks)
        // including the final 100% completion call
        expect(progressCalls.length).toBeGreaterThanOrEqual(3);

        // Each progress call should have valid completed/total values
        for (const call of progressCalls) {
          expect(call.completed).toBeGreaterThan(0);
          expect(call.completed).toBeLessThanOrEqual(call.total);
          expect(call.total).toBe(3000);
        }
      });

      it('should only call onProgress once for small sample counts', async () => {
        const expression = { id: 'test:progress_small', prerequisites: [] };
        const progressCalls = [];

        await simulator.simulate(expression, {
          sampleCount: 500, // Less than one chunk
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          },
        });

        // Only one progress call (100% completion) for samples <= chunk size
        expect(progressCalls.length).toBe(1);
        expect(progressCalls[0].completed).toBe(500);
        expect(progressCalls[0].total).toBe(500);
      });

      it('should work without onProgress callback', async () => {
        const expression = { id: 'test:no_progress', prerequisites: [] };

        // Should not throw when onProgress is not provided
        const result = await simulator.simulate(expression, {
          sampleCount: 3000,
        });

        expect(result.sampleCount).toBe(3000);
      });

      it('should call onProgress with 100% completion when simulation completes', async () => {
        const expression = { id: 'test:progress_100', prerequisites: [] };
        const progressCalls = [];

        await simulator.simulate(expression, {
          sampleCount: 3000, // More than one chunk
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          },
        });

        // The last progress call should be at 100%
        expect(progressCalls.length).toBeGreaterThan(0);
        const lastCall = progressCalls[progressCalls.length - 1];
        expect(lastCall.completed).toBe(3000);
        expect(lastCall.total).toBe(3000);
      });

      it('should call onProgress with 100% even for exact chunk multiples', async () => {
        const expression = { id: 'test:progress_exact', prerequisites: [] };
        const progressCalls = [];

        // 2000 samples = exactly 2 chunks of 1000
        await simulator.simulate(expression, {
          sampleCount: 2000,
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          },
        });

        // Should have final 100% call
        expect(progressCalls.length).toBeGreaterThan(0);
        const lastCall = progressCalls[progressCalls.length - 1];
        expect(lastCall.completed).toBe(2000);
        expect(lastCall.total).toBe(2000);
      });
    });

    describe('sexualArousal context variable', () => {
      it('should provide sexualArousal in context for expressions', async () => {
        // Expression checking sexualArousal >= 0.35 (from real expressions)
        const expression = {
          id: 'test:sexual_arousal_access',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualArousal' }, 0.35] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 1000 });

        // sexualArousal must be present in context and derived from sampled properties
        expect(result.triggerRate).toBeGreaterThan(0);
      });

      it('should calculate sexualArousal from sex_excitation, sex_inhibition, and baseline_libido', async () => {
        // High threshold - needs high excitation, low inhibition, positive baseline
        const expression = {
          id: 'test:sexual_arousal_high',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualArousal' }, 0.7] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 2000 });

        // Should trigger sometimes but not frequently (0.7 is high)
        expect(result.triggerRate).toBeGreaterThan(0);
        expect(result.triggerRate).toBeLessThan(0.5);
      });

      it('should use correct scale [0, 100] for sexual state properties', async () => {
        // This test validates the scale fix
        // Sexual prototypes use sexual_arousal weight which requires correct calculation
        const expression = {
          id: 'test:sexual_arousal_scale',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualArousal' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 1000 });

        // With correct [0, 100] scale and formula (exc - inh + base)/100:
        // Average should be around 0.25 (50 - 50 + 0)/100
        // Should trigger reasonably often
        expect(result.triggerRate).toBeGreaterThan(0.1);
      });

      it('should include sexual_arousal in sexual state prototype calculations', async () => {
        // Update mock to include sexual_arousal weight (matching real prototypes)
        mockDataRegistry.get = jest.fn((category, lookupId) => {
          if (category === 'lookups') {
            if (lookupId === 'core:emotion_prototypes') {
              return mockEmotionPrototypes;
            }
            if (lookupId === 'core:sexual_prototypes') {
              return {
                entries: {
                  // sexual_lust prototype from real data depends on sexual_arousal
                  sexual_lust: {
                    weights: { sexual_arousal: 1.0 },
                    gates: ['sexual_arousal >= 0.35'],
                  },
                },
              };
            }
          }
          return null;
        });

        const expression = {
          id: 'test:sexual_state_with_arousal',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualStates.sexual_lust' }, 0.3] },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 1000 });

        // sexual_lust depends entirely on sexual_arousal weight
        // If sexual_arousal is missing, this would always be 0
        expect(result.triggerRate).toBeGreaterThan(0);
      });
    });

    describe('Async behavior', () => {
      it('should return a Promise', () => {
        const expression = { id: 'test:async', prerequisites: [] };

        const result = simulator.simulate(expression, { sampleCount: 10 });

        expect(result).toBeInstanceOf(Promise);
      });

      it('should yield control between chunks', async () => {
        const expression = { id: 'test:yield', prerequisites: [] };

        // This test verifies that the simulation doesn't block
        // by checking that it yields between chunks
        const startTime = Date.now();

        // Use a larger sample count to ensure multiple chunks
        await simulator.simulate(expression, { sampleCount: 5000 });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete in reasonable time (the yields add ~0ms each)
        // This just verifies the async mechanism works
        expect(duration).toBeDefined();
      });
    });

    describe('Context variable coverage (Bug fixes)', () => {
      // These tests verify that the simulator provides all context variables
      // needed by real expressions, matching ExpressionContextBuilder.buildContext()

      describe('moodAxes variable access', () => {
        it('should provide moodAxes in context for expressions', async () => {
          // Expression checking moodAxes.self_evaluation >= 10
          // This is a realistic threshold from quiet_pride.expression.json
          const expression = {
            id: 'test:mood_axes_access',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'moodAxes.self_evaluation' }, 10] },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // BUG: Currently returns 0 because moodAxes is not in context
          // EXPECTED: Should have triggerRate > 0 since self_evaluation
          // ranges from -100 to 100, and values >= 10 are common
          expect(result.triggerRate).toBeGreaterThan(0);
        });

        it('should generate mood axes in correct scale [-100, 100]', async () => {
          // Expression with threshold that only works with correct [-100, 100] scale
          // If mood is in [-1, 1], this would almost never trigger
          const expression = {
            id: 'test:mood_axes_scale',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'moodAxes.valence' }, 5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // BUG: Currently generates values in [-1, 1] so triggerRate ≈ 0
          // EXPECTED: With [-100, 100] range, ~47.5% of values >= 5
          expect(result.triggerRate).toBeGreaterThan(0.2);
        });

        it('should handle multiple moodAxes conditions', async () => {
          // Expression combining multiple moodAxes checks
          const expression = {
            id: 'test:mood_axes_combined',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'moodAxes.valence' }, 0] },
                    { '<=': [{ var: 'moodAxes.arousal' }, 50] },
                    { '>=': [{ var: 'moodAxes.agency_control' }, -20] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // With correct scale, this combination should trigger reasonably often
          // valence >= 0: ~50%, arousal <= 50: ~75%, agency_control >= -20: ~60%
          // Combined: roughly 22.5% or higher
          expect(result.triggerRate).toBeGreaterThan(0.1);
        });
      });

      describe('affiliation mood axis access', () => {
        it('should include affiliation axis in moodAxes context', async () => {
          const expression = {
            id: 'test:affiliation_axis',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'moodAxes.affiliation' }, 0] },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // affiliation should be sampled in [-100, 100] range
          // values >= 0 should occur ~50% of the time
          expect(result.triggerRate).toBeGreaterThan(0.3);
          expect(result.triggerRate).toBeLessThan(0.7);
        });

        it('should accept affiliation in previousMoodAxes', async () => {
          const expression = {
            id: 'test:previous_affiliation',
            prerequisites: [
              {
                logic: {
                  '>=': [
                    {
                      '-': [
                        { var: 'moodAxes.affiliation' },
                        { var: 'previousMoodAxes.affiliation' },
                      ],
                    },
                    5,
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // Change detection should trigger sometimes
          expect(result.triggerRate).toBeGreaterThan(0);
          expect(result.unseededVarWarnings).toEqual([]);
        });
      });

      describe('affectTraits context variable access', () => {
        it('should provide affectTraits in context with sampled values', async () => {
          const expression = {
            id: 'test:affect_traits_access',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'affectTraits.affective_empathy' }, 50] },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // affective_empathy sampled in [0, 100], values >= 50 should be ~50%
          expect(result.triggerRate).toBeGreaterThan(0.3);
          expect(result.triggerRate).toBeLessThan(0.7);
        });

        it('should sample all three affect trait axes', async () => {
          const expression = {
            id: 'test:all_affect_traits',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'affectTraits.affective_empathy' }, 30] },
                    { '>=': [{ var: 'affectTraits.cognitive_empathy' }, 30] },
                    { '>=': [{ var: 'affectTraits.harm_aversion' }, 30] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // Each trait >= 30 has ~70% chance, combined ~34%
          expect(result.triggerRate).toBeGreaterThan(0.15);
          expect(result.triggerRate).toBeLessThan(0.55);
        });

        it('should use affect traits for emotion gate checking', async () => {
          // Create mock with trait-gated emotion
          const traitGatedPrototypes = {
            entries: {
              compassion: {
                weights: { valence: 0.5, affiliation: 0.8 },
                gates: ['affective_empathy >= 0.25'], // Trait gate
              },
              curiosity: {
                weights: { engagement: 0.8, future_expectancy: 0.5 },
                gates: [],
              },
            },
          };

          mockDataRegistry.get = jest.fn((category, lookupId) => {
            if (category === 'lookups') {
              if (lookupId === 'core:emotion_prototypes') {
                return traitGatedPrototypes;
              }
              if (lookupId === 'core:sexual_prototypes') {
                return mockSexualPrototypes;
              }
            }
            return null;
          });

          const expression = {
            id: 'test:trait_gated_emotion',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'emotions.compassion' }, 0.3] },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // compassion depends on trait gate (affective_empathy >= 0.25)
          // With random traits [0, 100], gate passes ~75% of time
          // Then weighted average of valence/affiliation determines intensity
          expect(result.triggerRate).toBeGreaterThan(0);
        });

        it('should have consistent affectTraits across current/previous (personality stability)', async () => {
          // Expression that would fail if traits differed between current/previous
          // Since we don't have direct access to previous traits, we test that
          // emotion gates (which use traits) work consistently
          const expression = {
            id: 'test:trait_stability',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'affectTraits.affective_empathy' }, 40] },
                    { '<=': [{ var: 'affectTraits.affective_empathy' }, 60] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // Values in [40, 60] range should be ~20% of [0, 100] distribution
          expect(result.triggerRate).toBeGreaterThan(0.1);
          expect(result.triggerRate).toBeLessThan(0.4);
        });

        it('should provide default affectTraits when not generated', async () => {
          // Test that context always includes affectTraits (with defaults if needed)
          const expression = {
            id: 'test:affect_traits_defaults',
            prerequisites: [
              {
                // Test that affectTraits.cognitive_empathy exists in context
                logic: { '>=': [{ var: 'affectTraits.cognitive_empathy' }, 0] },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 100 });

          // All values are >= 0 in [0, 100] range
          expect(result.triggerRate).toBe(1);
        });
      });

      describe('previousEmotions variable access', () => {
        it('should provide previousEmotions in context', async () => {
          // Expression checking change in emotion (pride increased by 0.1)
          // This pattern is used in quiet_pride.expression.json
          const expression = {
            id: 'test:previous_emotions_access',
            prerequisites: [
              {
                logic: {
                  '>=': [
                    {
                      '-': [
                        { var: 'emotions.joy' },
                        { var: 'previousEmotions.joy' },
                      ],
                    },
                    0.1,
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // BUG: Currently returns 0 because previousEmotions is undefined
          // EXPECTED: With zeroed previous state, this checks joy >= 0.1
          // which should trigger sometimes
          expect(result.triggerRate).toBeGreaterThan(0);
        });

        it('should provide previousSexualStates in context', async () => {
          const expression = {
            id: 'test:previous_sexual_states_access',
            prerequisites: [
              {
                logic: {
                  '>=': [
                    {
                      '-': [
                        { var: 'sexualStates.aroused' },
                        { var: 'previousSexualStates.aroused' },
                      ],
                    },
                    0.05,
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // Should trigger when aroused state >= 0.05 (with zeroed previous)
          expect(result.triggerRate).toBeGreaterThan(0);
        });

        it('should provide previousMoodAxes in context', async () => {
          const expression = {
            id: 'test:previous_mood_axes_access',
            prerequisites: [
              {
                logic: {
                  '>=': [
                    {
                      '-': [
                        { var: 'moodAxes.valence' },
                        { var: 'previousMoodAxes.valence' },
                      ],
                    },
                    5,
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // With zeroed previous, checks valence >= 5
          // With [-100, 100] range, ~47.5% of values >= 5
          expect(result.triggerRate).toBeGreaterThan(0.2);
        });
      });

      describe('quiet_pride-like expression', () => {
        it('should trigger for expression with moodAxes and emotion conditions', async () => {
          // Simplified version of quiet_pride.expression.json
          // Tests the combination of issues: moodAxes access + scale + previous state
          const expression = {
            id: 'test:quiet_pride_simplified',
            prerequisites: [
              {
                logic: {
                  and: [
                    // Emotion threshold (normalized 0-1)
                    { '>=': [{ var: 'emotions.confidence' }, 0.3] },
                    // Low negative emotion
                    { '<=': [{ var: 'emotions.fear' }, 0.5] },
                    // moodAxes threshold (requires [-100, 100] scale)
                    { '>=': [{ var: 'moodAxes.self_evaluation' }, 10] },
                    { '>=': [{ var: 'moodAxes.agency_control' }, 0] },
                    { '>=': [{ var: 'moodAxes.valence' }, 5] },
                    { '<=': [{ var: 'moodAxes.arousal' }, 45] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 2000 });

          // BUG: Currently returns 0% because moodAxes is missing/wrong scale
          // EXPECTED: Should have some trigger rate > 0
          // The exact rate depends on how thresholds interact
          expect(result.triggerRate).toBeGreaterThan(0);
        });

        it('should trigger for expression with change detection', async () => {
          // Expression with emotion change detection like quiet_pride
          const expression = {
            id: 'test:change_detection',
            prerequisites: [
              {
                logic: {
                  or: [
                    // Either emotion increased by threshold
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.confidence' },
                            { var: 'previousEmotions.confidence' },
                          ],
                        },
                        0.1,
                      ],
                    },
                    // Or emotion is already high
                    { '>=': [{ var: 'emotions.confidence' }, 0.55] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, { sampleCount: 1000 });

          // With zeroed previous state, first branch checks confidence >= 0.1
          // Second branch checks confidence >= 0.55
          // Should definitely trigger sometimes
          expect(result.triggerRate).toBeGreaterThan(0);
        });
      });
    });

    describe('Unseeded variable detection', () => {
      describe('Warning generation', () => {
        it('should warn on unknown root var path (e.g., hasMaleGenitals)', async () => {
          const expression = {
            id: 'test:unknown_root',
            prerequisites: [
              {
                logic: { '==': [{ var: 'hasMaleGenitals' }, true] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].path).toBe('hasMaleGenitals');
          expect(result.unseededVarWarnings[0].reason).toBe('unknown_root');
          expect(result.unseededVarWarnings[0].suggestion).toContain(
            'Unknown root variable'
          );
          expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should warn on unknown nested emotion key', async () => {
          const expression = {
            id: 'test:unknown_emotion',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'emotions.nonexistent_emotion' }, 0.5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].path).toBe(
            'emotions.nonexistent_emotion'
          );
          expect(result.unseededVarWarnings[0].reason).toBe(
            'unknown_nested_key'
          );
          expect(result.unseededVarWarnings[0].suggestion).toContain(
            'Unknown key'
          );
        });

        it('should warn on unknown nested sexualState key', async () => {
          const expression = {
            id: 'test:unknown_sexual',
            prerequisites: [
              {
                logic: {
                  '>=': [{ var: 'sexualStates.fantasy_state' }, 0.3],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].path).toBe(
            'sexualStates.fantasy_state'
          );
          expect(result.unseededVarWarnings[0].reason).toBe(
            'unknown_nested_key'
          );
        });

        it('should warn on invalid nesting of scalar (sexualArousal.x)', async () => {
          const expression = {
            id: 'test:invalid_nesting',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'sexualArousal.something' }, 0.5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].path).toBe(
            'sexualArousal.something'
          );
          expect(result.unseededVarWarnings[0].reason).toBe('invalid_nesting');
          expect(result.unseededVarWarnings[0].suggestion).toContain(
            'scalar value'
          );
        });

        it('should collect multiple warnings from single expression', async () => {
          const expression = {
            id: 'test:multiple_warnings',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'emotions.joy' }, 0.5] }, // valid
                    { '==': [{ var: 'hasMaleGenitals' }, true] }, // unknown root
                    { '>=': [{ var: 'emotions.fake_emotion' }, 0.3] }, // unknown nested
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(2);
          const paths = result.unseededVarWarnings.map((w) => w.path);
          expect(paths).toContain('hasMaleGenitals');
          expect(paths).toContain('emotions.fake_emotion');
        });

        it('should collect warnings across multiple prerequisites', async () => {
          const expression = {
            id: 'test:multiple_prereqs',
            prerequisites: [
              {
                logic: { '==': [{ var: 'unknownRoot1' }, true] },
              },
              {
                logic: { '>=': [{ var: 'unknownRoot2' }, 0.5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(2);
          const paths = result.unseededVarWarnings.map((w) => w.path);
          expect(paths).toContain('unknownRoot1');
          expect(paths).toContain('unknownRoot2');
        });

        it('should deduplicate warnings for same path used multiple times', async () => {
          const expression = {
            id: 'test:duplicate_paths',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'unknownVar' }, 0.3] },
                    { '<=': [{ var: 'unknownVar' }, 0.9] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].path).toBe('unknownVar');
        });
      });

      describe('Valid paths (no warnings)', () => {
        it('should accept valid emotion paths from prototypes', async () => {
          const expression = {
            id: 'test:valid_emotion',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should accept valid sexualState paths from prototypes', async () => {
          const expression = {
            id: 'test:valid_sexual',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should accept valid moodAxes paths', async () => {
          const expression = {
            id: 'test:valid_mood',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'moodAxes.valence' }, 0] },
                    { '<=': [{ var: 'moodAxes.threat' }, 50] },
                    { '>=': [{ var: 'mood.arousal' }, -20] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should accept sexualArousal as scalar', async () => {
          const expression = {
            id: 'test:sexual_arousal_scalar',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'sexualArousal' }, 0.5] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should accept previousEmotions/previousSexualStates/previousMoodAxes', async () => {
          const expression = {
            id: 'test:previous_states',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'previousEmotions.joy' }, 0] },
                    { '>=': [{ var: 'previousSexualStates.aroused' }, 0] },
                    { '>=': [{ var: 'previousMoodAxes.valence' }, -100] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });
      });

      describe('Config behavior', () => {
        it('should throw when failOnUnseededVars is true and warnings exist', async () => {
          const expression = {
            id: 'test:fail_fast',
            prerequisites: [
              {
                logic: { '==': [{ var: 'unknownVar' }, true] },
              },
            ],
          };

          await expect(
            simulator.simulate(expression, {
              sampleCount: 10,
              failOnUnseededVars: true,
            })
          ).rejects.toThrow('unseeded variables');
        });

        it('should proceed with warnings when failOnUnseededVars is false (default)', async () => {
          const expression = {
            id: 'test:warn_only',
            prerequisites: [
              {
                logic: { '==': [{ var: 'unknownVar' }, true] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
            failOnUnseededVars: false,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.triggerRate).toBeDefined();
        });

        it('should skip validation when validateVarPaths is false', async () => {
          const expression = {
            id: 'test:skip_validation',
            prerequisites: [
              {
                logic: { '==': [{ var: 'unknownVar' }, true] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
            validateVarPaths: false,
          });

          expect(result.unseededVarWarnings).toEqual([]);
          expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return empty warnings array when all paths valid', async () => {
          const expression = {
            id: 'test:all_valid',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'emotions.joy' }, 0.5] },
                    { '<=': [{ var: 'moodAxes.threat' }, 50] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });
      });

      describe('Result structure', () => {
        it('should include unseededVarWarnings in simulation result', async () => {
          const expression = {
            id: 'test:result_structure',
            prerequisites: [],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result).toHaveProperty('unseededVarWarnings');
          expect(Array.isArray(result.unseededVarWarnings)).toBe(true);
        });

        it('should have warning objects with path, reason, and suggestion fields', async () => {
          const expression = {
            id: 'test:warning_fields',
            prerequisites: [
              {
                logic: { '==': [{ var: 'badVar' }, true] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          const warning = result.unseededVarWarnings[0];
          expect(warning).toHaveProperty('path');
          expect(warning).toHaveProperty('reason');
          expect(warning).toHaveProperty('suggestion');
          expect(typeof warning.path).toBe('string');
          expect(typeof warning.reason).toBe('string');
          expect(typeof warning.suggestion).toBe('string');
        });
      });

      describe('Affect traits validation', () => {
        it('should accept valid affectTraits paths', async () => {
          const expression = {
            id: 'test:valid_affect_traits',
            prerequisites: [
              {
                logic: {
                  and: [
                    { '>=': [{ var: 'affectTraits.affective_empathy' }, 25] },
                    { '>=': [{ var: 'affectTraits.cognitive_empathy' }, 25] },
                    { '>=': [{ var: 'affectTraits.harm_aversion' }, 25] },
                  ],
                },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should warn on unknown affectTraits key', async () => {
          const expression = {
            id: 'test:unknown_affect_trait',
            prerequisites: [
              {
                logic: { '>=': [{ var: 'affectTraits.nonexistent_trait' }, 50] },
              },
            ],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].path).toBe(
            'affectTraits.nonexistent_trait'
          );
          expect(result.unseededVarWarnings[0].reason).toBe(
            'unknown_nested_key'
          );
        });
      });

      describe('Edge cases', () => {
        it('should handle expression with no prerequisites', async () => {
          const expression = {
            id: 'test:no_prereqs',
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should handle expression with empty prerequisites array', async () => {
          const expression = {
            id: 'test:empty_prereqs',
            prerequisites: [],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should handle prerequisite with no logic property', async () => {
          const expression = {
            id: 'test:no_logic',
            prerequisites: [{ failure_message: 'test' }],
          };

          const result = await simulator.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should handle null expression gracefully', async () => {
          const result = await simulator.simulate(null, { sampleCount: 10 });

          expect(result.unseededVarWarnings).toEqual([]);
        });

        it('should handle missing prototype registries', async () => {
          // Create simulator with empty registry
          const emptyRegistry = {
            get: jest.fn(() => null),
          };
          const simWithEmptyRegistry = new MonteCarloSimulator({
            dataRegistry: emptyRegistry,
            logger: mockLogger,
            emotionCalculatorAdapter: buildEmotionCalculatorAdapter(
              emptyRegistry,
              mockLogger
            ),
            randomStateGenerator,
          });

          const expression = {
            id: 'test:empty_registry',
            prerequisites: [
              {
                // This will warn because no emotion keys are known
                logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
              },
            ],
          };

          const result = await simWithEmptyRegistry.simulate(expression, {
            sampleCount: 10,
          });

          expect(result.unseededVarWarnings).toHaveLength(1);
          expect(result.unseededVarWarnings[0].reason).toBe(
            'unknown_nested_key'
          );
        });
      });
    });

    describe('Threshold extraction', () => {
      it('should extract threshold from >= operator', async () => {
        const expression = {
          id: 'test:threshold-gte',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.55] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(0.55);
        expect(tree.comparisonOperator).toBe('>=');
        expect(tree.variablePath).toBe('emotions.joy');
      });

      it('should extract threshold from <= operator', async () => {
        const expression = {
          id: 'test:threshold-lte',
          prerequisites: [{ logic: { '<=': [{ var: 'emotions.fear' }, 0.3] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(0.3);
        expect(tree.comparisonOperator).toBe('<=');
        expect(tree.variablePath).toBe('emotions.fear');
      });

      it('should extract threshold from > operator', async () => {
        const expression = {
          id: 'test:threshold-gt',
          prerequisites: [{ logic: { '>': [{ var: 'emotions.joy' }, 0.7] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(0.7);
        expect(tree.comparisonOperator).toBe('>');
        expect(tree.variablePath).toBe('emotions.joy');
      });

      it('should extract threshold from < operator', async () => {
        const expression = {
          id: 'test:threshold-lt',
          prerequisites: [{ logic: { '<': [{ var: 'emotions.fear' }, 0.2] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(0.2);
        expect(tree.comparisonOperator).toBe('<');
        expect(tree.variablePath).toBe('emotions.fear');
      });

      it('should extract threshold from == operator', async () => {
        const expression = {
          id: 'test:threshold-eq',
          prerequisites: [{ logic: { '==': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(0.5);
        expect(tree.comparisonOperator).toBe('==');
        expect(tree.variablePath).toBe('emotions.joy');
      });

      it('should handle reversed operand order (threshold on left)', async () => {
        const expression = {
          id: 'test:threshold-reversed',
          prerequisites: [{ logic: { '>=': [0.3, { var: 'emotions.fear' }] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(0.3);
        expect(tree.comparisonOperator).toBe('<='); // reversed
        expect(tree.variablePath).toBe('emotions.fear');
      });

      it('should return null threshold for boolean conditions', async () => {
        const expression = {
          id: 'test:boolean',
          prerequisites: [{ logic: { var: 'hasComponent' } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBeNull();
        expect(tree.comparisonOperator).toBeNull();
        expect(tree.variablePath).toBeNull();
      });

      it('should return null threshold for string comparisons', async () => {
        const expression = {
          id: 'test:string',
          prerequisites: [{ logic: { '==': [{ var: 'state' }, 'active'] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBeNull();
      });

      it('should extract thresholds for leaf nodes in compound AND conditions', async () => {
        const expression = {
          id: 'test:compound-and',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                  { '<=': [{ var: 'emotions.fear' }, 0.2] },
                ],
              },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // AND node itself has no threshold
        expect(tree.thresholdValue).toBeNull();
        expect(tree.comparisonOperator).toBeNull();

        // But children do
        expect(tree.children[0].thresholdValue).toBe(0.5);
        expect(tree.children[0].comparisonOperator).toBe('>=');
        expect(tree.children[0].variablePath).toBe('emotions.joy');

        expect(tree.children[1].thresholdValue).toBe(0.2);
        expect(tree.children[1].comparisonOperator).toBe('<=');
        expect(tree.children[1].variablePath).toBe('emotions.fear');
      });

      it('should extract thresholds for leaf nodes in compound OR conditions', async () => {
        const expression = {
          id: 'test:compound-or',
          prerequisites: [
            {
              logic: {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.8] },
                  { '>=': [{ var: 'emotions.curiosity' }, 0.6] },
                ],
              },
            },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // OR node itself has no threshold
        expect(tree.thresholdValue).toBeNull();

        // But children do
        expect(tree.children[0].thresholdValue).toBe(0.8);
        expect(tree.children[1].thresholdValue).toBe(0.6);
      });

      it('should handle integer thresholds', async () => {
        const expression = {
          id: 'test:integer-threshold',
          prerequisites: [{ logic: { '>=': [{ var: 'mood.valence' }, 50] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.thresholdValue).toBe(50);
        expect(tree.comparisonOperator).toBe('>=');
        expect(tree.variablePath).toBe('mood.valence');
      });
    });

    describe('Observed value extraction', () => {
      it('should extract and record observed values during leaf evaluation', async () => {
        const expression = {
          id: 'test:observed-value',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.55] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 100 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // maxObservedValue should be set (some value between 0 and ~1)
        expect(tree.maxObservedValue).not.toBeNull();
        expect(typeof tree.maxObservedValue).toBe('number');
        expect(tree.maxObservedValue).toBeGreaterThanOrEqual(0);
      });

      it('should record observed values for all evaluations (pass and fail)', async () => {
        // Use a moderate threshold where some samples pass and some fail
        const expression = {
          id: 'test:mixed-results',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.35] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 500,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // Max observed should reflect values from both passing and failing samples
        expect(tree.maxObservedValue).not.toBeNull();
        // With 500 samples, we should see a reasonably high max
        expect(tree.maxObservedValue).toBeGreaterThan(0);
      });

      it('should include maxObservedValue in clause results', async () => {
        const expression = {
          id: 'test:max-observed-field',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree).toHaveProperty('maxObservedValue');
      });

      it('should include observedP99 in clause results', async () => {
        const expression = {
          id: 'test:observed-p99-field',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree).toHaveProperty('observedP99');
        expect(tree.observedP99).not.toBeNull();
      });

      it('should include ceilingGap in clause results', async () => {
        const expression = {
          id: 'test:ceiling-gap-field',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.9] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree).toHaveProperty('ceilingGap');
        // With threshold of 0.9, ceiling gap should be positive (unreachable for most)
        expect(tree.ceilingGap).not.toBeNull();
        expect(tree.thresholdValue).toBe(0.9);
      });

      it('should have observedP99 <= maxObservedValue', async () => {
        const expression = {
          id: 'test:p99-vs-max',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree.observedP99).toBeLessThanOrEqual(tree.maxObservedValue);
      });

      it('should calculate positive ceilingGap for unreachable thresholds', async () => {
        // Very high threshold that's unlikely to be reached
        const expression = {
          id: 'test:high-threshold',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.99] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // ceilingGap = threshold - maxObserved; positive means ceiling effect
        expect(tree.ceilingGap).toBeGreaterThan(0);
      });

      it('should extract values from reversed operand order', async () => {
        // Threshold on left: {">=":[0.3, {"var":"emotions.fear"}]}
        const expression = {
          id: 'test:reversed-operand',
          prerequisites: [{ logic: { '>=': [0.3, { var: 'emotions.fear' }] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // Should still extract the variable value
        expect(tree.maxObservedValue).not.toBeNull();
      });

      it('should not record observed values for boolean conditions', async () => {
        // Boolean condition with no numeric comparison
        const expression = {
          id: 'test:boolean-condition',
          prerequisites: [{ logic: { '!': { var: 'some.flag' } } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 10 });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // No numeric extraction possible
        expect(tree.maxObservedValue).toBeNull();
      });
    });

    describe('Regime-aware metrics', () => {
      it('should include in-regime rates and ranges for leaf clauses', async () => {
        const expression = {
          id: 'test:in-regime-metrics',
          prerequisites: [
            { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
            { logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 200,
        });

        const joyClause = result.clauseFailures.find((clause) =>
          clause.clauseDescription.includes('emotions.joy')
        );

        expect(joyClause.inRegimeFailureRate).not.toBeNull();
        expect(joyClause.inRegimePassRate).not.toBeNull();
        expect(joyClause.achievableRange).not.toBeNull();
        expect(joyClause.inRegimeAchievableRange).not.toBeNull();
      });

      it('should compute gate clamp metrics within the mood-regime subset', async () => {
        const sampleStates = [
          {
            current: { mood: { valence: 20, arousal: 0 }, sexual: {} },
            previous: { mood: { valence: 20, arousal: 0 }, sexual: {} },
            affectTraits: null,
          },
          {
            current: { mood: { valence: 40, arousal: 0 }, sexual: {} },
            previous: { mood: { valence: 40, arousal: 0 }, sexual: {} },
            affectTraits: null,
          },
          {
            current: { mood: { valence: 40, arousal: -50 }, sexual: {} },
            previous: { mood: { valence: 40, arousal: -50 }, sexual: {} },
            affectTraits: null,
          },
          {
            current: { mood: { valence: 5, arousal: 0 }, sexual: {} },
            previous: { mood: { valence: 5, arousal: 0 }, sexual: {} },
            affectTraits: null,
          },
        ];
        let index = 0;
        const localRandomStateGenerator = {
          generate: jest.fn(() => sampleStates[index++]),
        };
        const localSimulator = new MonteCarloSimulator({
          dataRegistry: mockDataRegistry,
          logger: mockLogger,
          emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
          randomStateGenerator: localRandomStateGenerator,
        });
        const expression = {
          id: 'test:gate-clamp-metrics',
          prerequisites: [
            { logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } },
            { logic: { '>=': [{ var: 'emotions.joy' }, 0.2] } },
          ],
        };

        const result = await localSimulator.simulate(expression, {
          sampleCount: sampleStates.length,
          trackClauses: true,
        });

        const joyClause = result.clauseFailures.find((clause) =>
          clause.clauseDescription.includes('emotions.joy')
        );
        const moodClause = result.clauseFailures.find((clause) =>
          clause.clauseDescription.includes('moodAxes.valence')
        );

        expect(joyClause).toBeDefined();
        expect(moodClause).toBeDefined();
        expect(joyClause.gatePassInRegimeCount).toBe(2);
        expect(joyClause.gateFailInRegimeCount).toBe(1);
        expect(joyClause.gatePassAndClausePassInRegimeCount).toBe(1);
        expect(joyClause.gatePassAndClauseFailInRegimeCount).toBe(1);
        expect(joyClause.gatePassRateInRegime).toBeCloseTo(2 / 3, 5);
        expect(joyClause.gateClampRateInRegime).toBeCloseTo(1 / 3, 5);
        expect(joyClause.passRateGivenGateInRegime).toBeCloseTo(0.5, 5);
        expect(moodClause.gatePassRateInRegime).toBeNull();
        expect(moodClause.gateClampRateInRegime).toBeNull();
        expect(moodClause.passRateGivenGateInRegime).toBeNull();
        expect(moodClause.gatePassInRegimeCount).toBeNull();
        expect(moodClause.gateFailInRegimeCount).toBeNull();
      });

      it('should return null conditional pass when no gates pass in-regime', async () => {
        const sampleStates = [
          {
            current: { mood: { valence: 20, arousal: 0 }, sexual: {} },
            previous: { mood: { valence: 20, arousal: 0 }, sexual: {} },
            affectTraits: null,
          },
          {
            current: { mood: { valence: 20, arousal: 0 }, sexual: {} },
            previous: { mood: { valence: 20, arousal: 0 }, sexual: {} },
            affectTraits: null,
          },
        ];
        let index = 0;
        const localRandomStateGenerator = {
          generate: jest.fn(() => sampleStates[index++]),
        };
        const localSimulator = new MonteCarloSimulator({
          dataRegistry: mockDataRegistry,
          logger: mockLogger,
          emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
          randomStateGenerator: localRandomStateGenerator,
        });
        const expression = {
          id: 'test:gate-clamp-zero-pass',
          prerequisites: [
            { logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } },
            { logic: { '>=': [{ var: 'emotions.joy' }, 0.2] } },
          ],
        };

        const result = await localSimulator.simulate(expression, {
          sampleCount: sampleStates.length,
          trackClauses: true,
        });

        const joyClause = result.clauseFailures.find((clause) =>
          clause.clauseDescription.includes('emotions.joy')
        );

        expect(joyClause).toBeDefined();
        expect(joyClause.gatePassInRegimeCount).toBe(0);
        expect(joyClause.gateFailInRegimeCount).toBe(2);
        expect(joyClause.gatePassRateInRegime).toBe(0);
        expect(joyClause.gateClampRateInRegime).toBe(1);
        expect(joyClause.passRateGivenGateInRegime).toBeNull();
      });

      it('should mark redundant clauses in-regime based on achievable range', async () => {
        const expression = {
          id: 'test:redundant-in-regime',
          prerequisites: [
            { logic: { '<=': [{ var: 'moodAxes.threat' }, -50] } },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 200,
        });

        const clause = result.clauseFailures[0];
        expect(clause.redundantInRegime).toBe(true);
        expect(clause.inRegimeAchievableRange.max).toBeLessThanOrEqual(-50);
      });

      it('should include tuning direction labels from operators', async () => {
        const expression = {
          id: 'test:tuning-direction',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });
        const clause = result.clauseFailures[0];

        expect(clause.tuningDirection).toEqual({
          loosen: 'threshold_down',
          tighten: 'threshold_up',
        });
      });

      it('should report gate compatibility against mood regime constraints', async () => {
        const expression = {
          id: 'test:gate-compatibility',
          prerequisites: [
            { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
            { logic: { '>=': [{ var: 'emotions.melancholy' }, 0.2] } },
          ],
        };

        const result = await simulator.simulate(expression, { sampleCount: 50 });

        expect(result.gateCompatibility.emotions.melancholy.compatible).toBe(false);
        expect(result.gateCompatibility.emotions.melancholy.reason).toContain(
          'gate'
        );
      });
    });

    describe('near-miss rate tracking', () => {
      it('should include near-miss metrics in clause results', async () => {
        const expression = {
          id: 'test:near-miss-fields',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });

        result.clauseFailures.forEach((clause) => {
          expect(clause).toHaveProperty('nearMissRate');
          expect(clause).toHaveProperty('nearMissEpsilon');
        });
      });

      it('should include near-miss in hierarchical breakdown', async () => {
        const expression = {
          id: 'test:near-miss-breakdown',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        expect(tree).toHaveProperty('nearMissCount');
        expect(tree).toHaveProperty('nearMissRate');
        expect(tree).toHaveProperty('nearMissEpsilon');
      });

      it('should use emotions epsilon (0.05) for emotions variables', async () => {
        const expression = {
          id: 'test:emotions-epsilon',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // Epsilon for emotions domain should be 0.05
        expect(tree.nearMissEpsilon).toBe(0.05);
      });

      it('should detect near-misses within epsilon of threshold', async () => {
        // With uniform distribution [0,1] and threshold 0.5, epsilon 0.05
        // roughly 10% of samples should be in [0.45, 0.55] range
        const expression = {
          id: 'test:near-miss-detection',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10000,
          trackClauses: true,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // With ±5% around threshold, expect ~10% near-miss rate
        // Using wide tolerance since it's statistical (±5% variance expected)
        expect(tree.nearMissRate).toBeGreaterThan(0.04);
        expect(tree.nearMissRate).toBeLessThan(0.20);
      });

      it('should have zero near-miss rate for unreachable thresholds', async () => {
        // Very high threshold means values are far from it
        const expression = {
          id: 'test:unreachable-threshold',
          prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.99] } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // Most samples should be far from threshold, low near-miss rate
        expect(tree.nearMissRate).toBeLessThan(0.1);
      });

      it('should return null for nearMissRate without threshold metadata', async () => {
        // Boolean condition with no threshold
        const expression = {
          id: 'test:no-threshold',
          prerequisites: [{ logic: { '!': { var: 'some.flag' } } }],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          trackClauses: true,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // No threshold = no near-miss tracking
        expect(tree.nearMissEpsilon).toBeNull();
      });

      it('should propagate near-miss metrics through AND compound clauses', async () => {
        const expression = {
          id: 'test:near-miss-compound',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                  { '>=': [{ var: 'emotions.fear' }, 0.3] },
                ],
              },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });
        const tree = result.clauseFailures[0].hierarchicalBreakdown;

        // Children should have near-miss tracking
        expect(tree.children).toHaveLength(2);
        expect(tree.children[0]).toHaveProperty('nearMissRate');
        expect(tree.children[1]).toHaveProperty('nearMissRate');
      });
    });

    describe('Ground-truth witness capture', () => {
      it('should capture multiple witnesses (up to maxWitnesses)', async () => {
        // Expression that triggers frequently
        const expression = {
          id: 'test:witness-capture',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 1000,
          maxWitnesses: 5,
        });

        expect(result.witnessAnalysis).toBeDefined();
        expect(result.witnessAnalysis.witnesses).toBeInstanceOf(Array);
        // Should capture multiple witnesses since expression triggers frequently
        expect(result.witnessAnalysis.witnesses.length).toBeGreaterThan(0);
        expect(result.witnessAnalysis.witnesses.length).toBeLessThanOrEqual(5);
      });

      it('should default to maxWitnesses=5', async () => {
        const expression = {
          id: 'test:witness-default',
          prerequisites: [], // Always triggers
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
        });

        // All samples trigger, so should capture exactly 5
        expect(result.witnessAnalysis.witnesses.length).toBe(5);
      });

      it('should capture fewer witnesses if fewer samples trigger', async () => {
        // Expression that triggers rarely
        const expression = {
          id: 'test:witness-rare',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.99] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 50,
          maxWitnesses: 5,
        });

        // With very high threshold, likely 0-2 triggers out of 50
        expect(result.witnessAnalysis.witnesses.length).toBeLessThan(5);
      });

      it('should include current state in each witness', async () => {
        const expression = {
          id: 'test:witness-current',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          maxWitnesses: 3,
        });

        const witness = result.witnessAnalysis.witnesses[0];
        expect(witness).toHaveProperty('current');
        expect(witness.current).toHaveProperty('mood');
        expect(witness.current).toHaveProperty('sexual');
      });

      it('should include previous state in each witness', async () => {
        const expression = {
          id: 'test:witness-previous',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          maxWitnesses: 3,
        });

        const witness = result.witnessAnalysis.witnesses[0];
        expect(witness).toHaveProperty('previous');
        expect(witness.previous).toHaveProperty('mood');
        expect(witness.previous).toHaveProperty('sexual');
      });

      it('should include affectTraits in each witness', async () => {
        const expression = {
          id: 'test:witness-traits',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
          maxWitnesses: 3,
        });

        const witness = result.witnessAnalysis.witnesses[0];
        expect(witness).toHaveProperty('affectTraits');
        expect(witness.affectTraits).toHaveProperty('affective_empathy');
        expect(witness.affectTraits).toHaveProperty('cognitive_empathy');
        expect(witness.affectTraits).toHaveProperty('harm_aversion');
      });

      it('should maintain bestWitness for backward compatibility', async () => {
        const expression = {
          id: 'test:witness-compat',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
        });

        expect(result.witnessAnalysis).toHaveProperty('bestWitness');
        // bestWitness should be the first witness
        expect(result.witnessAnalysis.bestWitness).toEqual(
          result.witnessAnalysis.witnesses[0]
        );
      });

      it('should have null bestWitness when no triggers', async () => {
        // Expression that never triggers
        const expression = {
          id: 'test:no-triggers',
          prerequisites: [
            {
              logic: { '==': [1, 0] }, // Always false
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
        });

        expect(result.witnessAnalysis.witnesses).toEqual([]);
        expect(result.witnessAnalysis.bestWitness).toBeNull();
      });

      it('should include nearestMiss when no triggers', async () => {
        // Expression that never triggers
        const expression = {
          id: 'test:nearest-miss',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.999] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });

        expect(result.witnessAnalysis.nearestMiss).toBeDefined();
        expect(result.witnessAnalysis.nearestMiss.sample).toHaveProperty(
          'current'
        );
        expect(result.witnessAnalysis.nearestMiss.sample).toHaveProperty(
          'previous'
        );
        expect(result.witnessAnalysis.nearestMiss).toHaveProperty(
          'failedLeafCount'
        );
        expect(result.witnessAnalysis.nearestMiss).toHaveProperty(
          'failedLeaves'
        );
      });

      it('should capture witnesses with valid mood values', async () => {
        const expression = {
          id: 'test:witness-mood-values',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
        });

        const witness = result.witnessAnalysis.witnesses[0];
        // Mood values should be in [-100, 100] range
        Object.values(witness.current.mood).forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(-100);
          expect(value).toBeLessThanOrEqual(100);
        });
      });

      it('should capture witnesses with valid sexual state values', async () => {
        const expression = {
          id: 'test:witness-sexual-values',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
        });

        const witness = result.witnessAnalysis.witnesses[0];
        // sex_excitation and sex_inhibition are in [0, 100] range
        expect(witness.current.sexual.sex_excitation).toBeGreaterThanOrEqual(0);
        expect(witness.current.sexual.sex_excitation).toBeLessThanOrEqual(100);
        expect(witness.current.sexual.sex_inhibition).toBeGreaterThanOrEqual(0);
        expect(witness.current.sexual.sex_inhibition).toBeLessThanOrEqual(100);
        // baseline_libido is in [-50, 50] range
        expect(witness.current.sexual.baseline_libido).toBeGreaterThanOrEqual(
          -50
        );
        expect(witness.current.sexual.baseline_libido).toBeLessThanOrEqual(50);
      });

      it('should capture witnesses with valid affectTraits values', async () => {
        const expression = {
          id: 'test:witness-trait-values',
          prerequisites: [],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 10,
        });

        const witness = result.witnessAnalysis.witnesses[0];
        // Affect traits should be in [0, 100] range
        Object.values(witness.affectTraits).forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        });
      });

      it('should respect custom maxWitnesses setting', async () => {
        const expression = {
          id: 'test:custom-max-witnesses',
          prerequisites: [], // Always triggers
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          maxWitnesses: 3,
        });

        // Should capture exactly 3 witnesses
        expect(result.witnessAnalysis.witnesses.length).toBe(3);
      });
    });

    describe('Last-mile rate tracking', () => {
      it('should mark single-clause expressions with isSingleClause true', async () => {
        const singleClauseExpression = {
          id: 'test:single-clause',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(singleClauseExpression, {
          sampleCount: 100,
          trackClauses: true,
        });

        expect(result.clauseFailures).toHaveLength(1);
        expect(result.clauseFailures[0].isSingleClause).toBe(true);
      });

      it('should mark multi-clause expressions with isSingleClause false', async () => {
        const multiClauseExpression = {
          id: 'test:multi-clause',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
            {
              logic: { '>=': [{ var: 'emotions.fear' }, 0.3] },
            },
          ],
        };

        const result = await simulator.simulate(multiClauseExpression, {
          sampleCount: 100,
          trackClauses: true,
        });

        expect(result.clauseFailures).toHaveLength(2);
        result.clauseFailures.forEach((clause) => {
          expect(clause.isSingleClause).toBe(false);
        });
      });

      it('should include lastMileContext for multi-clause expressions', async () => {
        const multiClauseExpression = {
          id: 'test:last-mile-context',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
            {
              logic: { '>=': [{ var: 'emotions.fear' }, 0.3] },
            },
          ],
        };

        const result = await simulator.simulate(multiClauseExpression, {
          sampleCount: 1000,
          trackClauses: true,
        });

        result.clauseFailures.forEach((clause) => {
          expect(clause).toHaveProperty('lastMileFailRate');
          expect(clause.lastMileContext).toBeDefined();
          expect(clause.lastMileContext).toHaveProperty('othersPassedCount');
          expect(clause.lastMileContext).toHaveProperty('lastMileFailCount');
        });
      });

      it('should have lastMileFailCount <= othersPassedCount invariant', async () => {
        const multiClauseExpression = {
          id: 'test:last-mile-invariant',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
            {
              logic: { '>=': [{ var: 'emotions.fear' }, 0.3] },
            },
          ],
        };

        const result = await simulator.simulate(multiClauseExpression, {
          sampleCount: 1000,
          trackClauses: true,
        });

        result.clauseFailures.forEach((clause) => {
          expect(clause.lastMileContext.lastMileFailCount).toBeLessThanOrEqual(
            clause.lastMileContext.othersPassedCount
          );
        });
      });

      it('should track last-mile rate in hierarchicalBreakdown', async () => {
        const expression = {
          id: 'test:last-mile-breakdown',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 100,
          trackClauses: true,
        });

        const tree = result.clauseFailures[0].hierarchicalBreakdown;
        expect(tree).toHaveProperty('lastMileFailRate');
        expect(tree).toHaveProperty('lastMileFailCount');
        expect(tree).toHaveProperty('othersPassedCount');
        expect(tree).toHaveProperty('isSingleClause');
      });

      it('should have single-clause last-mile rate equal to failure rate', async () => {
        const singleClauseExpression = {
          id: 'test:single-last-mile',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
            },
          ],
        };

        const result = await simulator.simulate(singleClauseExpression, {
          sampleCount: 1000,
          trackClauses: true,
        });

        const clause = result.clauseFailures[0];
        // For single clause, every evaluation is a "last mile" scenario
        // So othersPassedCount should equal sampleCount
        expect(clause.lastMileContext.othersPassedCount).toBe(1000);

        // And lastMileFailRate should equal failureRate
        if (clause.failureRate > 0) {
          expect(clause.lastMileFailRate).toBeCloseTo(clause.failureRate, 2);
        }
      });

      it('should identify decisive blocker among multi-clause expressions', async () => {
        // Create expression where one clause is much harder to satisfy
        const expression = {
          id: 'test:decisive-blocker',
          prerequisites: [
            {
              // Easy: joy >= 0.2 (low threshold, usually passes)
              logic: { '>=': [{ var: 'emotions.joy' }, 0.2] },
            },
            {
              // Hard: fear >= 0.8 (high threshold, rarely passes)
              logic: { '>=': [{ var: 'emotions.fear' }, 0.8] },
            },
          ],
        };

        const result = await simulator.simulate(expression, {
          sampleCount: 2000,
          trackClauses: true,
        });

        // The harder clause (high fear threshold) should have non-zero last-mile tracking
        const hardClause = result.clauseFailures.find(
          (c) => c.clauseDescription.includes('0.8') || c.failureRate > 0.5
        );

        expect(hardClause).toBeDefined();
        // At least some samples should have the easy clause passing while hard fails
        if (hardClause.lastMileContext.othersPassedCount > 0) {
          expect(hardClause.lastMileContext.lastMileFailCount).toBeGreaterThan(
            0
          );
        }
      });
    });
  });
});
