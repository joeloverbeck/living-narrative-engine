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

// reusing constructor setup from existing tests

describe('HumanTurnHandler method delegation', () => {
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
    mockTurnContextBuilder = { build: jest.fn() };

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

  it('delegates handleSubmittedCommand to current state', async () => {
    const handler = new HumanTurnHandler(deps);
    const actor = { id: 'a1' };
    const mockState = {
      getStateName: () => 'state',
      handleSubmittedCommand: jest.fn(),
    };
    handler._currentState = mockState;
    jest.spyOn(handler, 'getTurnContext').mockReturnValue({
      getActor: () => actor,
      endTurn: jest.fn(),
    });

    await handler.handleSubmittedCommand('look', actor);

    expect(mockState.handleSubmittedCommand).toHaveBeenCalledWith(
      handler,
      'look',
      actor
    );
  });

  it('delegates handleTurnEndedEvent to current state', async () => {
    const handler = new HumanTurnHandler(deps);
    const actor = { id: 'a2' };
    const mockState = {
      getStateName: () => 'state',
      handleTurnEndedEvent: jest.fn(),
    };
    handler._currentState = mockState;
    jest.spyOn(handler, 'getTurnContext').mockReturnValue({
      getActor: () => actor,
      endTurn: jest.fn(),
    });

    const event = { payload: { entityId: actor.id } };
    await handler.handleTurnEndedEvent(event);

    expect(mockState.handleTurnEndedEvent).toHaveBeenCalledWith(
      handler,
      event.payload
    );
  });
});
