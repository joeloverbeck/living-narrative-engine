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

describe('HumanTurnHandler.startTurn validation', () => {
  it('throws when actor is null or lacks a valid id', async () => {
    const handler = new HumanTurnHandler(deps);
    const errorMsg =
      'HumanTurnHandler.startTurn: actor is required and must have a valid id.';
    await expect(handler.startTurn(null)).rejects.toThrow(errorMsg);
    await expect(handler.startTurn({})).rejects.toThrow(errorMsg);
    await expect(handler.startTurn({ id: ' ' })).rejects.toThrow(errorMsg);
  });

  it('does not throw for a valid actor', async () => {
    const handler = new HumanTurnHandler(deps);
    const actor = { id: 'actor1' };
    const state = { startTurn: jest.fn() };
    handler._currentState = state;
    await expect(handler.startTurn(actor)).resolves.toBeUndefined();
    expect(state.startTurn).toHaveBeenCalledWith(handler, actor);
  });
});
