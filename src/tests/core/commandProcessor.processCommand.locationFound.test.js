// src/tests/core/commandProcessor.processCommand.locationFound.test.js

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
// Removed { virtual: true } as the module exists. Add back if necessary for other reasons.


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Success Path Continues] Location Found (Branch 5.4)', () => {
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
    const command = "look"; // Command string, could be "look item" too
    const actionId = 'core:look';
    const mockLocation = { id: 'room1', name: 'A Room', description: 'A plain room.' }; // Sample location object
    const resolvedTargetId = 'item1'; // Example target ID from resolution mock

    /** @type {ParsedCommand} */
    const mockParsedResult = {
        actionId: actionId,
        directObjectPhrase: null, // For "look" alone
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: command,
        error: null
    };

    /** @type {ActionDefinition} */
    const mockActionDef = {
        id: actionId,
        commandVerb: 'look',
        target_domain: 'location', // Requires location, or an item/feature within it
        target_type: 'feature', // Example, could be varied
        syntax: ['look', 'look <dobj>'],
        preconditions: [],
        effects: [],
        description: '',
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
                status: mockResolutionStatus.FOUND_UNIQUE, // Mock successful resolution
                targetType: 'entity', // Example type
                targetId: resolvedTargetId, // Example ID
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
                return eventName === 'core:attempt_action'; // Return true only for the expected event
            }),
        };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue(mockLocation) // Return the valid location object
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
        // Adding a slight delay to ensure any async operations in constructor complete
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // jest.restoreAllMocks(); // Consider this if you want to restore original implementations
    });

    it('[CPROC-TICKET-5.4] should proceed correctly when location is found', async () => {
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

        // Assert: logger.debug for successfully fetching location
        const expectedDebugMsg = `CommandProcessor.#_fetchLocationContext: Successfully fetched current location ${mockLocation.id} for actor ${mockActor.id}.`;
        expect(mockLogger.debug).toHaveBeenCalledWith(expectedDebugMsg);

        // Assert: targetResolutionService.resolveActionTarget called
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
        const actionContextArg = mockTargetResolutionService.resolveActionTarget.mock.calls[0][1];
        expect(actionContextArg).toBeDefined();
        expect(actionContextArg.currentLocation).toBe(mockLocation); // Crucial check
        expect(actionContextArg.actingEntity).toBe(mockActor);
        expect(actionContextArg.parsedCommand).toBe(mockParsedResult);

        // Assert: safeEventDispatcher.dispatchSafely called for core:attempt_action
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:attempt_action',
            expect.objectContaining({
                eventName: 'core:attempt_action',
                actorId: mockActor.id,
                actionId: actionId,
                targetId: resolvedTargetId, // Based on FOUND_UNIQUE resolution mock
                originalInput: command,
            })
        );

        // Assert: logger.error NOT called for location issues
        const relevantErrorCalls = mockLogger.error.mock.calls.filter(
            call => call[0].startsWith('CommandProcessor:') || call[0].startsWith('System Error Context:')
        );
        expect(relevantErrorCalls.length).toBe(0);

        // Assert: safeEventDispatcher.dispatchSafely NOT called for error events
        mockSafeEventDispatcher.dispatchSafely.mock.calls.forEach(call => {
            const eventName = call[0];
            if (eventName === 'core:attempt_action') return; // Skip the expected call
            expect(eventName).not.toBe('core:system_error_occurred');
            expect(eventName).not.toBe('core:command_parse_failed');
        });

        // Assert: General logs expected in success path
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Processing command "${command}" for actor ${mockActor.id}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`CommandProcessor.#_buildActionContext: ActionContext built successfully.`);

        // Corrected log expectations for #_dispatchActionAttempt
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Command parse and target resolution successful for "${command}". Dispatching core:attempt_action.`);
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor.#_dispatchActionAttempt: Dispatched core:attempt_action successfully for command "${command}" by actor ${mockActor.id}.`);

        // This log occurs in processCommand after successful dispatch.
        expect(mockLogger.info).toHaveBeenCalledWith(`CommandProcessor: Successfully processed and dispatched action for command "${command}" by actor ${mockActor.id}.`);
    });
});