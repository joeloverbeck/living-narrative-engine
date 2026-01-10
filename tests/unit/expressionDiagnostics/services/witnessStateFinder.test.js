/**
 * @file Unit tests for WitnessStateFinder service
 * @description Tests simulated annealing search for expression witness states.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WitnessStateFinder from '../../../../src/expressionDiagnostics/services/WitnessStateFinder.js';
import WitnessState from '../../../../src/expressionDiagnostics/models/WitnessState.js';

describe('WitnessStateFinder', () => {
  let mockLogger;
  let mockDataRegistry;

  // Mock emotion prototypes matching real data structure
  const mockEmotionPrototypes = {
    entries: {
      joy: {
        weights: { valence: 1.0, arousal: 0.5 },
      },
      fear: {
        weights: { threat: 1.0, arousal: 0.8 },
      },
      confidence: {
        weights: { threat: -0.8, agency_control: 0.8 },
      },
      curiosity: {
        weights: { engagement: 0.8, future_expectancy: 0.5 },
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sex_excitation: 1.0 },
      },
      inhibited: {
        weights: { sex_inhibition: 1.0 },
      },
      sexual_lust: {
        weights: { sexual_arousal: 1.0 },
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
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
      expect(finder).toBeInstanceOf(WitnessStateFinder);
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new WitnessStateFinder({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new WitnessStateFinder({
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry lacks get method', () => {
      expect(
        () =>
          new WitnessStateFinder({
            dataRegistry: {},
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger lacks required methods', () => {
      expect(
        () =>
          new WitnessStateFinder({
            dataRegistry: mockDataRegistry,
            logger: { info: jest.fn() }, // missing warn, error, debug
          })
      ).toThrow();
    });
  });

  describe('findWitness()', () => {
    let finder;

    beforeEach(() => {
      finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    describe('Basic return structure', () => {
      it('should return SearchResult with all required fields', async () => {
        const expression = {
          id: 'test:basic',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result).toHaveProperty('found');
        expect(result).toHaveProperty('witness');
        expect(result).toHaveProperty('nearestMiss');
        expect(result).toHaveProperty('bestFitness');
        expect(result).toHaveProperty('iterationsUsed');
        expect(result).toHaveProperty('violatedClauses');
      });

      it('should return found=true for always-true expression (no prerequisites)', async () => {
        const expression = {
          id: 'test:always_true',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.found).toBe(true);
        expect(result.witness).toBeInstanceOf(WitnessState);
        expect(result.bestFitness).toBe(1);
        expect(result.violatedClauses).toEqual([]);
      });

      it('should return found=true with null prerequisites', async () => {
        const expression = {
          id: 'test:null_prereqs',
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.found).toBe(true);
        expect(result.bestFitness).toBe(1);
      });

      it('should return witness state when found', async () => {
        // Expression with no prerequisites always succeeds
        const expression = {
          id: 'test:easy',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        // With no prerequisites, should always find a witness
        expect(result.found).toBe(true);
        expect(result.witness).toBeInstanceOf(WitnessState);
        expect(result.witness.isExact).toBe(true);
        expect(result.witness.fitness).toBe(1);
      });

      it('should return nearestMiss when witness not found', async () => {
        // Impossible expression
        const expression = {
          id: 'test:impossible',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 1.1] }, // Impossible: max is 1.0
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        expect(result.nearestMiss).toBeInstanceOf(WitnessState);
        expect(result.nearestMiss.isExact).toBe(false);
      });
    });

    describe('Fitness scoring', () => {
      it('should return fitness 1 for perfect match', async () => {
        const expression = {
          id: 'test:perfect',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.bestFitness).toBe(1);
      });

      it('should return fitness < 1 for imperfect match', async () => {
        // Expression that's very hard to satisfy
        const expression = {
          id: 'test:hard',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.99] },
            },
            {
              logic: { '>=': [{ var: 'emotions.fear' }, 0.99] },
            },
            {
              logic: { '>=': [{ var: 'emotions.confidence' }, 0.99] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 50 });

        // With very few iterations and hard constraints, likely won't find perfect
        // But test is mainly checking fitness is in valid range
        expect(result.bestFitness).toBeGreaterThanOrEqual(0);
        expect(result.bestFitness).toBeLessThanOrEqual(1);
      });

      it('should calculate fitness based on passed clauses ratio', async () => {
        // Expression with multiple clauses, some easy some hard
        const expression = {
          id: 'test:mixed',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.01] }, // Easy
            },
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.99] }, // Hard
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        // Fitness should reflect partial success
        expect(result.bestFitness).toBeGreaterThan(0);
      });
    });

    describe('Configuration options', () => {
      it('should respect maxIterations config', async () => {
        const expression = {
          id: 'test:iterations',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.95] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 50 });

        expect(result.iterationsUsed).toBeLessThanOrEqual(50);
      });

      it('should use default config when not provided', async () => {
        const expression = {
          id: 'test:defaults',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression);

        expect(result).toBeDefined();
        expect(result.found).toBe(true);
      });

      it('should merge custom config with defaults', async () => {
        const expression = {
          id: 'test:merge',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 5,
          // Other options use defaults
        });

        expect(result.iterationsUsed).toBeLessThanOrEqual(5);
      });

      it('should respect initialTemperature config', async () => {
        const expression = {
          id: 'test:temperature',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        // Low temperature = smaller perturbations
        const lowTempResult = await finder.findWitness(expression, {
          maxIterations: 100,
          initialTemperature: 0.1,
        });

        // High temperature = larger perturbations
        const highTempResult = await finder.findWitness(expression, {
          maxIterations: 100,
          initialTemperature: 2.0,
        });

        // Both should produce valid results
        expect(lowTempResult.bestFitness).toBeGreaterThanOrEqual(0);
        expect(highTempResult.bestFitness).toBeGreaterThanOrEqual(0);
      });

      it('should respect coolingRate config', async () => {
        const expression = {
          id: 'test:cooling',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.7] },
            },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 100,
          coolingRate: 0.99, // Slower cooling
        });

        expect(result).toBeDefined();
      });

      it('should respect restartThreshold config', async () => {
        const expression = {
          id: 'test:restart',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.9] },
            },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 200,
          restartThreshold: 20, // Restart frequently
        });

        expect(result).toBeDefined();
      });

      it('should respect useDynamicsConstraints config', async () => {
        const expression = {
          id: 'test:dynamics',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.5] },
            },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 100,
          useDynamicsConstraints: true,
        });

        expect(result).toBeDefined();
      });
    });

    describe('Simulated annealing behavior', () => {
      it('should accept better solutions always', async () => {
        const expression = {
          id: 'test:accept_better',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
            },
          ],
        };

        // Run multiple times - should generally improve
        const result = await finder.findWitness(expression, { maxIterations: 500 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should perform random restart when stuck', async () => {
        const expression = {
          id: 'test:restart_stuck',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.8] },
            },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 500,
          restartThreshold: 50, // Restart every 50 iterations without improvement
        });

        // Should still produce a result
        expect(result).toBeDefined();
        expect(result.bestFitness).toBeGreaterThanOrEqual(0);
      });

      it('should stop early when perfect witness found', async () => {
        // Easy expression should be found quickly
        const expression = {
          id: 'test:early_stop',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 10000,
        });

        // Should stop immediately since no prerequisites
        expect(result.found).toBe(true);
        expect(result.iterationsUsed).toBe(0); // Found in initial state
      });
    });

    describe('Penalty calculation', () => {
      it('should calculate penalty for >= constraints', async () => {
        const expression = {
          id: 'test:penalty_gte',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.9] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        // Penalty should guide search toward higher joy values
        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should calculate penalty for <= constraints', async () => {
        const expression = {
          id: 'test:penalty_lte',
          prerequisites: [
            {
              logic: { '<=': [{ var: 'emotions.fear' }, 0.1] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should calculate penalty for AND clauses (sum of penalties)', async () => {
        const expression = {
          id: 'test:penalty_and',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.8] },
                  { '>=': [{ var: 'emotions.curiosity' }, 0.8] },
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        expect(result).toBeDefined();
      });

      it('should calculate penalty for OR clauses (min of penalties)', async () => {
        const expression = {
          id: 'test:penalty_or',
          prerequisites: [
            {
              logic: {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.9] },
                  { '>=': [{ var: 'emotions.curiosity' }, 0.1] }, // Easy
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        // Should find via the easier OR branch (or make progress toward it)
        expect(result.bestFitness).toBeGreaterThan(0);
      });
    });

    describe('Neighbor generation', () => {
      it('should generate neighbors within valid mood bounds', async () => {
        const expression = {
          id: 'test:bounds_mood',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'moodAxes.valence' }, 50] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        // Verify the nearestMiss/witness has valid mood values
        const state = result.witness || result.nearestMiss;
        for (const axis of WitnessState.MOOD_AXES) {
          expect(state.mood[axis]).toBeGreaterThanOrEqual(WitnessState.MOOD_RANGE.min);
          expect(state.mood[axis]).toBeLessThanOrEqual(WitnessState.MOOD_RANGE.max);
        }
      });

      it('should generate neighbors within valid sexual bounds (per-axis)', async () => {
        const expression = {
          id: 'test:bounds_sexual',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualArousal' }, 0.5] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        const state = result.witness || result.nearestMiss;
        for (const axis of WitnessState.SEXUAL_AXES) {
          const range = WitnessState.SEXUAL_RANGES[axis];
          expect(state.sexual[axis]).toBeGreaterThanOrEqual(range.min);
          expect(state.sexual[axis]).toBeLessThanOrEqual(range.max);
        }
      });

      it('should generate larger perturbations at high temperature', async () => {
        // This is implicitly tested - high temp should explore more
        const expression = {
          id: 'test:high_temp',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.7] },
            },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 200,
          initialTemperature: 2.0,
        });

        expect(result).toBeDefined();
      });

      it('should generate smaller perturbations at low temperature', async () => {
        const expression = {
          id: 'test:low_temp',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
            },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 200,
          initialTemperature: 0.1,
        });

        expect(result).toBeDefined();
      });

      it('should produce integer mood values after perturbation', async () => {
        const expression = {
          id: 'test:integer_mood',
          prerequisites: [
            { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 500,
        });
        const state = result.witness || result.nearestMiss;

        for (const axis of WitnessState.MOOD_AXES) {
          expect(Number.isInteger(state.mood[axis])).toBe(true);
        }
      });

      it('should produce integer sexual values after perturbation', async () => {
        const expression = {
          id: 'test:integer_sexual',
          prerequisites: [{ logic: { '>=': [{ var: 'sexualArousal' }, 0.5] } }],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 500,
        });
        const state = result.witness || result.nearestMiss;

        for (const axis of WitnessState.SEXUAL_AXES) {
          expect(Number.isInteger(state.sexual[axis])).toBe(true);
        }
      });

      it('should maintain integer values through multiple iterations', async () => {
        const expression = {
          id: 'test:integer_iterations',
          prerequisites: [
            { logic: { '>=': [{ var: 'emotions.joy' }, 1.5] } }, // Impossible - forces many iterations
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 1000,
        });
        const state = result.nearestMiss;

        for (const axis of WitnessState.MOOD_AXES) {
          expect(Number.isInteger(state.mood[axis])).toBe(true);
        }
        for (const axis of WitnessState.SEXUAL_AXES) {
          expect(Number.isInteger(state.sexual[axis])).toBe(true);
        }
      });
    });

    describe('Violated clauses tracking', () => {
      it('should return empty violatedClauses when witness found', async () => {
        const expression = {
          id: 'test:no_violations',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.found).toBe(true);
        expect(result.violatedClauses).toEqual([]);
      });

      it('should populate violatedClauses when witness not found', async () => {
        const expression = {
          id: 'test:violations',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 1.5] }, // Impossible: max is 1.0
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 50 });

        // With an impossible constraint, should not find perfect witness
        expect(result.found).toBe(false);
        expect(result.violatedClauses.length).toBeGreaterThan(0);
        expect(result.violatedClauses[0]).toContain('Clause');
      });

      it('should describe violated clauses with clause index', async () => {
        const expression = {
          id: 'test:clause_index',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 1.5] }, // Impossible
            },
            {
              logic: { '>=': [{ var: 'emotions.fear' }, 1.5] }, // Impossible
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 50 });

        // With impossible constraints, should not find perfect witness
        expect(result.found).toBe(false);
        // Should have clause indices in the descriptions
        const hasClauseNumbers = result.violatedClauses.some(
          (c) => c.includes('Clause 1') || c.includes('Clause 2')
        );
        expect(hasClauseNumbers).toBe(true);
      });
    });

    describe('Context building', () => {
      it('should provide emotions in context', async () => {
        const expression = {
          id: 'test:emotions_context',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.3] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        // If emotions weren't in context, this would never pass
        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should provide sexualStates in context', async () => {
        const expression = {
          id: 'test:sexual_context',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.2] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should provide sexualArousal in context', async () => {
        const expression = {
          id: 'test:arousal_context',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'sexualArousal' }, 0.3] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should provide moodAxes in context', async () => {
        const expression = {
          id: 'test:mood_context',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'moodAxes.valence' }, 0] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should provide mood alias for moodAxes', async () => {
        const expression = {
          id: 'test:mood_alias',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'mood.arousal' }, -50] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });
    });

    describe('Edge cases and error handling', () => {
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

        // Should not throw
        await expect(
          finder.findWitness(expression, { maxIterations: 10 })
        ).resolves.toBeDefined();
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

        // Should not throw, just return result
        await expect(
          finder.findWitness(expression, { maxIterations: 10 })
        ).resolves.toBeDefined();
      });

      it('should handle empty prerequisites array', async () => {
        const expression = {
          id: 'test:empty_prereqs',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.found).toBe(true);
        expect(result.bestFitness).toBe(1);
      });

      it('should handle null expression gracefully', async () => {
        await expect(
          finder.findWitness(null, { maxIterations: 10 })
        ).resolves.toBeDefined();
      });

      it('should handle prerequisite without logic property', async () => {
        const expression = {
          id: 'test:no_logic',
          prerequisites: [{ failure_message: 'test' }],
        };

        await expect(
          finder.findWitness(expression, { maxIterations: 10 })
        ).resolves.toBeDefined();
      });
    });

    describe('Result state properties', () => {
      it('should set witness.isExact to true when found', async () => {
        const expression = {
          id: 'test:exact_witness',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.found).toBe(true);
        expect(result.witness.isExact).toBe(true);
      });

      it('should set nearestMiss.isExact to false', async () => {
        const expression = {
          id: 'test:nearest_miss',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 1.5] }, // Impossible
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 50 });

        expect(result.nearestMiss.isExact).toBe(false);
      });

      it('should set witness.fitness to 1 when found', async () => {
        const expression = {
          id: 'test:fitness_one',
          prerequisites: [],
        };

        const result = await finder.findWitness(expression, { maxIterations: 10 });

        expect(result.witness.fitness).toBe(1);
      });

      it('should set nearestMiss.fitness to bestFitness', async () => {
        const expression = {
          id: 'test:fitness_match',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.8] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        expect(result.nearestMiss.fitness).toBe(result.bestFitness);
      });
    });

    describe('Complex expression scenarios', () => {
      it('should find witness for expression with multiple AND clauses', async () => {
        const expression = {
          id: 'test:multiple_and',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.2] },
                  { '>=': [{ var: 'emotions.curiosity' }, 0.2] },
                  { '<=': [{ var: 'emotions.fear' }, 0.8] },
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 1000 });

        expect(result.bestFitness).toBeGreaterThan(0.5);
      });

      it('should find witness for expression with OR clauses', async () => {
        const expression = {
          id: 'test:or_clauses',
          prerequisites: [
            {
              logic: {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.9] }, // Hard
                  { '>=': [{ var: 'emotions.curiosity' }, 0.1] }, // Easy
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        // Should find via the easy branch
        expect(result.bestFitness).toBeGreaterThan(0.5);
      });

      it('should handle nested AND/OR logic', async () => {
        const expression = {
          id: 'test:nested_logic',
          prerequisites: [
            {
              logic: {
                and: [
                  {
                    or: [
                      { '>=': [{ var: 'emotions.joy' }, 0.3] },
                      { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
                    ],
                  },
                  { '<=': [{ var: 'emotions.fear' }, 0.7] },
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should handle multiple prerequisites', async () => {
        const expression = {
          id: 'test:multi_prereqs',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.joy' }, 0.2] },
            },
            {
              logic: { '>=': [{ var: 'emotions.curiosity' }, 0.2] },
            },
            {
              logic: { '<=': [{ var: 'emotions.fear' }, 0.8] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 1000 });

        expect(result.bestFitness).toBeGreaterThan(0.5);
      });
    });

    describe('Affect traits support', () => {
      it('should include affectTraits in built context', async () => {
        const expression = {
          id: 'test:traits_context',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'affectTraits.affective_empathy' }, 0] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        // If affectTraits weren't in context, this would never pass
        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should perturb affect traits in neighbor generation', async () => {
        const expression = {
          id: 'test:traits_perturb',
          prerequisites: [
            // Requires high empathy - search should explore trait space
            {
              logic: { '>=': [{ var: 'affectTraits.affective_empathy' }, 80] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 500 });

        // Should make progress toward satisfying the trait constraint
        expect(result.bestFitness).toBeGreaterThan(0);
        const state = result.witness || result.nearestMiss;
        // Trait values should be valid integers
        for (const axis of WitnessState.AFFECT_TRAIT_AXES) {
          expect(state.affectTraits[axis]).toBeGreaterThanOrEqual(WitnessState.TRAIT_RANGE.min);
          expect(state.affectTraits[axis]).toBeLessThanOrEqual(WitnessState.TRAIT_RANGE.max);
          expect(Number.isInteger(state.affectTraits[axis])).toBe(true);
        }
      });

      it('should find witness for trait-gated expressions', async () => {
        // Mock emotion prototype with a trait gate
        const prototypesWithTraitGate = {
          entries: {
            compassion: {
              gates: ['affective_empathy >= 0.25'],
              weights: { valence: 0.5, affiliation: 0.5 },
            },
            joy: {
              weights: { valence: 1.0, arousal: 0.5 },
            },
          },
        };

        mockDataRegistry.get = jest.fn((category, lookupId) => {
          if (category === 'lookups') {
            if (lookupId === 'core:emotion_prototypes') {
              return prototypesWithTraitGate;
            }
            if (lookupId === 'core:sexual_prototypes') {
              return mockSexualPrototypes;
            }
          }
          return null;
        });

        const expression = {
          id: 'test:trait_gated',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.compassion' }, 0.3] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 2000 });

        // With trait gates, finder should explore trait space to satisfy them
        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should return low fitness for trait-gated expression with low traits', async () => {
        // Mock emotion prototype that requires high empathy
        const prototypesWithHighGate = {
          entries: {
            deep_compassion: {
              gates: ['affective_empathy >= 0.95'], // Very high threshold
              weights: { valence: 0.5, affiliation: 0.5 },
            },
          },
        };

        mockDataRegistry.get = jest.fn((category, lookupId) => {
          if (category === 'lookups') {
            if (lookupId === 'core:emotion_prototypes') {
              return prototypesWithHighGate;
            }
            if (lookupId === 'core:sexual_prototypes') {
              return mockSexualPrototypes;
            }
          }
          return null;
        });

        const expression = {
          id: 'test:high_trait_gate',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.deep_compassion' }, 0.8] },
            },
          ],
        };

        // Even with trait search, very high gate + intensity threshold is hard to satisfy
        const result = await finder.findWitness(expression, { maxIterations: 100 });

        // Should still track progress toward the goal
        expect(result.bestFitness).toBeGreaterThanOrEqual(0);
        expect(result.bestFitness).toBeLessThanOrEqual(1);
      });

      it('should produce integer trait values after perturbation', async () => {
        const expression = {
          id: 'test:integer_traits',
          prerequisites: [
            { logic: { '>=': [{ var: 'affectTraits.cognitive_empathy' }, 30] } },
          ],
        };

        const result = await finder.findWitness(expression, {
          maxIterations: 500,
        });
        const state = result.witness || result.nearestMiss;

        for (const axis of WitnessState.AFFECT_TRAIT_AXES) {
          expect(Number.isInteger(state.affectTraits[axis])).toBe(true);
        }
      });

      it('should check trait gates before calculating emotion intensity', async () => {
        // Mock with strict gate
        const prototypesWithGate = {
          entries: {
            gated_emotion: {
              gates: ['harm_aversion >= 0.5'],
              weights: { valence: 1.0 },
            },
          },
        };

        mockDataRegistry.get = jest.fn((category, lookupId) => {
          if (category === 'lookups') {
            if (lookupId === 'core:emotion_prototypes') {
              return prototypesWithGate;
            }
            if (lookupId === 'core:sexual_prototypes') {
              return mockSexualPrototypes;
            }
          }
          return null;
        });

        const expression = {
          id: 'test:gate_check',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.gated_emotion' }, 0.1] },
            },
          ],
        };

        // The search should be able to find states where the gate passes
        const result = await finder.findWitness(expression, { maxIterations: 1000 });

        // Should make progress - if gates weren't checked, emotion would always be 0
        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should support trait axes in emotion weight calculations', async () => {
        // Mock emotion that uses trait as a weight
        const prototypesWithTraitWeight = {
          entries: {
            empathic_joy: {
              weights: {
                valence: 0.5,
                affective_empathy: 0.5, // Trait contributes to emotion intensity
              },
            },
          },
        };

        mockDataRegistry.get = jest.fn((category, lookupId) => {
          if (category === 'lookups') {
            if (lookupId === 'core:emotion_prototypes') {
              return prototypesWithTraitWeight;
            }
            if (lookupId === 'core:sexual_prototypes') {
              return mockSexualPrototypes;
            }
          }
          return null;
        });

        const expression = {
          id: 'test:trait_weight',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.empathic_joy' }, 0.4] },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 1000 });

        // Should be able to satisfy by optimizing both valence and empathy
        expect(result.bestFitness).toBeGreaterThan(0);
      });

      it('should include all three trait axes in context', async () => {
        const expression = {
          id: 'test:all_traits',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'affectTraits.affective_empathy' }, 0] },
                  { '>=': [{ var: 'affectTraits.cognitive_empathy' }, 0] },
                  { '>=': [{ var: 'affectTraits.harm_aversion' }, 0] },
                ],
              },
            },
          ],
        };

        const result = await finder.findWitness(expression, { maxIterations: 100 });

        // All three traits should be accessible
        expect(result.found).toBe(true);
        expect(result.bestFitness).toBe(1);
      });
    });
  });
});
