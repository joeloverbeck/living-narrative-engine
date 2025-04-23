// src/tests/services/actionValidationService.prerequisites.isolated.test.js
// Extracted tests for isolation

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
// --- Mock JsonLogicEvaluationService --- V3.3 Add
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Keep this for PrerequisiteChecker mock
import {ComponentRequirementChecker} from '../../validation/componentRequirementChecker.js'; // Adjust path if necessary
// +++ ADD IMPORTS FOR THE MISSING CHECKERS +++
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
import {PrerequisiteChecker} from '../../validation/prerequisiteChecker.js';
// --- End Added Imports ---

// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
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

class MockHealthComponent {
} // Define a class for Health
class MockComponentX {
} // Another component for variety

// +++ Define missing mock classes +++
class MockComponentSome {
}

class MockComponentOther {
}

// +++ End added mock classes +++

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
        if (
            typeof entity.hasComponent === 'function' &&
            entity.hasComponent.mock
        ) {
            // Check if it's the mock function from createMockEntity
            return entity.hasComponent(componentTypeId);
        }
        // Fallback if entity doesn't have the mock function (less likely with current setup)
        const componentMap = entity.components;
        return componentMap?.has(componentTypeId) ?? false;
    }),
};

// --- Mock Entity ---
// *** UPDATED Factory function to create mock entities with configurable components ***
const createMockEntity = (
    id,
    components = [],
    componentDataOverrides = {}
) => {
    // Create a map to look up ID from Class (reverse of registry)
    // Note: This assumes IDs are unique. If a Class could have multiple IDs (unlikely), this needs adjustment.
    const classToIdMap = new Map();
    for (const [compId, compClass] of mockEntityManager.componentRegistry.entries()) {
        classToIdMap.set(compClass, compId);
    }

    // Store the IDs corresponding to the input component classes
    const componentIdSet = new Set(
        components
            .map((CompClass) => classToIdMap.get(CompClass)) // Map Class to ID
            .filter((compId) => compId !== undefined) // Filter out any classes not in the registry (shouldn't happen with test setup)
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
        components: internalComponentDataMap,
    };
    // Automatically add to EntityManager's lookup map when created via this helper
    mockEntityManager.addMockEntityForLookup(entity);
    return entity;
};

// --- Mock GameDataRepository (Minimal) ---
// This might not be strictly needed by AVS anymore, but keep if other logic uses it
const mockGameDataRepository = {
    getAction: jest.fn(),
    getEntityDefinition: jest.fn(),
};

// --- Mock JsonLogicEvaluationService --- V3.3 Add
// This mock IS still needed because PrerequisiteChecker uses it.
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn(),
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
    // Added components referenced in the extracted context test
    // +++ FIX: Register with classes +++
    mockEntityManager.registerComponent('core:someComponent', MockComponentSome);
    mockEntityManager.registerComponent('core:otherComponent', MockComponentOther);
    // +++ End Fix +++
    mockEntityManager.registerComponent('Health', MockHealthComponent); // Register 'Health' with the class
});

afterAll(() => {
    // Clean up registry if necessary
    mockEntityManager.clearRegistry();
});

// ========================================================================
// == Isolated Prerequisite Checks (From V3.3 Suite) ======================
// ========================================================================
describe('ActionValidationService - Isolated Prerequisite Checks (JsonLogic)', () => {
    let service;
    let mockActor;
    let mockTarget;
    let componentRequirementChecker;
    // +++ DECLARE VARIABLES FOR NEW CHECKERS +++
    let domainContextCompatibilityChecker;
    let prerequisiteChecker;
    // --- End Variable Declarations ---
    const ACTOR_ID = 'actor-prereq';
    const TARGET_ID = 'target-prereq';

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear(); // Clear entities

        // +++ INSTANTIATE THE CHECKERS +++
        componentRequirementChecker = new ComponentRequirementChecker({
            logger: mockLogger,
        });
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({
            logger: mockLogger,
        });
        prerequisiteChecker = new PrerequisiteChecker({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // Pass the mock evaluator
            entityManager: mockEntityManager, // Pass the mock entity manager
            logger: mockLogger, // Pass the mock logger
        });
        // --- End Checker Instantiation ---

        // +++ UPDATE SERVICE INSTANTIATION +++
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            // gameDataRepository: mockGameDataRepository, // REMOVE - Service no longer uses this
            logger: mockLogger,
            // jsonLogicEvaluationService: mockJsonLogicEvaluationService, // REMOVE - Service no longer uses this directly
            componentRequirementChecker, // Pass the instance
            domainContextCompatibilityChecker, // Pass the instance
            prerequisiteChecker, // Pass the instance
        });
        // --- End Service Instantiation Update ---

        // Setup Base Actor & Target (will pass component checks by default)
        // Provide some component data for context assembly testing
        // Note: These might be overridden by specific tests if needed
        // Setup Base Actor & Target
        mockActor = createMockEntity(
            ACTOR_ID,
            [MockComponentA, MockHealthComponent], // Actor needs core:a and Health based on tests below
            {
                Position: {x: 1, y: 2},
                Health: {current: 5, max: 10}, // Data override still uses string ID key
            }
        );
        mockTarget = createMockEntity(
            TARGET_ID,
            [MockComponentX], // Assuming target doesn't need Health for this test block's default
            {
                Position: {x: 3, y: 4},
                Health: {current: 8, max: 8}, // Example target data
            }
        );

        // Reset getEntityInstance mock
        mockEntityManager.getEntityInstance.mockImplementation((id) =>
            mockEntityManager.activeEntities.get(id)
        );

        // Reset mocks before each test
        mockJsonLogicEvaluationService.evaluate.mockClear(); // Clear the evaluator mock
        mockEntityManager.getComponentData.mockClear();
        mockEntityManager.hasComponent.mockClear();
        mockEntityManager.getEntityInstance.mockClear();
    });

    // ========================================================================
    // == Test Case for Sub-ticket 3.5.5 / 4.2 ==============================
    // ========================================================================
    test('Success: One prerequisite rule that evaluates to true', () => {
        // 1. Define a simple JSON Logic rule object
        const rule1 = {'==': [1, 1]}; // Simple true rule

        // 2. Define a mock ActionDefinition with one prerequisite
        //    Ensures other checks pass by using actor/target from beforeEach setup
        const actionDef = {
            id: 'test:one-prereq-pass',
            actor_required_components: ['core:a'], // Use actor from beforeEach (has 'core:a')
            target_domain: 'environment', // Use target from beforeEach (matches entity context)
            prerequisites: [{condition_type: 'test', logic: rule1}], // Exactly one prerequisite
        };

        // 3. Create mock targetContext (using target from beforeEach setup)
        const context = ActionTargetContext.forEntity(TARGET_ID);

        // --- IMPORTANT: Configure the mock that PrerequisiteChecker uses ---
        // 4. Configure the mock JSON Logic evaluator (used *by* PrerequisiteChecker) to return true
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
        // --- End Configuration ---

        // 5. Call service.isValid
        const isValid = service.isValid(actionDef, mockActor, context); // Use actor/target from beforeEach

        // 6. Assert that the result is true
        expect(isValid).toBe(true);

        // --- Assert that the JSON Logic Evaluator was called ---
        // 7. Assert that mockJsonLogicEvaluationService.evaluate was called exactly once
        //    (because PrerequisiteChecker delegates the evaluation to it)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // 8. Assert mockJsonLogicEvaluationService.evaluate was called with the correct rule and context
        //    (The context is assembled *within* PrerequisiteChecker now)
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule1, // The specific rule object
            expect.objectContaining({
                // Check key parts of the context ASSEMBLED BY PrerequisiteChecker
                actor: expect.objectContaining({id: ACTOR_ID}),
                target: expect.objectContaining({id: TARGET_ID}), // Target is resolved before context assembly
                event: expect.objectContaining({type: 'ACTION_VALIDATION'}),
                // Add other context properties if needed for assertion
            })
        );
        // --- End JSON Logic Assertions ---

        // --- Log Checks review ---
        // Log messages from AVS itself:
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(` -> STEP 4: Checking Prerequisites...`)
        );
        // Log messages from PrerequisiteChecker (assuming its internal logging):
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
                `PrerequisiteChecker: Starting check for action '${actionDef.id}'`
            )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
                `Evaluating prerequisite rule: Type='test'`
            )
        ); // From Prereq Checker
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Rule evaluation result: true`)
        ); // From Prereq Checker or JsonLogic Service
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
                `PrerequisiteChecker: All 1 prerequisite(s) met`
            )
        ); // From Prereq Checker
        // Log message from AVS confirming Step 4 passed:
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(` -> STEP 4 PASSED.`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
    // ========================================================================
    // == End Test Case for Sub-ticket 3.5.5 ================================
    // ========================================================================

    test('Failure: Prerequisite definition is missing the "logic" property', () => {
        const actionDef = {
            id: 'test:missing-logic-prereq',
            actor_required_components: ['core:a'], // Use actor from beforeEach
            target_domain: 'none', // Ensure domain check passes with noTarget context
            prerequisites: [{condition_type: 'invalid' /* no logic property */}],
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context); // Use actor from beforeEach

        expect(isValid).toBe(false);
        // PrerequisiteChecker should NOT call the evaluator if logic is missing
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        // The warning now comes from PrerequisiteChecker
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                `PrerequisiteChecker: Skipping prerequisite in action '${actionDef.id}' due to missing or invalid 'logic' property. Considering this a failure.`
            ),
            expect.objectContaining({
                prerequisite: expect.objectContaining({condition_type: 'invalid'}),
            })
        );
        // AVS log should indicate Step 4 failure
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(` <- STEP 4 FAILED: Prerequisite Check.`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success: Prerequisite uses context data (actor component)', () => {
        // Rule: Actor's health is exactly 5
        const rule = {'==': [{var: 'actor.components.Health.current'}, 5]};
        const actionDef = {
            id: 'test:prereq-uses-actor-health',
            actor_required_components: ['core:a', 'Health'], // Use actor from beforeEach (has both)
            target_domain: 'none', // Ensure domain check passes with noTarget context
            prerequisites: [{condition_type: 'health-check', logic: rule}],
        };
        const context = ActionTargetContext.noTarget();

        // Let the *real* evaluator run via the mock setup IF PrerequisiteChecker uses the mock correctly
        const realJsonLogicService = new JsonLogicEvaluationService({
            logger: mockLogger,
        });
        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, context) =>
            realJsonLogicService.evaluate(rule, context)
        );

        const isValid = service.isValid(actionDef, mockActor, context); // mockActor from beforeEach has Health.current = 5

        expect(isValid).toBe(true);
        // Check that evaluate was called by PrerequisiteChecker
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        // The context passed to evaluate is assembled by PrerequisiteChecker
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            expect.objectContaining({
                actor: expect.objectContaining({
                    id: ACTOR_ID,
                    // The context assembler (`createJsonLogicContext`) creates the component accessor
                    components: expect.any(Object), // Or expect.any(Function) depending on accessor implementation
                }),
                target: null, // Target is null because context is noTarget
                event: expect.objectContaining({type: 'ACTION_VALIDATION'}),
            })
        );
        // Check that EntityManager was used by context assembly inside PrerequisiteChecker
        // The context assembler needs getComponentData to populate the 'components' accessor data
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
            ACTOR_ID,
            'Health'
        );
        // Log Checks
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Rule evaluation result: true`)
        ); // Logged by evaluator or checker
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(` -> STEP 4 PASSED.`)
        ); // Logged by AVS
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ========================================================================
    // == NEW Test Case for Sub-ticket 3.5.10 / 4.7 =========================
    // ========================================================================
    test('isValid passes correctly structured context to the evaluator', () => {
        // 1. Define mock actorEntity with necessary components for checks
        const actorContextId = 'actor-context-test';
        // +++ FIX: Create actor with CLASSES, not ID strings +++
        const mockActorContext = createMockEntity(
            actorContextId,
            [MockComponentSome, MockComponentA], // Use the CLASSES
            {'core:a': {}} // Data override still uses ID string key
        );

        // 2. Define mock targetEntity with 'core:otherComponent'
        const targetContextId = 'target-context-test';
        // +++ FIX: Create target with CLASS, not ID string +++
        const mockTargetContextEntity = createMockEntity(
            targetContextId,
            [MockComponentOther] // Use the CLASS
        );

        // 3. Configure mockEntityManager.getEntityInstance (done by createMockEntity & beforeEach)

        // 4. Configure mockEntityManager.getComponentData / hasComponent (done by mock entity state)

        // 5. Define a JSON Logic rule that references context
        const rule1 = {if: [{var: 'actor.id'}, true, false]}; // Simple rule

        // 6. Define a mock ActionDefinition
        const actionDef = {
            id: 'test:action-context-struct-check',
            actor_required_components: ['core:a'], // Requirement is ID string (Correct)
            target_required_components: [], // Keep simple
            target_domain: 'environment', // Needs entity target to assemble full context
            prerequisites: [{condition_type: 'context-test-rule', logic: rule1}],
            template: 'Context structure check',
        };

        // 7. Create the targetContext
        const targetContext = ActionTargetContext.forEntity(targetContextId);

        // 8. Configure the mock evaluator (called by PrerequisiteChecker) to return true
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        // 9. Call service.isValid
        const isValid = service.isValid(actionDef, mockActorContext, targetContext); // Use the corrected actor

        // +++ Add assertion that isValid should now return true +++
        expect(isValid).toBe(true);
        // +++ End added assertion +++

        // 10. Assert mockJsonLogicEvaluationService.evaluate was called once
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // 11. Capture the context argument passed to the mock evaluator
        expect(mockJsonLogicEvaluationService.evaluate.mock.calls.length).toBe(1);
        const evaluationContextArg = mockJsonLogicEvaluationService.evaluate.mock.calls[0][1];

        // 12. Assert the structure and content of evaluationContextArg (assembled by PrerequisiteChecker)
        // --- Actor ---
        expect(evaluationContextArg).toHaveProperty('actor');
        expect(evaluationContextArg.actor).not.toBeNull();
        expect(evaluationContextArg.actor).toHaveProperty('id', actorContextId);
        expect(evaluationContextArg.actor).toHaveProperty('components'); // Check for the accessor presence
        expect(evaluationContextArg.actor.components).toBeInstanceOf(Object); // Or Function

        // --- Target ---
        expect(evaluationContextArg).toHaveProperty('target');
        expect(evaluationContextArg.target).not.toBeNull();
        expect(evaluationContextArg.target).toHaveProperty('id', targetContextId);
        expect(evaluationContextArg.target).toHaveProperty('components'); // Check for the accessor presence
        expect(evaluationContextArg.target.components).toBeInstanceOf(Object); // Or Function

        // --- Event ---
        expect(evaluationContextArg).toHaveProperty('event');
        expect(evaluationContextArg.event).toHaveProperty('type', 'ACTION_VALIDATION');
        expect(evaluationContextArg.event).toHaveProperty('payload');
        expect(evaluationContextArg.event.payload).toEqual({actionId: actionDef.id}); // Check payload assembled by PrereqChecker

        // --- Other Top-Level Keys (from createJsonLogicContext) ---
        expect(evaluationContextArg).toHaveProperty('context', {});
        expect(evaluationContextArg).toHaveProperty('globals', {});
        expect(evaluationContextArg).toHaveProperty('entities', {}); // Context assembler adds this

        // --- Verify underlying mocks were used as expected for context assembly by PrerequisiteChecker ---
        // Expect getEntityInstance to have been called by AVS (Step 3) AND PrerequisiteChecker (for context, if createJsonLogicContext needs it - depends on its impl.)
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetContextId); // AVS Step 3a definitely calls this.

        // hasComponent / getComponentData might be called by createComponentAccessor during context assembly.
        // Exact calls depend on the accessor implementation and the rule being evaluated.
        // For rule {"if": [{"var": "actor.id"}, true, false]}, data access might not happen.
        // If rule was {"var": "actor.components.someComponent.data"}, then getComponentData would be called.
        // expect(mockEntityManager.hasComponent).toHaveBeenCalled(); // Optional: Check if accessor triggered this
        // expect(mockEntityManager.getComponentData).toHaveBeenCalled(); // Optional: Check if accessor triggered this
    });
    // ========================================================================
    // == End Test Case for Sub-ticket 3.5.10 ===============================
    // ========================================================================
}); // End describe block