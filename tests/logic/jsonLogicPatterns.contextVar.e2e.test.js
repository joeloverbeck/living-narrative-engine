// src/tests/logic/jsonLogicPatterns.contextVar.e2e.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed
import {createJsonLogicContext} from '../../src/logic/contextAssembler.js'; // Adjust path
import Entity from '../../src/entities/entity.js'; // Adjust path - Needed for mock setup (though less critical here)

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Import type for mocking
/** @typedef {object} JSONLogicRule */

// --- Mock Dependencies ---

// Mock ILogger (Required by Service and Context Assembler)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager (Required by Context Assembler, but interactions are minimal for these tests)
// Needs basic methods to allow createJsonLogicContext to run without error, even if actor/target aren't used.
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // --- Core methods used by createComponentAccessor & createJsonLogicContext ---
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(), // Used by the 'has' trap in createComponentAccessor

  // --- Dummy implementations for other potential EM methods ---
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Helper to create mock entity instance (mainly for satisfying EM mock types if needed)
const createMockEntity = (id) => new Entity(id);

// --- Test Suite ---

describe('TEST-107: JSON Logic Context Variable Patterns (8-9)', () => {
  let service;
  // No actor/target needed for these specific tests, focusing on context vars
  const actorId = null; // 'testActor:ctxVar';
  const targetId = null; // 'testTarget:ctxVar';

  /** @type {GameEvent} */
  const baseEvent = {type: 'CONTEXT_VAR_TEST', payload: {}};

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Instantiate the service with the mock logger
    // Uses the REAL json-logic-js library and REAL createJsonLogicContext
    service = new JsonLogicEvaluationService({logger: mockLogger});
    mockLogger.info.mockClear(); // Clear constructor log call

    // Reset EntityManager mocks (basic setup for context creation)
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Default mock implementations (Entities don't need to be found for these tests)
    mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
    mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => undefined);
    mockEntityManager.hasComponent.mockImplementation((entityId, componentTypeId) => false);
  });

  // --- AC1: Pattern 8 (Existence Check - != null) ---
  describe('AC1: Pattern 8 - Existence Check {"!=": [{"var": "context.findTargetHealth"}, null]}', () => {
    const rule = {'!=': [{'var': 'context.findTargetHealth'}, null]};

    test('should return true when context.findTargetHealth is set to an object', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      // Manually add the variable AFTER context assembly
      evaluationContext.context.findTargetHealth = {someData: 'value'};

      const result = service.evaluate(rule, evaluationContext);
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return true when context.findTargetHealth is set to a non-null primitive (e.g., 1)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = 1;

      const result = service.evaluate(rule, evaluationContext);
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return true when context.findTargetHealth is set to false (which is not null)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = false;

      const result = service.evaluate(rule, evaluationContext);
      expect(result).toBe(true); // false != null
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return false when context.findTargetHealth is explicitly set to null', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = null;

      const result = service.evaluate(rule, evaluationContext);
      expect(result).toBe(false); // null != null is false
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return false when context.findTargetHealth is not set (undefined resolves to null)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      // context.findTargetHealth is NOT set

      const result = service.evaluate(rule, evaluationContext);
      // 'var' resolves missing path to null. null != null is false.
      expect(result).toBe(false);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  // --- AC2: Pattern 8 (Existence Check - Truthy !!) ---
  describe('AC2: Pattern 8 - Existence Check (Truthy) {"!!": {"var": "context.findTargetHealth"}}', () => {
    const rule = {'!!': {'var': 'context.findTargetHealth'}};

    test('should return true when set to a truthy object {}', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = {};
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return true when set to a truthy number 1', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = 1;
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return true when set to boolean true', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = true;
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return true when set to a non-empty string "hello"', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = 'hello';
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return false when set to falsy null', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = null;
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    test('should return false when set to falsy boolean false', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = false;
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    test('should return false when set to falsy number 0', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = 0;
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    test('should return false when set to falsy empty string ""', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.findTargetHealth = '';
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    test('should return false when not set (undefined resolves to null, !!null is false)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      // context.findTargetHealth is NOT set
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });
  });

  // --- AC3: Pattern 9 (Value Check - <= 0) ---
  describe('AC3: Pattern 9 - Value Check {"<=": [{"var": "context.targetHealthComponent.current"}, 0]}', () => {
    const rule = {'<=': [{'var': 'context.targetHealthComponent.current'}, 0]};

    test('should return true when current <= 0 (e.g., -10)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.targetHealthComponent = {current: -10, max: 100};
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return true when current <= 0 (e.g., 0)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.targetHealthComponent = {current: 0, max: 100};
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return false when current > 0 (e.g., 50)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.targetHealthComponent = {current: 50, max: 100};
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    // --- CORRECTED TEST based on json-logic-js behavior ---
    test('should return true when property "current" is missing (null <= 0 is true)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.targetHealthComponent = {max: 100}; // Missing 'current'
      // json-logic-js treats null as 0 in comparison: 0 <= 0 -> true
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    // --- CORRECTED TEST based on json-logic-js behavior ---
    test('should return true when context variable "targetHealthComponent" is missing (null <= 0 is true)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      // context.targetHealthComponent is NOT set, path resolves to null
      // json-logic-js treats null as 0 in comparison: 0 <= 0 -> true
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    // --- CORRECTED TEST based on json-logic-js behavior ---
    test('should return true when context variable "targetHealthComponent" is null (null <= 0 is true)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.targetHealthComponent = null;
      // Path resolves to null
      // json-logic-js treats null as 0 in comparison: 0 <= 0 -> true
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });
  });

  // --- AC4: Pattern 9 (Value Check - >= 1) ---
  describe('AC4: Pattern 9 - Value Check {">=": [{"var": "context.actorInventory.items.key_count"}, 1]}', () => {
    const rule = {'>=': [{'var': 'context.actorInventory.items.key_count'}, 1]};

    test('should return true when key_count >= 1 (e.g., 5)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = {items: {key_count: 5, gold: 10}};
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return true when key_count >= 1 (e.g., 1)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = {items: {key_count: 1, gold: 10}};
      expect(service.evaluate(rule, evaluationContext)).toBe(true);
    });

    test('should return false when key_count < 1 (e.g., 0)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = {items: {key_count: 0, gold: 10}};
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    // --- Test reflects actual behavior (null >= 1 is false) ---
    test('should return false when property "key_count" is missing (null >= 1 is false)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = {items: {gold: 10}}; // Missing 'key_count' -> null
      // json-logic-js: 0 >= 1 -> false. This aligns with AC expectation.
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    // --- Test reflects actual behavior (null >= 1 is false) ---
    test('should return false when intermediate property "items" is missing (null >= 1 is false)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = {gold: 10}; // Missing 'items' -> null path
      // json-logic-js: 0 >= 1 -> false. This aligns with AC expectation.
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    // --- Test reflects actual behavior (null >= 1 is false) ---
    test('should return false when intermediate property "items" is null (null >= 1 is false)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = {items: null}; // items is null -> null path
      // json-logic-js: 0 >= 1 -> false. This aligns with AC expectation.
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    // --- Test reflects actual behavior (null >= 1 is false) ---
    test('should return false when context variable "actorInventory" is missing (null >= 1 is false)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      // context.actorInventory is NOT set -> null path
      // json-logic-js: 0 >= 1 -> false. This aligns with AC expectation.
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });

    // --- Test reflects actual behavior (null >= 1 is false) ---
    test('should return false when context variable "actorInventory" is null (null >= 1 is false)', () => {
      const evaluationContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);
      evaluationContext.context.actorInventory = null; // actorInventory is null -> null path
      // json-logic-js: 0 >= 1 -> false. This aligns with AC expectation.
      expect(service.evaluate(rule, evaluationContext)).toBe(false);
    });
  });

}); // End describe TEST-107