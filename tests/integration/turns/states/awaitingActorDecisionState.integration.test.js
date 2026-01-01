import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

/**
 * Lightweight test handler that simulates BaseTurnHandler behavior.
 */
class TestHandler {
  constructor(logger) {
    this._logger = logger;
    this._turnContext = null;
    this._isDestroying = false;
    this._isDestroyed = false;
  }

  setTurnContext(ctx) {
    this._turnContext = ctx;
  }

  getTurnContext() {
    return this._turnContext;
  }

  getLogger() {
    return this._logger;
  }

  resetStateAndResources() {
    // No-op for integration scenario
  }

  async requestIdleStateTransition() {
    // No-op for integration scenario
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMinimalServices = () => ({
  entityManager: {
    getComponentData: jest.fn().mockReturnValue(null),
    getEntityInstance: jest.fn().mockReturnValue(null),
  },
});

const createMockStrategy = (action = null) => ({
  decideAction: jest.fn().mockResolvedValue(action),
});

const createTurnEnvironment = (options = {}) => {
  const logger = createLogger();
  const handler = new TestHandler(logger);
  const actor = options.actor ?? { id: 'actor-integration' };
  const services = options.services ?? createMinimalServices();
  const strategy = options.strategy ?? createMockStrategy();
  const onEndTurn = jest.fn();

  const turnContext = new TurnContext({
    actor,
    logger,
    services,
    strategy,
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
  });

  handler.setTurnContext(turnContext);

  const workflowFactory =
    options.workflowFactory ??
    jest.fn().mockReturnValue({ run: jest.fn().mockResolvedValue(undefined) });
  const knowledgeUpdateWorkflowFactory =
    options.knowledgeUpdateWorkflowFactory ?? null;

  const state = new AwaitingActorDecisionState(
    handler,
    workflowFactory,
    knowledgeUpdateWorkflowFactory
  );

  return {
    handler,
    state,
    turnContext,
    logger,
    onEndTurn,
    actor,
    workflowFactory,
  };
};

describe('AwaitingActorDecisionState integration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('validation error handling (lines 98-99)', () => {
    it('ends turn when validateActor throws during enterState', async () => {
      const { state, turnContext, onEndTurn } = createTurnEnvironment();

      // Make getActor return null to trigger validation error
      jest.spyOn(turnContext, 'getActor').mockReturnValue(null);
      const endTurnSpy = jest.spyOn(turnContext, 'endTurn');

      await state.enterState(state._handler, null);

      expect(endTurnSpy).toHaveBeenCalledTimes(1);
      const [errorArg] = endTurnSpy.mock.calls[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toContain(
        'No actor in context during AwaitingActorDecisionState'
      );
      expect(onEndTurn).toHaveBeenCalled();
    });

    it('ends turn when strategy retrieval fails during enterState', async () => {
      const { state, turnContext, onEndTurn } = createTurnEnvironment();

      // Make getStrategy return null to trigger strategy validation error
      jest.spyOn(turnContext, 'getStrategy').mockReturnValue(null);
      const endTurnSpy = jest.spyOn(turnContext, 'endTurn');

      await state.enterState(state._handler, null);

      expect(endTurnSpy).toHaveBeenCalledTimes(1);
      const [errorArg] = endTurnSpy.mock.calls[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect(onEndTurn).toHaveBeenCalled();
    });
  });

  describe('knowledge update workflow (lines 134-139)', () => {
    it('executes knowledge update workflow when factory is provided', async () => {
      const knowledgeWorkflowRun = jest.fn().mockResolvedValue(undefined);
      const knowledgeUpdateWorkflowFactory = jest.fn().mockReturnValue({
        run: knowledgeWorkflowRun,
      });

      const mockAction = {
        actionDefinitionId: 'test:action',
        actorId: 'actor-integration',
      };
      const actionWorkflowRun = jest.fn().mockResolvedValue(undefined);
      const workflowFactory = jest.fn().mockReturnValue({
        run: actionWorkflowRun,
      });

      const { state, turnContext, actor } = createTurnEnvironment({
        workflowFactory,
        knowledgeUpdateWorkflowFactory,
        strategy: createMockStrategy({ action: mockAction }),
      });

      await state.enterState(state._handler, null);

      // Verify knowledge workflow factory was called with correct args
      expect(knowledgeUpdateWorkflowFactory).toHaveBeenCalledWith(
        state,
        turnContext,
        actor
      );
      expect(knowledgeWorkflowRun).toHaveBeenCalled();

      // Verify action workflow ran after knowledge workflow
      expect(workflowFactory).toHaveBeenCalled();
      expect(actionWorkflowRun).toHaveBeenCalled();

      // Verify order: knowledge first, then action
      const knowledgeOrder = knowledgeWorkflowRun.mock.invocationCallOrder[0];
      const actionOrder = actionWorkflowRun.mock.invocationCallOrder[0];
      expect(knowledgeOrder).toBeLessThan(actionOrder);
    });
  });

  describe('actor validation error logging (lines 165-170)', () => {
    it('logs error message when actor validation fails', async () => {
      const { state, turnContext, logger } = createTurnEnvironment();

      // Make getActor return null to trigger validation error
      jest.spyOn(turnContext, 'getActor').mockReturnValue(null);

      await state.enterState(state._handler, null);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('No actor found in TurnContext')
      );
    });
  });

  describe('missing setChosenAction warning (line 242)', () => {
    it('logs warning when setChosenAction is missing but continues execution', async () => {
      const { state, turnContext } = createTurnEnvironment();

      // Override setChosenAction to be not a function
      Object.defineProperty(turnContext, 'setChosenAction', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const mockAction = {
        actionDefinitionId: 'test:action',
        actorId: 'actor-integration',
      };

      // Spy on the logger that turnContext uses internally
      const contextLogger = turnContext.getLogger();
      const warnSpy = jest.spyOn(contextLogger, 'warn');

      // Call _recordDecision directly to test this branch
      state._recordDecision(turnContext, mockAction, null);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'ITurnContext.setChosenAction() not found. Cannot store action in context'
        )
      );
    });
  });

  describe('exitState cleanup logging (lines 277-282)', () => {
    it('logs debug message on exitState', async () => {
      const { state, handler, logger } = createTurnEnvironment();

      await state.exitState(handler, null);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ExitState cleanup')
      );
    });
  });

  describe('handleSubmittedCommand warning (lines 285-304)', () => {
    it('logs warning and ends turn when handleSubmittedCommand is called directly', async () => {
      const { state, handler, turnContext, logger, onEndTurn } =
        createTurnEnvironment();
      const endTurnSpy = jest.spyOn(turnContext, 'endTurn');

      await state.handleSubmittedCommand(handler, 'test command', {
        id: 'test-actor',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'handleSubmittedCommand was called directly for actor'
        )
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unexpected in the new strategy-driven workflow')
      );

      expect(endTurnSpy).toHaveBeenCalledTimes(1);
      const [errorArg] = endTurnSpy.mock.calls[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toContain('Unexpected direct command submission');
      expect(onEndTurn).toHaveBeenCalled();
    });
  });

  describe('handleTurnEndedEvent branches (lines 307-337)', () => {
    it('logs warning and defers to superclass when no turnContext', async () => {
      const { state, handler, logger } = createTurnEnvironment();

      // Remove turnContext
      handler.setTurnContext(null);

      await state.handleTurnEndedEvent(handler, { entityId: 'some-actor' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'handleTurnEndedEvent received but no turn context'
        )
      );
    });

    it('ends turn when event is for current actor', async () => {
      const { state, handler, turnContext, actor, onEndTurn } =
        createTurnEnvironment();
      const endTurnSpy = jest.spyOn(turnContext, 'endTurn');

      const testError = new Error('Test turn ended error');
      await state.handleTurnEndedEvent(handler, {
        entityId: actor.id,
        error: testError,
      });

      expect(endTurnSpy).toHaveBeenCalledWith(testError);
      expect(onEndTurn).toHaveBeenCalled();
    });

    it('defers to superclass when event is for different actor', async () => {
      const { state, handler, logger } = createTurnEnvironment();

      await state.handleTurnEndedEvent(handler, {
        entityId: 'different-actor-id',
      });

      // The superclass implementation should log a warning
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('is not for current context actor')
      );
    });
  });

  describe('destroy without context (line 380)', () => {
    it('logs warning with N/A_no_context when destroy is called without turnContext', async () => {
      const { state, handler, logger } = createTurnEnvironment();

      // Remove turnContext
      handler.setTurnContext(null);

      await state.destroy(handler);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('N/A_no_context')
      );
    });
  });

  describe('_decideAction method (lines 212-213)', () => {
    it('returns action and extractedData from strategy decision', async () => {
      const mockAction = {
        actionDefinitionId: 'test:action',
        actorId: 'actor-integration',
      };
      const mockExtractedData = { thoughts: 'test thoughts', notes: ['note1'] };
      const mockAvailableActions = [{ index: 1, actionId: 'action1' }];

      const strategy = {
        decideAction: jest.fn().mockResolvedValue({
          action: mockAction,
          extractedData: mockExtractedData,
          availableActions: mockAvailableActions,
          suggestedIndex: 1,
        }),
      };

      const { state, turnContext, actor } = createTurnEnvironment({ strategy });

      const result = await state._decideAction(strategy, turnContext, actor);

      expect(result.action).toEqual(mockAction);
      expect(result.extractedData).toEqual(mockExtractedData);
      expect(result.availableActions).toEqual(mockAvailableActions);
      expect(result.suggestedIndex).toBe(1);
    });

    it('handles legacy decision format (returns action directly)', async () => {
      const mockAction = {
        actionDefinitionId: 'test:action',
        actorId: 'actor-integration',
      };

      const strategy = {
        decideAction: jest.fn().mockResolvedValue(mockAction),
      };

      const { state, turnContext, actor } = createTurnEnvironment({ strategy });

      const result = await state._decideAction(strategy, turnContext, actor);

      expect(result.action).toEqual(mockAction);
      expect(result.extractedData).toBeNull();
      expect(result.availableActions).toBeNull();
      expect(result.suggestedIndex).toBeNull();
    });
  });

  describe('_recordDecision with setChosenAction (line 240)', () => {
    it('calls setChosenAction when method exists on turnContext', () => {
      const { state, turnContext, logger } = createTurnEnvironment();

      const mockAction = {
        actionDefinitionId: 'test:action',
        actorId: 'actor-integration',
      };

      const setChosenActionSpy = jest.spyOn(turnContext, 'setChosenAction');

      state._recordDecision(turnContext, mockAction, null);

      expect(setChosenActionSpy).toHaveBeenCalledWith(mockAction);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('decided action: test:action')
      );
    });

    it('calls setDecisionMeta with frozen extractedData when provided', () => {
      const { state, turnContext } = createTurnEnvironment();

      const mockAction = {
        actionDefinitionId: 'test:action',
        actorId: 'actor-integration',
      };
      const extractedData = { thoughts: 'thinking', notes: ['note1'] };

      const setDecisionMetaSpy = jest.spyOn(turnContext, 'setDecisionMeta');

      state._recordDecision(turnContext, mockAction, extractedData);

      expect(setDecisionMetaSpy).toHaveBeenCalled();
      const [metaArg] = setDecisionMetaSpy.mock.calls[0];
      expect(metaArg).toEqual(extractedData);
      expect(Object.isFrozen(metaArg)).toBe(true);
    });
  });

  describe('_emitActionDecided method (lines 258-272)', () => {
    it('dispatches ACTION_DECIDED_ID event with correct payload', async () => {
      const { state, turnContext, actor } = createTurnEnvironment();

      const dispatchSpy = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(turnContext, 'getSafeEventDispatcher').mockReturnValue({
        dispatch: dispatchSpy,
      });

      const extractedData = {
        thoughts: 'actor thoughts',
        notes: ['note1', 'note2'],
      };

      await state._emitActionDecided(turnContext, actor, extractedData);

      expect(dispatchSpy).toHaveBeenCalledWith(
        'core:action_decided',
        expect.objectContaining({
          actorId: actor.id,
          extractedData: expect.objectContaining({
            thoughts: 'actor thoughts',
            notes: ['note1', 'note2'],
          }),
        })
      );
    });

    it('includes default empty values for missing extractedData fields', async () => {
      const { state, turnContext, actor } = createTurnEnvironment();

      const dispatchSpy = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(turnContext, 'getSafeEventDispatcher').mockReturnValue({
        dispatch: dispatchSpy,
      });

      // extractedData with missing fields
      const extractedData = {};

      await state._emitActionDecided(turnContext, actor, extractedData);

      expect(dispatchSpy).toHaveBeenCalledWith(
        'core:action_decided',
        expect.objectContaining({
          actorId: actor.id,
          extractedData: expect.objectContaining({
            thoughts: '',
            notes: [],
          }),
        })
      );
    });

    it('emits event without extractedData when null', async () => {
      const { state, turnContext, actor } = createTurnEnvironment();

      const dispatchSpy = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(turnContext, 'getSafeEventDispatcher').mockReturnValue({
        dispatch: dispatchSpy,
      });

      await state._emitActionDecided(turnContext, actor, null);

      expect(dispatchSpy).toHaveBeenCalledWith(
        'core:action_decided',
        expect.objectContaining({
          actorId: actor.id,
        })
      );
      // Should not include extractedData key when null
      const [, payload] = dispatchSpy.mock.calls[0];
      expect(payload.extractedData).toBeUndefined();
    });
  });
});
