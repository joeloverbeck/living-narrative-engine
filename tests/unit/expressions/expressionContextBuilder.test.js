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
  getEmotionPrototypeKeys: jest.fn(),
  getSexualPrototypeKeys: jest.fn(),
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
      new Map([
        ['sexual_lust', 0.5],
        ['aroused_with_shame', 0.1],
      ])
    );
    emotionCalculatorService.getEmotionPrototypeKeys.mockReturnValue(['joy']);
    emotionCalculatorService.getSexualPrototypeKeys.mockReturnValue([
      'sexual_lust',
      'aroused_with_shame',
    ]);

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
      affiliation: 0,
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
        previousEmotions: { joy: 0.0 },
        previousSexualStates: {
          sexual_lust: 0.0,
          aroused_with_shame: 0.0,
        },
        previousMoodAxes: {
          valence: 0,
          arousal: 0,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 0,
          uncertainty: 0,
        },
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
      affiliation: 35,
      inhibitory_control: 20,
      uncertainty: 15,
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

    expect(result.previousEmotions).toEqual({ joy: 0 });
    expect(result.previousSexualStates).toEqual({
      sexual_lust: 0,
      aroused_with_shame: 0,
    });
    expect(result.previousMoodAxes).toEqual({
      valence: 0,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 0,
      future_expectancy: 0,
      self_evaluation: 0,
      affiliation: 0,
      inhibitory_control: 0,
      uncertainty: 0,
    });
  });

  it('should include previous state when provided', () => {
    const previousState = {
      emotions: { joy: 0.1 },
      sexualStates: {
        sexual_lust: 0.2,
        aroused_with_shame: 0.0,
      },
      moodAxes: {
        valence: 5,
        arousal: 1,
        agency_control: 2,
        threat: 3,
        engagement: 4,
        future_expectancy: 5,
        self_evaluation: 6,
        affiliation: 7,
        inhibitory_control: 8,
        uncertainty: 9,
      },
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
    emotionCalculatorService.getEmotionPrototypeKeys.mockReturnValue([
      'joy',
      'sadness',
    ]);

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
      affiliation: 0,
      inhibitory_control: 0,
      uncertainty: 0,
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

  it('should throw when calculator returns non-iterable results', () => {
    emotionCalculatorService.calculateEmotions.mockReturnValue(null);
    emotionCalculatorService.calculateSexualStates.mockReturnValue(undefined);

    expect(() =>
      builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      )
    ).toThrow(
      '[ExpressionContextBuilder] emotions evaluation returned non-iterable results.'
    );
  });

  it('should throw when emotion results miss prototype keys with root cause hint', () => {
    emotionCalculatorService.calculateEmotions.mockReturnValue(
      new Map([['joy', 0.6]])
    );
    emotionCalculatorService.calculateSexualStates.mockReturnValue(
      new Map([
        ['sexual_lust', 0.5],
        ['aroused_with_shame', 0.1],
      ])
    );
    emotionCalculatorService.getEmotionPrototypeKeys.mockReturnValue([
      'joy',
      'sadness',
    ]);

    expect(() =>
      builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      )
    ).toThrow(
      /\[ExpressionContextBuilder\] emotions evaluation missing prototype keys.*This may indicate a mismatch between prototype lookup and calculator logic\./
    );
  });

  it('should throw when sexual state results miss prototype keys with root cause hint', () => {
    emotionCalculatorService.calculateEmotions.mockReturnValue(
      new Map([['joy', 0.6]])
    );
    emotionCalculatorService.calculateSexualStates.mockReturnValue(
      new Map([['sexual_lust', 0.5]])
    );
    emotionCalculatorService.getEmotionPrototypeKeys.mockReturnValue(['joy']);
    emotionCalculatorService.getSexualPrototypeKeys.mockReturnValue([
      'sexual_lust',
      'aroused_with_shame',
    ]);

    expect(() =>
      builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      )
    ).toThrow(
      /\[ExpressionContextBuilder\] sexualStates evaluation missing prototype keys.*This may indicate a mismatch between prototype lookup and calculator logic\./
    );
  });

  it('should throw with debugging guidance when prototype keys are empty', () => {
    emotionCalculatorService.calculateEmotions.mockReturnValue(new Map());
    emotionCalculatorService.calculateSexualStates.mockReturnValue(new Map());
    emotionCalculatorService.getEmotionPrototypeKeys.mockReturnValue([]);
    emotionCalculatorService.getSexualPrototypeKeys.mockReturnValue([]);

    expect(() =>
      builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      )
    ).toThrow(
      /\[ExpressionContextBuilder\] emotions prototype lookup returned no keys.*This is unexpected - EmotionCalculatorService should have thrown.*Check that mocks provide non-empty prototype key arrays\./
    );
  });

  it('should throw when previous emotions are missing prototype keys', () => {
    const previousState = {
      emotions: {},
      sexualStates: {
        sexual_lust: 0.2,
        aroused_with_shame: 0.1,
      },
      moodAxes: {
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
      },
    };

    expect(() =>
      builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
        previousState
      )
    ).toThrow('[ExpressionContextBuilder] previousEmotions keys do not match');
  });

  it('should throw when previous mood axes include unexpected keys', () => {
    const previousState = {
      emotions: { joy: 0.1 },
      sexualStates: {
        sexual_lust: 0.2,
        aroused_with_shame: 0.1,
      },
      moodAxes: {
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
        extra_axis: 5,
      },
    };

    expect(() =>
      builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
        previousState
      )
    ).toThrow('[ExpressionContextBuilder] previousMoodAxes keys do not match');
  });

  // ============================================
  // Mood Axes Tests (all 10 canonical axes)
  // ============================================

  describe('affiliation axis support', () => {
    it('should include affiliation in moodAxes', () => {
      const moodData = {
        valence: 10,
        arousal: 20,
        agency_control: 30,
        threat: -10,
        engagement: 5,
        future_expectancy: -15,
        self_evaluation: 8,
        affiliation: 25,
      };

      const result = builder.buildContext(
        'actor-1',
        moodData,
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 5 }
      );

      expect(result.moodAxes.affiliation).toBe(25);
    });

    it('should include affiliation in previousMoodAxes when provided', () => {
      const previousState = {
        emotions: { joy: 0.1 },
        sexualStates: { sexual_lust: 0.2, aroused_with_shame: 0.0 },
        moodAxes: {
          valence: 5,
          arousal: 1,
          agency_control: 2,
          threat: 3,
          engagement: 4,
          future_expectancy: 5,
          self_evaluation: 6,
          affiliation: 15,
          inhibitory_control: 9,
          uncertainty: 10,
        },
      };

      const result = builder.buildContext(
        'actor-1',
        { valence: 10, affiliation: 25 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
        previousState
      );

      expect(result.previousMoodAxes.affiliation).toBe(15);
    });

    it('should initialize previousMoodAxes.affiliation to 0 when previous state is null', () => {
      const result = builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
        null
      );

      expect(result.previousMoodAxes.affiliation).toBe(0);
    });

    it('should default affiliation to 0 when not provided in mood data', () => {
      const result = builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      );

      expect(result.moodAxes.affiliation).toBe(0);
    });

    it('should handle negative affiliation values', () => {
      const moodData = {
        valence: 10,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
        affiliation: -50,
      };

      const result = builder.buildContext(
        'actor-1',
        moodData,
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      );

      expect(result.moodAxes.affiliation).toBe(-50);
    });
  });

  describe('inhibitory_control axis support', () => {
    it('should include inhibitory_control in moodAxes', () => {
      const moodData = {
        valence: 10,
        arousal: 20,
        agency_control: 30,
        threat: -10,
        engagement: 5,
        future_expectancy: -15,
        self_evaluation: 8,
        affiliation: 25,
        inhibitory_control: 45,
      };

      const result = builder.buildContext(
        'actor-1',
        moodData,
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 5 }
      );

      expect(result.moodAxes.inhibitory_control).toBe(45);
    });

    it('should default inhibitory_control to 0 when not provided in mood data', () => {
      const result = builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      );

      expect(result.moodAxes.inhibitory_control).toBe(0);
    });

    it('should initialize previousMoodAxes.inhibitory_control to 0 when previous state is null', () => {
      const result = builder.buildContext(
        'actor-1',
        { valence: 10 },
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 },
        null
      );

      expect(result.previousMoodAxes.inhibitory_control).toBe(0);
    });

    it('should handle negative inhibitory_control values', () => {
      const moodData = {
        valence: 10,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: -60,
      };

      const result = builder.buildContext(
        'actor-1',
        moodData,
        { sex_excitation: 20, sex_inhibition: 10, baseline_libido: 0 }
      );

      expect(result.moodAxes.inhibitory_control).toBe(-60);
    });
  });
});
