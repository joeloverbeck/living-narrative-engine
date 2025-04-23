// src/tests/services/actionValidationService.inputValidation.test.js

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";
// --- Mock JsonLogicEvaluationService ---
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Keep if used directly elsewhere, but not needed for AVS constructor
import {ComponentRequirementChecker} from "../../validation/componentRequirementChecker.js";
// --- ADDED IMPORTS FOR MISSING CHECKERS ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
import {PrerequisiteChecker} from '../../validation/prerequisiteChecker.js';
// ------------------------------------------


// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// --- Mock Component Classes ---
// (Keep existing mock component classes)
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
class MockTargetComponentRequired {
}

class MockTargetComponentForbidden {
}

class MockComponentX {
} // Another component for variety

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
        if (typeof entity.hasComponent === 'function' && entity.hasComponent.mock) {
            return entity.hasComponent(componentTypeId);
        }
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
// NOTE: No longer needed for AVS instantiation, but keep if needed elsewhere in test suite
const mockGameDataRepository = {
    getAction: jest.fn(),
    getEntityDefinition: jest.fn(),
};

// --- Mock JsonLogicEvaluationService ---
// NOTE: No longer needed directly by AVS constructor, but needed for PrerequisiteChecker
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
    // --- Declare variables for checkers ---
    let componentRequirementChecker;
    let domainContextCompatibilityChecker;
    let prerequisiteChecker;
    // ------------------------------------

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear();
        mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.activeEntities.get(id));

        // --- Instantiate ALL required Checkers ---
        componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        prerequisiteChecker = new PrerequisiteChecker({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // Pass mock service
            entityManager: mockEntityManager, // Pass mock entity manager
            logger: mockLogger // Pass mock logger
        });
        // -----------------------------------------

        // --- CORRECTED ActionValidationService Instantiation ---
        service = new ActionValidationService({
            entityManager: mockEntityManager, // Pass the mock EntityManager instance
            logger: mockLogger, // Pass the mock logger instance
            componentRequirementChecker, // Pass the ComponentRequirementChecker instance
            domainContextCompatibilityChecker, // Pass the DomainContextCompatibilityChecker instance
            prerequisiteChecker // Pass the PrerequisiteChecker instance
        });
        // ------------------------------------------------------

        mockActor = createMockEntity('actor-throw'); // Create a default actor for these tests

        // Default JsonLogic mock to true (good practice)
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
    });


    test('isValid throws Error if missing or invalid actionDefinition', () => {
        const context = ActionTargetContext.noTarget();
        // Adjust error message based on the *actual* code in ActionValidationService.js (assuming it checks for non-empty string ID)
        const expectedErrorMsgPart = "ActionValidationService.isValid: Missing or invalid actionDefinition."; // Simplified based on provided code

        // Check null actionDefinition
        expect(() => service.isValid(null, mockActor, context)).toThrow(expectedErrorMsgPart);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsgPart,
            expect.objectContaining({actionDefinition: null})
        );
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled(); // Verify prerequisite check not reached

        mockLogger.error.mockClear(); // Clear mock calls

        // Check empty id - adjusted check based on actual constructor code
        expect(() => service.isValid({id: ''}, mockActor, context)).toThrow(expectedErrorMsgPart);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsgPart,
            expect.objectContaining({actionDefinition: {id: ''}})
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled(); // Verify prerequisite check not reached
    });

    test('isValid throws Error if missing or invalid actorEntity', () => {
        const actionDef = {id: 'test:action-throw', target_domain: 'none', template: 't'};
        const context = ActionTargetContext.noTarget();
        // Adjust expected message based on actual code
        const expectedErrorMsg = `ActionValidationService.isValid: Missing or invalid actorEntity object for action '${actionDef.id}'.`;

        // Check null actorEntity
        expect(() => service.isValid(actionDef, null, context)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({actorEntity: null})
        );
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        mockLogger.error.mockClear();

        // Check invalid actorEntity structure (missing id or hasComponent function)
        const invalidActor = {some: 'property'};
        expect(() => service.isValid(actionDef, invalidActor, context)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({actorEntity: invalidActor})
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    });

    test('isValid throws Error if missing or invalid targetContext', () => {
        const actionDef = {id: 'test:action-throw', target_domain: 'none', template: 't'};
        // Adjust expected message based on actual code
        const expectedErrorMsg = `ActionValidationService.isValid: Missing or invalid targetContext object for action '${actionDef.id}'. Expected instance of ActionTargetContext.`;


        // Check null targetContext
        expect(() => service.isValid(actionDef, mockActor, null)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({targetContext: null})
        );
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        mockLogger.error.mockClear();

        // Check invalid targetContext structure (not an instance of ActionTargetContext)
        const invalidContext = {type: 'entity', entityId: 'some-id'}; // Plain object, not instance
        expect(() => service.isValid(actionDef, mockActor, invalidContext)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expect.objectContaining({targetContext: invalidContext})
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    });

});