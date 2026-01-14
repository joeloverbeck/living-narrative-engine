import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionPersistenceListener from '../../../src/expressions/expressionPersistenceListener.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  ACTION_DECIDED_ID,
  MOOD_STATE_UPDATED_ID,
  TURN_STARTED_ID,
} from '../../../src/constants/eventIds.js';

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
  evaluateAll: jest.fn().mockReturnValue([]),
});

const createExpressionDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  dispatchWithResult: jest.fn().mockResolvedValue({
    attempted: true,
    success: true,
    rateLimited: false,
    reason: null,
  }),
});

const createExpressionEvaluationLogger = () => ({
  logEvaluation: jest.fn().mockResolvedValue(true),
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
    type: ACTION_DECIDED_ID,
    payload: {
      actorId,
      extractedData,
    },
  };
};

const createMoodStateUpdatedEvent = ({
  actorId = 'actor-1',
  moodUpdate,
  sexualUpdate,
} = {}) => ({
  type: MOOD_STATE_UPDATED_ID,
  payload: {
    actorId,
    moodUpdate,
    sexualUpdate,
  },
});

describe('ExpressionPersistenceListener', () => {
  let expressionContextBuilder;
  let expressionEvaluatorService;
  let expressionDispatcher;
  let expressionEvaluationLogger;
  let entityManager;
  let logger;
  let listener;

  beforeEach(() => {
    jest.clearAllMocks();

    expressionContextBuilder = createExpressionContextBuilder();
    expressionEvaluatorService = createExpressionEvaluatorService();
    expressionDispatcher = createExpressionDispatcher();
    expressionEvaluationLogger = createExpressionEvaluationLogger();
    entityManager = createEntityManager();
    logger = createLogger();

    listener = new ExpressionPersistenceListener({
      expressionContextBuilder,
      expressionEvaluatorService,
      expressionDispatcher,
      expressionEvaluationLogger,
      entityManager,
      logger,
    });
  });

  it('should skip when event has no actorId', async () => {
    await listener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: { extractedData: { moodUpdate: { valence: 1 } } },
    });

    expect(expressionContextBuilder.buildContext).not.toHaveBeenCalled();
    expect(expressionEvaluatorService.evaluateAll).not.toHaveBeenCalled();
    expect(expressionDispatcher.dispatchWithResult).not.toHaveBeenCalled();
    expect(listener.getTurnCounter()).toBe(0);
  });

  it('should skip when event has no mood or sexual updates', async () => {
    await listener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: { actorId: 'actor-1', extractedData: {} },
    });

    expect(expressionContextBuilder.buildContext).not.toHaveBeenCalled();
    expect(expressionEvaluatorService.evaluateAll).not.toHaveBeenCalled();
    expect(expressionDispatcher.dispatchWithResult).not.toHaveBeenCalled();
    expect(listener.getTurnCounter()).toBe(0);
  });

  it('should evaluate expressions on MOOD_STATE_UPDATED_ID events', async () => {
    const moodUpdate = { valence: 5 };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });

    await listener.handleEvent(createMoodStateUpdatedEvent({ moodUpdate }));

    expect(expressionContextBuilder.buildContext).toHaveBeenCalledWith(
      'actor-1',
      moodUpdate,
      null,
      null
    );
    expect(listener.getTurnCounter()).toBe(1);
  });

  it('should skip ACTION_DECIDED_ID after MOOD_STATE_UPDATED_ID and clear tracking', async () => {
    const moodUpdate = { valence: 5 };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });

    await listener.handleEvent(createMoodStateUpdatedEvent({ moodUpdate }));
    await listener.handleEvent(createEvent({ moodUpdate }));
    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(2);
    expect(listener.getTurnCounter()).toBe(2);
  });

  it('should skip unrelated event types', async () => {
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

    expect(expressionContextBuilder.buildContext).not.toHaveBeenCalled();
    expect(listener.getTurnCounter()).toBe(0);
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

    expect(expressionEvaluatorService.evaluateAll).toHaveBeenCalledWith(context);
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
    expressionEvaluatorService.evaluateAll.mockReturnValue([expression]);

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionDispatcher.dispatchWithResult).toHaveBeenCalledWith(
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

  it('should log evaluation entry with a selected match', async () => {
    const moodUpdate = { valence: 10 };
    const expression = { id: 'expr:one', priority: 91, category: 'mood' };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });
    expressionEvaluatorService.evaluateAll.mockReturnValue([expression]);
    expressionDispatcher.dispatchWithResult.mockResolvedValue({
      attempted: true,
      success: true,
      rateLimited: false,
      reason: null,
    });

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionEvaluationLogger.logEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        eventType: ACTION_DECIDED_ID,
        selected: {
          id: 'expr:one',
          priority: 91,
          category: 'mood',
        },
        matches: [
          {
            id: 'expr:one',
            priority: 91,
            category: 'mood',
          },
        ],
        dispatch: {
          attempted: true,
          success: true,
          rateLimited: false,
          reason: null,
        },
      })
    );
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
    expressionEvaluatorService.evaluateAll.mockReturnValue([]);

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionDispatcher.dispatchWithResult).not.toHaveBeenCalled();
  });

  it('should log evaluation entry when no expressions match', async () => {
    const moodUpdate = { valence: 10 };
    expressionContextBuilder.buildContext.mockReturnValue({
      emotions: {},
      sexualStates: {},
      moodAxes: {},
    });
    expressionEvaluatorService.evaluateAll.mockReturnValue([]);

    await listener.handleEvent(createEvent({ moodUpdate }));

    expect(expressionEvaluationLogger.logEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        eventType: ACTION_DECIDED_ID,
        selected: null,
        matches: [],
        dispatch: {
          attempted: false,
          success: false,
          rateLimited: false,
          reason: 'no_match',
        },
      })
    );
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
    expect(expressionEvaluatorService.evaluateAll).not.toHaveBeenCalled();
    expect(expressionDispatcher.dispatchWithResult).not.toHaveBeenCalled();
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
          expressionEvaluationLogger,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency: IExpressionDispatcher.');

    expect(
      () =>
        new ExpressionPersistenceListener({
          expressionContextBuilder,
          expressionEvaluatorService,
          expressionDispatcher,
          expressionEvaluationLogger: null,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency: IExpressionEvaluationLogger.');
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

  describe('handleEvent - TURN_STARTED_ID reset', () => {
    it('clears expression evaluated tracking set on TURN_STARTED_ID', async () => {
      const moodUpdate = { valence: 5 };
      expressionContextBuilder.buildContext.mockReturnValue({
        emotions: {},
        sexualStates: {},
        moodAxes: {},
      });

      // MOOD_STATE_UPDATED_ID marks actor as evaluated this turn
      await listener.handleEvent(createMoodStateUpdatedEvent({ moodUpdate }));

      // TURN_STARTED_ID resets tracking
      await listener.handleEvent({ type: TURN_STARTED_ID });

      // Now ACTION_DECIDED_ID should process (not skip)
      await listener.handleEvent(createEvent({ moodUpdate }));

      // buildContext called twice: once for MOOD_STATE_UPDATED, once for ACTION_DECIDED
      expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(2);
    });

    it('logs debug message on TURN_STARTED_ID', async () => {
      await listener.handleEvent({ type: TURN_STARTED_ID });

      expect(logger.debug).toHaveBeenCalledWith(
        'ExpressionPersistenceListener: Turn started - cleared tracking set'
      );
    });

    it('multi-turn scenario clears tracking between turns', async () => {
      const moodUpdate = { valence: 5 };
      expressionContextBuilder.buildContext.mockReturnValue({
        emotions: {},
        sexualStates: {},
        moodAxes: {},
      });

      // Turn 1: MOOD_STATE_UPDATED marks actor
      await listener.handleEvent(createMoodStateUpdatedEvent({ moodUpdate }));
      expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(1);

      // Turn 2 starts - clears tracking
      await listener.handleEvent({ type: TURN_STARTED_ID });

      // Turn 2: MOOD_STATE_UPDATED can mark actor again
      await listener.handleEvent(createMoodStateUpdatedEvent({ moodUpdate }));
      expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(2);

      // ACTION_DECIDED should be skipped (already evaluated this turn)
      await listener.handleEvent(createEvent({ moodUpdate }));
      expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(2);

      // Turn 3 starts - clears tracking again
      await listener.handleEvent({ type: TURN_STARTED_ID });

      // Now ACTION_DECIDED should process
      await listener.handleEvent(createEvent({ moodUpdate }));
      expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(3);
    });
  });
});
