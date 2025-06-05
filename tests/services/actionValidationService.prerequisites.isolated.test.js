// src/tests/services/actionValidationService.prerequisites.isolated.test.js
// MODIFIED: Applying changes from Refactor-AVS-3.3.5
// NOTE: This file focuses on testing AVS's interaction with the mocked PrerequisiteEvaluationService (PES),
// verifying the correct delegation signature.

/**
 * @jest-environment node
 */
import { ActionValidationService } from '../../src/actions/validation/actionValidationService.js';
import { ActionTargetContext } from '../../src/models/actionTargetContext.js';
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
// REMOVED: import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // No longer directly used/mocked here
// ADDED: Import the service ActionValidationService now delegates to
import { PrerequisiteEvaluationService } from '../../src/actions/validation/prerequisiteEvaluationService.js';
// REMOVED: import {createActionValidationContext} from '../../logic/createActionValidationContext.js'; // AVS no longer takes this directly
// --- Import the checker ACTUALLY used by ActionValidationService ---
import { DomainContextCompatibilityChecker } from '../../src/validation/domainContextCompatibilityChecker.js';

// Assuming a simple mock logger, replace with your actual logger/mocking library if needed
const mockLogger = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// --- Mock Component Classes ---
// (Component class mocks remain the same)
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
// (EntityManager mock remains the same)
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
// (Entity factory mock remains the same)
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
    // Adding getAllComponentsData mock, assuming it exists on Entity, as PES/AVCB uses it
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
// ADDED: Mock the new dependency
jest.mock('../../src/actions/validation/prerequisiteEvaluationService.js');
// ADDED: Declare variable for the mock instance
let mockPrerequisiteEvaluationServiceInstance;

// REMOVED: Mock JsonLogicEvaluationService object as AVS doesn't directly use it anymore

// --- Global Setup ---
beforeAll(() => {
  // (Component registration remains the same)
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
// UPDATED: Describe block title to reflect testing interaction with PES
describe('ActionValidationService - Prerequisite Delegation Checks (Mocked PES)', () => {
  let service; // ActionValidationService instance under test
  let mockActor;
  let mockTarget;
  let domainContextCompatibilityChecker;
  const ACTOR_ID = 'actor-prereq';
  const TARGET_ID = 'target-prereq';

  beforeEach(() => {
    jest.clearAllMocks(); // Ensure mocks are clean
    mockEntityManager.activeEntities.clear();
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      mockEntityManager.activeEntities.get(id)
    );

    // --- CORRECTED MOCK SETUP FOR PES ---
    // Instantiate the mocked PrerequisiteEvaluationService using the auto-mocked constructor
    mockPrerequisiteEvaluationServiceInstance =
      new PrerequisiteEvaluationService();

    // Ensure the 'evaluate' property exists and is a mock function.
    // (Jest's auto-mock usually ensures this, but being explicit is safe)
    if (
      !mockPrerequisiteEvaluationServiceInstance.evaluate ||
      !jest.isMockFunction(mockPrerequisiteEvaluationServiceInstance.evaluate)
    ) {
      mockPrerequisiteEvaluationServiceInstance.evaluate = jest.fn();
    }

    // *** MANUALLY set the 'length' property to satisfy the constructor's check ***
    Object.defineProperty(
      mockPrerequisiteEvaluationServiceInstance.evaluate,
      'length',
      {
        value: 4, // The expected number of arguments for the real evaluate method
        writable: false, // Keep it non-writable like a real function's length
      }
    );
    // --- END CORRECTION ---

    // Instantiate checker (dependency of AVS)
    domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({
      logger: mockLogger,
    });

    // Instantiate ActionValidationService with the CORRECTLY PREPARED MOCKED PES
    service = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationServiceInstance, // Pass the fixed mock
    });

    // Create mock entities for tests
    mockActor = createMockEntity(
      ACTOR_ID,
      [MockComponentA, MockHealthComponent],
      {
        /* ... data overrides ... */
      }
    );
    mockTarget = createMockEntity(TARGET_ID, [MockComponentX], {
      /* ... data overrides ... */
    });

    // Clear specific mock calls AFTER AVS is instantiated
    // mockClear() only affects call history and return values, not the .length property.
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockClear();
    mockEntityManager.getComponentData.mockClear();
    mockEntityManager.hasComponent.mockClear();
    mockEntityManager.getEntityInstance.mockClear(); // Clearing this might affect Step 2 check in some tests if not re-mocked per test
  });

  // ========================================================================
  // == Test Case for Prerequisite Success (via Mocked PES) ================
  // ========================================================================
  test('Success: Calls PES with correct signature when prerequisites exist and PES mock returns true', () => {
    const ruleLogic = { '==': [1, 1] }; // Example logic inside prereq
    const prerequisitesArray = [{ condition_type: 'test', logic: ruleLogic }];
    const actionDef = {
      id: 'test:pes-delegation-pass',
      prerequisites: prerequisitesArray,
      target_domain: 'entity', // Requires target entity
    };
    const targetContext = ActionTargetContext.forEntity(TARGET_ID);

    // Configure Mock: Make the mocked PES evaluate method return true for this test
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      true
    );

    // Execute the method under test
    const isValid = service.isValid(actionDef, mockActor, targetContext);

    // Verify Outcome: Check if AVS returned the value from the mocked PES
    expect(isValid).toBe(true);

    // Verify Call: Check if PES.evaluate was called
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);

    // Verify Arguments: Check if PES.evaluate was called with the correct arguments (NEW SIGNATURE)
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      prerequisitesArray, // 1. The prerequisite rules array
      actionDef, // 2. The full action definition object
      mockActor, // 3. The actor entity instance
      targetContext // 4. The action target context instance
    );
    // REMOVED: Old assertion checking for (prereqs, contextObject, actionId)
    // expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
    //     prerequisitesArray,
    //     expect.objectContaining({ /* ... old context structure check */ }),
    //     actionDef.id
    // );

    expect(mockLogger.error).not.toHaveBeenCalled(); // Assuming PES handles its own errors now
  });
  // ========================================================================
  // == End Prerequisite Success Test =======================================
  // ========================================================================

  // ========================================================================
  // == Test Case for Prerequisite Failure (via Mocked PES) ================
  // ========================================================================
  test('Failure: Calls PES with correct signature when prerequisites exist and PES mock returns false', () => {
    const ruleLogic = { '==': [1, 0] }; // Example logic inside prereq
    const prerequisitesArray = [{ condition_type: 'test', logic: ruleLogic }];
    const actionDef = {
      id: 'test:pes-delegation-fail',
      prerequisites: prerequisitesArray,
      target_domain: 'entity',
    };
    const targetContext = ActionTargetContext.forEntity(TARGET_ID);

    // Configure Mock: Make the mocked PES evaluate method return false
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      false
    );

    // Execute
    const isValid = service.isValid(actionDef, mockActor, targetContext);

    // Verify Outcome: Should be false as returned by mocked PES
    expect(isValid).toBe(false);

    // Verify Call: PES should still be called
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);

    // Verify Arguments: Check arguments passed to PES (NEW SIGNATURE)
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      prerequisitesArray, // 1. The prerequisite rules array
      actionDef, // 2. The full action definition object
      mockActor, // 3. The actor entity instance
      targetContext // 4. The action target context instance
    );
    // REMOVED: Old assertion checking for (prereqs, contextObject, actionId)
    // expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
    //     prerequisitesArray,
    //     expect.any(Object), // Context should have been built
    //     actionDef.id
    // );

    // Note: We don't check for specific error logs *from AVS* here anymore regarding prerequisite failure,
    // as the failure reason logging is handled *within* PES.
    // We only care that AVS correctly returned the failure status received from PES.
  });
  // ========================================================================
  // == End Prerequisite Failure Test =======================================
  // ========================================================================

  // ========================================================================
  // == Test Case: PES Not Called (No Prerequisites) ========================
  // ========================================================================
  test('Success: Skips calling PES when prerequisites array is empty', () => {
    const actionDef = {
      id: 'test:no-prereqs-skip-pes',
      prerequisites: [], // Empty array
      target_domain: 'none',
    };
    const targetContext = ActionTargetContext.noTarget();

    // Execute
    const isValid = service.isValid(actionDef, mockActor, targetContext);

    // Verify Outcome: Should be true as no prerequisites means they pass
    expect(isValid).toBe(true);

    // Verify Call: PES evaluate should NOT have been called
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('Success: Skips calling PES when prerequisites property is missing', () => {
    const actionDef = {
      id: 'test:missing-prereqs-skip-pes',
      // no prerequisites property
      target_domain: 'none',
    };
    const targetContext = ActionTargetContext.noTarget();

    // Execute
    const isValid = service.isValid(actionDef, mockActor, targetContext);

    // Verify Outcome: Should be true
    expect(isValid).toBe(true);

    // Verify Call: PES evaluate should NOT have been called
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
  // ========================================================================
  // == End PES Not Called Tests ============================================
  // ========================================================================

  // ========================================================================
  // == Test Case: Correct Arguments Passed to PES ==========================
  // ========================================================================
  // REVISED: Title emphasizes checking the arguments passed, not just 'context structure'.
  test('isValid passes correct arguments (prereqs, actionDef, actor, targetCtx) to PES', () => {
    const actorContextId = 'actor-context-test';
    // Using a distinct mock actor for this test to avoid interference
    const mockActorForThisTest = createMockEntity(
      actorContextId,
      [MockComponentSome, MockComponentA],
      { 'core:a': { data: 'actor_a_data' } }
    );
    const targetContextId = 'target-context-test';
    // Create the target entity instance so targetContext can potentially resolve it (though PES mock skips this)
    const mockTargetEntityForThisTest = createMockEntity(
      targetContextId,
      [MockComponentOther],
      { 'core:otherComponent': { data: 'target_other_data' } }
    );

    const ruleLogic = { if: [{ var: 'actor.id' }, true, false] }; // Simple logic example
    const prerequisitesArray = [
      { condition_type: 'context-test-rule', logic: ruleLogic },
    ];
    const actionDef = {
      id: 'test:action-args-check-pes',
      actor_required_components: [], // Assuming other validation steps pass
      target_required_components: [],
      target_domain: 'entity', // Requires target entity
      prerequisites: prerequisitesArray,
      template: 'Args structure check',
    };
    // Use the specific target entity ID
    const targetContext = ActionTargetContext.forEntity(targetContextId);

    // Configure Mock: Assume PES passes for this test
    mockPrerequisiteEvaluationServiceInstance.evaluate.mockReturnValueOnce(
      true
    );

    // Execute
    const isValid = service.isValid(
      actionDef,
      mockActorForThisTest,
      targetContext
    );

    // Verify Outcome
    expect(isValid).toBe(true);

    // Verify Call
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledTimes(1);

    // Verify Arguments: Check PES was called with the exact arguments AVS received/used.
    expect(
      mockPrerequisiteEvaluationServiceInstance.evaluate
    ).toHaveBeenCalledWith(
      prerequisitesArray, // 1. The prerequisites array
      actionDef, // 2. The action definition object itself
      mockActorForThisTest, // 3. The specific actor entity passed to isValid
      targetContext // 4. The specific target context passed to isValid
    );

    // REMOVED: Old assertion checking for (prereqs, contextObject, actionId)
    // expect(mockPrerequisiteEvaluationServiceInstance.evaluate).toHaveBeenCalledWith(
    //     prerequisitesArray,
    //     expect.objectContaining({ // Verify it's an object with at least actor/target/event structure
    //         actor: expect.objectContaining({ id: actorContextId }),
    //         target: expect.objectContaining({ id: targetContextId }),
    //         event: expect.objectContaining({ actionId: actionDef.id }),
    //         // No need to deeply inspect component proxies here - that's context creation's job
    //     }),
    //     actionDef.id
    // );

    // Verify that AVS still tried to look up the target entity (for Step 2 check), even though PES call is mocked
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
      targetContextId
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
  // ========================================================================
  // == End Correct Arguments Test ==========================================
  // ========================================================================

  // REMOVED TEST: 'Failure: Prerequisite definition is missing the "logic" property'
  // Reason: Structural validation of prerequisite objects is now handled *inside* PES. AVS only passes the array.

  // REMOVED TEST: 'Success: Prerequisite uses context data (actor component)'
  // Reason: This relied on JsonLogic evaluation happening within the AVS test. Now, PES is mocked,
  // and we only care that AVS passes the correct *inputs* (actionDef, actor, targetCtx) to PES.
  // The test 'isValid passes correct arguments...' covers verifying these inputs.
}); // End describe block
