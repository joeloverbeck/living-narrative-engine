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
import {
  ServiceLookupError,
  getServiceFromContext,
} from '../../../../src/turns/states/helpers/getServiceFromContext.js';

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
let mockCommandProcessor;
let mockCommandOutcomeInterpreter;
let mockTurnAction;
const defaultCommandString = 'test command';

// Mock TurnDirectiveStrategyResolver for this test suite
jest.mock('../../../../src/turns/strategies/turnDirectiveStrategyResolver.js');

beforeEach(() => {
  jest.clearAllMocks();

  mockCommandProcessor = {
    dispatchAction: jest.fn(),
  };

  mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
  };

  mockTurnAction = {
    actionDefinitionId: 'defaultTestAction',
    commandString: defaultCommandString,
  };

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

  // Construct a fresh ProcessingCommandState with all required parameters
  processingState = new ProcessingCommandState({
    handler: mockHandler,
    commandProcessor: mockCommandProcessor,
    commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
    commandString: defaultCommandString,
    turnAction: mockTurnAction,
    directiveResolver: TurnDirectiveStrategyResolver.default,
  });
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
    processingState.startProcessing();

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
    expect(processingState.isProcessing).toBe(true);
  });

  test('should reset and transition to TurnIdleState when turnCtx is null', async () => {
    processingState.finishProcessing();
    mockHandler.getTurnContext.mockReturnValue(null);

    await processingState.enterState(mockHandler, null);

    // _isProcessing should be reset to false
    expect(processingState.isProcessing).toBe(false);

    // Handler._resetTurnStateAndResources called with a key indicating critical-no-context
    expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith(
      expect.stringMatching(/^critical-no-context-ProcessingCommandState$/)
    );
    // Handler.requestIdleStateTransition should be invoked
    expect(mockHandler.requestIdleStateTransition).toHaveBeenCalled();
  });

  test('should handle missing actor via handleProcessingException and dispatch SYSTEM_ERROR_OCCURRED_ID then endTurn', async () => {
    processingState.finishProcessing();

    // Create a single eventDispatcher and spy on its dispatch
    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => null,
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      getChosenAction: () => ({ actionDefinitionId: 'action1' }), // to skip "no turnAction" branch
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
    expect(processingState.isProcessing).toBe(false);
  });

  test('should handle exception when getChosenAction throws', async () => {
    processingState.finishProcessing();
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

    // Ensure mockCommandOutcomeInterpreter, defaultTurnAction, and TurnDirectiveStrategyResolver
    // are available from the outer beforeEach scope.
    const customState = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: 'cmdStr',
      turnAction: null,
      directiveResolver: TurnDirectiveStrategyResolver.default,
    });
    mockHandler._currentState = customState;
    customState.finishProcessing();

    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    // Ensure dispatchAction returns a valid structure even if not strictly used by this error path
    mockCommandProcessor.dispatchAction.mockResolvedValue({
      success: true,
      turnEnded: false,
      originalInput: customState.commandString,
      actionResult: { actionId: 'testAction' },
    });

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
    expect(customState.isProcessing).toBe(false);
  });

  test('should handle missing turnAction (both constructor and getChosenAction return null)', async () => {
    // processingState.finishProcessing(); // Not needed for the new local state
    const actor = new MockActor('actorB');

    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: () => null, // This is key for the test
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      getDecisionMeta: () => null,
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    // Create a local state specifically for this test, with turnAction: null
    const stateForNullActionTest = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: defaultCommandString, // from beforeEach
      turnAction: null, // Crucial for this test's logic
      directiveResolver: TurnDirectiveStrategyResolver.default, // from beforeEach, corrected
    });
    // mockHandler._currentState = stateForNullActionTest; // Set if handler needs it for context
    stateForNullActionTest.finishProcessing(); // Ensure it starts clean if it matters

    mockCommandProcessor.dispatchAction.mockResolvedValue({
      success: true,
      turnEnded: false,
      originalInput: defaultCommandString,
      actionResult: { actionId: 'testAction' },
    });

    await stateForNullActionTest.enterState(mockHandler, null); // Call enterState on the local instance

    // Assertions remain the same, but now implicitly test the local state's behavior
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('No ITurnAction available'),
        details: expect.any(Object),
      })
    );
    expect(spyEndTurn).toHaveBeenCalledWith(expect.any(Error));
    expect(stateForNullActionTest.isProcessing).toBe(false); // Check the local state instance
  });

  test('should handle invalid actionDefinitionId (empty string) and trigger exception path', async () => {
    // processingState.finishProcessing(); // Not needed for the new local state
    const actor = new MockActor('actorC');
    const badAction = { actionDefinitionId: '', commandString: 'someCmd' };

    const mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnContext = {
      getLogger: () => mockLogger,
      getActor: () => actor,
      getChosenAction: () => badAction, // This mock is key for the test logic
      getSafeEventDispatcher: jest.fn(() => mockEventDispatcher),
      endTurn: jest.fn().mockResolvedValue(undefined),
      getDecisionMeta: () => null,
    };
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    const spyDispatch = mockEventDispatcher.dispatch;
    const spyEndTurn = mockTurnContext.endTurn;

    // Create a local state specifically for this test
    const stateForInvalidActionTest = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: badAction.commandString, // Use command string from badAction
      turnAction: null, // Crucial: ensures getChosenAction is called
      directiveResolver: TurnDirectiveStrategyResolver.default,
    });
    stateForInvalidActionTest.finishProcessing(); // Start clean

    mockCommandProcessor.dispatchAction.mockResolvedValue({
      success: true,
      turnEnded: false,
      originalInput: badAction.commandString,
      actionResult: { actionId: badAction.actionDefinitionId },
    });

    await stateForInvalidActionTest.enterState(mockHandler, null); // Call enterState on the local instance

    // Assertions remain the same, but now implicitly test the local state's behavior
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
    expect(stateForInvalidActionTest.isProcessing).toBe(false); // Check the local state instance
  });

  test('should dispatch ENTITY_SPOKE_ID when turnAction.speech is non-empty string', async () => {
    processingState.finishProcessing();
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
    };
    mockCommandProcessor.dispatchAction.mockResolvedValue({
      success: true,
      turnEnded: false,
      originalInput: 'speakCmd',
      actionResult: { actionId: turnActionWithSpeech.actionDefinitionId },
    });
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    // Mock the resolver so it returns a no-op strategy, preventing further execution
    jest
      .spyOn(TurnDirectiveStrategyResolver, 'resolveStrategy')
      .mockReturnValue({
        execute: jest.fn().mockResolvedValue(undefined),
      });

    // Re-create state so it picks up the overridden resolver
    const stateWithSpeech = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: 'speakCmd',
      turnAction: turnActionWithSpeech,
      directiveResolver: TurnDirectiveStrategyResolver,
    });
    stateWithSpeech.finishProcessing();
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
    processingState.finishProcessing();
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
    };
    mockCommandProcessor.dispatchAction.mockResolvedValue({
      success: true,
      turnEnded: false,
      originalInput: 'speakCmd',
      actionResult: { actionId: turnActionWithSpeech.actionDefinitionId },
    });
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    jest
      .spyOn(TurnDirectiveStrategyResolver, 'resolveStrategy')
      .mockReturnValue({
        execute: jest.fn().mockResolvedValue(undefined),
      });

    const stateWithNotes = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: 'speakCmd',
      turnAction: turnActionWithSpeech,
      directiveResolver: TurnDirectiveStrategyResolver,
    });
    stateWithNotes.finishProcessing();
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
  test('should throw ServiceLookupError and clear _isProcessing when turnCtx is null', async () => {
    processingState.startProcessing();
    await expect(
      getServiceFromContext(
        processingState,
        null,
        'getCommandProcessor',
        'ICommandProcessor',
        'actorZ'
      )
    ).rejects.toThrow(ServiceLookupError);
    expect(processingState.isProcessing).toBe(false);
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
    processingState.startProcessing();
    const dummyCtx = {};

    await expect(
      getServiceFromContext(
        processingState,
        dummyCtx,
        'getCommandProcessor',
        'ICommandProcessor',
        'actorMissingLogger'
      )
    ).rejects.toThrow(ServiceLookupError);
    expect(processingState.isProcessing).toBe(false);
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

  test('should catch missing method on turnCtx and dispatch SYSTEM_ERROR_OCCURRED_ID', async () => {
    processingState.startProcessing();
    const actor = new MockActor('actorF');
    const mockTurnContext = {
      getLogger: () => mockLogger,
      // getCommandProcessor is undefined
    };
    // Spy on handler.safeEventDispatcher.dispatch
    const spyDispatch = mockHandler.safeEventDispatcher.dispatch;
    mockHandler.getTurnContext.mockReturnValue(mockTurnContext);

    await expect(
      getServiceFromContext(
        processingState,
        mockTurnContext,
        'getCommandProcessor',
        'ICommandProcessor',
        actor.id
      )
    ).rejects.toThrow(ServiceLookupError);
    // _isProcessing should be set to false
    expect(processingState.isProcessing).toBe(false);
    // SYSTEM_ERROR_OCCURRED_ID dispatched via handler.safeEventDispatcher
    expect(spyDispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Invalid turnCtx'),
        details: expect.any(Object),
      })
    );
    expect(mockHandler.getSafeEventDispatcher).toHaveBeenCalled();
  });

  test('should catch service method returning null or undefined and dispatch SYSTEM_ERROR_OCCURRED_ID', async () => {
    processingState.startProcessing();
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

    await expect(
      getServiceFromContext(
        processingState,
        mockTurnContext,
        'getCommandProcessor',
        'ICommandProcessor',
        actor.id
      )
    ).rejects.toThrow(ServiceLookupError);
    expect(processingState.isProcessing).toBe(false);
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
