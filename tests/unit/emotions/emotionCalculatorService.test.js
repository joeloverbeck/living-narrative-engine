/**
 * @file Unit tests for EmotionCalculatorService
 * @see src/emotions/emotionCalculatorService.js
 * @see tickets/MOOANDSEXAROSYS-003-emotion-calculator-service.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('EmotionCalculatorService', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  // Sample emotion prototypes for testing
  const mockEmotionPrototypes = {
    joy: {
      weights: { valence: 1.0, arousal: 0.3 },
      gates: ['valence >= 0.20'],
    },
    sadness: {
      weights: { valence: -1.0, arousal: -0.3 },
      gates: ['valence <= -0.20'],
    },
    pride: {
      weights: { self_evaluation: 1.0, agency_control: 0.4, valence: 0.3 },
      gates: ['self_evaluation >= 0.25'],
    },
    fear: {
      weights: { threat: 1.0, arousal: 0.5, agency_control: -0.4 },
      gates: ['threat >= 0.30'],
    },
    calm: {
      weights: { arousal: -1.0, valence: 0.3, threat: -0.5 },
      // No gates - always activates
    },
    lust_emotion: {
      weights: { sexual_arousal: 1.0, valence: 0.3 },
      gates: ['sexual_arousal >= 0.30'],
    },
  };

  // Sample sexual prototypes for testing
  const mockSexualPrototypes = {
    sexual_lust: {
      weights: {
        sexual_arousal: 1.0,
        valence: 0.3,
        arousal: 0.3,
        threat: -0.6,
      },
      gates: ['sexual_arousal >= 0.35', 'threat <= 0.30'],
    },
    aroused_with_shame: {
      weights: { sexual_arousal: 1.0, self_evaluation: -0.9 },
      gates: ['sexual_arousal >= 0.35', 'self_evaluation <= -0.20'],
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
          return { entries: mockEmotionPrototypes };
        }
        if (category === 'lookups' && id === 'core:sexual_prototypes') {
          return { entries: mockSexualPrototypes };
        }
        return null;
      }),
    };

    service = new EmotionCalculatorService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(EmotionCalculatorService);
    });

    it('should throw InvalidArgumentError when logger is missing', () => {
      expect(
        () =>
          new EmotionCalculatorService({
            logger: null,
            dataRegistry: mockDataRegistry,
          })
      ).toThrow(InvalidArgumentError);
      expect(
        () =>
          new EmotionCalculatorService({
            logger: null,
            dataRegistry: mockDataRegistry,
          })
      ).toThrow('logger is required');
    });

    it('should throw InvalidArgumentError when dataRegistry is missing', () => {
      expect(
        () =>
          new EmotionCalculatorService({
            logger: mockLogger,
            dataRegistry: null,
          })
      ).toThrow(InvalidArgumentError);
      expect(
        () =>
          new EmotionCalculatorService({
            logger: mockLogger,
            dataRegistry: null,
          })
      ).toThrow('dataRegistry is required');
    });

    it('should throw InvalidArgumentError when dataRegistry is undefined', () => {
      expect(
        () =>
          new EmotionCalculatorService({
            logger: mockLogger,
            dataRegistry: undefined,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('calculateSexualArousal', () => {
    it('should return null when sexualState is null', () => {
      const result = service.calculateSexualArousal(null);
      expect(result).toBeNull();
    });

    it('should return null when sexualState is undefined', () => {
      const result = service.calculateSexualArousal(undefined);
      expect(result).toBeNull();
    });

    it('should calculate sexual arousal using formula (excitation - inhibition + baseline) / 100', () => {
      const sexualState = {
        sex_excitation: 70,
        sex_inhibition: 20,
        baseline_libido: 30,
      };
      // (70 - 20 + 30) / 100 = 0.8
      const result = service.calculateSexualArousal(sexualState);
      expect(result).toBeCloseTo(0.8, 2);
    });

    it('should clamp result to [0, 1] when above 1', () => {
      const sexualState = {
        sex_excitation: 100,
        sex_inhibition: 0,
        baseline_libido: 50,
      };
      // (100 - 0 + 50) / 100 = 1.5 → clamped to 1.0
      const result = service.calculateSexualArousal(sexualState);
      expect(result).toBe(1.0);
    });

    it('should clamp result to [0, 1] when below 0', () => {
      const sexualState = {
        sex_excitation: 0,
        sex_inhibition: 100,
        baseline_libido: 0,
      };
      // (0 - 100 + 0) / 100 = -1.0 → clamped to 0
      const result = service.calculateSexualArousal(sexualState);
      expect(result).toBe(0);
    });

    it('should handle missing fields by defaulting to 0', () => {
      const sexualState = { sex_excitation: 50 };
      // (50 - 0 + 0) / 100 = 0.5
      const result = service.calculateSexualArousal(sexualState);
      expect(result).toBeCloseTo(0.5, 2);
    });

    it('should handle empty sexualState object', () => {
      const sexualState = {};
      // (0 - 0 + 0) / 100 = 0
      const result = service.calculateSexualArousal(sexualState);
      expect(result).toBe(0);
    });

    it('should throw when sex_excitation looks pre-normalized', () => {
      const sexualState = {
        sex_excitation: 0.5,
        sex_inhibition: 20,
        baseline_libido: 0,
      };

      expect(() => service.calculateSexualArousal(sexualState)).toThrow(
        InvalidArgumentError
      );
      expect(() => service.calculateSexualArousal(sexualState)).toThrow(
        'pre-normalized'
      );
    });

    it('should throw when sex_inhibition is out of range', () => {
      const sexualState = {
        sex_excitation: 50,
        sex_inhibition: 120,
        baseline_libido: 0,
      };

      expect(() => service.calculateSexualArousal(sexualState)).toThrow(
        InvalidArgumentError
      );
      expect(() => service.calculateSexualArousal(sexualState)).toThrow(
        'range [0..100]'
      );
    });
  });

  describe('calculateEmotions', () => {
    it('should return Map of emotion intensities', () => {
      const moodData = {
        valence: 50,
        arousal: 30,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('joy')).toBe(true);
    });

    it('should include all emotion prototype keys with zero defaults', () => {
      const moodData = {
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);

      expect(result.size).toBe(Object.keys(mockEmotionPrototypes).length);
      expect(result.get('joy')).toBe(0);
      expect(result.get('sadness')).toBe(0);
    });

    it('should set zero intensity when gate checks fail', () => {
      const moodData = {
        valence: -50, // fails joy gate (valence >= 0.20)
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);

      expect(result.has('joy')).toBe(true);
      expect(result.get('joy')).toBe(0);
      expect(result.get('sadness')).toBeGreaterThan(0); // passes sadness gate (valence <= -0.20)
    });

    it('should calculate pride intensity correctly (ticket example)', () => {
      // From ticket: self_eval=70, agency=20, valence=10
      // Pride weights: self_evaluation=1.0, agency_control=0.4, valence=0.3
      // Gate: self_evaluation >= 0.25 (passes: 0.70 >= 0.25)
      // Raw = 0.70*1.0 + 0.20*0.4 + 0.10*0.3 = 0.81
      // Max = 1.0 + 0.4 + 0.3 = 1.7
      // Intensity = 0.81 / 1.7 ≈ 0.476

      const moodData = {
        valence: 10,
        arousal: 0,
        agency_control: 20,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 70,
      };

      const result = service.calculateEmotions(moodData, null);

      expect(result.has('pride')).toBe(true);
      expect(result.get('pride')).toBeCloseTo(0.476, 2);
    });

    it('should handle sexual_arousal in emotion weights', () => {
      const moodData = {
        valence: 30,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, 0.5);

      expect(result.has('lust_emotion')).toBe(true);
    });

    it('should return empty Map when no prototypes are available', () => {
      mockDataRegistry.get.mockReturnValue(null);
      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 50, arousal: 0 };
      const result = freshService.calculateEmotions(moodData, null);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should include emotions without gates (always activate)', () => {
      const moodData = {
        valence: 0,
        arousal: -50, // calm has arousal: -1.0 weight
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);

      expect(result.has('calm')).toBe(true);
    });

    it('should handle boundary values (100, -100)', () => {
      const moodData = {
        valence: 100, // max value
        arousal: 100,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);

      expect(result.has('joy')).toBe(true);
      // Joy intensity: (1.0*1.0 + 1.0*0.3) / (1.0 + 0.3) = 1.3/1.3 = 1.0
      expect(result.get('joy')).toBeCloseTo(1.0, 2);
    });
  });

  describe('calculateSexualStates', () => {
    it('should return Map of sexual state intensities', () => {
      const moodData = {
        valence: 50,
        arousal: 30,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateSexualStates(moodData, 0.5);

      expect(result).toBeInstanceOf(Map);
    });

    it('should include all sexual prototype keys with zero defaults', () => {
      const moodData = {
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 100,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateSexualStates(moodData, 0.1);

      expect(result.size).toBe(Object.keys(mockSexualPrototypes).length);
      expect(result.get('sexual_lust')).toBe(0);
      expect(result.get('aroused_with_shame')).toBe(0);
    });

    it('should handle sex_inhibition axis in sexual state weights', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:sexual_prototypes') {
          return {
            entries: {
              sexual_repulsion: {
                weights: { sex_inhibition: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateSexualStates(
        {},
        null,
        { sex_inhibition: 90 }
      );

      expect(result.get('sexual_repulsion')).toBeCloseTo(0.9, 2);
    });

    it('should handle sex_excitation axis in sexual state weights', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:sexual_prototypes') {
          return {
            entries: {
              sexual_interest: {
                weights: { sex_excitation: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateSexualStates(
        {},
        null,
        { sex_excitation: 80 }
      );

      expect(result.get('sexual_interest')).toBeCloseTo(0.8, 2);
    });

    it('should handle sex_excitation axis in sexual state gates', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:sexual_prototypes') {
          return {
            entries: {
              sexual_interest: {
                weights: { sex_excitation: 1.0 },
                gates: ['sex_excitation >= 0.6'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const lowExcitation = freshService.calculateSexualStates(
        {},
        null,
        { sex_excitation: 40 }
      );
      expect(lowExcitation.has('sexual_interest')).toBe(true);
      expect(lowExcitation.get('sexual_interest')).toBe(0);

      const highExcitation = freshService.calculateSexualStates(
        {},
        null,
        { sex_excitation: 80 }
      );
      expect(highExcitation.has('sexual_interest')).toBe(true);
    });

    it('should set zero intensity when sexual state gates fail', () => {
      const moodData = {
        valence: 50,
        arousal: 0,
        agency_control: 0,
        threat: 50, // fails sexual_lust gate (threat <= 0.30)
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateSexualStates(moodData, 0.5);

      expect(result.has('sexual_lust')).toBe(true);
      expect(result.get('sexual_lust')).toBe(0);
    });

    it('should calculate sexual_lust correctly when all gates pass', () => {
      const moodData = {
        valence: 50,
        arousal: 50,
        agency_control: 0,
        threat: 0, // passes threat <= 0.30
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateSexualStates(moodData, 0.5); // passes SA >= 0.35

      expect(result.has('sexual_lust')).toBe(true);
    });

    it('should return empty Map when no prototypes are available', () => {
      mockDataRegistry.get.mockReturnValue(null);
      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 50 };
      const result = freshService.calculateSexualStates(moodData, 0.5);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('gate checking', () => {
    it('should handle >= operator', () => {
      const moodData = {
        valence: 25, // 0.25 >= 0.20
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);
      expect(result.has('joy')).toBe(true);
    });

    it('should handle <= operator', () => {
      const moodData = {
        valence: -25, // -0.25 <= -0.20
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);
      expect(result.has('sadness')).toBe(true);
    });

    it('should handle > operator', () => {
      // Add a test prototype with > operator
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              test_emotion: {
                weights: { valence: 1.0 },
                gates: ['valence > 0.50'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      // 0.51 > 0.50 should pass
      const passingMood = { valence: 51 };
      const passingResult = freshService.calculateEmotions(passingMood, null);
      expect(passingResult.has('test_emotion')).toBe(true);

      // 0.50 > 0.50 should fail
      const failingMood = { valence: 50 };
      const failingResult = freshService.calculateEmotions(failingMood, null);
      expect(failingResult.has('test_emotion')).toBe(true);
      expect(failingResult.get('test_emotion')).toBe(0);
    });

    it('should handle < operator', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              test_emotion: {
                weights: { valence: 1.0 },
                gates: ['valence < 0.50'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      // 0.49 < 0.50 should pass
      const passingMood = { valence: 49 };
      const passingResult = freshService.calculateEmotions(passingMood, null);
      expect(passingResult.has('test_emotion')).toBe(true);
    });

    it('should handle == operator with float comparison', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              neutral: {
                weights: { valence: 0.1 }, // Small weight so we get some intensity
                gates: ['valence == 0.00'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 0 };
      const result = freshService.calculateEmotions(moodData, null);

      // Gates pass but intensity is 0 since valence is 0
      expect(result.has('neutral')).toBe(true);
      expect(result.get('neutral')).toBe(0);
    });

    it('should handle sexual_arousal axis in gates', () => {
      const moodData = {
        valence: 30,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      // Test with SA below threshold
      const lowSAResult = service.calculateEmotions(moodData, 0.2);
      expect(lowSAResult.has('lust_emotion')).toBe(true);
      expect(lowSAResult.get('lust_emotion')).toBe(0);

      // Test with SA above threshold
      const highSAResult = service.calculateEmotions(moodData, 0.4);
      expect(highSAResult.has('lust_emotion')).toBe(true);
    });

    it('should handle sex_inhibition axis in weights', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              inhibited_emotion: {
                weights: { sex_inhibition: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateEmotions(
        {},
        null,
        { sex_inhibition: 80 }
      );

      expect(result.get('inhibited_emotion')).toBeCloseTo(0.8, 2);
    });

    it('should handle sex_excitation axis in weights', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              excited_emotion: {
                weights: { sex_excitation: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateEmotions(
        {},
        null,
        { sex_excitation: 80 }
      );

      expect(result.get('excited_emotion')).toBeCloseTo(0.8, 2);
    });

    it('should handle sexual_inhibition axis alias in weights', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              inhibited_emotion: {
                weights: { sexual_inhibition: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateEmotions(
        {},
        null,
        { sex_inhibition: 70 }
      );

      expect(result.get('inhibited_emotion')).toBeCloseTo(0.7, 2);
    });

    it('should handle sex_excitation axis in gates', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              excited_emotion: {
                weights: { sex_excitation: 1.0 },
                gates: ['sex_excitation >= 0.6'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const lowExcitation = freshService.calculateEmotions(
        {},
        null,
        { sex_excitation: 40 }
      );
      expect(lowExcitation.has('excited_emotion')).toBe(true);
      expect(lowExcitation.get('excited_emotion')).toBe(0);

      const highExcitation = freshService.calculateEmotions(
        {},
        null,
        { sex_excitation: 80 }
      );
      expect(highExcitation.has('excited_emotion')).toBe(true);
    });

    it('should handle sex_inhibition axis in gates', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              inhibited_emotion: {
                weights: { sex_inhibition: 1.0 },
                gates: ['sex_inhibition >= 0.6'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const lowInhibition = freshService.calculateEmotions(
        {},
        null,
        { sex_inhibition: 40 }
      );
      expect(lowInhibition.has('inhibited_emotion')).toBe(true);
      expect(lowInhibition.get('inhibited_emotion')).toBe(0);

      const highInhibition = freshService.calculateEmotions(
        {},
        null,
        { sex_inhibition: 80 }
      );
      expect(highInhibition.has('inhibited_emotion')).toBe(true);
    });

    it('should log warning for invalid gate format', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              bad_emotion: {
                weights: { valence: 1.0 },
                gates: ['invalid gate format'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 50 };
      freshService.calculateEmotions(moodData, null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid gate format')
      );
    });

    it('should handle missing gates array (all gates pass)', () => {
      const moodData = {
        valence: 0,
        arousal: -80,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      const result = service.calculateEmotions(moodData, null);

      // calm has no gates, should be included
      expect(result.has('calm')).toBe(true);
    });

    it('should handle unknown gate operator', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              test_emotion: {
                weights: { valence: 1.0 },
                gates: ['valence != 0.50'], // != is not supported
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 50 };
      freshService.calculateEmotions(moodData, null);

      // Invalid operator format - gate won't parse, so warning about invalid format
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getIntensityLabel', () => {
    it('should return "absent" for intensity < 0.05', () => {
      expect(service.getIntensityLabel(0)).toBe('absent');
      expect(service.getIntensityLabel(0.04)).toBe('absent');
      expect(service.getIntensityLabel(0.05)).toBe('absent');
    });

    it('should return "faint" for intensity 0.05-0.15', () => {
      expect(service.getIntensityLabel(0.06)).toBe('faint');
      expect(service.getIntensityLabel(0.1)).toBe('faint');
      expect(service.getIntensityLabel(0.15)).toBe('faint');
    });

    it('should return "slight" for intensity 0.15-0.25', () => {
      expect(service.getIntensityLabel(0.16)).toBe('slight');
      expect(service.getIntensityLabel(0.2)).toBe('slight');
      expect(service.getIntensityLabel(0.25)).toBe('slight');
    });

    it('should return "mild" for intensity 0.25-0.35', () => {
      expect(service.getIntensityLabel(0.26)).toBe('mild');
      expect(service.getIntensityLabel(0.3)).toBe('mild');
      expect(service.getIntensityLabel(0.35)).toBe('mild');
    });

    it('should return "noticeable" for intensity 0.35-0.45', () => {
      expect(service.getIntensityLabel(0.36)).toBe('noticeable');
      expect(service.getIntensityLabel(0.4)).toBe('noticeable');
      expect(service.getIntensityLabel(0.45)).toBe('noticeable');
    });

    it('should return "moderate" for intensity 0.45-0.55', () => {
      expect(service.getIntensityLabel(0.46)).toBe('moderate');
      expect(service.getIntensityLabel(0.5)).toBe('moderate');
      expect(service.getIntensityLabel(0.55)).toBe('moderate');
    });

    it('should return "strong" for intensity 0.55-0.65', () => {
      expect(service.getIntensityLabel(0.56)).toBe('strong');
      expect(service.getIntensityLabel(0.6)).toBe('strong');
      expect(service.getIntensityLabel(0.65)).toBe('strong');
    });

    it('should return "intense" for intensity 0.65-0.75', () => {
      expect(service.getIntensityLabel(0.66)).toBe('intense');
      expect(service.getIntensityLabel(0.7)).toBe('intense');
      expect(service.getIntensityLabel(0.75)).toBe('intense');
    });

    it('should return "powerful" for intensity 0.75-0.85', () => {
      expect(service.getIntensityLabel(0.76)).toBe('powerful');
      expect(service.getIntensityLabel(0.8)).toBe('powerful');
      expect(service.getIntensityLabel(0.85)).toBe('powerful');
    });

    it('should return "overwhelming" for intensity 0.85-0.95', () => {
      expect(service.getIntensityLabel(0.86)).toBe('overwhelming');
      expect(service.getIntensityLabel(0.9)).toBe('overwhelming');
      expect(service.getIntensityLabel(0.95)).toBe('overwhelming');
    });

    it('should return "extreme" for intensity > 0.95', () => {
      expect(service.getIntensityLabel(0.96)).toBe('extreme');
      expect(service.getIntensityLabel(1.0)).toBe('extreme');
    });

    it('should clamp values above 1', () => {
      expect(service.getIntensityLabel(1.5)).toBe('extreme');
    });

    it('should clamp negative values', () => {
      expect(service.getIntensityLabel(-0.5)).toBe('absent');
    });
  });

  describe('getTopEmotions', () => {
    it('returns sorted items with display names and labels', () => {
      const emotions = new Map([
        ['inner_peace', 0.6],
        ['joy', 0.8],
      ]);

      const result = service.getTopEmotions(emotions);

      expect(result[0].name).toBe('joy');
      expect(result[0].displayName).toBe('joy');
      expect(result[1].displayName).toBe('inner peace');
      expect(result[0].label).toBe('powerful');
    });

    it('filters out emotions below the threshold', () => {
      const emotions = new Map([
        ['joy', 0.6],
        ['weak', 0.04],
      ]);

      const result = service.getTopEmotions(emotions);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('joy');
    });

    it('respects maxCount overrides', () => {
      const emotions = new Map([
        ['joy', 0.9],
        ['pride', 0.8],
        ['excitement', 0.7],
      ]);

      const result = service.getTopEmotions(emotions, 2);

      expect(result).toHaveLength(2);
      expect(result.find((item) => item.name === 'excitement')).toBeUndefined();
    });

    it('returns empty array for null or empty maps', () => {
      expect(service.getTopEmotions(null)).toEqual([]);
      expect(service.getTopEmotions(new Map())).toEqual([]);
    });
  });

  describe('getTopSexualStates', () => {
    it('returns sorted items with display names and labels', () => {
      const states = new Map([
        ['romantic_yearning', 0.4],
        ['sexual_lust', 0.7],
      ]);

      const result = service.getTopSexualStates(states);

      expect(result[0].name).toBe('sexual_lust');
      expect(result[0].displayName).toBe('sexual lust');
      expect(result[1].displayName).toBe('romantic yearning');
      expect(result[0].label).toBe('intense');
    });

    it('filters out states below the threshold', () => {
      const states = new Map([
        ['sexual_lust', 0.7],
        ['weak', 0.01],
      ]);

      const result = service.getTopSexualStates(states);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sexual_lust');
    });

    it('returns empty array for null or empty maps', () => {
      expect(service.getTopSexualStates(null)).toEqual([]);
      expect(service.getTopSexualStates(new Map())).toEqual([]);
    });
  });

  describe('formatEmotionsForPrompt', () => {
    it('should format top emotions with labels', () => {
      const emotions = new Map([
        ['joy', 0.6], // strong
        ['contentment', 0.4], // noticeable
        ['excitement', 0.2], // slight
      ]);

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toContain('joy: strong');
      expect(result).toContain('contentment: noticeable');
      expect(result).toContain('excitement: slight');
    });

    it('should limit to maxCount emotions', () => {
      const emotions = new Map([
        ['joy', 0.9],
        ['pride', 0.8],
        ['excitement', 0.7],
        ['contentment', 0.6],
        ['curiosity', 0.5],
        ['hope', 0.4], // should be excluded with explicit maxCount=5
      ]);

      const result = service.formatEmotionsForPrompt(emotions, 5);

      expect(result).toContain('joy');
      expect(result).toContain('pride');
      expect(result).toContain('excitement');
      expect(result).toContain('contentment');
      expect(result).toContain('curiosity');
      expect(result).not.toContain('hope');
    });

    it('should sort by intensity descending', () => {
      const emotions = new Map([
        ['low', 0.2],
        ['high', 0.9],
        ['medium', 0.5],
      ]);

      const result = service.formatEmotionsForPrompt(emotions);

      // high should come before medium, medium before low
      const highIndex = result.indexOf('high');
      const mediumIndex = result.indexOf('medium');
      const lowIndex = result.indexOf('low');

      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    it('should replace underscores with spaces', () => {
      const emotions = new Map([['inner_peace', 0.6]]);

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toContain('inner peace');
      expect(result).not.toContain('inner_peace');
    });

    it('should exclude emotions with intensity < 0.05', () => {
      const emotions = new Map([
        ['joy', 0.6],
        ['almost_absent', 0.04], // below threshold
      ]);

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toContain('joy');
      expect(result).not.toContain('almost');
    });

    it('should return empty string for empty map', () => {
      const emotions = new Map();

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(service.formatEmotionsForPrompt(null)).toBe('');
      expect(service.formatEmotionsForPrompt(undefined)).toBe('');
    });

    it('should return empty string when all emotions below threshold', () => {
      const emotions = new Map([
        ['weak1', 0.02],
        ['weak2', 0.03],
      ]);

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toBe('');
    });

    it('should use comma separator between emotions', () => {
      const emotions = new Map([
        ['joy', 0.6],
        ['pride', 0.5],
      ]);

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toMatch(/joy: strong,\s*pride: moderate/);
    });

    it('should limit to default max emotions when maxCount is omitted', () => {
      const emotions = new Map([
        ['joy', 0.9],
        ['pride', 0.8],
        ['excitement', 0.7],
        ['contentment', 0.6],
        ['curiosity', 0.5],
        ['hope', 0.4],
        ['relief', 0.35],
        ['gratitude', 0.3],
      ]);

      const result = service.formatEmotionsForPrompt(emotions);

      expect(result).toContain('joy');
      expect(result).toContain('pride');
      expect(result).toContain('excitement');
      expect(result).toContain('contentment');
      expect(result).toContain('curiosity');
      expect(result).toContain('hope');
      expect(result).toContain('relief');
      expect(result).not.toContain('gratitude');
    });

    it('should use configured default max emotions when maxCount is omitted', () => {
      const customService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
        displayConfig: { maxEmotionalStates: 2, maxSexualStates: 5 },
      });
      const emotions = new Map([
        ['joy', 0.9],
        ['pride', 0.8],
        ['excitement', 0.7],
      ]);

      const result = customService.formatEmotionsForPrompt(emotions);

      expect(result).toContain('joy');
      expect(result).toContain('pride');
      expect(result).not.toContain('excitement');
    });
  });

  describe('formatSexualStatesForPrompt', () => {
    it('should format sexual states with labels', () => {
      const states = new Map([
        ['sexual_lust', 0.7],
        ['aroused_with_shame', 0.5],
      ]);

      const result = service.formatSexualStatesForPrompt(states);

      expect(result).toContain('sexual lust: intense');
      expect(result).toContain('aroused with shame: moderate');
    });

    it('should limit to maxCount states (default 5)', () => {
      const states = new Map([
        ['state1', 0.9],
        ['state2', 0.8],
        ['state3', 0.7],
        ['state4', 0.6],
        ['state5', 0.5],
        ['state6', 0.4], // should be excluded
      ]);

      const result = service.formatSexualStatesForPrompt(states);

      expect(result).toContain('state1');
      expect(result).toContain('state2');
      expect(result).toContain('state3');
      expect(result).toContain('state4');
      expect(result).toContain('state5');
      expect(result).not.toContain('state6');
    });

    it('should sort by intensity descending', () => {
      const states = new Map([
        ['low', 0.2],
        ['high', 0.9],
      ]);

      const result = service.formatSexualStatesForPrompt(states);

      expect(result.indexOf('high')).toBeLessThan(result.indexOf('low'));
    });

    it('should return empty string for null/undefined', () => {
      expect(service.formatSexualStatesForPrompt(null)).toBe('');
      expect(service.formatSexualStatesForPrompt(undefined)).toBe('');
    });

    it('should return empty string when all states below threshold', () => {
      const states = new Map([['weak', 0.02]]);

      const result = service.formatSexualStatesForPrompt(states);

      expect(result).toBe('');
    });

    it('should use configured default max sexual states when maxCount is omitted', () => {
      const customService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
        displayConfig: { maxEmotionalStates: 7, maxSexualStates: 1 },
      });
      const states = new Map([
        ['state1', 0.9],
        ['state2', 0.8],
      ]);

      const result = customService.formatSexualStatesForPrompt(states);

      expect(result).toContain('state1');
      expect(result).not.toContain('state2');
    });
  });

  describe('prototype loading', () => {
    it('should lazy load emotion prototypes on first calculateEmotions call', () => {
      const moodData = { valence: 50 };

      // First call
      service.calculateEmotions(moodData, null);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'lookups',
        'core:emotion_prototypes'
      );

      // Reset mock
      mockDataRegistry.get.mockClear();

      // Second call - should not reload
      service.calculateEmotions(moodData, null);
      expect(mockDataRegistry.get).not.toHaveBeenCalledWith(
        'lookups',
        'core:emotion_prototypes'
      );
    });

    it('should lazy load sexual prototypes on first calculateSexualStates call', () => {
      const moodData = { valence: 50 };

      // First call
      service.calculateSexualStates(moodData, 0.5);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'lookups',
        'core:sexual_prototypes'
      );

      // Reset mock
      mockDataRegistry.get.mockClear();

      // Second call - should not reload
      service.calculateSexualStates(moodData, 0.5);
      expect(mockDataRegistry.get).not.toHaveBeenCalledWith(
        'lookups',
        'core:sexual_prototypes'
      );
    });

    it('should handle lookup with invalid entries', () => {
      mockDataRegistry.get.mockReturnValue({ entries: null });
      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateEmotions({ valence: 50 }, null);

      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should default prototype without weights to zero intensity', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              bad_emotion: {
                gates: ['valence >= 0.20'],
                // no weights
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const result = freshService.calculateEmotions({ valence: 50 }, null);

      expect(result.has('bad_emotion')).toBe(true);
      expect(result.get('bad_emotion')).toBe(0);
    });
  });

  describe('SA weight key alias', () => {
    it('should handle SA as alias for sexual_arousal in weights', () => {
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              sa_emotion: {
                weights: { SA: 1.0, valence: 0.2 },
                gates: ['sexual_arousal >= 0.30'],
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 20 };
      const result = freshService.calculateEmotions(moodData, 0.5);

      expect(result.has('sa_emotion')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle all zero mood values', () => {
      const moodData = {
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      };

      // Should not throw
      const emotions = service.calculateEmotions(moodData, null);
      const states = service.calculateSexualStates(moodData, 0);

      expect(emotions).toBeInstanceOf(Map);
      expect(states).toBeInstanceOf(Map);
    });

    it('should handle extremely high values', () => {
      const moodData = {
        valence: 1000, // Beyond expected range
        arousal: 1000,
        agency_control: 1000,
        threat: 1000,
        engagement: 1000,
        future_expectancy: 1000,
        self_evaluation: 1000,
      };

      // Should not throw
      const emotions = service.calculateEmotions(moodData, null);
      expect(emotions).toBeInstanceOf(Map);
    });

    it('should handle negative values beyond range', () => {
      const moodData = {
        valence: -1000,
        arousal: -1000,
        agency_control: -1000,
        threat: -1000,
        engagement: -1000,
        future_expectancy: -1000,
        self_evaluation: -1000,
      };

      // Should not throw
      const emotions = service.calculateEmotions(moodData, null);
      expect(emotions).toBeInstanceOf(Map);
    });

    it('should keep emotions with zero intensity', () => {
      // All negative weights with positive values = negative intensity = clamped to 0
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return {
            entries: {
              negative_emotion: {
                weights: { valence: -1.0, arousal: -1.0 },
                // no gates
              },
            },
          };
        }
        return null;
      });

      const freshService = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const moodData = { valence: 100, arousal: 100 };
      const result = freshService.calculateEmotions(moodData, null);

      // Intensity would be negative, clamped to 0
      expect(result.has('negative_emotion')).toBe(true);
      expect(result.get('negative_emotion')).toBe(0);
    });
  });
});
