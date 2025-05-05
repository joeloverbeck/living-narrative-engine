// src/tests/core/handlers/playerTurnHandler.assertTurnActiveFor.noActor.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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
const mockActionDiscoverySystem = { getValidActions: jest.fn() };
const mockCommandProcessor = { processCommand: jest.fn() };
const mockWorldContext = { getLocationOfEntity: jest.fn() };
const mockEntityManager = { getEntityInstance: jest.fn() };
const mockGameDataRepository = { getActionDefinition: jest.fn() };
const mockPromptOutputPort = { prompt: jest.fn() };
const mockTurnEndPort = { notifyTurnEnded: jest.fn() };
const mockPlayerPromptService = { prompt: jest.fn() };
const mockCommandOutcomeInterpreter = { interpret: jest.fn() };
const mockSafeEventDispatcher = { dispatchSafely: jest.fn() };

// --- Test Suite ---
describe('PlayerTurnHandler: _handleTurnEnd - Assertion Failure: No Actor Active', () => { // Slightly updated description
    /** @type {PlayerTurnHandler} */
    let handler;
    const className = PlayerTurnHandler.name; // Get class name for error messages
    const testActorId = 'any-actor-id';

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();

        // Instantiate the handler with all mocks
        handler = new PlayerTurnHandler({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            promptOutputPort: mockPromptOutputPort,
            turnEndPort: mockTurnEndPort,
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });

        // Handler starts idle (#currentActor is null).
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
    it('should log warning (from _handleTurnEnd catch) and do nothing else when called while no turn is active', async () => {
        // Define the message embedded within the warning log
        const expectedAssertionErrorMessage = `${className}: Assertion Failed - Turn is not active. Expected actor '${testActorId}' but no turn is in progress.`;
        // Define the full warning log message expected from _handleTurnEnd's catch block
        // <<< UPDATED expectedWarningMessage to include status derived from input args (null error = success) >>>
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${testActorId} (status: success), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${expectedAssertionErrorMessage}`;


        // --- Steps ---
        // 1. Call _handleTurnEnd when no turn is active (#currentActor is null).
        //    Pass 'null' error and 'false' isRejection (default) -> status: success
        await handler._handleTurnEnd(testActorId, null);

        // --- Assertions ---

        // 1. No Error Thrown Upwards:
        //    _handleTurnEnd catches the internal assertion error.

        // 2. Logging:
        // <<< REMOVED: Check for logger.error >>>
        // expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // expect(mockLogger.error).toHaveBeenCalledWith(expectedAssertionErrorMessage);

        // Expect ONLY the WARN log from the catch block in _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage); // Check the exact warning message


        // 3. No Port Call:
        //    Assertion failed early.
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 4. No State Cleanup Attempt:
        //    Assertion failed early.
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Cleaning up actor reference'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Notifying TurnEndPort'));

        // 5. No Other Logs:
        //    Ensure no other unexpected logs were called.
        expect(mockLogger.error).not.toHaveBeenCalled(); // Explicitly check error wasn't called
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log expected
    });
});

// --- FILE END ---