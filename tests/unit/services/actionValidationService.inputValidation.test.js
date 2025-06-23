// src/tests/services/actionValidationService.inputValidation.test.js

/**
 * @jest-environment node
 */
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
// --- Import Checkers ---
import { DomainContextCompatibilityChecker } from '../../../src/validation/domainContextCompatibilityChecker.js';
import { createMockPrerequisiteEvaluationService } from '../testUtils.js';
// --- Type Imports for Mocks (Optional but good practice) ---
/** @typedef {import('../../../src/actions/validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */

// --- Mock Logger ---
const mockLogger = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// --- Mock Component Classes ---
// (Keep existing mock component classes: MockComponentA, B, C, Required, Forbidden, etc.)
class MockComponentA {}

class MockComponentB {}

class MockComponentC {}

class MockComponentRequired {}

class MockComponentForbidden {}

class MockTargetComponentRequired {}

class MockTargetComponentForbidden {}

class MockComponentX {}

// --- Mock EntityManager ---
// (Keep existing mock EntityManager setup)
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
// (Keep existing createMockEntity factory)
const createMockEntity = (id, components = [], componentDataOverrides = {}) => {
  const classToIdMap = new Map();
  for (const [
    compId,
    compClass,
  ] of mockEntityManager.componentRegistry.entries()) {
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
    getComponent: jest.fn((componentId) =>
      internalComponentDataMap.get(componentId)
    ),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
    components: internalComponentDataMap,
  };
  mockEntityManager.addMockEntityForLookup(entity);
  return entity;
};

// --- Mock PrerequisiteEvaluationService (NEW - Replaces JLES mock here) ---
// This service is now the direct dependency for prerequisite evaluation
/** @type {jest.Mocked<PrerequisiteEvaluationService>} */
const mockPrerequisiteEvaluationService =
  createMockPrerequisiteEvaluationService();

// --- Global Setup ---
beforeAll(() => {
  // (Keep existing component registrations)
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
  mockEntityManager.registerComponent('Health', {});
});

afterAll(() => {
  mockEntityManager.clearRegistry();
});

describe('ActionValidationService - Input Validation and Errors', () => {
  let service; // Type: ActionValidationService
  let mockActor; // Type: Mock Entity
  let domainContextCompatibilityChecker; // Type: DomainContextCompatibilityChecker

  beforeEach(() => {
    // Reset mocks and state before each test
    jest.clearAllMocks();
    mockEntityManager.activeEntities.clear();
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      mockEntityManager.activeEntities.get(id)
    );
    // ** Clear the NEW PrerequisiteEvaluationService mock history **
    mockPrerequisiteEvaluationService.evaluate.mockClear();

    // --- Instantiate Dependencies NEEDED by ActionValidationService ---
    domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({
      logger: mockLogger,
    });

    // --- CORRECTED ActionValidationService Instantiation ---
    // Reflects the constructor change: uses PrerequisiteEvaluationService
    service = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker: domainContextCompatibilityChecker,
      // ** Pass the PrerequisiteEvaluationService mock **
      prerequisiteEvaluationService: mockPrerequisiteEvaluationService,
    });
    // ------------------------------------------------------

    // Create a default actor for use in tests
    mockActor = createMockEntity('actor-default');

    // --- Default Mock Behaviors ---
    // Default prerequisite evaluation to pass if needed by other tests (not crucial for these input tests)
    mockPrerequisiteEvaluationService.evaluate.mockReturnValue(true);
  });

  test('isValid throws Error if missing or invalid actionDefinition', () => {
    const context = ActionTargetContext.noTarget();
    // Error message comes from _checkStructuralSanity
    const expectedErrorMsg =
      'ActionValidationService.isValid: invalid actionDefinition';

    // Test cases for invalid actionDefinition
    expect(() => service.isValid(null, mockActor, context)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid(undefined, mockActor, context)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid({}, mockActor, context)).toThrow(
      expectedErrorMsg
    ); // Missing id
    expect(() => service.isValid({ id: null }, mockActor, context)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid({ id: '' }, mockActor, context)).toThrow(
      expectedErrorMsg
    ); // Empty id
    expect(() => service.isValid({ id: '   ' }, mockActor, context)).toThrow(
      expectedErrorMsg
    ); // Whitespace id
    // Test non-string id causing .trim() error
    expect(() => service.isValid({ id: 123 }, mockActor, context)).toThrow(
      'actionDefinition?.id?.trim is not a function'
    );

    // Verify downstream logic (context creation, prerequisite evaluation) was NOT reached
    // ** Check the CORRECT service mock **
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    // Optional: Verify logger was called (kept commented as 'toThrow' is the main check)
    // expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg), expect.any(Object));
  });

  test('isValid throws Error if missing or invalid actorEntity', () => {
    // A minimal valid action definition for this test
    const actionDef = {
      id: 'test:action-basic',
      target_domain: 'none',
      template: 't',
    };
    const context = ActionTargetContext.noTarget();
    // Error message comes from _checkStructuralSanity
    const expectedErrorMsg =
      'ActionValidationService.isValid: invalid actor entity';

    // Test cases for invalid actorEntity
    expect(() => service.isValid(actionDef, null, context)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid(actionDef, undefined, context)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid(actionDef, {}, context)).toThrow(
      expectedErrorMsg
    ); // Missing id
    expect(() => service.isValid(actionDef, { id: null }, context)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid(actionDef, { id: '' }, context)).toThrow(
      expectedErrorMsg
    ); // Empty id
    expect(() => service.isValid(actionDef, { id: '  ' }, context)).toThrow(
      expectedErrorMsg
    ); // Whitespace id
    // Test non-string id causing .trim() error
    expect(() => service.isValid(actionDef, { id: 456 }, context)).toThrow(
      'actorEntity?.id?.trim is not a function'
    );
    // Test non-object
    expect(() => service.isValid(actionDef, 'not an object', context)).toThrow(
      expectedErrorMsg
    );

    // Verify downstream logic (context creation, prerequisite evaluation) was NOT reached
    // ** Check the CORRECT service mock **
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    // Optional: Check logger call
    // expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg), expect.any(Object));
  });

  test('isValid throws Error if missing or invalid targetContext', () => {
    // A minimal valid action definition for this test
    const actionDef = {
      id: 'test:action-basic',
      target_domain: 'none',
      template: 't',
    };
    // Error message comes from _checkStructuralSanity
    const expectedErrorMsg =
      'ActionValidationService.isValid: invalid ActionTargetContext';

    // Test cases for invalid targetContext
    expect(() => service.isValid(actionDef, mockActor, null)).toThrow(
      expectedErrorMsg
    );
    expect(() => service.isValid(actionDef, mockActor, undefined)).toThrow(
      expectedErrorMsg
    );

    // Check invalid targetContext structure (plain object, not an instance of ActionTargetContext)
    const invalidContextObject = { type: 'entity', entityId: 'some-id' };
    expect(() =>
      service.isValid(actionDef, mockActor, invalidContextObject)
    ).toThrow(expectedErrorMsg);

    // Check other non-instance values
    expect(() =>
      service.isValid(actionDef, mockActor, 'not a context')
    ).toThrow(expectedErrorMsg);
    expect(() => service.isValid(actionDef, mockActor, 123)).toThrow(
      expectedErrorMsg
    );

    // Verify downstream logic (context creation, prerequisite evaluation) was NOT reached
    // ** Check the CORRECT service mock **
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    // Optional: Check logger call
    // expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMsg), expect.any(Object));
  });
}); // End describe block
