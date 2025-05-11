// src/tests/core/commandProcessor.processCommand.parserError.test.js

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
// No need to import ResolutionStatus here for typing if it's not directly used in this test file's variables.
// The mock will provide it to CommandProcessor.
/** @typedef {import('../../entities/entity.js').default} Entity */

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
    // Add any other statuses your CommandProcessor might expect or that targetResolutionService might export
};

// Mock the targetResolutionService.js module
jest.mock('../../services/targetResolutionService.js', () => ({
    __esModule: true, // Important for ES6 modules with named exports
    ResolutionStatus: RESOLUTION_STATUS_VALUES, // Inline the object here
    // default: jest.fn() // If CommandProcessor instantiated TargetResolutionService class directly
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Parser Error (Branch 3.1)', () => {
    /** @type {ICommandParser} */ let mockCommandParser;
    /** @type {ITargetResolutionService} */ let mockTargetResolutionService; // Though not directly used, it's a dependency
    /** @type {ILogger} */ let mockLogger;
    /** @type {ISafeEventDispatcher} */ let mockSafeEventDispatcher;
    /** @type {IValidatedEventDispatcher} */ let mockValidatedEventDispatcher;
    /** @type {IWorldContext} */ let mockWorldContext;
    /** @type {EntityManager} */ let mockEntityManager;
    /** @type {GameDataRepository} */ let mockGameDataRepository;
    /** @type {CommandProcessor} */ let commandProcessor;

    const mockActor = { id: 'player1' };
    const command = "loko at thsi thing"; // Intentionally misspelled
    const mockParserError = 'Syntax unclear.';

    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: mockParserError,
        internalError: `Parsing Error: ${mockParserError}`
    };

    beforeEach(() => { // Removed async as the await new Promise is no longer needed
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue({
                actionId: null, // actionId is null when there's a parse error
                directObjectPhrase: null,
                preposition: null,
                indirectObjectPhrase: null,
                originalInput: command,
                error: mockParserError
            })
        };
        // Even if not directly used in a parser error path, TRS is a dependency of CommandProcessor
        mockTargetResolutionService = {
            resolveActionTarget: jest.fn()
        };
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

        // CommandProcessor.ResolutionStatus = RESOLUTION_STATUS_VALUES; // REMOVE THIS LINE

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
        // Removed: await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // CommandProcessor.ResolutionStatus = null; // REMOVE THIS LINE
        jest.resetModules(); // Good practice
    });

    it('[CPROC-TICKET-3.1] should handle command parser error correctly', async () => {
        // Pre-condition check: ResolutionStatus is not set on CommandProcessor class anymore
        // expect(CommandProcessor.ResolutionStatus).toEqual(RESOLUTION_STATUS_VALUES); // REMOVE THIS LINE

        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult);

        // Assert: commandParser.parse called once with the command
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);

        // Assert: logger.warn called once with appropriate message
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `CommandProcessor.#_parseCommand: Parsing failed for command "${command}" by actor ${mockActor.id}. Error: ${mockParserError}`
        );

        // Assert: safeEventDispatcher.dispatchSafely called for core:command_parse_failed
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:command_parse_failed',
            {
                eventName: 'core:command_parse_failed',
                actorId: mockActor.id,
                commandString: command,
                error: mockParserError
            }
        );

        // Assert: Other methods NOT called
        expect(mockGameDataRepository.getActionDefinition).not.toHaveBeenCalled();
        expect(mockWorldContext.getLocationOfEntity).not.toHaveBeenCalled();
        expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();

        // Assert: Check that logger.error was NOT called for this specific failure path
        // (unless an error occurs within the error handling itself, which is not expected here)
        const relevantErrorCalls = mockLogger.error.mock.calls.filter(
            call => typeof call[0] === 'string' && (call[0].startsWith('CommandProcessor:') || call[0].startsWith('System Error Context:'))
        );
        expect(relevantErrorCalls.length).toBe(0);


        // Assert: Initial processing info log IS called
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
    });
});