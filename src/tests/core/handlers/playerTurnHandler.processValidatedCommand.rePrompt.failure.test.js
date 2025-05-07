// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.rePrompt.failure.test.js
// --- FILE START (Entire file content as requested) ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjusted path
import TurnDirective from '../../../core/constants/turnDirectives.js'; // Adjusted path
import {TURN_ENDED_ID} from '../../../core/constants/eventIds.js'; // Import event ID

// --- Mock Dependencies ---
// (Mocks remain the same)
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
const mockPlayerPromptService = {prompt: jest.fn()};
const mockCommandOutcomeInterpreter = {interpret: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(), subscribe: jest.fn()};

// <<< ADDED: Mock for CommandInputPort >>>
const mockUnsubscribe = jest.fn(); // Mock the unsubscribe function
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribe), // onCommand returns the mock unsubscribe fn
};
// <<< END ADDED Mock >>>


// --- Test Suite ---
// UPDATED Description: Test what happens when command is successful and interpreter suggests RE_PROMPT
describe('PlayerTurnHandler: #_processValidatedCommand - Successful Command with RE_PROMPT Directive from Interpreter', () => {
    /** @type {PlayerTurnHandler} */
    let handler;

    // --- Test Data ---
    const mockActor = {id: 'player-1', name: 'WaitingActor'};
    // const mockPromptError = new Error('Prompt service failed on re-prompt'); // No longer used in this version
    const mockCommandResult = {
        success: true, // Key: command processing itself was successful
        turnEnded: false,
        message: 'Looked around.',
        actionResult: {actionId: 'look'}
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUnsubscribe.mockClear();
        mockCommandInputPort.onCommand.mockClear();

        // PlayerPromptService: Succeeds on first call (startTurn)
        // The second mock for failure is removed as it won't be called in this flow.
        mockPlayerPromptService.prompt.mockResolvedValueOnce(undefined);

        mockCommandProcessor.processCommand.mockResolvedValue(mockCommandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();
        // Mock for #waitForTurnEndEvent's subscription
        mockSafeEventDispatcher.subscribe.mockReturnValue(jest.fn()); // Return a dummy unsubscribe function


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
    });

    afterEach(async () => {
        if (handler) {
            try {
                handler.destroy();
            } catch (e) {
                // Suppress
            } finally {
                handler = null;
            }
        }
    });

    // UPDATED Test Description
    it('should process command, interpret RE_PROMPT, and then wait for TURN_ENDED_ID event instead of re-prompting', async () => {
        await handler.startTurn(mockActor);
        await new Promise(process.nextTick);

        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Initial prompt
        expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor);

        // Clear mocks called during startTurn to focus on command handling phase
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockPlayerPromptService.prompt.mockClear(); // Clear the startTurn call

        const commandString = 'look';
        const commandHandler = mockCommandInputPort.onCommand.mock.calls[0][0];
        await commandHandler(commandString);

        // --- Assertions for new behavior ---

        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandString);

        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // 3. Prompt Calls:
        //    Should NOT be called again after the initial one in startTurn.
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled(); // No second call

        // 4. Turn End Port Call:
        //    Should NOT be called directly in this flow path. The system is now WAITING.
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // 5. Logging:
        //    Error logs related to re-prompt failure should NOT be present.
        expect(mockLogger.error).not.toHaveBeenCalled();
        //    Info logs should reflect the new path
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`CommandProcessor SUCCEEDED for "${commandString}" by ${mockActor.id}`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`CommandOutcomeInterpreter processed. Received directive: '${TurnDirective.RE_PROMPT}' for actor ${mockActor.id}`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Proceeding to wait for '${TURN_ENDED_ID}' event from Rules Interpreter for actor ${mockActor.id}`)
        );

        // 6. Event Subscription for Turn End:
        //    Check that #waitForTurnEndEvent was called, which subscribes.
        expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));

        // Debug log for subscribing to TURN_ENDED_ID
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Subscribing to '${TURN_ENDED_ID}' for actor ${mockActor.id} and waiting.`)
        );


        // 7. Unsubscription Check:
        //    #commandUnsubscribeFn is NOT called in this path until the turn actually ends or is destroyed.
        //    The original onCommand handler (commandHandler) completes, but doesn't trigger turn end itself.
        expect(mockUnsubscribe).not.toHaveBeenCalled(); // Original command subscription remains active while waiting
    });
});

// --- FILE END ---