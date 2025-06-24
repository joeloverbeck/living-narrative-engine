// src/tests/services/actionValidationService.prerequisites.isolated.test.js
// MODIFIED: Applying changes from Refactor-AVS-3.3.5
// NOTE: This file focuses on testing AVS's interaction with the mocked PrerequisiteEvaluationService (PES),
// verifying the correct delegation signature.

/**
 * @jest-environment node
 */
/* type-only imports */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../src/validation/domainContextCompatibilityChecker.js').DomainContextCompatibilityChecker} DomainContextCompatibilityChecker */
/** @typedef {import('../../../src/actions/actionTypes.js').ActionAttemptPseudoEvent} ActionAttemptPseudoEvent */
/** @typedef {import('../../../src/actions/validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */

/** @typedef {import('../../../../src/models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

// --- Service and Function Imports ---
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { DomainContextCompatibilityChecker } from '../../../src/validation/domainContextCompatibilityChecker.js';

const mockLogger = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// --- Mock Component Classes ---
class MockComponentA {}
class MockComponentB {}
class MockComponentC {}
class MockComponentRequired {}
class MockComponentForbidden {}
class MockTargetComponentRequired {}
class MockTargetComponentForbidden {}
class MockHealthComponent {}
class MockComponentX {}
class MockComponentSome {}
class MockComponentOther {}

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
    if (typeof entity.getComponent === 'function') {
      return entity.getComponent(componentTypeId) ?? null;
    }
    const componentMap = entity.components;
    return componentMap?.get(componentTypeId) ?? null;
  }),
  hasComponent: jest.fn((entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    if (!entity) return false;
    if (typeof entity.hasComponent === 'function') {
      return entity.hasComponent(componentTypeId);
    }
    const componentMap = entity.components;
    return componentMap?.has(componentTypeId) ?? false;
  }),
};

// --- Mock Entity Factory ---
const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
  const classToIdMap = new Map();
  for (const [
    compId,
    compClass,
  ] of mockEntityManager.componentRegistry.entries()) {
    classToIdMap.set(compClass, compId);
  }

  const componentIdSet = new Set();
  const internalComponentDataMap = new Map();

  for (const CompClass of components) {
    const compId = classToIdMap.get(CompClass);
    if (compId) {
      componentIdSet.add(compId);
      internalComponentDataMap.set(
        compId,
        componentDataOverrides[compId] || {}
      );
    }
  }

  for (const compId in componentDataOverrides) {
    if (!internalComponentDataMap.has(compId)) {
      internalComponentDataMap.set(compId, componentDataOverrides[compId]);
      let foundClass = false;
      for (const [
        regId,
        regClass,
      ] of mockEntityManager.componentRegistry.entries()) {
        if (regId === compId) {
          componentIdSet.add(regId);
          foundClass = true;
          break;
        }
      }
      if (!foundClass) {
        componentIdSet.add(compId);
      }
    }
  }

  const entity = {
    id: id,
    hasComponent: jest.fn((componentId) => componentIdSet.has(componentId)),
    getComponent: jest.fn((componentId) =>
      internalComponentDataMap.get(componentId)
    ),
    getAllComponentsData: jest.fn(() => {
      const data = {};
      internalComponentDataMap.forEach((value, key) => {
        data[key] = value;
      });
      return data;
    }),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
  };
  mockEntityManager.addMockEntityForLookup(entity);
  return entity;
};

// --- Mock PrerequisiteEvaluationService ---
jest.mock('../../../src/actions/validation/prerequisiteEvaluationService.js');
let mockPrerequisiteEvaluationServiceInstance;

// --- Global Setup ---
beforeAll(() => {
  mockEntityManager.registerComponent('core:a', MockComponentA);
  mockEntityManager.registerComponent('core:b', MockComponentB);
  mockEntityManager.registerComponent('core:c', MockComponentC);
  mockEntityManager.registerComponent('core:x', MockComponentX);
  mockEntityManager.registerComponent('test:required', MockComponentRequired);
  mockEntityManager.registerComponent('test:forbidden', MockComponentForbidden);
  mockEntityManager.registerComponent(
    'target:required',
    MockTargetComponentRequired
  );
  mockEntityManager.registerComponent(
    'target:forbidden',
    MockTargetComponentForbidden
  );
  mockEntityManager.registerComponent('Position', {});
  mockEntityManager.registerComponent('core:someComponent', MockComponentSome);
  mockEntityManager.registerComponent(
    'core:otherComponent',
    MockComponentOther
  );
  mockEntityManager.registerComponent('Health', MockHealthComponent);
});

afterAll(() => {
  mockEntityManager.clearRegistry();
});

// ========================================================================
// == Prerequisite Interaction Tests (Using Mocked PES) ==
// ========================================================================
describe('ActionValidationService - Prerequisite Delegation Checks (Mocked PES)', () => {
  let service;
  let mockActor;
  let mockTarget;
  let domainContextCompatibilityChecker;
  const ACTOR_ID = 'actor-prereq';
  const TARGET_ID = 'target-prereq';

  beforeEach(() => {
    jest.clearAllMocks();
    mockEntityManager.activeEntities.clear();
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      mockEntityManager.activeEntities.get(id)
    );

    mockPrerequisiteEvaluationServiceInstance =
      new PrerequisiteEvaluationService();

    if (
      !mockPrerequisiteEvaluationServiceInstance.evaluate ||
      !jest.isMockFunction(mockPrerequisiteEvaluationServiceInstance.evaluate)
    ) {
      mockPrerequisiteEvaluationServiceInstance.evaluate = jest.fn();
    }

    Object.defineProperty(
      mockPrerequisiteEvaluationServiceInstance.evaluate,
      'length',
      {
        value: 4,
        writable: false,
      }
    );

    domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({
      logger: mockLogger,
    });

    service = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationServiceInstance,
    });

    mockActor = createMockEntity(ACTOR_ID, [
      MockComponentA,
      MockHealthComponent,
    ]);
    mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);

    mockPrerequisiteEvaluationServiceInstance.evaluate.mockClear();
    mockEntityManager.getComponentData.mockClear();
    mockEntityManager.hasComponent.mockClear();
    mockEntityManager.getEntityInstance.mockClear();
  });

  test('Success: Calls PES with correct signature when prerequisites exist and PES mock returns true', () => {
    const ruleLogic = { '==': [1, 1] };
    const prerequisitesArray = [{ condition_type: 'test', logic: ruleLogic }];
    const actionDef = {
      id: 'test:pes-delegation-pass',
      prerequisites: prerequisitesArray,
      scope: 'entity', // FIXED: Replaced target_domain with scope
    };
    const targetContext = ActionTargetContext.forEntity(TARGET_ID);

    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      true
    );

    const isValid = service.isValid(actionDef, mockActor, targetContext);

    expect(isValid).toBe(true);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      prerequisitesArray,
      actionDef,
      mockActor,
      targetContext
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('Failure: Calls PES with correct signature when prerequisites exist and PES mock returns false', () => {
    const ruleLogic = { '==': [1, 0] };
    const prerequisitesArray = [{ condition_type: 'test', logic: ruleLogic }];
    const actionDef = {
      id: 'test:pes-delegation-fail',
      prerequisites: prerequisitesArray,
      scope: 'entity', // FIXED: Replaced target_domain with scope
    };
    const targetContext = ActionTargetContext.forEntity(TARGET_ID);

    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      false
    );

    const isValid = service.isValid(actionDef, mockActor, targetContext);

    expect(isValid).toBe(false);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      prerequisitesArray,
      actionDef,
      mockActor,
      targetContext
    );
  });

  test('Success: Skips calling PES when prerequisites array is empty', () => {
    const actionDef = {
      id: 'test:no-prereqs-skip-pes',
      prerequisites: [],
      scope: 'none', // FIXED: Replaced target_domain with scope
    };
    const targetContext = ActionTargetContext.noTarget();

    const isValid = service.isValid(actionDef, mockActor, targetContext);

    expect(isValid).toBe(true);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('Success: Skips calling PES when prerequisites property is missing', () => {
    const actionDef = {
      id: 'test:missing-prereqs-skip-pes',
      scope: 'none', // FIXED: Replaced target_domain with scope
    };
    const targetContext = ActionTargetContext.noTarget();

    const isValid = service.isValid(actionDef, mockActor, targetContext);

    expect(isValid).toBe(true);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('isValid passes correct arguments (prereqs, actionDef, actor, targetCtx) to PES', () => {
    const actorContextId = 'actor-context-test';
    const mockActorForThisTest = createMockEntity(
      actorContextId,
      [MockComponentSome, MockComponentA],
      { 'core:a': { data: 'actor_a_data' } }
    );
    const targetContextId = 'target-context-test';
    const mockTargetEntityForThisTest = createMockEntity(
      targetContextId,
      [MockComponentOther],
      { 'core:otherComponent': { data: 'target_other_data' } }
    );

    const ruleLogic = { if: [{ var: 'actor.id' }, true, false] };
    const prerequisitesArray = [
      { condition_type: 'context-test-rule', logic: ruleLogic },
    ];
    const actionDef = {
      id: 'test:action-args-check-pes',
      actor_required_components: [],
      target_required_components: [],
      scope: 'entity', // FIXED: Replaced target_domain with scope
      prerequisites: prerequisitesArray,
      template: 'Args structure check',
    };
    const targetContext = ActionTargetContext.forEntity(targetContextId);

    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      true
    );

    const isValid = service.isValid(
      actionDef,
      mockActorForThisTest,
      targetContext
    );

    expect(isValid).toBe(true);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      prerequisitesArray,
      actionDef,
      mockActorForThisTest,
      targetContext
    );

    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
      targetContextId
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
