// src/tests/core/commandProcessor.processCommand.dispatchActionFailed.test.js

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js'; // Adjust path as needed

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
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
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Dispatch core:attempt_action Failed (Branch 7.2)', () => {
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
    const command = "look";
    const actionId = 'core:look';
    const mockLocation = { id: 'room1', name: 'A Room', description: 'A plain room.' };

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
        target_domain: 'none',
        target_type: null,
        syntax: ['look'],
        preconditions: [],
        effects: [],
        description: 'Look around.',
    };

    // Define expected payload for easier reuse
    const expectedActionAttemptPayload = {
        eventName: "core:attempt_action",
        actorId: mockActor.id,
        actionId: actionId,
        targetId: null, // Based on NONE resolution mock
        direction: null,
        originalInput: command,
    };

    // Corrected error messages based on CommandProcessor code
    const expectedUserError = 'Internal error: Failed to initiate your action due to a system issue.';
    const expectedInternalError = `CRITICAL: Failed to dispatch core:attempt_action event for actor ${mockActor.id}, command "${command}". SafeEventDispatcher reported failure. This may indicate a problem with event listeners or the event bus itself.`;
    const expectedSystemErrorDetails = `Failed to dispatch core:attempt_action: SafeEventDispatcher reported failure. Payload: ${JSON.stringify(expectedActionAttemptPayload)}`;

    // Corrected final result object
    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: expectedUserError,
        internalError: expectedInternalError
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = {
            resolveActionTarget: jest.fn().mockResolvedValue({
                status: mockResolutionStatus.NONE, // Successful resolution (no target needed)
                targetType: null,
                targetId: null,
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
                    return false; // Simulate dispatch failure for action attempt
                }
                if (eventName === 'core:system_error_occurred') {
                    return true; // Allow error dispatch to succeed for testing
                }
                return true; // Default for any other unexpected calls
            }),
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
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // No static properties to clean up
    });

    it('[CPROC-TICKET-7.2] should handle failure when dispatching core:attempt_action', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedFailureResult); // Uses updated expectedFailureResult

        // Assert: Calls to services up to and including target resolution
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);

        // Assert: safeEventDispatcher.dispatchSafely called for core:attempt_action (and failed)
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(2); // Once for action, once for system error
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenNthCalledWith(
            1,
            'core:attempt_action',
            expect.objectContaining(expectedActionAttemptPayload) // Use defined payload
        );

        // Assert: Warning logs
        // MODIFIED: Expect 2 warning calls
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);

        // Assert: Warning log from #dispatchWithErrorHandling due to dispatchSafely returning false
        const expectedWarnMsg1 = `CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher reported failure for 'core:attempt_action' event ('core:attempt_action'). This may indicate issues with event listeners or the bus. Payload: ${JSON.stringify(expectedActionAttemptPayload)}`;
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg1);

        // Assert: Warning log from processCommand when returning the error result
        const expectedWarnMsg2 = `CommandProcessor: Failed to dispatch action for command "${command}" (actor ${mockActor.id}). Returning error result from dispatch attempt.`;
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg2);

        // Assert: Error log from #_dispatchActionAttempt after failure
        const expectedDispatchAttemptErrorMsg = `CommandProcessor.#_dispatchActionAttempt: ${expectedInternalError}`;
        expect(mockLogger.error).toHaveBeenCalledWith(expectedDispatchAttemptErrorMsg);

        // Assert: safeEventDispatcher.dispatchSafely called for core:system_error_occurred
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenNthCalledWith(
            2,
            'core:system_error_occurred',
            expect.objectContaining({ // Use objectContaining for payload validation
                eventName: 'core:system_error_occurred',
                message: expectedUserError, // Use updated user error
                type: 'error',
                details: expectedSystemErrorDetails // Use updated details with payload
            })
        );

        // Assert: Error log from #dispatchSystemError context
        const expectedSystemErrorLogMsg = `CommandProcessor System Error Context: ${expectedSystemErrorDetails}`;
        const systemErrorLogCall = mockLogger.error.mock.calls.find(call => call[0] === expectedSystemErrorLogMsg);
        expect(systemErrorLogCall).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Ensure only the two specific errors were logged


        // Assert: logger.info for successful dispatch NOT called
        const successfulDispatchLog = mockLogger.info.mock.calls.find(
            call => call[0].includes('Dispatched core:attempt_action successfully')
        );
        expect(successfulDispatchLog).toBeUndefined();

        // Assert: General logs expected in this path (excluding the final success/dispatch messages)
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Attempting to parse: "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(mockParsedResult)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_parseCommand: Parsing successful for "${command}", action ID: ${actionId}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchLocationContext: Successfully fetched current location ${mockLocation.id} for actor ${mockActor.id}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: Building ActionContext. Actor: ${mockActor.id}, Location: ${mockLocation.id}, Command: ${actionId}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: ActionContext built successfully.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Attempting to resolve target for action '${actionId}'...`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Target resolution successful (Status: ${mockResolutionStatus.NONE}, Type: null, TargetID: null).`);
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Command parse and target resolution successful for "${command}". Dispatching core:attempt_action.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: core:attempt_action payload: ${JSON.stringify(expectedActionAttemptPayload)}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#dispatchWithErrorHandling: Attempting to dispatch 'core:attempt_action' event ('core:attempt_action') via SafeEventDispatcher.`);
        // Note: The debug log for SUCCESSFUL dispatch from #dispatchWithErrorHandling is NOT called here.
    });
});
