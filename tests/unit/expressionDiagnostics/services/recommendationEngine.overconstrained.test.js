/**
 * @file Unit tests for RecommendationEngine - Overconstrained Conjunction Suggestions
 */

import { describe, it, expect, jest } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';

const baseFacts = () => ({
  expressionId: 'expr:overconstrained_test',
  sampleCount: 800,
  moodRegime: {
    definition: null,
    sampleCount: 400,
  },
  overallPassRate: 0.001,
  // Need at least one clause and prototype for generate() to not early-return
  clauses: [
    {
      clauseId: 'dummy_clause',
      passRate: 0.5,
      impact: 0.1,
    },
  ],
  prototypes: [
    {
      prototypeId: 'dummy_proto',
      gateFailRate: 0.1,
      pThreshGivenGate: 0.5,
      meanValueGivenGate: 0.5,
      compatibilityScore: 0.5,
      moodSampleCount: 100,
    },
  ],
  invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
  overconstrainedDetails: [],
});

const createMockEmotionSimilarityService = (similarEmotions = {}, groupSimilarity = null) => ({
  findSimilarEmotions: jest.fn((emotionName, minSimilarity, maxResults) => {
    return similarEmotions[emotionName] ?? [];
  }),
  checkGroupSimilarity: jest.fn((emotionNames, minPairwiseSimilarity) => {
    return groupSimilarity ?? { isSimilar: false, avgSimilarity: 0 };
  }),
});

describe('RecommendationEngine - Overconstrained Conjunction Suggestions', () => {
  describe('generate() with overconstrained facts', () => {
    it('should produce overconstrained_conjunction recommendation', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec).toBeDefined();
      expect(overconstrainedRec.id).toBe('overconstrained_conjunction:test_and');
    });

    it('should set severity to high for overconstrained', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.severity).toBe('high');
    });

    it('should include affected clauses in recommendation', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.relatedClauseIds).toEqual(['c1', 'c2', 'c3']);
    });

    it('should include naive joint probability in recommendation', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.naiveJointProbability).toBe(0.000336);
    });

    it('should handle multiple overconstrained details', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'and_1',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.05, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.06, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.07, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.00021,
          suggestions: [],
        },
        {
          andNodeId: 'and_2',
          lowPassChildren: [
            { clauseId: 'c4', emotionName: 'fear', passRate: 0.04, threshold: 0.50, operator: '>=' },
            { clauseId: 'c5', emotionName: 'terror', passRate: 0.03, threshold: 0.45, operator: '>=' },
            { clauseId: 'c6', emotionName: 'dread', passRate: 0.02, threshold: 0.40, operator: '>=' },
          ],
          naiveJointProbability: 0.000024,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRecs = recommendations.filter(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRecs).toHaveLength(2);
    });

    it('should handle empty overconstrainedDetails', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [];

      const recommendations = engine.generate(facts);

      const overconstrainedRecs = recommendations.filter(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRecs).toHaveLength(0);
    });

    it('should handle undefined overconstrainedDetails', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      delete facts.overconstrainedDetails;

      const recommendations = engine.generate(facts);

      const overconstrainedRecs = recommendations.filter(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRecs).toHaveLength(0);
    });
  });

  describe('#buildOverconstrainedSuggestions', () => {
    it('should generate 2-of-N rule suggestion', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.actions.some(
        (s) => s.includes('2-of-3') && s.includes('require any 2')
      )).toBe(true);
    });

    it('should generate OR-softening suggestions with similar emotions', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
        shame: [{ emotionName: 'embarrassment', similarity: 0.82 }],
        remorse: [{ emotionName: 'guilt', similarity: 0.85 }],
      });
      const engine = new RecommendationEngine({ emotionSimilarityService });
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.actions.some(
        (s) => s.includes('OR-soften') && s.includes('guilt')
      )).toBe(true);
    });

    it('should include similarity percentage in OR-softening suggestions', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
      });
      const engine = new RecommendationEngine({ emotionSimilarityService });
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.actions.some(
        (s) => s.includes('similarity: 85%')
      )).toBe(true);
    });

    it('should identify functionally similar emotion groups', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {},
        { isSimilar: true, avgSimilarity: 0.78 }
      );
      const engine = new RecommendationEngine({ emotionSimilarityService });
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.actions.some(
        (s) => s.includes('similar weight signatures') && s.includes('78%')
      )).toBe(true);
    });

    it('should work without EmotionSimilarityService (graceful degradation)', () => {
      const engine = new RecommendationEngine(); // No emotionSimilarityService
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      // Should still produce 2-of-N suggestion
      expect(overconstrainedRec.actions).toHaveLength(1);
      expect(overconstrainedRec.actions[0]).toContain('2-of-3');
    });

    it('should not add OR-softening suggestions when no similar emotions found', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {}, // Empty - no similar emotions
        { isSimilar: false, avgSimilarity: 0.2 }
      );
      const engine = new RecommendationEngine({ emotionSimilarityService });
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      // Should only have the 2-of-N suggestion
      expect(overconstrainedRec.actions).toHaveLength(1);
      expect(overconstrainedRec.actions[0]).toContain('2-of-3');
    });

    it('should handle null threshold in suggestion formatting', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
      });
      const engine = new RecommendationEngine({ emotionSimilarityService });
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: null, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      // Should use '0.X' as fallback for null threshold
      expect(overconstrainedRec.actions.some(
        (s) => s.includes('0.X')
      )).toBe(true);
    });

    it('should correctly calculate n/2 for group similarity suggestions', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {},
        { isSimilar: true, avgSimilarity: 0.75 }
      );
      const engine = new RecommendationEngine({ emotionSimilarityService });
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
            { clauseId: 'c4', emotionName: 'regret', passRate: 0.05, threshold: 0.30, operator: '>=' },
            { clauseId: 'c5', emotionName: 'contrition', passRate: 0.04, threshold: 0.25, operator: '>=' },
          ],
          naiveJointProbability: 0.0000000672,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      // Math.ceil(5/2) = 3
      expect(overconstrainedRec.actions.some(
        (s) => s.includes('any 3 of them instead of all 5')
      )).toBe(true);
    });
  });

  describe('recommendation description formatting', () => {
    it('should include emotion count in title', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      expect(overconstrainedRec.title).toBe('Overconstrained Conjunction Detected');
    });

    it('should include formatted joint probability in description', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.overconstrainedDetails = [
        {
          andNodeId: 'test_and',
          lowPassChildren: [
            { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
            { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
            { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
          ],
          naiveJointProbability: 0.000336,
          suggestions: [],
        },
      ];

      const recommendations = engine.generate(facts);

      const overconstrainedRec = recommendations.find(
        (r) => r.type === 'overconstrained_conjunction'
      );
      // 0.000336 * 100 = 0.0336%
      expect(overconstrainedRec.why).toContain('0.0336%');
    });
  });
});
