// src/actions/integration/actionExecutor.executionError.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';
import PayloadValueResolverService from '../../services/payloadValueResolverService.js'; // Needed for context

// Import types for JSDoc
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */

// --- Mock Dependencies ---
/** @type {jest.Mocked<GameDataRepository>} */
const mockGameDataRepository = {
    // CRITICAL: Mock getAction to throw the error
    getActionDefinition: jest.fn(),
    // Add other methods as simple mocks if needed by constructor/setup
    getAllActionDefinitions: jest.fn(),
    getAllConnectionDefinitions: jest.fn(),
    getAllEntityDefinitions: jest.fn(),
    getAllItemDefinitions: jest.fn(),
    getAllLocationDefinitions: jest.fn(),
    getAllQuestDefinitions: jest.fn(),
    getAllTriggerDefinitions: jest.fn(),
    getBlockerDefinition: jest.fn(),
    getConnectionDefinition: jest.fn(),
    getEntityDefinition: jest.fn(),
    getInteractionTest: jest.fn(),
    getItemDefinition: jest.fn(),
    getLocationDefinition: jest.fn(),
    getObjectiveDefinition: jest.fn(),
    getQuestDefinition: jest.fn(),
    getStartingLocationId: jest.fn(),
    getStartingPlayerId: jest.fn(),
    getTrigger: jest.fn(),
    getWorldName: jest.fn(),
    getAllBlockerDefinitions: jest.fn(),
};

/** @type {jest.Mocked<TargetResolutionService>} */
const mockTargetResolutionService = {
    resolveActionTarget: jest.fn(),
};

/** @type {jest.Mocked<ActionValidationService>} */
const mockActionValidationService = {
    isValid: jest.fn(),
};

/** @type {jest.Mocked<EventBus>} */
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    listenerCount: jest.fn(),
};
const mockvalidatedEventDispatcher = {
    // Mock the method used by ActionExecutor.
    // .mockResolvedValue(true) assumes successful dispatch by default for most tests.
    // You can override this in specific tests if needed.
    dispatchValidated: jest.fn().mockResolvedValue(true),
};
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// --- Helper Functions ---

// Factory function remains the same
const payloadValueResolverService = (logger = mockLogger) => {
    return new PayloadValueResolverService({logger});
};

// Corrected helper to create the executor
const createExecutor = (logger = mockLogger) => {
    // <<< --- FIX: Create an INSTANCE of the service first --- >>>
    const resolverServiceInstance = payloadValueResolverService(logger);

    return new ActionExecutor({
        gameDataRepository: mockGameDataRepository,
        targetResolutionService: mockTargetResolutionService,
        actionValidationService: mockActionValidationService,
        eventBus: mockEventBus, // Keep if still needed elsewhere or by dispatcher internally
        logger: logger,
        payloadValueResolverService: resolverServiceInstance,
        validatedEventDispatcher: mockvalidatedEventDispatcher // <<< --- ADD THIS LINE --- >>>
    });
};

/**
 * Creates a minimal mock ActionContext.
 * @param {string} actionId - The action ID being executed.
 * @returns {ActionContext}
 */
const createMockActionContext = (actionId = 'test:action_exec_error') => {
    const player = new Entity('player_exec_error_test');
    const location = new Entity('room_exec_error_test');

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: { // Minimal mock, not used before the error point
            componentRegistry: {get: jest.fn(() => undefined)},
            getEntityInstance: jest.fn((id) => {
                if (id === player.id) return player;
                if (id === location.id) return location;
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Minimal parsed command
            actionId: actionId,
            directObjectPhrase: null,
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do something error',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch,
    };
    return baseContext;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Top-Level Execution Error (Sub-Task 2.1.5.14)', () => {

    let executor;
    let mockContext;
    const actionId = 'test:action_exec_error';
    let mockError; // The error object to be thrown

    beforeEach(() => {
        jest.clearAllMocks();

        // --- Setup Mocks ---
        // 1. Instantiate ActionExecutor with mock dependencies.
        executor = createExecutor(mockLogger);

        // Define the mock error to be thrown
        mockError = new Error('Unexpected Repo Error');

        // 2. Identify point and mock to throw error: mock gameDataRepository.getAction
        mockGameDataRepository.getActionDefinition.mockImplementation(() => {
            throw mockError;
        });

        // Create a basic mock context
        mockContext = createMockActionContext(actionId);
    });

    test('should catch unexpected error, log it, and return failure result', async () => {
        // --- Execute Action ---
        // 3. Call actionExecutor.executeAction
        let result;
        try {
            result = await executor.executeAction(actionId, mockContext);
        } catch (e) {
            // If the executeAction *itself* throws unhandled, the test fails here.
            // This assertion checks the function doesn't crash the runner.
            expect(true).toBe(false); // Force failure if executeAction throws outside its catch
        }


        // --- Verify Results ---

        // Assert: The top-level catch block was executed (verified by logger call and return value).

        // Assert: Mock Logger.error was called, logging the unexpected error.
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `ActionExecutor: Unexpected error executing action '${actionId}':`,
            mockError // Ensure the specific error object was logged
        );
        // Check other logs
        expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Only the initial debug log
        expect(mockLogger.debug).toHaveBeenCalledWith(`Executing action '${actionId}'...`, mockContext.parsedCommand);
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor log
        expect(mockLogger.warn).not.toHaveBeenCalled();


        // Assert: Returns ActionResult with success: false.
        expect(result).toBeDefined();
        expect(result.success).toBe(false);

        // Assert: ActionResult.messages contains the generic internal error message.
        expect(result.messages).toEqual(expect.arrayContaining([
            expect.objectContaining({
                text: 'An internal error occurred while processing the command.',
                type: 'error'
            })
        ]));

        // Assert: Subsequent services were NOT called because the error happened early.
        expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();
        expect(mockActionValidationService.isValid).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalled();

        // Assert: The mocked function was indeed called.
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);

        // Assert: The function does not crash the test runner (implicit pass if we get here).
        // The try/catch around the execution call helps verify this explicitly.
    });

    // --- Acceptance Criteria Check (Manual Review based on test above): ---
    // [X] Test case simulates an unexpected error being thrown during executeAction (e.g., from a dependency call). (mockGameDataRepository.getAction throws)
    // [X] Assertion verifies the correct logger call (error) for the unexpected error. (expect(mockLogger.error).toHaveBeenCalledWith...)
    // [X] Assertions verify the returned ActionResult (success: false, generic internal error message). (expect(result.success).toBe(false), expect(result.messages).toEqual(...))
    // [X] Test passes without unhandled exceptions. (Verified by test runner + explicit try/catch in test)
});