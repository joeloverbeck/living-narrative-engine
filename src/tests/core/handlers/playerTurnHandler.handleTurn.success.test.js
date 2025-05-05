// src/tests/core/handlers/playerTurnHandler.handleTurn.success.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';

// --- Mock Dependencies ---
// (Mocks remain the same)
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockActionDiscoverySystem = {
    getValidActions: jest.fn(),
};
const mockCommandProcessor = {
    processCommand: jest.fn(),
};
const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
};
const mockEntityManager = {
    getEntityInstance: jest.fn(),
};
const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
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
// <<< UPDATED Suite Description >>>
describe('PlayerTurnHandler: startTurn Initiation and Validation', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = { id: 'player-1', name: 'Tester' }; // Example mock actor

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

        // Configure PlayerPromptService.prompt to succeed by default for this suite
        mockPlayerPromptService.prompt.mockResolvedValue();
        // Assume TurnEndPort notification works if called
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();
    });

    afterEach(async () => {
        // Ensure graceful cleanup if a turn was somehow left active
        try {
            if (handler) {
                await handler.destroy(); // Call destroy to trigger cleanup if needed
            }
        } catch (e) {
            // suppress errors during cleanup
        } finally {
            handler = null;
        }
    });

    // <<< UPDATED Test Description >>>
    it('should initiate the turn, set internal actor, call PlayerPromptService.prompt, and NOT end the turn', async () => {
        // --- Setup ---
        // PlayerPromptService.prompt is mocked to resolve in beforeEach

        // --- Steps ---
        // 1. Define mockActor (defined above)
        // 2. Call startTurn and await its completion (initiation phase)
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(mockActor);

        // 3. Allow microtasks (like the internal prompt call) to settle
        await new Promise(process.nextTick);

        // --- Assertions ---

        // 1. Internal State (Conceptual): Verified indirectly by prompt call.

        // 2. Prompt Service Call:
        // Crucial: Verifies the main action of successful initiation.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 3. Promise State:
        // The promise returned by startTurn should have resolved successfully as initiation completed.
        // (We implicitly tested this by successfully awaiting it without error).

        // 4. Turn Not Ended:
        // Crucial: Verify no turn-ending actions occurred during initiation.
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 5. Other Mocks Not Called:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        // PlayerPromptService calls these internally, so they might be called IF prompt was called.
        // If we strictly test ONLY startTurn's direct actions, these might be omitted or checked differently.
        // expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled(); // Called by PlayerPromptService
        // expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled(); // Called by PlayerPromptService

        // <<< REMOVED: Cleanup/destroy/rejection check - no longer applicable/needed for this test's goal >>>
        // await handler.destroy();
        // await expect(turnPromise).rejects.toThrow('PlayerTurnHandler destroyed during turn.');
    });

    // <<< UPDATED Test Description >>>
    it('should throw an error if startTurn is called with an invalid actor', async () => {
        // <<< UPDATED: Call startTurn >>>
        // Expect startTurn itself to throw synchronously for invalid input
        const expectedError = `${PlayerTurnHandler.name}: Actor must be a valid entity.`;
        await expect(handler.startTurn(null)).rejects.toThrow(expectedError);
        await expect(handler.startTurn({})).rejects.toThrow(expectedError);

        // Verify logging and side effects
        expect(mockLogger.error).toHaveBeenCalledWith(`${PlayerTurnHandler.name}: Attempted to start turn for an invalid actor.`);
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled(); // Ensure turn end wasn't triggered
    });

    // <<< UPDATED Test Description >>>
    it('should throw an error if startTurn is called while another turn is active', async () => {
        const firstActor = { id: 'player-1' };
        const secondActor = { id: 'player-2' };

        // Start the first turn and wait for initiation
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(firstActor);
        await new Promise(process.nextTick); // Allow internal prompt call to settle

        // Verify the first prompt happened
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(firstActor);

        // Attempt to start a second turn - expect immediate rejection
        // <<< UPDATED: Call startTurn >>>
        const expectedError = `${PlayerTurnHandler.name}: Attempted to start a new turn for ${secondActor.id} while turn for ${firstActor.id} is already in progress.`;
        await expect(handler.startTurn(secondActor)).rejects.toThrow(expectedError);

        // Assertions
        expect(mockLogger.error).toHaveBeenCalledWith(expectedError);
        // Ensure prompt was only called for the first actor (no second call attempt)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Still only 1 call total
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled(); // Turn end should not have been called

        // <<< REMOVED: Cleanup/destroy/rejection check - no longer applicable/needed for this test's goal >>>
        // await handler.destroy();
        // await expect(firstTurnPromise).rejects.toThrow('PlayerTurnHandler destroyed during turn.');
    });

});
// --- FILE END ---