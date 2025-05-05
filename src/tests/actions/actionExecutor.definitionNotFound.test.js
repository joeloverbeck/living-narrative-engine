// src/actions/actionExecutor.definitionNotFound.test.js

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
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

// --- Mock Dependencies ---
const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};
const mockTargetResolutionService = {
    resolveActionTarget: jest.fn(),
};
const mockActionValidationService = {
    isValid: jest.fn(),
};
const mockEventBus = {
    dispatch: jest.fn(),
};
const mockvalidatedEventDispatcher = {
    // Mock the method used by ActionExecutor.
    // .mockResolvedValue(true) assumes successful dispatch by default for most tests.
    // You can override this in specific tests if needed.
    dispatchValidated: jest.fn().mockResolvedValue(true),
};
// --- Mock Logger ---
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

// Simplified context creator - details don't matter much for this test path
const createMockActionContext = (overrides = {}) => {
    const player = new Entity('player_def_not_found_test');
    const location = new Entity('room_def_not_found_test');

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: {
            // Mock only if absolutely necessary for setup before the failure point
            componentRegistry: {get: jest.fn(() => undefined)},
            getEntityInstance: jest.fn((id) => {
                if (id === player.id) return player;
                if (id === location.id) return location;
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Minimal parsed command
            actionId: overrides.actionId || 'test:action_def_not_found',
            directObjectPhrase: null,
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do something undefined',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch,
        ...overrides,
    };
    return baseContext;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test', () => {

    let executor;
    let mockContext;
    const actionId = 'test:action_def_not_found'; // Action ID to test

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        // --- Setup Mocks ---
        // 1. Instantiate ActionExecutor with mocks
        executor = createExecutor(mockLogger);

        // 2. Mock gameDataRepository.getAction('test:action') to return undefined
        mockGameDataRepository.getActionDefinition.mockReturnValue(undefined);

        // Create a basic mock context for the execution call
        mockContext = createMockActionContext({actionId: actionId});
    });

    describe('executeAction - Action Definition Not Found (Sub-Task 2.1.5.8)', () => {
        test('should return failure, log error, and not call subsequent services when action definition is not found', async () => {
            // --- Execute Action ---
            // 3. Call actionExecutor.executeAction
            const result = await executor.executeAction(actionId, mockContext);

            // --- Verify Results ---
            // Assert: The returned Promise resolves to an ActionResult object
            expect(result).toBeDefined();
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('messages');

            // Assert: ActionResult.success is false
            expect(result.success).toBe(false);

            // Assert: ActionResult.messages contains an appropriate error message
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining(`Internal Error: Action '${actionId}' not defined.`),
                    // text: `Internal Error: Action '${actionId}' is not defined.`, // Stricter check if preferred
                    type: 'error'
                })
            ]));

            // Assert: Mock Logger.error was called with a message indicating the definition wasn't found
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Helper #fetchActionDefinition: Action definition not found for ID: ${actionId}`)
            );
            // Ensure other log levels weren't called unexpectedly
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Called once at the start of executeAction
            expect(mockLogger.debug).toHaveBeenCalledWith(`Executing action '${actionId}'...`, mockContext.parsedCommand);

            expect(mockLogger.info).toHaveBeenCalledTimes(2);
            expect(mockLogger.info).toHaveBeenCalledWith('ActionExecutor initialized with dependencies (including ValidatedEventDispatcher).');

            expect(mockLogger.warn).not.toHaveBeenCalled();


            // Assert: TargetResolutionService.resolveActionTarget was NOT called
            expect(mockTargetResolutionService.resolveActionTarget).not.toHaveBeenCalled();

            // Assert: ActionValidationService.isValid was NOT called
            expect(mockActionValidationService.isValid).not.toHaveBeenCalled();

            // Assert: EventBus.dispatch was NOT called
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();

            // Verify getAction was actually called
            expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
            expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);
        });
    });
});