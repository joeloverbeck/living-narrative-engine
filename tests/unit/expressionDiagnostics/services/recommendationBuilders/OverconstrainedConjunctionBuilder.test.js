/**
 * @file Unit tests for OverconstrainedConjunctionBuilder
 * @description Tests the extracted overconstrained conjunction recommendation builder.
 */

import { describe, it, expect, jest } from '@jest/globals';
import OverconstrainedConjunctionBuilder from '../../../../../src/expressionDiagnostics/services/recommendationBuilders/OverconstrainedConjunctionBuilder.js';

const createMockEmotionSimilarityService = (
  similarEmotions = {},
  groupSimilarity = null
) => ({
  findSimilarEmotions: jest.fn((emotionName, minSimilarity, maxResults) => {
    return similarEmotions[emotionName] ?? [];
  }),
  checkGroupSimilarity: jest.fn((emotionNames, minPairwiseSimilarity) => {
    return groupSimilarity ?? { isSimilar: false, avgSimilarity: 0 };
  }),
});

const createBaseInfo = () => ({
  andNodeId: 'test_and',
  lowPassChildren: [
    {
      clauseId: 'c1',
      emotionName: 'guilt',
      passRate: 0.08,
      threshold: 0.45,
      operator: '>=',
    },
    {
      clauseId: 'c2',
      emotionName: 'shame',
      passRate: 0.07,
      threshold: 0.4,
      operator: '>=',
    },
    {
      clauseId: 'c3',
      emotionName: 'remorse',
      passRate: 0.06,
      threshold: 0.35,
      operator: '>=',
    },
  ],
  naiveJointProbability: 0.000336,
});

describe('OverconstrainedConjunctionBuilder', () => {
  describe('constructor', () => {
    it('should create builder without emotionSimilarityService', () => {
      const builder = new OverconstrainedConjunctionBuilder();
      expect(builder).toBeDefined();
    });

    it('should create builder with emotionSimilarityService', () => {
      const service = createMockEmotionSimilarityService();
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService: service,
      });
      expect(builder).toBeDefined();
    });

    it('should create builder with empty options object', () => {
      const builder = new OverconstrainedConjunctionBuilder({});
      expect(builder).toBeDefined();
    });
  });

  describe('build()', () => {
    describe('recommendation structure', () => {
      it('should produce complete recommendation object', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation).toHaveProperty('id');
        expect(recommendation).toHaveProperty('type');
        expect(recommendation).toHaveProperty('severity');
        expect(recommendation).toHaveProperty('confidence');
        expect(recommendation).toHaveProperty('title');
        expect(recommendation).toHaveProperty('why');
        expect(recommendation).toHaveProperty('evidence');
        expect(recommendation).toHaveProperty('actions');
        expect(recommendation).toHaveProperty('predictedEffect');
        expect(recommendation).toHaveProperty('relatedClauseIds');
        expect(recommendation).toHaveProperty('naiveJointProbability');
      });

      it('should set correct id from andNodeId', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();
        info.andNodeId = 'custom_and_node';

        const recommendation = builder.build(info);

        expect(recommendation.id).toBe('overconstrained_conjunction:custom_and_node');
      });

      it('should set type to overconstrained_conjunction', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.type).toBe('overconstrained_conjunction');
      });

      it('should set severity to high', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.severity).toBe('high');
      });

      it('should set confidence to high', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.confidence).toBe('high');
      });

      it('should set correct title', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.title).toBe('Overconstrained Conjunction Detected');
      });

      it('should include joint probability in why field', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        // 0.000336 * 100 = 0.0336%
        expect(recommendation.why).toContain('0.0336%');
      });

      it('should include emotion count in why field', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.why).toContain('3 emotion thresholds');
      });

      it('should include naiveJointProbability in output', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.naiveJointProbability).toBe(0.000336);
      });
    });

    describe('evidence building', () => {
      it('should build evidence for each low-pass child', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.evidence).toHaveLength(3);
      });

      it('should include clauseId as metric in evidence', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.evidence[0].metric).toBe('c1');
        expect(recommendation.evidence[1].metric).toBe('c2');
        expect(recommendation.evidence[2].metric).toBe('c3');
      });

      it('should include passRate as value in evidence', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.evidence[0].value).toBe(0.08);
        expect(recommendation.evidence[1].value).toBe(0.07);
        expect(recommendation.evidence[2].value).toBe(0.06);
      });

      it('should include formatted pass rate label', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.evidence[0].label).toBe('pass rate: 8.0%');
        expect(recommendation.evidence[1].label).toBe('pass rate: 7.0%');
        expect(recommendation.evidence[2].label).toBe('pass rate: 6.0%');
      });
    });

    describe('relatedClauseIds', () => {
      it('should include all affected clauseIds', () => {
        const builder = new OverconstrainedConjunctionBuilder();
        const info = createBaseInfo();

        const recommendation = builder.build(info);

        expect(recommendation.relatedClauseIds).toEqual(['c1', 'c2', 'c3']);
      });
    });
  });

  describe('2-of-N rule suggestions', () => {
    it('should always generate 2-of-N rule suggestion', () => {
      const builder = new OverconstrainedConjunctionBuilder();
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      expect(
        recommendation.actions.some(
          (s) => s.includes('2-of-3') && s.includes('require any 2')
        )
      ).toBe(true);
    });

    it('should adapt 2-of-N to correct count', () => {
      const builder = new OverconstrainedConjunctionBuilder();
      const info = createBaseInfo();
      info.lowPassChildren = [
        { clauseId: 'c1', emotionName: 'e1', passRate: 0.05, threshold: 0.3, operator: '>=' },
        { clauseId: 'c2', emotionName: 'e2', passRate: 0.04, threshold: 0.3, operator: '>=' },
        { clauseId: 'c3', emotionName: 'e3', passRate: 0.03, threshold: 0.3, operator: '>=' },
        { clauseId: 'c4', emotionName: 'e4', passRate: 0.02, threshold: 0.3, operator: '>=' },
      ];

      const recommendation = builder.build(info);

      expect(
        recommendation.actions.some(
          (s) => s.includes('2-of-4') && s.includes('require any 2 of the 4')
        )
      ).toBe(true);
    });

    it('should generate only 2-of-N when no similarity service', () => {
      const builder = new OverconstrainedConjunctionBuilder();
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      expect(recommendation.actions).toHaveLength(1);
      expect(recommendation.actions[0]).toContain('2-of-3');
    });
  });

  describe('OR-softening suggestions', () => {
    it('should generate OR-softening suggestions with similar emotions', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
        shame: [{ emotionName: 'embarrassment', similarity: 0.82 }],
        remorse: [{ emotionName: 'guilt', similarity: 0.85 }],
      });
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      expect(
        recommendation.actions.some(
          (s) => s.includes('OR-soften') && s.includes('guilt')
        )
      ).toBe(true);
    });

    it('should include similarity percentage in OR-softening suggestions', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
      });
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      expect(
        recommendation.actions.some((s) => s.includes('similarity: 85%'))
      ).toBe(true);
    });

    it('should not add OR-softening when no similar emotions found', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {}, // Empty - no similar emotions
        { isSimilar: false, avgSimilarity: 0.2 }
      );
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      // Should only have the 2-of-N suggestion
      expect(recommendation.actions).toHaveLength(1);
      expect(recommendation.actions[0]).toContain('2-of-3');
    });

    it('should handle null threshold in OR-softening formatting', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
      });
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();
      info.lowPassChildren[0].threshold = null;

      const recommendation = builder.build(info);

      // Should use '0.X' as fallback for null threshold
      expect(recommendation.actions.some((s) => s.includes('0.X'))).toBe(true);
    });

    it('should handle undefined threshold in OR-softening formatting', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService({
        guilt: [{ emotionName: 'remorse', similarity: 0.85 }],
      });
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();
      delete info.lowPassChildren[0].threshold;

      const recommendation = builder.build(info);

      // Should use '0.X' as fallback for undefined threshold
      expect(recommendation.actions.some((s) => s.includes('0.X'))).toBe(true);
    });
  });

  describe('group similarity suggestions', () => {
    it('should identify functionally similar emotion groups', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {},
        { isSimilar: true, avgSimilarity: 0.78 }
      );
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      expect(
        recommendation.actions.some(
          (s) => s.includes('similar weight signatures') && s.includes('78%')
        )
      ).toBe(true);
    });

    it('should correctly calculate n/2 for group similarity suggestions', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {},
        { isSimilar: true, avgSimilarity: 0.75 }
      );
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();
      info.lowPassChildren = [
        { clauseId: 'c1', emotionName: 'guilt', passRate: 0.08, threshold: 0.45, operator: '>=' },
        { clauseId: 'c2', emotionName: 'shame', passRate: 0.07, threshold: 0.40, operator: '>=' },
        { clauseId: 'c3', emotionName: 'remorse', passRate: 0.06, threshold: 0.35, operator: '>=' },
        { clauseId: 'c4', emotionName: 'regret', passRate: 0.05, threshold: 0.30, operator: '>=' },
        { clauseId: 'c5', emotionName: 'contrition', passRate: 0.04, threshold: 0.25, operator: '>=' },
      ];

      const recommendation = builder.build(info);

      // Math.ceil(5/2) = 3
      expect(
        recommendation.actions.some(
          (s) => s.includes('any 3 of them instead of all 5')
        )
      ).toBe(true);
    });

    it('should not add group similarity suggestion when group is not similar', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {},
        { isSimilar: false, avgSimilarity: 0.2 }
      );
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      expect(
        recommendation.actions.some((s) => s.includes('similar weight signatures'))
      ).toBe(false);
    });
  });

  describe('service method calls', () => {
    it('should call findSimilarEmotions for each low-pass child', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService();
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      builder.build(info);

      expect(emotionSimilarityService.findSimilarEmotions).toHaveBeenCalledTimes(3);
      expect(emotionSimilarityService.findSimilarEmotions).toHaveBeenCalledWith(
        'guilt',
        0.7,
        2
      );
      expect(emotionSimilarityService.findSimilarEmotions).toHaveBeenCalledWith(
        'shame',
        0.7,
        2
      );
      expect(emotionSimilarityService.findSimilarEmotions).toHaveBeenCalledWith(
        'remorse',
        0.7,
        2
      );
    });

    it('should call checkGroupSimilarity with all emotion names', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService();
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      builder.build(info);

      expect(emotionSimilarityService.checkGroupSimilarity).toHaveBeenCalledTimes(1);
      expect(emotionSimilarityService.checkGroupSimilarity).toHaveBeenCalledWith(
        ['guilt', 'shame', 'remorse'],
        0.5
      );
    });
  });

  describe('graceful degradation', () => {
    it('should work without EmotionSimilarityService', () => {
      const builder = new OverconstrainedConjunctionBuilder();
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      // Should still produce valid recommendation
      expect(recommendation.id).toBe('overconstrained_conjunction:test_and');
      expect(recommendation.type).toBe('overconstrained_conjunction');
      expect(recommendation.severity).toBe('high');
      expect(recommendation.actions).toHaveLength(1);
      expect(recommendation.actions[0]).toContain('2-of-3');
    });

    it('should handle emotionSimilarityService returning empty arrays', () => {
      const emotionSimilarityService = createMockEmotionSimilarityService(
        {}, // Empty similar emotions
        { isSimilar: false, avgSimilarity: 0 }
      );
      const builder = new OverconstrainedConjunctionBuilder({
        emotionSimilarityService,
      });
      const info = createBaseInfo();

      const recommendation = builder.build(info);

      // Should still work and only have 2-of-N suggestion
      expect(recommendation.actions).toHaveLength(1);
      expect(recommendation.actions[0]).toContain('2-of-3');
    });
  });
});
