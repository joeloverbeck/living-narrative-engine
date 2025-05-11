// src/tests/core/commandProcessor.processCommand.parserNoActionId.test.js

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
// ResolutionStatus is not directly used for typing in this test, CommandProcessor gets it from the mock
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

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
    // Add any other statuses that might be relevant
};

// Mock the targetResolutionService.js module
jest.mock('../../services/targetResolutionService.js', () => ({
    __esModule: true, // Important for ES6 modules with named exports
    ResolutionStatus: RESOLUTION_STATUS_VALUES, // Inline the object here
    // default: jest.fn() // If CommandProcessor instantiated TargetResolutionService class directly
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Parser No ActionID (Branch 3.2)', () => {
    /** @type {ICommandParser} */ let mockCommandParser;
    /** @type {ITargetResolutionService} */ let mockTargetResolutionService; // Dependency, even if not directly used in this path
    /** @type {ILogger} */ let mockLogger;
    /** @type {ISafeEventDispatcher} */ let mockSafeEventDispatcher;
    /** @type {IValidatedEventDispatcher} */ let mockValidatedEventDispatcher;
    /** @type {IWorldContext} */ let mockWorldContext;
    /** @type {EntityManager} */ let mockEntityManager;
    /** @type {GameDataRepository} */ let mockGameDataRepository;
    /** @type {CommandProcessor} */ let commandProcessor;

    const mockActor = { id: 'player1' };
    const command = "verb something"; // Command that parses ok but yields no actionId
    const userFacingError = "Could not understand the command.";

    /** @type {ParsedCommand} */
    const mockParsedResult = {
        actionId: null,
        directObjectPhrase: 'something',
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: command,
        error: null // Explicitly null, indicating parsing itself succeeded
    };

    // MODIFIED: Define the expected internal error based on the source code
    const expectedInternalError = `Parsing succeeded but no actionId found for command "${command}" by actor ${mockActor.id}. Parser output: ${JSON.stringify(mockParsedResult)}`;

    // MODIFIED: Update expectedFailureResult to use the correct internalError
    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: userFacingError,
        internalError: expectedInternalError
    };

    beforeEach(() => { // Removed async, as await new Promise is no longer needed
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
            dispatchSafely: jest.fn().mockResolvedValue(true), // Assume dispatch of parse_failed is successful
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = { getLocationOfEntity: jest.fn() };
        mockEntityManager = { getEntityInstance: jest.fn() };
        mockGameDataRepository = { getActionDefinition: jest.fn() };

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
        jest.resetModules(); // Good practice
    });

    it('[CPROC-TICKET-3.2] should handle parser success with null actionId', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult); // Uses updated expectedFailureResult

        // Assert: commandParser.parse called once with the command
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);

        // Assert: logger.warn called once with the specific internal message
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // MODIFIED: Expect the detailed warning message
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `CommandProcessor.#_parseCommand: ${expectedInternalError}`
        );

        // Assert: safeEventDispatcher.dispatchSafely called once for core:command_parse_failed
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:command_parse_failed',
            {
                eventName: 'core:command_parse_failed',
                actorId: mockActor.id,
                commandString: command,
                error: userFacingError // The user-facing error should be in the event
            }
        );

        // Assert: Other methods NOT called
        expect(mockGameDataRepository.getActionDefinition).not.toHaveBeenCalled();
        expect(mockWorldContext.getLocationOfEntity).not.toHaveBeenCalled();
        expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();

        // Assert: Check that logger.error was NOT called for this specific failure path
        const relevantErrorCalls = mockLogger.error.mock.calls.filter(
            call => typeof call[0] === 'string' && (call[0].startsWith('CommandProcessor:') || call[0].startsWith('System Error Context:'))
        );
        expect(relevantErrorCalls.length).toBe(0);

        // Assert: Initial processing info log IS called
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);

        // Assert: Debug logs for parsing attempt and result
        // MODIFIED: Added 'for actor ${mockActor.id}'
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        // The "Parsing successful" debug log is NOT called in this path
        const successParseLog = mockLogger.debug.mock.calls.find(call => call[0].includes('Parsing successful'));
        expect(successParseLog).toBeUndefined();
    });
});