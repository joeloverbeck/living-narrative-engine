// src/tests/services/ActionValidationService.prerequisites.test.js
/**
 * @jest-environment node
 */

import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    jest,
    test
} from '@jest/globals';

// ─── Mock JsonLogicEvaluationService ───────────────────────────────────────────
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';

// ─── Mock DomainContextCompatibilityChecker ────────────────────────────────────
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';

// ─── Mock createActionValidationContext function ───────────────────────────────
import {createActionValidationContext} from '../../logic/createActionValidationContext.js';

// ==============================================================================
//  Mock logger
// ==============================================================================
const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// ==============================================================================
//  Mock component classes
// ==============================================================================
class MockComponentHealth {
    current = 50;
    max = 100;
}

class MockComponentMana {
    current = 20;
    max = 50;
}

class MockComponentInventory {
}

class MockComponentLockable {
    state = 'unlocked';
}

// ==============================================================================
//  Mock EntityManager
// ==============================================================================
const mockEntityManager = {
    componentRegistry: new Map(),
    getEntityInstance: jest.fn(),
    activeEntities: new Map(),

    clearRegistry() {
        this.componentRegistry.clear();
        this.activeEntities.clear();
    },

    registerComponent(id, cls) {
        this.componentRegistry.set(id, cls);
    },

    addMockEntityForLookup(entity) {
        if (entity && entity.id) this.activeEntities.set(entity.id, entity);
    },

    getComponentData: jest.fn((entityId, compId) => {
        const entity = mockEntityManager.activeEntities.get(entityId);
        return entity?.components.get(compId) ?? null;
    }),

    hasComponent: jest.fn((entityId, compId) => {
        const entity = mockEntityManager.activeEntities.get(entityId);
        return entity?.components.has(compId) ?? false;
    })
};

// ==============================================================================
//  Helper – create a mock entity
// ==============================================================================
const createMockEntity = (id, componentData = {}) => {
    const map = new Map();
    const set = new Set();

    for (const [compId, data] of Object.entries(componentData)) {
        if (mockEntityManager.componentRegistry.has(compId)) {
            map.set(compId, data);
            set.add(compId);
        } else {
            /* eslint-disable-next-line no-console */
            console.warn(
                `[Test Setup Warning] Mock component "${compId}" not registered.`
            );
        }
    }

    const ent = {
        id,
        hasComponent: jest.fn(c => set.has(c)),
        getComponent: jest.fn(c => map.get(c)),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        components: map
    };

    mockEntityManager.addMockEntityForLookup(ent);
    return ent;
};

// ==============================================================================
//  Mock collaborators for the service
// ==============================================================================
const mockDomainContextCompatibilityChecker = {
    check: jest.fn().mockReturnValue(true)
};

const mockJsonLogicEvaluationService = {
    evaluate: jest.fn(),
    addOperation: jest.fn()
};

const mockCreateActionValidationContext = jest.fn(
    (actor, targetCtx) => ({
        _mockContextFor: actor.id,
        _mockTargetType: targetCtx.type,
        _mockTargetDetail: targetCtx.entityId ?? targetCtx.direction ?? null
    })
);

// ==============================================================================
//  Global component registration
// ==============================================================================
beforeAll(() => {
    mockEntityManager.registerComponent('core:health', MockComponentHealth);
    mockEntityManager.registerComponent('resource:mana', MockComponentMana);
    mockEntityManager.registerComponent('game:inventory', MockComponentInventory);
    mockEntityManager.registerComponent('game:lockable', MockComponentLockable);
});

afterAll(() => {
    mockEntityManager.clearRegistry();
});

// ==============================================================================
//  Test suite
// ==============================================================================
describe('ActionValidationService – Prerequisite Checks (JSON Logic)', () => {
    let service;
    let mockActor;
    let mockTarget;
    let mockContextPlaceholder;

    const ACTOR_ID = 'actor-prereq';
    const TARGET_ID = 'target-prereq';

    // ---------------------------------------------------------------------------
    //  Per-test setup
    // ---------------------------------------------------------------------------
    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.activeEntities.clear();

        service = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker: mockDomainContextCompatibilityChecker,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            createActionValidationContextFunction: mockCreateActionValidationContext
        });

        mockActor = createMockEntity(ACTOR_ID, {
            'core:health': {current: 50, max: 100},
            'resource:mana': {current: 20, max: 50}
        });

        mockTarget = createMockEntity(TARGET_ID, {
            'game:lockable': {state: 'unlocked'}
        });

        mockEntityManager.getEntityInstance.mockImplementation(
            id => mockEntityManager.activeEntities.get(id)
        );

        mockDomainContextCompatibilityChecker.check.mockReturnValue(true);
        mockJsonLogicEvaluationService.evaluate.mockReset();
        mockCreateActionValidationContext.mockClear();

        mockContextPlaceholder = {
            _mockContextFor: ACTOR_ID,
            _mockTargetType: 'entity',
            _mockTargetDetail: TARGET_ID
        };
        mockCreateActionValidationContext.mockReturnValue(mockContextPlaceholder);
    });

    // ---------------------------------------------------------------------------
    //  Tests
    // ---------------------------------------------------------------------------
    test('Success (Prerequisites – Empty): passes with empty array', () => {
        const actionDef = {
            id: 'test:empty-prereqs',
            target_domain: 'entity',
            prerequisites: []
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledTimes(1);
        expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('No prerequisites to evaluate. Skipping STEP 2.')
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success (Prerequisites – Absent): passes when property is missing', () => {
        const actionDef = {
            id: 'test:absent-prereqs',
            target_domain: 'entity'
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledTimes(1);
        expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('No prerequisites to evaluate. Skipping STEP 2.')
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('Success (Prerequisites – Invalid Type): succeeds & warns', () => {
        const actionDef = {
            id: 'test:invalid-prereqs-type',
            target_domain: 'entity',
            prerequisites: {logic: {'==': [1, 1]}} // not an array
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledTimes(1);
        expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                "Action 'test:invalid-prereqs-type' has a 'prerequisites' property, but it's not an array."
            )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('No prerequisites to evaluate. Skipping STEP 2.')
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    //  All other (unchanged) prerequisite tests
    // ---------------------------------------------------------------------------

    test('Success (Single Prerequisite Pass)', () => {
        const rule = {'==': [1, 1]};
        const actionDef = {
            id: 'test:single-prereq-pass',
            target_domain: 'entity',
            prerequisites: [{logic: rule}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Failure (Single Prerequisite Fail)', () => {
        const rule = {'==': [1, 2]};
        const actionDef = {
            id: 'test:single-prereq-fail',
            target_domain: 'entity',
            prerequisites: [{logic: rule}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Success (Multiple Prerequisites Pass)', () => {
        const rule1 = {'>': [10, 5]};
        const rule2 = {in: ['apple', ['apple', 'banana']]};
        const actionDef = {
            id: 'test:multi-prereq-pass',
            target_domain: 'entity',
            prerequisites: [{logic: rule1}, {logic: rule2}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(
            1,
            rule1,
            mockContextPlaceholder
        );
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(
            2,
            rule2,
            mockContextPlaceholder
        );
    });

    test('Failure (Multiple Prerequisites Fail – First)', () => {
        const rule1 = {'==': [1, 2]}; // fail
        const rule2 = {'==': [1, 1]}; // pass, not reached
        const actionDef = {
            id: 'test:multi-prereq-fail-first',
            target_domain: 'entity',
            prerequisites: [{logic: rule1}, {logic: rule2}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate.mockReturnValueOnce(false);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule1,
            mockContextPlaceholder
        );
    });

    test('Failure (Multiple Prerequisites Fail – Later)', () => {
        const rule1 = {'==': [1, 1]}; // pass
        const rule2 = {'==': [1, 2]}; // fail
        const actionDef = {
            id: 'test:multi-prereq-fail-later',
            target_domain: 'entity',
            prerequisites: [{logic: rule1}, {logic: rule2}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate
            .mockReturnValueOnce(true)  // rule1
            .mockReturnValueOnce(false); // rule2

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(
            1,
            rule1,
            mockContextPlaceholder
        );
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenNthCalledWith(
            2,
            rule2,
            mockContextPlaceholder
        );
    });

    test('Success (Actor Component Check Pass)', () => {
        const rule = {'>': [{var: 'actor.components.core:health.current'}, 40]};
        const actionDef = {
            id: 'test:actor-check-pass',
            target_domain: 'none',
            prerequisites: [{logic: rule}]
        };
        const ctx = ActionTargetContext.noTarget();
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        mockContextPlaceholder = {
            _mockContextFor: ACTOR_ID,
            _mockTargetType: 'none',
            _mockTargetDetail: null
        };
        mockCreateActionValidationContext.mockReturnValue(mockContextPlaceholder);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Failure (Actor Component Check Fail)', () => {
        const rule = {
            '>': [{var: 'actor.components.resource:mana.current'}, 25]
        };
        const actionDef = {
            id: 'test:actor-check-fail',
            target_domain: 'none',
            prerequisites: [{logic: rule}]
        };
        const ctx = ActionTargetContext.noTarget();
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        mockContextPlaceholder = {
            _mockContextFor: ACTOR_ID,
            _mockTargetType: 'none',
            _mockTargetDetail: null
        };
        mockCreateActionValidationContext.mockReturnValue(mockContextPlaceholder);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Success (Target Component Check Pass)', () => {
        const rule = {
            '==': [{var: 'target.components.game:lockable.state'}, 'unlocked']
        };
        const actionDef = {
            id: 'test:target-check-pass',
            target_domain: 'entity',
            prerequisites: [{logic: rule}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Failure (Target Component Check Fail)', () => {
        mockTarget = createMockEntity(TARGET_ID, {
            'game:lockable': {state: 'locked'}
        });
        mockEntityManager.getEntityInstance.mockImplementation(
            id => mockEntityManager.activeEntities.get(id)
        );

        const rule = {
            '==': [{var: 'target.components.game:lockable.state'}, 'unlocked']
        };
        const actionDef = {
            id: 'test:target-check-fail',
            target_domain: 'entity',
            prerequisites: [{logic: rule}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Success (Actor and Target Check Pass)', () => {
        const ruleActor = {
            '>': [{var: 'actor.components.resource:mana.current'}, 10]
        };
        const ruleTarget = {
            '==': [{var: 'target.components.game:lockable.state'}, 'unlocked']
        };
        const actionDef = {
            id: 'test:actor-target-check-pass',
            target_domain: 'entity',
            prerequisites: [{logic: ruleActor}, {logic: ruleTarget}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);
    });

    test('Failure (Actor and Target Check Fail – Actor)', () => {
        const ruleActor = {
            '>': [{var: 'actor.components.resource:mana.current'}, 30]
        };
        const ruleTarget = {
            '==': [{var: 'target.components.game:lockable.state'}, 'unlocked']
        };
        const actionDef = {
            id: 'test:actor-target-check-fail-actor',
            target_domain: 'entity',
            prerequisites: [{logic: ruleActor}, {logic: ruleTarget}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        mockJsonLogicEvaluationService.evaluate
            .mockReturnValueOnce(false);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            ruleActor,
            mockContextPlaceholder
        );
    });

    test('Success (Negated Prerequisite Pass)', () => {
        const rule = {'==': [1, 2]}; // false
        const actionDef = {
            id: 'test:negated-prereq-pass',
            target_domain: 'none',
            prerequisites: [{logic: rule, negate: true}]
        };
        const ctx = ActionTargetContext.noTarget();
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        mockContextPlaceholder = {
            _mockContextFor: ACTOR_ID,
            _mockTargetType: 'none',
            _mockTargetDetail: null
        };
        mockCreateActionValidationContext.mockReturnValue(mockContextPlaceholder);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(true);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Failure (Negated Prerequisite Fail)', () => {
        const rule = {'==': [1, 1]}; // true
        const actionDef = {
            id: 'test:negated-prereq-fail',
            target_domain: 'none',
            prerequisites: [{logic: rule, negate: true}]
        };
        const ctx = ActionTargetContext.noTarget();
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        mockContextPlaceholder = {
            _mockContextFor: ACTOR_ID,
            _mockTargetType: 'none',
            _mockTargetDetail: null
        };
        mockCreateActionValidationContext.mockReturnValue(mockContextPlaceholder);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule,
            mockContextPlaceholder
        );
    });

    test('Failure (Invalid Prerequisite Logic)', () => {
        const actionDef = {
            id: 'test:invalid-logic-prereq',
            target_domain: 'entity',
            prerequisites: [{logic: 'not-an-object'}]
        };
        const ctx = ActionTargetContext.forEntity(TARGET_ID);

        const ok = service.isValid(actionDef, mockActor, ctx);

        expect(ok).toBe(false);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledTimes(1);
        expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                "Prerequisite on action 'test:invalid-logic-prereq' has invalid 'logic'"
            )
        );
    });
});