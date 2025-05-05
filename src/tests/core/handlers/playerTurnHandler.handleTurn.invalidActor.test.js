// src/tests/core/handlers/playerTurnHandler.handleTurn.invalidActor.test.js
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
describe('PlayerTurnHandler: startTurn Called with Invalid Actor', () => {
    /** @type {PlayerTurnHandler} */
    let handler;

    beforeEach(() => {
        // Reset mocks before each test
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
    const expectedErrorMessage = `${PlayerTurnHandler.name}: Actor must be a valid entity.`;

    /**
     * Helper function to assert that no core service/port mocks were called.
     */
    const assertNoCoreMocksCalled = () => {
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
        // Logger.error *is* expected, so we don't check it here.
    };

    // <<< Test description is correct, assertion pattern reverted >>>
    it('should reject immediately if startTurn is called with null actor', async () => { // Mark test as async
        // --- Steps & Assertions ---
        // Because startTurn is async, errors (even sync ones) cause promise rejection
        // <<< REVERTED Assertion: Use rejects for async function >>>
        await expect(
            // <<< UPDATED: Call startTurn >>>
            handler.startTurn(null)
        ).rejects.toThrow(expectedErrorMessage);

        // Check logger *after* confirming the rejection
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure it was logged exactly once
        expect(mockLogger.error).toHaveBeenCalledWith(`${PlayerTurnHandler.name}: Attempted to start turn for an invalid actor.`);
        assertNoCoreMocksCalled();
    });

    // <<< Test description is correct, assertion pattern reverted >>>
    it('should reject immediately if startTurn is called with an actor object without an ID', async () => { // Mark test as async
        // --- Steps & Assertions ---
        // <<< REVERTED Assertion: Use rejects for async function >>>
        await expect(
            // <<< UPDATED: Call startTurn >>>
            handler.startTurn({})
        ).rejects.toThrow(expectedErrorMessage);

        // Check logger *after* confirming the rejection
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(`${PlayerTurnHandler.name}: Attempted to start turn for an invalid actor.`);
        assertNoCoreMocksCalled();
    });

    // <<< Test description is correct, assertion pattern reverted >>>
    it('should reject immediately if startTurn is called with an actor object with an empty ID', async () => { // Mark test as async
        // --- Steps & Assertions ---
        // <<< REVERTED Assertion: Use rejects for async function >>>
        await expect(
            // <<< UPDATED: Call startTurn >>>
            handler.startTurn({ id: '' })
        ).rejects.toThrow(expectedErrorMessage);

        // Check logger *after* confirming the rejection
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(`${PlayerTurnHandler.name}: Attempted to start turn for an invalid actor.`);
        assertNoCoreMocksCalled();
    });
});
// --- FILE END ---