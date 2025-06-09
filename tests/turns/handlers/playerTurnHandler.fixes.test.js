// tests/turns/handlers/playerTurnHandler.fixes.test.js
// ****** MODIFIED FILE ******

import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
// Assuming PlayerTurnHandler and BaseTurnHandler are in 'src/turns/handlers/'
// as per your test execution paths.
import PlayerTurnHandler from '../../../src/turns/handlers/playerTurnHandler.js';
import { BaseTurnHandler } from '../../../src/turns/handlers/baseTurnHandler.js';

describe('PlayerTurnHandler Constructor', () => {
  let mockLogger;
  let mockTurnStateFactory;
  let mockCommandProcessor;
  let mockTurnEndPort;
  let mockPlayerPromptService;
  let mockCommandOutcomeInterpreter;
  let mockSafeEventDispatcher;
  let mockCommandInputPort; // ADDED: New dependency mock
  let mockGameWorldAccess;
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
    mockCommandInputPort = {}; // ADDED: New mock object
    mockGameWorldAccess = {};

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
    playerPromptService: mockPlayerPromptService,
    commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
    safeEventDispatcher: mockSafeEventDispatcher,
    commandInputPort: mockCommandInputPort, // ADDED: Provide new dependency
    gameWorldAccess: mockGameWorldAccess,
  });

  it('should construct successfully with all valid dependencies', () => {
    const deps = getValidDependencies();
    let handler;

    expect(() => {
      handler = new PlayerTurnHandler(deps);
    }).not.toThrow();

    expect(handler).toBeInstanceOf(PlayerTurnHandler);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'PlayerTurnHandler initialised. Dependencies assigned. Initial state set.'
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
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'BaseTurnHandler: logger is required.'
    );
  });

  it('should throw an error if turnStateFactory is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnStateFactory;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'BaseTurnHandler: turnStateFactory is required.'
    );
  });

  it('should throw an error if commandProcessor is not provided', () => {
    const deps = getValidDependencies();
    delete deps.commandProcessor;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'PlayerTurnHandler: commandProcessor is required'
    );
  });

  it('should throw an error if turnEndPort is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnEndPort;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'PlayerTurnHandler: turnEndPort is required'
    );
  });

  it('should throw an error if playerPromptService is not provided', () => {
    const deps = getValidDependencies();
    delete deps.playerPromptService;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'PlayerTurnHandler: playerPromptService is required'
    );
  });

  it('should throw an error if commandOutcomeInterpreter is not provided', () => {
    const deps = getValidDependencies();
    delete deps.commandOutcomeInterpreter;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'PlayerTurnHandler: commandOutcomeInterpreter is required'
    );
  });

  it('should throw an error if safeEventDispatcher is not provided', () => {
    const deps = getValidDependencies();
    delete deps.safeEventDispatcher;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'PlayerTurnHandler: safeEventDispatcher is required'
    );
  });

  // REWRITTEN: This test now validates the new dependency.
  it('should throw an error if commandInputPort is not provided', () => {
    const deps = getValidDependencies();
    delete deps.commandInputPort;
    expect(() => new PlayerTurnHandler(deps)).toThrow(
      'PlayerTurnHandler: commandInputPort is required'
    );
  });

  // REMOVED: Obsolete test for subscriptionManager (null) is implicitly covered
  // by the new test for commandInputPort.

  it('should construct successfully if gameWorldAccess is not provided (uses default)', () => {
    const deps = getValidDependencies();
    delete deps.gameWorldAccess; // gameWorldAccess is optional

    let handler;
    expect(() => {
      handler = new PlayerTurnHandler(deps);
    }).not.toThrow();
    expect(handler).toBeInstanceOf(PlayerTurnHandler);
  });

  it('should call _setInitialState with the state from the factory', () => {
    const deps = getValidDependencies();

    const handler = new PlayerTurnHandler(deps);

    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledTimes(1);
    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
      handler
    );

    expect(setInitialStateSpy).toHaveBeenCalledTimes(1);
    expect(setInitialStateSpy).toHaveBeenCalledWith(mockInitialState);
    expect(handler._currentState).toEqual(mockInitialState);
  });
});
