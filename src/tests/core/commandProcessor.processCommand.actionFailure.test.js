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

// --- FIX: Use jest.fn() for methods ---
const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
    // subscribe: jest.fn(), // Include if needed
    // unsubscribe: jest.fn(), // Include if needed
};

const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
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
    commandParser: {...mockCommandParser, parse: jest.fn()},
    actionExecutor: {...mockActionExecutor, executeAction: jest.fn()},
    logger: {...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    // --- FIX: Ensure VED mock is fresh ---
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    worldContext: {...mockWorldContext, getLocationOfEntity: jest.fn(), getPlayer: jest.fn()},
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

        // Clear specific mocks after instantiation
        Object.values(mocks.logger).forEach(fn => fn.mockClear());
        mocks.commandParser.parse.mockClear();
        mocks.actionExecutor.executeAction.mockClear();
        mocks.validatedEventDispatcher.dispatchValidated.mockClear();
        mocks.worldContext.getLocationOfEntity.mockClear();
        mocks.worldContext.getPlayer.mockClear();
        mocks.entityManager.getEntityInstance.mockClear(); // Ensure these are also cleared if used
        mocks.entityManager.addComponent.mockClear();
        mocks.gameDataRepository.getActionDefinition.mockClear();

        // --- FIX: Set default mock implementations needed by the tests ---
        // Mock VED dispatch to resolve successfully by default
        mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        // Mock location lookup to succeed by default for these tests
        mocks.worldContext.getLocationOfEntity.mockReturnValue(mockLocation);
    });


    // --- processCommand Tests for Action Failure (Result success: false) ---
    describe('processCommand', () => {

        // No inner beforeEach needed as defaults are set in outer one

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
                messages: [{text: 'Target dodged!', type: 'combat'}],
                // Explicitly set endsTurn for clarity in test, adjust if default is different
                endsTurn: true
            };

            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);
            // Location lookup is already mocked to succeed

            // Configure action executor to resolve with the failed actionResult
            mocks.actionExecutor.executeAction.mockResolvedValue(actionResult);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            // Note: Your code includes a check for VED dispatch success affecting the internalError
            // Assuming VED succeeds here based on the mock setup
            expect(result).toEqual({
                success: false, // Should reflect actionResult.success
                turnEnded: true, // Should reflect actionResult.endsTurn or default
                error: null, // No top-level error for logical action failure
                internalError: `Action ${parsedCommand.actionId} failed. See actionResult for details.`, // Internal note (assumes VED dispatch succeeded)
                actionResult: actionResult // Include the original ActionResult
            });

            // Assert: Check logger.debug call for logging the received actionResult
            expect(mocks.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`CommandProcessor: Action executor returned result for action ${parsedCommand.actionId}: ${JSON.stringify(actionResult)}`)
            );

            // Assert: Check logger.info call for logging the final CommandResult summary
            expect(mocks.logger.info).toHaveBeenCalledWith(
                // Updated log message to reflect logical failure note
                `CommandProcessor: Action ${parsedCommand.actionId} processed for actor ${mockActor.id}. CommandResult: { success: false, turnEnded: true } (Logical failure)`
            );

            // Assert: Check that logger.error related to exceptions was NOT called
            expect(mocks.logger.error).not.toHaveBeenCalled();

            // Assert: Check that VED *was* called for the core:action_failed event
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({ // Use objectContaining for flexibility
                    actorId: mockActor.id,
                    actionId: parsedCommand.actionId,
                    commandString: commandInput, // Ensure command string is included if expected
                    error: 'Target dodged!', // Correct error message derived from actionResult.messages
                    isExecutionError: false, // Logical failure
                    actionResult: actionResult // Include full result
                })
            );

            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
            expect(mocks.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledTimes(1);

            // Assert: Check context passed to executeAction
            // --- START FIX ---
            expect(mocks.actionExecutor.executeAction).toHaveBeenCalledWith(
                parsedCommand.actionId,
                expect.objectContaining({ // Check the context object structure accurately
                    actingEntity: mockActor,
                    currentLocation: mockLocation,
                    parsedCommand: parsedCommand,
                    // Expect eventBus with a dispatch function inside
                    eventBus: expect.objectContaining({
                        dispatch: expect.any(Function)
                    }),
                    // Expect the logger object
                    logger: mocks.logger,
                    // Expect the specific VED instance
                    validatedEventDispatcher: mocks.validatedEventDispatcher,
                    // Expect the world context object
                    worldContext: mocks.worldContext,
                    // Expect entity manager and game data repo
                    entityManager: mocks.entityManager,
                    gameDataRepository: mocks.gameDataRepository
                })
            );
            // --- END FIX ---


            // Assert: Check that logger.warn was not called (based on code changes)
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.7 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')
// --- FILE END ---