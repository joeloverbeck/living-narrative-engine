// tests/turns/handlers/playerTurnHandler.fixes.test.js

import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import ActorTurnHandler from '../../../../src/turns/handlers/actorTurnHandler.js';

describe('ActorTurnHandler Constructor', () => {
  let mockLogger;
  let mockTurnStateFactory;
  let mockTurnEndPort;
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
    mockTurnEndPort = {};
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
    mockTurnContextBuilder = { build: jest.fn() };

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
    turnEndPort: mockTurnEndPort,
    turnStrategyFactory: mockTurnStrategyFactory,
    turnContextBuilder: mockTurnContextBuilder,
    gameWorldAccess: mockGameWorldAccess,
  });

  it('should construct successfully with all valid dependencies', () => {
    const deps = getValidDependencies();
    let handler;

    expect(() => {
      handler = new ActorTurnHandler(deps);
    }).not.toThrow();

    expect(handler).toBeInstanceOf(ActorTurnHandler);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'ActorTurnHandler initialised. Dependencies assigned. Initial state set.'
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
    expect(() => new ActorTurnHandler(deps)).toThrow(
      'BaseTurnHandler: logger is required.'
    );
  });

  it('should throw an error if turnStateFactory is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnStateFactory;
    expect(() => new ActorTurnHandler(deps)).toThrow(
      'BaseTurnHandler: turnStateFactory is required.'
    );
  });

  it('should throw an error if turnEndPort is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnEndPort;
    expect(() => new ActorTurnHandler(deps)).toThrow(
      'GenericTurnHandler: turnEndPort is required'
    );
  });

  // New test case for the new required dependency
  it('should throw an error if turnStrategyFactory is not provided', () => {
    const deps = getValidDependencies();
    delete deps.turnStrategyFactory;
    expect(() => new ActorTurnHandler(deps)).toThrow(
      'GenericTurnHandler: strategyFactory is required'
    );
  });

  it('should construct successfully if gameWorldAccess is not provided (uses default)', () => {
    const deps = getValidDependencies();
    delete deps.gameWorldAccess; // gameWorldAccess is optional

    let handler;
    expect(() => {
      handler = new ActorTurnHandler(deps);
    }).not.toThrow();
    expect(handler).toBeInstanceOf(ActorTurnHandler);
  });

  it('should call _setInitialState with the state from the factory', () => {
    const deps = getValidDependencies();

    const handler = new ActorTurnHandler(deps);

    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledTimes(1);
    expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
      handler
    );

    expect(setInitialStateSpy).toHaveBeenCalledTimes(1);
    expect(setInitialStateSpy).toHaveBeenCalledWith(mockInitialState);
    expect(handler._currentState).toEqual(mockInitialState);
  });
});
