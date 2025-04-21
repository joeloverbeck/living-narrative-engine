// tests/services/actionValidationService.test.js

/**
 * @jest-environment node
 */
import {ActionValidationService, ActionTargetContext} from '../../services/actionValidationService.js';
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";

// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// --- Mock Component Classes ---
// For Actor Checks
class MockComponentA {
}

class MockComponentB {
}

class MockComponentC {
}

class MockComponentRequired {
} // Used for Actor required
class MockComponentForbidden {
} // Used for Actor forbidden

// For Target Checks (can reuse or define new for clarity)
class MockTargetComponentRequired {
}

class MockTargetComponentForbidden {
}

class MockComponentX {
} // Another component for variety

// --- Mock EntityManager ---
const mockEntityManager = {
    componentRegistry: new Map(),
    // Updated getEntityInstance to be configurable per test
    getEntityInstance: jest.fn(), // Implementation will be set in tests
    activeEntities: new Map(), // Internal map for getEntityInstance mock
    // Helper to reset for tests
    clearRegistry: function () {
        this.componentRegistry.clear();
        this.activeEntities.clear(); // Clear mock entities too
    },
    registerComponent: function (id, componentClass) {
        this.componentRegistry.set(id, componentClass);
    },
    // Helper to add mock entities for getEntityInstance
    addMockEntityForLookup: function (entity) {
        if (entity && entity.id) {
            this.activeEntities.set(entity.id, entity);
        }
    }
};

// --- Mock Entity ---
// *** UPDATED Factory function to create mock entities with configurable components ***
const createMockEntity = (id, components = []) => {
    // Create a map to look up ID from Class (reverse of registry)
    // Note: This assumes IDs are unique. If a Class could have multiple IDs (unlikely), this needs adjustment.
    const classToIdMap = new Map();
    for (const [compId, compClass] of mockEntityManager.componentRegistry.entries()) {
        classToIdMap.set(compClass, compId);
    }

    // Store the IDs corresponding to the input component classes
    const componentIdSet = new Set(
        components
            .map(CompClass => classToIdMap.get(CompClass)) // Map Class to ID
            .filter(compId => compId !== undefined) // Filter out any classes not in the registry (shouldn't happen with test setup)
    );

    const entity = {
        id: id,
        // *** UPDATED hasComponent mock to check against string IDs ***
        hasComponent: jest.fn((componentId) => {
            // Check if the input (which should be a string ID) is in the set of IDs
            return componentIdSet.has(componentId);
        }),
        // Dummy methods to mimic Entity interface
        getComponent: jest.fn((componentId) => undefined), // Adjust if needed later
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        // Approximate internal state using IDs for easier debugging if needed
        components: new Map(Array.from(componentIdSet).map(compId => [compId, {}]))
    };
    // Automatically add to EntityManager's lookup map when created via this helper
    mockEntityManager.addMockEntityForLookup(entity);
    return entity;
};


// --- Mock GameDataRepository (Minimal) ---
const mockGameDataRepository = {
    getAction: jest.fn(),
    getEntityDefinition: jest.fn(),
};


// --- Global Setup ---
beforeAll(() => {
    // Register mock components once for all tests in this file
    mockEntityManager.registerComponent('core:a', MockComponentA);
    mockEntityManager.registerComponent('core:b', MockComponentB);
    mockEntityManager.registerComponent('core:c', MockComponentC);
    mockEntityManager.registerComponent('core:x', MockComponentX); // Register new component
    mockEntityManager.registerComponent('test:required', MockComponentRequired); // Actor required
    mockEntityManager.registerComponent('test:forbidden', MockComponentForbidden); // Actor forbidden
    mockEntityManager.registerComponent('target:required', MockTargetComponentRequired); // Target required
    mockEntityManager.registerComponent('target:forbidden', MockTargetComponentForbidden); // Target forbidden
});

afterAll(() => {
    // Clean up registry if necessary
    mockEntityManager.clearRegistry();
});


// ========================================================================
// == Test Suite: Actor Component Checks ==================================
// ========================================================================
describe('ActionValidationService - Actor Component Checks', () => {
    let service;
    let mockActor;

    beforeEach(() => {
        // Create a new service instance for each test to isolate mocks
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
        });
        // Reset mocks/spies before each test
        jest.clearAllMocks();

        // Reset getEntityInstance mock implementation for this suite (defaults to not finding anything)
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            // Default: return entity if found in the mock map, otherwise undefined
            return mockEntityManager.activeEntities.get(id);
        });
        mockEntityManager.activeEntities.clear(); // Clear entities between tests


        // Create a default mock actor (can be customized in tests)
        // Ensure this actor is NOT added to the lookup map unless needed by a specific test
        mockActor = {
            id: 'actor-default',
            hasComponent: jest.fn((componentId) => false), // Default: has no components (expects ID string)
            getComponent: jest.fn((componentId) => undefined),
            addComponent: jest.fn(),
            removeComponent: jest.fn(),
            components: new Map()
        };
        // Use the helper to create actor only if it needs to be looked up (e.g., for 'self' target domain)
        // Otherwise, use the raw mock object above.
    });

    // --- Test Cases ---

    test('Success: Actor has all required components and none of the forbidden ones', () => {
        // Use factory to create actor with specific components for this test
        mockActor = createMockEntity('actor-success', [MockComponentRequired, MockComponentA]);
        const actionDef = {
            id: 'test:action-success',
            actor_required_components: ['test:required', 'core:a'],
            actor_forbidden_components: ['test:forbidden', 'core:b'],
            target_domain: 'none', // Simplest case
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check hasComponent calls (using string IDs)
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:required');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:a');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:forbidden');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:b');
    });

    test('Failure (Missing Required): Actor is missing ONE required component', () => {
        mockActor = createMockEntity('actor-missing-one', [MockComponentA]); // Missing MockComponentRequired
        const actionDef = {
            id: 'test:action-missing-req',
            actor_required_components: ['test:required', 'core:a'],
            actor_forbidden_components: [],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Actor actor-missing-one is missing required component 'test:required'"));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Should have checked the first required component (ID) and failed
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:required');
        // Should NOT have checked the second required component because it failed on the first
        expect(mockActor.hasComponent).not.toHaveBeenCalledWith('core:a');
    });

    test('Failure (Missing Multiple Required): Actor is missing MULTIPLE required components', () => {
        mockActor = createMockEntity('actor-missing-multi', []); // Missing both required
        const actionDef = {
            id: 'test:action-missing-multi-req',
            actor_required_components: ['test:required', 'core:a'],
            actor_forbidden_components: [],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // It should fail on the first missing component found
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Actor actor-missing-multi is missing required component 'test:required'"));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Should have checked the first required component (ID) and failed
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:required');
        // Should NOT have checked the second required component because it failed on the first
        expect(mockActor.hasComponent).not.toHaveBeenCalledWith('core:a');
    });

    test('Failure (Has Forbidden): Actor has ONE forbidden component', () => {
        mockActor = createMockEntity('actor-has-forbidden', [MockComponentRequired, MockComponentForbidden]); // Has the forbidden one
        const actionDef = {
            id: 'test:action-has-forbidden',
            actor_required_components: ['test:required'],
            actor_forbidden_components: ['test:forbidden'],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Actor actor-has-forbidden has forbidden component 'test:forbidden'"));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Checks required first, then forbidden (using string IDs)
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:required');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:forbidden');
    });

    test('Failure (Has Multiple Forbidden): Actor has MULTIPLE forbidden components', () => {
        mockActor = createMockEntity('actor-has-multi-forbidden', [MockComponentRequired, MockComponentForbidden, MockComponentB]); // Has both forbidden
        const actionDef = {
            id: 'test:action-has-multi-forbidden',
            actor_required_components: ['test:required'],
            actor_forbidden_components: ['test:forbidden', 'core:b'],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // It should fail on the first forbidden component found
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Actor actor-has-multi-forbidden has forbidden component 'test:forbidden'"));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Checks required first, then the first forbidden (using string IDs)
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:required');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:forbidden');
        // Should NOT have checked the second forbidden component because it failed on the first
        expect(mockActor.hasComponent).not.toHaveBeenCalledWith('core:b');
    });

    test('Failure (Mixed): Actor has required components but also has a forbidden one', () => {
        mockActor = createMockEntity('actor-mixed-fail', [MockComponentRequired, MockComponentA, MockComponentForbidden]); // Has required, but also forbidden
        const actionDef = {
            id: 'test:action-mixed-fail',
            actor_required_components: ['test:required', 'core:a'],
            actor_forbidden_components: ['test:forbidden'],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Actor actor-mixed-fail has forbidden component 'test:forbidden'"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('missing required'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Checks all required first, then forbidden (using string IDs)
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:required');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:a');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('test:forbidden');
    });

    test('Success (Empty Lists): actionDefinition has empty actor_required_components and actor_forbidden_components', () => {
        mockActor = createMockEntity('actor-empty-lists', [MockComponentA]); // Actor can have anything
        const actionDef = {
            id: 'test:action-empty-lists',
            actor_required_components: [], // Empty
            actor_forbidden_components: [], // Empty
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // hasComponent should not be called for actor checks if lists are empty
        expect(mockActor.hasComponent).not.toHaveBeenCalled();
    });

    test('Success (Undefined Lists): actionDefinition has undefined actor_required_components and actor_forbidden_components', () => {
        // Test robustness against undefined properties, should be treated as empty
        mockActor = createMockEntity('actor-undef-lists', [MockComponentA]);
        const actionDef = {
            id: 'test:action-undef-lists',
            // actor_required_components: undefined, // Implicitly undefined
            // actor_forbidden_components: undefined, // Implicitly undefined
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockActor.hasComponent).not.toHaveBeenCalled();
    });


    test('Failure (Unresolved Component ID - Required): actionDefinition.actor_required_components contains an ID string for a component that the Entity does NOT have', () => {
        // This test is slightly different now. The service itself doesn't check if the ID is *registered*,
        // only if the *entity* has data for that ID string.
        // Let's rename and clarify the test's purpose.
        mockActor = createMockEntity('actor-missing-unregistered-style-req', [MockComponentA]); // Has 'core:a', but not 'core:unregistered-required'
        const actionDef = {
            id: 'test:action-missing-unregistered-req',
            actor_required_components: ['core:a', 'core:unregistered-required'], // Actor lacks the second one
            actor_forbidden_components: [],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // The service logs the failure because the *entity* is missing the component *ID*
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Actor actor-missing-unregistered-style-req is missing required component 'core:unregistered-required'`)
        );
        // No error log because the service doesn't validate registration itself (that's schema validation's job usually)
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Should check the first (which actor has) and then fail on the second (which actor lacks)
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:a');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:unregistered-required');
    });


    test('Failure (Unresolved Component ID - Forbidden): actionDefinition.actor_forbidden_components contains an ID string for a component that the Entity *does* have', () => {
        // Clarifying this test's purpose as well.
        // Let's say the actor *has* the component identified by the "unregistered" ID string.
        // We need to adjust createMockEntity temporarily or register it. Let's register a dummy for the test.
        class MockUnregisteredForbidden {
        }

        mockEntityManager.registerComponent('core:unregistered-forbidden', MockUnregisteredForbidden); // Temporarily register
        mockActor = createMockEntity('actor-has-unregistered-forbid', [MockComponentA, MockUnregisteredForbidden]); // Actor *has* the forbidden component ID now

        const actionDef = {
            id: 'test:action-has-unregistered-forbid',
            actor_required_components: ['core:a'],
            actor_forbidden_components: ['core:unregistered-forbidden'], // Actor has this component ID
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // Service logs failure because actor *has* the forbidden component ID
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Actor actor-has-unregistered-forbid has forbidden component 'core:unregistered-forbidden'`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Should check the required component first, then the forbidden one
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:a');
        expect(mockActor.hasComponent).toHaveBeenCalledWith('core:unregistered-forbidden');

        // Clean up the temporary registration if desired (though beforeEach/afterAll usually handle mocks)
        // mockEntityManager.componentRegistry.delete('core:unregistered-forbidden');
    });

    // Note: The original "Unresolved ID" tests were checking if the *service* errored when an ID wasn't in the registry.
    // The current service code (`_checkEntityComponentRequirements`) *doesn't* interact with the registry; it only calls `entity.hasComponent(stringId)`.
    // Therefore, those specific test conditions (service erroring on unregistered ID) are no longer applicable to the current code.
    // The adjusted tests above now check the correct logic: failure due to missing required ID or having forbidden ID on the entity itself.

});

describe('ActionValidationService - Input Validation and Errors', () => { // Combine error tests? Or keep separate.
    let service;
    let mockActor;

    beforeEach(() => {
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
        });
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear();
        // Mock getEntityInstance as needed per test
        mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.activeEntities.get(id));
        mockActor = createMockEntity('actor-throw'); // Create a default actor for these tests
    });

    test('isValid throws Error if missing or invalid actionDefinition', () => {
        // mockActor is created in beforeEach
        const context = ActionTargetContext.noTarget();
        const expectedErrorMsgPart = "ActionValidationService.isValid: Missing or invalid actionDefinition (must have non-empty string 'id').";

        // Check the first call (null actionDefinition)
        expect(() => service.isValid(null, mockActor, context)).toThrow(expectedErrorMsgPart);
        // Check that logger was called correctly for the first throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsgPart,
            expect.objectContaining({actionDefinition: null})
        );

        // Clear mock calls before the second check if you want to isolate assertions per throw
        // jest.clearAllMocks(); // Or mockLogger.error.mockClear();

        // Check the second call (empty id)
        expect(() => service.isValid({id: ''}, mockActor, context)).toThrow(expectedErrorMsgPart);
        // Check that logger was called correctly for the second throw
        // Note: If you didn't clear mocks, this checks if it was called *again* with these args.
        // If you want to be precise about *which* call had which args, check mockLogger.error.mock.calls
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsgPart,
            expect.objectContaining({actionDefinition: {id: ''}})
        );

        // Optionally, check total number of calls if you didn't clear mocks
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });

    test('isValid throws Error if missing or invalid actorEntity', () => {
        const actionDef = {id: 'test:action-throw', target_domain: 'none', template: 't'};
        const context = ActionTargetContext.noTarget();
        const expectedErrorMsg = `ActionValidationService.isValid: Missing or invalid actorEntity object for action '${actionDef.id}'.`;

        // Check null actorEntity
        expect(() => service.isValid(actionDef, null, context)).toThrow(expectedErrorMsg);
        // Check logger for the first throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({actorEntity: null})
        );

        // jest.clearAllMocks(); // Optional: Clear if isolating calls

        // Check invalid actorEntity structure
        const invalidActor = {some: 'property', but_no_id_or_hasComponent: true}; // Example invalid structure
        expect(() => service.isValid(actionDef, invalidActor, context)).toThrow(expectedErrorMsg);
        // Check logger for the second throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({actorEntity: invalidActor}) // Match the object passed
        );

        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Check total calls if mocks weren't cleared
    });

    test('isValid throws Error if missing or invalid targetContext', () => {
        // mockActor is created in beforeEach
        const actionDef = {id: 'test:action-throw', target_domain: 'none', template: 't'}; // Assumes domain 'none' is valid here
        const expectedErrorMsg = `ActionValidationService.isValid: Missing or invalid targetContext object for action '${actionDef.id}' actor '${mockActor.id}'.`;

        // Check null targetContext
        expect(() => service.isValid(actionDef, mockActor, null)).toThrow(expectedErrorMsg);
        // Check logger for the first throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({targetContext: null})
        );

        // jest.clearAllMocks(); // Optional: Clear if isolating calls

        // Check invalid targetContext structure (missing 'type')
        const invalidContext = {some: 'object'};
        expect(() => service.isValid(actionDef, mockActor, invalidContext)).toThrow(expectedErrorMsg);
        // Check logger for the second throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({targetContext: invalidContext})
        );

        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Check total calls if mocks weren't cleared
    });

});

// ========================================================================
// == Test Suite: Target Component Checks =================================
// ========================================================================
describe('ActionValidationService - Target Component Checks', () => {
    let service;
    let mockActor; // Actor that always passes its checks for these tests
    let mockTarget; // The target entity being checked

    const VALID_TARGET_ID = 'target-valid';
    const INVALID_TARGET_ID = 'target-invalid-id'; // ID for which getEntityInstance returns undefined

    beforeEach(() => {
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
        });
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear(); // Clear entities between tests

        // Create a mock actor that will always pass basic actor checks
        // Ensure it has components needed by default actionDefs below, if any
        mockActor = createMockEntity('actor-for-target-tests', [MockComponentA]);

        // Reset getEntityInstance mock for this suite
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            return mockEntityManager.activeEntities.get(id);
        });
    });

    // --- Test Cases ---

    test('Success (Target): target exists, has required components, lacks forbidden ones', () => {
        // Target setup: Has required, lacks forbidden
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockTargetComponentRequired, MockComponentX]);
        const actionDef = {
            id: 'test:target-success',
            actor_required_components: ['core:a'], // Passes
            actor_forbidden_components: [],
            target_required_components: ['target:required', 'core:x'],
            target_forbidden_components: ['target:forbidden', 'core:b'],
            target_domain: 'environment', // Assumes entity target
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid is missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Verify target checks (using string IDs)
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('core:x');
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:forbidden');
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('core:b');
    });

    test('Failure (Missing Required - Target): Target is missing ONE required component', () => {
        // Target setup: Missing MockTargetComponentRequired
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:target-missing-req',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required', 'core:x'], // Target requires 'target:required'
            target_forbidden_components: [],
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Target ${VALID_TARGET_ID} is missing required component 'target:required'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check that the failing check was called (with ID), but the subsequent one was not
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        expect(mockTarget.hasComponent).not.toHaveBeenCalledWith('core:x'); // Fails fast on required
    });

    test('Failure (Has Forbidden - Target): Target has ONE forbidden component', () => {
        // Target setup: Has the forbidden component
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockTargetComponentRequired, MockTargetComponentForbidden]);
        const actionDef = {
            id: 'test:target-has-forbidden',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // Target has this
            target_forbidden_components: ['target:forbidden'], // Target also has this forbidden one
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Target ${VALID_TARGET_ID} has forbidden component 'target:forbidden'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check that required and forbidden checks were made (using string IDs)
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:forbidden');
    });

    test('Success (Empty Lists - Target): actionDefinition has empty target requirement lists', () => {
        // Target setup: Can have anything or nothing
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:target-empty-lists',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: [], // Empty
            target_forbidden_components: [], // Empty
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid is missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // hasComponent should not be called for target checks if lists are empty
        expect(mockTarget.hasComponent).not.toHaveBeenCalled();
    });

    test('Success (Undefined Lists - Target): actionDefinition has undefined target requirement lists', () => {
        // Target setup: Can have anything or nothing
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:target-undef-lists',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            // target_required_components: undefined, // Implicitly undefined
            // target_forbidden_components: undefined, // Implicitly undefined
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid is missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // hasComponent should not be called for target checks if lists are undefined
        expect(mockTarget.hasComponent).not.toHaveBeenCalled();
    });

    test('Failure (Target Not Found): targetContext uses an ID for which getEntityInstance returns undefined', () => {
        // No need to create mockTarget, as it won't be found
        const actionDef = {
            id: 'test:target-not-found',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // Doesn't matter, target not found
            target_forbidden_components: [],
            target_domain: 'environment', // Requires entity lookup
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(INVALID_TARGET_ID);

        // Ensure getEntityInstance returns undefined for this specific ID
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === INVALID_TARGET_ID) return undefined;
            return mockEntityManager.activeEntities.get(id); // Fallback for other IDs if needed
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(INVALID_TARGET_ID);
        // Check the specific debug log message for target not found
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Action Validation Failed (Step 3): Target entity ID '${INVALID_TARGET_ID}' (specified in context for action 'test:target-not-found') was not found or is not currently active.`));
        // Target component checks should not have happened (no specific debug logs)
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Target ${INVALID_TARGET_ID} is missing`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Target ${INVALID_TARGET_ID} has forbidden`));
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should be debug log, not error
    });

    test('Failure (Unresolved Target Component ID - Required): Target is missing a required component ID', () => {
        // Adjusted test purpose: Target exists but lacks the component ID specified in the definition.
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockComponentX]); // Target exists but lacks 'target:unregistered-required'
        const actionDef = {
            id: 'test:target-missing-unregistered-req',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:unregistered-required'], // Target lacks this ID
            target_forbidden_components: [],
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        // Check the debug log indicating the target entity is missing the component ID
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Target ${VALID_TARGET_ID} is missing required component 'target:unregistered-required'`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // No service error expected
        // Target's hasComponent should have been called for the unregistered component ID check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:unregistered-required');
    });

    test('Failure (Unresolved Target Component ID - Forbidden): Target *has* a forbidden component ID', () => {
        // Adjusted test purpose: Target exists and *has* the component ID specified as forbidden.
        // Register a temporary component for the test
        class MockUnregisteredTargetForbidden {
        }

        mockEntityManager.registerComponent('target:unregistered-forbidden', MockUnregisteredTargetForbidden);
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockTargetComponentRequired, MockUnregisteredTargetForbidden]); // Target exists and *has* the forbidden ID

        const actionDef = {
            id: 'test:target-has-unregistered-forbid',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // Passes
            target_forbidden_components: ['target:unregistered-forbidden'], // Target has this forbidden ID
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        // Check the debug log indicating the target has the forbidden component ID
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Target ${VALID_TARGET_ID} has forbidden component 'target:unregistered-forbidden'`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // No service error expected
        // Target's hasComponent should have been called for the required component check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        // And for the forbidden check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:unregistered-forbidden');

        // Clean up temporary registration if needed
        // mockEntityManager.componentRegistry.delete('target:unregistered-forbidden');
    });


    test('Skipped (No Target): targetContext.type is "none". Target checks should be skipped.', () => {
        // Target should not be involved or checked
        const actionDef = {
            id: 'test:target-skip-none',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // These should NOT be checked
            target_forbidden_components: ['target:forbidden'],
            target_domain: 'none', // Crucial: action expects no target
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget(); // Crucial: context has no target

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true); // Should pass as actor checks pass and target checks are skipped
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // IMPORTANT: Verify target wasn't fetched
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target')); // No target entity debug logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Step 3 SKIPPED: No target entity resolution/component checks needed for context type 'none'"));
    });

    test('Skipped (Direction Target): targetContext.type is "direction". Target checks should be skipped.', () => {
        // Target entity should not be involved or checked
        const actionDef = {
            id: 'test:target-skip-direction',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // These should NOT be checked
            target_forbidden_components: ['target:forbidden'],
            target_domain: 'direction', // Crucial: action expects a direction
            template: 'go {direction}'
        };
        const context = ActionTargetContext.forDirection('north'); // Crucial: context is direction

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true); // Should pass as actor checks pass and target entity checks are skipped
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // IMPORTANT: Verify target entity wasn't fetched
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target')); // No target entity debug logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Step 3 SKIPPED: No target entity resolution/component checks needed for context type 'direction'"));
    });

    test('Failure (Domain/Context Mismatch): Target checks skipped if target_domain is "none" even if context is "entity"', () => {
        // This tests if the target_domain/context check correctly prevents target component checks
        // when the action definition *itself* doesn't expect an entity target, even if the
        // context provides one.
        mockTarget = createMockEntity(VALID_TARGET_ID, []); // Target exists but isn't relevant to the failure mode
        const actionDef = {
            id: 'test:target-domain-mismatch-fail',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // Should NOT be checked
            target_forbidden_components: [],
            target_domain: 'none', // Action expects NO target
            template: 'do thing'
        };
        // Context *incorrectly* provides an entity target
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        // isValid should be FALSE because the target_domain ('none') mismatches the context.type ('entity')
        // This failure happens in Step 2 *before* target component checks (Step 3).
        expect(isValid).toBe(false);
        // Verify the Step 2 domain mismatch debug log was called
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Validation failed (Step 2): Action 'test:target-domain-mismatch-fail' (domain 'none') is incompatible with provided context type 'entity'.`));

        // Crucially, getEntityInstance should NOT have been called because Step 2 failed first
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        // Check that target's hasComponent was definitely not called
        // We need the mockTarget instance to check its mock calls, even if it wasn't logically "used"
        if (mockTarget) { // Add a check in case createMockEntity failed for some reason
            expect(mockTarget.hasComponent).not.toHaveBeenCalled();
        }
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected here
    });

});