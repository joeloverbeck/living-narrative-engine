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
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(), subscribe: jest.fn()};


// --- Test Suite ---
describe('PlayerTurnHandler: _handleTurnEnd - Assertion Failure Cases', () => { // Updated description
    /** @type {PlayerTurnHandler} */
    let handler;
    /** @type {{id: string}} */
    const actor1 = {id: 'player-1'};
    const className = PlayerTurnHandler.name; // Get class name for error messages
    let constructorDebugMessage;


    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();
        mockUnsubscribe.mockClear(); // Clear unsubscribe mock too
        mockCommandInputPort.onCommand.mockClear(); // Clear onCommand mock

        constructorDebugMessage = `${className} initialized successfully with all dependencies.`;

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

        // Clear the constructor's debug log if we only want to check logs from the method under test
        // For these specific tests, we might want to ensure the constructor log *is* there,
        // and then check for other logs.
        // If tests become complex, consider mockLogger.debug.mockClear() here.
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
        // --- UPDATED EXPECTED WARNING for no active/awaited actor ---
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${testActorId} (status: success), but this actor is not the current active actor (undefined) nor explicitly awaited. Turn may have already ended or belongs to a different context. Minimal cleanup attempted.`;

        // --- Steps ---
        // Handler state: no current actor (#currentActor is null by default after construction).
        // #commandUnsubscribeFn is also null by default.

        // Clear any logs from constructor if we only care about _handleTurnEnd's direct logs for warn/error
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear(); // Clear constructor debug log for this specific assertion

        await handler._handleTurnEnd(testActorId, null); // error is null, so status is 'success'

        // --- Assertions ---
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // Check warning log
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage);

        // Check debug logs:
        // #_unsubscribeFromCommands is called. If #commandUnsubscribeFn is null, it logs nothing.
        // So, no "Unsubscribing..." message is expected.
        // We also don't expect the "No command unsubscribe function found..." as it's not in the code.
        mockLogger.debug.mock.calls.forEach(call => {
            expect(call[0]).not.toContain('Unsubscribing from command input');
            expect(call[0]).not.toContain('No command unsubscribe function found');
        });
        // More simply, if we expect *no* debug logs from this path in _handleTurnEnd / _unsubscribeFromCommands:
        expect(mockLogger.debug).not.toHaveBeenCalled();


        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Cleaning up active turn state'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled(); // No "Ending turn..."
    });

    // --- Case 2: Different turn active ---
    it('should log warning (from _handleTurnEnd guard) and attempt unsubscribe when called with the wrong actor ID', async () => {
        const wrongActorId = 'wrong-actor-id';
        // --- UPDATED EXPECTED WARNING for wrong actor ---
        const expectedWarningMessage = `${className}: _handleTurnEnd called for ${wrongActorId} (status: success), but this actor is not the current active actor (${actor1.id}) nor explicitly awaited. Turn may have already ended or belongs to a different context. Minimal cleanup attempted.`;

        // --- Setup ---
        // Start a turn for actor1 to set #currentActor and the private #commandUnsubscribeFn
        await handler.startTurn(actor1);
        // await new Promise(process.nextTick); // Allow async operations in startTurn to complete - usually not needed if startTurn's main path is sync for this part or mocks resolve immediately.

        // Verify startTurn setup (optional, but good for sanity)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1); // Confirms subscription happened


        // Clear mocks that were called during startTurn because we are interested in _handleTurnEnd calls
        mockLogger.debug.mockClear(); // Clear debug logs from constructor and startTurn
        mockLogger.warn.mockClear();
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
        mockUnsubscribe.mockClear(); // Clear this specifically if checking its call count from _handleTurnEnd

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

        // --- UPDATED Debug Log Expectation ---
        expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Should be called once for the unsubscribe
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Note: actorContext in the log is `this.#currentActor.id` at the time of #_unsubscribeFromCommands call in the guard path, which is actor1.id
            `${className}: Unsubscribing from command input for actor context '${actor1.id}'.`
        );


        // 3. No State Cleanup (for actor1, because the guard exits early):
        mockLogger.debug.mock.calls.forEach(call => {
            expect(call[0]).not.toContain('Cleaning up active turn state');
            expect(call[0]).not.toContain('Active turn state reset');
        });
        expect(mockLogger.warn).not.toHaveBeenCalledWith( // Warn for cleanup should not happen here
            expect.stringContaining(`#_cleanupTurnState called for`)
        );


        // 4. Logging:
        // Check ONLY the specific WARN log from the guard is present.
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMessage); // Check the exact message

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled(); // No 'Ending turn...' info log
    });
});

// --- FILE END ---