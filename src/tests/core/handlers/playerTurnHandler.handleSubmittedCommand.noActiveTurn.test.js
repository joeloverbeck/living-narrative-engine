// src/tests/core/handlers/playerTurnHandler.handleSubmittedCommand.noActiveTurn.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as needed

// --- Mock Dependencies ---
// Standard Mocks (consistent with other V2 tests)
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockActionDiscoverySystem = {
    getValidActions: jest.fn(), // Needed for constructor validation
};
const mockCommandProcessor = {
    processCommand: jest.fn(),
};
const mockWorldContext = {
    getLocationOfEntity: jest.fn(), // Needed for constructor validation
};
const mockEntityManager = {
    getEntityInstance: jest.fn(), // Needed for constructor validation
};
const mockGameDataRepository = {
    getActionDefinition: jest.fn(), // Needed for constructor validation
};
const mockPromptOutputPort = {
    prompt: jest.fn(),
};
const mockTurnEndPort = {
    notifyTurnEnded: jest.fn(),
};
const mockPlayerPromptService = {
    prompt: jest.fn(),
};
const mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
};
const mockSafeEventDispatcher = {
    dispatchSafely: jest.fn(),
};

// --- Test Suite ---
describe('PlayerTurnHandler: _handleSubmittedCommand Called When No Active Turn', () => { // <-- Updated describe title slightly
    /** @type {PlayerTurnHandler} */
    let handler;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Instantiate the handler with all mocks
        // Handler will be in its initial idle state (#currentActor is null)
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
    });

    afterEach(() => {
        // Minimal cleanup, though no active turn should exist here.
        try {
            handler.destroy(); // Call destroy for consistency.
        } catch (e) {
            // suppress errors during cleanup
        }
    });

    it('should ignore the command and log a warning if called when no turn is active', async () => {
        // --- Setup ---
        const commandData = { command: 'look' };
        // The handler is initialized in beforeEach, #currentActor is null.

        // --- Steps ---
        // Invoke the internal method using bracket notation with the underscore prefix.
        // It's async, so await it.
        await handler['_handleSubmittedCommand'](commandData); // <-- Renamed call target

        // --- Assertions ---

        // 1. No Core Calls: Verify that core services were NOT interacted with.
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        // Check other potentially related mocks as well
        expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
        expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();

        // 2. Logging: Verify the specific warning message was logged.
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Received submitted command but no player turn is active. Ignoring.')
        );

        // 3. Other Logs: Ensure no other logs (like info/error related to processing) occurred.
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received submitted command. Payload:'));

    });
});
// --- FILE END ---