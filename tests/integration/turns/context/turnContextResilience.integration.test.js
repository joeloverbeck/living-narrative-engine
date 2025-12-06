import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';

class RecordingHandler {
  constructor() {
    this._isDestroyed = false;
    this.idleTransitions = 0;
    this.awaitingInputTransitions = 0;
    this.processingTransitions = [];
    this.awaitingExternalEndTransitions = 0;
  }

  async requestIdleStateTransition() {
    this.idleTransitions += 1;
  }

  async requestAwaitingInputStateTransition() {
    this.awaitingInputTransitions += 1;
  }

  async requestProcessingCommandStateTransition(commandString, turnAction) {
    this.processingTransitions.push({ commandString, turnAction });
  }

  async requestAwaitingExternalTurnEndStateTransition() {
    this.awaitingExternalEndTransitions += 1;
  }
}

class DeterministicStrategy {
  constructor(actionDefinitionId = 'core:test_action') {
    this._actionDefinitionId = actionDefinitionId;
  }

  async decideAction() {
    return { actionDefinitionId: this._actionDefinitionId };
  }
}

const baseServices = Object.freeze({
  promptCoordinator: {
    async openPrompt() {
      return null;
    },
  },
  safeEventDispatcher: {
    async dispatch() {
      return true;
    },
  },
  turnEndPort: {
    async notifyTurnEnded() {
      return undefined;
    },
  },
  entityManager: {
    getComponentData() {
      return null;
    },
    getEntityInstance() {
      return null;
    },
  },
  game: { id: 'integration-test-world' },
});

let consoleDebugSpy;
let consoleInfoSpy;
let consoleWarnSpy;
let consoleErrorSpy;

/**
 *
 */
function clearConsoleSpies() {
  consoleDebugSpy.mockClear();
  consoleInfoSpy.mockClear();
  consoleWarnSpy.mockClear();
  consoleErrorSpy.mockClear();
}

/**
 *
 */
function createLogger() {
  const logger = new ConsoleLogger(LogLevel.DEBUG);
  clearConsoleSpies();
  return logger;
}

/**
 *
 * @param overrides
 */
function createTurnContext(overrides = {}) {
  const logger = overrides.logger ?? createLogger();
  const handlerInstance = overrides.handlerInstance ?? new RecordingHandler();
  const strategy = overrides.strategy ?? new DeterministicStrategy();
  const services = {
    ...baseServices,
    ...(overrides.services ?? {}),
  };

  const context = new TurnContext({
    actor: overrides.actor ?? { id: 'actor-123' },
    logger,
    services,
    strategy,
    onEndTurnCallback: overrides.onEndTurnCallback ?? (() => undefined),
    handlerInstance,
    isAwaitingExternalEventProvider:
      overrides.isAwaitingExternalEventProvider ?? null,
    onSetAwaitingExternalEventCallback:
      overrides.onSetAwaitingExternalEventCallback ?? null,
  });

  return { context, logger, handlerInstance };
}

/**
 *
 * @param spy
 * @param substring
 */
function consoleCallIncludes(spy, substring) {
  return spy.mock.calls.some(
    ([message]) => typeof message === 'string' && message.includes(substring)
  );
}

describe('TurnContext integration coverage for error-handling pathways', () => {
  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when the provided strategy does not implement decideAction', () => {
    const logger = createLogger();
    expect(
      () =>
        new TurnContext({
          actor: { id: 'actor-invalid-strategy' },
          logger,
          services: baseServices,
          strategy: {},
          onEndTurnCallback: () => undefined,
          handlerInstance: new RecordingHandler(),
        })
    ).toThrow('TurnContext: valid IActorTurnStrategy required.');
  });

  it('throws when onEndTurnCallback is not a function', () => {
    const logger = createLogger();
    const strategy = new DeterministicStrategy();

    expect(
      () =>
        new TurnContext({
          actor: { id: 'actor-missing-on-end' },
          logger,
          services: baseServices,
          strategy,
          onEndTurnCallback: undefined,
          handlerInstance: new RecordingHandler(),
        })
    ).toThrow('TurnContext: onEndTurnCallback function required.');
  });

  it('throws when handlerInstance is omitted', () => {
    const logger = createLogger();
    const strategy = new DeterministicStrategy();

    expect(
      () =>
        new TurnContext({
          actor: { id: 'actor-missing-handler' },
          logger,
          services: baseServices,
          strategy,
          onEndTurnCallback: () => undefined,
          handlerInstance: null,
        })
    ).toThrow('TurnContext: handlerInstance (BaseTurnHandler) required.');
  });

  it('propagates missing services through getPlayerPromptService with concrete logging', () => {
    const logger = createLogger();
    const handlerInstance = new RecordingHandler();

    const context = new TurnContext({
      actor: { id: 'actor-service-miss' },
      logger,
      services: {},
      strategy: new DeterministicStrategy(),
      onEndTurnCallback: () => undefined,
      handlerInstance,
    });

    expect(() => context.getPlayerPromptService()).toThrow(
      'TurnContext: PlayerPromptService not available in services bag.'
    );

    expect(
      consoleCallIncludes(
        consoleErrorSpy,
        'PlayerPromptService not available in services bag'
      )
    ).toBe(true);
  });

  it('falls back to the internal awaiting flag when the provider throws', () => {
    const providerError = new Error('external flag unavailable');
    const { context } = createTurnContext({
      isAwaitingExternalEventProvider() {
        throw providerError;
      },
    });

    const awaiting = context.isAwaitingExternalEvent();

    expect(awaiting).toBe(false);
    expect(
      consoleCallIncludes(
        consoleWarnSpy,
        'TurnContext.isAwaitingExternalEvent: provider error'
      )
    ).toBe(true);
  });

  it('logs callback failures while persisting awaiting state changes', () => {
    const callbackError = new Error('update failed');
    const { context } = createTurnContext({
      onSetAwaitingExternalEventCallback() {
        throw callbackError;
      },
    });

    context.setAwaitingExternalEvent(true, 'actor-123');

    expect(context.isAwaitingExternalEvent()).toBe(true);
    expect(
      consoleCallIncludes(
        consoleErrorSpy,
        'TurnContext.setAwaitingExternalEvent: callback error'
      )
    ).toBe(true);
  });

  it('rejects invalid actions passed to setChosenAction', () => {
    const { context } = createTurnContext();

    expect(() => context.setChosenAction({})).toThrow(
      'TurnContext.setChosenAction: invalid ITurnAction.'
    );
  });

  it('rebuilds its prompt signal once cancelled and logs redundant cancellations', () => {
    const { context } = createTurnContext();

    const firstSignal = context.getPromptSignal();
    expect(firstSignal.aborted).toBe(false);

    context.cancelActivePrompt();
    expect(firstSignal.aborted).toBe(true);

    const secondSignal = context.getPromptSignal();
    expect(secondSignal).not.toBe(firstSignal);
    expect(secondSignal.aborted).toBe(false);

    context.cancelActivePrompt();
    context.cancelActivePrompt();

    expect(
      consoleCallIncludes(
        consoleDebugSpy,
        'prompt signal for actor actor-123 was aborted'
      )
    ).toBe(true);
    expect(
      consoleCallIncludes(
        consoleDebugSpy,
        'cancelActivePrompt called for actor actor-123 but prompt was already aborted'
      )
    ).toBe(true);
  });

  it('delegates awaiting-input state transitions to the handler instance', async () => {
    const handlerInstance = new RecordingHandler();
    const { context } = createTurnContext({ handlerInstance });

    await context.requestAwaitingInputStateTransition();

    expect(handlerInstance.awaitingInputTransitions).toBe(1);
  });

  it('clones itself for a new actor while issuing a deprecation warning', () => {
    const { context } = createTurnContext();

    const replacementActor = { id: 'actor-456' };
    const cloned = context.cloneForActor(replacementActor);

    expect(cloned).toBeInstanceOf(TurnContext);
    expect(cloned.getActor()).toBe(replacementActor);

    expect(
      consoleCallIncludes(
        consoleWarnSpy,
        'TurnContext.cloneForActor is deprecated'
      )
    ).toBe(true);
  });
});
