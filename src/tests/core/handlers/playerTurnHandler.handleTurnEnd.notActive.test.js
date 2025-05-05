// src/tests/core/handlers/playerTurnHandler.handleTurnEnd.notActive.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as needed

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
describe('PlayerTurnHandler: _handleTurnEnd - Assertion Failure Cases', () => { // Updated description
    /** @type {PlayerTurnHandler} */
    let handler;
    /** @type {{id: string}} */
    const actor1 = { id: 'player-1' };
    const className = PlayerTurnHandler.name; // Get class name for error messages

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

        // Mock defaults needed for some tests in this suite
        mockPlayerPromptService.prompt.mockResolvedValue(undefined);
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();

    });

    afterEach(async () => { // Make async
        // Ensure graceful cleanup
        if (handler) {
            try {
                await handler.destroy();
            } catch (e) {
                // Suppress errors during cleanup
            } finally {
                handler = null;
            }
        }
    });

    // --- Case 1: No turn active ---
    // <<< UPDATED Test Description >>>
    it('should log warning (from _handleTurnEnd catch) and do nothing else when called with no active turn', async () => {
        const testActorId = 'some-actor-id';
        // Define the message embedded within the warning log
        const expectedAssertionErrorMessage = `${className}: Assertion Failed - Turn is not active. Expected actor '${testActorId}' but no turn is in progress.`;
        // Define the full warning log message expected from _handleTurnEnd's catch block
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${testActorId} (status: success), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${expectedAssertionErrorMessage}`;

        // --- Steps ---
        // 1. Call _handleTurnEnd when no turn is active (pass null error = success status)
        await handler._handleTurnEnd(testActorId, null);

        // --- Assertions ---

        // 1. No Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 2. No Promise Change: N/A

        // 3. No State Change / Cleanup:
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Cleaning up actor reference'));

        // 4. Logging:
        // <<< REMOVED: Check for logger.error >>>
        // expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // expect(mockLogger.error).toHaveBeenCalledWith(expectedAssertionErrorMessage);

        // Expect ONLY the WARN log from the catch block in _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage);

        // No other logs expected
        expect(mockLogger.error).not.toHaveBeenCalled(); // Explicitly check error wasn't called
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log
    });

    // --- Case 2: Different turn active ---
    // <<< UPDATED Test Description >>>
    it('should log warning (from _handleTurnEnd catch) and do nothing else when called with the wrong actor ID', async () => {
        const wrongActorId = 'wrong-actor-id';
        // Define the message embedded within the warning log
        const expectedAssertionErrorMessage = `${className}: Assertion Failed - Turn is not active for the correct actor. Expected '${wrongActorId}' but current actor is '${actor1.id}'.`;
        // Define the full warning log message expected from _handleTurnEnd's catch block
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${wrongActorId} (status: success), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${expectedAssertionErrorMessage}`;

        // <<< REMOVED turnPromise and state tracking >>>
        // let turnPromise;
        // let turnPromiseState = 'pending';

        // --- Setup ---
        // Configure PlayerPromptService is done in beforeEach

        // Start turn for actor1 and wait for initiation
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(actor1);

        // <<< REMOVED turnPromise handling >>>
        // turnPromise = handler.handleTurn(actor1);
        // turnPromise
        //     .then(() => { turnPromiseState = 'resolved'; })
        //     .catch(() => { turnPromiseState = 'rejected'; });

        // Allow the initial async prompt call within startTurn to complete
        // <<< UPDATED: Use nextTick >>>
        await new Promise(process.nextTick);

        // Sanity check: ensure initial prompt happened
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actor1);
        // Clear mocks after setup phase
        jest.clearAllMocks();
        // Reconfigure mocks if needed after clear (notifyTurnEnded already configured in beforeEach)
        // mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Reconfigure if cleared


        // --- Steps ---
        // 1. Call _handleTurnEnd with the wrong actor ID (pass null error = success status)
        await handler._handleTurnEnd(wrongActorId, null);

        // --- Assertions ---

        // 1. No Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 2. No Promise Change:
        // <<< REMOVED: Promise state check >>>
        // await new Promise(resolve => setTimeout(resolve, 0));
        // expect(turnPromiseState).toBe('pending');
        // Also check no settlement logs occurred
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Resolving turn promise'));
        // Ensure the 'Rejecting turn promise' warn log wasn't called (only the assertion fail warn)
        // <<< Updated check: Expect only ONE specific warning >>>
        const warnCalls = mockLogger.warn.mock.calls;
        expect(warnCalls.length).toBe(1); // Should only be the assertion failure warning
        expect(warnCalls[0][0]).toBe(expectedWarningMessage); // Check the exact warning message


        // 3. No State Change: (Internal state #currentActor remains actor1)
        // No cleanup log should have occurred for actor1.
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Cleaning up active turn state for ${actor1.id}`));


        // 4. Logging:
        // <<< REMOVED: Check for logger.error >>>
        // expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // expect(mockLogger.error).toHaveBeenCalledWith(expectedAssertionErrorMessage);

        // Expect ONLY the WARN log from the catch block in _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Already checked calls.length above, but keep for clarity
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage);

        // No other logs expected
        expect(mockLogger.error).not.toHaveBeenCalled(); // Explicitly check error wasn't called
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log
    });
});

// --- FILE END ---