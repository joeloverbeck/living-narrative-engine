// src/tests/core/commandProcessor.processCommand.actionFailure.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';

// --- Mock Dependencies ---
// Using jest.fn() creates mock functions for all required methods

const mockCommandParser = {
    parse: jest.fn(),
};

const mockActionExecutor = {
    executeAction: jest.fn(),
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockGameStateManager = {
    getCurrentLocation: jest.fn(),
    getPlayer: jest.fn(),
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};

// Helper function to create a full set of valid mocks for options
const createValidMocks = () => ({
    commandParser: { ...mockCommandParser, parse: jest.fn() },
    actionExecutor: { ...mockActionExecutor, executeAction: jest.fn() },
    logger: { ...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    validatedEventDispatcher: { ...mockValidatedEventDispatcher, dispatchValidated: jest.fn() },
    gameStateManager: { ...mockGameStateManager, getCurrentLocation: jest.fn(), getPlayer: jest.fn() },
    entityManager: { ...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn() },
    gameDataRepository: { ...mockGameDataRepository, getActionDefinition: jest.fn() },
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;
    let mockActor;
    let mockLocation; // Define mockLocation here

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks();
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks);
        // Define standard valid mocks accessible in tests
        mockActor = { id: 'player1', name: 'ActionFailTester' };
        mockLocation = { id: 'room1', name: 'Battle Room' };
    });


    // --- processCommand Tests for Action Failure (Result success: false) ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Clear all mocks before each test in this specific suite
            jest.clearAllMocks();

            // Mock VED dispatch to resolve successfully by default
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
            // Mock location lookup to succeed by default for these tests
            mocks.gameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        });

        // --- Sub-Ticket 4.1.13.7 Test Case ---
        it('should handle action failure when executeAction returns success: false', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = 'attack goblin';
            const parsedCommand = {
                actionId: 'core:attack',
                originalInput: commandInput,
                error: null, // Ensure parsing succeeds
                verb: 'attack',
                directObjectPhrase: 'goblin',
                preposition: null,
                indirectObjectPhrase: null,
            };
            const actionResult = { // Define the failed action result
                success: false,
                messages: [{ text: 'Target dodged!', type: 'combat' }]
            };

            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            // Location lookup is already mocked to succeed in beforeEach

            // Configure action executor to resolve with the failed actionResult
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false, // Should reflect actionResult.success
                turnEnded: true, // Turn should end even if the action failed (e.g., attack missed)
                error: null, // No top-level error; feedback via actionResult/events
                internalError: `Action ${parsedCommand.actionId} failed. See actionResult for details.`, // Internal note about action failure
                actionResult: actionResult // Include the original ActionResult
            });

            // Assert: Check logger.debug call for logging the received actionResult
            expect(mocks.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`CommandProcessor: Action executor returned result for action ${parsedCommand.actionId}: ${JSON.stringify(actionResult)}`)
            );

            // Assert: Check logger.info call for logging the final CommandResult summary
            expect(mocks.logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`CommandProcessor: Action ${parsedCommand.actionId} processed for actor ${mockActor.id}. CommandResult: { success: false, turnEnded: true }`)
            );

            // Assert: Check that logger.error related to exceptions was NOT called
            expect(mocks.logger.error).not.toHaveBeenCalled();

            // Assert: Check that VED was NOT called *by CommandProcessor* to dispatch an error message for this failure type
            // Action-specific messages (like 'Target dodged!') are expected to be dispatched by the ActionExecutor/Action itself via context.dispatch
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'textUI:display_message',
                expect.objectContaining({ type: 'error' }) // Ensure no 'error' type messages were dispatched by CP
            );

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.gameStateManager.getCurrentLocation).toHaveBeenCalledWith(mockActor.id);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);
            // Check executeAction arguments
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(
                parsedCommand.actionId,
                expect.objectContaining({ // Check the context object structure
                    actingEntity: mockActor,
                    currentLocation: mockLocation,
                    parsedCommand: parsedCommand,
                    // Check other context properties are passed
                    gameDataRepository: mocks.gameDataRepository,
                    entityManager: mocks.entityManager,
                    dispatch: expect.any(Function),
                    logger: mocks.logger,
                    gameStateManager: mocks.gameStateManager,
                })
            );

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.7 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')