/**
 * @jest-environment node
 */
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { DomainContextIncompatibilityError } from '../../../src/errors/domainContextIncompatibilityError.js';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import { DomainContextCompatibilityChecker } from '../../../src/validation/domainContextCompatibilityChecker.js';
jest.mock('../../../src/validation/domainContextCompatibilityChecker.js');

import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
jest.mock('../../../src/actions/validation/prerequisiteEvaluationService.js');

const mockLogger = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

class MockComponentA {}
class MockComponentB {}
class MockComponentC {}
class MockTargetComponentRequired {}
class MockTargetComponentForbidden {}
class MockComponentX {}
class MockPositionComponent {
  constructor() {
    this.x = 1;
    this.y = 1;
  }
}

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
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
};
mockEntityManager.getComponentData.mockImplementation(
  (entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    return entity?.components?.get(componentTypeId) ?? null;
  }
);
mockEntityManager.hasComponent.mockImplementation(
  (entityId, componentTypeId) => {
    const entity = mockEntityManager.activeEntities.get(entityId);
    if (entity && typeof entity.hasComponent === 'function') {
      return entity.hasComponent(componentTypeId);
    }
    return false;
  }
);

const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
  const classToIdMap = new Map();
  for (const [
    compId,
    compClass,
  ] of mockEntityManager.componentRegistry.entries()) {
    classToIdMap.set(compClass, compId);
  }
  const internalComponentDataMap = new Map();
  for (const CompClass of components) {
    const compId = classToIdMap.get(CompClass);
    if (compId !== undefined) {
      internalComponentDataMap.set(
        compId,
        componentDataOverrides[compId] || new CompClass()
      );
    }
  }
  const entity = {
    id: id,
    hasComponent: jest.fn((componentId) =>
      internalComponentDataMap.has(componentId)
    ),
    getComponent: jest.fn((componentId) =>
      internalComponentDataMap.get(componentId)
    ),
    components: internalComponentDataMap,
  };
  mockEntityManager.addMockEntityForLookup(entity);
  return entity;
};

beforeAll(() => {
  mockEntityManager.registerComponent('core:a', MockComponentA);
  mockEntityManager.registerComponent('core:b', MockComponentB);
  mockEntityManager.registerComponent('core:c', MockComponentC);
  mockEntityManager.registerComponent('core:x', MockComponentX);
  mockEntityManager.registerComponent(
    'target:required',
    MockTargetComponentRequired
  );
  mockEntityManager.registerComponent(
    'target:forbidden',
    MockTargetComponentForbidden
  );
  mockEntityManager.registerComponent('Position', MockPositionComponent);
});

afterAll(() => {
  mockEntityManager.clearRegistry();
});

describe('ActionValidationService - Target/Prerequisite Checks', () => {
  let service;
  let mockActor;
  let mockTarget;
  let domainContextCompatibilityChecker;
  let mockPrerequisiteEvaluationServiceInstance;

  const ACTOR_ID = 'actor-default';
  const TARGET_ID = 'target-default';

  beforeEach(() => {
    jest.clearAllMocks();

    domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({
      logger: mockLogger,
    });
    mockPrerequisiteEvaluationServiceInstance =
      new PrerequisiteEvaluationService();
    mockPrerequisiteEvaluationServiceInstance.evaluate = jest.fn();
    Object.defineProperty(
      mockPrerequisiteEvaluationServiceInstance.evaluate,
      'length',
      { value: 4, writable: false }
    );
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValue(true);
    domainContextCompatibilityChecker.check.mockReturnValue(true);
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      mockEntityManager.activeEntities.get(id)
    );

    service = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationServiceInstance,
    });

    mockEntityManager.activeEntities.clear();
    mockActor = createMockEntity(ACTOR_ID, [MockComponentA]);
  });

  test('Success: Action has no prerequisites, scope/context compatible', () => {
    mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);
    const actionDef = {
      id: 'test:no-prereqs',
      scope: 'environment', // FIXED
      template: 'do thing to {target}',
      prerequisites: [],
    };
    const context = ActionTargetContext.forEntity(TARGET_ID);

    const isValid = service.isValid(actionDef, mockActor, context);

    expect(isValid).toBe(true);
    expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(
      actionDef,
      context
    );
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('Success: Action prerequisites pass (target has required component)', () => {
    mockTarget = createMockEntity(TARGET_ID, [
      MockTargetComponentRequired,
      MockComponentX,
    ]);
    const actionDef = {
      id: 'test:prereq-pass-has-comp',
      scope: 'environment', // FIXED
      template: 'do thing to {target}',
      prerequisites: [
        { logic: { '!!': [{ var: 'target.components.target:required' }] } },
      ],
    };
    const context = ActionTargetContext.forEntity(TARGET_ID);
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      true
    );

    const isValid = service.isValid(actionDef, mockActor, context);

    expect(isValid).toBe(true);
    expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      actionDef.prerequisites,
      actionDef,
      mockActor,
      context
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('STEP 4 PASSED')
    );
  });

  test('Failure: Action prerequisites fail (target is missing required component)', () => {
    mockTarget = createMockEntity(TARGET_ID, [MockComponentX]);
    const actionDef = {
      id: 'test:prereq-fail-missing-req',
      scope: 'environment', // FIXED
      template: 'do thing to {target}',
      prerequisites: [
        { logic: { '!!': [{ var: 'target.components.target:required' }] } },
      ],
    };
    const context = ActionTargetContext.forEntity(TARGET_ID);
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      false
    );

    const isValid = service.isValid(actionDef, mockActor, context);

    expect(isValid).toBe(false);
    expect(domainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      actionDef.prerequisites,
      actionDef,
      mockActor,
      context
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'END Validation: FAILED (Prerequisite Not Met or Error during evaluation'
      )
    );
  });

  test('Throw (Scope/Context Mismatch): scope="none" mismatches context.type="entity"', () => {
    mockTarget = createMockEntity(TARGET_ID, []);
    const actionDef = {
      id: 'test:target-domain-mismatch-fail',
      name: 'Mismatch Fail',
      scope: 'none', // FIXED
      template: 'do thing',
      prerequisites: [{ logic: { '==': [1, 1] } }],
    };
    const context = ActionTargetContext.forEntity(TARGET_ID);
    domainContextCompatibilityChecker.check.mockReturnValue(false);

    // FIXED: Updated expected error message
    const expectedErrorMsg = `Action 'test:target-domain-mismatch-fail' (scope 'none') expects no target, but context type is 'entity'.`;
    expect(() => {
      service.isValid(actionDef, mockActor, context);
    }).toThrow(DomainContextIncompatibilityError);
    expect(() => {
      service.isValid(actionDef, mockActor, context);
    }).toThrow(expectedErrorMsg);

    expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(
      actionDef,
      context
    );
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
  });

  test('Throw (Scope/Context Mismatch): scope="self" mismatches context target entity', () => {
    const otherTargetId = 'other-target';
    mockTarget = createMockEntity(otherTargetId, []);
    const actionDef = {
      id: 'test:target-self-mismatch-fail',
      name: 'Self Mismatch Fail',
      scope: 'self', // FIXED
      template: 'do thing to self',
      prerequisites: [],
    };
    const context = ActionTargetContext.forEntity(otherTargetId);
    domainContextCompatibilityChecker.check.mockReturnValue(true);

    // FIXED: Updated expected error message
    const expectedErrorMsg = `Action 'test:target-self-mismatch-fail' requires a 'self' target, but target was 'other-target'.`;
    expect(() => {
      service.isValid(actionDef, mockActor, context);
    }).toThrow(DomainContextIncompatibilityError);
    expect(() => {
      service.isValid(actionDef, mockActor, context);
    }).toThrow(expectedErrorMsg);

    expect(domainContextCompatibilityChecker.check).toHaveBeenCalledWith(
      actionDef,
      context
    );
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
  });
});
