// src/tests/services/actionValidationService.targetComponents.test.js

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";
// --- Mock JsonLogicEvaluationService --- V3.3 Add
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path if necessary
import {ComponentRequirementChecker} from '../../validation/componentRequirementChecker.js';
// --- ADDED: Import the missing dependencies ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Adjust path if necessary
import {PrerequisiteChecker} from '../../validation/prerequisiteChecker.js'; // Adjust path if necessary

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
    },
    // --- Added for V3.3/V3.4 ---
    // Mock getComponentData to support component accessor in JsonLogic context
    getComponentData: jest.fn((entityId, componentTypeId) => {
        const entity = mockEntityManager.activeEntities.get(entityId);
        if (!entity) return null; // Entity not found

        // Retrieve the actual component map from the mock entity
        const componentMap = entity.components; // Assuming entity stores components in a map {componentId: data}

        // Return the data or null if the componentId is not found in the map
        // Note: This assumes the keys in entity.components *are* the componentTypeIds (strings)
        return componentMap?.get(componentTypeId) ?? null;
    }),
    // Mock hasComponent to support component accessor
    hasComponent: jest.fn((entityId, componentTypeId) => {
        const entity = mockEntityManager.activeEntities.get(entityId);
        if (!entity) return false;
        // Use the entity's own hasComponent mock for consistency IF the entity instance is used directly
        // OR check the mock entity's internal componentIdSet if using the factory
        if (typeof entity.hasComponent === 'function' && entity.hasComponent.mock) { // Check if it's the mock function from createMockEntity
            return entity.hasComponent(componentTypeId);
        }
        // Fallback if entity doesn't have the mock function (less likely with current setup)
        const componentMap = entity.components;
        return componentMap?.has(componentTypeId) ?? false;
    }),

};


// --- Mock Entity ---
// *** UPDATED Factory function to create mock entities with configurable components ***
const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
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

    // Create the internal component data map
    const internalComponentDataMap = new Map();
    for (const compId of componentIdSet) {
        // Use override if provided, otherwise default to empty object
        internalComponentDataMap.set(compId, componentDataOverrides[compId] || {});
    }


    const entity = {
        id: id,
        // *** UPDATED hasComponent mock to check against string IDs ***
        hasComponent: jest.fn((componentId) => {
            // Check if the input (which should be a string ID) is in the set of IDs
            return componentIdSet.has(componentId);
        }),
        // *** UPDATED getComponent mock to return data from internal map ***
        getComponent: jest.fn((componentId) => {
            return internalComponentDataMap.get(componentId); // Return data or undefined
        }),
        // Dummy methods to mimic Entity interface
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        // *** Use the actual data map for internal state ***
        components: internalComponentDataMap
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

// --- Mock JsonLogicEvaluationService --- V3.3 Add
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn(), // Default mock implementation
    addOperation: jest.fn(),
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
    mockEntityManager.registerComponent('Position', {}); // Register dummy Position for V3.3
    mockEntityManager.registerComponent('Health', {});   // Register dummy Health for V3.3
});

afterAll(() => {
    // Clean up registry if necessary
    mockEntityManager.clearRegistry();
});


// ========================================================================
// == Test Suite: Target Component Checks =================================
// ========================================================================
describe('ActionValidationService - Target Component Checks', () => {
    let service;
    let mockActor; // Actor that always passes its checks for these tests
    let mockTarget; // The target entity being checked
    // --- Declare variables for the checker instances ---
    let componentRequirementChecker;
    let domainContextCompatibilityChecker; // ADDED
    let prerequisiteChecker;             // ADDED

    const VALID_TARGET_ID = 'target-valid';
    const INVALID_TARGET_ID = 'target-invalid-id'; // ID for which getEntityInstance returns undefined

    beforeEach(() => {
        // --- Instantiate the checkers needed by ActionValidationService ---
        componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger}); // ADDED: Instantiate
        // ADDED: Instantiate PrerequisiteChecker (assuming it needs these dependencies based on its code)
        prerequisiteChecker = new PrerequisiteChecker({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager,
            logger: mockLogger
        });

        // --- Inject ALL required dependencies into ActionValidationService ---
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // Needed for prerequisite context/evaluation if not mocked deeper
            componentRequirementChecker,         // Pass the instance
            domainContextCompatibilityChecker, // Pass the instance (FIX)
            prerequisiteChecker                // Pass the instance (FIX)
        });
        // --- ---

        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear(); // Clear entities between tests

        // Create a mock actor that will always pass basic actor checks
        // Ensure it has components needed by default actionDefs below, if any
        mockActor = createMockEntity('actor-for-target-tests', [MockComponentA]);

        // Reset getEntityInstance mock for this suite
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            return mockEntityManager.activeEntities.get(id);
        });

        // --- V3.5.3: Ensure JsonLogic mock defaults to true for these target/domain tests ---
        // This ensures the prerequisite check (Step 4) passes (or is bypassed if failure occurs earlier),
        // allowing focus on Steps 2 and 3.
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
    });

    // --- Test Cases ---
    // V3.5.3 NOTE: All tests in this suite implicitly rely on the beforeEach setting
    // mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Explicitly empty -> prerequisite check passes trivially
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
        // V3.5.3 / V3.5.4: Verify prerequisite check was NOT the reason for success (evaluate not called because prerequisites: [])
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Irrelevant
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        // Expect the component requirement checker log (assuming ActionValidationService delegates to it)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Target ${VALID_TARGET_ID} is missing required component 'target:required'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check that the failing check was called (with ID), but the subsequent one was not
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        expect(mockTarget.hasComponent).not.toHaveBeenCalledWith('core:x'); // Fails fast on required
        // V3.5.3 / V3.5.4: Verify prerequisite check was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Irrelevant
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        // Expect the component requirement checker log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Target ${VALID_TARGET_ID} has forbidden component 'target:forbidden'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check that required and forbidden checks were made (using string IDs)
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:forbidden');
        // V3.5.3 / V3.5.4: Verify prerequisite check was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Explicitly empty
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid is missing required component'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Target target-valid has forbidden component'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        // V3.5.3 / V3.5.4: Verify prerequisite check was not called (because prerequisites: [])
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            // prerequisites: undefined // Implicitly undefined -> treated as []
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
        // V3.5.3 / V3.5.4: Verify prerequisite check was not called (because prerequisites is undefined -> [])
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Irrelevant
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
        // Check the specific debug log message for target not found (Step 3 failure)
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should be debug log, not error
        // V3.5.3 / V3.5.4: Verify prerequisite check was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Irrelevant
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        // Check the debug log from CompReqChecker indicating the target entity is missing the component ID (Step 3b failure)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Target ${VALID_TARGET_ID} is missing required component 'target:unregistered-required'`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // No service error expected
        // Target's hasComponent should have been called for the unregistered component ID check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:unregistered-required');
        // V3.5.3 / V3.5.4: Verify prerequisite check was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'do thing to {target}',
            prerequisites: [] // V3.5.3: Irrelevant
        };
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_TARGET_ID);
        // Check the debug log from CompReqChecker indicating the target has the forbidden component ID (Step 3b failure)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Target ${VALID_TARGET_ID} has forbidden component 'target:unregistered-forbidden'`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // No service error expected
        // Target's hasComponent should have been called for the required component check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:required');
        // And for the forbidden check
        expect(mockTarget.hasComponent).toHaveBeenCalledWith('target:unregistered-forbidden');
        // V3.5.3 / V3.5.4: Verify prerequisite check was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        // Clean up temporary registration if needed
        mockEntityManager.componentRegistry.delete('target:unregistered-forbidden');
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
            template: 'do thing',
            prerequisites: [] // V3.5.3: Explicitly empty -> prerequisite check passes trivially
        };
        const context = ActionTargetContext.noTarget(); // Crucial: context has no target

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true); // Should pass as actor checks pass and target checks are skipped
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockActor.id); // Verify it was called for the ACTOR
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for the DomainContextCompatibilityChecker log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Domain/Context Check Passed: Action 'test:target-skip-none' (domain 'none') is compatible with context type 'none'"));
        // Check for the ActionValidationService skip log for Step 3
        // V3.5.3 / V3.5.4: Verify prerequisite check was skipped (because prereqs: [])
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
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
            template: 'go {direction}',
            prerequisites: [] // V3.5.3: Explicitly empty -> prerequisite check passes trivially
        };
        const context = ActionTargetContext.forDirection('north'); // Crucial: context is direction

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true); // Should pass as actor checks pass and target entity checks are skipped
// NEW: Expect it to be called once for the actor during prerequisite context assembly
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockActor.id); // Verify it was called for the ACTOR
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for the DomainContextCompatibilityChecker log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Domain/Context Check Passed: Action 'test:target-skip-direction' (domain 'direction') is compatible with context type 'direction'"));
        // Check for the ActionValidationService skip log for Step 3
        // V3.5.3 / V3.5.4: Verify prerequisite check was skipped (because prereqs: [])
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    });

    test('Failure (Domain/Context Mismatch): Target checks skipped if target_domain is "none" even if context is "entity"', () => {
        // This tests if the target_domain/context check (Step 2) correctly prevents target component checks
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
            template: 'do thing',
            prerequisites: [] // V3.5.3: Irrelevant
        };
        // Context *incorrectly* provides an entity target
        const context = ActionTargetContext.forEntity(VALID_TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        // isValid should be FALSE because the target_domain ('none') mismatches the context.type ('entity')
        // This failure happens in Step 2 *before* target component checks (Step 3).
        expect(isValid).toBe(false);
        // Verify the Step 2 domain mismatch debug log was called (from DomainContextCompatibilityChecker)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Validation failed (Domain/Context): Action 'test:target-domain-mismatch-fail' (domain 'none') expects no target, but context type is 'entity'.`));

        // Crucially, getEntityInstance should NOT have been called because Step 2 failed first
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        // Check that target's hasComponent was definitely not called
        if (mockTarget && mockTarget.hasComponent) { // Check mock exists and has the mocked method
            expect(mockTarget.hasComponent).not.toHaveBeenCalled();
        }
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected here
        // V3.5.3 / V3.5.4: Verify prerequisite check was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    });

}); // End describe suite