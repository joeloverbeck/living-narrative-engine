// src/tests/core/handlers/playerTurnHandler.handleTurnEnd.notActive.test.js
// --- FILE START ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as needed

// --- Mock Dependencies ---
// (Existing mocks remain the same)
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
const mockUnsubscribe = jest.fn(); // Need the unsubscribe mock as well for consistency if startTurn is called
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribe), // Needed for constructor and startTurn if called
};
const mockPlayerPromptService = {prompt: jest.fn()};
const mockCommandOutcomeInterpreter = {interpret: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn()};


// --- Test Suite ---
describe('PlayerTurnHandler: _handleTurnEnd - Assertion Failure Cases', () => { // Updated description
    /** @type {PlayerTurnHandler} */
    let handler;
    /** @type {{id: string}} */
    const actor1 = {id: 'player-1'};
    const className = PlayerTurnHandler.name; // Get class name for error messages

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();
        mockUnsubscribe.mockClear(); // Clear unsubscribe mock too
        mockCommandInputPort.onCommand.mockClear(); // Clear onCommand mock

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
            commandInputPort: mockCommandInputPort,
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
                // Destroy should handle unsubscribing if needed
                handler.destroy();
            } catch (e) {
                // Suppress errors during cleanup
            } finally {
                handler = null;
            }
        }
    });

    // --- Case 1: No turn active ---
    it('should log warning (from _handleTurnEnd guard) and attempt unsubscribe when called with no active turn', async () => {
        const testActorId = 'some-actor-id';
        const expectedAssertionErrorMessage = `${className}: Assertion Failed - Turn is not active. Expected actor '${testActorId}' but no turn is in progress.`;
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${testActorId} (status: success), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${expectedAssertionErrorMessage}`;

        // --- Steps ---
        await handler._handleTurnEnd(testActorId, null);

        // --- Assertions ---
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No command unsubscribe function found'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Cleaning up active turn state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    // --- Case 2: Different turn active ---
    it('should log warning (from _handleTurnEnd guard) and attempt unsubscribe when called with the wrong actor ID', async () => {
        const wrongActorId = 'wrong-actor-id';
        const expectedAssertionErrorMessage = `${className}: Assertion Failed - Turn is not active for the correct actor. Expected '${wrongActorId}' but current actor is '${actor1.id}'.`;
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${wrongActorId} (status: success), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${expectedAssertionErrorMessage}`;

        // --- Setup ---
        await handler.startTurn(actor1);
        await new Promise(process.nextTick);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        jest.clearAllMocks();
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Ensure it's still configured

        // --- Steps ---
        await handler._handleTurnEnd(wrongActorId, null);

        // --- Assertions ---

        // 1. No Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 2. Attempt Unsubscribe:
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Unsubscribing from command input'));

        // 3. No State Cleanup (for actor1):
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Cleaning up active turn state for ${actor1.id}`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Active turn state reset for ${wrongActorId}`));
        // <<< REMOVED Incorrect check for cleanup warning >>>
        // <<< This check remains correct: #_cleanupTurnState should not be called by _handleTurnEnd when assertion fails >>>
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining(`#_cleanupTurnState called for`)
        );

        // 4. Logging:
        // Check ONLY the specific WARN log from the assertion failure is present.
        const warnCalls = mockLogger.warn.mock.calls;
        expect(warnCalls.length).toBe(1); // Ensure ONLY the assertion warning is logged
        expect(warnCalls[0][0]).toBe(expectedWarningMessage); // Check the exact message

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log
    });
});

// --- FILE END ---