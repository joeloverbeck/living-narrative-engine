import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionPersistenceListener from '../../../src/expressions/expressionPersistenceListener.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createExpressionContextBuilder = () => ({
  buildContext: jest.fn(),
});

const createExpressionEvaluatorService = () => ({
  evaluate: jest.fn(),
});

const createExpressionDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
});

const createEntityManager = () => ({
  getComponentData: jest.fn(),
});

const createEvent = ({ actorId = 'actor-1', moodUpdate, sexualUpdate } = {}) => {
  const extractedData = {};
  if (moodUpdate !== undefined) {
    extractedData.moodUpdate = moodUpdate;
  }
  if (sexualUpdate !== undefined) {
    extractedData.sexualUpdate = sexualUpdate;
  }

  return {
    type: 'core:action_decided',
    payload: {
      actorId,
      extractedData,
    },
  };
};

describe('ExpressionPersistenceListener', () => {
  let expressionContextBuilder;
  let expressionEvaluatorService;
  let expressionDispatcher;
  let entityManager;
  let logger;
  let listener;

  beforeEach(() => {
    jest.clearAllMocks();

    expressionContextBuilder = createExpressionContextBuilder();
    expressionEvaluatorService = createExpressionEvaluatorService();
    expressionDispatcher = createExpressionDispatcher();
    entityManager = createEntityManager();
    logger = createLogger();

    listener = new ExpressionPersistenceListener({
      expressionContextBuilder,
      expressionEvaluatorService,
      expressionDispatcher,
      entityManager,
      logger,
    });
  });

  it('should skip when event has no actorId', async () => {
    await listener.handleEvent({
      type: 'core:action_decided',
      payload: { extractedData: { moodUpdate: { valence: 1 } } },
    });

    expect(expressionContextBuilder.buildContext).not.toHaveBeenCalled();
    expect(expressionEvaluatorService.evaluate).not.toHaveBeenCalled();
    expect(expressionDispatcher.dispatch).not.toHaveBeenCalled();
    expect(listener.getTurnCounter()).toBe(0);
  });

  it('should skip when event has no mood or sexual updates', async () => {
    await listener.handleEvent({
      type: 'core:action_decided',
      payload: { actorId: 'actor-1', extractedData: {} },
    });

    expect(expressionContextBuilder.buildContext).not.toHaveBeenCalled();
    expect(expressionEvaluatorService.evaluate).not.toHaveBeenCalled();
    expect(expressionDispatcher.dispatch).not.toHaveBeenCalled();
    expect(listener.getTurnCounter()).toBe(0);
  });

  it('should process events regardless of type when updates are present', async () => {
    const moodUpdate = { valence: 5 };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });

    await listener.handleEvent({
      type: 'core:other_event',
      payload: {
        actorId: 'actor-1',
        extractedData: { moodUpdate },
      },
    });

    expect(expressionContextBuilder.buildContext).toHaveBeenCalledWith(
      'actor-1',
      moodUpdate,
      null,
      null
    );
    expect(listener.getTurnCounter()).toBe(1);
  });

  it('should build context from mood and sexual state data', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    const sexualUpdate = { sex_excitation: 30, sex_inhibition: 20 };

    entityManager.getComponentData.mockImplementation((actorId, componentId) => {
      if (componentId === MOOD_COMPONENT_ID) {
        return { valence: 0, extra: 'keep' };
      }
      if (componentId === SEXUAL_STATE_COMPONENT_ID) {
        return { sex_excitation: 10, sex_inhibition: 5, baseline_libido: 7 };
      }
      return null;
    });

    const context = {
      emotions: { joy: 0.5 },
      sexualStates: { sexual_lust: 0.2 },
      moodAxes: { valence: 10 },
    };
    expressionContextBuilder.buildContext.mockReturnValue(context);

    await listener.handleEvent(createEvent({ moodUpdate, sexualUpdate }));

    expect(expressionContextBuilder.buildContext).toHaveBeenCalledWith(
      'actor-1',
      { ...moodUpdate, extra: 'keep' },
      { ...sexualUpdate, baseline_libido: 7 },
      null
    );
  });

  it('should pass null previous state on first evaluation', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };

    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });

    await listener.handleEvent(createEvent({ moodUpdate }));

    const [, , , previousState] =
      expressionContextBuilder.buildContext.mock.calls[0];
    expect(previousState).toBeNull();
  });

  it('should include previous state in context when available', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };

    const firstContext = {
      emotions: { joy: 0.5 },
      sexualStates: { sexual_lust: 0.2 },
      moodAxes: { valence: 10 },
    };
    const secondContext = {
      emotions: { joy: 0.6 },
      sexualStates: { sexual_lust: 0.3 },
      moodAxes: { valence: 12 },
    };

    expressionContextBuilder.buildContext
      .mockReturnValueOnce(firstContext)
      .mockReturnValueOnce(secondContext);

    await listener.handleEvent(createEvent({ moodUpdate }));
    await listener.handleEvent(createEvent({ moodUpdate }));

    const [, , , previousState] =
      expressionContextBuilder.buildContext.mock.calls[1];
    expect(previousState).toEqual({
      emotions: firstContext.emotions,
      sexualStates: firstContext.sexualStates,
      moodAxes: firstContext.moodAxes,
    });
  });

  it('should cache current state after evaluation', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };

    const context = {
      emotions: { joy: 0.5 },
      sexualStates: { sexual_lust: 0.2 },
      moodAxes: { valence: 10 },
    };

    expressionContextBuilder.buildContext.mockReturnValue(context);

    await listener.handleEvent(createEvent({ moodUpdate }));
    await listener.handleEvent(createEvent({ moodUpdate }));

    const [, , , previousState] =
      expressionContextBuilder.buildContext.mock.calls[1];
    expect(previousState).toEqual({
      emotions: context.emotions,
      sexualStates: context.sexualStates,
      moodAxes: context.moodAxes,
    });
  });

  it('should call evaluator with built context', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    const context = { emotions: {}, sexualStates: {}, moodAxes: {} };
    expressionContextBuilder.buildContext.mockReturnValue(context);

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionEvaluatorService.evaluate).toHaveBeenCalledWith(context);
  });

  it('should dispatch matched expression', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    const expression = { id: 'expr:one' };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });
    expressionEvaluatorService.evaluate.mockReturnValue(expression);

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionDispatcher.dispatch).toHaveBeenCalledWith(
      'actor-1',
      expression,
      1
    );
    expect(logger.info).toHaveBeenCalledWith('Expression matched', {
      actorId: 'actor-1',
      turnNumber: 1,
      expressionId: 'expr:one',
    });
  });

  it('should not dispatch when no expression matches', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });
    expressionEvaluatorService.evaluate.mockReturnValue(null);

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should increment turn counter on each event with mood/sexual updates', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });

    await listener.handleEvent(createEvent({ moodUpdate }));
    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(listener.getTurnCounter()).toBe(2);
  });

  it('should handle errors gracefully without rethrowing', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    expressionContextBuilder.buildContext.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(
      listener.handleEvent(createEvent({ moodUpdate }))
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should merge update with existing component data', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };
    const sexualUpdate = { sex_excitation: 30, sex_inhibition: 20 };

    entityManager.getComponentData.mockImplementation((actorId, componentId) => {
      if (componentId === MOOD_COMPONENT_ID) {
        return { valence: 1, extra: 'persist' };
      }
      if (componentId === SEXUAL_STATE_COMPONENT_ID) {
        return { sex_excitation: 10, sex_inhibition: 5, baseline_libido: 12 };
      }
      return null;
    });

    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });

    await listener.handleEvent(createEvent({ moodUpdate, sexualUpdate }));

    expect(expressionContextBuilder.buildContext).toHaveBeenCalledWith(
      'actor-1',
      { ...moodUpdate, extra: 'persist' },
      { ...sexualUpdate, baseline_libido: 12 },
      null
    );
  });

  it('should handle missing mood component gracefully', async () => {
    entityManager.getComponentData.mockImplementation((actorId, componentId) => {
      if (componentId === MOOD_COMPONENT_ID) {
        return null;
      }
      if (componentId === SEXUAL_STATE_COMPONENT_ID) {
        return { sex_excitation: 10, sex_inhibition: 5, baseline_libido: 7 };
      }
      return null;
    });

    await listener.handleEvent(
      createEvent({ sexualUpdate: { sex_excitation: 30, sex_inhibition: 20 } })
    );

    expect(expressionContextBuilder.buildContext).not.toHaveBeenCalled();
    expect(expressionEvaluatorService.evaluate).not.toHaveBeenCalled();
    expect(expressionDispatcher.dispatch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should validate dependencies in constructor', () => {
    expect(
      () =>
        new ExpressionPersistenceListener({
          expressionContextBuilder: null,
          expressionEvaluatorService,
          expressionDispatcher,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency: IExpressionContextBuilder.');

    expect(
      () =>
        new ExpressionPersistenceListener({
          expressionContextBuilder,
          expressionEvaluatorService: null,
          expressionDispatcher,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency: IExpressionEvaluatorService.');

    expect(
      () =>
        new ExpressionPersistenceListener({
          expressionContextBuilder,
          expressionEvaluatorService,
          expressionDispatcher: null,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency: IExpressionDispatcher.');
  });

  it('should clear cache with clearCache method', async () => {
    const moodUpdate = {
      valence: 10,
      arousal: 5,
      agency_control: 2,
      threat: -1,
      engagement: 3,
      future_expectancy: 4,
      self_evaluation: 6,
    };

    expressionContextBuilder.buildContext
      .mockReturnValueOnce({
        emotions: { joy: 0.1 },
        sexualStates: { sexual_lust: 0.2 },
        moodAxes: { valence: 10 },
      })
      .mockReturnValueOnce({
        emotions: { joy: 0.2 },
        sexualStates: { sexual_lust: 0.3 },
        moodAxes: { valence: 12 },
      });

    await listener.handleEvent(createEvent({ moodUpdate }));
    listener.clearCache();
    await listener.handleEvent(createEvent({ moodUpdate }));

    const [, , , previousState] =
      expressionContextBuilder.buildContext.mock.calls[1];
    expect(previousState).toBeNull();
    expect(listener.getTurnCounter()).toBe(1);
  });
});
