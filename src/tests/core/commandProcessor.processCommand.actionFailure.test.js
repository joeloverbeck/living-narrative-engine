// src/tests/core/commandProcessor.processCommand.actionFailure.test.js
// --- FILE START (Corrected Test File) ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
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

// ****** START FIX: Rename mockGameStateManager to mockWorldContext ******
// This is the actual dependency needed by CommandProcessor constructor
const mockWorldContext = {
    getCurrentLocation: jest.fn(),
    getPlayer: jest.fn(),
};
// ****** END FIX ******

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};

// Helper function to create a full set of valid mocks for options
const createValidMocks = () => ({
    commandParser: {...mockCommandParser, parse: jest.fn()},
    actionExecutor: {...mockActionExecutor, executeAction: jest.fn()},
    logger: {...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    // ****** START FIX: Return worldContext instead of gameStateManager ******
    // gameStateManager: { ...mockGameStateManager, getCurrentLocation: jest.fn(), getPlayer: jest.fn() }, // Removed
    worldContext: {...mockWorldContext, getCurrentLocation: jest.fn(), getPlayer: jest.fn()}, // Added
    // ****** END FIX ******
    entityManager: {...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn()},
    gameDataRepository: {...mockGameDataRepository, getActionDefinition: jest.fn()},
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;
    let mockActor;
    let mockLocation; // Define mockLocation here

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks(); // Now creates correct dependencies
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks); // Constructor should pass validation
        // Define standard valid mocks accessible in tests
        mockActor = {id: 'player1', name: 'ActionFailTester'};
        mockLocation = {id: 'room1', name: 'Battle Room'};

        // Clear mocks AFTER instantiation if needed, or reset specific ones
        // jest.clearAllMocks(); // Be careful with this if mocks are needed immediately after construction

        // Reset specific mocks before the actual test logic runs
        Object.values(mocks.logger).forEach(fn => fn.mockClear());
        mocks.commandParser.parse.mockClear();
        mocks.actionExecutor.executeAction.mockClear();
        mocks.validatedEventDispatcher.dispatchValidated.mockClear();
        mocks.worldContext.getCurrentLocation.mockClear(); // Clear the worldContext mock
        mocks.worldContext.getPlayer.mockClear();
    });


    // --- processCommand Tests for Action Failure (Result success: false) ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Configure mocks specific to this describe block if needed
            // Mock VED dispatch to resolve successfully by default
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
            // ****** START FIX: Use worldContext for location lookup mock ******
            // Mock location lookup to succeed by default for these tests
            mocks.worldContext.getCurrentLocation.mockReturnValue(mockLocation);
            // ****** END FIX ******
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
                messages: [{text: 'Target dodged!', type: 'combat'}]
                // Assuming `endsTurn` defaults to true if missing or action logic decides it
            };

            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            // Location lookup is already mocked to succeed in the inner beforeEach

            // Configure action executor to resolve with the failed actionResult
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false, // Should reflect actionResult.success
                turnEnded: true, // Turn should end even if the action failed (assuming default or logic)
                error: null, // No top-level error for logical action failure
                internalError: `Action ${parsedCommand.actionId} failed. See actionResult for details.`, // Internal note
                actionResult: actionResult // Include the original ActionResult
            });

            // Assert: Check logger.debug call for logging the received actionResult
            expect(mocks.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`CommandProcessor: Action executor returned result for action ${parsedCommand.actionId}: ${JSON.stringify(actionResult)}`)
            );

            // Assert: Check logger.info call for logging the final CommandResult summary
            expect(mocks.logger.info).toHaveBeenCalledWith(
                // Updated log message to reflect logical failure note
                expect.stringContaining(`CommandProcessor: Action ${parsedCommand.actionId} processed for actor ${mockActor.id}. CommandResult: { success: false, turnEnded: true } (Logical failure)`)
            );

            // Assert: Check that logger.error related to exceptions was NOT called
            expect(mocks.logger.error).not.toHaveBeenCalled();

            // Assert: Check that VED was NOT called *by CommandProcessor* to dispatch an error message for this failure type
            expect(mocks.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'textUI:display_message', // Assuming this is a UI event not dispatched by core CP
                expect.objectContaining({type: 'error'}) // Ensure no 'error' type messages were dispatched by CP
            );

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            // ****** START FIX: Check worldContext mock call ******
            // CORRECTED ASSERTION: Check that getCurrentLocation was called once, without arguments.
            expect(mocks.worldContext.getCurrentLocation).toHaveBeenCalledTimes(1);
            // ****** END FIX ******
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);

            // ****** START FIX: Check context passed to executeAction ******
            // Check executeAction arguments, ensuring context includes worldContext
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(
                parsedCommand.actionId,
                expect.objectContaining({ // Check the context object structure
                    actingEntity: mockActor,
                    currentLocation: mockLocation,
                    parsedCommand: parsedCommand,
                    gameDataRepository: mocks.gameDataRepository,
                    entityManager: mocks.entityManager,
                    dispatch: expect.any(Function),
                    logger: mocks.logger,
                    // gameStateManager: mocks.gameStateManager, // Removed check
                    worldContext: mocks.worldContext, // Added check
                })
            );
            // ****** END FIX ******

            // Assert: Check that logger.warn was not called (based on code changes)
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.7 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---