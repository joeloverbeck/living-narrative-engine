// src/tests/core/commandProcessor.processCommand.emptyCommand.test.js

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
/** @typedef {import('../../entities/entity.js').default} Entity */


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
describe('CommandProcessor.processCommand() [Failure] Empty Command Input (Branch 1.2)', () => {
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
    const mockActor = { id: 'player1' }; // Valid mock actor

    const expectedFailureResult = {
        success: false,
        turnEnded: false,
        error: undefined, // Specifically undefined
        internalError: 'Empty command string received.'
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockCommandParser = { parse: jest.fn() };
        mockTargetResolutionService = { resolveActionTarget: jest.fn() };
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        };
        mockSafeEventDispatcher = { dispatchSafely: jest.fn() };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockWorldContext = { getLocationOfEntity: jest.fn() };
        mockEntityManager = { getEntityInstance: jest.fn() };
        mockGameDataRepository = { getActionDefinition: jest.fn() };

        // REMOVED: CommandProcessor.ResolutionStatus = mockResolutionStatus;

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
        // Allow constructor's async import promise to resolve if it wasn't fully synchronous
        // If this line were active, it would be: await new Promise(resolve => setTimeout(resolve, 0));
        // await new Promise(resolve => setImmediate(resolve));
    });

    afterEach(() => {
        // REMOVED: CommandProcessor.ResolutionStatus = null;
    });

    // --- Test Scenarios ---
    const testCases = [
        { scenario: 'Scenario 1: command is null', commandInput: null },
        { scenario: 'Scenario 2: command is undefined', commandInput: undefined },
        { scenario: 'Scenario 3: command is an empty string', commandInput: "" },
        { scenario: 'Scenario 4: command is whitespace only', commandInput: " \t\n " },
    ];

    testCases.forEach(({ scenario, commandInput }) => {
        it(`[CPROC-TICKET-1.2] ${scenario}`, async () => {
            // Act
            const result = await commandProcessor.processCommand(mockActor, commandInput);

            // Assert: Check the returned result object
            expect(result).toEqual(expectedFailureResult);

            // Assert: Check logger.warn call
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            // MODIFIED EXPECTED LOG MESSAGE:
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `CommandProcessor.#_validateInput: Empty or invalid command string provided by actor ${mockActor.id}.`
            );

            // Assert: logger.error should NOT have been called
            expect(mockLogger.error).not.toHaveBeenCalled();

            // Assert: Check that other core methods were NOT called
            expect(mockCommandParser.parse).not.toHaveBeenCalled();
            expect(mockGameDataRepository.getActionDefinition).not.toHaveBeenCalled();
            expect(mockWorldContext.getLocationOfEntity).not.toHaveBeenCalled();
            expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled(); // No failure events dispatched here

            // Assert: Check that the main processing info log was NOT called
            const infoProcessingCall = mockLogger.info.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].startsWith('CommandProcessor: Processing command')
            );
            expect(infoProcessingCall).toBeUndefined();
        });
    });
});