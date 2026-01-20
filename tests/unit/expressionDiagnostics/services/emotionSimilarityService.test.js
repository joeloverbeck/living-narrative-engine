/**
 * @file Unit tests for EmotionSimilarityService
 * Tests cosine similarity computation for emotion weight vectors
 */
import { describe, it, expect, jest } from '@jest/globals';
import EmotionSimilarityService from '../../../../src/expressionDiagnostics/services/EmotionSimilarityService.js';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockPrototypeRegistry = (prototypes = []) => ({
  getPrototypesByType: jest.fn((type) =>
    prototypes.filter((p) => p.type === type)
  ),
});

const createService = (prototypes = [], logger = null) => {
  return new EmotionSimilarityService({
    prototypeRegistryService: createMockPrototypeRegistry(prototypes),
    logger: logger ?? createMockLogger(),
  });
};

describe('EmotionSimilarityService', () => {
  describe('constructor', () => {
    it('throws error when prototypeRegistryService is missing', () => {
      expect(() => new EmotionSimilarityService({})).toThrow(
        'EmotionSimilarityService requires prototypeRegistryService'
      );
    });

    it('accepts optional logger', () => {
      const service = createService([]);
      expect(service).toBeDefined();
    });
  });

  describe('findSimilarEmotions', () => {
    it('should find emotions with similar weight signatures', () => {
      const prototypes = [
        {
          id: 'guilt',
          type: 'emotion',
          weights: { valence: -0.6, arousal: 0.3, dominance: -0.4 },
        },
        {
          id: 'remorse',
          type: 'emotion',
          weights: { valence: -0.5, arousal: 0.2, dominance: -0.3 },
        },
        {
          id: 'joy',
          type: 'emotion',
          weights: { valence: 0.8, arousal: 0.5, dominance: 0.3 },
        },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('guilt', 0.7, 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].emotionName).toBe('remorse');
      expect(result[0].similarity).toBeGreaterThan(0.7);
    });

    it('should return empty array for emotion not in registry', () => {
      const prototypes = [
        { id: 'guilt', type: 'emotion', weights: { valence: -0.6 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('unknown_emotion');

      expect(result).toEqual([]);
    });

    it('should return empty array for invalid emotionName', () => {
      const service = createService([]);

      expect(service.findSimilarEmotions(null)).toEqual([]);
      expect(service.findSimilarEmotions('')).toEqual([]);
      expect(service.findSimilarEmotions(123)).toEqual([]);
    });

    it('should return empty array when no prototypes exist', () => {
      const service = createService([]);

      const result = service.findSimilarEmotions('guilt');

      expect(result).toEqual([]);
    });

    it('should return empty array when emotion has no weights', () => {
      const prototypes = [
        { id: 'noweights', type: 'emotion' },
        { id: 'hasweights', type: 'emotion', weights: { valence: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('noweights');

      expect(result).toEqual([]);
    });

    it('should respect minSimilarity threshold', () => {
      const prototypes = [
        { id: 'base', type: 'emotion', weights: { valence: 1.0, arousal: 0.0 } },
        {
          id: 'very_similar',
          type: 'emotion',
          weights: { valence: 0.99, arousal: 0.0 },
        },
        {
          id: 'medium_similar',
          type: 'emotion',
          weights: { valence: 0.7, arousal: 0.7 },
        },
        {
          id: 'low_similar',
          type: 'emotion',
          weights: { valence: 0.3, arousal: 0.9 },
        },
      ];
      const service = createService(prototypes);

      const highThreshold = service.findSimilarEmotions('base', 0.95, 10);
      const lowThreshold = service.findSimilarEmotions('base', 0.3, 10);

      // high threshold should return fewer results than low threshold
      expect(highThreshold.length).toBeLessThan(lowThreshold.length);
    });

    it('should respect maxResults limit', () => {
      const prototypes = [
        {
          id: 'base',
          type: 'emotion',
          weights: { valence: 0.5, arousal: 0.5 },
        },
        { id: 'sim1', type: 'emotion', weights: { valence: 0.5, arousal: 0.5 } },
        { id: 'sim2', type: 'emotion', weights: { valence: 0.5, arousal: 0.4 } },
        { id: 'sim3', type: 'emotion', weights: { valence: 0.5, arousal: 0.3 } },
        { id: 'sim4', type: 'emotion', weights: { valence: 0.5, arousal: 0.2 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('base', 0.1, 2);

      expect(result).toHaveLength(2);
    });

    it('should exclude the query emotion from results', () => {
      const prototypes = [
        { id: 'guilt', type: 'emotion', weights: { valence: -0.6 } },
        { id: 'other', type: 'emotion', weights: { valence: -0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('guilt', 0.0, 10);

      expect(result.every((r) => r.emotionName !== 'guilt')).toBe(true);
    });

    it('should sort results by similarity descending', () => {
      const prototypes = [
        { id: 'base', type: 'emotion', weights: { valence: 1.0 } },
        { id: 'closest', type: 'emotion', weights: { valence: 0.95 } },
        { id: 'medium', type: 'emotion', weights: { valence: 0.7 } },
        { id: 'far', type: 'emotion', weights: { valence: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('base', 0.1, 10);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].similarity).toBeGreaterThanOrEqual(
          result[i].similarity
        );
      }
    });

    it('should use cached similarity values on subsequent calls', () => {
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 0.5 } },
        { id: 'b', type: 'emotion', weights: { valence: 0.6 } },
      ];
      const service = createService(prototypes);

      const result1 = service.findSimilarEmotions('a', 0.1, 10);
      const result2 = service.findSimilarEmotions('a', 0.1, 10);

      expect(result1[0].similarity).toBe(result2[0].similarity);
    });
  });

  describe('cosine similarity computation', () => {
    it('should return 1.0 for identical weight vectors', () => {
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 0.5, arousal: 0.3 } },
        { id: 'b', type: 'emotion', weights: { valence: 0.5, arousal: 0.3 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('a', 0.0, 10);

      expect(result[0].emotionName).toBe('b');
      expect(result[0].similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal weight vectors', () => {
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 1.0, arousal: 0.0 } },
        { id: 'b', type: 'emotion', weights: { valence: 0.0, arousal: 1.0 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('a', -1, 10);

      expect(result[0].similarity).toBeCloseTo(0.0, 5);
    });

    it('should return negative similarity for opposing vectors', () => {
      const prototypes = [
        { id: 'positive', type: 'emotion', weights: { valence: 1.0 } },
        { id: 'negative', type: 'emotion', weights: { valence: -1.0 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('positive', -2, 10);

      expect(result[0].similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle missing axes gracefully', () => {
      const prototypes = [
        {
          id: 'full',
          type: 'emotion',
          weights: { valence: 0.5, arousal: 0.3, dominance: 0.4 },
        },
        { id: 'partial', type: 'emotion', weights: { valence: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('full', -1, 10);

      expect(result).toHaveLength(1);
      expect(typeof result[0].similarity).toBe('number');
      expect(result[0].similarity).toBeGreaterThan(0);
    });

    it('should return 0 when either vector has zero magnitude', () => {
      const prototypes = [
        { id: 'normal', type: 'emotion', weights: { valence: 0.5 } },
        { id: 'zero', type: 'emotion', weights: { valence: 0, arousal: 0 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('normal', -1, 10);

      const zeroEntry = result.find((r) => r.emotionName === 'zero');
      expect(zeroEntry?.similarity).toBe(0);
    });
  });

  describe('checkGroupSimilarity', () => {
    it('should return isSimilar=true for functionally similar emotions', () => {
      const prototypes = [
        { id: 'guilt', type: 'emotion', weights: { valence: -0.6, arousal: 0.3 } },
        { id: 'remorse', type: 'emotion', weights: { valence: -0.5, arousal: 0.2 } },
        { id: 'shame', type: 'emotion', weights: { valence: -0.55, arousal: 0.25 } },
      ];
      const service = createService(prototypes);

      const result = service.checkGroupSimilarity(
        ['guilt', 'remorse', 'shame'],
        0.5
      );

      expect(result.isSimilar).toBe(true);
      expect(result.avgSimilarity).toBeGreaterThan(0.5);
    });

    it('should return isSimilar=false for dissimilar emotions', () => {
      const prototypes = [
        { id: 'joy', type: 'emotion', weights: { valence: 0.8, arousal: 0.5 } },
        { id: 'terror', type: 'emotion', weights: { valence: -0.9, arousal: 0.9 } },
      ];
      const service = createService(prototypes);

      const result = service.checkGroupSimilarity(['joy', 'terror'], 0.5);

      expect(result.isSimilar).toBe(false);
    });

    it('should return isSimilar=false for less than 2 emotions', () => {
      const prototypes = [
        { id: 'joy', type: 'emotion', weights: { valence: 0.8 } },
      ];
      const service = createService(prototypes);

      expect(service.checkGroupSimilarity(['joy'], 0.5)).toEqual({
        isSimilar: false,
        avgSimilarity: 0,
      });
      expect(service.checkGroupSimilarity([], 0.5)).toEqual({
        isSimilar: false,
        avgSimilarity: 0,
      });
    });

    it('should return isSimilar=false for non-array input', () => {
      const service = createService([]);

      expect(service.checkGroupSimilarity(null, 0.5)).toEqual({
        isSimilar: false,
        avgSimilarity: 0,
      });
      expect(service.checkGroupSimilarity('not-array', 0.5)).toEqual({
        isSimilar: false,
        avgSimilarity: 0,
      });
    });

    it('should return isSimilar=false when prototypes have no weights', () => {
      const prototypes = [
        { id: 'noweight1', type: 'emotion' },
        { id: 'noweight2', type: 'emotion' },
      ];
      const service = createService(prototypes);

      const result = service.checkGroupSimilarity(
        ['noweight1', 'noweight2'],
        0.5
      );

      expect(result.isSimilar).toBe(false);
    });

    it('should calculate correct average similarity', () => {
      // Create 3 identical emotions for predictable similarity
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 0.5 } },
        { id: 'b', type: 'emotion', weights: { valence: 0.5 } },
        { id: 'c', type: 'emotion', weights: { valence: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.checkGroupSimilarity(['a', 'b', 'c'], 0.5);

      // All identical, so average should be 1.0
      expect(result.avgSimilarity).toBeCloseTo(1.0, 5);
    });

    it('should return isSimilar=false when no prototypes found', () => {
      const service = createService([]);

      const result = service.checkGroupSimilarity(['a', 'b'], 0.5);

      expect(result.isSimilar).toBe(false);
      expect(result.avgSimilarity).toBe(0);
    });

    it('should use cached similarity values', () => {
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 0.5 } },
        { id: 'b', type: 'emotion', weights: { valence: 0.6 } },
      ];
      const service = createService(prototypes);

      // First call populates cache
      service.findSimilarEmotions('a', 0, 10);
      // Second call should use cache
      const result = service.checkGroupSimilarity(['a', 'b'], 0);

      expect(result.avgSimilarity).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the similarity cache', () => {
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 0.5 } },
        { id: 'b', type: 'emotion', weights: { valence: 0.6 } },
      ];
      const service = createService(prototypes);

      // Populate cache
      service.findSimilarEmotions('a', 0, 10);
      // Clear
      service.clearCache();

      // Subsequent call should work normally
      const result = service.findSimilarEmotions('a', 0, 10);
      expect(result).toHaveLength(1);
    });
  });

  describe('findEmotionsWithCompatibleAxisSign', () => {
    it('should find emotions with positive weight on specified axis', () => {
      const prototypes = [
        {
          id: 'enthusiasm',
          type: 'emotion',
          weights: { engagement: 0.7, valence: 0.6 },
        },
        {
          id: 'fascination',
          type: 'emotion',
          weights: { engagement: 1.0, valence: 0.3 },
        },
        {
          id: 'disgust',
          type: 'emotion',
          weights: { engagement: -0.3, valence: -0.8 },
        },
        {
          id: 'boredom',
          type: 'emotion',
          weights: { engagement: -0.6, valence: -0.2 },
        },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive',
        0.1,
        3
      );

      expect(result).toHaveLength(2);
      expect(result[0].emotionName).toBe('fascination');
      expect(result[0].axisWeight).toBe(1.0);
      expect(result[1].emotionName).toBe('enthusiasm');
      expect(result[1].axisWeight).toBe(0.7);
    });

    it('should find emotions with negative weight on specified axis', () => {
      const prototypes = [
        {
          id: 'enthusiasm',
          type: 'emotion',
          weights: { engagement: 0.7 },
        },
        {
          id: 'disgust',
          type: 'emotion',
          weights: { engagement: -0.3 },
        },
        {
          id: 'boredom',
          type: 'emotion',
          weights: { engagement: -0.6 },
        },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'negative',
        0.1,
        3
      );

      expect(result).toHaveLength(2);
      expect(result[0].emotionName).toBe('boredom');
      expect(result[0].axisWeight).toBe(-0.6);
      expect(result[1].emotionName).toBe('disgust');
      expect(result[1].axisWeight).toBe(-0.3);
    });

    it('should return empty array for invalid axisName', () => {
      const service = createService([]);

      expect(
        service.findEmotionsWithCompatibleAxisSign(null, 'positive')
      ).toEqual([]);
      expect(
        service.findEmotionsWithCompatibleAxisSign('', 'positive')
      ).toEqual([]);
      expect(
        service.findEmotionsWithCompatibleAxisSign(123, 'positive')
      ).toEqual([]);
    });

    it('should return empty array for invalid targetSign', () => {
      const prototypes = [
        { id: 'joy', type: 'emotion', weights: { valence: 0.8 } },
      ];
      const service = createService(prototypes);

      expect(
        service.findEmotionsWithCompatibleAxisSign('valence', 'invalid')
      ).toEqual([]);
      expect(
        service.findEmotionsWithCompatibleAxisSign('valence', null)
      ).toEqual([]);
      expect(
        service.findEmotionsWithCompatibleAxisSign('valence', 'POSITIVE')
      ).toEqual([]);
    });

    it('should return empty array when no prototypes exist', () => {
      const service = createService([]);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no emotions have the specified axis', () => {
      const prototypes = [
        { id: 'joy', type: 'emotion', weights: { valence: 0.8 } },
        { id: 'sadness', type: 'emotion', weights: { valence: -0.6 } },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive'
      );

      expect(result).toEqual([]);
    });

    it('should respect minWeight threshold', () => {
      const prototypes = [
        {
          id: 'strong',
          type: 'emotion',
          weights: { engagement: 0.8 },
        },
        {
          id: 'weak',
          type: 'emotion',
          weights: { engagement: 0.05 },
        },
        {
          id: 'medium',
          type: 'emotion',
          weights: { engagement: 0.3 },
        },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive',
        0.2,
        10
      );

      expect(result).toHaveLength(2);
      expect(result.every((r) => Math.abs(r.axisWeight) >= 0.2)).toBe(true);
    });

    it('should respect maxResults limit', () => {
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `emotion_${i}`,
        type: 'emotion',
        weights: { engagement: 0.5 + i * 0.05 },
      }));
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive',
        0.1,
        3
      );

      expect(result).toHaveLength(3);
    });

    it('should sort results by absolute magnitude descending', () => {
      const prototypes = [
        { id: 'low', type: 'emotion', weights: { engagement: 0.2 } },
        { id: 'high', type: 'emotion', weights: { engagement: 0.9 } },
        { id: 'mid', type: 'emotion', weights: { engagement: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive',
        0.1,
        10
      );

      expect(result[0].emotionName).toBe('high');
      expect(result[1].emotionName).toBe('mid');
      expect(result[2].emotionName).toBe('low');
    });

    it('should skip prototypes without weights', () => {
      const prototypes = [
        { id: 'noweights', type: 'emotion' },
        { id: 'hasweights', type: 'emotion', weights: { engagement: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive',
        0.1,
        10
      );

      expect(result).toHaveLength(1);
      expect(result[0].emotionName).toBe('hasweights');
    });

    it('should handle zero weight values (excluded by minWeight)', () => {
      const prototypes = [
        { id: 'zero', type: 'emotion', weights: { engagement: 0 } },
        { id: 'positive', type: 'emotion', weights: { engagement: 0.5 } },
      ];
      const service = createService(prototypes);

      const result = service.findEmotionsWithCompatibleAxisSign(
        'engagement',
        'positive',
        0.1,
        10
      );

      expect(result).toHaveLength(1);
      expect(result[0].emotionName).toBe('positive');
    });
  });

  describe('edge cases', () => {
    it('should handle very small weight values', () => {
      const prototypes = [
        { id: 'tiny1', type: 'emotion', weights: { valence: 0.001 } },
        { id: 'tiny2', type: 'emotion', weights: { valence: 0.002 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('tiny1', 0, 10);

      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBeGreaterThan(0);
    });

    it('should handle many axes', () => {
      const weights = {
        valence: 0.5,
        arousal: 0.3,
        dominance: 0.4,
        engagement: 0.6,
        intensity: 0.7,
        pleasantness: 0.2,
        activation: 0.1,
      };
      const prototypes = [
        { id: 'multi1', type: 'emotion', weights },
        { id: 'multi2', type: 'emotion', weights: { ...weights, valence: 0.6 } },
      ];
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('multi1', 0, 10);

      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBeGreaterThan(0.9);
    });

    it('should handle large number of prototypes', () => {
      const prototypes = Array.from({ length: 100 }, (_, i) => ({
        id: `emotion_${i}`,
        type: 'emotion',
        weights: { valence: Math.sin(i / 10), arousal: Math.cos(i / 10) },
      }));
      const service = createService(prototypes);

      const result = service.findSimilarEmotions('emotion_0', 0.5, 5);

      expect(result.length).toBeLessThanOrEqual(5);
      expect(result.every((r) => r.similarity >= 0.5)).toBe(true);
    });
  });
});
