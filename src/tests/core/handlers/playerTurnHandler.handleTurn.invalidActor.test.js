// src/tests/core/handlers/playerTurnHandler.handleTurn.invalidActor.test.js
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
// <<< ADDED Mock for CommandInputPort >>>
const mockCommandInputPort = {
    onCommand: jest.fn(), // Needed for constructor validation
};
// <<< END ADDED Mock >>>
const mockPlayerPromptService = {prompt: jest.fn()};
const mockCommandOutcomeInterpreter = {interpret: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(),  subscribe: jest.fn()};


// --- Test Suite ---
describe('PlayerTurnHandler: startTurn Called with Invalid Actor', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const className = PlayerTurnHandler.name; // Get class name for logs

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockCommandInputPort.onCommand.mockClear(); // Reset added mock

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
            commandInputPort: mockCommandInputPort, // <<< ADDED missing dependency
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(() => { // No need for async if destroy is sync
        // Minimal cleanup
        if (handler) {
            try {
                handler.destroy();
            } catch (e) {
                // suppress errors during cleanup
            } finally {
                handler = null;
            }
        }
    });

    // Define expected error message based on the implementation
    const expectedErrorMessage = `${className}: Actor must be a valid entity.`;

    /**
     * Helper function to assert that no core service/port mocks were called
     * after the initial validation failure in startTurn.
     */
    const assertNoCoreMocksCalled = () => {
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
        expect(mockCommandInputPort.onCommand).not.toHaveBeenCalled(); // Subscription shouldn't be attempted
        // Logger.error *is* expected, so we don't check it here.
    };

    it('should reject immediately if startTurn is called with null actor', async () => {
        // --- Steps & Assertions ---
        // Because startTurn is async, sync errors also cause promise rejection
        await expect(
            handler.startTurn(null)
        ).rejects.toThrow(expectedErrorMessage);

        // Check logger *after* confirming the rejection
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure it was logged exactly once
        expect(mockLogger.error).toHaveBeenCalledWith(`${className}: Attempted to start turn for an invalid actor.`);
        assertNoCoreMocksCalled();
    });

    it('should reject immediately if startTurn is called with an actor object without an ID', async () => {
        // --- Steps & Assertions ---
        await expect(
            handler.startTurn({})
        ).rejects.toThrow(expectedErrorMessage);

        // Check logger *after* confirming the rejection
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(`${className}: Attempted to start turn for an invalid actor.`);
        assertNoCoreMocksCalled();
    });

    it('should reject immediately if startTurn is called with an actor object with an empty ID', async () => {
        // --- Steps & Assertions ---
        await expect(
            handler.startTurn({id: ''})
        ).rejects.toThrow(expectedErrorMessage);

        // Check logger *after* confirming the rejection
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(`${className}: Attempted to start turn for an invalid actor.`);
        assertNoCoreMocksCalled();
    });
});
// --- FILE END ---