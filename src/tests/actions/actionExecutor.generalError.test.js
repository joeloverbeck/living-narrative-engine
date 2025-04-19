// src/actions/actionExecutor.generalError.test.js

import {beforeEach, describe, expect, jest, test} from "@jest/globals";

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';
import {ResolutionStatus} from '../../services/targetResolutionService.js';
// Import ActionTargetContext if needed by helpers, though maybe not directly by this test
// import {ActionTargetContext} from '../../services/actionValidationService.js';

// Import types for JSDoc
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */

/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */

// --- Mock Components Needed ---
// MockComponentA might be needed if createMockActionContext adds it by default
class MockComponentA {
    constructor() {
        this.value = 'CompA_Default';
    }
}

class MockStatsComponent {
    constructor() {
        this.strength = 10;
        this.agility = 5;
    }
}

// MockNameComponent is needed for the getDisplayName mock setup
class MockNameComponent {
    constructor(value) {
        this.value = value;
    }
}

// --- Mock Dependencies ---
const mockGameDataRepository = {
    getAction: jest.fn(),
};
const mockTargetResolutionService = {
    resolveActionTarget: jest.fn(),
};
const mockActionValidationService = {
    isValid: jest.fn(),
};
const mockEventBus = {
    // IMPORTANT: Ensure dispatch returns a resolved promise
    dispatch: jest.fn().mockResolvedValue(undefined),
};

// --- Mock Logger ---
/** @type {ILogger} */
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// --- Mock getDisplayName (required by ActionExecutor internals/setup) ---
// Import the actual function signature for proper mocking
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from "../../services/payloadValueResolverService.js";

jest.mock('../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => {
        if (!entity) return 'mock unknown';
        // Simple mock: try NameComponent, fallback to ID
        const nameComp = entity.getComponent(MockNameComponent);
        return nameComp?.value ?? entity.id ?? 'mock unknown';
    }),
    TARGET_MESSAGES: {}, // Mock other potential exports if needed
}));

// --- Helper Functions (Copied and potentially simplified) ---

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

// Simplified context creator focusing only on what's needed for this test path
const createMockActionContext = (overrides = {}) => {
    // Use the overridden player or create a default one
    const player = overrides.playerEntity || new Entity('player_default_err_test');
    // Add default components if ActionExecutor expects them during setup/validation phases
    // For this test, we primarily care about mocking getComponent on the specific player later.
    // Let's assume ComponentA might be checked by validation potentially.
    if (!overrides.playerEntity?.hasComponent(MockComponentA)) {
        // Check if player already has it before adding unnecessarily
        // This check requires adding hasComponent to the mock Entity or removing this addComponent call
        // For simplicity, let's *not* add ComponentA by default in this isolated test's helper.
        // player.addComponent(new MockComponentA());
    }


    const location = new Entity('room_err_test');

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: {
            componentRegistry: {
                // This registry mock is crucial for the test's setup phase
                get: jest.fn((name) => {
                    if (name === 'Stats') return MockStatsComponent;
                    if (name === 'NameComponent') return MockNameComponent; // Needed for getDisplayName mock
                    // Add other components returned by registry if needed by ActionExecutor flow BEFORE the error point
                    // if (name === 'ComponentA') return MockComponentA;
                    return undefined;
                }),
            },
            // getEntityInstance might be needed if context/target resolution checks entities
            getEntityInstance: jest.fn((id) => {
                if (id === player.id) return player;
                if (id === location.id) return location;
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Minimal parsed command
            actionId: overrides.actionId || 'test:action_err_test',
            directObjectPhrase: null,
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do error test action',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch,
        ...overrides,
    };
    return baseContext;
};

const createMockResolutionResult = (status, overrides = {}) => {
    const baseResult = {
        status: status,
        targetType: 'none',
        targetId: null,
        targetEntity: null,
        targetConnectionEntity: null,
        candidateIds: [],
        details: null,
        error: null,
        ...overrides,
    };
    return baseResult;
};

const createMockActionDefinition = (overrides = {}) => {
    /** @type {ActionDefinition} */
    const baseDefinition = {
        id: 'test:action_err_test_default',
        target_domain: 'none',
        template: 'do the error test action',
        dispatch_event: {
            eventName: 'test:event_err_dispatched',
            payload: {},
        },
        ...overrides, // Apply overrides, including potentially replacing dispatch_event entirely
    };

    // Ensure dispatch_event structure is sound if partially overridden
    if (overrides.dispatch_event && typeof overrides.dispatch_event === 'object') {
        baseDefinition.dispatch_event = {
            eventName: overrides.dispatch_event.eventName || baseDefinition.dispatch_event.eventName,
            payload: overrides.dispatch_event.payload || {} // Ensure payload exists
        };
    } else if (overrides.hasOwnProperty('dispatch_event')) {
        // Handle cases like dispatch_event: null or dispatch_event: undefined
        baseDefinition.dispatch_event = overrides.dispatch_event;
    }


    return baseDefinition;
};


// --- Test Suite ---

describe('ActionExecutor Isolated Tests', () => {

    // Clear all mocks before each test in this file
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Extracted Test Suite ---
    describe('General Error Handling (Top-Level Try...Catch in #getValueFromSource)', () => {
        test('should catch unexpected errors within resolution logic, log, and return undefined for the value', async () => {
            // 1. Setup: Identify error point and prepare mock
            const executor = createExecutor(mockLogger);
            const sourceString = 'actor.component.Stats.strength'; // Target path
            const payloadKey = 'actorStrength';
            const actionId = 'test:internal_error_catch_isolated';
            const expectedError = new Error('Simulated unexpected internal error in getComponent');

            // Mock ActionDefinition
            const actionDef = createMockActionDefinition({
                id: actionId,
                dispatch_event: {
                    eventName: 'test:event_internal_error_isolated',
                    payload: {[payloadKey]: sourceString}
                }
            });
            mockGameDataRepository.getAction.mockReturnValue(actionDef);

            // Prepare ActionContext with a specific player entity for mocking
            const playerWithError = new Entity('player_iso_err_test');
            const mockContextWithError = createMockActionContext({
                playerEntity: playerWithError,
                actionId: actionId
            });

            // *** Ensure Component Registry returns the component class ***
            expect(mockContextWithError.entityManager.componentRegistry.get('Stats')).toBe(MockStatsComponent);


            // *** 2. Simulate Error: Mock getComponent on the specific entity instance to throw ***
            const getComponentSpy = jest.spyOn(playerWithError, 'getComponent')
                .mockImplementation((CompClass) => {
                    if (CompClass === MockStatsComponent) {
                        throw expectedError; // Throw the simulated error
                    }
                    // Correct mock: should delegate to original for other components if needed,
                    // but for this test, returning undefined is fine if no others are expected.
                    // If other components ARE expected by the code path before the error:
                    // return jest.requireActual('../../entities/entity.js').default.prototype.getComponent.call(this, CompClass);
                    return undefined; // Simplified: Assume only Stats is requested in this path before error
                });

            // Mock Resolution Result (pass)
            const mockResolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'});
            mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

            // Mock Validation (pass)
            mockActionValidationService.isValid.mockReturnValue(true);

            // 3. Test Error Catching: Run executeAction and assert it doesn't throw
            let result;
            let executionError = null; // Variable to catch potential errors
            try {
                result = await executor.executeAction(actionId, mockContextWithError);
            } catch (err) {
                executionError = err; // Catch error if thrown
            }

            // --- Assertion: Ensure no error was thrown out of executeAction ---
            // This replaces the .not.toThrow() wrapper's purpose
            expect(executionError).toBeNull();

            // 4. Assertions on the result and side effects

            // [AC] Test case simulates an unexpected internal error (Setup verified)

            // --- Check the result object itself ---
            expect(result).toBeDefined(); // <<<< This should now pass
            expect(result.success).toBe(true); // Action execution flow completed successfully

            // [AC] Assertion verifies the internal resolution returned undefined (Implicitly checked by payload & log)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
            );

            // [AC] Assertion verifies the correct internal error message is logged
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `PayloadValueResolverService (resolveValue): Unexpected error resolving source string '${sourceString}' for action '${actionId}':`,
                expectedError
            );
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected in this path

            // Check event dispatch payload is empty (or missing the key)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                actionDef.dispatch_event.eventName,
                {} // Payload empty as the only field failed resolution
            );

            // Verify the spy was called
            expect(getComponentSpy).toHaveBeenCalledWith(MockStatsComponent);

            // [AC] Test passes without unhandled exceptions (Verified by executionError check)
        });
    });
    // --- End Extracted Test Suite ---

}); // end describe ActionExecutor Isolated Tests