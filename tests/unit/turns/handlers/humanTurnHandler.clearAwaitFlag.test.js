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

describe('ActorTurnHandler.handleTurnEndedEvent with no context', () => {
  it('clears awaiting flags when no context exists', async () => {
    const handler = new ActorTurnHandler(deps);
    // simulate awaiting external event
    handler._markAwaitingTurnEnd(true, 'actor1');

    const state = {
      handleTurnEndedEvent: jest.fn().mockResolvedValue(undefined),
    };
    handler._currentState = state;
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(null);

    const clearSpy = jest.spyOn(handler, '_resetAwaitTurnEndFlags');

    await handler.handleTurnEndedEvent({ payload: { entityId: 'actor1' } });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(handler._getIsAwaitingExternalTurnEndFlag()).toBe(false);
  });
});
