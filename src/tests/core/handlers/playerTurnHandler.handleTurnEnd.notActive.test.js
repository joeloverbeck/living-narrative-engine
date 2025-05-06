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
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(),  subscribe: jest.fn()};


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
        // --- MODIFIED EXPECTED WARNING ---
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${testActorId} (status: success), but current actor is null or does not match. Turn may have already ended or belongs to different handler context. Attempting cleanup for waiting mechanisms if ${testActorId} was the one being awaited.`;

        // --- Steps ---
        // Simulate handler state: no current actor
        handler["_currentActor"] = null; // Directly set for test isolation. This creates a public property.
                                         // The internal #currentActor remains as it was (null after construction).
        // Simulate no command subscription is active for the *private* field.
        // The internal #commandUnsubscribeFn is null by default after construction.
        // Setting handler["_commandUnsubscribeFn"] = null also creates/sets a public property.
        // The test relies on the *internal* #commandUnsubscribeFn being null for the specific log message.

        await handler._handleTurnEnd(testActorId, null); // error is null, so status is 'success'

        // --- Assertions ---
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // Check that #_unsubscribeFromCommands logic (for the *private* #commandUnsubscribeFn) was hit from the guard
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`${className}: No command unsubscribe function found or already unsubscribed.`)
        );

        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Cleaning up active turn state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled(); // No "Ending turn..."
    });

    // --- Case 2: Different turn active ---
    it('should log warning (from _handleTurnEnd guard) and attempt unsubscribe when called with the wrong actor ID', async () => {
        const wrongActorId = 'wrong-actor-id';
        // --- MODIFIED EXPECTED WARNING ---
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${wrongActorId} (status: success), but current actor is ${actor1.id} or does not match. Turn may have already ended or belongs to different handler context. Attempting cleanup for waiting mechanisms if ${wrongActorId} was the one being awaited.`;

        // --- Setup ---
        // Start a turn for actor1 to set #currentActor and the private #commandUnsubscribeFn
        await handler.startTurn(actor1);
        await new Promise(process.nextTick); // Allow async operations in startTurn to complete
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1); // Confirms subscription happened

        // --- REMOVED FAILING ASSERTION for handler["_commandUnsubscribeFn"] ---

        // Clear mocks that were called during startTurn because we are interested in _handleTurnEnd calls
        jest.clearAllMocks();
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Ensure it's still configured

        // --- Steps ---
        await handler._handleTurnEnd(wrongActorId, null); // Call with wrong ID, error is null (status: success)

        // --- Assertions ---

        // 1. No Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 2. Attempt Unsubscribe:
        // The guard in _handleTurnEnd calls #_unsubscribeFromCommands.
        // Since a turn was started for actor1, the private #commandUnsubscribeFn should exist and be called.
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // From #_unsubscribeFromCommands
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`${className}: Unsubscribing from command input for actor ${actor1.id}.`)
        );


        // 3. No State Cleanup (for actor1, because the guard exits early):
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Cleaning up active turn state for ${actor1.id}`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Active turn state reset for ${wrongActorId}`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining(`#_cleanupTurnState called for`)
        );

        // 4. Logging:
        // Check ONLY the specific WARN log from the guard is present.
        const warnCalls = mockLogger.warn.mock.calls;
        expect(warnCalls.length).toBe(1); // Ensure ONLY the guard's warning is logged
        expect(warnCalls[0][0]).toBe(expectedWarningMessage); // Check the exact message

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log
    });
});

// --- FILE END ---