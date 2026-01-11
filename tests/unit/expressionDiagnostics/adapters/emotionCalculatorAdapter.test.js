import { describe, expect, it, jest } from '@jest/globals';
import EmotionCalculatorAdapter from '../../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEmotionCalculatorService = () => ({
  calculateEmotions: jest.fn(),
  calculateSexualArousal: jest.fn(),
  calculateSexualStates: jest.fn(),
});

describe('EmotionCalculatorAdapter', () => {
  it('delegates calculateEmotions with raw mood data and converts Map output', () => {
    const emotionCalculatorService = createEmotionCalculatorService();
    const logger = createLogger();
    const adapter = new EmotionCalculatorAdapter({
      emotionCalculatorService,
      logger,
    });

    const mood = { valence: 50, arousal: -25 };
    const sexualState = { sex_excitation: 10 };
    const affectTraits = { affective_empathy: 75 };
    const results = new Map([['joy', 0.7]]);
    emotionCalculatorService.calculateEmotions.mockReturnValue(results);

    const output = adapter.calculateEmotions(mood, sexualState, affectTraits);

    expect(emotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
      mood,
      null,
      sexualState,
      affectTraits
    );
    expect(output).toEqual({ joy: 0.7 });
  });

  it('delegates calculateSexualArousal', () => {
    const emotionCalculatorService = createEmotionCalculatorService();
    const logger = createLogger();
    const adapter = new EmotionCalculatorAdapter({
      emotionCalculatorService,
      logger,
    });

    const sexualState = { sex_excitation: 10, sex_inhibition: 5 };
    emotionCalculatorService.calculateSexualArousal.mockReturnValue(0.3);

    const output = adapter.calculateSexualArousal(sexualState);

    expect(emotionCalculatorService.calculateSexualArousal).toHaveBeenCalledWith(
      sexualState
    );
    expect(output).toBe(0.3);
  });

  it('delegates calculateSexualStates and converts Map output', () => {
    const emotionCalculatorService = createEmotionCalculatorService();
    const logger = createLogger();
    const adapter = new EmotionCalculatorAdapter({
      emotionCalculatorService,
      logger,
    });

    const mood = { valence: 20 };
    const sexualState = { sex_excitation: 10 };
    const sexualArousal = 0.4;
    const results = new Map([['sexual_lust', 0.2]]);
    emotionCalculatorService.calculateSexualStates.mockReturnValue(results);

    const output = adapter.calculateSexualStates(
      mood,
      sexualState,
      sexualArousal
    );

    expect(emotionCalculatorService.calculateSexualStates).toHaveBeenCalledWith(
      mood,
      sexualArousal,
      sexualState
    );
    expect(output).toEqual({ sexual_lust: 0.2 });
  });

  it('validates required dependencies', () => {
    const logger = createLogger();

    expect(
      () =>
        new EmotionCalculatorAdapter({
          emotionCalculatorService: {},
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });
});
