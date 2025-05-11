// src/tests/core/commandProcessor.processCommand.targetResolutionFailed.test.js

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
/** @typedef {import('../../services/targetResolutionService.js').ResolutionStatus} ActualResolutionStatus */ // For typing the mock
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */


// --- Mock Dependencies ---
// Define the object that will be used in the mock and in the tests
const RESOLUTION_STATUS_VALUES = {
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    NONE: 'NONE',
    SELF: 'SELF',
    NOT_FOUND: 'NOT_FOUND',
    AMBIGUOUS: 'AMBIGUOUS',
    INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE', // If used by the component
    FILTER_EMPTY: 'FILTER_EMPTY',             // If used by the component
    INVALID_INPUT: 'INVALID_INPUT',           // If used by the component
    ERROR: 'ERROR',
};

// Mock the targetResolutionService.js module
// The ResolutionStatus enum is now imported directly by CommandProcessor.js
jest.mock('../../services/targetResolutionService.js', () => ({
    __esModule: true, // Important for ES6 modules with named exports
    ResolutionStatus: RESOLUTION_STATUS_VALUES, // Inline the object here
    // default: jest.fn() // If CommandProcessor instantiated TargetResolutionService class directly
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Target Resolution Failed (Branch 6.1)', () => {
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
    const command = "examine table";
    const actionId = 'core:examine';
    const mockLocation = { id: 'study', name: 'A Study' };
    const resolutionErrorMsg = 'There are several tables. Which one do you mean?';
    const failureStatus = RESOLUTION_STATUS_VALUES.AMBIGUOUS; // Use the inlined object

    /** @type {ParsedCommand} */
    const mockParsedResult = {
        actionId: actionId,
        directObjectPhrase: 'table',
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: command,
        error: null
    };

    /** @type {ActionDefinition} */
    const mockActionDef = {
        id: actionId,
        name: 'examine', // Often good to have a name for user messages
        target_domain: 'environment', // A common domain for "examine"
        // target_type: 'entity', // This property might not be on ActionDefinition directly, often inferred or part of resolution logic
        // syntax: ['examine <dobj>'], // Often not directly used by CommandProcessor
        // preconditions: [],
        // effects: [],
        // description: '',
    };

    // MODIFIED: expectedFailureResult updated
    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: `Could not resolve target: ${resolutionErrorMsg}`,
        internalError: `Target resolution failed for action '${actionId}' by actor ${mockActor.id}. Status: ${failureStatus}. Resolver Error: ${resolutionErrorMsg}`
    };

    beforeEach(() => { // Removed async, as await new Promise is no longer needed
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = {
            resolveActionTarget: jest.fn().mockResolvedValue({
                status: failureStatus, // Failure status
                targetType: null,
                targetId: null,
                targetEntity: null, // TRS often returns the entity or null
                targetConnectionEntity: null, // TRS specific
                candidateIds: [], // TRS specific
                details: null, // TRS specific
                error: resolutionErrorMsg
            })
        };
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        };
        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn().mockResolvedValue(true), // Default to true, not called in this path
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
    });

    afterEach(() => {
        jest.resetModules();
    });

    it('[CPROC-TICKET-6.1] should handle target resolution failure correctly', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult);

        // Assert: Calls to services up to target resolution
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);

        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);

        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);

        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
        const actionContextArg = mockTargetResolutionService.resolveActionTarget.mock.calls[0][1];
        expect(actionContextArg.actingEntity).toBe(mockActor);
        expect(actionContextArg.currentLocation).toBe(mockLocation);
        expect(actionContextArg.parsedCommand).toBe(mockParsedResult);
        expect(actionContextArg.gameDataRepository).toBe(mockGameDataRepository);
        expect(actionContextArg.entityManager).toBe(mockEntityManager);
        expect(actionContextArg.logger).toBe(mockLogger);
        expect(actionContextArg.worldContext).toBe(mockWorldContext);
        expect(actionContextArg.eventBus).toBeDefined();
        expect(typeof actionContextArg.eventBus.dispatch).toBe('function');
        expect(actionContextArg.validatedEventDispatcher).toBe(mockValidatedEventDispatcher);

        // MODIFIED: expectedWarnMsg updated to include actorId and use # for private method in log
        const expectedWarnMsg = `CommandProcessor.#_resolveTarget: Target resolution failed for action '${actionId}' by actor ${mockActor.id}. Status: ${failureStatus}. Resolver Error: ${resolutionErrorMsg}`;
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // Using stringContaining as Jest mock calls might show the class name prefix which can be tricky.
        // If the exact string is preferred and works, that's also fine.
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Target resolution failed for action '${actionId}' by actor ${mockActor.id}. Status: ${failureStatus}. Resolver Error: ${resolutionErrorMsg}`));


        // Assert: logger.error NOT called by CommandProcessor logic for this specific failure type
        const relevantErrorCalls = mockLogger.error.mock.calls.filter(
            call => typeof call[0] === 'string' && (call[0].startsWith('CommandProcessor:') || call[0].startsWith('System Error Context:'))
        );
        expect(relevantErrorCalls.length).toBe(0);

        // Assert: safeEventDispatcher.dispatchSafely NOT called because the failure is handled before action dispatch
        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();

        // Assert: Expected debug logs for steps leading up to failure
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`); // Added actorId based on source
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${actionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchLocationContext: Successfully fetched current location ${mockLocation.id} for actor ${mockActor.id}.`);
        // MODIFIED: Updated log message to match source.
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: Building ActionContext. Actor: ${mockActor.id}, Location: ${mockLocation.id}, Command: ${actionId}`);
        // Corrected debug log expectations for _resolveTarget
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Attempting to resolve target for action '${actionId}'...`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Target resolution complete. Status: ${failureStatus}, Type: null, TargetID: null`);
    });

    it('[CPROC-TICKET-6.1] should handle target resolution failure (NOT_FOUND, no error message from resolver)', async () => {
        const notFoundStatus = RESOLUTION_STATUS_VALUES.NOT_FOUND;
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue({
            status: notFoundStatus,
            targetType: null,
            targetId: null,
            targetEntity: null,
            targetConnectionEntity: null,
            candidateIds: [],
            details: null,
            error: null // Resolver doesn't provide specific error message
        });

        // MODIFIED: expectedResultNoResolverError updated
        const expectedResultNoResolverError = {
            success: false,
            turnEnded: false,
            error: `Could not complete action: target is unclear or invalid (Status: ${notFoundStatus}).`, // Generic user error
            internalError: `Target resolution failed for action '${actionId}' by actor ${mockActor.id}. Status: ${notFoundStatus}. Resolver Error: None provided by resolver.`
        };

        const result = await commandProcessor.processCommand(mockActor, command);
        expect(result).toEqual(expectedResultNoResolverError);

        // MODIFIED: Corrected warn log expectation
        const expectedWarnMsg = `Target resolution failed for action '${actionId}' by actor ${mockActor.id}. Status: ${notFoundStatus}. Resolver Error: None provided by resolver.`;
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // Using stringContaining as Jest mock calls might show the class name prefix.
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(expectedWarnMsg));


        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();
    });
});