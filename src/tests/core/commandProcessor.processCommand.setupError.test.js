// src/tests/core/commandProcessor.processCommand.setupError.test.js

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
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../services/targetResolutionService.js').ResolutionStatus} ActualResolutionStatus */ // For typing mock

// --- Mock Dynamic Import for ResolutionStatus ---
// This mock ensures that when CommandProcessor.js tries to import ResolutionStatus, it gets undefined.
jest.mock('../../services/targetResolutionService.js', () => ({
    __esModule: true, // Required for modules with named exports when mocking
    // Intentionally omit ResolutionStatus to make it undefined upon import
    // default is also omitted but not directly used by CommandProcessor for instantiation.
    // If TargetResolutionService class itself were newed up by CommandProcessor, we'd need to mock its default export.
    // For this test, ITargetResolutionService is injected, so this mock focuses on the named export ResolutionStatus.
}), { virtual: true });


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Setup Error - Missing ResolutionStatus (Branch 2.1)', () => {
    /** @type {ICommandParser} */ let mockCommandParser;
    /** @type {ITargetResolutionService} */ let mockTargetResolutionService;
    /** @type {ILogger} */ let mockLogger;
    /** @type {ISafeEventDispatcher} */ let mockSafeEventDispatcher;
    /** @type {IValidatedEventDispatcher} */ let mockValidatedEventDispatcher;
    /** @type {IWorldContext} */ let mockWorldContext;
    /** @type {EntityManager} */ let mockEntityManager;
    /** @type {GameDataRepository} */ let mockGameDataRepository;
    /** @type {CommandProcessor} */ let commandProcessor;

    /** @type {Entity} */
    const mockActor = { id: 'player1' };
    const commandToProcess = "look at item"; // A command that would involve target resolution

    beforeEach(() => { // Removed async as await new Promise is no longer needed
        jest.clearAllMocks();

        mockCommandParser = { parse: jest.fn() };
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
        mockWorldContext = { getLocationOfEntity: jest.fn() };
        mockEntityManager = { getEntityInstance: jest.fn() };
        mockGameDataRepository = { getActionDefinition: jest.fn() };

        // DO NOT set CommandProcessor.ResolutionStatus = null; It no longer exists.
        // The jest.mock above handles making the imported ResolutionStatus undefined.

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
        // DO NOT set CommandProcessor.ResolutionStatus = null;
        jest.resetModules(); // Important to reset modules if other tests import the same mocked module
    });

    it('[CPROC-TICKET-2.1] should fail gracefully if ResolutionStatus is not loaded (imported as undefined)', async () => {
        // Setup mocks to allow execution to reach the point where ResolutionStatus is used
        mockCommandParser.parse.mockReturnValue({
            actionId: 'look',
            verb: 'look',
            directObjectPhrase: 'item',
            error: null
        });
        mockGameDataRepository.getActionDefinition.mockReturnValue({
            id: 'look',
            name: 'look',
            target_domain: 'environment', // A domain that requires target resolution and status checking
            template: "You look at {target}"
        });
        mockWorldContext.getLocationOfEntity.mockReturnValue({
            id: 'location1',
            name: 'A Room',
            entities: new Set(['item1']),
            exits: new Map()
        });
        // mockTargetResolutionService.resolveActionTarget needs to return a structure
        // whose 'status' property will be checked against the (undefined) ResolutionStatus properties.
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue({
            status: 'FOUND_UNIQUE', // This value will be used in `successfulStatuses.includes(...)`
            // but `successfulStatuses` itself will fail to initialize.
            targetType: 'entity',
            targetId: 'item1',
            targetEntity: { id: 'item1', name: 'An Item'},
            error: null
        });

        const result = await commandProcessor.processCommand(mockActor, commandToProcess);

        const expectedErrorMsgContent = "Cannot read properties of undefined (reading 'FOUND_UNIQUE')";
        // This is because successfulStatuses = [ResolutionStatus.FOUND_UNIQUE,...] will be the first to fail.

        expect(result.success).toBe(false);
        expect(result.turnEnded).toBe(false);
        expect(result.error).toEqual("An unexpected internal error occurred while processing your command. Please try again later.");
        expect(result.internalError).toEqual(expect.stringContaining(expectedErrorMsgContent));
        expect(result.internalError).toEqual(expect.stringContaining(`Critical unexpected error during command processing pipeline for "${commandToProcess}" by actor ${mockActor.id}:`));

        // Check logger calls related to the main catch block
        const criticalErrorLog = mockLogger.error.mock.calls.find(
            callArgs => typeof callArgs[0] === 'string' && callArgs[0].includes('CommandProcessor: CRITICAL UNEXPECTED ERROR.') && callArgs[0].includes(expectedErrorMsgContent)
        );
        expect(criticalErrorLog).toBeDefined();
        expect(criticalErrorLog[1]).toBeInstanceOf(TypeError); // The original error

        // Check system error dispatch
        // const systemErrorDispatchPayload = mockSafeEventDispatcher.dispatchSafely.mock.calls[0][1]; // This line can be kept for debugging if needed, but is not strictly necessary for the assertion below.
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                eventName: 'core:system_error_occurred',
                message: "An unexpected internal error occurred while processing your command. Please try again later.", // Corrected message
                type: 'error',
                details: expect.stringContaining(expectedErrorMsgContent)
            })
        );

        // Ensure parsing and initial steps were attempted
        expect(mockCommandParser.parse).toHaveBeenCalledWith(commandToProcess);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith('look');
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalled(); // It's called before the check that uses ResolutionStatus

        // The log for "Processing command" should still occur
        const processingInfoLog = mockLogger.info.mock.calls.find(
            callArgs => typeof callArgs[0] === 'string' && callArgs[0].startsWith(`CommandProcessor: Processing command "${commandToProcess}" for actor ${mockActor.id}`)
        );
        expect(processingInfoLog).toBeDefined();
    });
});