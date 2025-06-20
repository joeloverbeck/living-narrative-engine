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

/** Sets up minimal dependency mocks */
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
    createInitialState: jest
      .fn()
      .mockReturnValue({ stateName: 'Init', startTurn: jest.fn() }),
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
    create: jest.fn(() => ({ decideAction: jest.fn() })),
  };
  mockTurnContextBuilder = {
    build: jest.fn(({ actor, setAwaitFlag }) => {
      let awaiting = false;
      return {
        getActor: () => actor,
        setAwaitingExternalEvent: (flag, id) => {
          awaiting = flag;
          if (setAwaitFlag) setAwaitFlag(flag, id);
        },
        isAwaitingExternalEvent: () => awaiting,
        endTurn: jest.fn(),
      };
    }),
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

describe('TurnContext awaiting external event flag propagation', () => {
  it('forwards awaiting flag changes to the handler', async () => {
    const handler = new ActorTurnHandler(deps);
    const actor = { id: 'actor1' };
    const markSpy = jest.spyOn(handler, '_markAwaitingTurnEnd');

    await handler.startTurn(actor);
    const ctx = handler.getTurnContext();
    expect(ctx).toBeTruthy();

    ctx.setAwaitingExternalEvent(true, actor.id);
    expect(markSpy).toHaveBeenLastCalledWith(true, actor.id);
    expect(ctx.isAwaitingExternalEvent()).toBe(true);

    ctx.setAwaitingExternalEvent(false, actor.id);
    expect(markSpy).toHaveBeenLastCalledWith(false, actor.id);
    expect(ctx.isAwaitingExternalEvent()).toBe(false);
  });
});
