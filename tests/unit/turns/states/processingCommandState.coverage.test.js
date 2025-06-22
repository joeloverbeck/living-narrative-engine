// tests/turns/states/processingCommandStateError.coverage.test.js

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  ENTITY_SPOKE_ID,
} from '../../../../src/constants/eventIds.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

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
    resetStateAndResources: jest.fn(function (reason) {
      mockHandler._resetTurnStateAndResources(reason);
    }),
    _transitionToState: jest.fn().mockResolvedValue(undefined),
    requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    getLogger: jest.fn().mockReturnValue(mockLogger),
    _currentState: null,
    // Provide a fallback safeEventDispatcher on handler
    safeEventDispatcher: {
      dispatch: jest.fn().mockResolvedValue(undefined),
    },
    getSafeEventDispatcher: jest.fn(function () {
      return this.safeEventDispatcher;
    }),
    getCurrentState: jest.fn(function () {
      return this._currentState;
    }),
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
      getDecisionMeta: () => null, // Provide mock to prevent crash
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
    // Handler.requestIdleStateTransition should be invoked
    expect(mockHandler.requestIdleStateTransition).toHaveBeenCalled();
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
      getDecisionMeta: () => null, // Provide mock to prevent crash
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
        details: expect.any(Object),
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
      getDecisionMeta: () => null, // Provide mock to prevent crash
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
        details: expect.any(Object),
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
      getDecisionMeta: () => null, // Provide mock to prevent crash
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
        details: expect.any(Object),
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
      getDecisionMeta: () => null, // Provide mock to prevent crash
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
        details: expect.any(Object),
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
      speech: 'This speech is now ignored by the dispatch logic!',
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
      // FIX: Add the missing mock for getDecisionMeta. This is the source of the error.
      getDecisionMeta: jest.fn().mockReturnValue({
        speech: 'Hello, world!', // This is the speech that will be checked
        thoughts: null,
        notes: [],
      }),
      // Provide valid commandProcessor and interpreter so we get past that logic
      getCommandProcessor: () => ({
        dispatchAction: jest.fn().mockResolvedValue({ success: true }),
      }),
      getCommandOutcomeInterpreter: () => ({
        interpret: jest.fn().mockReturnValue(TurnDirective.WAIT_FOR_EVENT),
      }),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    // Mock the resolver so it returns a no-op strategy, preventing further execution
    jest
      .spyOn(TurnDirectiveStrategyResolver, 'resolveStrategy')
      .mockReturnValue({
        execute: jest.fn().mockResolvedValue(undefined),
      });

    // Re-create state so it picks up the overridden resolver
    const stateWithSpeech = new ProcessingCommandState(mockHandler, null, null);
    stateWithSpeech['_isProcessing'] = false;
    mockHandler._currentState = stateWithSpeech;

    const processInternalSpy = jest.spyOn(
      stateWithSpeech,
      '_processCommandInternal'
    );

    await stateWithSpeech.enterState(mockHandler, null);

    // ENTITY_SPOKE_ID should have been dispatched with actorId and speechContent from getDecisionMeta
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENTITY_SPOKE_ID,
      expect.objectContaining({
        entityId: actor.id,
        speechContent: 'Hello, world!',
      })
    );

    // Verify the internal processing was still called
    expect(processInternalSpy).toHaveBeenCalled();
  });

  test('should include joined notes when decision meta contains notes array', async () => {
    processingState['_isProcessing'] = false;
    const actor = new MockActor('actorE');
    const turnActionWithSpeech = {
      actionDefinitionId: 'actionSpeak',
      commandString: 'speakCmd',
      speech: 'ignored speech',
    };
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: () => turnActionWithSpeech,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      getDecisionMeta: jest.fn().mockReturnValue({
        speech: 'Hello notes',
        thoughts: null,
        notes: ['first note', 'second note'],
      }),
      getCommandProcessor: () => ({
        dispatchAction: jest.fn().mockResolvedValue({ success: true }),
      }),
      getCommandOutcomeInterpreter: () => ({
        interpret: jest.fn().mockReturnValue(TurnDirective.WAIT_FOR_EVENT),
      }),
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    jest
      .spyOn(TurnDirectiveStrategyResolver, 'resolveStrategy')
      .mockReturnValue({
        execute: jest.fn().mockResolvedValue(undefined),
      });

    const stateWithNotes = new ProcessingCommandState(mockHandler, null, null);
    stateWithNotes['_isProcessing'] = false;
    mockHandler._currentState = stateWithNotes;

    await stateWithNotes.enterState(mockHandler, null);

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENTITY_SPOKE_ID,
      expect.objectContaining({
        entityId: actor.id,
        speechContent: 'Hello notes',
        notes: 'first note\nsecond note',
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
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid turnCtx in _getServiceFromContext')
    );
    expect(mockHandler.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Invalid turnCtx'),
      })
    );
    expect(mockHandler.getSafeEventDispatcher).toHaveBeenCalled();
  });

  test('should log error when turnCtx lacks getLogger', async () => {
    processingState['_isProcessing'] = true;
    const dummyCtx = {};

    const result = await processingState['_getServiceFromContext'](
      dummyCtx,
      'getCommandProcessor',
      'ICommandProcessor',
      'actorMissingLogger'
    );

    expect(result).toBeNull();
    expect(processingState['_isProcessing']).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid turnCtx in _getServiceFromContext')
    );
    expect(mockHandler.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Invalid turnCtx'),
      })
    );
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
        details: expect.any(Object),
      })
    );
    expect(mockHandler.getSafeEventDispatcher).toHaveBeenCalled();
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
        details: expect.any(Object),
      })
    );
  });
});
