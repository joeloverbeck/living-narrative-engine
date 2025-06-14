// tests/turns/handlers/playerTurnHandler.fixes.test.js

import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { BaseTurnHandler } from '../../../src/turns/handlers/baseTurnHandler.js';
import HumanTurnHandler from '../../../src/turns/handlers/humanTurnHandler.js';

describe('HumanTurnHandler Constructor', () => {
  let mockLogger;
  let mockTurnStateFactory;
  let mockCommandProcessor;
  let mockTurnEndPort;
  let mockPlayerPromptService;
  let mockCommandOutcomeInterpreter;
  let mockSafeEventDispatcher;
  let mockGameWorldAccess;
  let mockTurnContextBuilder;
  let mockTurnStrategyFactory; // <-- Changed
  let mockInitialState;
  let setInitialStateSpy;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockInitialState = { stateName: 'MockInitialState' };
    mockTurnStateFactory = {
      createInitialState: jest.fn().mockReturnValue(mockInitialState),
    };
    mockCommandProcessor = {};
    mockTurnEndPort = {};
    mockPlayerPromptService = {};
    mockCommandOutcomeInterpreter = {};
    mockSafeEventDispatcher = {};
    mockGameWorldAccess = {};
    mockTurnContextBuilder = {
      build: jest.fn(({ actor }) => ({
        getActor: () => actor,
        setAwaitingExternalEvent: jest.fn(),
        isAwaitingExternalEvent: jest.fn(() => false),
        endTurn: jest.fn(),
      })),
    };
    // New mock for the required factory
    mockTurnStrategyFactory = {
      createForHuman: jest.fn(),
    };

    setInitialStateSpy = jest
      .spyOn(BaseTurnHandler.prototype, '_setInitialState')
      .mockImplementation(function (state) {
        this._currentState = state;
      });

    mockTurnStateFactory.createInitialState.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const getValidDependencies = () => ({
    logger: mockLogger,
    turnStateFactory: mockTurnStateFactory,
    commandProcessor: mockCommandProcessor,
    turnEndPort: mockTurnEndPort,
    promptCoordinator: mockPlayerPromptService,
    commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
    safeEventDispatcher: mockSafeEventDispatcher,
    turnStrategyFactory: mockTurnStrategyFactory, // <-- Changed
    turnContextBuilder: mockTurnContextBuilder,
    gameWorldAccess: mockGameWorldAccess,
  });

  it('should construct successfully with all valid dependencies', () => {
    const deps = getValidDependencies();
    let handler;

    expect(() => {
      handler = new HumanTurnHandler(deps);
    }).not.toThrow();

    expect(handler).toBeInstanceOf(HumanTurnHandler);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'HumanTurnHandler initialised. Dependencies assigned. Initial state set.'
      )
    );
    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
      handler
    );
    expect(setInitialStateSpy).toHaveBeenCalledWith(mockInitialState);
    expect(handler._currentState).toBe(mockInitialState);
  });

  it('should throw an error if logger is not provided', () => {
    const deps = getValidDependencies();
    delete deps.logger;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'BaseTurnHandler: logger is required.'
    );
  });

  it('should throw an error if turnStateFactory is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnStateFactory;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'BaseTurnHandler: turnStateFactory is required.'
    );
  });

  it('should throw an error if commandProcessor is not provided', () => {
    const deps = getValidDependencies();
    delete deps.commandProcessor;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'HumanTurnHandler: commandProcessor is required'
    );
  });

  it('should throw an error if turnEndPort is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnEndPort;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'HumanTurnHandler: turnEndPort is required'
    );
  });

  it('should throw an error if promptCoordinator is not provided', () => {
    const deps = getValidDependencies();
    delete deps.promptCoordinator;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'HumanTurnHandler: promptCoordinator is required'
    );
  });

  it('should throw an error if commandOutcomeInterpreter is not provided', () => {
    const deps = getValidDependencies();
    delete deps.commandOutcomeInterpreter;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'HumanTurnHandler: commandOutcomeInterpreter is required'
    );
  });

  it('should throw an error if safeEventDispatcher is not provided', () => {
    const deps = getValidDependencies();
    delete deps.safeEventDispatcher;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'HumanTurnHandler: safeEventDispatcher is required'
    );
  });

  // New test case for the new required dependency
  it('should throw an error if turnStrategyFactory is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnStrategyFactory;
    expect(() => new HumanTurnHandler(deps)).toThrow(
      'HumanTurnHandler: turnStrategyFactory is required'
    );
  });

  it('should construct successfully if gameWorldAccess is not provided (uses default)', () => {
    const deps = getValidDependencies();
    delete deps.gameWorldAccess; // gameWorldAccess is optional

    let handler;
    expect(() => {
      handler = new HumanTurnHandler(deps);
    }).not.toThrow();
    expect(handler).toBeInstanceOf(HumanTurnHandler);
  });

  it('should call _setInitialState with the state from the factory', () => {
    const deps = getValidDependencies();

    const handler = new HumanTurnHandler(deps);

    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledTimes(1);
    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
      handler
    );

    expect(setInitialStateSpy).toHaveBeenCalledTimes(1);
    expect(setInitialStateSpy).toHaveBeenCalledWith(mockInitialState);
    expect(handler._currentState).toEqual(mockInitialState);
  });
});
