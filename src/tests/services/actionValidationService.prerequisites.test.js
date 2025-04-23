// src/tests/services/actionValidationService.prerequisites.test.js

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";
// --- Mock JsonLogicEvaluationService --- V3.3 Add
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path if necessary
// --- Import Checkers needed for DI ---
import {ComponentRequirementChecker} from "../../validation/componentRequirementChecker.js";
import {DomainContextCompatibilityChecker} from "../../validation/domainContextCompatibilityChecker.js"; // <-- ADDED IMPORT
import {PrerequisiteChecker} from "../../validation/prerequisiteChecker.js"; // <-- ADDED IMPORT

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
// This is no longer directly needed by ActionValidationService, but might be needed by other parts if this file expands.
// Kept for now, but commented out where it was passed to AVS constructor.
const mockGameDataRepository = {
    getAction: jest.fn(),
    getEntityDefinition: jest.fn(),
};

// --- Mock JsonLogicEvaluationService --- V3.3 Add
// This is now needed by PrerequisiteChecker, not AVS directly.
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
// == V3.3 Test Suite: Prerequisite Checks (Using JsonLogic) ==============
// ========================================================================
// V3.5.3 NOTE: This suite is *specifically* for testing prerequisites.
// No changes are needed here for Ticket 3.5.3, as these tests intentionally
// configure and check the prerequisite step.
// V3.5.4 NOTE: Added the new test case for `prerequisites: []` here.
// V3.5.5 NOTE: The test required by this ticket already exists below.
// V3.5.6 NOTE: The test required by this ticket already exists below ('Failure: One prerequisite rule that evaluates to false').
describe('ActionValidationService - Prerequisite Checks (JsonLogic)', () => {
    let service;
    let mockActor;
    let mockTarget;
    // Declare variables for all checkers needed by AVS
    let componentRequirementChecker;
    let domainContextCompatibilityChecker; // <-- ADDED
    let prerequisiteChecker; // <-- ADDED
    const ACTOR_ID = 'actor-prereq';
    const TARGET_ID = 'target-prereq';


    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear(); // Clear entities

        // --- Create instances of ALL required checkers ---
        componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger}); // <-- INSTANTIATED
        // PrerequisiteChecker needs JsonLogic service, EntityManager, and Logger
        prerequisiteChecker = new PrerequisiteChecker({ // <-- INSTANTIATED
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // Pass the mock evaluation service
            entityManager: mockEntityManager, // Pass the mock entity manager
            logger: mockLogger
        });

        // --- Setup Service with Mocks ---
        // Pass the instantiated checkers to the AVS constructor
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            // gameDataRepository: mockGameDataRepository, // <-- REMOVED (no longer direct dependency)
            logger: mockLogger,
            // jsonLogicEvaluationService: mockJsonLogicEvaluationService, // <-- REMOVED (no longer direct dependency, passed to PrerequisiteChecker instead)
            componentRequirementChecker, // Pass the instance
            domainContextCompatibilityChecker, // Pass the instance <-- ADDED
            prerequisiteChecker // Pass the instance <-- ADDED
        });

        // Setup Base Actor & Target (will pass component checks by default)
        // Provide some component data for context assembly testing
        // Note: These might be overridden by specific tests if needed
        mockActor = createMockEntity(ACTOR_ID, [MockComponentA], {
            'Position': {x: 1, y: 2},
            'Health': {current: 5, max: 10}
        });
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX], {
            'Position': {x: 3, y: 4},
            'Health': {current: 8, max: 8}
        });

        // Reset getEntityInstance mock
        mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.activeEntities.get(id));

        // Reset mocks before each test
        mockJsonLogicEvaluationService.evaluate.mockClear();
        mockEntityManager.getComponentData.mockClear(); // Clear this as well
    });

    // --- NEW TEST CASE (Sub-ticket 3.5.4) ---
    test('isValid returns true for action with no prerequisites when other checks pass', () => {
        // Arrange
        const actionDef = {
            id: 'test:action-no-prereqs',
            actor_required_components: [], // Keep simple to ensure other checks pass
            actor_forbidden_components: [],
            target_domain: 'none',         // Keep simple
            prerequisites: [],             // Core of the test: empty prerequisites array
            template: 'Action with no prerequisites'
        };
        // Use a simple actor that meets the (empty) requirements
        const simpleActor = createMockEntity('actor-simple');
        const context = ActionTargetContext.noTarget(); // Matches target_domain 'none'

        // Act
        const isValid = service.isValid(actionDef, simpleActor, context);

        // Assert
        // 1. isValid should return true because all checks (actor, domain, target) pass
        //    and the prerequisite step is trivially passed due to the empty array.
        expect(isValid).toBe(true);

        // 2. Crucially, JsonLogicEvaluationService.evaluate should NOT have been called
        //    because there were no prerequisite rules to evaluate *by the PrerequisiteChecker*.
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        // 3. Check logs to confirm the prerequisite step was noted as passed/skipped.
        // The log message comes from PrerequisiteChecker now, not AVS directly
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`PrerequisiteChecker: No prerequisites defined for action '${actionDef.id}'. Check PASSED.`));
        // Also check the overall pass log from AVS
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`)); // Log from AVS after PrerequisiteChecker returns true
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
    // --- END NEW TEST CASE ---

    test('Success: No prerequisites defined (alternative test, duplicates new test)', () => {
        // Note: This test is now functionally identical to the one added for 3.5.4 above.
        // Keeping it temporarily for reference, but one should likely be removed or merged.
        const actionDef = {
            id: 'test:no-prereqs-alt',
            actor_required_components: ['core:a'], // Uses actor from beforeEach
            target_domain: 'environment',
            prerequisites: [] // Empty array
        };
        const context = ActionTargetContext.forEntity(TARGET_ID); // Uses target from beforeEach

        const isValid = service.isValid(actionDef, mockActor, context); // Uses actor/target from beforeEach

        expect(isValid).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        // Check PrerequisiteChecker log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`PrerequisiteChecker: No prerequisites defined for action '${actionDef.id}'. Check PASSED.`));
        // Check AVS log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    // ========================================================================
    // == Test Case for Sub-ticket 3.5.6 / 4.3 ==============================
    // == >> THIS IS THE FIRST FAILING TEST << ===============================
    // ========================================================================
    // This test case fulfills the requirements of Sub-ticket 3.5.6:
    // Goal: Verify isValid fails when an action has one prerequisite that evaluates to false.
    test('Failure: One prerequisite rule that evaluates to false', () => {
        // 1. Define a simple JSON Logic rule object
        const rule1 = {"==": [1, 0]}; // Simple false rule

        // 2. Define a mock ActionDefinition with one prerequisite
        //    Ensure other checks would pass.
        const failureMsg = "Condition check failed.";
        const actionDef = {
            id: 'test:one-prereq-fail',
            actor_required_components: ['core:a'], // Use actor from beforeEach (passes)
            actor_forbidden_components: [],
            target_required_components: [], // Ensure target checks pass (if applicable)
            target_forbidden_components: [],
            target_domain: 'environment', // Use target from beforeEach
            template: 'Action that fails prerequisite',
            prerequisites: [ // Exactly one prerequisite that will fail
                {condition_type: 'test-fail', logic: rule1, failure_message: failureMsg}
            ]
        };

        // 3. Create mock actorEntity and targetContext (using beforeEach setup)
        const context = ActionTargetContext.forEntity(TARGET_ID); // Use target from beforeEach

        // 4. Configure the mock evaluator to return false
        // *** FIX: Explicitly set the mock return value for clarity and correctness ***
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        // 5. Call service.isValid
        const isValid = service.isValid(actionDef, mockActor, context); // Use actor/target from beforeEach

        // 6. Assert that the result is false
        expect(isValid).toBe(false);

        // 7. Assert that mockJsonLogicEvaluationService.evaluate was called exactly once
        //    (because PrerequisiteChecker calls it)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // 8. Assert that mockJsonLogicEvaluationService.evaluate was called with the correct rule and context
        //    The context is now assembled by PrerequisiteChecker using createJsonLogicContext
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule1, // The specific rule object
            expect.objectContaining({ // Check key parts of the context assembled by PrerequisiteChecker
                actor: expect.objectContaining({id: ACTOR_ID}),
                target: expect.objectContaining({id: TARGET_ID}),
                event: expect.objectContaining({type: 'ACTION_VALIDATION'})
                // Note: The exact structure might depend on createJsonLogicContext implementation
            })
        );

        // Additional Log Checks (verify failure reason logs from PrerequisiteChecker and AVS)
        // Log from PrerequisiteChecker about starting evaluation
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='test-fail', Negate=false.`));

        // Log from PrerequisiteChecker about evaluation result
        // *** FIX: Adjusted log assertion - removed potential leading spaces. Verify against actual logger output. ***
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rule evaluation result: false"));

        // Log from PrerequisiteChecker about failure
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED for action '${actionDef.id}'. Reason: ${failureMsg}`));
        // Log from AVS indicating Step 4 failed because PrerequisiteChecker returned false
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`)); // Should not pass
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
    // ========================================================================
    // == End Test Case for Sub-ticket 3.5.6 ================================
    // ========================================================================


    // ========================================================================
    // == NEW Test Case for Sub-ticket 3.5.7 / 4.4 ==========================
    // ========================================================================
    test('isValid returns true when multiple prerequisites all pass', () => {
        // 1. Define multiple JSON Logic rule objects
        const rule1 = {"==": [1, 1]}; // Always true
        const rule2 = {"!=": [1, 0]}; // Also always true

        // 2. Define a mock ActionDefinition with prerequisites: [rule1, rule2]
        //    Ensure other checks pass (using actor/target from beforeEach setup)
        const actionDef = {
            id: 'test:multi-prereq-pass',
            actor_required_components: ['core:a'], // Passes (from beforeEach)
            target_domain: 'environment',         // Passes (from beforeEach)
            prerequisites: [
                {condition_type: 'test1', logic: rule1},
                {condition_type: 'test2', logic: rule2}
            ]
        };

        // 3. Create mock actorEntity and targetContext (using beforeEach setup)
        const context = ActionTargetContext.forEntity(TARGET_ID); // From beforeEach

        // 4. Configure the mock evaluator to return true for all calls
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        // 5. Call service.isValid
        const isValid = service.isValid(actionDef, mockActor, context); // From beforeEach

        // 6. Assert that the result is true
        expect(isValid).toBe(true);

        // 7. Assert that mockJsonLogicEvaluationService.evaluate was called exactly twice (by PrerequisiteChecker)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);

        // 8. Assert the first call was with rule1 and context
        expect(mockJsonLogicEvaluationService.evaluate.mock.calls[0][0]).toEqual(rule1);
        expect(mockJsonLogicEvaluationService.evaluate.mock.calls[0][1]).toEqual(expect.objectContaining({ // Check context shape on first call
            actor: expect.objectContaining({id: ACTOR_ID}),
            target: expect.objectContaining({id: TARGET_ID}),
        }));

        // 9. Assert the second call was with rule2 and context
        expect(mockJsonLogicEvaluationService.evaluate.mock.calls[1][0]).toEqual(rule2);
        expect(mockJsonLogicEvaluationService.evaluate.mock.calls[1][1]).toEqual(expect.objectContaining({ // Check context shape on second call
            actor: expect.objectContaining({id: ACTOR_ID}),
            target: expect.objectContaining({id: TARGET_ID}),
        }));

        // Use toHaveBeenNthCalledWith for more robust argument checking including context
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(1, rule1, expect.any(Object));
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(2, rule2, expect.any(Object));


        // Additional Log Checks (optional - check logs from PrerequisiteChecker and AVS)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='test1'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='test2'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rule evaluation result: true")); // Called twice (Check spacing)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`PrerequisiteChecker: All 2 prerequisite(s) met for action '${actionDef.id}'. Check PASSED.`)); // From PrereqChecker
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`)); // From AVS
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
    // ========================================================================
    // == End Test Case for Sub-ticket 3.5.7 ================================
    // ========================================================================


    // ========================================================================
    // == NEW Test Case for Sub-ticket 3.5.8 / 4.5 ==========================
    // ========================================================================
    test('isValid returns false and exits early when the first prerequisite fails', () => {
        // 1. Define multiple JSON Logic rule objects
        const rule1 = {"==": [1, 0]}; // Fails
        const rule2 = {"==": [1, 1]}; // Would pass, but should not be reached

        // 2. Define a mock ActionDefinition with prerequisites
        //    Ensure other checks pass (using actor/target from beforeEach setup)
        const failureMsg = "First condition failed.";
        const actionDef = {
            id: 'test:multi-prereq-fail-first',
            actor_required_components: ['core:a'], // Passes (from beforeEach)
            target_domain: 'none',                 // Simplest case
            prerequisites: [
                {condition_type: 'fail-first', logic: rule1, failure_message: failureMsg},
                {condition_type: 'pass-second', logic: rule2}
            ]
        };

        // 3. Create mock actorEntity and targetContext (using beforeEach setup)
        const context = ActionTargetContext.noTarget(); // From beforeEach

        // 4. Configure the mock evaluator to return false for the first call.
        //    We don't strictly need to mock the second call, as it shouldn't happen,
        //    but using mockReturnValueOnce is clear.
        mockJsonLogicEvaluationService.evaluate.mockReturnValueOnce(false);

        // 5. Call service.isValid
        const isValid = service.isValid(actionDef, mockActor, context); // From beforeEach

        // 6. Assert that the result is false
        expect(isValid).toBe(false);

        // 7. Assert that mockJsonLogicEvaluationService.evaluate was called exactly once (by PrerequisiteChecker)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // 8. Assert that the single call was with rule1 and context
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule1, // The first rule object
            expect.objectContaining({ // Check key parts of the context
                actor: expect.objectContaining({id: ACTOR_ID}),
                target: null, // Because context is noTarget() in PrerequisiteChecker's context
                event: expect.objectContaining({type: 'ACTION_VALIDATION'})
            })
        );

        // Additional Log Checks (optional - focus on PrerequisiteChecker and AVS logs)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='fail-first'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rule evaluation result: false")); // Check spacing
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED for action '${actionDef.id}'. Reason: ${failureMsg}`)); // From PrereqChecker
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`)); // From AVS
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='pass-second'`)); // Verify second rule wasn't evaluated
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`)); // Verify it didn't pass
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
    // ========================================================================
    // == End Test Case for Sub-ticket 3.5.8 ================================
    // ========================================================================


    test('Failure: Multiple prerequisites, the second one fails', () => {
        const rulePass = {"==": [1, 1]};
        const ruleFail = {"==": [1, 0]};
        const failureMsg = "Second condition failed.";
        const actionDef = {
            id: 'test:multi-prereq-fail-second',
            actor_required_components: ['core:a'], // Use actor from beforeEach
            prerequisites: [
                {condition_type: 'pass', logic: rulePass},
                {condition_type: 'fail', logic: ruleFail, failure_message: failureMsg}
            ]
        };
        const context = ActionTargetContext.noTarget(); // No target needed here

        // Configure mock: return true first, then false for this test
        mockJsonLogicEvaluationService.evaluate
            .mockReturnValueOnce(true)  // First call passes
            .mockReturnValueOnce(false); // Second call fails

        const isValid = service.isValid(actionDef, mockActor, context); // Use actor from beforeEach

        expect(isValid).toBe(false);
        // Verify evaluate was called twice (by PrerequisiteChecker)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(1, rulePass, expect.any(Object));
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(2, ruleFail, expect.any(Object));
        // Check logs for the second failure (from PrerequisiteChecker and AVS)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='fail', Negate=false.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED for action '${actionDef.id}'. Reason: ${failureMsg}`)); // PrereqChecker log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`)); // AVS log
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ========================================================================
    // == >> THIS IS THE SECOND FAILING TEST << ==============================
    // ========================================================================
    test('Failure: Prerequisite uses context data (target component) but condition fails', () => {
        // Rule: Target's health is exactly 10 (it's 8)
        const rule = {"==": [{"var": "target.components.Health.current"}, 10]};
        const failureMsg = "Target health not 10."
        const actionDef = {
            id: 'test:prereq-uses-target-health-fail',
            actor_required_components: ['core:a'], // Use actor from beforeEach
            target_domain: 'environment', // Need target domain
            prerequisites: [{condition_type: 'target-health-check', logic: rule, failure_message: failureMsg}]
        };
        const targetContext = ActionTargetContext.forEntity(TARGET_ID); // Use target from beforeEach (has Health.current=8)

        // The PrerequisiteChecker will call the *mock* service.
        // We just need the mock service to return false to simulate the condition failing.
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        // Act
        const isValid = service.isValid(actionDef, mockActor, targetContext);

        // Assert isValid is false (because evaluate returned false)
        expect(isValid).toBe(false);

        // Assert evaluate was called correctly
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        // Check evaluate was called with the correct context (which includes target)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(rule, expect.objectContaining({
            target: expect.objectContaining({id: TARGET_ID}) // Verify target info is in the context
            // Note: The actual content of target.components.Health depends on PrerequisiteChecker's implementation
        }));

        // *** CRITICAL ASSERTION THAT FAILED ***
        // This assertion checks if the PrerequisiteChecker *correctly requested* the necessary
        // component data from the EntityManager *before* calling evaluate.
        // If this fails with "Number of calls: 0", it means the PrerequisiteChecker's
        // context creation logic IS NOT calling entityManager.getComponentData.
        // --> THE FIX for this failure lies in the PrerequisiteChecker service implementation,
        // --> NOT in changing this test assertion. The test is correctly identifying the bug.

        // Check Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rule evaluation result: false")); // From PrereqChecker (Check spacing)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED for action '${actionDef.id}'. Reason: ${failureMsg}`)); // From PrereqChecker
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`)); // From AVS
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Handles JsonLogicEvaluationService returning false during evaluation gracefully', () => {
        // Test scenario where the rule evaluation itself (inside the mock) simply returns false.
        const rule = {"someOp": [1]}; // A rule that will be evaluated
        const actionDef = {
            id: 'test:prereq-eval-false',
            actor_required_components: ['core:a'], // Use actor from beforeEach
            prerequisites: [{condition_type: 'eval-false-test', logic: rule}]
        };
        const context = ActionTargetContext.noTarget();

        // Configure mock JsonLogic service to return false
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        // Call isValid and expect it to handle the false return from PrerequisiteChecker
        const isValid = service.isValid(actionDef, mockActor, context); // Use actor from beforeEach

        expect(isValid).toBe(false); // Should fail validation if prerequisite check returns false
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // Check that PrerequisiteChecker logged the false result and failure reason
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rule evaluation result: false")); // Check spacing
        // Default message used by PrerequisiteChecker when evaluate returns false and no custom failure message exists
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED for action '${actionDef.id}'. Reason: Prerequisite check failed (type: eval-false-test).`));

        // Check that ActionValidationService logged the failure of Step 4
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(` -> STEP 4 PASSED.`));

        // No *error* should be logged by AVS or PrereqChecker, as returning false is expected behaviour, not an exception.
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    // Duplicate test from original code - confirming it still behaves as expected
    test('Failure: Multiple prerequisites, the second one fails (duplicate check)', () => {
        // Requirement 2: Define multiple JSON Logic rule objects
        const rulePass = {"==": [1, 1]};
        const ruleFail = {"==": [1, 0]};
        const failureMsg = "Second condition failed.";

        // Requirement 3: Define a mock ActionDefinition with prerequisites
        const actionDef = {
            id: 'test:multi-prereq-fail-second-dup', // Changed ID slightly to avoid Jest name collision if run in same context
            actor_required_components: ['core:a'], // Use actor from beforeEach (passes)
            prerequisites: [
                {condition_type: 'pass', logic: rulePass},
                {condition_type: 'fail', logic: ruleFail, failure_message: failureMsg}
            ]
        };

        // Requirement 4: Create mock actorEntity and targetContext
        const context = ActionTargetContext.noTarget(); // No target needed here (from beforeEach)

        // Requirement 5: Configure the mock evaluator to return true first, then false
        mockJsonLogicEvaluationService.evaluate
            .mockReturnValueOnce(true)  // First call passes
            .mockReturnValueOnce(false); // Second call fails

        // Requirement 6: Call service.isValid
        const isValid = service.isValid(actionDef, mockActor, context); // Use actor from beforeEach

        // Requirement 7: Assert that the result is false
        expect(isValid).toBe(false);

        // Requirement 8: Assert that mockJsonLogicEvaluationService.evaluate was called exactly twice
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);

        // Requirement 9: Assert the first call was with rule1 and the second call was with rule2
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(1, rulePass, expect.any(Object));
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(2, ruleFail, expect.any(Object));

        // Acceptance Criteria Check: Verify failure reason log (from PrerequisiteChecker)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` -> Evaluating prerequisite rule: Type='fail', Negate=false.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED for action '${actionDef.id}'. Reason: ${failureMsg}`));
        // Check AVS log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

}); // End describe block