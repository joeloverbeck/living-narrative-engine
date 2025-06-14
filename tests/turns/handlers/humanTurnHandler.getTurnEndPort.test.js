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

// Minimal dependency mocks
let deps;
let mockLogger;
let mockTurnStateFactory;

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
  deps = {
    logger: mockLogger,
    turnStateFactory: mockTurnStateFactory,
    commandProcessor: {},
    turnEndPort: {},
    promptCoordinator: {},
    commandOutcomeInterpreter: {},
    safeEventDispatcher: {},
    choicePipeline: {},
    humanDecisionProvider: {},
    turnActionFactory: {},
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

describe('HumanTurnHandler.getTurnEndPort', () => {
  it('returns the injected turnEndPort instance', () => {
    const handler = new HumanTurnHandler(deps);
    expect(handler.getTurnEndPort()).toBe(deps.turnEndPort);
  });
});
