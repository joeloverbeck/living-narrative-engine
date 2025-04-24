// src/tests/services/actionValidationService.targetComponents.test.js
// (Entire file content implementing the changes from Refactor-AVS-3.3.5 based on the refined ticket)

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Removed import for RealJsonLogicEvaluationService as it's no longer directly mocked/used by AVS tests ---

// --- Import the class AND mock its module ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Adjust path if necessary
jest.mock('../../validation/domainContextCompatibilityChecker.js'); // <<< Keep this mock

// --- Removed createActionValidationContext import as it's no longer injected into AVS ---
// import {createActionValidationContext} from '../../logic/createActionValidationContext.js';

// +++ Import PrerequisiteEvaluationService and mock it +++
import {PrerequisiteEvaluationService} from '../../services/prerequisiteEvaluationService.js'; // Adjust path if necessary
jest.mock('../../services/prerequisiteEvaluationService.js'); // Mock the service AVS now delegates to


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
// (Keep mockEntityManager setup as it was)
const mockEntityManager = {
    componentRegistry: new Map(),
    getEntityInstance: jest.fn(),
    activeEntities: new Map(),
    clearRegistry: function () {
        this.componentRegistry.clear();
        this.activeEntities.clear();
    },
    registerComponent: function (id, componentClass) {
        this.componentRegistry.set(id, componentClass);
    },
    addMockEntityForLookup: function (entity) {
        if (entity && entity.id) {
            this.activeEntities.set(entity.id, entity);
        }
    },
    getComponentData: jest.fn(), // Mock implementation below
    hasComponent: jest.fn(),     // Mock implementation below
};
mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    const componentMap = entity?.components;
    if (componentMap) {
        return componentMap.get(componentTypeId) ?? null;
    }
    return null;
});
mockEntityManager.hasComponent.mockImplementation((entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    const componentMap = entity?.components;
    if (componentMap) {
        return componentMap.has(componentTypeId) ?? false;
    }
    if (entity && typeof entity.hasComponent === 'function' && entity.hasComponent.mock) {
        return entity.hasComponent(componentTypeId);
    }
    return false;
});


// --- Mock Entity Factory ---
// (Keep createMockEntity factory as it was, ensure 'components' map is added)
const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
    const classToIdMap = new Map();
    for (const [compId, compClass] of mockEntityManager.componentRegistry.entries()) {
        classToIdMap.set(compClass, compId);
    }
    const internalComponentDataMap = new Map();
    const componentIdSet = new Set();
    for (const CompClass of components) {
        const compId = classToIdMap.get(CompClass);
        if (compId !== undefined) {
            componentIdSet.add(compId);
            let data = componentDataOverrides[compId];
            if (data === undefined) {
                try {
                    if (CompClass && typeof CompClass === 'function' && CompClass.prototype && CompClass.prototype.constructor === CompClass) {
                        data = new CompClass();
                    } else {
                        data = {};
                    }
                } catch (e) {
                    data = {};
                }
            }
            internalComponentDataMap.set(compId, data);
        }
    }
    const entity = {
        id: id,
        hasComponent: jest.fn((componentId) => internalComponentDataMap.has(componentId)),
        getComponent: jest.fn((componentId) => internalComponentDataMap.get(componentId)),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        components: internalComponentDataMap,
        // Add a simple mock for getAllComponentsData used by context builder (internal to PES now)
        getAllComponentsData: jest.fn(() => Object.fromEntries(internalComponentDataMap))
    };
    mockEntityManager.addMockEntityForLookup(entity);
    return entity;
};


// --- Mock GameDataRepository (Minimal) ---
// (Keep as is)
const mockGameDataRepository = {
    getAction: jest.fn(),
    getEntityDefinition: jest.fn(),
};

// --- Removed Mock JsonLogicEvaluationService object ---


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
    let domainContextCompatibilityChecker; // Mocked instance
    let mockPrerequisiteEvaluationServiceInstance; // Variable for the mocked PES instance

    const ACTOR_ID = 'actor-default';
    const TARGET_ID = 'target-default';
    const TARGET_ID_NOT_FOUND = 'target-invalid-id';

    beforeEach(() => {
        // Clear all mocks (jest.fn(), jest.mock(), etc.) FIRST
        jest.clearAllMocks();

        // Create fresh mocked instances for dependency injection AFTER clearAllMocks
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});

        // --- CORRECTED MOCK SETUP FOR PES ---
        // Instantiate the mocked PrerequisiteEvaluationService using the auto-mocked constructor
        mockPrerequisiteEvaluationServiceInstance = new PrerequisiteEvaluationService();

        // Ensure the 'evaluate' property exists as a mock function.
        // (Optional but safe check)
        if (!mockPrerequisiteEvaluationServiceInstance.evaluate || !jest.isMockFunction(mockPrerequisiteEvaluationServiceInstance.evaluate)) {
            mockPrerequisiteEvaluationServiceInstance.evaluate = jest.fn();
        }

        // *** MANUALLY set the 'length' property to satisfy the constructor's check ***
        Object.defineProperty(mockPrerequisiteEvaluationServiceInstance.evaluate, 'length', {
            value: 4, // The expected number of arguments for the real evaluate method
            writable: false
        });
        // --- END CORRECTION ---

        // --- Re-apply default mock behaviors AFTER jest.clearAllMocks() and length fix ---
        // Default PES evaluate: Pass unless overridden in a specific test
        // This now correctly targets the mock function whose length we just fixed.
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValue(true);
        // Default domain checker: Pass unless overridden
        domainContextCompatibilityChecker.check.mockReturnValue(true);
        // Default entity lookup
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            return mockEntityManager.activeEntities.get(id);
        });


        // Inject REQUIRED dependencies into ActionValidationService
        // This instantiation should now succeed because the mock PES meets the constructor criteria.
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker, // Pass the mocked instance
            prerequisiteEvaluationService: mockPrerequisiteEvaluationServiceInstance, // Pass the FIXED mocked PES instance
        });

        // Clear mock entity storage
        mockEntityManager.activeEntities.clear();
        // Create default actor
        mockActor = createMockEntity(ACTOR_ID, [MockComponentA]);
    });

    // --- Test Cases ---

    test('Success: Action has no prerequisites, domain/context compatible', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);
        const actionDef = {
            id: 'test:no-prereqs',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [] // No prerequisites
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
        // +++ Prerequisite evaluation (PES) should NOT happen +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success: Action prerequisites pass (target has required component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockTargetComponentRequired, MockComponentX]);
        const actionDef = {
            id: 'test:prereq-pass-has-comp',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [
                {logic: {"!!": [{"var": "target.components.target:required"}]}}
            ]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        // --- Configure Mock PES: Return true for this test's evaluation ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(true);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(true);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object
        );
        // --- Removed old JLES/incorrect PES signature assertions ---

        expect(mockLogger.error).not.toHaveBeenCalled();
        // Debug log check remains valid if AVS still logs steps
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 4 PASSED')); // Updated step number based on AVS code
    });

    test('Success: Action prerequisites pass (target lacks forbidden component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX]); // Does NOT have MockTargetComponentForbidden
        const actionDef = {
            id: 'test:prereq-pass-lacks-comp',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [
                {logic: {"missing": ["target.components.target:forbidden"]}}
            ]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        // --- Configure Mock PES: Return true ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(true);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(true);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object
        );
        // --- Removed old JLES/incorrect PES signature assertions ---

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 4 PASSED')); // Updated step number
    });

    test('Failure: Action prerequisites fail (target is missing required component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockComponentX]); // Does NOT have MockTargetComponentRequired
        const actionDef = {
            id: 'test:prereq-fail-missing-req',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [
                {logic: {"!!": [{"var": "target.components.target:required"}]}}
            ]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        // --- Configure Mock PES: Return false ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(false);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(false); // Expect failure based on mock PES return
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object
        );
        // --- Removed old JLES/incorrect PES signature assertions ---

        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for the failure log message (Assuming PES logs the specific failure, AVS logs the overall end state)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Prerequisite Not Met or Error during evaluation'));
    });

    test('Failure: Action prerequisites fail (target has forbidden component)', () => {
        mockTarget = createMockEntity(TARGET_ID, [MockTargetComponentForbidden, MockComponentX]);
        const actionDef = {
            id: 'test:prereq-fail-has-forbidden',
            target_domain: 'environment',
            template: 'do thing to {target}',
            prerequisites: [
                {logic: {"missing": ["target.components.target:forbidden"]}}
            ]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        // --- Configure Mock PES: Return false ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(false);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(false); // Expect failure
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object
        );
        // --- Removed old JLES/incorrect PES signature assertions ---

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Prerequisite Not Met or Error during evaluation'));
    });

    test('Failure (Target Not Found): Prerequisite evaluation delegated and fails due to mock', () => {
        // Note: AVS *will* call PES even if the target entity isn't found.
        // PES (and its internal context builder) will handle the missing entity.
        // PES's evaluation (mocked here) determines the final outcome.
        const actionDef = {
            id: 'test:target-not-found-prereq',
            target_domain: 'environment',
            template: '...',
            prerequisites: [
                {logic: {"==": [{"var": "target.components.core:x.x"}, 1]}}
            ]
        };
        const context = ActionTargetContext.forEntity(TARGET_ID_NOT_FOUND);

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === ACTOR_ID) return mockActor;
            if (id === TARGET_ID_NOT_FOUND) return undefined; // Simulate target not found
            return mockEntityManager.activeEntities.get(id);
        });

        // --- Configure Mock PES: Return false (simulating rule failure maybe due to missing data) ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(false);

        // --- Act ---
        const isValid = service.isValid(actionDef, mockActor, context);

        // --- Assert ---
        expect(isValid).toBe(false); // Fails because mocked PES returned false
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID_NOT_FOUND); // Lookup was attempted (by AVS step 2)
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Target entity '${TARGET_ID_NOT_FOUND}' not found`)); // Logged by AVS step 2
        expect(mockLogger.error).not.toHaveBeenCalled();

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object (which contains TARGET_ID_NOT_FOUND)
        );
        // --- Removed old JLES/incorrect PES signature assertions (checking internal context structure) ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Prerequisite Not Met or Error during evaluation'));
    });


    test('Failure (No Target): Prerequisite check runs via PES and fails due to mock', () => {
        const actionDef = {
            id: 'test:target-none-prereq-fail',
            target_domain: 'none',
            template: 'do thing',
            prerequisites: [{logic: {"==": [1, 0]}}] // Intentional fail rule
        };
        const context = ActionTargetContext.noTarget();

        // --- Configure Mock PES: Return false ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(false);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(false);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(expect.not.stringContaining(ACTOR_ID)); // No target entity ID lookup

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object (.noTarget())
        );
        // --- Removed old JLES/incorrect PES signature assertions ---

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Prerequisite Not Met or Error during evaluation'));
    });

    test('Success (Direction Target): Prerequisite checks run via PES (with direction target) and pass', () => {
        const actionDef = {
            id: 'test:target-direction-prereq-pass',
            target_domain: 'direction',
            template: 'go {direction}',
            prerequisites: [{logic: {"==": [{"var": "actor.id"}, ACTOR_ID]}}]
        };
        const direction = 'north';
        const context = ActionTargetContext.forDirection(direction);

        // --- Configure Mock PES: Return true ---
        mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(true);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(true);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(expect.not.stringContaining(ACTOR_ID)); // No entity lookup

        // +++ Verify PES was called correctly with the NEW signature +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
            actionDef.prerequisites,    // Prerequisites array
            actionDef,                // Action Definition object
            mockActor,                // Actor Entity object
            context                   // Action Target Context object (.forDirection())
        );
        // --- Removed old JLES/incorrect PES signature assertions ---

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 4 PASSED')); // Updated step number
    });


    test('Failure (Domain/Context Mismatch): target_domain="none" mismatches context.type="entity"', () => {
        mockTarget = createMockEntity(TARGET_ID, []);
        const actionDef = {
            id: 'test:target-domain-mismatch-fail',
            target_domain: 'none', // Expects no target
            template: 'do thing',
            prerequisites: [{logic: {"==": [1, 1]}}] // Prereqs exist but should not be reached
        };
        const context = ActionTargetContext.forEntity(TARGET_ID); // But given an entity target

        // Mock checker to fail
        domainContextCompatibilityChecker.check.mockReturnValue(false);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        expect(isValid).toBe(false);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        // Should fail before entity lookup or evaluation
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        // +++ Verify PES was NOT called +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for the Step 1 failure log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Domain/Context)'));
    });

    test('Failure (Domain/Context Mismatch): target_domain="self" mismatches context target entity', () => {
        const otherTargetId = 'other-target';
        mockTarget = createMockEntity(otherTargetId, []); // Target is NOT the actor
        const actionDef = {
            id: 'test:target-self-mismatch-fail',
            target_domain: 'self', // Expects target to be actor
            template: 'do thing to self',
            prerequisites: [] // No prereqs, but shouldn't be reached anyway
        };
        const context = ActionTargetContext.forEntity(otherTargetId); // Context points to the other entity

        // Domain checker passes type check (self requires entity)
        domainContextCompatibilityChecker.check.mockReturnValue(true);

        // Act
        const isValid = service.isValid(actionDef, mockActor, context);

        // Assert
        // Should fail at the specific 'self' ID check within ActionValidationService (Step 1)
        expect(isValid).toBe(false);
        expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDef, context);
        // Should fail before entity lookup or evaluation
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        // +++ Verify PES was NOT called +++
        expect(mockPrerequisiteEvaluationServiceInstance.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for the Step 1 failure log (specifically the 'self' mismatch part)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("STEP 1 FAILED ('self' target mismatch)"));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Domain/Context)'));

    });

}); // End describe suite