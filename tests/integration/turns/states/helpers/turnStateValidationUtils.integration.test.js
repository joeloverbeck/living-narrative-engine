import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TurnContext } from '../../../../../src/turns/context/turnContext.js';
import { AwaitingActorDecisionState } from '../../../../../src/turns/states/awaitingActorDecisionState.js';
import { TurnIdleState } from '../../../../../src/turns/states/turnIdleState.js';
import { ProcessingCommandState } from '../../../../../src/turns/states/processingCommandState.js';
import { AbstractTurnState } from '../../../../../src/turns/states/abstractTurnState.js';
import { SafeEventDispatcher } from '../../../../../src/events/safeEventDispatcher.js';
import { createEventBus } from '../../../../common/mockFactories/eventBus.js';
import {
  AWAITING_DECISION_CONTEXT_METHODS,
  validateContextMethods,
  validateTurnAction,
  retrieveStrategyFromContext,
  validateActorInContext,
} from '../../../../../src/utils/turnStateValidationUtils.js';

class TestTurnHandler {
  constructor(logger) {
    this._logger = logger;
    this._turnContext = null;
    this.resetStateAndResources = jest.fn();
    this.requestIdleStateTransition = jest.fn();
    this.requestAwaitingExternalTurnEndStateTransition = jest.fn();
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

  async requestAwaitingInputStateTransition() {
    return undefined;
  }

  async requestProcessingCommandStateTransition() {
    return undefined;
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createTurnContext = ({
  handler,
  actorId = 'actor-integration',
  strategy = { decideAction: jest.fn().mockResolvedValue(null) },
  services,
  onEndTurnCallback = jest.fn(),
} = {}) => {
  const logger = createLogger();
  const actor = { id: actorId };
  const baseServices =
    services ??
    {
      safeEventDispatcher: new SafeEventDispatcher({
        validatedEventDispatcher: createEventBus({ captureEvents: true }),
        logger,
      }),
      turnEndPort: { signalTurnEnd: jest.fn() },
      entityManager: {
        getComponentData: jest.fn().mockReturnValue(null),
        getEntityInstance: jest.fn().mockReturnValue(null),
      },
    };

  const turnContext = new TurnContext({
    actor,
    logger,
    services: baseServices,
    strategy,
    onEndTurnCallback,
    handlerInstance: handler,
  });

  return { turnContext, logger, actor, onEndTurn: onEndTurnCallback };
};

describe('turnStateValidationUtils integration coverage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('context method validation via AwaitingActorDecisionState', () => {
    it('ends the turn when required context methods are missing', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext, onEndTurn } = createTurnContext({ handler });
      handler.setTurnContext(turnContext);
      const state = new AwaitingActorDecisionState(
        handler,
        () => ({ run: jest.fn().mockResolvedValue(undefined) })
      );

      turnContext.requestProcessingCommandStateTransition = undefined;

      await state.enterState(handler, null);

      expect(onEndTurn).toHaveBeenCalledTimes(1);
      const [errorArg] = onEndTurn.mock.calls[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toContain('missing required methods');
      expect(errorArg.message).toContain('requestProcessingCommandStateTransition');
    });

    it('allows context validation to succeed when methods are present', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext, onEndTurn } = createTurnContext({ handler });
      handler.setTurnContext(turnContext);
      const workflow = { run: jest.fn().mockResolvedValue(undefined) };
      const state = new AwaitingActorDecisionState(
        handler,
        () => workflow
      );

      await state.enterState(handler, null);

      expect(onEndTurn).not.toHaveBeenCalled();
      expect(turnContext.getActor()).toEqual({ id: 'actor-integration' });
      expect(workflow.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('actor validation through TurnIdleState transitions', () => {
    it('throws when provided actor entity is missing required identity', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext } = createTurnContext({ handler });
      handler.setTurnContext(turnContext);
      const state = new TurnIdleState(handler);

      await expect(state.startTurn(handler, { name: 'unknown' })).rejects.toThrow(
        /invalid actorEntity/i
      );
      expect(handler.resetStateAndResources).toHaveBeenCalledWith(
        expect.stringContaining('invalid-actor')
      );
      expect(handler.requestIdleStateTransition).toHaveBeenCalledTimes(1);
    });

    it('throws when handler has no turn context available', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      handler.setTurnContext(null);
      const state = new TurnIdleState(handler);

      await expect(
        state.startTurn(handler, { id: 'actor-orphan' })
      ).rejects.toThrow(/ITurnContext is missing or invalid/);
      expect(handler.resetStateAndResources).toHaveBeenCalledWith(
        expect.stringContaining('missing-context')
      );
    });

    it('throws when actor in context does not match provided actor', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext } = createTurnContext({
        handler,
        actorId: 'actor-from-context',
      });
      handler.setTurnContext(turnContext);
      const state = new TurnIdleState(handler);

      await expect(
        state.startTurn(handler, { id: 'actor-different' })
      ).rejects.toThrow(/does not match actor provided/);
      expect(handler.resetStateAndResources).toHaveBeenCalledWith(
        expect.stringContaining('actor-mismatch')
      );
    });

    it('throws when context actor metadata is invalid', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext } = createTurnContext({ handler });
      jest.spyOn(turnContext, 'getActor').mockReturnValue({});
      handler.setTurnContext(turnContext);
      const state = new TurnIdleState(handler);

      await expect(state.startTurn(handler, { id: 'actor-integrated' })).rejects.toThrow(
        /ITurnContext is missing or invalid/
      );
    });

    it('confirms actor matching path when context and caller align', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext, actor } = createTurnContext({ handler });
      handler.setTurnContext(turnContext);
      const state = new TurnIdleState(handler);
      const requestSpy = jest
        .spyOn(turnContext, 'requestAwaitingInputStateTransition')
        .mockResolvedValue(undefined);

      await state.startTurn(handler, actor);

      expect(handler.resetStateAndResources).not.toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('strategy retrieval from context', () => {
    it('throws when the context strategy is malformed', async () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const { turnContext, actor } = createTurnContext({ handler });
      handler.setTurnContext(turnContext);
      const state = new AwaitingActorDecisionState(
        handler,
        () => ({ run: jest.fn().mockResolvedValue(undefined) })
      );

      const badStrategy = { decideAction: undefined };
      jest.spyOn(turnContext, 'getStrategy').mockReturnValue(badStrategy);

      await expect(() => state.retrieveStrategy(turnContext, actor)).toThrow(
        /No valid IActorTurnStrategy found/
      );
    });

    it('retrieves a usable strategy when context is valid', () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const strategy = { decideAction: jest.fn() };
      const { turnContext, actor } = createTurnContext({ handler, strategy });
      handler.setTurnContext(turnContext);
      const state = new AwaitingActorDecisionState(
        handler,
        () => ({ run: jest.fn().mockResolvedValue(undefined) })
      );

      const resolved = state.retrieveStrategy(turnContext, actor);
      expect(resolved).toBe(strategy);
    });

    it('throws when the context is missing getStrategy()', () => {
      expect(() =>
        retrieveStrategyFromContext(null, { id: 'actor-id' }, 'StateName')
      ).toThrow(/does not provide getStrategy\(\)/);
    });

    it('throws when actor metadata is invalid', () => {
      const context = { getStrategy: () => ({ decideAction: jest.fn() }) };
      expect(() =>
        retrieveStrategyFromContext(context, { name: 'ghost' }, 'StateName')
      ).toThrow(/invalid actorEntity/);
    });
  });

  describe('command and action validation through ProcessingCommandState', () => {
    const createProcessingDeps = ({
      handler,
      commandString = 'look around',
      turnAction = { actionDefinitionId: 'core:look' },
    } = {}) => ({
      handler,
      commandProcessor: { process: jest.fn() },
      commandOutcomeInterpreter: { interpret: jest.fn() },
      commandString,
      turnAction,
      directiveResolver: { resolve: jest.fn() },
      processingWorkflowFactory: () => ({ run: jest.fn() }),
      commandProcessingWorkflowFactory: () => ({
        run: jest.fn(),
        onAfterProcessing: jest.fn(),
      }),
    });

    it('allows null turnAction without throwing validation errors', () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const deps = createProcessingDeps({ handler, turnAction: null });

      const state = new ProcessingCommandState(deps);
      expect(state).toBeInstanceOf(ProcessingCommandState);
    });

    it('accepts a fully populated dependency payload', () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);
      const deps = createProcessingDeps({ handler });

      const state = new ProcessingCommandState(deps);
      expect(state).toBeInstanceOf(ProcessingCommandState);
    });

    it('throws descriptive error for empty command string', () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);

      expect(() =>
        new ProcessingCommandState(
          createProcessingDeps({ handler, commandString: '   ' })
        )
      ).toThrow(/commandString must be a non-empty string/);
    });

    it('throws descriptive error for malformed turn action payload', () => {
      const logger = createLogger();
      const handler = new TestTurnHandler(logger);

      expect(() =>
        new ProcessingCommandState(
          createProcessingDeps({ handler, turnAction: 'walk-north' })
        )
      ).toThrow(/turnAction must be an object/);

      expect(() =>
        new ProcessingCommandState(
          createProcessingDeps({
            handler,
            turnAction: { actionDefinitionId: '   ' },
          })
        )
      ).toThrow(/turnAction.actionDefinitionId must be a non-empty string/);
    });
  });

  it('exposes context validation helper for unit-style checks via AbstractTurnState', async () => {
    const logger = createLogger();
    const handler = new TestTurnHandler(logger);
    const { turnContext } = createTurnContext({ handler });
    handler.setTurnContext(turnContext);

    class IntrospectingState extends AbstractTurnState {
      async ensure() {
        return await this._ensureContextWithMethods('integration', ['getActor']);
      }
    }

    const state = new IntrospectingState(handler);
    const resolved = await state.ensure();
    expect(resolved).toBe(turnContext);
  });

  describe('validation helper fallbacks', () => {
    it('returns all required method names when context is absent', () => {
      const missing = validateContextMethods(null, AWAITING_DECISION_CONTEXT_METHODS);
      expect(missing).toEqual(AWAITING_DECISION_CONTEXT_METHODS);
    });

    it('invokes onError when turn action payload is not an object', () => {
      const onError = jest.fn();
      validateTurnAction('move-north', onError);
      expect(onError).toHaveBeenCalledWith('turnAction must be an object.');
    });

    it('invokes onError when actionDefinitionId is not a usable string', () => {
      const onError = jest.fn();
      validateTurnAction({ actionDefinitionId: ' ' }, onError);
      expect(onError).toHaveBeenCalledWith(
        'turnAction.actionDefinitionId must be a non-empty string.'
      );
    });

    it('invokes onError when actionDefinitionId is missing entirely', () => {
      const onError = jest.fn();
      validateTurnAction({}, onError);
      expect(onError).toHaveBeenCalledWith(
        'turnAction.actionDefinitionId must be a non-empty string.'
      );
    });

    it('throws when expected actor metadata is invalid during validation', () => {
      const turnContext = { getActor: () => ({ id: 'actor-context' }) };
      expect(() =>
        validateActorInContext(turnContext, { name: 'bad' }, 'StateName')
      ).toThrow(/invalid actorEntity/);
    });

    it('throws when context actor metadata is invalid during validation', () => {
      const turnContext = { getActor: () => ({}) };
      expect(() =>
        validateActorInContext(turnContext, { id: 'actor-expected' }, 'StateName')
      ).toThrow(/invalid actorEntity/);
    });
  });
});
