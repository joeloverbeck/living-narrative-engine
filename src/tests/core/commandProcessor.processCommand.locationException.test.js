// src/tests/core/commandProcessor.processCommand.locationException.test.js

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


// --- Mock Dependencies ---
// Define mockResolutionStatus BEFORE it's used in jest.mock's factory via getter
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
// This defers accessing mockResolutionStatus until the property is actually used.
jest.mock('../../services/targetResolutionService.js', () => ({
    get ResolutionStatus() {
        return mockResolutionStatus; // Accessed via getter
    }
}));
// Removed { virtual: true }


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Location Fetch Exception (Branch 5.1)', () => {
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
    const command = "look"; // Command string
    const actionId = 'core:look';
    const userFacingError = 'Internal error: Could not determine your current location.';
    const locationError = new Error('Database connection failed');
    const internalErrorMsg = `Failed to get current location for actor ${mockActor.id} using worldContext.getLocationOfEntity: ${locationError.message}`;
    const systemErrorContextMsg = `CommandProcessor System Error Context: ${internalErrorMsg}. Original Error: ${locationError.message}`;


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
        commandVerb: 'look',
        target_domain: 'location', // Requires location context
        preconditions: [],
        effects: [],
        description: '',
        target_type: 'none',
        syntax: ['look'],
    };


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
            dispatchSafely: jest.fn().mockResolvedValue(true),
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockImplementation(() => {
                throw locationError;
            })
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
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // jest.restoreAllMocks();
    });

    it('[CPROC-TICKET-5.1] should handle exception during location fetch', async () => {
        const result = await commandProcessor.processCommand(mockActor, command);

        expect(result).toEqual(expectedFailureResult);

        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);

        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);

        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);

        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        const expectedFetchLocationContextErrorMsg = `CommandProcessor.#_fetchLocationContext: ${internalErrorMsg}`;
        const errorCall1 = mockLogger.error.mock.calls.find(call => call[0] === expectedFetchLocationContextErrorMsg);
        expect(errorCall1).toBeDefined();
        if (errorCall1) { // Guard for safety, though it should be defined
            expect(errorCall1[0]).toBe(expectedFetchLocationContextErrorMsg);
            expect(errorCall1[1]).toBe(locationError);
        }


        const errorCall2 = mockLogger.error.mock.calls.find(call => call[0] === systemErrorContextMsg);
        expect(errorCall2).toBeDefined();
        if (errorCall2) {
            expect(errorCall2[1]).toBe(locationError);
        }

        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                eventName: 'core:system_error_occurred',
                message: userFacingError,
                type: 'error',
                details: internalErrorMsg
            })
        );

        expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();

        const processingInfoLog = mockLogger.info.mock.calls.find(
            callArgs => typeof callArgs[0] === 'string' && callArgs[0].startsWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`)
        );
        expect(processingInfoLog).toBeDefined();

        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${actionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        // The following debug log is NOT expected in THIS error path, so it is removed.
        // expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchLocationContext: Actor ${mockActor.id} has no current location, but action '${mockActionDef.id}' (domain: '${mockActionDef.target_domain}') allows this. Proceeding without location context.`);
    });
});