// src/tests/services/actionValidationService.prerequisites.isolated.test.js
// Extracted tests for isolation - focusing on Prerequisite (JSON Logic) checks

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
// --- Service and Function Imports ---
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- Import the context creation function required by ActionValidationService ---
import {createActionValidationContext} from '../../logic/createActionValidationContext.js';
// --- Import the checker ACTUALLY used by ActionValidationService ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';

// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
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

class MockHealthComponent {
}

class MockComponentX {
}

class MockComponentSome {
}

class MockComponentOther {
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
        if (typeof entity.hasComponent === 'function' && entity.hasComponent.mock) {
            return entity.hasComponent(componentTypeId);
        }
        const componentMap = entity.components;
        return componentMap?.has(componentTypeId) ?? false;
    }),
};

// --- Mock Entity Factory ---
const createMockEntity = (
    id,
    components = [],
    componentDataOverrides = {}
) => {
    const classToIdMap = new Map();
    for (const [compId, compClass] of mockEntityManager.componentRegistry.entries()) {
        classToIdMap.set(compClass, compId);
    }
    const componentIdSet = new Set(
        components
            .map((CompClass) => classToIdMap.get(CompClass))
            .filter((compId) => compId !== undefined)
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
        components: internalComponentDataMap,
    };
    mockEntityManager.addMockEntityForLookup(entity);
    return entity;
};


// --- Mock JsonLogicEvaluationService ---
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn(),
    addOperation: jest.fn(),
};

// --- Global Setup ---
beforeAll(() => {
    mockEntityManager.registerComponent('core:a', MockComponentA);
    mockEntityManager.registerComponent('core:b', MockComponentB);
    mockEntityManager.registerComponent('core:c', MockComponentC);
    mockEntityManager.registerComponent('core:x', MockComponentX);
    mockEntityManager.registerComponent('test:required', MockComponentRequired);
    mockEntityManager.registerComponent('test:forbidden', MockComponentForbidden);
    mockEntityManager.registerComponent('target:required', MockTargetComponentRequired);
    mockEntityManager.registerComponent('target:forbidden', MockTargetComponentForbidden);
    mockEntityManager.registerComponent('Position', {});
    mockEntityManager.registerComponent('core:someComponent', MockComponentSome);
    mockEntityManager.registerComponent('core:otherComponent', MockComponentOther);
    mockEntityManager.registerComponent('Health', MockHealthComponent);
});

afterAll(() => {
    mockEntityManager.clearRegistry();
});

// ========================================================================
// == Isolated Prerequisite Checks (Using Direct JSON Logic Evaluation) ==
// ========================================================================
describe('ActionValidationService - Isolated Prerequisite Checks (JsonLogic)', () => {
    let service;
    let mockActor;
    let mockTarget;
    let domainContextCompatibilityChecker;
    const ACTOR_ID = 'actor-prereq';
    const TARGET_ID = 'target-prereq';

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear();

        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({
            logger: mockLogger,
        });

        service = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            createActionValidationContextFunction: createActionValidationContext
        });

        mockActor = createMockEntity(
            ACTOR_ID,
            [MockComponentA, MockHealthComponent],
            {
                'Position': {x: 1, y: 2},
                'Health': {current: 5, max: 10},
            }
        );
        mockTarget = createMockEntity(
            TARGET_ID,
            [MockComponentX],
            {
                'Position': {x: 3, y: 4},
                'Health': {current: 8, max: 8},
            }
        );

        mockEntityManager.getEntityInstance.mockImplementation((id) =>
            mockEntityManager.activeEntities.get(id)
        );
        mockJsonLogicEvaluationService.evaluate.mockClear();
        mockEntityManager.getComponentData.mockClear();
        mockEntityManager.hasComponent.mockClear();
        mockEntityManager.getEntityInstance.mockClear();
    });

    // ========================================================================
    // == Test Case for Prerequisite Success ================================
    // ========================================================================
    test('Success: One prerequisite rule that evaluates to true', () => {
        const rule1 = {'==': [1, 1]};
        const actionDef = {
            id: 'test:one-prereq-pass',
            actor_required_components: [],
            target_domain: 'environment',
            prerequisites: [{condition_type: 'test', logic: rule1}],
        };
        const context = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);

        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule1,
            expect.objectContaining({
                actor: expect.objectContaining({id: ACTOR_ID}),
                target: expect.objectContaining({id: TARGET_ID}),
                event: null,
            })
        );

        // Log Checks
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
    // ========================================================================
    // == End Prerequisite Success Test =======================================
    // ========================================================================

    test('Failure: Prerequisite definition is missing the "logic" property', () => {
        const actionDef = {
            id: 'test:missing-logic-prereq',
            actor_required_components: [],
            target_domain: 'none',
            prerequisites: [{condition_type: 'invalid' /* no logic property */}],
        };
        const context = ActionTargetContext.noTarget();

        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        // Check that the specific warning for invalid logic was logged
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                `Prerequisite on action '${actionDef.id}' has invalid 'logic': undefined`
            )
        );
        // --- REMOVED Incorrect Assertion ---
        // The code returns false immediately after the warn, it doesn't log a specific "STEP 2 FAILED" debug message in this path.
        // expect(mockLogger.debug).toHaveBeenCalledWith(
        //     expect.stringMatching(/STEP 2 FAILED|END Validation: FAILED/)
        // );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success: Prerequisite uses context data (actor component)', () => {
        const rule = {'==': [{var: 'actor.components.Health.current'}, 5]};
        const actionDef = {
            id: 'test:prereq-uses-actor-health',
            actor_required_components: [],
            target_domain: 'none',
            prerequisites: [{condition_type: 'health-check', logic: rule}],
        };
        const context = ActionTargetContext.noTarget();

        const realJsonLogicService = new JsonLogicEvaluationService({
            logger: mockLogger,
        });
        mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, contextData) => {
            return realJsonLogicService.evaluate(rule, contextData);
        });


        const isValid = service.isValid(actionDef, mockActor, context);

        expect(isValid).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            expect.objectContaining({
                actor: expect.objectContaining({
                    id: ACTOR_ID,
                    components: expect.any(Object),
                }),
                target: null,
                event: null,
            })
        );

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
            ACTOR_ID,
            'Health'
        );

        // Log Checks
        // Check the detailed evaluation log from the AVS loop which includes the result
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ========================================================================
    // == Test Case for Context Structure ===================================
    // ========================================================================
    test('isValid passes correctly structured context to the evaluator', () => {
        const actorContextId = 'actor-context-test';
        const mockActorContext = createMockEntity(
            actorContextId,
            [MockComponentSome, MockComponentA],
            {'core:a': {}}
        );
        const targetContextId = 'target-context-test';
        const mockTargetContextEntity = createMockEntity(
            targetContextId,
            [MockComponentOther]
        );

        const rule1 = {if: [{var: 'actor.id'}, true, false]};
        const actionDef = {
            id: 'test:action-context-struct-check',
            actor_required_components: [],
            target_required_components: [],
            target_domain: 'environment',
            prerequisites: [{condition_type: 'context-test-rule', logic: rule1}],
            template: 'Context structure check',
        };
        const targetContext = ActionTargetContext.forEntity(targetContextId);

        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        const isValid = service.isValid(actionDef, mockActorContext, targetContext);

        expect(isValid).toBe(true);

        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        expect(mockJsonLogicEvaluationService.evaluate.mock.calls.length).toBe(1);
        const evaluationContextArg = mockJsonLogicEvaluationService.evaluate.mock.calls[0][1];

        expect(evaluationContextArg).toHaveProperty('actor');
        expect(evaluationContextArg.actor).not.toBeNull();
        expect(evaluationContextArg.actor).toHaveProperty('id', actorContextId);
        expect(evaluationContextArg.actor).toHaveProperty('components');
        expect(evaluationContextArg.actor.components).toBeInstanceOf(Object);

        expect(evaluationContextArg).toHaveProperty('target');
        expect(evaluationContextArg.target).not.toBeNull();
        expect(evaluationContextArg.target).toHaveProperty('id', targetContextId);
        expect(evaluationContextArg.target).toHaveProperty('components');
        expect(evaluationContextArg.target.components).toBeInstanceOf(Object);

        expect(evaluationContextArg).toHaveProperty('event', null);
        expect(evaluationContextArg).toHaveProperty('context', {});
        expect(evaluationContextArg).toHaveProperty('globals', {});
        expect(evaluationContextArg).toHaveProperty('entities', {});

        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetContextId);
    });
    // ========================================================================
    // == End Context Structure Test ========================================
    // ========================================================================

}); // End describe block