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

// New test to verify that handleSubmittedCommand awaits _handleTurnEnd

describe('ActorTurnHandler handleSubmittedCommand awaiting _handleTurnEnd', () => {
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
      strategyFactory: mockTurnStrategyFactory,
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

  it('awaits _handleTurnEnd when no context exists', async () => {
    const handler = new ActorTurnHandler(deps);
    const actor = { id: 'actor1' };

    jest.spyOn(handler, 'getTurnContext').mockReturnValue(null);

    let resolveHandleEnd;
    const handleEndPromise = new Promise((res) => {
      resolveHandleEnd = res;
    });
    const handleEndSpy = jest
      .spyOn(handler, '_handleTurnEnd')
      .mockReturnValue(handleEndPromise);

    const promise = handler.handleSubmittedCommand('look', actor);
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    // Allow any pending microtasks to run
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(handleEndSpy).toHaveBeenCalledWith(
      actor.id,
      expect.any(ActorMismatchError) // Use expect.any with the specific error class
    );

    // Additionally, verify the message of the error passed to the spy
    const errorArg = handleEndSpy.mock.calls[0][1];
    expect(errorArg.message).toBe(
      "Cannot handle command for actor 'actor1'; no active turn context."
    );

    resolveHandleEnd();
    await promise;
    expect(resolved).toBe(true);
  });
});
