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
    info: jest.fn() // <--- ADD THIS LINE
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
// Factory function to create mock entities with configurable components
const createMockEntity = (id, components = []) => {
    const componentSet = new Set(components);
    const entity = {
        id: id,
        hasComponent: jest.fn((ComponentClass) => componentSet.has(ComponentClass)),
        // Dummy methods to mimic Entity interface
        getComponent: jest.fn((ComponentClass) => undefined),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        components: new Map(components.map(comp => [comp, {}])) // Approximate internal state for debugging
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
            hasComponent: jest.fn((ComponentClass) => false), // Default: has no components
            getComponent: jest.fn((ComponentClass) => undefined),
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
        // Check hasComponent calls
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentRequired);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentA);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentForbidden);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentB);
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
        // Should have checked the first required component and failed
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentRequired);
        // Should NOT have checked the second required component because it failed on the first
        expect(mockActor.hasComponent).not.toHaveBeenCalledWith(MockComponentA);
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
        // Should have checked the first required component and failed
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentRequired);
        // Should NOT have checked the second required component because it failed on the first
        expect(mockActor.hasComponent).not.toHaveBeenCalledWith(MockComponentA);
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
        // Checks required first, then forbidden
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentRequired);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentForbidden);
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
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentRequired);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentForbidden);
        // Should NOT have checked the second forbidden component because it failed on the first
        expect(mockActor.hasComponent).not.toHaveBeenCalledWith(MockComponentB);
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
        // Checks all required first, then forbidden
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentRequired);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentA);
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentForbidden);
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


    test('Failure (Unresolved ID - Required): actionDefinition.actor_required_components contains an ID not in the mock componentRegistry', () => {
        mockActor = createMockEntity('actor-unresolved-req', [MockComponentA]);
        const actionDef = {
            id: 'test:action-unresolved-req',
            actor_required_components: ['core:a', 'core:unregistered-required'], // Second one is not in registry
            actor_forbidden_components: [],
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Action Validation Failed: Actor component ID 'core:unregistered-required' required by action 'test:action-unresolved-req' not found in componentRegistry."
        );
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('has forbidden component'));
        // Should check the first (registered) component
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentA);
    });

    test('Failure (Unresolved ID - Forbidden): actionDefinition.actor_forbidden_components contains an ID not in the mock componentRegistry', () => {
        mockActor = createMockEntity('actor-unresolved-forbid', [MockComponentA]); // Doesn't have the forbidden component anyway
        const actionDef = {
            id: 'test:action-unresolved-forbid',
            actor_required_components: ['core:a'],
            actor_forbidden_components: ['core:unregistered-forbidden'], // This one is not in registry
            target_domain: 'none',
            template: 'do thing'
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Action Validation Failed: Actor component ID 'core:unregistered-forbidden' forbidden by action 'test:action-unresolved-forbid' not found in componentRegistry."
        );
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('has forbidden component'));
        // Should check the required component first
        expect(mockActor.hasComponent).toHaveBeenCalledWith(MockComponentA);
    });

    test('isValid throws Error if missing actionDefinition', () => {
        mockActor = createMockEntity('actor-throw');
        const context = ActionTargetContext.noTarget();
        expect(() => service.isValid(null, mockActor, context)).toThrow(
            "ActionValidationService.isValid: Missing required parameters."
        );
        expect(mockLogger.error).toHaveBeenCalledWith("ActionValidationService.isValid: Missing required parameters (actionDefinition, actorEntity, targetContext).");
    });

    test('isValid throws Error if missing actorEntity', () => {
        const actionDef = {id: 'test:action-throw', target_domain: 'none', template: 't'};
        const context = ActionTargetContext.noTarget();
        expect(() => service.isValid(actionDef, null, context)).toThrow(
            "ActionValidationService.isValid: Missing required parameters."
        );
        expect(mockLogger.error).toHaveBeenCalledWith("ActionValidationService.isValid: Missing required parameters (actionDefinition, actorEntity, targetContext).");
    });

    test('isValid throws Error if missing targetContext', () => {
        mockActor = createMockEntity('actor-throw');
        const actionDef = {id: 'test:action-throw', target_domain: 'none', template: 't'};
        expect(() => service.isValid(actionDef, mockActor, null)).toThrow(
            "ActionValidationService.isValid: Missing required parameters."
        );
        expect(mockLogger.error).toHaveBeenCalledWith("ActionValidationService.isValid: Missing required parameters (actionDefinition, actorEntity, targetContext).");
    });

});


// ========================================================================
// == Test Suite: Target Component Checks (Ticket 2.2.5) ==================
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
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target')); // No failure logs for target
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Verify target checks
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockTargetComponentRequired);
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockComponentX);
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockTargetComponentForbidden);
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockComponentB);
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
        // Check that the failing check was called, but the subsequent one might not have been
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockTargetComponentRequired);
        expect(mockTarget.hasComponent).not.toHaveBeenCalledWith(MockComponentX); // Fails fast on required
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
        // Check that required and forbidden checks were made
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockTargetComponentRequired);
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockTargetComponentForbidden);
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
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target')); // No failure logs
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
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target')); // No failure logs
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
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Target entity ID '${INVALID_TARGET_ID}' specified in context for action 'test:target-not-found' by actor '${mockActor.id}' could not be found.`));
        // Target component checks should not have happened
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-invalid-id is missing'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-invalid-id has forbidden'));
    });

    test('Failure (Unresolved ID - Target Required): actionDefinition.target_required_components contains an ID not in componentRegistry', () => {
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockComponentX]); // Target exists
        const actionDef = {
            id: 'test:target-unresolved-req',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:unregistered-required'], // NOT in registry
            target_forbidden_components: [],
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Action Validation Failed: Target component ID 'target:unregistered-required' required by action 'test:target-unresolved-req' not found in componentRegistry."
        );
        // Check that specific failure messages were NOT logged for the target itself
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid is missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid has forbidden component'));
        // Target's hasComponent should not have been called for the unregistered component
        expect(mockTarget.hasComponent).not.toHaveBeenCalled();
    });

    test('Failure (Unresolved ID - Target Forbidden): actionDefinition.target_forbidden_components contains an ID not in componentRegistry', () => {
        mockTarget = createMockEntity(VALID_TARGET_ID, [MockTargetComponentRequired]); // Target exists and passes required
        const actionDef = {
            id: 'test:target-unresolved-forbid',
            actor_required_components: ['core:a'], // Actor passes
            actor_forbidden_components: [],
            target_required_components: ['target:required'], // Passes
            target_forbidden_components: ['target:unregistered-forbidden'], // NOT in registry
            target_domain: 'environment',
            template: 'do thing to {target}'
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Action Validation Failed: Target component ID 'target:unregistered-forbidden' forbidden by action 'test:target-unresolved-forbid' not found in componentRegistry."
        );
        // Check that specific failure messages were NOT logged for the target itself
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid is missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid has forbidden component'));
        // Target's hasComponent should have been called for the required component check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith(MockTargetComponentRequired);
        // But not for the forbidden check, as the ID resolution failed first
        // expect(mockTarget.hasComponent).not.toHaveBeenCalledWith(...); // Cannot check with unregistered class
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
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target')); // No target-related debug logs
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
    });

    // Optional: Test interaction with target_domain validation (ensure target checks happen only if domain expects entity)
    test('Target checks skipped if target_domain is "none" even if context is "entity"', () => {
        // This tests if the target_domain check correctly prevents target component checks
        // when the action definition *itself* doesn't expect an entity target, even if the
        // context provides one (which might be an upstream error, but validation should handle it).
        mockTarget = createMockEntity(VALID_TARGET_ID, []); // Target exists but lacks components
        const actionDef = {
            id: 'test:target-domain-mismatch-skip',
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
        // This failure happens *after* actor checks but *before* target component checks.
        expect(isValid).toBe(false);
        // Verify the domain mismatch debug log was called
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Validation failed: Action 'test:target-domain-mismatch-skip' expects no target (domain 'none'), but context has type entity`));

        // Crucially, getEntityInstance should NOT have been called because the target component check block is skipped
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockTarget.hasComponent).not.toHaveBeenCalled(); // Target component checks should not run
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected here
    });


});