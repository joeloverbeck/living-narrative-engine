import {
  afterEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { ITurnStateFactory } from '../../../../src/turns/interfaces/ITurnStateFactory.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { UNKNOWN_ACTOR_ID } from '../../../../src/constants/unknownIds.js';
import * as contextUtils from '../../../../src/turns/states/helpers/contextUtils.js';

defineTestHelpers();

function defineTestHelpers() {
  const createLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  class IdleTestState extends AbstractTurnState {
    isIdle() {
      return true;
    }
  }

  class TestTurnState extends AbstractTurnState {}

  class TestTurnStateFactory extends ITurnStateFactory {
    createInitialState(handler) {
      return new IdleTestState(handler);
    }

    createIdleState(handler) {
      return new IdleTestState(handler);
    }

    createEndingState(handler, actorId, error) {
      const state = new TestTurnState(handler);
      state._endingInfo = { actorId, error };
      return state;
    }

    createAwaitingInputState(handler) {
      return new TestTurnState(handler);
    }

    createProcessingCommandState(
      handler,
      commandString,
      turnAction,
      directiveResolver,
    ) {
      const state = new TestTurnState(handler);
      state._processingInfo = {
        commandString,
        turnAction,
        directiveResolver,
      };
      return state;
    }

    createAwaitingExternalTurnEndState(handler) {
      return new TestTurnState(handler);
    }
  }

  class IntegrationTestHandler extends BaseTurnHandler {
    constructor({ logger, turnStateFactory = new TestTurnStateFactory() }) {
      super({ logger, turnStateFactory });
      this.turnEndPort = { notifyTurnEnded: jest.fn() };
      this._setInitialState(turnStateFactory.createIdleState(this));
    }

    getTurnEndPort() {
      return this.turnEndPort;
    }
  }

  const createHandler = () => {
    const logger = createLogger();
    const stateFactory = new TestTurnStateFactory();
    const handler = new IntegrationTestHandler({
      logger,
      turnStateFactory: stateFactory,
    });
    return { handler, logger, stateFactory };
  };

  const createTurnServices = (handler, overrides = {}) => ({
    promptCoordinator: { prompt: jest.fn() },
    safeEventDispatcher: {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
      unsubscribe: jest.fn(),
    },
    turnEndPort: handler.getTurnEndPort(),
    ...overrides,
  });

  const attachContext = ({
    handler,
    actorId = 'actor-1',
    logger = createLogger(),
    services,
  }) => {
    const actor = { id: actorId };
    const context = new TurnContext({
      actor,
      logger,
      services: createTurnServices(handler, services),
      strategy: { decideAction: jest.fn() },
      onEndTurnCallback: jest.fn(),
      handlerInstance: handler,
    });
    handler._setCurrentTurnContextInternal(context);
    return { context, actor, contextLogger: logger };
  };

  const setupStateWithContext = () => {
    const { handler, logger } = createHandler();
    const state = new TestTurnState(handler);
    handler._currentState = state;
    const { context, actor, contextLogger } = attachContext({ handler });
    return { handler, logger, state, context, actor, contextLogger };
  };

  describe('AbstractTurnState integration', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('constructor requires a handler and logs an error when missing', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => new AbstractTurnState()).toThrow(
        'AbstractTurnState Constructor: BaseTurnHandler (handler) must be provided.',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('AbstractTurnState Constructor'),
      );
    });

    test('_getTurnContext throws when handler lacks getTurnContext', () => {
      const logger = createLogger();
      const handler = {
        getLogger: jest.fn(() => logger),
        resetStateAndResources: jest.fn(),
        requestIdleStateTransition: jest.fn(() => Promise.resolve()),
      };
      const state = new AbstractTurnState(handler);

      expect(() => state._getTurnContext()).toThrow(
        `${state.getStateName()}: _handler is invalid or missing getTurnContext method.`,
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('_handler is invalid'),
      );
    });

    test('_getTurnContext returns null and logs when no context is present', () => {
      const { handler, logger } = createHandler();
      const state = new TestTurnState(handler);
      handler._currentState = state;
      handler._setCurrentTurnContextInternal(null);

      const result = state._getTurnContext();

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to access ITurnContext via _getTurnContext()'),
      );
    });

    test('_resetToIdle triggers handler resource reset and idle transition', async () => {
      const { handler } = createHandler();
      const state = new TestTurnState(handler);
      handler._currentState = state;

      const resetSpy = jest.spyOn(handler, 'resetStateAndResources');
      const transitionSpy = jest.spyOn(handler, 'requestIdleStateTransition');

      await state._resetToIdle('integration-reset');

      expect(resetSpy).toHaveBeenCalledWith('integration-reset');
      expect(transitionSpy).toHaveBeenCalledTimes(1);
    });

    test('_ensureContext recovers by resetting to idle when turn context resolution fails', async () => {
      const logger = createLogger();
      const handler = {
        getLogger: jest.fn(() => logger),
        resetStateAndResources: jest.fn(),
        requestIdleStateTransition: jest.fn(() => Promise.resolve()),
      };
      const state = new AbstractTurnState(handler);

      const ctx = await state._ensureContext('ensure-failure');

      expect(ctx).toBeNull();
      expect(handler.resetStateAndResources).toHaveBeenCalledWith(
        'ensure-failure',
      );
      expect(handler.requestIdleStateTransition).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('_handler is invalid'),
      );
    });

    test('_ensureContext logs and resets when handler has no active context', async () => {
      const { handler, logger } = createHandler();
      const state = new TestTurnState(handler);
      handler._currentState = state;
      handler._setCurrentTurnContextInternal(null);

      const resetSpy = jest.spyOn(handler, 'resetStateAndResources');

      const ctx = await state._ensureContext('missing-context');

      expect(ctx).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('No ITurnContext available'),
      );
      expect(resetSpy).toHaveBeenCalledWith('missing-context');
    });

    test('_ensureContext returns the active context when available', async () => {
      const { handler, state, context } = setupStateWithContext();

      const result = await state._ensureContext('available');

      expect(result).toBe(context);
    });

    test('_ensureContextWithMethods validates presence of required methods', async () => {
      const { state } = setupStateWithContext();

      const ctx = await state._ensureContextWithMethods('require', [
        'getActor',
      ]);

      expect(ctx).not.toBeNull();
      expect(typeof ctx.getActor).toBe('function');
    });

    test('_ensureContextWithMethods resets to idle when methods are missing', async () => {
      const { handler, state } = setupStateWithContext();
      const ctx = handler.getTurnContext();
      ctx.requestProcessingCommandStateTransition = undefined;

      const resetSpy = jest.spyOn(handler, 'resetStateAndResources');

      const result = await state._ensureContextWithMethods('missing-methods', [
        'requestProcessingCommandStateTransition',
      ]);

      expect(result).toBeNull();
      expect(resetSpy).toHaveBeenCalledWith(
        `missing-methods-${state.getStateName()}`,
      );
    });

    test('_ensureContextWithMethods ends the turn when configured to do so', async () => {
      const { state } = setupStateWithContext();
      const ctx = state._getTurnContext();
      ctx.requestAwaitingInputStateTransition = undefined;
      const endTurnSpy = jest
        .spyOn(ctx, 'endTurn')
        .mockResolvedValue(undefined);

      const result = await state._ensureContextWithMethods(
        'end-turn-missing-method',
        ['requestAwaitingInputStateTransition'],
        { endTurnOnFail: true },
      );

      expect(result).toBeNull();
      expect(endTurnSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    test('_logStateTransition records transitions with an active logger', () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.debug.mockClear();

      state._logStateTransition('enter', 'actor-1', 'IdleState');

      expect(logger.debug).toHaveBeenCalledWith(
        `${state.getStateName()}: Entered. Actor: actor-1. Previous state: IdleState.`,
      );
    });

    test('_logStateTransition falls back to console logging when logger unavailable', () => {
      const handler = {
        getLogger: jest.fn(() => null),
        getTurnContext: jest.fn(() => ({
          getActor: () => ({ id: 'fallback-actor' }),
          getLogger: () => null,
        })),
      };
      const state = new AbstractTurnState(handler);
      const loggerSpy = jest
        .spyOn(contextUtils, 'getLogger')
        .mockReturnValue(null);
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      state._logStateTransition('exit', 'fallback-actor', 'NextState');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(Fallback log)'),
      );
      loggerSpy.mockRestore();
    });

    test('enterState logs transition details using the context actor', async () => {
      const { state, handler } = setupStateWithContext();
      const logSpy = jest.spyOn(state, '_logStateTransition');

      await state.enterState(handler, { getStateName: () => 'Previous' });

      expect(logSpy).toHaveBeenCalledWith('enter', 'actor-1', 'Previous');
    });

    test('exitState logs transition details even when actor lacks identifier', async () => {
      const { handler } = createHandler();
      const state = new TestTurnState(handler);
      handler._currentState = state;
      handler._setCurrentTurnContextInternal({
        getActor: () => ({}),
        getLogger: () => createLogger(),
      });
      const logSpy = jest.spyOn(state, '_logStateTransition');

      await state.exitState(handler, { getStateName: () => 'Next' });

      expect(logSpy).toHaveBeenCalledWith('exit', 'N/A', 'Next');
    });

    test("startTurn warns and rejects because it isn't implemented on the abstract state", async () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();

      await expect(state.startTurn(handler, { id: 'hero' })).rejects.toThrow(
        `Method 'startTurn()' is not applicable for state ${state.getStateName()}.`,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Method 'startTurn(actorId: hero)'")
      );
    });

    test('startTurn reports UNKNOWN_ACTOR_ID when actor entity missing', async () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();

      await expect(state.startTurn(handler, null)).rejects.toThrow(
        `Method 'startTurn()' is not applicable for state ${state.getStateName()}.`,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`actorId: ${UNKNOWN_ACTOR_ID}`),
      );
    });

    test('handleSubmittedCommand logs error and throws for abstract state', async () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.error.mockClear();

      await expect(
        state.handleSubmittedCommand(handler, 'look around', { id: 'hero' }),
      ).rejects.toThrow(
        `Method 'handleSubmittedCommand(command: "look around", entity: hero, contextActor: actor-1)' must be implemented by concrete state ${state.getStateName()}.`,
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("handleSubmittedCommand"),
      );
    });

    test('handleTurnEndedEvent warns by default', async () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();

      await state.handleTurnEndedEvent(handler, { entityId: 'hero' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('handleTurnEndedEvent(payloadActorId: hero)'),
      );
    });

    test('processCommandResult throws and warns when actor mismatches context', async () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();
      logger.error.mockClear();

      await expect(
        state.processCommandResult(
          handler,
          { id: 'stranger' },
          { outcome: 'fail' },
          'look',
        ),
      ).rejects.toThrow(
        `Method 'processCommandResult(actorId: actor-1, command: "look")' must be implemented by concrete state ${state.getStateName()}.`,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('does not match context actor'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('processCommandResult'),
      );
    });

    test('processCommandResult still throws without issuing mismatch warning when actors align', async () => {
      const { state, handler } = setupStateWithContext();
      const contextActor = state._getTurnContext().getActor();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();

      await expect(
        state.processCommandResult(
          handler,
          { id: contextActor.id },
          { outcome: 'success' },
          'look',
        ),
      ).rejects.toThrow();
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('does not match context actor'),
      );
    });

    test('handleDirective warns about mismatched actors before throwing', async () => {
      const { state, handler } = setupStateWithContext();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();
      logger.error.mockClear();

      await expect(
        state.handleDirective(handler, { id: 'outsider' }, 'END_TURN', null),
      ).rejects.toThrow(
        `Method 'handleDirective(actorId: actor-1, directive: END_TURN)' must be implemented by concrete state ${state.getStateName()}.`,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('handleDirective called with actor outsider'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('handleDirective(actorId: actor-1'),
      );
    });

    test('handleDirective throws without mismatch warning when actor matches context', async () => {
      const { state, handler } = setupStateWithContext();
      const contextActor = state._getTurnContext().getActor();
      const logger = state._getTurnContext().getLogger();
      logger.warn.mockClear();

      await expect(
        state.handleDirective(
          handler,
          { id: contextActor.id },
          'CONTINUE',
          null,
        ),
      ).rejects.toThrow();
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('does not match context actor'),
      );
    });

    test('destroy logs a debug message using the handler logger', async () => {
      const { state, handler } = setupStateWithContext();
      const contextLogger = state._getTurnContext().getLogger();
      contextLogger.debug.mockClear();

      await state.destroy(handler);

      expect(contextLogger.debug).toHaveBeenCalledWith(
        `${state.getStateName()}: Received destroy call. No state-specific cleanup by default in AbstractTurnState.`,
      );
    });

    test('getStateName defaults to the constructor name', () => {
      const { state } = setupStateWithContext();

      expect(state.getStateName()).toBe('TestTurnState');
    });

    test('isIdle and isEnding both default to false', () => {
      const { state } = setupStateWithContext();

      expect(state.isIdle()).toBe(false);
      expect(state.isEnding()).toBe(false);
    });
  });
}
