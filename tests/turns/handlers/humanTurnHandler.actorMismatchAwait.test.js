import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import ActorTurnHandler from '../../../src/turns/handlers/actorTurnHandler.js';
import { BaseTurnHandler } from '../../../src/turns/handlers/baseTurnHandler.js';
import { ActorMismatchError } from '../../../src/errors/actorMismatchError.js';

// New test verifying handleSubmittedCommand awaits endTurn on actor mismatch

describe('ActorTurnHandler handleSubmittedCommand actor mismatch', () => {
  let deps;
  let mockLogger;
  let mockTurnStateFactory;
  let mockCommandProcessor;
  let mockTurnEndPort;
  let mockPromptCoordinator;
  let mockCommandOutcomeInterpreter;
  let mockSafeEventDispatcher;
  let mockChoicePipeline;
  let mockHumanDecisionProvider;
  let mockTurnActionFactory;
  let mockTurnStrategyFactory;
  let mockTurnContextBuilder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockTurnStateFactory = {
      createInitialState: jest.fn().mockReturnValue({ stateName: 'Init' }),
    };
    mockCommandProcessor = {};
    mockTurnEndPort = {};
    mockPromptCoordinator = {};
    mockCommandOutcomeInterpreter = {};
    mockSafeEventDispatcher = {};
    mockChoicePipeline = {};
    mockHumanDecisionProvider = {};
    mockTurnActionFactory = {};
    mockTurnStrategyFactory = {
      createForHuman: jest.fn(() => ({ decideAction: jest.fn() })),
    };

    mockTurnContextBuilder = {
      build: jest.fn(({ actor }) => ({
        getActor: () => actor,
        setAwaitingExternalEvent: jest.fn(),
        isAwaitingExternalEvent: jest.fn(() => false),
        endTurn: jest.fn(),
      })),
    };

    deps = {
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
      commandProcessor: mockCommandProcessor,
      turnEndPort: mockTurnEndPort,
      promptCoordinator: mockPromptCoordinator,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      safeEventDispatcher: mockSafeEventDispatcher,
      choicePipeline: mockChoicePipeline,
      humanDecisionProvider: mockHumanDecisionProvider,
      turnActionFactory: mockTurnActionFactory,
      turnStrategyFactory: mockTurnStrategyFactory,
      turnContextBuilder: mockTurnContextBuilder,
    };

    jest
      .spyOn(BaseTurnHandler.prototype, '_setInitialState')
      .mockImplementation(function (state) {
        this._currentState = state;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('awaits endTurn when actor mismatches the active context', async () => {
    const handler = new ActorTurnHandler(deps);
    const actorInContext = { id: 'actorA' };
    const actorSubmitting = { id: 'actorB' };

    let resolveEnd;
    const endPromise = new Promise((res) => {
      resolveEnd = res;
    });

    const mockCtx = {
      getActor: () => actorInContext,
      endTurn: jest.fn(() => endPromise),
    };
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(mockCtx);

    const promise = handler.handleSubmittedCommand('look', actorSubmitting);
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    // Check that endTurn was called with the correct error type
    expect(mockCtx.endTurn).toHaveBeenCalledWith(
      expect.any(ActorMismatchError)
    );

    // For better testing, also check the properties of the error
    const errorArg = mockCtx.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(
      "Actor mismatch: command for 'actorB' but current context is for 'actorA'."
    );
    expect(errorArg.expectedActorId).toBe('actorA');
    expect(errorArg.actualActorId).toBe('actorB');

    resolveEnd();
    await promise;
    expect(resolved).toBe(true);
  });
});
