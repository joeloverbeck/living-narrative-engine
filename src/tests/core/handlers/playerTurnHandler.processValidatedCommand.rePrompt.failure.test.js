// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.rePrompt.failure.test.js
// --- FILE START (Entire file content as requested) ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjusted path
import TurnDirective from '../../../core/constants/turnDirectives.js'; // Adjusted path
import {TURN_ENDED_ID} from '../../../core/constants/eventIds.js'; // Import event ID

// --- Mock Dependencies ---
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

const mockUnsubscribe = jest.fn(); // Mock the unsubscribe function
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribe), // onCommand returns the mock unsubscribe fn
};


// --- Test Suite ---
// UPDATED Description: Test RE_PROMPT directive handling
describe('PlayerTurnHandler: #_processValidatedCommand - Successful Command with RE_PROMPT Directive', () => {
    /** @type {PlayerTurnHandler} */
    let handler;

    // --- Test Data ---
    const mockActor = {id: 'player-1', name: 'WaitingActor'};
    const mockCommandResult = {
        success: true, // Command processing itself was successful
        turnEnded: false,
        message: 'Looked around.',
        actionResult: {actionId: 'look'}
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUnsubscribe.mockClear();
        mockCommandInputPort.onCommand.mockClear();

        // PlayerPromptService: Succeeds on first call (startTurn)
        // And will be called again due to RE_PROMPT directive
        mockPlayerPromptService.prompt.mockResolvedValue(undefined);

        mockCommandProcessor.processCommand.mockResolvedValue(mockCommandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();
        mockSafeEventDispatcher.subscribe.mockReturnValue(jest.fn());


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

    // UPDATED Test Description and Assertions
    it('should process command, interpret RE_PROMPT, and re-prompt the player', async () => {
        // 1. Start turn (triggers initial prompt)
        await handler.startTurn(mockActor);
        await new Promise(process.nextTick);

        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Initial prompt
        expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor);

        // Clear mocks called during startTurn to focus on command handling phase
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockPlayerPromptService.prompt.mockClear(); // Clear the startTurn call

        // 2. Submit command
        const commandString = 'look';
        const commandHandler = mockCommandInputPort.onCommand.mock.calls[0][0];
        await commandHandler(commandString);
        await new Promise(process.nextTick); // Allow handler processing

        // --- Assertions for RE_PROMPT behavior ---

        // Command Processor and Interpreter called
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandString);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // Re-prompt should occur
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // Turn should NOT end
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();

        // Should NOT wait for TURN_ENDED_ID event
        expect(mockSafeEventDispatcher.subscribe).not.toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
        expect(mockLogger.info).not.toHaveBeenCalledWith(
            expect.stringContaining(`Proceeding to wait for '${TURN_ENDED_ID}' event`)
        );

        // Logging should reflect RE_PROMPT path
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`CommandProcessor SUCCEEDED for "${commandString}" by ${mockActor.id}`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`CommandOutcomeInterpreter processed. Received directive: '${TurnDirective.RE_PROMPT}' for actor ${mockActor.id}`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Directive RE_PROMPT received for ${mockActor.id}. Prompting again.`)
        );

        // Command input subscription should remain active
        expect(mockUnsubscribe).not.toHaveBeenCalled();
    });
});
// --- FILE END ---