import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import HumanTurnHandler from '../../../src/turns/handlers/humanTurnHandler.js';
import { BaseTurnHandler } from '../../../src/turns/handlers/baseTurnHandler.js';

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

describe('HumanTurnHandler.handleTurnEndedEvent with no context', () => {
  it('clears awaiting flags when no context exists', async () => {
    const handler = new HumanTurnHandler(deps);
    // simulate awaiting external event
    handler._markAwaitingTurnEnd(true, 'actor1');

    const state = {
      handleTurnEndedEvent: jest.fn().mockResolvedValue(undefined),
    };
    handler._currentState = state;
    jest.spyOn(handler, 'getTurnContext').mockReturnValue(null);

    const clearSpy = jest.spyOn(
      handler,
      '_clearTurnEndWaitingMechanismsInternal'
    );

    await handler.handleTurnEndedEvent({ payload: { entityId: 'actor1' } });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(handler._getIsAwaitingExternalTurnEndFlag()).toBe(false);
  });
});
