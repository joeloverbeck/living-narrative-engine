// src/actions/integration/actionExecutor.validationFailure.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';
import {ResolutionStatus} from '../../services/targetResolutionService.js';
// Import the actual class to check the instance type passed to the mock
import {ActionTargetContext} from '../../models/actionTargetContext.js';

// Import types for JSDoc
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

// --- Mock Dependencies ---
/** @type {jest.Mocked<GameDataRepository>} */
const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
    // Add other methods if needed by ActionExecutor constructor or other paths
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
    // Add other methods if needed by ActionExecutor constructor or other paths
    _checkEntityComponentRequirements: jest.fn(), // Example if needed elsewhere
    _checkSinglePrerequisite: jest.fn(), // Example if needed elsewhere
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

// --- Mock getDisplayName (required by ActionExecutor internals/setup) ---
// Import the actual function signature for proper mocking
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from '../../services/payloadValueResolverService.js';

jest.mock('../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.id ?? 'mock unknown'), // Simple mock
    TARGET_MESSAGES: {},
}));


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
 * Creates a mock ActionContext.
 * @param {string} actionId - The action ID being executed.
 * @param {Entity} playerEntity - The player entity.
 * @returns {ActionContext}
 */
const createMockActionContext = (actionId = 'test:action', playerEntity) => {
    const location = new Entity('room_validation_fail_test');

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: playerEntity, // Use the provided player entity
        currentLocation: location,
        entityManager: { // Simple mock
            componentRegistry: {get: jest.fn(() => undefined)},
            getEntityInstance: jest.fn((id) => {
                if (playerEntity && id === playerEntity.id) return playerEntity;
                if (id === location.id) return location;
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Minimal parsed command
            actionId: actionId,
            directObjectPhrase: 'target object', // Needs some value if domain != none
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do test action target object',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch,
    };
    return baseContext;
};

/**
 * Creates a basic mock ActionDefinition.
 * @param {string} id - The action ID.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition = (id = 'test:action') => {
    /** @type {ActionDefinition} */
    const definition = {
        id: id,
        target_domain: 'environment', // Assume a domain requiring entity resolution
        template: 'test template for {target}',
        // No dispatch_event needed as it won't be reached
    };
    return definition;
};

/**
 * Creates a mock TargetResolutionResult representing a successful unique entity result.
 * @param {string} targetId - The ID of the resolved target entity.
 * @param {Entity} targetEntity - The resolved target entity instance.
 * @returns {TargetResolutionResult}
 */
const createMockSuccessResolutionResult = (targetId, targetEntity) => {
    /** @type {TargetResolutionResult} */
    const result = {
        status: ResolutionStatus.FOUND_UNIQUE,
        targetType: 'entity', // Specific type for this test
        targetId: targetId,
        targetEntity: targetEntity,
        targetConnectionEntity: null,
        candidateIds: [targetId],
        details: null,
        error: null,
    };
    return result;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Validation Failure (Sub-Task 2.1.5.10)', () => {

    let executor;
    let mockContext;
    const actionId = 'test:action_validation_fail';
    let mockActionDef;
    let mockPlayerEntity;
    let mockTargetEntity;
    let mockResolutionResult;
    let expectedTargetContext;

    beforeEach(() => {
        jest.clearAllMocks();

        // --- Setup Mocks ---
        // 1. Instantiate ActionExecutor with mocks
        executor = createExecutor(mockLogger);

        // 2. Mock gameDataRepository.getAction to return a valid definition
        mockActionDef = createMockActionDefinition(actionId);
        mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

        // 3. Prepare entities and context
        mockPlayerEntity = new Entity('player_validator_fail');
        mockTargetEntity = new Entity('target_validator_fail');
        mockContext = createMockActionContext(actionId, mockPlayerEntity);

        // 4. Mock targetResolutionService.resolveActionTarget for success
        mockResolutionResult = createMockSuccessResolutionResult(mockTargetEntity.id, mockTargetEntity);
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

        // 5. Mock actionValidationService.isValid to return FALSE <<< CRITICAL MOCK
        mockActionValidationService.isValid.mockReturnValue(false);

        // Define the expected ActionTargetContext based on the successful resolution
        // This isn't a mock, but what we expect to be constructed and passed to isValid
        expectedTargetContext = ActionTargetContext.forEntity(mockTargetEntity.id);

    });

    test('should return failure, log warning, and not dispatch event when action validation fails', async () => {
        // --- Execute Action ---
        const result = await executor.executeAction(actionId, mockContext);

        // --- Verify Results ---

        // Assert: Returns ActionResult with success: false
        expect(result).toBeDefined();
        expect(result.success).toBe(false);

        // Assert: ActionResult.messages contains the generic failure message
        expect(result.messages).toEqual(expect.arrayContaining([
            expect.objectContaining({
                text: 'You cannot do that right now.',
                type: 'info'
            })
        ]));

        // Assert: gameDataRepository.getAction was called
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getActionDefinition).toHaveBeenCalledWith(actionId);

        // Assert: targetResolutionService.resolveActionTarget was called
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledWith(mockActionDef, mockContext);

        // Assert: actionValidationService.isValid was called with the correct arguments
        expect(mockActionValidationService.isValid).toHaveBeenCalledTimes(1);
        // Check arguments: definition, actor, constructed target context
        expect(mockActionValidationService.isValid).toHaveBeenCalledWith(
            mockActionDef,
            mockPlayerEntity,
            // Use objectContaining to verify the structure and key properties of the ActionTargetContext instance
            expect.objectContaining({
                type: expectedTargetContext.type,
                entityId: expectedTargetContext.entityId,
                direction: expectedTargetContext.direction,
            })
        );

        // Assert: Mock Logger.warn was called indicating validation failure
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Helper #validateAction: Action '${actionId}' failed validation.`)
        );
        // Ensure error wasn't called for this specific failure
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Allow info/debug logs from setup/start/resolution/validation steps
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor init log
        expect(mockLogger.debug).toHaveBeenCalledTimes(9); // execute start, definition found, resolution result, context constructed, validation result

        // Assert: EventBus.dispatch was NOT called
        expect(mockEventBus.dispatch).not.toHaveBeenCalled();

    });

    // Acceptance Criteria Check (Manual Review based on test above):
    // [X] Test case where actionValidationService.isValid returns false is implemented.
    // [X] Assertions verify that prerequisite service methods (getAction, resolveActionTarget) were called.
    // [X] Assertions verify the returned ActionResult structure and content (success: false, generic message).
    // [X] Assertion verifies the correct logger call (warn).
    // [X] Assertion verifies that EventBus.dispatch was not called.
    // [X] Assertion verifies actionValidationService.isValid was called with correct arguments.
    // [X] Test passes. (Verified by running the tests)
});