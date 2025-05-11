// src/tests/core/commandProcessor.processCommand.invalidActor.test.js

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import CommandProcessor from '../../core/commands/commandProcessor.js'; // Adjust path as needed

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/commands/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../core/interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Needed for constructor
/** @typedef {import('../../core/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/targetResolutionService.js').ResolutionStatus} ResolutionStatus */

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
    // Add a mock default export if CommandProcessor constructor needs it, otherwise optional
    // default: jest.fn().mockImplementation(...)
}));


// --- Test Suite ---
describe('CommandProcessor.processCommand() [Failure] Invalid Actor Input (Branch 1.1)', () => {
    /** @type {ICommandParser} */ let mockCommandParser;
    /** @type {ITargetResolutionService} */ let mockTargetResolutionService;
    /** @type {ILogger} */ let mockLogger;
    /** @type {ISafeEventDispatcher} */ let mockSafeEventDispatcher;
    /** @type {IValidatedEventDispatcher} */ let mockValidatedEventDispatcher; // Still needed for constructor
    /** @type {IWorldContext} */ let mockWorldContext;
    /** @type {EntityManager} */ let mockEntityManager;
    /** @type {GameDataRepository} */ let mockGameDataRepository;
    /** @type {CommandProcessor} */ let commandProcessor;

    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: 'Internal error: Cannot process command without a valid actor.',
        // MODIFIED LINE: Updated internalError to match actual output
        internalError: 'Invalid or missing actor provided to processCommand.'
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        // Create basic mocks for all dependencies
        mockCommandParser = {
            parse: jest.fn(),
        };
        mockTargetResolutionService = {
            resolveActionTarget: jest.fn(),
        };
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        };
        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn(),
        };
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn(),
        };
        mockWorldContext = {
            getLocationOfEntity: jest.fn(),
        };
        mockEntityManager = {
            getEntityInstance: jest.fn(),
        };
        mockGameDataRepository = {
            getActionDefinition: jest.fn(),
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
        // Allow any microtasks from constructor to resolve (e.g. async import resolution)
        // Replaced setImmediate with setTimeout for better portability
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // jest.restoreAllMocks(); // Consider if you need to restore mocks between tests.
    });

    // --- Test Scenarios ---
    const testCases = [
        { scenario: 'Scenario 1: actor is null', actorInput: null },
        { scenario: 'Scenario 2: actor is undefined', actorInput: undefined },
        { scenario: 'Scenario 3: actor is an object without an id property', actorInput: {} },
        { scenario: 'Scenario 4: actor has an id property, but it\'s not a string', actorInput: { id: 123 } },
    ];

    testCases.forEach(({ scenario, actorInput }) => {
        it(`[CPROC-TICKET-1.1] ${scenario}`, async () => {
            const command = "look"; // Dummy command, should not be processed

            // Act
            const result = await commandProcessor.processCommand(actorInput, command);

            // Assert: Check the returned result object
            expect(result).toEqual(expectedFailureResult);

            // Assert: Check logger.error call
            expect(mockLogger.error).toHaveBeenCalled();
            // Expected log message for the logger:
            expect(mockLogger.error).toHaveBeenCalledWith(
                'CommandProcessor.#_validateInput: Invalid or missing actor entity provided.'
            );

            // Assert: Check that other core methods were NOT called
            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(mockGameDataRepository.getActionDefinition).not.toHaveBeenCalled();
            expect(mockWorldContext.getLocationOfEntity).not.toHaveBeenCalled();
            expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();

            // Assert: Check that specific log levels were NOT called (besides error)
            const infoProcessingCall = mockLogger.info.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].startsWith('CommandProcessor: Processing command')
            );
            expect(infoProcessingCall).toBeUndefined();
            expect(mockLogger.warn).not.toHaveBeenCalled();

            // Filter out known constructor/setup debug logs to check for processing-specific ones
            const constructorDebugLogContent = "CommandProcessor: Instance created and dependencies validated. ResolutionStatus is now statically imported.";
            const processingDebugCalls = mockLogger.debug.mock.calls.filter(
                call => call[0] !== constructorDebugLogContent
            );
            expect(processingDebugCalls.length).toBe(0);
        });
    });
});