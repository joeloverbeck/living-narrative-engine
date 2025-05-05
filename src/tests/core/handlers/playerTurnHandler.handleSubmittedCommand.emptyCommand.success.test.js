// src/tests/core/handlers/playerTurnHandler.handleSubmittedCommand.emptyCommand.success.test.js
// --- FILE START (Entire file content as requested) ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path if needed

// --- Mock Dependencies ---
// Standard Mocks (copied for consistency)
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

// <<< ADDED: Mock for CommandInputPort and its unsubscribe function >>>
const mockUnsubscribe = jest.fn();
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribe),
};
// <<< END ADDED Mock >>>

// --- Test Suite ---
describe('PlayerTurnHandler: _handleSubmittedCommand - Empty Command Handling', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = {id: 'player-1', name: 'Tester'}; // Example mock actor
    const className = PlayerTurnHandler.name; // For log messages

    beforeEach(() => {
        // Reset all mocks *before* each test run
        jest.clearAllMocks();
        // <<< Reset added mocks too >>>
        mockUnsubscribe.mockClear();
        mockCommandInputPort.onCommand.mockClear();

        // Configure default mock behaviors
        mockPlayerPromptService.prompt.mockResolvedValue(); // Assume prompt succeeds by default
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Assume notification works if called

        // Instantiate the handler with all mocks
        // <<< UPDATED: Added commandInputPort >>>
        handler = new PlayerTurnHandler({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            promptOutputPort: mockPromptOutputPort,
            turnEndPort: mockTurnEndPort,
            commandInputPort: mockCommandInputPort, // <<< ADDED Dependency
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(async () => {
        // Ensure graceful cleanup if a turn was somehow left active
        try {
            if (handler) {
                // Call destroy - it handles ending active turns if needed
                handler.destroy();
                // Allow potential async operations in destroy to settle if necessary
                await new Promise(process.nextTick);
            }
        } catch (e) {
            // console.warn("Suppressed error during afterEach cleanup:", e?.message);
        } finally {
            handler = null;
        }
    });

    // Test cases for empty/whitespace commands leading to re-prompt
    it.each([
        {command: '', description: 'empty string'},
        {command: ' ', description: 'whitespace string'},
        {command: '\t\n ', description: 'mixed whitespace string'},
    ])('should re-prompt the actor via PlayerPromptService when command is $description', async ({command}) => {
        // --- Setup ---
        // 1. Start a turn to establish active state and subscription
        await handler.startTurn(mockActor);
        // 2. Allow the initial async prompt within startTurn to resolve
        await new Promise(process.nextTick);
        // 3. Verify the *initial* prompt occurred (sanity check)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);
        // 4. Clear mocks to isolate calls made *only* by _handleSubmittedCommand
        jest.clearAllMocks();
        // 5. Re-configure prompt mock (cleared above) for the re-prompt step
        mockPlayerPromptService.prompt.mockResolvedValue();

        // --- Steps ---
        // 1. Call the method under test with the empty/whitespace command string
        // <<< UPDATED: Pass command string directly >>>
        await handler._handleSubmittedCommand(command);

        // --- Assertions ---
        // 1. Re-Prompt Call:
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // The re-prompt
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 2. No Other Calls:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled(); // Turn should NOT end
        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();

        // 3. Logging:
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Received empty command string. Re-prompting actor ${mockActor.id}.`
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test case for handling empty command when no turn is active
    it('should not re-prompt and log warning if no turn is active when _handleSubmittedCommand receives empty command', async () => {
        // --- Setup ---
        // No turn is started. Handler exists, mocks are cleared in beforeEach.
        // #currentActor is null, #commandUnsubscribeFn is null.

        // --- Steps ---
        // <<< UPDATED: Pass command string directly >>>
        await handler._handleSubmittedCommand(''); // Accessing protected method

        // --- Assertions ---
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Warning about no active turn
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Received submitted command but no player turn is active. Ignoring.`
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        // <<< UPDATED: Check debug log for receiving command >>>
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `${className}: Received submitted command via subscription: ""` // Empty string received
        );
    });

    // Test case for handling errors during the re-prompt itself
    it('should handle errors during the re-prompt gracefully, log errors, and signal turn end failure via TurnEndPort', async () => {
        // --- Setup ---
        // 1. Start a turn
        await handler.startTurn(mockActor);
        // 2. Allow initial prompt to complete
        await new Promise(process.nextTick);
        // 3. Verify initial prompt
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);

        // 4. Reset mocks to isolate calls during the specific step
        jest.clearAllMocks();

        // 5. Configure PlayerPromptService to REJECT the *next* call (the re-prompt)
        const rePromptError = new Error('Test: Failed to re-prompt');
        mockPlayerPromptService.prompt.mockRejectedValueOnce(rePromptError);
        // 6. Assume turn end notification itself works when called by the handler's error path
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();
        // 7. Mock unsubscribe needed for _handleTurnEnd path
        mockCommandInputPort.onCommand.mockReturnValue(mockUnsubscribe); // Ensure unsubscribe fn exists for _handleTurnEnd


        // --- Steps ---
        // <<< UPDATED: Pass command string directly >>>
        const handleCommandPromise = handler._handleSubmittedCommand(' '); // Use whitespace command

        // --- Assertions ---
        // 1. _handleSubmittedCommand completed (error handled internally by #_promptPlayerForAction):
        await expect(handleCommandPromise).resolves.toBeUndefined();

        // 2. Re-Prompt Attempt:
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Attempted the re-prompt
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 3. Logging:
        // Check warning for the empty command triggering the re-prompt attempt
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Received empty command string. Re-prompting actor ${mockActor.id}.`)
        );
        // Check error log from #_promptPlayerForAction's catch block (which handles the failure)
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // ONLY this error log
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`${className}: PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${rePromptError.message}`),
            rePromptError
        );
        // Check info log from #_promptPlayerForAction's catch block signalling turn end
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Signalling FAILED turn end for ${mockActor.id} due to prompt error.`)
        );
        // Check the failure warning log from _handleTurnEnd (called by #_promptPlayerForAction)
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Turn for ${mockActor.id} ended with failure. Reason: ${rePromptError.message}`)
        );
        // Check total warning count (should be 2: empty command + turn failure reason)
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);

        // 4. Turn End Triggered Due to Re-Prompt Error:
        // Verify TurnEndPort was notified of failure (called by _handleTurnEnd via #_promptPlayerForAction).
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // `false` indicates failure

        // 5. Unsubscribe Attempted:
        // Verify unsubscribe was called as part of the _handleTurnEnd sequence triggered by the error.
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

        // 6. No Other Calls:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
    });

});
// --- FILE END ---