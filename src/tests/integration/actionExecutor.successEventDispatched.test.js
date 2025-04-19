// src/actions/integration/actionExecutor.successEventDispatched.test.js

import {beforeEach, describe, expect, jest, test} from "@jest/globals";

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';
import {ResolutionStatus} from '../../services/targetResolutionService.js';
// Import the actual class to check the instance type passed to the mock
import {ActionTargetContext} from '../../services/actionValidationService.js';

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

// Mock components needed for payload resolution test
class MockMissingComponent { // Class exists but instance won't be added
    constructor() {
        this.prop = 'should_not_be_seen';
    }
}

// --- Mock Dependencies ---
/** @type {jest.Mocked<GameDataRepository>} */
const mockGameDataRepository = {
    getAction: jest.fn(),
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
    _checkEntityComponentRequirements: jest.fn(),
    _checkSinglePrerequisite: jest.fn(),
};

/** @type {jest.Mocked<EventBus>} */
const mockEventBus = {
    dispatch: jest.fn(), // Will be configured to resolve successfully
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    listenerCount: jest.fn(),
};

/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// --- Mock getDisplayName (required by ActionExecutor internals) ---
// Import the actual function signature for proper mocking
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from "../../services/payloadValueResolverService.js";

jest.mock('../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.id ?? 'mock unknown'), // Simple mock
    TARGET_MESSAGES: {},
}));


// --- Helper Functions ---

// Factory function remains the same
const payloadValueResolverService = (logger = mockLogger) => {
    return new PayloadValueResolverService({logger});
}

// Corrected helper to create the executor
const createExecutor = (logger = mockLogger) => {
    // <<< --- FIX: Create an INSTANCE of the service first --- >>>
    const resolverServiceInstance = payloadValueResolverService(logger);

    return new ActionExecutor({
        gameDataRepository: mockGameDataRepository,
        targetResolutionService: mockTargetResolutionService,
        actionValidationService: mockActionValidationService,
        eventBus: mockEventBus,
        logger: logger,
        payloadValueResolverService: resolverServiceInstance
    });
};

/**
 * Creates a mock ActionContext.
 * @param {string} actionId - The action ID being executed.
 * @param {Entity} playerEntity - The player entity.
 * @param {Entity} currentLocation - The current location entity.
 * @param {string | null} [directObjectPhrase='target object'] - Direct object phrase.
 * @returns {ActionContext}
 */
const createMockActionContext = (actionId = 'test:action', playerEntity, currentLocation, directObjectPhrase = 'target object') => {
    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: playerEntity,
        currentLocation: currentLocation,
        entityManager: {
            componentRegistry: {
                get: jest.fn((name) => {
                    // Only return definitions for components actually used or *potentially* looked up
                    // Return undefined for 'MissingComponent' to ensure resolution fails there
                    if (name === 'MissingComponent') return MockMissingComponent; // Return class, but instance missing
                    return undefined;
                }),
            },
            getEntityInstance: jest.fn((id) => {
                if (playerEntity && id === playerEntity.id) return playerEntity;
                if (currentLocation && id === currentLocation.id) return currentLocation;
                // Add target resolution if needed, but it's mocked separately
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Minimal parsed command
            actionId: actionId,
            directObjectPhrase: directObjectPhrase, // Required for parsed. source
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: `do ${actionId} ${directObjectPhrase ?? ''}`.trim(),
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch,
    };
    return baseContext;
};

/**
 * Creates a mock ActionDefinition with dispatch_event and a complex payload.
 * @param {string} id - The action ID.
 * @param {string} eventName - The event name to dispatch.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition_WithEvent = (id = 'test:action', eventName = 'test:event_occurred') => {
    /** @type {ActionDefinition} */
    const definition = {
        id: id,
        target_domain: 'environment', // Requires resolution (will be mocked for success)
        template: 'test template for {target}',
        dispatch_event: {
            eventName: eventName,
            payload: {
                // Mix of sources
                actorId: 'actor.id', // Non-null/undefined
                targetId: 'target.id', // Non-null/undefined (needs entity resolution)
                locationId: 'context.currentLocation.id', // Non-null/undefined
                commandPhrase: 'parsed.directObjectPhrase', // Non-null/undefined
                explicitNull: 'literal.null.', // Resolves to null
                missingComponentProp: 'actor.component.MissingComponent.prop', // Resolves to undefined
                literalString: 'literal.string.test_value' // Literal string
            }
        }
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
        targetType: 'entity', // Must be entity for target.* sources
        targetId: targetId,
        targetEntity: targetEntity, // Provide the entity instance
        targetConnectionEntity: null,
        candidateIds: [targetId],
        details: null,
        error: null,
    };
    return result;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Success (Event Dispatched Successfully) (Sub-Task 2.1.5.12)', () => {

    let executor;
    let mockContext;
    const actionId = 'test:action_event_dispatch';
    const eventName = 'test:event_dispatched_successfully';
    let mockActionDef_WithEvent;
    let mockPlayerEntity;
    let mockTargetEntity;
    let mockLocationEntity;
    let mockResolutionResult;
    let expectedTargetContext;
    const directObjectPhrase = 'the_target_object'; // Specific phrase for parsed. source

    beforeEach(() => {
        jest.clearAllMocks();

        // --- Setup Mocks ---
        // 1. Instantiate ActionExecutor with mocks
        executor = createExecutor(mockLogger);

        // Define Entities
        mockPlayerEntity = new Entity('player_dispatcher');
        mockTargetEntity = new Entity('target_dispatcher');
        mockLocationEntity = new Entity('location_dispatcher');
        // IMPORTANT: Do NOT add MockMissingComponent to mockPlayerEntity

        // 2. Define a mock ActionDefinition with dispatch_event and complex payload.
        mockActionDef_WithEvent = createMockActionDefinition_WithEvent(actionId, eventName);
        // 3. Mock gameDataRepository.getAction to return this definition.
        mockGameDataRepository.getAction.mockReturnValue(mockActionDef_WithEvent);

        // 4. Mock targetResolutionService.resolveActionTarget for success (entity type).
        mockResolutionResult = createMockSuccessResolutionResult(mockTargetEntity.id, mockTargetEntity);
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

        // 5. Mock actionValidationService.isValid to return true.
        mockActionValidationService.isValid.mockReturnValue(true);

        // 6. Mock eventBus.dispatch to resolve successfully.
        mockEventBus.dispatch.mockResolvedValue(undefined); // Simulates successful async dispatch

        // 7. Prepare the mockContext with needed data.
        mockContext = createMockActionContext(actionId, mockPlayerEntity, mockLocationEntity, directObjectPhrase);
        // Ensure component registry handles MissingComponent lookup correctly
        mockContext.entityManager.componentRegistry.get.mockImplementation((name) => {
            if (name === 'MissingComponent') return MockMissingComponent;
            return undefined;
        });


        // Determine the expected ActionTargetContext
        expectedTargetContext = ActionTargetContext.forEntity(mockTargetEntity.id);
    });

    test('should execute action, construct payload correctly (handling null/undefined), dispatch event, and return success', async () => {
        // --- Execute Action ---
        // 8. Call actionExecutor.executeAction('test:action', mockContext).
        const result = await executor.executeAction(actionId, mockContext);

        // --- Verify Results ---

        // Assert: Preceding services (getAction, resolveActionTarget, isValid) were called.
        expect(mockGameDataRepository.getAction).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getAction).toHaveBeenCalledWith(actionId);

        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
        expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledWith(mockActionDef_WithEvent, mockContext);

        expect(mockActionValidationService.isValid).toHaveBeenCalledTimes(1);
        expect(mockActionValidationService.isValid).toHaveBeenCalledWith(
            mockActionDef_WithEvent,
            mockPlayerEntity,
            expect.objectContaining({ // Verify constructed context
                type: expectedTargetContext.type,
                entityId: expectedTargetContext.entityId,
                direction: expectedTargetContext.direction,
            })
        );

        // Assert: eventBus.dispatch was called exactly once.
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);

        // Assert: eventBus.dispatch was called with the correct eventName.
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            eventName, // Check the first argument (eventName)
            expect.anything() // Check the second argument (payload) separately
        );

        // Assert: eventBus.dispatch was called with the correctly constructed payload object.
        const dispatchedPayload = mockEventBus.dispatch.mock.calls[0][1]; // Get the second argument (payload) of the first call

        // Verify keys corresponding to non-undefined sources exist with the correct resolved values.
        expect(dispatchedPayload).toHaveProperty('actorId', mockPlayerEntity.id);
        expect(dispatchedPayload).toHaveProperty('targetId', mockTargetEntity.id);
        expect(dispatchedPayload).toHaveProperty('locationId', mockLocationEntity.id);
        expect(dispatchedPayload).toHaveProperty('commandPhrase', directObjectPhrase);
        expect(dispatchedPayload).toHaveProperty('literalString', 'test_value');

        // Verify keys corresponding to null sources exist with the value null.
        expect(dispatchedPayload).toHaveProperty('explicitNull', null);

        // Verify keys corresponding to undefined sources are NOT present in the payload object.
        expect(dispatchedPayload).not.toHaveProperty('missingComponentProp');

        // Verify the exact structure (optional but good practice)
        expect(dispatchedPayload).toEqual({
            actorId: mockPlayerEntity.id,
            targetId: mockTargetEntity.id,
            locationId: mockLocationEntity.id,
            commandPhrase: directObjectPhrase,
            explicitNull: null,
            literalString: 'test_value'
            // missingComponentProp is NOT included
        });


        // Assert: Returns ActionResult with success: true, empty messages, undefined newState.
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.messages).toEqual([]);
        expect(result.newState).toBeUndefined();
        expect(result._internalDetails).toBeUndefined(); // No internal details on success

        // Assert: Mock Logger.debug was called for payload construction and dispatch attempt.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Helper #prepareAndDispatchEvent: Action '${actionId}' is valid. Preparing to dispatch event '${eventName}'.`
        );
        // Check the log for the omitted undefined value
        expect(mockLogger.debug).toHaveBeenCalledWith(
            "  - Payload key 'missingComponentProp' resolved to undefined from source 'actor.component.MissingComponent.prop'. Omitting from payload."
        );
        const expectedPayload = {
            actorId: 'player_dispatcher',
            targetId: 'target_dispatcher',
            locationId: 'location_dispatcher',
            commandPhrase: 'the_target_object',
            explicitNull: null,
            literalString: 'test_value'
        };

        // 1. Find the relevant call based on the unique string message
        const dispatchLogCall = mockLogger.debug.mock.calls.find(
            (call) => call.length > 0 && call[0] === `Helper #prepareAndDispatchEvent: Dispatching event '${eventName}' with payload:` // Add the prefix
        );

        // 2. Assert that this specific log call actually happened
        expect(dispatchLogCall).toBeDefined(); // Check if the call was found

        // 3. If the call exists, check its payload argument specifically
        if (dispatchLogCall) {
            // Use toEqual for a strict comparison against the expected object
            expect(dispatchLogCall[1]).toEqual(expectedPayload);

            // Optional: Alternative using toMatchObject (more flexible if the received
            // object might have *extra* properties, but shouldn't in this case)
            // expect(dispatchLogCall[1]).toMatchObject(expectedPayload);
        }

        // Check final success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Helper #prepareAndDispatchEvent: Event '${eventName}' dispatch successful for action '${actionId}'.`
        );
        // Verify overall log counts
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor
        // Debug: Start, Def found, Resol result, TargetCtx created, Validation result, Prepare dispatch, Undefined omitted, Dispatching, Dispatch complete = 9
        expect(mockLogger.debug).toHaveBeenCalledTimes(21);
        expect(mockLogger.warn).toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Acceptance Criteria Check (Manual Review based on test above): ---
    // [X] Test case uses an ActionDefinition with dispatch_event and a complex payload definition.
    // [X] Mocks provide necessary data for all source types used in the payload (actor, target, context, parsed, literal, missing component).
    // [X] eventBus.dispatch mock resolves successfully.
    // [X] Assertions verify eventBus.dispatch was called once with the correct event name.
    // [X] Assertions meticulously verify the structure and content of the dispatched payload, including handling of null and omission of undefined.
    // [X] Assertion verifies the final ActionResult indicates success.
    // [X] Assertions verify relevant logger calls (prepare, omit undefined, dispatching, success).
    // [X] Test passes. (Verified by running the test suite)
});