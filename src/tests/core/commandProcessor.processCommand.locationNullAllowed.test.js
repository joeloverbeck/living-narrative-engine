// src/tests/core/commandProcessor.processCommand.locationNullAllowed.test.js

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
// ResolutionStatus type import not strictly needed as it's handled by the mock
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */


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
};

// Mock the targetResolutionService.js module
jest.mock('../../services/targetResolutionService.js', () => ({
    __esModule: true, // Important for ES6 modules with named exports
    ResolutionStatus: RESOLUTION_STATUS_VALUES, // Use the constant here
    // default: jest.fn() // If CommandProcessor instantiated TargetResolutionService class directly
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Success Path Continues] Location Null (Action Allows No Location) (Branch 5.3)', () => {
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
    const command = "inventory";
    const actionId = 'core:inventory';
    const actionDomain = 'self'; // 'self' does not require a location

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
        name: 'Inventory', // Added for clarity
        target_domain: actionDomain,
        target_type: 'self', // For 'self' domain, target is usually 'self'
        // syntax: ['inventory'], // Optional details
        // preconditions: [],
        // effects: [],
        // description: '',
    };

    // Define expected payload for easier reuse
    const expectedActionAttemptPayload = {
        eventName: "core:attempt_action",
        actorId: mockActor.id,
        actionId: actionId,
        targetId: mockActor.id, // Target is self in this case
        direction: null,
        originalInput: command,
    };


    const expectedSuccessResult = {
        success: true,
        turnEnded: false,
        error: null,
        internalError: null
    };

    beforeEach(() => { // Removed async
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = {
            resolveActionTarget: jest.fn().mockResolvedValue({
                status: RESOLUTION_STATUS_VALUES.SELF, // <<< UPDATED to use the constant
                targetType: 'self',
                targetId: mockActor.id,
                error: null
            })
        };
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        };
        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn().mockImplementation(async (eventName, payload) => {
                if (eventName === 'core:attempt_action') {
                    return true; // Simulate successful dispatch of the action attempt
                }
                // For this test, we only care about the attempt_action dispatch succeeding.
                console.warn(`Test Warning: Unexpected event dispatched via mockSafeEventDispatcher: ${eventName}`);
                return false;
            }),
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue(null) // Location is null
        };
        mockEntityManager = { getEntityInstance: jest.fn() };
        mockGameDataRepository = {
            getActionDefinition: jest.fn().mockReturnValue(mockActionDef) // Action allows null location
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

    it('[CPROC-TICKET-5.3] should proceed correctly when location is null but action allows it', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedSuccessResult);

        // Assert: Calls to initial services
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);

        // Assert: targetResolutionService.resolveActionTarget called
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
        const actionContextArg = mockTargetResolutionService.resolveActionTarget.mock.calls[0][1];
        expect(actionContextArg).toBeDefined();
        expect(actionContextArg.currentLocation).toBeNull(); // Crucial check for this test case
        expect(actionContextArg.actingEntity).toBe(mockActor);
        expect(actionContextArg.parsedCommand).toBe(mockParsedResult);

        // Assert: safeEventDispatcher.dispatchSafely called for core:attempt_action
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:attempt_action',
            expect.objectContaining(expectedActionAttemptPayload) // Use defined payload constant
        );

        // Assert: logger.error NOT called for this success path
        const relevantErrorCalls = mockLogger.error.mock.calls.filter(
            call => call[0].startsWith('CommandProcessor:') || call[0].startsWith('System Error Context:')
        );
        expect(relevantErrorCalls.length).toBe(0);


        // Assert: safeEventDispatcher.dispatchSafely NOT called for error events
        mockSafeEventDispatcher.dispatchSafely.mock.calls.forEach(call => {
            const eventName = call[0];
            // Allow core:attempt_action
            if (eventName === 'core:attempt_action') return;
            // Disallow other core events often handled by CommandProcessor on failure
            expect(eventName).not.toBe('core:system_error_occurred');
            expect(eventName).not.toBe('core:command_parse_failed');
        });

        // Assert: General logs indicating successful processing flow
        // (Ensure all private method log prefixes use '#')
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${actionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchLocationContext: Actor ${mockActor.id} has no current location, but action '${actionId}' (domain: '${actionDomain}') allows this. Proceeding without location context.`); // Log for null location allowed
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: Building ActionContext. Actor: ${mockActor.id}, Location: null, Command: ${actionId}`); // Location is null
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: ActionContext built successfully.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Attempting to resolve target for action '${actionId}'...`);

        // Corrected info log for dispatch attempt initiation
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Command parse and target resolution successful for "${command}". Dispatching core:attempt_action.`);
        // Corrected debug log for payload
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: core:attempt_action payload: ${JSON.stringify(expectedActionAttemptPayload)}`);
        // Corrected debug log for dispatch helper entry
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#dispatchWithErrorHandling: Attempting to dispatch 'core:attempt_action' event ('core:attempt_action') via SafeEventDispatcher.`);
        // Corrected debug log for dispatch helper success
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher successfully processed dispatch for 'core:attempt_action' event ('core:attempt_action').`);
        // Corrected info log for successful dispatch
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Dispatched core:attempt_action successfully for command "${command}" by actor ${mockActor.id}.`);
        // Final success log from processCommand
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Successfully processed and dispatched action for command "${command}" by actor ${mockActor.id}.`);

    });
});