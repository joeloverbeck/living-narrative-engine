import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionContextBuilder from '../../../src/expressions/expressionContextBuilder.js';
import { createEntityContext } from '../../../src/logic/contextAssembler.js';

jest.mock('../../../src/logic/contextAssembler.js', () => ({
  createEntityContext: jest.fn(),
}));

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = () => ({
  getComponentData: jest.fn(),
  getAllComponentTypesForEntity: jest.fn(),
  hasComponent: jest.fn(),
});

const createEmotionCalculatorService = () => ({
  calculateSexualArousal: jest.fn(),
  calculateEmotions: jest.fn(),
  calculateSexualStates: jest.fn(),
});

describe('ExpressionContextBuilder', () => {
  /** @type {ExpressionContextBuilder} */
  let builder;
  let emotionCalculatorService;
  let entityManager;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();

    emotionCalculatorService = createEmotionCalculatorService();
    emotionCalculatorService.calculateSexualArousal.mockReturnValue(0.4);
    emotionCalculatorService.calculateEmotions.mockReturnValue(
      new Map([['joy', 0.6]])
    );
    emotionCalculatorService.calculateSexualStates.mockReturnValue(
      new Map([['sexual_lust', 0.5]])
    );

    entityManager = createEntityManager();
    logger = createLogger();

    createEntityContext.mockReturnValue({
      id: 'actor-1',
      components: { accessor: true },
    });

    builder = new ExpressionContextBuilder({
      emotionCalculatorService,
      entityManager,
      logger,
    });
  });

  it('should build context with all required fields', () => {
    const moodData = {
      valence: 10,
      arousal: 20,
      agency_control: 30,
      threat: -10,
      engagement: 5,
      future_expectancy: -15,
      self_evaluation: 8,
    };

    const result = builder.buildContext(
      'actor-1',
      moodData,
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 5 },
      null
    );

    expect(result).toEqual(
      expect.objectContaining({
        actor: expect.any(Object),
        emotions: expect.any(Object),
        sexualStates: expect.any(Object),
        moodAxes: expect.any(Object),
        sexualArousal: 0.4,
        previousEmotions: null,
        previousSexualStates: null,
        previousMoodAxes: null,
      })
    );
  });

  it('should calculate emotions using EmotionCalculatorService', () => {
    const moodData = { valence: 15, arousal: 25 };
    const sexualStateData = {
      sex_excitation: 5,
      sex_inhibition: 1,
      baseline_libido: 0,
    };
    builder.buildContext(
      'actor-1',
      moodData,
      sexualStateData
    );

    expect(emotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
      moodData,
      0.4,
      sexualStateData
    );
  });

  it('should calculate sexual states using EmotionCalculatorService', () => {
    const moodData = { valence: -5, arousal: 10 };
    const sexualStateData = {
      sex_excitation: 5,
      sex_inhibition: 1,
      baseline_libido: 0,
    };
    builder.buildContext(
      'actor-1',
      moodData,
      sexualStateData
    );

    expect(emotionCalculatorService.calculateSexualStates).toHaveBeenCalledWith(
      moodData,
      0.4,
      sexualStateData
    );
  });

  it('should extract mood axes from mood data', () => {
    const moodData = {
      valence: 70,
      arousal: 40,
      agency_control: 55,
      threat: -30,
      engagement: 80,
      future_expectancy: 45,
      self_evaluation: 60,
    };

    const result = builder.buildContext(
      'actor-1',
      moodData,
      { sex_excitation: 10, sex_inhibition: 2, baseline_libido: 0 }
    );

    expect(result.moodAxes).toEqual(moodData);
  });

  it('should calculate sexual arousal correctly', () => {
    emotionCalculatorService.calculateSexualArousal.mockReturnValue(0.75);

    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 90, sex_inhibition: 10, baseline_libido: 0 }
    );

    expect(result.sexualArousal).toBe(0.75);
  });

  it('should include actor context with component accessor', () => {
    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
    );

    expect(createEntityContext).toHaveBeenCalledWith(
      'actor-1',
      entityManager,
      logger
    );
    expect(result.actor).toEqual({
      id: 'actor-1',
      components: { accessor: true },
    });
  });

  it('should handle null previous state gracefully', () => {
    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
      null
    );

    expect(result.previousEmotions).toBeNull();
    expect(result.previousSexualStates).toBeNull();
    expect(result.previousMoodAxes).toBeNull();
  });

  it('should include previous state when provided', () => {
    const previousState = {
      emotions: { joy: 0.1 },
      sexualStates: { sexual_lust: 0.2 },
      moodAxes: { valence: 5 },
    };

    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
      previousState
    );

    expect(result.previousEmotions).toEqual(previousState.emotions);
    expect(result.previousSexualStates).toEqual(previousState.sexualStates);
    expect(result.previousMoodAxes).toEqual(previousState.moodAxes);
  });

  it('should convert emotion Map to plain object', () => {
    emotionCalculatorService.calculateEmotions.mockReturnValue(
      new Map([
        ['joy', 0.6],
        ['sadness', 0.2],
      ])
    );

    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
    );

    expect(result.emotions).toEqual({ joy: 0.6, sadness: 0.2 });
  });

  it('should validate dependencies in constructor', () => {
    expect(
      () =>
        new ExpressionContextBuilder({
          emotionCalculatorService: null,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency: IEmotionCalculatorService.');

    expect(
      () =>
        new ExpressionContextBuilder({
          emotionCalculatorService,
          entityManager: null,
          logger,
        })
    ).toThrow('Missing required dependency: IEntityManager.');

    expect(
      () =>
        new ExpressionContextBuilder({
          emotionCalculatorService,
          entityManager,
          logger: null,
        })
    ).toThrow('Missing required dependency: logger.');
  });

  it('should handle missing mood axes with defaults', () => {
    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
    );

    expect(result.moodAxes).toEqual({
      valence: 10,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 0,
      future_expectancy: 0,
      self_evaluation: 0,
    });
  });

  it('should allow null sexual arousal when sexual state is missing', () => {
    emotionCalculatorService.calculateSexualArousal.mockReturnValue(null);

    const result = builder.buildContext('actor-1', { valence: 10 }, null);

    expect(result.sexualArousal).toBeNull();
    expect(emotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
      { valence: 10 },
      null,
      null
    );
    expect(emotionCalculatorService.calculateSexualStates).toHaveBeenCalledWith(
      { valence: 10 },
      null,
      null
    );
  });

  it('should return empty emotion/state objects when calculator returns non-iterable', () => {
    emotionCalculatorService.calculateEmotions.mockReturnValue(null);
    emotionCalculatorService.calculateSexualStates.mockReturnValue(undefined);

    const result = builder.buildContext(
      'actor-1',
      { valence: 10 },
      { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
    );

    expect(result.emotions).toEqual({});
    expect(result.sexualStates).toEqual({});
  });
});
