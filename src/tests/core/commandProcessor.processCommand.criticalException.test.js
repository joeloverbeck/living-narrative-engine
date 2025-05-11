// src/tests/core/commandProcessor.processCommand.criticalException.test.js

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import CommandProcessor from '../../core/commands/commandProcessor.js'; // Adjust path as needed

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/commands/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../core/interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../core/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/targetResolutionService.js').ResolutionStatus} ResolutionStatus */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */


// --- Mock Dependencies ---
const mockResolutionStatus = {
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    NONE: 'NONE',
    SELF: 'SELF',
    NOT_FOUND: 'NOT_FOUND',
    AMBIGUOUS: 'AMBIGUOUS',
    INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE',
    ERROR: 'ERROR',
};

// Mock the targetResolutionService.js using a getter for ResolutionStatus
jest.mock('../../services/targetResolutionService.js', () => ({
    get ResolutionStatus() { // Use a getter
        return mockResolutionStatus;
    }
    // default: jest.fn() // Add if default export is needed by CommandProcessor constructor
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Critical Unexpected Exception (Branch 8.1)', () => {
    /** @type {ICommandParser} */ let mockCommandParser;
    /** @type {ITargetResolutionService} */ let mockTargetResolutionService;
    /** @type {ILogger} */ let mockLogger;
    /** @type {ISafeEventDispatcher} */ let mockSafeEventDispatcher;
    /** @type {IValidatedEventDispatcher} */ let mockValidatedEventDispatcher;
    /** @type {IWorldContext} */ let mockWorldContext;
    /** @type {EntityManager} */ let mockEntityManager;
    /** @type {GameDataRepository} */ let mockGameDataRepository;
    /** @type {CommandProcessor} */ let commandProcessor;

    const mockActor = { id: 'player1' };
    const command = "resolve-fail"; // Command leading to the mocked exception
    const actionId = 'core:resolve_fail';
    const mockLocation = { id: 'lab', name: 'The Lab' };
    const criticalError = new Error('Something went very wrong!');
    // Updated userFacingError to match CommandProcessor's output
    const userFacingError = 'An unexpected internal error occurred while processing your command. Please try again later.';

    /** @type {ParsedCommand} */
    const mockParsedResult = {
        actionId: actionId,
        directObjectPhrase: null,
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: command,
        error: null
    };

    /** @type {ActionDefinition} */
    const mockActionDef = {
        id: actionId,
        commandVerb: 'resolve-fail',
        target_domain: 'location', // Arbitrary, just need to get past checks
        target_type: null,
        syntax: ['resolve-fail'],
        preconditions: [],
        effects: [],
        description: 'Causes an error.',
    };

    // Updated expectedFailureResult to match CommandProcessor's actual output
    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: userFacingError,
        internalError: expect.stringContaining(`Critical unexpected error during command processing pipeline for "${command}" by actor ${mockActor.id}: ${criticalError.message}. Stack:`)
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = {
            // Mock resolveActionTarget to throw the critical error
            resolveActionTarget: jest.fn().mockImplementation(async () => {
                throw criticalError;
            })
        };
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        };
        mockSafeEventDispatcher = {
            // Allow system error dispatch to succeed
            dispatchSafely: jest.fn().mockImplementation(async (eventName, payload) => {
                return eventName === 'core:system_error_occurred';
            })
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue(mockLocation)
        };
        mockEntityManager = { getEntityInstance: jest.fn() };
        mockGameDataRepository = {
            getActionDefinition: jest.fn().mockReturnValue(mockActionDef)
        };

        commandProcessor = new CommandProcessor({
            commandParser: mockCommandParser,
            targetResolutionService: mockTargetResolutionService,
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            safeEventDispatcher: mockSafeEventDispatcher,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
        });
        // Allow constructor's async import promise to resolve
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // No cleanup needed
    });

    it('[CPROC-TICKET-8.1] should handle unexpected critical exceptions', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult);

        // Assert: Calls to services up to the point of failure
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1); // It was called and threw

        // Assert: logger.error called twice (once in catch block, once in #dispatchSystemError)
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // Check specifically for the first (critical) error log from the main catch block
        // Updated expectation for the critical error log message prefix
        const criticalErrorCall = mockLogger.error.mock.calls.find(call => call[0].startsWith('CommandProcessor: CRITICAL UNEXPECTED ERROR.'));
        expect(criticalErrorCall).toBeDefined();
        // Updated expectation for the content of the critical error log message
        expect(criticalErrorCall[0]).toContain(`Critical unexpected error during command processing pipeline for "${command}" by actor ${mockActor.id}: ${criticalError.message}. Stack:`);
        expect(criticalErrorCall[1]).toBe(criticalError); // Check the original error object was logged

        // Check specifically for the second error log from #dispatchSystemError context
        // Updated expectation for the system error context log message prefix
        const systemErrorContextCall = mockLogger.error.mock.calls.find(call => call[0].startsWith('CommandProcessor System Error Context:'));
        expect(systemErrorContextCall).toBeDefined();
        // Updated expectation for the content of the system error context log message
        expect(systemErrorContextCall[0]).toContain(`Critical unexpected error during command processing pipeline for "${command}" by actor ${mockActor.id}: ${criticalError.message}. Stack:`);
        expect(systemErrorContextCall[0]).toContain(`Original Error: ${criticalError.message}`);
        expect(systemErrorContextCall[1]).toBe(criticalError); // Original error passed to helper

        // Assert: safeEventDispatcher.dispatchSafely called once for core:system_error_occurred
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        // Updated expectation for the event payload
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                eventName: 'core:system_error_occurred',
                message: userFacingError, // This now uses the updated constant
                type: 'error',
                details: expect.stringContaining(`Critical unexpected error during command processing pipeline for "${command}" by actor ${mockActor.id}: ${criticalError.message}. Stack:`)
            })
        );

        // Assert: logger.warn NOT called for this failure path
        expect(mockLogger.warn).not.toHaveBeenCalled();

        // Assert: Expected debug logs for steps leading up to failure
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`); // Corrected based on implementation
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${actionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchLocationContext: Successfully fetched current location ${mockLocation.id} for actor ${mockActor.id}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: Building ActionContext. Actor: ${mockActor.id}, Location: ${mockLocation.id}, Command: ${actionId}`); // Corrected based on implementation
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: ActionContext built successfully.`); // Corrected based on implementation


        // Ensure logs after the error point were NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target resolution complete.'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Parse & Resolve OK'));
    });
});