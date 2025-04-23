/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path if necessary
// --- Import the class AND mock its module ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Adjust path if necessary
jest.mock('../../validation/domainContextCompatibilityChecker.js'); // <<< Add this line
// +++ Import the required context creation function +++
import {createActionValidationContext} from '../../logic/createActionValidationContext.js';

// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// --- Mock Component Classes ---
// (Keep all mock component classes as they were)
class MockComponentA {
}

class MockComponentB {
}

class MockComponentC {
}

class MockTargetComponentRequired {
}

class MockTargetComponentForbidden {
}

class MockComponentX {
}

class MockPositionComponent {
    constructor() {
        this.x = 1;
        this.y = 1;
    }
}


// --- Mock EntityManager ---
// (Keep mockEntityManager as it was)
const mockEntityManager = {
    componentRegistry: new Map(),
    getEntityInstance: jest.fn(),
    activeEntities: new Map(),
    clearRegistry: function () { /*...*/
    },
    registerComponent: function (id, componentClass) { /*...*/
    },
    addMockEntityForLookup: function (entity) { /*...*/
    },
    getComponentData: jest.fn((entityId, componentTypeId) => { /*...*/
    }),
    hasComponent: jest.fn((entityId, componentTypeId) => { /*...*/
    }),
};
mockEntityManager.clearRegistry = function () {
    this.componentRegistry.clear();
    this.activeEntities.clear();
};
mockEntityManager.registerComponent = function (id, componentClass) {
    this.componentRegistry.set(id, componentClass);
};
mockEntityManager.addMockEntityForLookup = function (entity) {
    if (entity && entity.id) {
        this.activeEntities.set(entity.id, entity);
    }
};
mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    if (!entity) return null;
    const componentMap = entity.components;
    return componentMap?.get(componentTypeId) ?? null;
});
mockEntityManager.hasComponent.mockImplementation((entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    if (!entity) return false;
    if (typeof entity.hasComponent === 'function' && entity.hasComponent.mock) {
        return entity.hasComponent(componentTypeId);
    }
    const componentMap = entity.components;
    return componentMap?.has(componentTypeId) ?? false;
});


// --- Mock Entity Factory ---
// (Keep createMockEntity factory as it was)
const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
    const classToIdMap = new Map();
    for (const [compId, compClass] of mockEntityManager.componentRegistry.entries()) {
        classToIdMap.set(compClass, compId);
    }
    const componentIdSet = new Set(components.map(CompClass => classToIdMap.get(CompClass)).filter(compId => compId !== undefined));
    const internalComponentDataMap = new Map();
    for (const compId of componentIdSet) {
        const CompClass = mockEntityManager.componentRegistry.get(compId);
        let defaultData = {};
        try {
            if (CompClass && typeof CompClass === 'function' && Object.keys(CompClass).length > 0) {
                defaultData = new CompClass();
            }
        } catch (e) { /* ignore */
        }
        internalComponentDataMap.set(compId, componentDataOverrides[compId] || defaultData || {});
    }
    const entity = {
        id: id,
        hasComponent: jest.fn((componentId) => componentIdSet.has(componentId)),
        getComponent: jest.fn((componentId) => internalComponentDataMap.get(componentId)),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        components: internalComponentDataMap
    };
    mockEntityManager.addMockEntityForLookup(entity);
    return entity;
};


// --- Mock GameDataRepository (Minimal) ---
// (Keep mockGameDataRepository as it was)
const mockGameDataRepository = {getAction: jest.fn(), getEntityDefinition: jest.fn(),};

// --- Mock JsonLogicEvaluationService ---
// (Keep mockJsonLogicEvaluationService as it was)
const mockJsonLogicEvaluationService = {evaluate: jest.fn(), addOperation: jest.fn(),};

// --- Global Setup ---
beforeAll(() => {
    // (Keep component registrations)
    mockEntityManager.registerComponent('core:a', MockComponentA);
    mockEntityManager.registerComponent('core:b', MockComponentB);
    mockEntityManager.registerComponent('core:c', MockComponentC);
    mockEntityManager.registerComponent('core:x', MockComponentX);
    mockEntityManager.registerComponent('target:required', MockTargetComponentRequired);
    mockEntityManager.registerComponent('target:forbidden', MockTargetComponentForbidden);
    mockEntityManager.registerComponent('Position', MockPositionComponent);
});

afterAll(() => {
    mockEntityManager.clearRegistry();
});


// ========================================================================
// == Test Suite: ActionValidationService - Target/Prerequisite Checks ===
// ========================================================================
describe('ActionValidationService - Target/Prerequisite Checks', () => {
    let service;
    let mockActor;
    let mockTarget;
    // --- This will hold the MOCKED instance ---
    let domainContextCompatibilityChecker;

    const ACTOR_ID = 'actor-default';
    const TARGET_ID = 'target-default';
    const TARGET_ID_NOT_FOUND = 'target-invalid-id';

    beforeEach(() => {
        // --- Clear the mock before each test ---
        DomainContextCompatibilityChecker.mockClear(); // Clears constructor calls etc.

        // --- Instantiate the MOCKED checker ---
        // Jest replaces the constructor with a mock constructor
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});

        // --- Set default return value for the mocked check method ---
        // As ActionValidationService uses the boolean return, provide a default.
        // Tests expecting domain failure should override this.
        domainContextCompatibilityChecker.check.mockReturnValue(true);

        // --- Clear other mocks (important!) ---
        jest.clearAllMocks(); // Clears logger, EM mocks, JsonLogic mocks etc.

        // --- Re-apply default mocks needed AFTER jest.clearAllMocks() ---
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true); // Default pass for prerequisites
        mockEntityManager.getEntityInstance.mockImplementation((id) => { // Default entity lookup
            return mockEntityManager.activeEntities.get(id);
        });


        // --- Inject ALL required dependencies into ActionValidationService ---
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            // --- Pass the MOCKED instance ---
            domainContextCompatibilityChecker,
            createActionValidationContextFunction: createActionValidationContext
        });
        // --- ---


        mockEntityManager.activeEntities.clear(); // Clear mock entity storage

        // Create a default mock actor for convenience
        mockActor = createMockEntity(ACTOR_ID, [MockComponentA]);

    });

    // --- Test Cases ---

    test('Success: Action has no prerequisites, domain/context compatible', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:no-prereqs',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: []
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success: Action prerequisites pass (target has required component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockTargetComponentRequired, MockComponentX]);
        const actionDef = {
            id: 'test:prereq-pass-has-comp',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [{logic: {"!!": [{"get": "target.components.target:required"}]}, failure_message: "..."}]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, data) => {
            if (rule?.['!!']?.[0]?.get === 'target.components.target:required' && data?.target?.id === TARGET_ID) {
                return mockEntityManager.hasComponent(data.target.id, 'target:required');
            }
            return false;
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success: Action prerequisites pass (target lacks forbidden component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:prereq-pass-lacks-comp',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [{logic: {"missing": ["target.components.target:forbidden"]}, failure_message: "..."}]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, data) => {
            if (rule?.missing?.[0] === 'target.components.target:forbidden' && data?.target?.id === TARGET_ID) {
                return !mockEntityManager.hasComponent(data.target.id, 'target:forbidden');
            }
            return false;
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    test('Failure: Action prerequisites fail (target is missing required component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:prereq-fail-missing-req',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [{
                logic: {"!!": [{"get": "target.components.target:required"}]},
                failure_message: "Target requires target:required component"
            }]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, data) => {
            if (rule?.['!!']?.[0]?.get === 'target.components.target:required' && data?.target?.id === TARGET_ID) {
                return mockEntityManager.hasComponent(data.target.id, 'target:required');
            }
            return true;
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Failure: Action prerequisites fail (target has forbidden component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockTargetComponentForbidden, MockComponentX]);
        const actionDef = {
            id: 'test:prereq-fail-has-forbidden',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [{
                logic: {"missing": ["target.components.target:forbidden"]},
                failure_message: "Target must not have target:forbidden component"
            }]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, data) => {
            if (rule?.missing?.[0] === 'target.components.target:forbidden' && data?.target?.id === TARGET_ID) {
                return !mockEntityManager.hasComponent(data.target.id, 'target:forbidden');
            }
            return true;
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Failure (Target Not Found): Prerequisite check fails because target entity cannot be resolved', () => {
        const actionDef = {
            id: 'test:target-not-found-prereq',
            target_domain: 'environment',
            template: '...',
            prerequisites: [{logic: {"==": [1, 1]}}]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID_NOT_FOUND);

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === ACTOR_ID) return mockActor;
            if (id === TARGET_ID_NOT_FOUND) return undefined;
            return mockEntityManager.activeEntities.get(id);
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled(); // It's called before the target resolution error
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID_NOT_FOUND);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Prerequisite Check FAILED: Required target entity '${TARGET_ID_NOT_FOUND}' could not be resolved for action '${actionDef.id}'.`));
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    });


    test('Failure (No Target): Prerequisite check runs and fails even with target_domain="none"', () => {
        const actionDef = {
            id: 'test:target-none-prereq-fail', // Slightly adjusted ID for clarity
            target_domain: 'none',
            template: 'do thing',
            // Prerequisites exist, so evaluation will occur
            prerequisites: [{logic: {"==": [1, 0]}, failure_message: "Intentional fail rule"}]
        };
        const context = ActionTargetContext.noTarget();

        // Ensure the mock evaluation returns false specifically for this rule
        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, data) => {
            // A simple mock: Make our specific rule fail, others pass (if any were added)
            if (rule && rule['=='] && rule['=='][0] === 1 && rule['=='][1] === 0) {
                return false; // This rule fails
            }
            return true; // Default other rules to pass if needed
        });

        // --- Act ---
        const isValid = service.isValid(actionDef, mockActor, context);

        // --- Assert ---
        expect(isValid).toBe(false); // << CORRECTED EXPECTATION: It fails because the prerequisite is evaluated and returns false.

        // Verify the flow:
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context); // Domain check still happens and passes
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID); // Actor is resolved for context

        // IMPORTANT: Context is built and evaluation IS called because prerequisites exist
        // We can infer context was built because evaluate was called.
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1); // << CORRECTED ASSERTION: Evaluation was called
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites[0].logic, // The specific rule
            expect.any(Object)                // The context object built
        );

        // Check logs for the failure reason
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 2 FAILED: Prerequisite check FAILED'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Reason: ${actionDef.prerequisites[0].failure_message}`));
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should not be an unexpected error
    });

    test('Skipped (Direction Target): target_domain="direction", context.type="direction". Prerequisite checks run (with null target).', () => {
        const actionDef = {
            id: 'test:target-skip-direction',
            target_domain: 'direction',
            template: 'go {direction}',
            prerequisites: [{logic: {"==": [{"get": "actor.id"}, ACTOR_ID]}}]
        };
        const context = ActionTargetContext.forDirection('north');

        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, data) => {
            if (rule?.['==']?.[0]?.get === 'actor.id' && data?.actor?.id === ACTOR_ID) {
                return true;
            }
            return false;
        });

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ACTOR_ID);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Failure (Domain/Context Mismatch): target_domain="none" mismatches context.type="entity"', () => {
        mockTarget = createMockEntity(TARGET_ID, []);
        const actionDef = {
            id: 'test:target-domain-mismatch-fail',
            target_domain: 'none',
            template: 'do thing',
            prerequisites: [{logic: {"==": [1, 1]}}]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        // --- Crucial: Override the mock return value for this specific test ---
        domainContextCompatibilityChecker.check.mockReturnValue(false);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // --- Now this assertion works on the MOCKED check method ---
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        // We need to check the *mock* logger now, as the real checker is mocked
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Failure (Domain/Context Mismatch): target_domain="self" mismatches context target entity', () => {
        const otherTargetId = 'other-target';
        mockTarget = createMockEntity(otherTargetId, []);
        const actionDef = {
            id: 'test:target-self-mismatch-fail',
            target_domain: 'self',
            template: 'do thing to self',
            prerequisites: []
        };
        const context = ActionTargetContext.forEntity(otherTargetId);

        // The 'self' check happens *inside* ActionValidationService AFTER the initial check call.
        // So, the initial check should still pass (return true) for this test case.
        // The failure comes from the specific `if (expectedDomain === 'self' ...)` block.
        // No need to `mockReturnValue(false)` here unless the initial check should also fail.

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        // --- Now this assertion works on the MOCKED check method ---
        // The initial check is still called
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        // Check the specific log from ActionValidationService for the 'self' mismatch
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


}); // End describe suite