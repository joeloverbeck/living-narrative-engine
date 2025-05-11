// src/tests/core/commandProcessor.processCommand.locationNullRequired.test.js

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
// ResolutionStatus type import is not strictly needed here as it's handled by the mock for CommandProcessor.
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */


// --- Mock Dependencies ---
// Define the object that will be used in the mock
const RESOLUTION_STATUS_VALUES = {
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    NONE: 'NONE',
    SELF: 'SELF',
    NOT_FOUND: 'NOT_FOUND',
    AMBIGUOUS: 'AMBIGUOUS',
    INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE',
    ERROR: 'ERROR',
    // Add any other statuses your CommandProcessor might interact with via the imported ResolutionStatus
};

// Mock the targetResolutionService.js module
jest.mock('../../services/targetResolutionService.js', () => ({
    __esModule: true, // Important for ES6 modules with named exports
    ResolutionStatus: RESOLUTION_STATUS_VALUES, // Inline the object here
    // default: jest.fn() // If CommandProcessor instantiated TargetResolutionService class directly
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Location Null (Action Requires Location) (Branch 5.2)', () => {
    /** @type {ICommandParser} */ let mockCommandParser;
    /** @type {ITargetResolutionService} */ let mockTargetResolutionService; // Dependency, even if not directly used in this specific failure path
    /** @type {ILogger} */ let mockLogger;
    /** @type {ISafeEventDispatcher} */ let mockSafeEventDispatcher;
    /** @type {IValidatedEventDispatcher} */ let mockValidatedEventDispatcher;
    /** @type {IWorldContext} */ let mockWorldContext;
    /** @type {EntityManager} */ let mockEntityManager;
    /** @type {GameDataRepository} */ let mockGameDataRepository;
    /** @type {CommandProcessor} */ let commandProcessor;

    const mockActor = { id: 'player1' };
    const command = "get item"; // Command string
    const actionId = 'core:get';
    const actionDomain = 'item_in_location'; // Domain requiring location, can be any non 'none' or 'self' for this test

    // MODIFIED: Error messages updated to match CommandProcessor source
    const userFacingError = 'Your current location is unknown, and this action requires it.';
    const internalErrorMsg = `Actor ${mockActor.id} has no current location (getLocationOfEntity returned null), but action '${actionId}' (domain: ${actionDomain}) requires a location context.`;
    const systemErrorContextMsg = `CommandProcessor System Error Context: ${internalErrorMsg}`; // Correct format for log inside #dispatchSystemError when no originalError is passed


    /** @type {ParsedCommand} */
    const mockParsedResult = {
        actionId: actionId,
        directObjectPhrase: 'item', // Example phrase
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: command,
        error: null
    };

    /** @type {ActionDefinition} */
    const mockActionDef = {
        id: actionId,
        name: 'Get Item', // For clarity
        target_domain: actionDomain, // Requires location context
        // target_type: 'entity', // Often not needed in ActionDef if domain implies it
        // syntax: ['get <dobj>'],
        // preconditions: [],
        // effects: [],
        // description: '',
    };


    // This now uses the corrected error message constants
    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: userFacingError,
        internalError: internalErrorMsg
    };

    beforeEach(() => { // Removed async
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = { resolveActionTarget: jest.fn() }; // TRS is a dependency
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
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue(null) // Return null for location
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
    });

    afterEach(() => {
        jest.resetModules();
    });

    it('[CPROC-TICKET-5.2] should handle null location when action requires it', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult);

        // Assert: commandParser.parse called once
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);

        // Assert: gameDataRepository.getActionDefinition called once
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);

        // Assert: worldContext.getLocationOfEntity called once
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);

        // Assert: logger.error called twice
        // The CommandProcessor first logs the specific error, then #dispatchSystemError logs it again.
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // MODIFIED: First call expectation uses the corrected internalErrorMsg
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, `CommandProcessor.#_fetchLocationContext: ${internalErrorMsg}`);
        // MODIFIED: Second call expectation uses the corrected systemErrorContextMsg
        expect(mockLogger.error).toHaveBeenNthCalledWith(2, systemErrorContextMsg);


        // Assert: safeEventDispatcher.dispatchSafely called once for core:system_error_occurred
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({ // Payload uses the corrected messages
                eventName: 'core:system_error_occurred',
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg
            })
        );

        // Assert: Methods NOT called past the point of failure
        expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();

        // Ensure logger.warn was NOT called for this specific failure path
        expect(mockLogger.warn).not.toHaveBeenCalled();

        // Assert: Initial processing info log IS called
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);


        // Assert: Debug logs for steps leading up to the failure
        // Ensure private method prefixes are correct '#'
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${actionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        // No "Successfully fetched current location" or "ActionContext built for target resolution" debug logs should occur here
        const fetchedLocationLog = mockLogger.debug.mock.calls.find(call => call[0].includes('Successfully fetched current location'));
        expect(fetchedLocationLog).toBeUndefined();
        const contextBuiltLog = mockLogger.debug.mock.calls.find(call => call[0].includes('ActionContext built'));
        expect(contextBuiltLog).toBeUndefined();
    });
});