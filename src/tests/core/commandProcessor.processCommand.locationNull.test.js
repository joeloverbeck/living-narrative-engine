// src/tests/core/commandProcessor.processCommand.locationNull.test.js

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
    let mockActor; // Define mockActor here to be accessible in tests

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks();
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks);
        // Define a standard valid actor for these tests
        mockActor = { id: 'player1', name: 'LocationTester' };
    });


    // --- processCommand Tests for Location Lookup Failure (Null) ---
    describe('processCommand', () => {

        beforeEach(() => {
            // Clear all mocks before each test in this specific suite
            // Note: jest.clearAllMocks() resets call counts etc. between tests
            Object.values(mocks.commandParser).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.actionExecutor).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.logger).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.validatedEventDispatcher).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.gameStateManager).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.entityManager).forEach(mockFn => mockFn.mockClear());
            Object.values(mocks.gameDataRepository).forEach(mockFn => mockFn.mockClear());


            // Mock VED dispatch to resolve successfully by default
            mocks.validatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
        });

        // --- Sub-Ticket 4.1.13.5 Test Case ---
        it('should handle location lookup failure when getCurrentLocation returns null', async () => {
            // Arrange: Define test data and configure mocks
            const commandInput = 'look';
            const parsedCommand = {
                actionId: 'core:look',
                originalInput: commandInput,
                error: null, // Ensure parsing succeeds
                verb: 'look',
                directObjectPhrase: null,
                preposition: null,
                indirectObjectPhrase: null,
            };
            const userError = 'Internal error: Your current location is unknown.';
            const internalErrorDetails = `getCurrentLocation returned null for actor ${mockActor.id}.`;
            const systemErrorContext = `System Error Context: ${internalErrorDetails}`;


            // Configure parser to return the valid parsed command
            mocks.commandParser.parse.mockReturnValue(parsedCommand);

            // Configure gameStateManager to return null for location lookup
            mocks.gameStateManager.getCurrentLocation.mockReturnValue(null);

            // Act: Call the method under test
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned CommandResult precisely
            expect(result).toEqual({
                success: false,
                turnEnded: false,
                error: userError,
                internalError: internalErrorDetails,
                actionResult: undefined
            });

            // Assert: Check logger.error call
            expect(mocks.logger.error).toHaveBeenCalledTimes(2);

            // Check the first call (specific error message)
            // Use .toHaveBeenNthCalledWith(callIndex, ...args) for more precise checks
            expect(mocks.logger.error).toHaveBeenNthCalledWith(1,
                `CommandProcessor: Could not find current location entity for actor ${mockActor.id}. GameStateManager returned null.`
            );
            // Check the second call (from #dispatchSystemError)
            // --- CORRECTED ASSERTION: Expect only ONE argument ---
            expect(mocks.logger.error).toHaveBeenNthCalledWith(2,
                expect.stringContaining(systemErrorContext) // Check the context string
                // REMOVED: , null
            );
            // --- END CORRECTION ---

            // Assert: Check that action execution was NOT attempted
            expect(mocks.actionExecutor.executeAction).not.toHaveBeenCalled();

            // Assert: Check that VED *was* called for the system error event
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mocks.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:system_error_occurred', // Expect the semantic event
                {                             // Expect the correct payload structure
                    message: userError,       // User-facing message
                    type: 'error',
                    details: expect.stringContaining(internalErrorDetails) // Internal details
                }
            );


            // Assert: Check necessary prior steps *were* called
            expect(mocks.commandParser.parse).toHaveBeenCalledWith(commandInput);
            expect(mocks.gameStateManager.getCurrentLocation).toHaveBeenCalledWith(mockActor.id);

            // Assert: Check that logger.warn was not called
            expect(mocks.logger.warn).not.toHaveBeenCalled();
        });
        // --- End Sub-Ticket 4.1.13.5 Test Case ---

    }); // End describe('processCommand')

}); // End describe('CommandProcessor')