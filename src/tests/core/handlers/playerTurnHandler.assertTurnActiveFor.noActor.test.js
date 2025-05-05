// src/tests/core/handlers/playerTurnHandler.assertTurnActiveFor.noActor.test.js
// --- FILE START (Entire file content as requested) ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
// Adjust the path according to your project structure
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';

// --- Mock Dependencies ---
// (Mocks remain the same)
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockActionDiscoverySystem = {getValidActions: jest.fn()};
const mockCommandProcessor = {processCommand: jest.fn()};
const mockWorldContext = {getLocationOfEntity: jest.fn()};
const mockEntityManager = {getEntityInstance: jest.fn()};
const mockGameDataRepository = {getActionDefinition: jest.fn()};
const mockPromptOutputPort = {prompt: jest.fn()};
const mockTurnEndPort = {notifyTurnEnded: jest.fn()};
const mockPlayerPromptService = {prompt: jest.fn()};
const mockCommandOutcomeInterpreter = {interpret: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn()};

// <<< ADDED: Mock for CommandInputPort >>>
const mockUnsubscribe = jest.fn(); // Mock the unsubscribe function
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribe), // onCommand returns the mock unsubscribe fn
};
// <<< END ADDED Mock >>>


// --- Test Suite ---
describe('PlayerTurnHandler: _handleTurnEnd - Assertion Failure: No Actor Active', () => { // Slightly updated description
    /** @type {PlayerTurnHandler} */
    let handler;
    const className = PlayerTurnHandler.name; // Get class name for error messages
    const testActorId = 'any-actor-id';

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();
        // <<< Reset added mock too >>>
        mockUnsubscribe.mockClear();
        mockCommandInputPort.onCommand.mockClear();


        // Instantiate the handler with all mocks
        // <<< UPDATED: Added commandInputPort >>>
        handler = new PlayerTurnHandler({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            promptOutputPort: mockPromptOutputPort,
            turnEndPort: mockTurnEndPort,
            commandInputPort: mockCommandInputPort, // <<< ADDED Dependency
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });

        // Handler starts idle (#currentActor is null).
        // Crucially, #commandUnsubscribeFn is also null.
    });

    afterEach(() => { // No need for async here as destroy likely won't do much
        // Cleanup the handler instance
        if (handler) {
            try {
                handler.destroy(); // Call destroy for potential cleanup
            } catch (e) {
                // Ignore potential errors during cleanup in tests
            } finally {
                handler = null;
            }
        }
    });

    // <<< UPDATED Test Description >>>
    it('should log warning (from _handleTurnEnd guard) and do nothing else when called while no turn is active', async () => { // Updated description
        // Define the message embedded within the warning log
        const expectedAssertionErrorMessage = `${className}: Assertion Failed - Turn is not active. Expected actor '${testActorId}' but no turn is in progress.`;
        // Define the full warning log message expected from _handleTurnEnd's catch block
        // <<< UPDATED expectedWarningMessage to include status derived from input args (null error = success) >>>
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${testActorId} (status: success), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${expectedAssertionErrorMessage}`;


        // --- Steps ---
        // 1. Call _handleTurnEnd when no turn is active (#currentActor is null, #commandUnsubscribeFn is null).
        //    Pass 'null' error -> status: success
        await handler._handleTurnEnd(testActorId, null);

        // --- Assertions ---

        // 1. No Error Thrown Upwards:
        //    _handleTurnEnd catches the internal assertion error. (Handled by Jest not failing the test)

        // 2. Logging:
        // Expect ONLY the WARN log from the guard block in _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage); // Check the exact warning message

        // 3. No Port Call:
        //    Assertion failed early.
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 4. Minimal State Cleanup Attempt:
        //    Assertion failed early, _unsubscribeFromCommands is called, but since
        //    #commandUnsubscribeFn is null, the actual unsubscribe function isn't executed.
        // <<< UPDATED ASSERTION >>>
        expect(mockUnsubscribe).not.toHaveBeenCalled(); // Verify unsubscribe was NOT attempted

        // 5. No Other Logs:
        //    Ensure no other unexpected logs were called.
        expect(mockLogger.error).not.toHaveBeenCalled(); // Explicitly check error wasn't called
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log expected
        // Check debug logs - only the "no function found" log should appear
    });
});

// --- FILE END ---