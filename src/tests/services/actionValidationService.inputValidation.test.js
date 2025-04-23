// src/tests/services/actionValidationService.inputValidation.test.js

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";
// --- Mock JsonLogicEvaluationService ---
// Import is not strictly needed if only mock is used, but keep for clarity or potential direct use elsewhere
// --- Import Checkers ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';


// --- Mock Logger ---
// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// --- Mock Component Classes ---
class MockComponentA {
}

class MockComponentB {
}

class MockComponentC {
}

class MockComponentRequired {
}

class MockComponentForbidden {
}

class MockTargetComponentRequired {
}

class MockTargetComponentForbidden {
}

class MockComponentX {
}

// --- Mock EntityManager ---
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
    getComponentData: jest.fn((entityId, componentTypeId) => {
        const entity = mockEntityManager.activeEntities.get(entityId);
        if (!entity) return null;
        const componentMap = entity.components;
        return componentMap?.get(componentTypeId) ?? null;
    }),
    hasComponent: jest.fn((entityId, componentTypeId) => {
        const entity = mockEntityManager.activeEntities.get(entityId);
        if (!entity) return false;
        // Prefer entity's own mocked hasComponent if available (set by createMockEntity)
        if (typeof entity.hasComponent === 'function' && entity.hasComponent.mock) {
            return entity.hasComponent(componentTypeId);
        }
        // Fallback for simpler cases or direct checks on the map
        const componentMap = entity.components;
        return componentMap?.has(componentTypeId) ?? false;
    }),
};


// --- Mock Entity Factory ---
const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
    const classToIdMap = new Map();
    for (const [compId, compClass] of mockEntityManager.componentRegistry.entries()) {
        classToIdMap.set(compClass, compId);
    }
    const componentIdSet = new Set(
        components
            .map(CompClass => classToIdMap.get(CompClass))
            .filter(compId => compId !== undefined)
    );
    const internalComponentDataMap = new Map();
    for (const compId of componentIdSet) {
        internalComponentDataMap.set(compId, componentDataOverrides[compId] || {});
    }
    const entity = {
        id: id,
        // Mock the hasComponent method directly on the entity instance
        hasComponent: jest.fn((componentId) => componentIdSet.has(componentId)),
        getComponent: jest.fn((componentId) => internalComponentDataMap.get(componentId)),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        components: internalComponentDataMap // Keep this for potential direct access if needed
    };
    mockEntityManager.addMockEntityForLookup(entity); // Ensure it's findable by ID
    return entity;
};

// --- Mock createActionValidationContext Function ---
// This function is required by the ActionValidationService constructor
const mockCreateActionValidationContext = jest.fn();

// --- Mock JsonLogicEvaluationService ---
// This service is required by the ActionValidationService constructor
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
    mockEntityManager.registerComponent('core:x', MockComponentX);
    mockEntityManager.registerComponent('test:required', MockComponentRequired);
    mockEntityManager.registerComponent('test:forbidden', MockComponentForbidden);
    mockEntityManager.registerComponent('target:required', MockTargetComponentRequired);
    mockEntityManager.registerComponent('target:forbidden', MockTargetComponentForbidden);
    mockEntityManager.registerComponent('Position', {}); // Register dummy Position
    mockEntityManager.registerComponent('Health', {});   // Register dummy Health
});

afterAll(() => {
    mockEntityManager.clearRegistry();
});

describe('ActionValidationService - Input Validation and Errors', () => {
    let service;
    let mockActor;
    // Declare variables for checkers and other dependencies needed for AVS
    let domainContextCompatibilityChecker;
    // Note: ComponentRequirementChecker and PrerequisiteChecker are NOT direct dependencies of AVS constructor
    // let componentRequirementChecker;
    // let prerequisiteChecker;


    beforeEach(() => {
        // Reset mocks and state before each test
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear();
        // Ensure getEntityInstance returns entities added via addMockEntityForLookup
        mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.activeEntities.get(id));
        // Clear the new mock function's history
        mockCreateActionValidationContext.mockClear();
        // Clear JsonLogic evaluation history
        mockJsonLogicEvaluationService.evaluate.mockClear();


        // --- Instantiate Dependencies NEEDED by ActionValidationService ---
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        // The other checkers (ComponentRequirementChecker, PrerequisiteChecker) might be instantiated here
        // if they were needed by *other* tests within this describe block, but not for AVS instantiation.
        // componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        // prerequisiteChecker = new PrerequisiteChecker({
        //     jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        //     entityManager: mockEntityManager,
        //     logger: mockLogger
        // });

        // --- CORRECT ActionValidationService Instantiation ---
        service = new ActionValidationService({
            entityManager: mockEntityManager,           // Pass the mock EntityManager instance
            logger: mockLogger,                       // Pass the mock logger instance
            domainContextCompatibilityChecker: domainContextCompatibilityChecker, // Pass the DomainContextCompatibilityChecker instance
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // Pass the JsonLogicEvaluationService mock
            createActionValidationContextFunction: mockCreateActionValidationContext // Pass the mock function
        });
        // ------------------------------------------------------

        // Create a default actor for use in tests
        mockActor = createMockEntity('actor-default');

        // --- Default Mock Behaviors ---
        // Good practice: JsonLogic prerequisites often default to passing unless tested otherwise
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
        // Provide a default return value for the context creation function if its result might be needed
        // Adjust the structure based on what createActionValidationContext actually returns
        mockCreateActionValidationContext.mockReturnValue({
            actor: {id: mockActor.id, /* other actor context data */},
            target: null, // Default to no target context data
            world: { /* world state data */}
        });
    });


    test('isValid throws Error if missing or invalid actionDefinition', () => {
        const context = ActionTargetContext.noTarget();
        // Use the exact error message thrown by the service's constructor check
        const expectedErrorMsg = "ActionValidationService.isValid: invalid actionDefinition";

        // Test cases for invalid actionDefinition
        expect(() => service.isValid(null, mockActor, context)).toThrow(expectedErrorMsg);
        expect(() => service.isValid(undefined, mockActor, context)).toThrow(expectedErrorMsg);
        expect(() => service.isValid({}, mockActor, context)).toThrow(expectedErrorMsg); // Missing id
        expect(() => service.isValid({id: null}, mockActor, context)).toThrow(expectedErrorMsg);
        expect(() => service.isValid({id: ''}, mockActor, context)).toThrow(expectedErrorMsg); // Empty id
        expect(() => service.isValid({id: '   '}, mockActor, context)).toThrow(expectedErrorMsg); // Whitespace id (due to trim())
        expect(() => service.isValid({id: 123}, mockActor, context)).toThrow('actionDefinition?.id?.trim is not a function'); // Non-string id

        // Optional: Verify logger was called if desired (though throwing is the primary check)
        // expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg), expect.any(Object));

        // Verify prerequisite/evaluation logic was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
    });

    test('isValid throws Error if missing or invalid actorEntity', () => {
        // A minimal valid action definition for this test
        const actionDef = {id: 'test:action-basic', target_domain: 'none', template: 't'};
        const context = ActionTargetContext.noTarget();
        // Use the exact error message thrown by the service's constructor check
        const expectedErrorMsg = "ActionValidationService.isValid: invalid actorEntity";

        // Test cases for invalid actorEntity
        expect(() => service.isValid(actionDef, null, context)).toThrow(expectedErrorMsg);
        expect(() => service.isValid(actionDef, undefined, context)).toThrow(expectedErrorMsg);
        expect(() => service.isValid(actionDef, {}, context)).toThrow(expectedErrorMsg); // Missing id
        expect(() => service.isValid(actionDef, {id: null}, context)).toThrow(expectedErrorMsg);
        expect(() => service.isValid(actionDef, {id: ''}, context)).toThrow(expectedErrorMsg); // Empty id
        expect(() => service.isValid(actionDef, {id: '  '}, context)).toThrow(expectedErrorMsg); // Whitespace id (due to trim())
        expect(() => service.isValid(actionDef, {id: 456}, context)).toThrow('actorEntity?.id?.trim is not a function'); // Non-string id
        // Although the check is just for 'id', ensure it handles non-objects gracefully if possible
        expect(() => service.isValid(actionDef, "not an object", context)).toThrow(expectedErrorMsg);

        // Optional: Check logger call
        // expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg), expect.any(Object));

        // Verify prerequisite/evaluation logic was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
    });

    test('isValid throws Error if missing or invalid targetContext', () => {
        // A minimal valid action definition for this test
        const actionDef = {id: 'test:action-basic', target_domain: 'none', template: 't'};
        // Use the exact error message thrown by the service's constructor check
        const expectedErrorMsg = "ActionValidationService.isValid: targetContext must be ActionTargetContext";

        // Test cases for invalid targetContext
        expect(() => service.isValid(actionDef, mockActor, null)).toThrow(expectedErrorMsg);
        expect(() => service.isValid(actionDef, mockActor, undefined)).toThrow(expectedErrorMsg);

        // Check invalid targetContext structure (plain object, not an instance of ActionTargetContext)
        const invalidContextObject = {type: 'entity', entityId: 'some-id'};
        expect(() => service.isValid(actionDef, mockActor, invalidContextObject)).toThrow(expectedErrorMsg);

        // Check other non-instance values
        expect(() => service.isValid(actionDef, mockActor, "not a context")).toThrow(expectedErrorMsg);
        expect(() => service.isValid(actionDef, mockActor, 123)).toThrow(expectedErrorMsg);


        // Optional: Check logger call
        // expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg), expect.any(Object));

        // Verify prerequisite/evaluation logic was not reached
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
    });
}); // End describe block