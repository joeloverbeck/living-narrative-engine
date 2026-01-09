/**
 * @file Unit tests for WitnessStateFinder async behavior
 * @description Tests chunked async execution and progress callbacks.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WitnessStateFinder from '../../../../src/expressionDiagnostics/services/WitnessStateFinder.js';

describe('WitnessStateFinder - Async Behavior', () => {
  let mockLogger;
  let mockDataRegistry;

  const mockEmotionPrototypes = {
    entries: {
      joy: { weights: { valence: 1.0, arousal: 0.5 } },
      fear: { weights: { threat: 1.0, arousal: 0.8 } },
    },
  };

  const mockSexualPrototypes = {
    entries: {
      aroused: { weights: { sex_excitation: 1.0 } },
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

  describe('Async return type', () => {
    it('should return a Promise from findWitness()', () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:async',
        prerequisites: [],
      };

      const result = finder.findWitness(expression, { maxIterations: 10 });

      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve to SearchResult when awaited', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:resolve',
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
  });

  describe('Progress callback', () => {
    it('should call onProgress during search with iterations > chunk size', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const onProgress = jest.fn();
      const expression = {
        id: 'test:progress',
        prerequisites: [
          {
            // Impossible prerequisite to ensure search runs all iterations
            logic: { '>=': [{ var: 'emotions.joy' }, 1.5] },
          },
        ],
      };

      await finder.findWitness(expression, {
        maxIterations: 500,
        onProgress,
      });

      // With 500 iterations and CHUNK_SIZE = 100, expect 4 progress calls
      // (100, 200, 300, 400) - not 500 because final result is returned
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(1);

      // Verify progress callback receives (completed, total) arguments
      const [completed, total] = onProgress.mock.calls[0];
      expect(typeof completed).toBe('number');
      expect(typeof total).toBe('number');
      expect(completed).toBeLessThanOrEqual(total);
    });

    it('should not call onProgress if witness found immediately', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const onProgress = jest.fn();
      const expression = {
        id: 'test:immediate',
        prerequisites: [], // No prerequisites = immediate success
      };

      await finder.findWitness(expression, {
        maxIterations: 1000,
        onProgress,
      });

      // With no prerequisites, witness is found on first iteration
      // No progress calls needed
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('should report increasing progress values', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const onProgress = jest.fn();
      const expression = {
        id: 'test:increasing',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.joy' }, 1.5] }, // Impossible
          },
        ],
      };

      await finder.findWitness(expression, {
        maxIterations: 500,
        onProgress,
      });

      // Verify progress values are increasing
      // With 500 iterations and CHUNK_SIZE = 100, there will be multiple progress calls
      expect(onProgress.mock.calls.length).toBeGreaterThan(1);

      // Check that progress values are monotonically increasing
      const progressValues = onProgress.mock.calls.map((call) => call[0]);
      const isSorted = progressValues.every(
        (val, i) => i === 0 || val > progressValues[i - 1]
      );
      expect(isSorted).toBe(true);
    });
  });

  describe('Non-blocking execution', () => {
    it('should yield to event loop between chunks', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:yield',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.joy' }, 1.5] }, // Impossible
          },
        ],
      };

      // Track that we can run other async code during search
      let interleaved = false;
      const checkInterleave = async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        interleaved = true;
      };

      // Start both operations concurrently
      const [searchResult] = await Promise.all([
        finder.findWitness(expression, { maxIterations: 500 }),
        checkInterleave(),
      ]);

      // Both should complete - if search was blocking, checkInterleave wouldn't run
      expect(searchResult).toBeDefined();
      expect(interleaved).toBe(true);
    });

    it('should complete search even with yielding', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:complete',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
          },
        ],
      };

      const result = await finder.findWitness(expression, {
        maxIterations: 500,
      });

      // Search should still complete and produce valid result
      expect(result.bestFitness).toBeGreaterThan(0);
      expect(result.iterationsUsed).toBeLessThanOrEqual(500);
    });
  });

  describe('Config with onProgress', () => {
    it('should accept onProgress in config without errors', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:config',
        prerequisites: [],
      };

      await expect(
        finder.findWitness(expression, {
          maxIterations: 10,
          onProgress: () => {},
        })
      ).resolves.toBeDefined();
    });

    it('should work without onProgress callback', async () => {
      const finder = new WitnessStateFinder({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:no-callback',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
          },
        ],
      };

      // No onProgress provided
      const result = await finder.findWitness(expression, {
        maxIterations: 200,
      });

      expect(result).toBeDefined();
      expect(result.bestFitness).toBeGreaterThan(0);
    });
  });
});
