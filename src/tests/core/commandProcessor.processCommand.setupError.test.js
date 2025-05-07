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
// This type import is for test-side type checking and doesn't affect the runtime mock.
// It's okay if ActualResolutionStatus points to a different file than the one CommandProcessor imports from for runtime.
/** @typedef {import('../../types/resolutionStatus.js').ResolutionStatus} ActualResolutionStatus */ // For typing mock


// --- Mock Dynamic Import for ResolutionStatus ---
// Mock the actual module 'resolutionStatus.js' that CommandProcessor imports.
// The path is relative to this test file.
jest.mock('../../types/resolutionStatus.js', () => ({
    __esModule: true,
    // Make the default export undefined, as CommandProcessor.js uses:
    // import ResolutionStatus from '../types/resolutionStatus.js';
    default: undefined,
    // Also mock the named export 'ResolutionStatus' as undefined for completeness,
    // though 'default' is the one targeted by the import in CommandProcessor.js.
    ResolutionStatus: undefined
}));


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

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

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
        // Reset modules to ensure other tests get a fresh version of ResolutionStatus
        // This is crucial when mocking built-in or commonly used modules.
        jest.resetModules();
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
            // Mock additional properties if needed by downstream logic, though not strictly for this error path
        });

        // mockTargetResolutionService.resolveActionTarget needs to return a structure
        // whose 'status' property will be checked against the (now undefined) ResolutionStatus properties.
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue({
            status: 'FOUND_UNIQUE', // This value will be used in `status === ResolutionStatus.FOUND_UNIQUE`
                                    // where ResolutionStatus is undefined, triggering the TypeError.
            targetType: 'entity',
            targetId: 'item1',
            targetEntity: { id: 'item1', name: 'An Item'}, // Mocking targetEntity for completeness if any code path uses it.
            error: null
        });

        const result = await commandProcessor.processCommand(mockActor, commandToProcess);

        const expectedErrorMsgContent = "Cannot read properties of undefined (reading 'FOUND_UNIQUE')";
        // This error message arises because the code attempts to access `ResolutionStatus.FOUND_UNIQUE`
        // when `ResolutionStatus` itself is undefined due to the mock.

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
        if (criticalErrorLog) { // Ensure criticalErrorLog is defined before accessing its elements
            expect(criticalErrorLog[1]).toBeInstanceOf(TypeError); // The original error should be a TypeError
        }


        // Check system error dispatch
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                eventName: 'core:system_error_occurred',
                message: "An unexpected internal error occurred while processing your command. Please try again later.",
                type: 'error',
                details: expect.stringContaining(expectedErrorMsgContent)
            })
        );

        // Ensure parsing and initial steps were attempted before the TypeError
        expect(mockCommandParser.parse).toHaveBeenCalledWith(commandToProcess);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith('look');
        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
        // Target resolution is called, and the error occurs *within* #_resolveTarget or when processing its result,
        // specifically when `ResolutionStatus.FOUND_UNIQUE` is accessed.
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalled();

        // The log for "Processing command" should still occur
        const processingInfoLog = mockLogger.info.mock.calls.find(
            callArgs => typeof callArgs[0] === 'string' && callArgs[0].startsWith(`CommandProcessor: Processing command "${commandToProcess}" for actor ${mockActor.id}`)
        );
        expect(processingInfoLog).toBeDefined();
    });
});