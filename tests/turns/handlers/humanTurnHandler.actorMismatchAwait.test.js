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

// New test verifying handleSubmittedCommand awaits endTurn on actor mismatch

describe('HumanTurnHandler handleSubmittedCommand actor mismatch', () => {
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
    const handler = new HumanTurnHandler(deps);
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
    expect(mockCtx.endTurn).toHaveBeenCalledWith(
      new Error('Actor mismatch in handleSubmittedCommand')
    );

    resolveEnd();
    await promise;
    expect(resolved).toBe(true);
  });
});
