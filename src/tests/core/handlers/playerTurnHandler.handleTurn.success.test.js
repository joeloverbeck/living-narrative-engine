// src/tests/core/handlers/playerTurnHandler.handleTurn.success.test.js
// --- FILE START ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';

// --- Mock Dependencies ---
// (Existing mocks remain the same)
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
// <<< ADDED Mock for CommandInputPort >>>
// Mock the onCommand method to return a mock unsubscribe function
const mockUnsubscribe = jest.fn();
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribe), // Return the mock unsubscribe function
};
// <<< END ADDED Mock >>>
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
describe('PlayerTurnHandler: startTurn Initiation and Validation', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = {id: 'player-1', name: 'Tester'}; // Example mock actor
    const className = PlayerTurnHandler.name; // Get class name for logs

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
            commandInputPort: mockCommandInputPort, // <<< ADDED missing dependency
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
                // Ensure handler.destroy() is called, which should call the unsubscribe function
                handler.destroy();
            }
        } catch (e) {
            // suppress errors during cleanup
        } finally {
            handler = null;
        }
        // Optional: Check if unsubscribe was called during cleanup if a turn was started
        // if (mockCommandInputPort.onCommand.mock.calls.length > 0) {
        //     expect(mockUnsubscribe).toHaveBeenCalled();
        // }
    });

    it('should initiate the turn, subscribe to commands, set actor, call prompt, and NOT end the turn', async () => {
        // --- Setup ---
        // PlayerPromptService.prompt is mocked to resolve in beforeEach
        // commandInputPort.onCommand is mocked to return mockUnsubscribe

        // --- Steps ---
        await handler.startTurn(mockActor);

        // 3. Allow microtasks (like the internal prompt call) to settle
        await new Promise(process.nextTick);

        // --- Assertions ---

        // 1. Command Subscription: Verify onCommand was called exactly once.
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        // Verify it was called with a function (the bound handler method)
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(expect.any(Function));

        // 2. Internal State (Conceptual): Verified indirectly by prompt call.

        // 3. Prompt Service Call: Verifies the main action of successful initiation.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 4. Promise State: Implicitly tested by successfully awaiting startTurn.

        // 5. Turn Not Ended: Verify no turn-ending actions occurred during initiation.
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 6. Other Mocks Not Called:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();

        // 7. Unsubscribe NOT called yet
        expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should throw an error if startTurn is called with an invalid actor', async () => {
        const expectedError = `${className}: Actor must be a valid entity.`;
        await expect(handler.startTurn(null)).rejects.toThrow(expectedError);
        await expect(handler.startTurn({})).rejects.toThrow(expectedError);

        // Verify logging and side effects
        expect(mockLogger.error).toHaveBeenCalledWith(`${className}: Attempted to start turn for an invalid actor.`);
        expect(mockCommandInputPort.onCommand).not.toHaveBeenCalled(); // Subscription shouldn't happen
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
    });

    it('should throw an error if startTurn is called while another turn is active', async () => {
        const firstActor = {id: 'player-1'};
        const secondActor = {id: 'player-2'};

        // Start the first turn and wait for initiation
        await handler.startTurn(firstActor);
        await new Promise(process.nextTick); // Allow internal prompt call to settle

        // Verify the first subscription and prompt happened
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(firstActor);

        // Attempt to start a second turn - expect immediate rejection
        const expectedError = `${className}: Attempted to start a new turn for ${secondActor.id} while turn for ${firstActor.id} is already in progress.`;
        await expect(handler.startTurn(secondActor)).rejects.toThrow(expectedError);

        // Assertions
        expect(mockLogger.error).toHaveBeenCalledWith(expectedError);
        // Ensure subscription/prompt were only called for the first actor
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1); // Still only 1 call total
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Still only 1 call total
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
    });

    // <<< NEW TEST for subscription failure >>>
    it('should handle and re-throw errors if command subscription fails', async () => {
        const actor = {id: 'player-fail-sub'};
        const subscriptionError = new Error('Subscription failed!');
        mockCommandInputPort.onCommand.mockImplementation(() => {
            throw subscriptionError; // Simulate subscription throwing an error
        });
        // OR simulate returning null/undefined if that's a possible failure mode
        // mockCommandInputPort.onCommand.mockReturnValue(null);
        // const subscriptionError = new Error('CommandInputPort.onCommand did not return a valid unsubscribe function.');


        // Expect startTurn to reject with the subscription error
        await expect(handler.startTurn(actor)).rejects.toThrow(subscriptionError.message);

        // Verify logging and side effects
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: Critical error during turn initiation for ${actor.id}`), subscriptionError);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1); // Attempted subscription
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled(); // Prompt shouldn't happen if sub fails
        // Check if _handleTurnEnd was called due to the error during initiation
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(actor.id, false); // Should signal failure

        // Reset mock implementation for other tests if needed, although beforeEach handles it
        mockCommandInputPort.onCommand.mockImplementation(() => mockUnsubscribe);
    });

    // <<< NEW TEST for prompt failure during initiation >>>
    it('should handle errors if the initial prompt fails during startTurn', async () => {
        const actor = {id: 'player-fail-prompt'};
        const promptError = new Error('Initial Prompt Failed!');
        mockPlayerPromptService.prompt.mockRejectedValue(promptError); // Make prompt fail

        // Expect startTurn to reject because the internal error handling in startTurn re-throws
        // Note: This assumes startTurn's catch block correctly calls _handleTurnEnd and re-throws.
        await expect(handler.startTurn(actor)).rejects.toThrow(promptError.message);

        // Verify logging and side effects
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1); // Subscription should still happen first
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Prompt was attempted
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(actor);
        // Check if _handleTurnEnd was called due to the error during initiation
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: Critical error during turn initiation for ${actor.id}`), promptError);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(actor.id, false); // Should signal failure
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // Unsubscribe should be called during _handleTurnEnd

        // Reset mock implementation for other tests
        mockPlayerPromptService.prompt.mockResolvedValue();
    });

});
// --- FILE END ---