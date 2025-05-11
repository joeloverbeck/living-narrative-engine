// src/tests/core/commandProcessor.processCommand.dispatchActionSucceeded.test.js

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
}), { virtual: true }); // virtual: true can often be removed if path is unambiguous


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Success] Dispatch core:attempt_action Succeeded (Branch 7.1)', () => {
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

    const expectedSuccessResult = {
        success: true,
        turnEnded: false,
        error: null,
        internalError: null
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockCommandParser = {
            parse: jest.fn().mockReturnValue(mockParsedResult)
        };
        mockTargetResolutionService = {
            resolveActionTarget: jest.fn().mockResolvedValue({
                status: mockResolutionStatus.NONE, // Successful resolution
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
            dispatchSafely: jest.fn().mockResolvedValue(true), // Simulate successful dispatch for all calls
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue(mockLocation)
        };
        mockEntityManager = { getEntityInstance: jest.fn() }; // Mock getEntityInstance if constructor needs it indirectly.
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
        // Allow constructor's async import promise to resolve (if any - current constructor is synchronous after ResolutionStatus static import)
        // However, the constructor log is an info log, so ensure mockLogger.info is set up before instantiation.
        // For this test structure, beforeEach already sets up mocks before new CommandProcessor.
        await new Promise(resolve => setTimeout(resolve, 0)); // Retain if there are other microtasks from constructor
    });

    afterEach(() => {
        // No cleanup needed for static properties in this version
    });

    it('[CPROC-TICKET-7.1] should handle successful dispatch of core:attempt_action', async () => {
        // Act
        const result = await commandProcessor.processCommand(mockActor, command);

        // Assert: Check the returned result object
        expect(result).toEqual(expectedSuccessResult);

        // Assert: Calls to services in the success path
        expect(mockCommandParser.parse).toHaveBeenCalledTimes(1);
        expect(mockCommandParser.parse).toHaveBeenCalledWith(command);

        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);

        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);

        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
        const actionContextArg = mockTargetResolutionService.resolveActionTarget.mock.calls[0][1];
        expect(actionContextArg.currentLocation).toBe(mockLocation);

        // Assert: safeEventDispatcher.dispatchSafely called once for core:attempt_action
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:attempt_action',
            expect.objectContaining({
                eventName: 'core:attempt_action',
                actorId: mockActor.id,
                actionId: actionId,
                targetId: null,
                direction: null,
                originalInput: command,
            })
        );

        // Assert: logger.info for successful dispatch (THIS WAS THE MAIN FAILING ASSERTION)
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Dispatched core:attempt_action successfully for command "${command}" by actor ${mockActor.id}.`);

        // Assert: logger.error and logger.warn NOT called
        const errorCalls = mockLogger.error.mock.calls.filter(call => call[0].startsWith('CommandProcessor:'));
        expect(errorCalls.length).toBe(0);

        const warnCalls = mockLogger.warn.mock.calls.filter(call => call[0].startsWith('CommandProcessor:'));
        expect(warnCalls.length).toBe(0);


        // Assert: General logs expected in this success path
        // Constructor log (already happened, but good to be aware it's one of the info calls)
        // expect(mockLogger.info).toHaveBeenCalledWith("CommandProcessor: Instance created and dependencies validated. ResolutionStatus is now statically imported.");

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
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Target resolution complete. Status: ${mockResolutionStatus.NONE}, Type: null, TargetID: null`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_resolveTarget: Target resolution successful (Status: ${mockResolutionStatus.NONE}, Type: null, TargetID: null).`);

        // This is the info log *before* dispatching core:attempt_action
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Command parse and target resolution successful for "${command}". Dispatching core:attempt_action.`);

        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: core:attempt_action payload: ${JSON.stringify({
            eventName: "core:attempt_action",
            actorId: mockActor.id,
            actionId: actionId,
            targetId: null,
            direction: null,
            originalInput: command,
        })}`);

        // This log comes from within #dispatchWithErrorHandling
        expect(mockLogger.debug).toHaveBeenCalledWith("CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher successfully processed dispatch for 'core:attempt_action' event ('core:attempt_action').");

        // This is the final success log from processCommand itself
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Successfully processed and dispatched action for command "${command}" by actor ${mockActor.id}.`);
    });
});
