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

// Minimal dependency mocks
let deps;
let mockLogger;
let mockTurnStateFactory;
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
    commandProcessor: {},
    turnEndPort: {},
    promptCoordinator: {},
    commandOutcomeInterpreter: {},
    safeEventDispatcher: {},
    choicePipeline: {},
    humanDecisionProvider: {},
    turnActionFactory: {},

    strategyFactory: {
      createForHuman: jest.fn(() => ({ decideAction: jest.fn() })),
    },

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

describe('ActorTurnHandler.getTurnEndPort', () => {
  it('returns the injected turnEndPort instance', () => {
    const handler = new ActorTurnHandler(deps);
    expect(handler.getTurnEndPort()).toBe(deps.turnEndPort);
  });
});
