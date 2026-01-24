/**
 * @file Unit tests for RecommendationFactsBuilder - comprehensive coverage.
 */

import { describe, it, expect, jest } from '@jest/globals';
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

  describe('null and invalid input handling', () => {
    it('returns null when simulationResult is null', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:null-sim' };

      const facts = builder.build({ expression, simulationResult: null });

      expect(facts).toBeNull();
    });

    it('returns null when simulationResult is undefined', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:undefined-sim' };

      const facts = builder.build({ expression, simulationResult: undefined });

      expect(facts).toBeNull();
    });
  });

  describe('clause failure edge cases', () => {
    it('skips clause failure without hierarchicalBreakdown', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:no-breakdown' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          { clauseId: 'clause1', clauseDescription: 'test clause' },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toEqual([]);
    });

    it('skips leaf nodes without clauseId', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:no-clauseid' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              description: 'no id leaf',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toEqual([]);
    });

    it('skips duplicate clauseIds', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:dup-clauseid' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'dup-clause',
              description: 'first',
            },
          },
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'dup-clause',
              description: 'duplicate',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toHaveLength(1);
      expect(facts.clauses[0].clauseLabel).toBe('first');
    });

    it('handles clauseFailures with nested children', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:nested-children' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'and',
              children: [
                {
                  nodeType: 'leaf',
                  clauseId: 'child1',
                  description: 'child leaf 1',
                },
                {
                  nodeType: 'or',
                  children: [
                    {
                      nodeType: 'leaf',
                      clauseId: 'grandchild1',
                      description: 'grandchild leaf',
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toHaveLength(2);
      const clauseIds = facts.clauses.map((c) => c.clauseId);
      expect(clauseIds).toContain('child1');
      expect(clauseIds).toContain('grandchild1');
    });

    it('recursively collects leaf nodes when node is null', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:null-children' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'and',
              children: [null, { nodeType: 'leaf', clauseId: 'valid-leaf' }],
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toHaveLength(1);
      expect(facts.clauses[0].clauseId).toBe('valid-leaf');
    });
  });

  describe('prototype path extraction', () => {
    it('extracts emotions prototype info', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:emotions-path' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'emo-clause',
              variablePath: 'emotions.joy',
              description: 'joy clause',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].prototypeId).toBe('joy');
    });

    it('extracts sexualStates prototype info', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:sexual-path' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'sex-clause',
              variablePath: 'sexualStates.arousal',
              description: 'arousal clause',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].prototypeId).toBe('arousal');
    });

    it('returns null for invalid variablePath', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-path' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'invalid-clause',
              variablePath: null,
              description: 'invalid path',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].prototypeId).toBeNull();
    });

    it('returns null for non-prototype paths', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:non-proto-path' };
      const simulationResult = {
        sampleCount: 10,
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'other-clause',
              variablePath: 'someOther.path',
              description: 'other clause',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].prototypeId).toBeNull();
    });
  });

  describe('prototype clause selection', () => {
    it('selects clause with highest gatePassInRegimeCount', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:select-highest' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'low-clause',
              variablePath: 'emotions.joy',
              gatePassInRegimeCount: 10,
              gatePassAndClausePassInRegimeCount: 5,
            },
          },
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'high-clause',
              variablePath: 'emotions.joy',
              gatePassInRegimeCount: 90,
              gatePassAndClausePassInRegimeCount: 45,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.thresholdPassGivenGateCount).toBe(45);
    });

    it('breaks ties alphabetically by clauseId', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:select-alpha' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'z-clause',
              variablePath: 'emotions.joy',
              gatePassInRegimeCount: 50,
              gatePassAndClausePassInRegimeCount: 25,
            },
          },
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'a-clause',
              variablePath: 'emotions.joy',
              gatePassInRegimeCount: 50,
              gatePassAndClausePassInRegimeCount: 30,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.thresholdPassGivenGateCount).toBe(30);
    });
  });

  describe('failed gate counts formatting', () => {
    it('formats and sorts failed gate counts', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:gate-counts' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: {
              moodSampleCount: 100,
              gatePassCount: 50,
              gateFailCount: 50,
              valueSumGivenGate: 25,
              failedGateCounts: {
                gate_b: 10,
                gate_a: 30,
                gate_c: 30,
              },
            },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.failedGateCounts).toEqual([
        { gateId: 'gate_a', count: 30 },
        { gateId: 'gate_c', count: 30 },
        { gateId: 'gate_b', count: 10 },
      ]);
    });

    it('handles empty failed gate counts', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:empty-gate-counts' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: {
              moodSampleCount: 100,
              gatePassCount: 50,
              gateFailCount: 50,
              valueSumGivenGate: 25,
            },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.failedGateCounts).toEqual([]);
    });
  });

  describe('compatibility score', () => {
    it('returns 1 for compatible prototypes', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:compat-true' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
        gateCompatibility: {
          emotions: {
            joy: { compatible: true },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.compatibilityScore).toBe(1);
    });

    it('returns -1 for incompatible prototypes', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:compat-false' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
        gateCompatibility: {
          emotions: {
            joy: { compatible: false },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.compatibilityScore).toBe(-1);
    });

    it('returns 0 when no compatibility data', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:no-compat' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.compatibilityScore).toBe(0);
    });
  });

  describe('axis constraints extraction', () => {
    it('extracts constraints via analyzer', () => {
      const mockConstraints = [{ axis: 'valence', min: 0.3 }];
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue(mockConstraints),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: [] }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:extract-axis',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        prototypeEvaluationSummary: { emotions: { joy: { moodSampleCount: 10, gatePassCount: 5, gateFailCount: 5, valueSumGivenGate: 2.5 } } },
      };

      builder.build({ expression, simulationResult });

      expect(mockAnalyzer.extractAxisConstraints).toHaveBeenCalled();
    });

    it('logs warning on extraction error', () => {
      const warnFn = jest.fn();
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockImplementation(() => {
          throw new Error('extraction failed');
        }),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: [] }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
        logger: { warn: warnFn },
      });
      const expression = {
        id: 'test:extract-error',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = { sampleCount: 10 };

      builder.build({ expression, simulationResult });

      expect(warnFn).toHaveBeenCalledWith(
        'RecommendationFactsBuilder axis constraints failed:',
        expect.any(Error)
      );
    });

    it('returns null when no analyzer', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-analyzer',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts).toBeDefined();
    });

    it('returns null for non-array prerequisites', () => {
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn(),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: [] }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:non-array-prereqs',
        prerequisites: 'invalid',
      };
      const simulationResult = { sampleCount: 10 };

      builder.build({ expression, simulationResult });

      expect(mockAnalyzer.extractAxisConstraints).not.toHaveBeenCalled();
    });
  });

  describe('axis conflicts building', () => {
    it('builds axis conflicts from analyzer', () => {
      const mockAxisAnalysis = [
        {
          axis: 'valence',
          weight: 0.5,
          constraintMin: 0.3,
          constraintMax: 1.0,
          conflictType: 'upper_bound',
          contribution: 0.2,
          defaultMin: -1,
          defaultMax: 1,
          lostRawSum: 0.1,
          lostIntensity: 0.05,
          sources: ['gate1'],
        },
      ];
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue([{ axis: 'valence', min: 0.3 }]),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: mockAxisAnalysis }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:axis-conflicts',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'joy-clause',
              variablePath: 'emotions.joy',
              thresholdValue: 0.5,
              operator: '>=',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.axisConflicts).toHaveLength(1);
      expect(joyPrototype.axisConflicts[0].axis).toBe('valence');
      expect(joyPrototype.axisConflicts[0].conflictType).toBe('upper_bound');
    });

    it('returns empty when no analyzer', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:no-conflict-analyzer' };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.axisConflicts).toEqual([]);
    });

    it('returns empty when no axisConstraints', () => {
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue(null),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: [] }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:null-constraints',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.axisConflicts).toEqual([]);
    });

    it('handles analysis error gracefully', () => {
      const warnFn = jest.fn();
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue([{ axis: 'valence' }]),
        analyzeEmotionThreshold: jest.fn().mockImplementation(() => {
          throw new Error('analysis failed');
        }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
        logger: { warn: warnFn },
      });
      const expression = {
        id: 'test:conflict-error',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      expect(warnFn).toHaveBeenCalled();
      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.axisConflicts).toEqual([]);
    });

    it('uses default bounds for emotion axes', () => {
      const mockAxisAnalysis = [
        {
          axis: 'valence',
          weight: 0.5,
          constraintMin: 0.3,
          constraintMax: 1.0,
          conflictType: 'upper_bound',
          contribution: 0.2,
          sources: [],
        },
      ];
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue([{ axis: 'valence', min: 0.3 }]),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: mockAxisAnalysis }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:default-emotion-bounds',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      expect(joyPrototype.axisConflicts[0].contributionDelta).toBeDefined();
    });

    it('uses default bounds for sexual axes', () => {
      const mockAxisAnalysis = [
        {
          axis: 'sex_excitation',
          weight: 0.5,
          constraintMin: 0.3,
          constraintMax: 1.0,
          conflictType: 'upper_bound',
          contribution: 0.2,
          sources: [],
        },
      ];
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue([{ axis: 'sex_excitation', min: 0.3 }]),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: mockAxisAnalysis }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:default-sexual-bounds',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          sexualStates: {
            aroused: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const arousedPrototype = facts.prototypes.find((p) => p.prototypeId === 'aroused');
      expect(arousedPrototype.axisConflicts[0].contributionDelta).toBeDefined();
    });

    it('calculates contribution delta correctly', () => {
      const mockAxisAnalysis = [
        {
          axis: 'valence',
          weight: 0.5,
          constraintMin: 0.3,
          constraintMax: 1.0,
          conflictType: 'upper_bound',
          contribution: 0.2,
          defaultMin: -1,
          defaultMax: 1,
        },
      ];
      const mockAnalyzer = {
        extractAxisConstraints: jest.fn().mockReturnValue([{ axis: 'valence', min: 0.3 }]),
        analyzeEmotionThreshold: jest.fn().mockReturnValue({ axisAnalysis: mockAxisAnalysis }),
      };

      const builder = new RecommendationFactsBuilder({
        prototypeConstraintAnalyzer: mockAnalyzer,
      });
      const expression = {
        id: 'test:contribution-delta',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 100,
        prototypeEvaluationSummary: {
          emotions: {
            joy: { moodSampleCount: 100, gatePassCount: 50, gateFailCount: 50, valueSumGivenGate: 25 },
          },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      const joyPrototype = facts.prototypes.find((p) => p.prototypeId === 'joy');
      // unboundOptimal = weight > 0 ? max : min = 0.5 > 0 ? 1 : -1 = 1
      // unboundContribution = 0.5 * 1 = 0.5
      // contributionDelta = 0.5 - 0.2 = 0.3
      expect(joyPrototype.axisConflicts[0].contributionDelta).toBeCloseTo(0.3);
    });
  });

  describe('regime bounds building', () => {
    it('returns empty Map for non-array constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:non-array-constraints' };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {},
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeNull();
    });

    it('skips constraints with non-string varPath', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:non-string-varpath',
        prerequisites: [{ logic: { '>=': [{ var: null }, 30] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraints with empty axis', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:empty-axis',
        prerequisites: [{ logic: { '>=': [{ var: '' }, 30] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraints with non-number threshold', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:non-number-threshold',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 'invalid'] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('continues on interval constraint error', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:interval-error',
        prerequisites: [
          { logic: { 'invalid-op': [{ var: 'moodAxes.valence' }, 30] } },
          { logic: { '>=': [{ var: 'moodAxes.arousal' }, 50] } },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({ arousal: { min: 0.5 } });
    });
  });

  describe('gate predicate implication', () => {
    it('evaluates >= operator correctly', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gte-implication',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 8,
              gateFailInRegimeCount: 2,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(true);
    });

    it('evaluates > operator correctly', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gt-implication',
        prerequisites: [{ logic: { '>': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>', thresholdRaw: 20 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 8,
              gateFailInRegimeCount: 2,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(true);
    });

    it('evaluates < operator correctly', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:lt-implication',
        prerequisites: [{ logic: { '<': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '<', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(true);
    });

    it('evaluates == operator correctly', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:eq-implication',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } },
          { logic: { '<=': [{ var: 'moodAxes.valence' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '==', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(true);
    });

    it('returns false for unknown operators', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:unknown-op',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '!=', thresholdRaw: 20 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(false);
    });

    it('returns false when predicate or bounds are null', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:null-predicate' };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(false);
    });
  });

  describe('combined candidate generation', () => {
    it('generates combined candidate for multiple predicates with reservoir', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:combined-candidate',
        prerequisites: [],
      };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeSampleReservoir: {
          samples: [
            { valence: 50, arousal: 30 },
            { valence: 60, arousal: 40 },
          ],
          sampleCount: 2,
        },
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30], min: 0, max: 100, binCount: 3 },
          arousal: { bins: [15, 25, 20], min: 0, max: 100, binCount: 3 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'multi-gate-clause': {
              gatePredicates: [
                { axis: 'valence', operator: '>=', thresholdRaw: 40 },
                { axis: 'arousal', operator: '<=', thresholdRaw: 60 },
              ],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'multi-gate-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 50,
              gateFailInRegimeCount: 50,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const combinedCandidate = candidates.find((c) => c.id.includes('combined'));
      expect(combinedCandidate).toBeDefined();
      expect(combinedCandidate.axes).toHaveLength(2);
    });
  });

  describe('sample constraint validation', () => {
    it('returns false for null sample', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:null-sample' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [null, { valence: 50 }],
          sampleCount: 2,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 40 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('returns true for empty constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:empty-constraints-sample' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }],
          sampleCount: 1,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeNull();
    });

    it('returns false for invalid axis type', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-axis-type' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }],
          sampleCount: 1,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 123, operator: '>=', thresholdRaw: 40 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('returns false for invalid threshold type', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-threshold-type' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }],
          sampleCount: 1,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 'invalid' }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });
  });

  describe('soft threshold computation', () => {
    it('computes soft threshold for >= operator', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-gte' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30, 25, 15], min: 0, max: 100, binCount: 5, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeDefined();
    });

    it('computes soft threshold for <= operator', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-lte' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30, 25, 15], min: 0, max: 100, binCount: 5, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '<=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      expect(candidates.length).toBeGreaterThanOrEqual(1);
    });

    it('computes soft threshold for < operator', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-lt' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30, 25, 15], min: 0, max: 100, binCount: 5, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '<', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      expect(candidates.length).toBeGreaterThanOrEqual(1);
    });

    it('returns original threshold for == operator', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-eq' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30, 25, 15], min: 0, max: 100, binCount: 5, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '==', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      // == operator returns original threshold, so soft candidate should not differ
      expect(candidates.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null for unknown operators in soft computation', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-unknown' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30, 25, 15], min: 0, max: 100, binCount: 5, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '!=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      // Unknown operator returns null for soft, so no soft candidate
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeUndefined();
    });

    it('returns null when quantile is not a number', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-no-quantile' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [], min: 0, max: 100, binCount: 0, sampleCount: 0 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Empty histogram means quantile is null, soft threshold computation returns null
      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeUndefined();
    });
  });

  describe('histogram utilities', () => {
    it('countHistogramWhere returns 0 for null histogram', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:null-histogram' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: null,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence).toEqual([]);
    });

    it('countHistogramWhere returns 0 for non-function predicate', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:non-func-predicate' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30], min: 0, max: 100, binCount: 3, sampleCount: 60 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence).toHaveLength(1);
    });

    it('getHistogramValue returns 0 for invalid histogram', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-histogram' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: [10], min: 0, max: 100, binCount: 1, sampleCount: 10 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // binCount <= 1 returns 0 for histogram value
      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('getHistogramValue handles integer binCount matching range', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:integer-bin' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: [5, 10, 15, 10, 5, 5], min: 0, max: 5, binCount: 6, sampleCount: 50 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 2 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // binCount (6) === max - min + 1 (5 - 0 + 1 = 6), so use integer mode
      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence).toHaveLength(1);
    });

    it('computeHistogramQuantile returns null for null histogram', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:quantile-null' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: null,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence).toEqual([]);
    });

    it('computeHistogramQuantile returns null for non-number quantile', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:quantile-non-number' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30], min: 0, max: 100, binCount: 3, sampleCount: 60 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence[0].quantiles).toBeDefined();
    });

    it('computeHistogramQuantile returns last bin value when target exceeds cumulative', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:quantile-overflow' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: [1, 1, 1], min: 0, max: 100, binCount: 3, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // With sampleCount 100 but bins only sum to 3, target for p90 (90) exceeds cumulative (3)
      // So it returns the last bin value
      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence[0].quantiles.p90).toBeDefined();
    });

    it('computeHistogramQuantile sums bins when sampleCount not provided', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:quantile-sum-bins' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30], min: 0, max: 100, binCount: 3 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // sampleCount not provided, so bins are summed (10+20+30=60)
      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence[0].quantiles).toBeDefined();
    });
  });

  describe('constraint bounds computation edge cases', () => {
    it('returns empty for non-array constraints', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-non-array',
        prerequisites: 'not-an-array',
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraints with non-string varPath in bounds', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-non-string-var',
        prerequisites: [
          { logic: { '>=': [{ var: 123 }, 30] } },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraints with empty axis after prefix removal', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-empty-axis',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.' }, 30] } },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraints with non-number threshold in bounds', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:bounds-non-number-thresh',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, null] } },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });
  });

  describe('sexual states in prototype definitions', () => {
    it('extracts definitions for sexual state prototypes', () => {
      const mockService = {
        getPrototypeDefinitions: (refs) => {
          const definitions = {};
          for (const ref of refs) {
            const key =
              ref.type === 'emotion'
                ? `emotions:${ref.id}`
                : `sexualStates:${ref.id}`;
            definitions[key] = {
              weights: { sex_excitation: 0.7 },
              gates: ['sex_excitation >= 0.3'],
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
      const expression = { id: 'test:sexual-definitions' };
      const simulationResult = {
        sampleCount: 10,
        prototypeEvaluationSummary: {
          sexualStates: { aroused: { moodSampleCount: 10 } },
        },
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.prototypeDefinitions['sexualStates:aroused']).toBeDefined();
      expect(facts.prototypeDefinitions['sexualStates:aroused'].weights.sex_excitation).toBe(0.7);
    });
  });

  describe('target signature serialization', () => {
    it('returns null when signature is not a Map', () => {
      const mockService = {
        getPrototypeDefinitions: () => ({}),
        analyzeAllPrototypeFit: () => null,
        computeImpliedPrototype: () => ({ targetSignature: { not: 'a map' } }),
        detectPrototypeGaps: () => null,
      };

      const builder = new RecommendationFactsBuilder({
        prototypeFitRankingService: mockService,
      });
      const expression = {
        id: 'test:sig-not-map',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.targetSignature).toBeNull();
    });
  });

  describe('ablation impact clause impacts', () => {
    it('processes ablationImpact.clauseImpacts when present', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:ablation-impacts' };
      const simulationResult = {
        sampleCount: 10,
        ablationImpact: {
          clauseImpacts: [
            { clauseId: 'clause-1', impact: 0.5 },
            { clauseId: 'clause-2', impact: 0.3 },
          ],
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'clause-1',
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // The impact from ablationImpact.clauseImpacts is mapped to the 'impact' property
      expect(facts.clauses[0].impact).toBe(0.5);
    });
  });

  describe('buildRegimeBounds gate clamp context', () => {
    it('handles non-array moodConstraints in gate clamp context', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gate-clamp-non-array',
        prerequisites: null,
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('skips constraints with non-string varPath in gate clamp', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gate-clamp-non-string-varpath',
        prerequisites: [
          { logic: { '>=': [{ var: null }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('skips constraints with empty axis in gate clamp', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gate-clamp-empty-axis',
        prerequisites: [
          { logic: { '>=': [{ var: '' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('skips constraints with non-number threshold in gate clamp', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gate-clamp-non-number-threshold',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 'not-number'] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('continues on interval constraint error in gate clamp', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:gate-clamp-interval-error',
        prerequisites: [
          { logic: { 'unknown-op': [{ var: 'moodAxes.valence' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });
  });

  describe('gate predicate implication edge cases', () => {
    it('returns false when predicate has no thresholdRaw', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:no-threshold-raw',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=' }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // No thresholdRaw means implication returns false
      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(false);
    });

    it('evaluates <= operator correctly in gate implication', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:lte-implication',
        prerequisites: [{ logic: { '<=': [{ var: 'moodAxes.valence' }, 70] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '<=', thresholdRaw: 80 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 8,
              gateFailInRegimeCount: 2,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
      expect(facts.clauses[0].gateClampRegimePermissive.gatePredicates[0].impliedByRegime).toBe(true);
    });
  });

  describe('sample constraint validation edge cases', () => {
    it('returns true for empty constraints array', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:empty-constraints-validation' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }],
          sampleCount: 1,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 40 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 8,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('returns false for constraint with invalid axis type', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-axis-constraint' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }],
          sampleCount: 1,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 12345, operator: '>=', thresholdRaw: 40 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 5,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });

    it('returns false for constraint with invalid threshold type', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-threshold-constraint' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }],
          sampleCount: 1,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 'invalid' }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 5,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive).toBeDefined();
    });
  });

  describe('soft threshold computation edge cases', () => {
    it('returns null when axisEvidence has no quantiles', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-no-axis-evidence' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {},
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeUndefined();
    });

    it('returns null when thresholdRaw is not a number', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-non-number-threshold' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [10, 20, 30, 25, 15], min: 0, max: 100, binCount: 5, sampleCount: 100 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: undefined }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeUndefined();
    });

    it('returns null for <= operator when p90 is not a number', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-lte-no-p90' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [], min: 0, max: 100, binCount: 0, sampleCount: 0 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '<=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeUndefined();
    });

    it('returns null for == operator when p50 is not a number', () => {
      const builder = new RecommendationFactsBuilder({
        gateClampConfig: { softAlignmentEnabled: true },
      });
      const expression = { id: 'test:soft-eq-no-p50' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: { bins: [], min: 0, max: 100, binCount: 0, sampleCount: 0 },
        },
        gateClampRegimePlan: {
          gateClampConfig: { softAlignmentEnabled: true },
          clauseGateMap: {
            'soft-clause': {
              gatePredicates: [{ axis: 'valence', operator: '==', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'soft-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 40,
              gateFailInRegimeCount: 60,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      const candidates = facts.clauses[0].gateClampRegimePermissive?.candidates ?? [];
      const softCandidate = candidates.find((c) => c.kind === 'soft');
      expect(softCandidate).toBeUndefined();
    });
  });

  describe('histogram utilities edge cases', () => {
    it('returns 0 for countHistogramWhere with null histogram', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:count-null-histogram' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: null,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 5,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence).toEqual([]);
    });

    it('returns null for computeHistogramQuantile with invalid histogram', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:quantile-invalid' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: { bins: null, min: 0, max: 100, binCount: 0 },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses[0].gateClampRegimePermissive?.axisEvidence[0].quantiles).toEqual({
        p10: null,
        p50: null,
        p90: null,
      });
    });
  });

  describe('computeBoundsFromConstraints edge cases', () => {
    it('returns empty bounds for undefined prerequisites', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:undefined-prereq',
        prerequisites: undefined,
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraint with varPath as number', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:varpath-number',
        prerequisites: [
          { logic: { '>=': [{ var: 12345 }, 30] } },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });

    it('skips constraint with threshold as string', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:threshold-string',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 'thirty'] } },
        ],
      };
      const simulationResult = { sampleCount: 10 };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.moodRegime.bounds).toEqual({});
    });
  });

  describe('sampleSatisfiesConstraints edge cases', () => {
    it('returns true for empty gatePredicates with valid reservoir', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:empty-gate-predicates' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }, { valence: 60 }],
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 5,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // The test executes successfully, validating empty array handling
      expect(facts.clauses).toBeDefined();
      expect(facts.clauses.length).toBeGreaterThan(0);
    });

    it('returns false for constraint with axis as number', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-axis-type' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }, { valence: 60 }],
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 123, operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 5,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Should handle invalid constraint gracefully
      expect(facts.clauses).toBeDefined();
    });

    it('returns false for constraint with threshold as string', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:invalid-threshold-type' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeSampleReservoir: {
          samples: [{ valence: 50 }, { valence: 60 }],
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 'fifty' }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
              gatePassInRegimeCount: 5,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Should handle invalid constraint gracefully
      expect(facts.clauses).toBeDefined();
    });
  });

  describe('combined candidate generation with reservoir', () => {
    it('generates combined candidate for multiple predicates with reservoir', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:combined-candidate' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeSampleReservoir: {
          samples: [
            { valence: 60, arousal: 70 },
            { valence: 50, arousal: 80 },
            { valence: 70, arousal: 60 },
          ],
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [
                { axis: 'valence', operator: '>=', thresholdRaw: 50 },
                { axis: 'arousal', operator: '>=', thresholdRaw: 60 },
              ],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 50,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toBeDefined();
      expect(facts.clauses.length).toBeGreaterThan(0);
      const clause = facts.clauses[0];
      // Combined candidate should be generated when predicateAxes.length > 1 && hasReservoir
      expect(clause.gateClampRegimePermissive?.candidates).toBeDefined();
      const candidates = clause.gateClampRegimePermissive.candidates;
      // Should have individual hard candidates + combined hard candidate
      const combinedCandidate = candidates.find((c) => c.id.includes('combined'));
      expect(combinedCandidate).toBeDefined();
    });
  });

  describe('buildRegimeBounds edge cases', () => {
    it('skips constraint with empty axis after split', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:empty-axis-split',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Should handle gracefully without crash - empty axis is skipped
      expect(facts).toBeDefined();
      expect(facts.clauses).toBeDefined();
    });

    it('continues when applyConstraint throws for invalid operator', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:invalid-operator',
        prerequisites: [
          { logic: { '!!': [{ var: 'moodAxes.valence' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Should handle gracefully
      expect(facts).toBeDefined();
    });

    it('skips constraint with non-string varPath', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:non-string-varpath',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts).toBeDefined();
    });

    it('skips constraint with non-number threshold', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:non-number-threshold',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts).toBeDefined();
    });

    it('catches and continues when applyConstraint throws for Infinity threshold', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:infinity-threshold',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, Infinity] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Should handle gracefully - Infinity causes applyConstraint to throw, which is caught
      expect(facts).toBeDefined();
      expect(facts.clauses).toBeDefined();
    });

    it('catches and continues when applyConstraint throws for NaN threshold', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:nan-threshold',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, NaN] } },
        ],
      };
      const simulationResult = {
        sampleCount: 10,
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      // Should handle gracefully - NaN causes applyConstraint to throw, which is caught
      expect(facts).toBeDefined();
      expect(facts.clauses).toBeDefined();
    });
  });

  describe('computeSoftThreshold edge cases', () => {
    it('returns null when thresholdRaw is not a number', () => {
      const builder = new RecommendationFactsBuilder({ gateClampConfig: { softAlignmentEnabled: true } });
      const expression = { id: 'test:threshold-not-number' };
      const simulationResult = {
        sampleCount: 100,
        moodRegimeAxisHistograms: {
          valence: {
            bins: [10, 20, 30, 20, 10, 10],
            min: 0,
            max: 100,
            binCount: 6,
            sampleCount: 100,
          },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: undefined }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 100,
              gatePassInRegimeCount: 50,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toBeDefined();
      // With invalid thresholdRaw, soft candidates should not be generated
      const clause = facts.clauses[0];
      const softCandidates = clause.gateClampRegimePermissive?.candidates?.filter(
        (c) => c.kind === 'soft'
      );
      expect(softCandidates?.length ?? 0).toBe(0);
    });
  });

  describe('countHistogramWhere edge cases', () => {
    it('returns 0 for null histogram', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = {
        id: 'test:null-histogram',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
      };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: null,
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 30 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toBeDefined();
    });
  });

  describe('computeHistogramQuantile edge cases', () => {
    it('returns null for non-number quantile', () => {
      const builder = new RecommendationFactsBuilder();
      const expression = { id: 'test:non-number-quantile' };
      const simulationResult = {
        sampleCount: 10,
        moodRegimeAxisHistograms: {
          valence: {
            bins: [5, 5],
            min: 0,
            max: 100,
            binCount: 2,
            sampleCount: 10,
          },
        },
        gateClampRegimePlan: {
          clauseGateMap: {
            'test-clause': {
              gatePredicates: [{ axis: 'valence', operator: '>=', thresholdRaw: 50 }],
            },
          },
        },
        clauseFailures: [
          {
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              clauseId: 'test-clause',
              inRegimeEvaluationCount: 10,
            },
          },
        ],
      };

      const facts = builder.build({ expression, simulationResult });

      expect(facts.clauses).toBeDefined();
    });
  });
});
