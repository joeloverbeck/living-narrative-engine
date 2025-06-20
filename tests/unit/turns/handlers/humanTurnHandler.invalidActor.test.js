import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import ActorTurnHandler from '../../../../src/turns/handlers/actorTurnHandler.js';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { ActorMismatchError } from '../../../../src/errors/actorMismatchError.js';

describe('ActorTurnHandler.handleSubmittedCommand with invalid actor', () => {
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
      createInitialState: jest.fn().mockReturnValue({ stateName: 'init' }),
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

  it('ends the turn when actorEntity is null without throwing', async () => {
    const handler = new ActorTurnHandler(deps);
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(null);

    const endSpy = jest
      .spyOn(handler, '_handleTurnEnd')
      .mockResolvedValue(undefined);

    await expect(
      handler.handleSubmittedCommand('look', null)
    ).resolves.toBeUndefined();

    expect(endSpy).toHaveBeenCalledTimes(1);
    const errorArg = endSpy.mock.calls[0][1];
    expect(errorArg).toBeInstanceOf(ActorMismatchError);
    expect(errorArg.message).toBe(
      'A valid actor must be provided to handle a command.'
    );
  });

  it('awaits endTurn when actorEntity is null but context exists', async () => {
    const handler = new ActorTurnHandler(deps);
    let resolveEnd;
    const endPromise = new Promise((res) => {
      resolveEnd = res;
    });
    const mockCtx = {
      getActor: () => ({ id: 'actor1' }),
      endTurn: jest.fn(() => endPromise),
    };
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(mockCtx);

    const promise = handler.handleSubmittedCommand('look', null);
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(mockCtx.endTurn).toHaveBeenCalledWith(
      expect.any(ActorMismatchError)
    );

    const errorArg = mockCtx.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(
      'A valid actor must be provided to handle a command.'
    );

    resolveEnd();
    await promise;
    expect(resolved).toBe(true);
  });

  it('ends the turn when actorEntity has invalid id and no context', async () => {
    const handler = new ActorTurnHandler(deps);
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(null);

    const endSpy = jest
      .spyOn(handler, '_handleTurnEnd')
      .mockResolvedValue(undefined);

    await expect(
      handler.handleSubmittedCommand('look', { id: '' })
    ).resolves.toBeUndefined();

    expect(endSpy).toHaveBeenCalledTimes(1);
    const errorArg = endSpy.mock.calls[0][1];
    expect(errorArg).toBeInstanceOf(ActorMismatchError);
    expect(errorArg.message).toBe(
      'A valid actor must be provided to handle a command.'
    );
  });

  it('awaits endTurn when actorEntity has invalid id and context exists', async () => {
    const handler = new ActorTurnHandler(deps);
    let resolveEnd;
    const endPromise = new Promise((res) => {
      resolveEnd = res;
    });
    const mockCtx = {
      getActor: () => ({ id: 'actor1' }),
      endTurn: jest.fn(() => endPromise),
    };
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(mockCtx);

    const promise = handler.handleSubmittedCommand('look', { id: 123 });
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(mockCtx.endTurn).toHaveBeenCalledWith(
      expect.any(ActorMismatchError)
    );

    const errorArg = mockCtx.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(
      'A valid actor must be provided to handle a command.'
    );

    resolveEnd();
    await promise;
    expect(resolved).toBe(true);
  });
});
