/**
 * @file Unit tests for ConstructiveWitnessSearcher
 * @see src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js
 * @see tickets/MONCARACTIMP-007-constructive-witness-searcher-tests.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ConstructiveWitnessSearcher from '../../../../src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js';

describe('ConstructiveWitnessSearcher', () => {
  let searcher;
  let mockLogger;
  let mockStateGenerator;
  let mockExpressionEvaluator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockStateGenerator = {
      generate: jest.fn(),
    };

    mockExpressionEvaluator = {
      evaluatePrerequisite: jest.fn(),
    };

    searcher = new ConstructiveWitnessSearcher({
      logger: mockLogger,
      stateGenerator: mockStateGenerator,
      expressionEvaluator: mockExpressionEvaluator,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(searcher).toBeInstanceOf(ConstructiveWitnessSearcher);
    });

    it('should throw on missing logger', () => {
      expect(
        () =>
          new ConstructiveWitnessSearcher({
            stateGenerator: mockStateGenerator,
            expressionEvaluator: mockExpressionEvaluator,
          })
      ).toThrow();
    });

    it('should throw on missing stateGenerator', () => {
      expect(
        () =>
          new ConstructiveWitnessSearcher({
            logger: mockLogger,
            expressionEvaluator: mockExpressionEvaluator,
          })
      ).toThrow();
    });

    it('should throw on missing expressionEvaluator', () => {
      expect(
        () =>
          new ConstructiveWitnessSearcher({
            logger: mockLogger,
            stateGenerator: mockStateGenerator,
          })
      ).toThrow();
    });

    it('should accept custom config', () => {
      const customConfig = {
        maxSamples: 1000,
        hillClimbSeeds: 5,
        hillClimbIterations: 50,
        timeoutMs: 3000,
        minAndBlockScore: 0.6,
        perturbationDelta: 0.02,
      };

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: customConfig,
      });

      expect(customSearcher).toBeInstanceOf(ConstructiveWitnessSearcher);
    });
  });

  describe('search()', () => {
    describe('when all prerequisites pass', () => {
      it('should return found=true with andBlockScore=1.0', async () => {
        const expression = {
          prerequisites: [
            { id: 'prereq1', logic: { '>=': [{ var: 'mood' }, 0.5] } },
            { id: 'prereq2', logic: { '>=': [{ var: 'trust' }, 0.3] } },
          ],
        };

        const sampleState = { mood: 80, trust: 70 };
        mockStateGenerator.generate.mockReturnValue(sampleState);
        mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

        const result = await searcher.search(expression);

        expect(result.found).toBe(true);
        expect(result.andBlockScore).toBe(1.0);
        expect(result.blockingClauses).toHaveLength(0);
      });
    });

    describe('when no perfect witness exists', () => {
      it('should return best partial candidate after hill climbing', async () => {
        const expression = {
          prerequisites: [
            { id: 'prereq1', logic: { '>=': [{ var: 'mood' }, 0.5] } },
            { id: 'prereq2', logic: { '>=': [{ var: 'trust' }, 0.7] } },
            { id: 'prereq3', logic: { '>=': [{ var: 'energy' }, 0.9] } },
          ],
        };

        mockStateGenerator.generate.mockReturnValue({
          mood: 60,
          trust: 40,
          energy: 30,
        });
        // First prereq passes, others fail
        mockExpressionEvaluator.evaluatePrerequisite.mockImplementation(
          (prereq) => prereq.id === 'prereq1'
        );

        const result = await searcher.search(expression);

        expect(result.found).toBe(false);
        expect(result.bestCandidateState).toBeDefined();
        expect(result.andBlockScore).toBeGreaterThan(0);
        expect(result.andBlockScore).toBeLessThan(1);
        expect(result.blockingClauses.length).toBeGreaterThan(0);
      });
    });

    describe('minAndBlockScore threshold', () => {
      it('should return found=false if score below minimum', async () => {
        const expression = {
          prerequisites: [
            { id: 'prereq1' },
            { id: 'prereq2' },
            { id: 'prereq3' },
            { id: 'prereq4' },
          ],
        };

        mockStateGenerator.generate.mockReturnValue({ mood: 10 });
        // Only 1 of 4 passes = 0.25 score
        mockExpressionEvaluator.evaluatePrerequisite.mockImplementation(
          (prereq) => prereq.id === 'prereq1'
        );

        const result = await searcher.search(expression);

        // Default minAndBlockScore = 0.5, so 0.25 should be found=false
        expect(result.found).toBe(false);
        expect(result.andBlockScore).toBeLessThan(0.5);
      });
    });

    describe('timeout behavior', () => {
      it('should respect timeout and return best result so far', async () => {
        const expression = {
          prerequisites: [{ id: 'prereq1' }],
        };

        mockStateGenerator.generate.mockImplementation(() => ({
          mood: Math.random() * 100,
        }));
        mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

        const customSearcher = new ConstructiveWitnessSearcher({
          logger: mockLogger,
          stateGenerator: mockStateGenerator,
          expressionEvaluator: mockExpressionEvaluator,
          config: {
            timeoutMs: 100,
            maxSamples: 100000,
            hillClimbSeeds: 10,
            hillClimbIterations: 100,
            perturbationDelta: 0.01,
            minAndBlockScore: 0.5,
          },
        });

        const start = Date.now();
        const result = await customSearcher.search(expression);
        const elapsed = Date.now() - start;

        // Should finish within reasonable time of timeout
        expect(elapsed).toBeLessThan(500);
        expect(result.searchStats.timeMs).toBeDefined();
      });
    });
  });

  describe('hill climbing', () => {
    it('should track hill climb iterations in stats', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 30 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.searchStats.hillClimbIterations).toBeDefined();
      expect(typeof result.searchStats.hillClimbIterations).toBe('number');
    });

    it('should use multiple seeds for diversity', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      const sampledStates = [];
      mockStateGenerator.generate.mockImplementation(() => {
        const state = { mood: Math.random() * 100 };
        sampledStates.push(state);
        return state;
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      await searcher.search(expression);

      // Should have sampled multiple states
      expect(sampledStates.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('blocking clause analysis', () => {
    it('should include detailed info for each blocking clause', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'confusion_check',
            description: 'Mood >= 80',
            logic: { '>=': [{ var: 'mood' }, 80] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 60 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
      const blocker = result.blockingClauses[0];
      expect(blocker.clauseId).toBe('confusion_check');
      expect(blocker.clauseDescription).toBe('Mood >= 80');
      expect(blocker.observedValue).toBeDefined();
      expect(blocker.threshold).toBeDefined();
      expect(blocker.gap).toBeDefined();
    });
  });

  describe('minimal adjustments', () => {
    it('should suggest adjustments for blocking clauses', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'mood_check',
            description: 'mood >= 80',
            logic: { '>=': [{ var: 'mood' }, 80] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 70 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.minimalAdjustments).toBeDefined();
      expect(result.minimalAdjustments.length).toBeGreaterThan(0);

      const adjustment = result.minimalAdjustments[0];
      expect(adjustment.clauseId).toBeDefined();
      expect(adjustment.currentThreshold).toBeDefined();
      expect(adjustment.suggestedThreshold).toBeDefined();
      expect(adjustment.delta).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(adjustment.confidence);
    });

    it('should order adjustments by smallest delta first', async () => {
      const expression = {
        prerequisites: [
          { id: 'p1', logic: { '>=': [{ var: 'a' }, 90] } },
          { id: 'p2', logic: { '>=': [{ var: 'b' }, 60] } },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ a: 50, b: 55 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.minimalAdjustments.length).toBeGreaterThanOrEqual(2);
      // Sorted by smallest absolute delta first
      expect(
        Math.abs(result.minimalAdjustments[0].delta)
      ).toBeLessThanOrEqual(Math.abs(result.minimalAdjustments[1].delta));
    });
  });

  describe('search statistics', () => {
    it('should track samples evaluated', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

      const result = await searcher.search(expression);

      expect(result.searchStats.samplesEvaluated).toBeGreaterThan(0);
    });

    it('should track elapsed time', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

      const result = await searcher.search(expression);

      expect(result.searchStats.timeMs).toBeDefined();
      expect(result.searchStats.timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty expression (no prerequisites)', async () => {
      const expression = { prerequisites: [] };

      const result = await searcher.search(expression);

      expect(result.found).toBe(false);
      expect(result.andBlockScore).toBe(0);
      expect(result.bestCandidateState).toBeNull();
    });

    it('should handle null expression', async () => {
      const result = await searcher.search(null);

      expect(result.found).toBe(false);
      expect(result.bestCandidateState).toBeNull();
    });

    it('should handle undefined expression', async () => {
      const result = await searcher.search(undefined);

      expect(result.found).toBe(false);
      expect(result.bestCandidateState).toBeNull();
    });

    it('should handle expression with single prerequisite', async () => {
      const expression = {
        prerequisites: [
          { id: 'single', logic: { '>=': [{ var: 'mood' }, 50] } },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 60 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

      const result = await searcher.search(expression);

      expect(result.found).toBe(true);
      expect(result.andBlockScore).toBe(1.0);
    });

    it('should handle stateGenerator returning same state repeatedly', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      const sameState = { mood: 50 };
      mockStateGenerator.generate.mockReturnValue(sameState);
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      // Should not infinite loop
      const result = await searcher.search(expression);

      expect(result).toBeDefined();
      expect(result.searchStats.timeMs).toBeDefined();
    });

    it('should handle evaluator throwing error gracefully', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockImplementation(() => {
        throw new Error('Evaluation failed');
      });

      // Should handle gracefully, not throw
      const result = await searcher.search(expression);
      expect(result.found).toBe(false);
    });

    it('should handle stateGenerator throwing error', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      const result = await searcher.search(expression);

      expect(result.found).toBe(false);
      expect(result.bestCandidateState).toBeNull();
    });
  });

  describe('config validation', () => {
    it('should use default config when not provided', () => {
      const defaultSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
      });

      expect(defaultSearcher).toBeInstanceOf(ConstructiveWitnessSearcher);
    });

    it('should merge partial config with defaults', () => {
      const partialConfig = { maxSamples: 100 };

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: partialConfig,
      });

      expect(customSearcher).toBeInstanceOf(ConstructiveWitnessSearcher);
    });
  });

  describe('expression description extraction', () => {
    it('should use description from prerequisite when available', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            description: 'Custom description',
            logic: { '>=': [{ var: 'mood' }, 80] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses[0].clauseDescription).toBe(
        'Custom description'
      );
    });

    it('should generate description from logic when not provided', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: { '>=': [{ var: 'emotion.anxiety' }, 0.5] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({
        emotion: { anxiety: 0.3 },
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses[0].clauseDescription).toContain('>=');
    });
  });

  describe('options parameter', () => {
    it('should allow timeout override via options', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const start = Date.now();
      await searcher.search(expression, null, { timeoutMs: 50 });
      const elapsed = Date.now() - start;

      // Should respect the shorter timeout
      expect(elapsed).toBeLessThan(200);
    });

    it('should allow maxSamples override via options', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      let sampleCount = 0;
      mockStateGenerator.generate.mockImplementation(() => {
        sampleCount++;
        return { mood: 50 };
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

      await searcher.search(expression, null, { maxSamples: 50 });

      // With very short maxSamples, should not sample too many
      expect(sampleCount).toBeLessThanOrEqual(100);
    });
  });

  describe('comparison operator handling', () => {
    it('should handle >= comparison in logic', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: { '>=': [{ var: 'mood' }, 50] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 40 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses[0].threshold).toBe(50);
    });

    it('should handle <= comparison in logic', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: { '<=': [{ var: 'stress' }, 30] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ stress: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
    });

    it('should handle == comparison in logic', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: { '==': [{ var: 'state' }, 'active'] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ state: 'inactive' });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
    });
  });

  describe('nested state values', () => {
    it('should handle deeply nested state values', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: { '>=': [{ var: 'actor.emotions.joy' }, 50] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({
        actor: { emotions: { joy: 30 } },
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
      expect(result.blockingClauses[0].observedValue).toBe(30);
    });
  });

  describe('domain-specific perturbation bounds', () => {
    it('should handle state with affectTraits fields', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      // Return state with affectTraits that triggers bounds checking
      mockStateGenerator.generate.mockReturnValue({
        affectTraits: { openness: 50 },
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 100,
          hillClimbSeeds: 2,
          hillClimbIterations: 10,
          timeoutMs: 1000,
          minAndBlockScore: 0.5,
          perturbationDelta: 0.5,
        },
      });

      const result = await customSearcher.search(expression);

      expect(result).toBeDefined();
      expect(result.searchStats.hillClimbIterations).toBeGreaterThan(0);
    });

    it('should handle state with baseline_libido field', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({
        baseline_libido: 10,
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 100,
          hillClimbSeeds: 2,
          hillClimbIterations: 10,
          timeoutMs: 1000,
          minAndBlockScore: 0.5,
          perturbationDelta: 0.5,
        },
      });

      const result = await customSearcher.search(expression);

      expect(result).toBeDefined();
    });

    it('should handle state with sex_excitation field', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({
        sex_excitation: 50,
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 100,
          hillClimbSeeds: 2,
          hillClimbIterations: 10,
          timeoutMs: 1000,
          minAndBlockScore: 0.5,
          perturbationDelta: 0.5,
        },
      });

      const result = await customSearcher.search(expression);

      expect(result).toBeDefined();
    });

    it('should handle state with mood field', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({
        mood: { happiness: 50 },
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 100,
          hillClimbSeeds: 2,
          hillClimbIterations: 10,
          timeoutMs: 1000,
          minAndBlockScore: 0.5,
          perturbationDelta: 0.5,
        },
      });

      const result = await customSearcher.search(expression);

      expect(result).toBeDefined();
    });
  });

  describe('timeout result handling', () => {
    it('should return timeout result when seeding phase times out', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      // Make stateGenerator produce states continuously
      mockStateGenerator.generate.mockImplementation(() => {
        // Simulate state generation
        const state = { mood: 50 };
        return state;
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 100000,
          hillClimbSeeds: 10,
          hillClimbIterations: 100,
          timeoutMs: 10, // Very short timeout
          minAndBlockScore: 0.5,
          perturbationDelta: 0.01,
        },
      });

      const result = await customSearcher.search(expression);

      // Should complete with some result even if timed out
      expect(result).toBeDefined();
      expect(result.searchStats.timeMs).toBeDefined();
    });

    it('should return found=true in timeout result if score meets threshold', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 80 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

      const customSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 10,
          hillClimbSeeds: 1,
          hillClimbIterations: 1,
          timeoutMs: 50,
          minAndBlockScore: 0.5,
          perturbationDelta: 0.01,
        },
      });

      const result = await customSearcher.search(expression);

      expect(result.found).toBe(true);
      expect(result.andBlockScore).toBe(1.0);
    });
  });

  describe('blocking info extraction edge cases', () => {
    it('should use fallback description when prerequisite has no logic', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'no_logic_prereq',
            // No logic property
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 50 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
      expect(result.blockingClauses[0].clauseDescription).toBe('Unknown clause');
    });

    it('should use clauseDescription when description is not present', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            clauseDescription: 'Alternative description field',
            logic: { '>=': [{ var: 'mood' }, 50] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 30 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses[0].clauseDescription).toBe(
        'Alternative description field'
      );
    });

    it('should handle logic with number on left and var on right', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: { '>=': [50, { var: 'mood' }] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 30 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
      expect(result.blockingClauses[0].threshold).toBe(50);
      expect(result.blockingClauses[0].observedValue).toBe(30);
    });

    it('should truncate long logic descriptions', async () => {
      const expression = {
        prerequisites: [
          {
            id: 'p1',
            logic: {
              and: [
                { '>=': [{ var: 'very.long.path.to.some.value' }, 100] },
                { '<=': [{ var: 'another.very.long.path' }, 50] },
                { '==': [{ var: 'yet.another.long.path' }, 'active'] },
              ],
            },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({
        very: { long: { path: { to: { some: { value: 10 } } } } },
        another: { very: { long: { path: 60 } } },
        yet: { another: { long: { path: 'inactive' } } },
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
      // Should have some description (possibly truncated)
      expect(result.blockingClauses[0].clauseDescription.length).toBeGreaterThan(
        0
      );
    });
  });

  describe('hill climbing early termination', () => {
    it('should stop hill climbing when perfect score is reached', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 80 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(true);

      const result = await searcher.search(expression);

      expect(result.found).toBe(true);
      expect(result.andBlockScore).toBe(1.0);
      // Should have terminated early since perfect score found
    });
  });

  describe('empty/invalid seed scenarios', () => {
    it('should handle case when no valid seeds generated', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      // All generations throw errors
      mockStateGenerator.generate.mockImplementation(() => {
        throw new Error('Cannot generate state');
      });

      const result = await searcher.search(expression);

      expect(result.found).toBe(false);
      expect(result.bestCandidateState).toBeNull();
    });
  });

  describe('prerequisite without id', () => {
    it('should generate clauseId when prereq has no id', async () => {
      const expression = {
        prerequisites: [
          {
            // No id field
            logic: { '>=': [{ var: 'mood' }, 50] },
          },
        ],
      };

      mockStateGenerator.generate.mockReturnValue({ mood: 30 });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      expect(result.blockingClauses).toHaveLength(1);
      expect(result.blockingClauses[0].clauseId).toBe('prereq_0');
    });
  });

  describe('state with no numeric paths', () => {
    it('should handle perturbation when state has only non-numeric values', async () => {
      const expression = {
        prerequisites: [{ id: 'prereq1' }],
      };

      mockStateGenerator.generate.mockReturnValue({
        status: 'active',
        name: 'test',
        tags: ['a', 'b'],
      });
      mockExpressionEvaluator.evaluatePrerequisite.mockReturnValue(false);

      const result = await searcher.search(expression);

      // Should complete without errors even if no numeric paths to perturb
      expect(result).toBeDefined();
      expect(result.searchStats.timeMs).toBeDefined();
    });
  });
});
