/**
 * @file Unit tests for RecommendationFactsBuilder new data dependency fields.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationFactsBuilder from '../../../../src/expressionDiagnostics/services/RecommendationFactsBuilder.js';

describe('RecommendationFactsBuilder', () => {
  describe('moodRegime.bounds computation', () => {
    it('computes bounds from >= constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-gte',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 20] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({ valence: { min: 0.2 } });
    });

    it('computes bounds from <= constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-lte',
        prerequisites: [{ logic: { '<=': [{ var: 'moodAxes.arousal' }, 50] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({ arousal: { max: 0.5 } });
    });

    it('computes bounds from multiple constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-multi',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.valence' }, 30] },
                { '<=': [{ var: 'moodAxes.arousal' }, 70] },
              ],
            },
          },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({
        valence: { min: 0.3 },
        arousal: { max: 0.7 },
      });
    });

    it('returns empty bounds when no mood constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-bounds',
        prerequisites: [{ logic: { '==': [{ var: 'someVar' }, 1] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });
  });

  describe('storedMoodRegimeContexts filtering', () => {
    it('filters contexts by mood constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:filter-contexts',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } }],
      };
      const simulationResult = {
        sampleCount: 4,
        storedContexts: [
          { moodAxes: { valence: 60 } },
          { moodAxes: { valence: 40 } },
          { moodAxes: { valence: 70 } },
          { moodAxes: { valence: 30 } },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.storedMoodRegimeContexts).toHaveLength(2);
      expect(facts.storedMoodRegimeContexts[0].moodAxes.valence).toBe(60);
      expect(facts.storedMoodRegimeContexts[1].moodAxes.valence).toBe(70);
    });

    it('returns empty array when no stored contexts', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-contexts',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.storedMoodRegimeContexts).toEqual([]);
    });

    it('returns empty array when no mood constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-constraints',
        prerequisites: [],
      };
      const simulationResult = {
        sampleCount: 2,
        storedContexts: [{ moodAxes: { valence: 60 } }],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.storedMoodRegimeContexts).toEqual([]);
    });
  });

  describe('prototypeDefinitions extraction', () => {
    it('returns empty object when no prototypeFitRankingService', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:no-service', prerequisites: [] };
      const simulationResult = {
        sampleCount: 10,
        prototypeEvaluationSummary: {
          emotions: { joy: { moodSampleCount: 10 } },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.prototypeDefinitions).toEqual({});
    });

    it('extracts definitions from prototypeFitRankingService', () => {
      const mockService = {
        getPrototypeDefinitions: (refs) => {
          const definitions = {};
          for (const ref of refs) {
            const key =
              ref.type === 'emotion'
                ? `emotions:${ref.id}`
                : `sexualStates:${ref.id}`;
            definitions[key] = {
              weights: { valence: 0.8, arousal: 0.2 },
              gates: ['valence >= 0'],
            };
          }
          return definitions;
        },
        analyzeAllPrototypeFit: () => null,
        computeImpliedPrototype: () => null,
        detectPrototypeGaps: () => null,
      };

      const builder = new RecommendationFactsBuilder({
        prototypeFitRankingService: mockService,
      });
      const expression = { id: 'test:with-service', prerequisites: [] };
      const simulationResult = {
        sampleCount: 10,
        prototypeEvaluationSummary: {
          emotions: { joy: { moodSampleCount: 10 } },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.prototypeDefinitions).toEqual({
        'emotions:joy': {
          weights: { valence: 0.8, arousal: 0.2 },
          gates: ['valence >= 0'],
        },
      });
    });
  });

  describe('prototypeFit integration', () => {
    it('returns null when no prototypeFitRankingService', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-fit-service',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.prototypeFit).toBeNull();
    });

    it('populates prototypeFit from service', () => {
      const mockFitResult = {
        leaderboard: [
          { prototypeId: 'joy', combinedScore: 0.8 },
          { prototypeId: 'sadness', combinedScore: 0.3 },
        ],
      };
      const mockService = {
        getPrototypeDefinitions: () => ({}),
        analyzeAllPrototypeFit: () => mockFitResult,
        computeImpliedPrototype: () => null,
        detectPrototypeGaps: () => null,
      };

      const builder = new RecommendationFactsBuilder({
        prototypeFitRankingService: mockService,
      });
      const expression = {
        id: 'test:fit-result',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.prototypeFit).toEqual(mockFitResult);
    });
  });

  describe('gapDetection integration', () => {
    it('returns null when no prototypeFitRankingService', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-gap-service',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.gapDetection).toBeNull();
    });

    it('populates gapDetection from service', () => {
      const mockGapResult = {
        gapDetected: true,
        nearestDistance: 0.6,
        kNearestNeighbors: [{ prototypeId: 'joy', distance: 0.6 }],
      };
      const mockService = {
        getPrototypeDefinitions: () => ({}),
        analyzeAllPrototypeFit: () => null,
        computeImpliedPrototype: () => null,
        detectPrototypeGaps: () => mockGapResult,
      };

      const builder = new RecommendationFactsBuilder({
        prototypeFitRankingService: mockService,
      });
      const expression = {
        id: 'test:gap-result',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.gapDetection).toEqual(mockGapResult);
    });
  });

  describe('targetSignature derivation', () => {
    it('returns null when no prototypeFitRankingService', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-sig-service',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.targetSignature).toBeNull();
    });

    it('serializes targetSignature Map to plain object', () => {
      const targetSignatureMap = new Map([
        [
          'valence',
          { direction: 1, tightness: 0.5, lastMileWeight: 0.3, importance: 0.8 },
        ],
        [
          'arousal',
          { direction: -1, tightness: 0.3, lastMileWeight: 0.2, importance: 0.4 },
        ],
      ]);
      const mockService = {
        getPrototypeDefinitions: () => ({}),
        analyzeAllPrototypeFit: () => null,
        computeImpliedPrototype: () => ({ targetSignature: targetSignatureMap }),
        detectPrototypeGaps: () => null,
      };

      const builder = new RecommendationFactsBuilder({
        prototypeFitRankingService: mockService,
      });
      const expression = {
        id: 'test:sig-serialization',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.targetSignature).toEqual({
        valence: {
          direction: 1,
          tightness: 0.5,
          lastMileWeight: 0.3,
          importance: 0.8,
        },
        arousal: {
          direction: -1,
          tightness: 0.3,
          lastMileWeight: 0.2,
          importance: 0.4,
        },
      });
    });
  });

  describe('determinism invariants', () => {
    it('produces identical output for identical inputs', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:determinism',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.valence' }, 30] },
                { '<=': [{ var: 'moodAxes.arousal' }, 70] },
              ],
            },
          },
        ],
      };
      const simulationResult = {
        sampleCount: 5,
        storedContexts: [
          { moodAxes: { valence: 40, arousal: 50 } },
          { moodAxes: { valence: 60, arousal: 30 } },
        ],
      };

      const facts1 = builder.build({ expression, simulationResult });
      const facts2 = builder.build({ expression, simulationResult });

      expect(JSON.stringify(facts1)).toBe(JSON.stringify(facts2));
    });
  });

  describe('backward compatibility', () => {
    it('preserves existing fields unchanged', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:backward-compat',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        inRegimeSampleCount: 8,
        triggerRate: 0.6,
        clauseFailures: [],
      };

      const facts = builder.build({ expression, simulationResult });

      // Existing fields must be present and correct
      expect(facts.expressionId).toBe('test:backward-compat');
      expect(facts.sampleCount).toBe(10);
      expect(facts.moodRegime.definition).toBeDefined();
      expect(facts.moodRegime.sampleCount).toBe(8);
      expect(facts.overallPassRate).toBe(0.6);
      expect(facts.clauses).toEqual([]);
      expect(facts.prototypes).toEqual([]);
      // invariants is populated by InvariantValidator based on overallPassRate
      expect(Array.isArray(facts.invariants)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles prototypeFitRankingService errors gracefully', () => {
      const mockService = {
        getPrototypeDefinitions: () => ({}),
        analyzeAllPrototypeFit: () => {
          throw new Error('Service error');
        },
        computeImpliedPrototype: () => null,
        detectPrototypeGaps: () => null,
      };
      const mockLogger = { warn: () => {} };

      const builder = new RecommendationFactsBuilder({
        prototypeFitRankingService: mockService,
        logger: mockLogger,
      });
      const expression = {
        id: 'test:error-handling',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      // Should not throw, should return null for failed analysis
      expect(facts.prototypeFit).toBeNull();
      expect(facts.gapDetection).toBeNull();
      expect(facts.targetSignature).toBeNull();
    });
  });
});
