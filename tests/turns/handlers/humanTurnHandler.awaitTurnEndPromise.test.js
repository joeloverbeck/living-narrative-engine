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

// New test to verify that handleSubmittedCommand awaits _handleTurnEnd

describe('HumanTurnHandler handleSubmittedCommand awaiting _handleTurnEnd', () => {
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

  it('awaits _handleTurnEnd when no context exists', async () => {
    const handler = new HumanTurnHandler(deps);
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
      new Error('No context in handleSubmittedCommand')
    );

    resolveHandleEnd();
    await promise;
    expect(resolved).toBe(true);
  });
});
