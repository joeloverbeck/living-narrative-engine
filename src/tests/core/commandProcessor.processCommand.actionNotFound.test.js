// src/tests/core/commandProcessor.processCommand.actionNotFound.test.js

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
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Action Definition Not Found (Branch 4.1)', () => {
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
    const command = "nonexistent"; // Command string
    const parsedActionId = 'core:nonexistent'; // Action ID returned by parser

    // MODIFIED: Correct error messages based on CommandProcessor source
    const userFacingError = 'Internal error: The definition for this action is missing.';
    const internalErrorMsg = `Internal inconsistency: ActionDefinition not found for parsed actionId '${parsedActionId}' (actor: ${mockActor.id}). This might indicate missing game data or a misconfiguration.`;
    // Correct system error log message format when no originalError is passed
    const systemErrorContextMsg = `CommandProcessor System Error Context: ${internalErrorMsg}`;

    /** @type {ParsedCommand} */
    const mockParsedResult = {
        actionId: parsedActionId,
        directObjectPhrase: null,
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: command,
        error: null
    };

    // MODIFIED: Uses corrected error messages
    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: userFacingError,
        internalError: internalErrorMsg
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = { resolveActionTarget: jest.fn() };
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        };
        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn().mockResolvedValue(true), // Assume dispatch of system_error is successful
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = { getLocationOfEntity: jest.fn() };
        mockEntityManager = { getEntityInstance: jest.fn() };
        mockGameDataRepository = {
            getActionDefinition: jest.fn().mockReturnValue(null) // Return null for the specific actionId
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
        // Wait for potential async operations in constructor
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // If mocks need restoring, do it here. jest.clearAllMocks() in beforeEach is usually sufficient.
    });

    it('[CPROC-TICKET-4.1] should handle missing action definition', async () => {
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult);

        // Assert: Calls up to the point of failure
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(parsedActionId);

        // Assert: Log calls
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Once in #_fetchActionDefinition, once in #dispatchSystemError

        // MODIFIED: Corrected log message check for the first error call
        const expectedFetchErrorLog = `CommandProcessor.#_fetchActionDefinition: ${internalErrorMsg}`;
        expect(mockLogger.error).toHaveBeenCalledWith(expectedFetchErrorLog);

        // MODIFIED: Corrected log message check for the second error call (from #dispatchSystemError)
        expect(mockLogger.error).toHaveBeenCalledWith(systemErrorContextMsg);

        // Assert: Dispatch call for system error
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({ // Payload uses corrected messages
                eventName: 'core:system_error_occurred',
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg
            })
        );

        // Assert: Methods NOT called past the point of failure
        expect(mockWorldContext.getLocationOfEntity).not.toHaveBeenCalled();
        expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();

        // Assert: Other logs not called
        expect(mockLogger.warn).not.toHaveBeenCalled();
        const processingInfoLog = mockLogger.info.mock.calls.find(
            callArgs => typeof callArgs[0] === 'string' && callArgs[0].startsWith(`CommandProcessor: Processing command`)
        );
        expect(processingInfoLog).toBeDefined(); // The initial processing log should still happen

        // Assert: Debug logs called before failure
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`); // Added actor id
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${parsedActionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${parsedActionId}'.`); // Use '#'
        // The "Found ActionDefinition" debug log should NOT be called
        const foundDefLog = mockLogger.debug.mock.calls.find(call => call[0].includes('Found ActionDefinition for'));
        expect(foundDefLog).toBeUndefined();
    });
});