// tests/turns/states/processingCommandStateError.coverage.test.js

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ProcessingCommandState } from '../../../src/turns/states/processingCommandState.js';
import { TurnIdleState } from '../../../src/turns/states/turnIdleState.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  ENTITY_SPOKE_ID,
} from '../../../src/constants/eventIds.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import TurnDirectiveStrategyResolver from '../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

class MockActor {
  constructor(id = 'actorXYZ') {
    this._id = id;
  }

  get id() {
    return this._id;
  }
}

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

let mockHandler;
let processingState;
let consoleErrorSpy;
let consoleWarnSpy;

beforeEach(() => {
  jest.clearAllMocks();

  // Handler starts with no active state
  mockHandler = {
    getTurnContext: jest.fn(),
    _resetTurnStateAndResources: jest.fn(),
    _transitionToState: jest.fn().mockResolvedValue(undefined),
    getLogger: jest.fn().mockReturnValue(mockLogger),
    _currentState: null,
    // Provide a fallback safeEventDispatcher on handler
    safeEventDispatcher: {
      dispatch: jest.fn().mockResolvedValue(undefined),
    },
  };

  // Construct a fresh ProcessingCommandState with no initial commandString or turnAction
  processingState = new ProcessingCommandState(mockHandler, null, null);
  mockHandler._currentState = processingState;

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

describe('ProcessingCommandState.enterState – error branches', () => {
  test('should warn and abort if _isProcessing is already true', async () => {
    processingState['_isProcessing'] = true;

    // Provide a dummy turn context so the code does not short-circuit earlier
    mockHandler.getTurnContext.mockReturnValue({
      getLogger: () => mockLogger,
      getActor: () => new MockActor('actor1'),
      getChosenAction: () => ({ actionDefinitionId: 'dummyAction' }),
      getSafeEventDispatcher: () => undefined,
    });

    await processingState.enterState(mockHandler, null);

    // Expect a warning via logger.warn about re-entry
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('enterState called while already processing')
    );
    // _isProcessing remains true
    expect(processingState['_isProcessing']).toBe(true);
  });

  test('should reset and transition to TurnIdleState when turnCtx is null', async () => {
    processingState['_isProcessing'] = false;
    mockHandler.getTurnContext.mockReturnValue(null);

    await processingState.enterState(mockHandler, null);

    // _isProcessing should be reset to false
    expect(processingState['_isProcessing']).toBe(false);

    // Handler._resetTurnStateAndResources called with a key indicating critical-no-context
    expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
      expect.stringMatching(/^critical-no-context-ProcessingCommandState$/)
    );
    // Handler._transitionToState called with an instance of TurnIdleState
    expect(mockHandler._transitionToState).toHaveBeenCalledWith(
      expect.any(TurnIdleState)
    );
  });

  test('should handle missing actor via handleProcessingException and dispatch SYSTEM_ERROR_OCCURRED_ID then endTurn', async () => {
    processingState['_isProcessing'] = false;

    // Create a single eventDispatcher and spy on its dispatch
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => null,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      getChosenAction: () => ({ actionDefinitionId: 'action1' }), // to skip “no turnAction” branch
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    // Capture the spyDispatch from that same eventDispatcher
    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    await processingState.enterState(mockHandler, null);

    // After detecting no actor, handleProcessingException should dispatch a system error
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('No actor present'),
        actorId: expect.any(String),
      })
    );

    // Then endTurn should be called with an Error object
    expect(spyEndTurn).toHaveBeenCalledWith(expect.any(Error));

    // Finally, _isProcessing cleared
    expect(processingState['_isProcessing']).toBe(false);
  });

  test('should handle exception when getChosenAction throws', async () => {
    processingState['_isProcessing'] = false;
    const actor = new MockActor('actorA');

    // Create a single eventDispatcher and spy on its dispatch
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: jest.fn().mockImplementation(() => {
        throw new Error('chosenAction failure');
      }),
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    // Provide commandString override so it logs that branch
    const customState = new ProcessingCommandState(mockHandler, 'cmdStr', null);
    mockHandler._currentState = customState;
    customState['_isProcessing'] = false;

    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    await customState.enterState(mockHandler, null);

    // getChosenAction threw, so handleProcessingException should dispatch a system error
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Error retrieving ITurnAction'),
        actorId: actor.id,
      })
    );
    // And endTurn called
    expect(spyEndTurn).toHaveBeenCalledWith(expect.any(Error));
    expect(customState['_isProcessing']).toBe(false);
  });

  test('should handle missing turnAction (both constructor and getChosenAction return null)', async () => {
    processingState['_isProcessing'] = false;
    const actor = new MockActor('actorB');

    // Create a single eventDispatcher and spy on its dispatch
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: () => null,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    await processingState.enterState(mockHandler, null);

    // Should dispatch a system error about no ITurnAction available
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('No ITurnAction available'),
        actorId: actor.id,
      })
    );
    // endTurn should be invoked
    expect(spyEndTurn).toHaveBeenCalledWith(expect.any(Error));
    expect(processingState['_isProcessing']).toBe(false);
  });

  test('should handle invalid actionDefinitionId (empty string) and trigger exception path', async () => {
    processingState['_isProcessing'] = false;
    const actor = new MockActor('actorC');
    const badAction = { actionDefinitionId: '', commandString: 'someCmd' };

    // Create a single eventDispatcher and spy on its dispatch
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: () => badAction,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    await processingState.enterState(mockHandler, null);

    // SYSTEM_ERROR_OCCURRED_ID dispatched about invalid actionDefinitionId
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'invalid: missing or empty actionDefinitionId'
        ),
        actorId: actor.id,
      })
    );
    expect(spyEndTurn).toHaveBeenCalledWith(expect.any(Error));
    expect(processingState['_isProcessing']).toBe(false);
  });

  test('should dispatch ENTITY_SPOKE_ID when turnAction.speech is non-empty string', async () => {
    processingState['_isProcessing'] = false;
    const actor = new MockActor('actorD');
    const turnActionWithSpeech = {
      actionDefinitionId: 'actionSpeak',
      commandString: 'speakCmd',
      speech: 'Hello, world!',
    };
    // Create a single eventDispatcher and spy on its dispatch
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: () => turnActionWithSpeech,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      // Provide valid commandProcessor and interpreter so we get past that logic
      getCommandProcessor: () => ({
        processCommand: jest.fn().mockResolvedValue({ success: true }),
      }),
      getCommandOutcomeInterpreter: () => ({
        interpret: jest.fn().mockReturnValue(TurnDirective.WAIT_FOR_EVENT),
      }),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    // Override resolver so it returns a no-op strategy
    TurnDirectiveStrategyResolver.resolveStrategy = () => ({
      execute: async () => {
        /* no-op */
      },
    });

    // Re-create state so it picks up the overridden resolver
    const stateWithSpeech = new ProcessingCommandState(mockHandler, null, null);
    stateWithSpeech['_isProcessing'] = false;
    mockHandler._currentState = stateWithSpeech;

    await stateWithSpeech.enterState(mockHandler, null);

    // ENTITY_SPOKE_ID should have been dispatched with actorId and speechContent
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENTITY_SPOKE_ID,
      expect.objectContaining({
        entityId: actor.id,
        speechContent: 'Hello, world!',
      })
    );
  });
});

describe('ProcessingCommandState._getServiceFromContext – error branches', () => {
  test('should return null and clear _isProcessing when turnCtx is null', async () => {
    processingState['_isProcessing'] = true;
    const result = await processingState['_getServiceFromContext'](
      null,
      'getCommandProcessor',
      'ICommandProcessor',
      'actorZ'
    );
    expect(result).toBeNull();
    expect(processingState['_isProcessing']).toBe(false);
  });

  test('should catch missing method on turnCtx and dispatch SYSTEM_ERROR_OCCURRED_ID, then return null', async () => {
    processingState['_isProcessing'] = true;
    const actor = new MockActor('actorF');
    const mockTurnContext = {
      getLogger: () => mockLogger,
      // getCommandProcessor is undefined
    };
    // Spy on handler.safeEventDispatcher.dispatch
    const spyDispatch = mockHandler.safeEventDispatcher.dispatch;
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    const result = await processingState['_getServiceFromContext'](
      mockTurnContext,
      'getCommandProcessor',
      'ICommandProcessor',
      actor.id
    );
    expect(result).toBeNull();
    // _isProcessing should be set to false
    expect(processingState['_isProcessing']).toBe(false);
    // SYSTEM_ERROR_OCCURRED_ID dispatched via handler.safeEventDispatcher
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Failed to retrieve ICommandProcessor'
        ),
        actorId: actor.id,
      })
    );
  });

  test('should catch service method returning null or undefined and dispatch SYSTEM_ERROR_OCCURRED_ID', async () => {
    processingState['_isProcessing'] = true;
    const actor = new MockActor('actorG');
    // Create a single eventDispatcher on turnCtx
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getCommandProcessor: () => null,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    const result = await processingState['_getServiceFromContext'](
      mockTurnContext,
      'getCommandProcessor',
      'ICommandProcessor',
      actor.id
    );
    expect(result).toBeNull();
    expect(processingState['_isProcessing']).toBe(false);
    const spyDispatch = mockEventDispatcher.dispatch;
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Failed to retrieve ICommandProcessor'
        ),
        actorId: actor.id,
      })
    );
  });
});
