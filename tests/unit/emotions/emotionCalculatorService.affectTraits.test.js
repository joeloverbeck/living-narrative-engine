/**
 * @file Unit tests for affect traits integration in EmotionCalculatorService.
 * Tests the sociopath scenario, backwards compatibility, and trait gating.
 * @see specs/affect-traits-and-affiliation-axis.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';

describe('EmotionCalculatorService - Affect Traits', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  // Simplified prototypes for testing trait integration
  const mockPrototypes = {
    compassion: {
      weights: {
        valence: 0.15,
        engagement: 0.70,
        threat: -0.35,
        agency_control: 0.10,
        affiliation: 0.40,
        affective_empathy: 0.80,
      },
      gates: [
        'engagement >= 0.30',
        'valence >= -0.20',
        'valence <= 0.35',
        'threat <= 0.50',
        'affective_empathy >= 0.25',
      ],
    },
    empathic_distress: {
      weights: {
        valence: -0.75,
        arousal: 0.60,
        engagement: 0.75,
        agency_control: -0.60,
        affective_empathy: 0.90,
      },
      gates: [
        'engagement >= 0.35',
        'valence <= -0.20',
        'arousal >= 0.10',
        'agency_control <= 0.10',
        'affective_empathy >= 0.30',
      ],
    },
    guilt: {
      weights: {
        self_evaluation: -0.6,
        valence: -0.4,
        agency_control: 0.2,
        engagement: 0.2,
        affective_empathy: 0.45,
        harm_aversion: 0.55,
      },
      gates: [
        'self_evaluation <= -0.10',
        'valence <= -0.10',
        'affective_empathy >= 0.15',
      ],
    },
    pride: {
      weights: {
        self_evaluation: 0.9,
        valence: 0.5,
        agency_control: 0.4,
      },
      gates: ['self_evaluation >= 0.30', 'valence >= 0.10'],
    },
    interest: {
      weights: {
        engagement: 0.85,
        valence: 0.25,
        arousal: 0.20,
      },
      gates: ['engagement >= 0.25', 'valence >= -0.30'],
    },
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return { entries: mockPrototypes };
        }
        return null;
      }),
    };

    service = new EmotionCalculatorService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('backwards compatibility', () => {
    const neutralMood = {
      valence: 0,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 50,
      future_expectancy: 0,
      self_evaluation: 0,
      affiliation: 0,
    };

    it('uses default traits (50) when affectTraits is null', () => {
      const emotions = service.calculateEmotions(neutralMood, null, null, null);

      // With default traits (50), trait gates should pass
      // affective_empathy at 0.5 passes all gates
      expect(emotions).toBeInstanceOf(Map);
    });

    it('uses default traits (50) when affectTraits is undefined', () => {
      const emotions = service.calculateEmotions(neutralMood, null, null, undefined);

      expect(emotions).toBeInstanceOf(Map);
    });

    it('uses default traits (50) when affectTraits is empty object', () => {
      const emotions = service.calculateEmotions(neutralMood, null, null, {});

      expect(emotions).toBeInstanceOf(Map);
    });

    it('calculates emotions identically for average traits vs no traits', () => {
      const averageTraits = {
        affective_empathy: 50,
        cognitive_empathy: 50,
        harm_aversion: 50,
      };

      const emotionsWithNull = service.calculateEmotions(neutralMood, null, null, null);
      const emotionsWithAverage = service.calculateEmotions(neutralMood, null, null, averageTraits);

      // Both should produce the same results
      for (const [emotion, intensity] of emotionsWithNull) {
        expect(emotionsWithAverage.get(emotion)).toBeCloseTo(intensity, 5);
      }
    });
  });

  describe('compassion with affect traits', () => {
    const compassionateMood = {
      valence: 15,
      arousal: 30,
      agency_control: 20,
      threat: 10,
      engagement: 80,
      future_expectancy: 0,
      self_evaluation: 0,
      affiliation: 60,
    };

    it('returns near-zero intensity when affective_empathy is 5', () => {
      const lowEmpathyTraits = {
        affective_empathy: 5,
        cognitive_empathy: 70,
        harm_aversion: 10,
      };

      const emotions = service.calculateEmotions(
        compassionateMood,
        null,
        null,
        lowEmpathyTraits
      );

      // Gate affective_empathy >= 0.25 fails (0.05 < 0.25)
      expect(emotions.get('compassion')).toBe(0);
    });

    it('returns moderate intensity when affective_empathy is 50', () => {
      const averageTraits = {
        affective_empathy: 50,
        cognitive_empathy: 50,
        harm_aversion: 50,
      };

      const emotions = service.calculateEmotions(
        compassionateMood,
        null,
        null,
        averageTraits
      );

      // Gate passes, should have positive intensity
      expect(emotions.get('compassion')).toBeGreaterThan(0.1);
    });

    it('returns high intensity when affective_empathy is 95', () => {
      const highEmpathyTraits = {
        affective_empathy: 95,
        cognitive_empathy: 80,
        harm_aversion: 90,
      };

      const emotions = service.calculateEmotions(
        compassionateMood,
        null,
        null,
        highEmpathyTraits
      );

      // High empathy should produce high compassion
      expect(emotions.get('compassion')).toBeGreaterThan(0.3);
    });

    it('blocks emotion when affective_empathy < 25 (gate fails)', () => {
      const belowGateTraits = {
        affective_empathy: 24, // Just below 25 threshold
        cognitive_empathy: 70,
        harm_aversion: 50,
      };

      const emotions = service.calculateEmotions(
        compassionateMood,
        null,
        null,
        belowGateTraits
      );

      // 24/100 = 0.24 < 0.25, gate fails
      expect(emotions.get('compassion')).toBe(0);
    });

    it('allows emotion when affective_empathy >= 25 (gate passes)', () => {
      const atGateTraits = {
        affective_empathy: 25, // Exactly at threshold
        cognitive_empathy: 70,
        harm_aversion: 50,
      };

      const emotions = service.calculateEmotions(
        compassionateMood,
        null,
        null,
        atGateTraits
      );

      // 25/100 = 0.25 >= 0.25, gate passes
      expect(emotions.get('compassion')).toBeGreaterThan(0);
    });

    it('incorporates affiliation mood axis in calculation', () => {
      const traits = {
        affective_empathy: 50,
        cognitive_empathy: 50,
        harm_aversion: 50,
      };

      const lowAffiliationMood = { ...compassionateMood, affiliation: -50 };
      const highAffiliationMood = { ...compassionateMood, affiliation: 80 };

      const emotionsLow = service.calculateEmotions(lowAffiliationMood, null, null, traits);
      const emotionsHigh = service.calculateEmotions(highAffiliationMood, null, null, traits);

      // Higher affiliation should produce higher compassion
      expect(emotionsHigh.get('compassion')).toBeGreaterThan(
        emotionsLow.get('compassion')
      );
    });
  });

  describe('sociopath scenario', () => {
    // The exact scenario from the spec
    const sociopathMood = {
      valence: 15,
      arousal: 45,
      agency_control: 75,
      threat: 20,
      engagement: 80,
      future_expectancy: 10,
      self_evaluation: 90,
      affiliation: 60, // Can perform warmth
    };

    const sociopathTraits = {
      affective_empathy: 5, // Very low
      cognitive_empathy: 70, // Can understand others, just doesn't feel
      harm_aversion: 10, // Doesn't mind causing harm
    };

    it('does not trigger compassion with high engagement but low affective_empathy', () => {
      const emotions = service.calculateEmotions(
        sociopathMood,
        null,
        null,
        sociopathTraits
      );

      // Key assertion: compassion should be blocked
      expect(emotions.get('compassion')).toBe(0);
    });

    it('does not trigger guilt despite negative self_evaluation scenario', () => {
      // Modify mood to have negative self-evaluation
      const guiltScenarioMood = {
        ...sociopathMood,
        self_evaluation: -50, // Negative self-eval
        valence: -30, // Negative valence
      };

      const emotions = service.calculateEmotions(
        guiltScenarioMood,
        null,
        null,
        sociopathTraits
      );

      // Gate affective_empathy >= 0.15 fails (0.05 < 0.15)
      expect(emotions.get('guilt')).toBe(0);
    });

    it('does not trigger empathic_distress despite high engagement', () => {
      // Modify mood for empathic distress conditions
      const distressMood = {
        ...sociopathMood,
        valence: -40, // Negative valence
        agency_control: -20, // Low agency
        arousal: 50, // High arousal
      };

      const emotions = service.calculateEmotions(
        distressMood,
        null,
        null,
        sociopathTraits
      );

      // Gate affective_empathy >= 0.30 fails (0.05 < 0.30)
      expect(emotions.get('empathic_distress')).toBe(0);
    });

    it('still triggers pride (unaffected by affect traits)', () => {
      const emotions = service.calculateEmotions(
        sociopathMood,
        null,
        null,
        sociopathTraits
      );

      // Pride has no trait requirements
      expect(emotions.get('pride')).toBeGreaterThan(0.3);
    });

    it('still triggers interest (unaffected by affect traits)', () => {
      const emotions = service.calculateEmotions(
        sociopathMood,
        null,
        null,
        sociopathTraits
      );

      // Interest has no trait requirements
      expect(emotions.get('interest')).toBeGreaterThan(0.2);
    });
  });

  describe('guilt calculation', () => {
    const guiltMood = {
      valence: -40,
      arousal: 30,
      agency_control: 30, // Had agency when harm was caused
      threat: 10,
      engagement: 40,
      future_expectancy: -20,
      self_evaluation: -50, // Negative self-evaluation
      affiliation: 20,
    };

    it('requires both affective_empathy and harm_aversion for full intensity', () => {
      const highMoralTraits = {
        affective_empathy: 80,
        cognitive_empathy: 50,
        harm_aversion: 90,
      };

      const lowMoralTraits = {
        affective_empathy: 30,
        cognitive_empathy: 50,
        harm_aversion: 20,
      };

      const emotionsHigh = service.calculateEmotions(guiltMood, null, null, highMoralTraits);
      const emotionsLow = service.calculateEmotions(guiltMood, null, null, lowMoralTraits);

      // Higher moral traits should produce more guilt
      expect(emotionsHigh.get('guilt')).toBeGreaterThan(emotionsLow.get('guilt'));
    });

    it('blocks guilt when affective_empathy gate fails', () => {
      const lowEmpathyTraits = {
        affective_empathy: 10, // Below 15 threshold
        cognitive_empathy: 80,
        harm_aversion: 80, // High harm aversion doesn't help
      };

      const emotions = service.calculateEmotions(
        guiltMood,
        null,
        null,
        lowEmpathyTraits
      );

      // Gate fails: 0.10 < 0.15
      expect(emotions.get('guilt')).toBe(0);
    });

    it('allows guilt when affective_empathy gate passes', () => {
      const minimalEmpathyTraits = {
        affective_empathy: 15, // Exactly at threshold
        cognitive_empathy: 50,
        harm_aversion: 50,
      };

      const emotions = service.calculateEmotions(
        guiltMood,
        null,
        null,
        minimalEmpathyTraits
      );

      // Gate passes: 0.15 >= 0.15
      expect(emotions.get('guilt')).toBeGreaterThan(0);
    });
  });

  describe('empathic distress calculation', () => {
    const distressMood = {
      valence: -50,
      arousal: 60,
      agency_control: -30, // Low agency
      threat: 30,
      engagement: 70,
      future_expectancy: -30,
      self_evaluation: -20,
      affiliation: 40,
    };

    it('requires moderate affective_empathy (>= 0.30)', () => {
      const moderateEmpathyTraits = {
        affective_empathy: 30, // Exactly at threshold
        cognitive_empathy: 50,
        harm_aversion: 50,
      };

      const belowThresholdTraits = {
        affective_empathy: 29, // Just below
        cognitive_empathy: 50,
        harm_aversion: 50,
      };

      const emotionsPass = service.calculateEmotions(distressMood, null, null, moderateEmpathyTraits);
      const emotionsFail = service.calculateEmotions(distressMood, null, null, belowThresholdTraits);

      expect(emotionsPass.get('empathic_distress')).toBeGreaterThan(0);
      expect(emotionsFail.get('empathic_distress')).toBe(0);
    });
  });

  describe('trait normalization edge cases', () => {
    const testMood = {
      valence: 20,
      arousal: 30,
      agency_control: 20,
      threat: 10,
      engagement: 60,
      future_expectancy: 10,
      self_evaluation: 10,
      affiliation: 30,
    };

    it('handles trait values at minimum (0)', () => {
      const minTraits = {
        affective_empathy: 0,
        cognitive_empathy: 0,
        harm_aversion: 0,
      };

      const emotions = service.calculateEmotions(testMood, null, null, minTraits);

      // Should not throw, compassion should be blocked by gate
      expect(emotions).toBeInstanceOf(Map);
      expect(emotions.get('compassion')).toBe(0);
    });

    it('handles trait values at maximum (100)', () => {
      const maxTraits = {
        affective_empathy: 100,
        cognitive_empathy: 100,
        harm_aversion: 100,
      };

      const emotions = service.calculateEmotions(testMood, null, null, maxTraits);

      // Should not throw
      expect(emotions).toBeInstanceOf(Map);
    });

    it('handles partial trait objects (uses defaults for missing)', () => {
      const partialTraits = {
        affective_empathy: 80,
        // cognitive_empathy and harm_aversion missing
      };

      const emotions = service.calculateEmotions(testMood, null, null, partialTraits);

      // Should not throw, missing traits default to 50
      expect(emotions).toBeInstanceOf(Map);
    });
  });
});
