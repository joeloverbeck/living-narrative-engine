// src/tests/logic/jsonLogicEvaluationService.unit.test.js

/**
 * @jest-environment node
 * @file This file contains unit tests for the JsonLogicEvaluationService.
 * It focuses on testing the service's core functionalities in isolation,
 * such as rule evaluation logic, dependency usage (ILogger), and error handling.
 * It uses mocked dependencies (ILogger, EntityManager) to achieve this isolation.
 * This is distinct from E2E tests (like jsonLogicPatterns.entityState.e2e.test.js)
 * which test the service in conjunction with context assembly and specific rule patterns.
 */

import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
  it,
} from '@jest/globals'; // Added 'it' alias for 'test'

// --- Class Under Test ---
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- Dependencies for Mocking & Context (even if context is simplified later) ---
// import {createJsonLogicContext} from '../../logic/contextAssembler.js'; // Adjust path as needed - Not strictly needed for these tests
// import Entity from '../../entities/entity.js'; // Adjust path as needed - Not needed for these tests

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjust path as needed
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */ // Adjust path as needed

// --- Mock Dependencies ---

// Mock ILogger (Required by Service)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager (Required by createJsonLogicContext if used, but not directly by these tests)
// Kept for potential future tests in this file, but not strictly needed by comparison op tests.
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // --- Core methods used by Context Assembler / Component Accessor ---
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),

  // --- Other common EntityManager methods (mocked as jest.fn() for completeness if needed later) ---
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(), // Provide a default empty map if accessed
};

// --- Test Suite ---

describe('JsonLogicEvaluationService Unit Tests', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;
  /** @type {JsonLogicEvaluationContext} */
  let mockContext; // Define a basic context for use in tests

  // --- Test Setup & Teardown ---
  beforeEach(() => {
    // Task: Clear all mocks before each test
    jest.clearAllMocks();

    // Task: Instantiate JsonLogicEvaluationService using the mockLogger
    service = new JsonLogicEvaluationService({ logger: mockLogger });

    // Task: Reset mockEntityManager methods (even if not used directly in *all* tests)
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();
    mockEntityManager.createEntityInstance.mockReset();
    mockEntityManager.addComponent.mockReset();
    // ... reset other EM mocks if necessary ...

    // Set default mock implementations after resetting
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => undefined
    );
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );

    // Create a simple default context for tests that don't need complex setup
    mockContext = {
      event: { type: 'TEST_EVENT', payload: {} },
      actor: null,
      target: null,
      context: {}, // For variables like from QUERY_COMPONENT
      // globals: {}, // If used later
      // entities: {}, // If used later
    };
  });

  // --- Placeholder Test ---
  test('should initialize correctly via beforeEach', () => {
    expect(service).toBeInstanceOf(JsonLogicEvaluationService);
    // Optional: Check if logger was called during construction if expected
    // expect(mockLogger.info).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance('anyId')).toBeUndefined();
  });

  // --- [PARENT_ID].2: Comparison Operator Tests ---
  describe('Comparison Operators (==, !=, <, >, <=, >=)', () => {
    // Operator: == (Loose Equality, json-logic style)
    describe('Operator: ==', () => {
      it('should compare numbers correctly', () => {
        expect(service.evaluate({ '==': [5, 5] }, mockContext)).toBe(true);
        expect(service.evaluate({ '==': [5, 6] }, mockContext)).toBe(false);
        expect(service.evaluate({ '==': [0, 0] }, mockContext)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare strings correctly', () => {
        expect(service.evaluate({ '==': ['a', 'a'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '==': ['a', 'b'] }, mockContext)).toBe(false);
        expect(service.evaluate({ '==': ['', ''] }, mockContext)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare booleans correctly', () => {
        expect(service.evaluate({ '==': [true, true] }, mockContext)).toBe(
          true
        );
        expect(service.evaluate({ '==': [false, false] }, mockContext)).toBe(
          true
        );
        expect(service.evaluate({ '==': [true, false] }, mockContext)).toBe(
          false
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare with null (only null == null)', () => {
        expect(service.evaluate({ '==': [null, null] }, mockContext)).toBe(
          true
        );
        expect(service.evaluate({ '==': [0, null] }, mockContext)).toBe(false);
        expect(service.evaluate({ '==': ['', null] }, mockContext)).toBe(false);
        expect(service.evaluate({ '==': [false, null] }, mockContext)).toBe(
          false
        ); // json-logic specific
        expect(service.evaluate({ '==': [true, null] }, mockContext)).toBe(
          false
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle type coercion like json-logic-js (loose equality)', () => {
        expect(service.evaluate({ '==': [0, '0'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '==': [1, '1'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '==': [1, true] }, mockContext)).toBe(true);
        expect(service.evaluate({ '==': [0, false] }, mockContext)).toBe(true);
        expect(service.evaluate({ '==': ['0', false] }, mockContext)).toBe(
          true
        );
        expect(service.evaluate({ '==': ['1', true] }, mockContext)).toBe(true);
        // Cases that are false with json-logic's null handling
        expect(service.evaluate({ '==': [null, false] }, mockContext)).toBe(
          false
        );
        expect(service.evaluate({ '==': [null, 0] }, mockContext)).toBe(false);
        expect(service.evaluate({ '==': [null, ''] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare missing variable (null) correctly', () => {
        const rule1 = { '==': [{ var: 'missingValue' }, null] }; // missing -> null == null
        const rule2 = { '==': [{ var: 'missingValue' }, 0] }; // missing -> null == 0
        const rule3 = { '==': [{ var: 'missingValue' }, false] }; // missing -> null == false
        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // Operator: != (Loose Inequality, json-logic style)
    describe('Operator: !=', () => {
      it('should compare numbers correctly', () => {
        expect(service.evaluate({ '!=': [5, 6] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [5, 5] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare strings correctly', () => {
        expect(service.evaluate({ '!=': ['a', 'b'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': ['a', 'a'] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare booleans correctly', () => {
        expect(service.evaluate({ '!=': [true, false] }, mockContext)).toBe(
          true
        );
        expect(service.evaluate({ '!=': [true, true] }, mockContext)).toBe(
          false
        );
        expect(service.evaluate({ '!=': [false, false] }, mockContext)).toBe(
          false
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare with null (anything non-null != null)', () => {
        expect(service.evaluate({ '!=': [0, null] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': ['', null] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [false, null] }, mockContext)).toBe(
          true
        ); // json-logic specific
        expect(service.evaluate({ '!=': ['a', null] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [null, null] }, mockContext)).toBe(
          false
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle type coercion like json-logic-js (loose inequality)', () => {
        expect(service.evaluate({ '!=': [0, '1'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [1, false] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [0, true] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [null, 0] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!=': [null, false] }, mockContext)).toBe(
          true
        );
        // Cases that are false
        expect(service.evaluate({ '!=': [0, '0'] }, mockContext)).toBe(false);
        expect(service.evaluate({ '!=': [1, true] }, mockContext)).toBe(false);
        expect(service.evaluate({ '!=': [0, false] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare missing variable (null) correctly', () => {
        const rule1 = { '!=': [{ var: 'missingValue' }, 0] }; // missing -> null != 0
        const rule2 = { '!=': [{ var: 'missingValue' }, null] }; // missing -> null != null
        const rule3 = { '!=': [{ var: 'missingValue' }, false] }; // missing -> null != false
        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // Operator: < (Less Than)
    describe('Operator: <', () => {
      it('should compare numbers correctly', () => {
        expect(service.evaluate({ '<': [5, 6] }, mockContext)).toBe(true);
        expect(service.evaluate({ '<': [6, 5] }, mockContext)).toBe(false);
        expect(service.evaluate({ '<': [5, 5] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare strings lexicographically', () => {
        expect(service.evaluate({ '<': ['a', 'b'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '<': ['b', 'a'] }, mockContext)).toBe(false);
        expect(service.evaluate({ '<': ['a', 'a'] }, mockContext)).toBe(false);
        // String vs Number (string comparison takes precedence if first is string)
        expect(service.evaluate({ '<': ['10', '2'] }, mockContext)).toBe(true); // "1" < "2"
        expect(service.evaluate({ '<': ['2', '10'] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle type coercion (numeric comparison)', () => {
        expect(service.evaluate({ '<': [0, 1] }, mockContext)).toBe(true);
        // Number vs String (coerces string to number)
        expect(service.evaluate({ '<': [1, '10'] }, mockContext)).toBe(true); // 1 < 10
        expect(service.evaluate({ '<': [2, '1'] }, mockContext)).toBe(false); // 2 < 1
        expect(service.evaluate({ '<': [0, 'a'] }, mockContext)).toBe(false); // 0 < NaN is false
        // Boolean coercion (true=1, false=0)
        expect(service.evaluate({ '<': [false, true] }, mockContext)).toBe(
          true
        ); // 0 < 1
        expect(service.evaluate({ '<': [true, false] }, mockContext)).toBe(
          false
        ); // 1 < 0
        expect(service.evaluate({ '<': [0, true] }, mockContext)).toBe(true); // 0 < 1
        expect(service.evaluate({ '<': [false, 1] }, mockContext)).toBe(true); // 0 < 1
        // Null coercion (null=0)
        expect(service.evaluate({ '<': [null, 1] }, mockContext)).toBe(true); // 0 < 1
        expect(service.evaluate({ '<': [null, 0] }, mockContext)).toBe(false); // 0 < 0
        expect(service.evaluate({ '<': [-1, null] }, mockContext)).toBe(true); // -1 < 0
        expect(service.evaluate({ '<': [null, null] }, mockContext)).toBe(
          false
        ); // 0 < 0
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare missing variable (null) correctly', () => {
        const rule1 = { '<': [{ var: 'missingValue' }, 1] }; // missing -> null < 1 (0 < 1)
        const rule2 = { '<': [{ var: 'missingValue' }, 0] }; // missing -> null < 0 (0 < 0)
        const rule3 = { '<': [{ var: 'missingValue' }, -1] }; // missing -> null < -1 (0 < -1)
        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // Operator: > (Greater Than)
    describe('Operator: >', () => {
      it('should compare numbers correctly', () => {
        expect(service.evaluate({ '>': [6, 5] }, mockContext)).toBe(true);
        expect(service.evaluate({ '>': [5, 6] }, mockContext)).toBe(false);
        expect(service.evaluate({ '>': [5, 5] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare strings lexicographically', () => {
        expect(service.evaluate({ '>': ['b', 'a'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '>': ['a', 'b'] }, mockContext)).toBe(false);
        expect(service.evaluate({ '>': ['a', 'a'] }, mockContext)).toBe(false);
        // String vs Number (string comparison takes precedence if first is string)
        expect(service.evaluate({ '>': ['10', '2'] }, mockContext)).toBe(false); // "1" > "2" is false
        expect(service.evaluate({ '>': ['2', '10'] }, mockContext)).toBe(true); // "2" > "1" is true
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle type coercion (numeric comparison)', () => {
        expect(service.evaluate({ '>': [1, 0] }, mockContext)).toBe(true);
        // Number vs String (coerces string to number)
        expect(service.evaluate({ '>': [10, '2'] }, mockContext)).toBe(true); // 10 > 2
        expect(service.evaluate({ '>': [1, '2'] }, mockContext)).toBe(false); // 1 > 2
        expect(service.evaluate({ '>': [0, 'a'] }, mockContext)).toBe(false); // 0 > NaN is false
        // Boolean coercion (true=1, false=0)
        expect(service.evaluate({ '>': [true, false] }, mockContext)).toBe(
          true
        ); // 1 > 0
        expect(service.evaluate({ '>': [false, true] }, mockContext)).toBe(
          false
        ); // 0 > 1
        expect(service.evaluate({ '>': [1, false] }, mockContext)).toBe(true); // 1 > 0
        expect(service.evaluate({ '>': [true, 0] }, mockContext)).toBe(true); // 1 > 0
        // Null coercion (null=0)
        expect(service.evaluate({ '>': [1, null] }, mockContext)).toBe(true); // 1 > 0
        expect(service.evaluate({ '>': [0, null] }, mockContext)).toBe(false); // 0 > 0
        expect(service.evaluate({ '>': [null, -1] }, mockContext)).toBe(true); // 0 > -1
        expect(service.evaluate({ '>': [null, null] }, mockContext)).toBe(
          false
        ); // 0 > 0
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare missing variable (null) correctly', () => {
        const rule1 = { '>': [{ var: 'missingValue' }, -1] }; // missing -> null > -1 (0 > -1)
        const rule2 = { '>': [{ var: 'missingValue' }, 0] }; // missing -> null > 0 (0 > 0)
        const rule3 = { '>': [{ var: 'missingValue' }, 1] }; // missing -> null > 1 (0 > 1)
        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // Operator: <= (Less Than or Equal)
    describe('Operator: <=', () => {
      it('should compare numbers correctly', () => {
        expect(service.evaluate({ '<=': [5, 6] }, mockContext)).toBe(true);
        expect(service.evaluate({ '<=': [5, 5] }, mockContext)).toBe(true);
        expect(service.evaluate({ '<=': [6, 5] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare strings lexicographically', () => {
        expect(service.evaluate({ '<=': ['a', 'b'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '<=': ['a', 'a'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '<=': ['b', 'a'] }, mockContext)).toBe(false);
        expect(service.evaluate({ '<=': ['10', '2'] }, mockContext)).toBe(true); // "1" <= "2"
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle type coercion (numeric comparison)', () => {
        // Number vs String (coerces string to number)
        expect(service.evaluate({ '<=': [1, '10'] }, mockContext)).toBe(true); // 1 <= 10
        expect(service.evaluate({ '<=': [10, '10'] }, mockContext)).toBe(true); // 10 <= 10
        expect(service.evaluate({ '<=': [2, '1'] }, mockContext)).toBe(false); // 2 <= 1
        // Boolean coercion (true=1, false=0)
        expect(service.evaluate({ '<=': [false, true] }, mockContext)).toBe(
          true
        ); // 0 <= 1
        expect(service.evaluate({ '<=': [true, true] }, mockContext)).toBe(
          true
        ); // 1 <= 1
        expect(service.evaluate({ '<=': [false, false] }, mockContext)).toBe(
          true
        ); // 0 <= 0
        expect(service.evaluate({ '<=': [true, false] }, mockContext)).toBe(
          false
        ); // 1 <= 0
        // Null coercion (null=0)
        expect(service.evaluate({ '<=': [null, 1] }, mockContext)).toBe(true); // 0 <= 1
        expect(service.evaluate({ '<=': [null, 0] }, mockContext)).toBe(true); // 0 <= 0
        expect(service.evaluate({ '<=': [-1, null] }, mockContext)).toBe(true); // -1 <= 0
        expect(service.evaluate({ '<=': [null, null] }, mockContext)).toBe(
          true
        ); // 0 <= 0
        expect(service.evaluate({ '<=': [1, null] }, mockContext)).toBe(false); // 1 <= 0
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare missing variable (null) correctly', () => {
        const rule1 = { '<=': [{ var: 'missingValue' }, 0] }; // missing -> null <= 0 (0 <= 0)
        const rule2 = { '<=': [{ var: 'missingValue' }, -1] }; // missing -> null <= -1 (0 <= -1)
        const rule3 = { '<=': [{ var: 'missingValue' }, 1] }; // missing -> null <= 1 (0 <= 1)
        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // Operator: >= (Greater Than or Equal)
    describe('Operator: >=', () => {
      it('should compare numbers correctly', () => {
        expect(service.evaluate({ '>=': [6, 5] }, mockContext)).toBe(true);
        expect(service.evaluate({ '>=': [5, 5] }, mockContext)).toBe(true);
        expect(service.evaluate({ '>=': [5, 6] }, mockContext)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare strings lexicographically', () => {
        expect(service.evaluate({ '>=': ['b', 'a'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '>=': ['a', 'a'] }, mockContext)).toBe(true);
        expect(service.evaluate({ '>=': ['a', 'b'] }, mockContext)).toBe(false);
        expect(service.evaluate({ '>=': ['2', '10'] }, mockContext)).toBe(true); // "2" >= "1"
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle type coercion (numeric comparison)', () => {
        // Number vs String (coerces string to number)
        expect(service.evaluate({ '>=': [10, '1'] }, mockContext)).toBe(true); // 10 >= 1
        expect(service.evaluate({ '>=': [10, '10'] }, mockContext)).toBe(true); // 10 >= 10
        expect(service.evaluate({ '>=': [1, '2'] }, mockContext)).toBe(false); // 1 >= 2
        // Boolean coercion (true=1, false=0)
        expect(service.evaluate({ '>=': [true, false] }, mockContext)).toBe(
          true
        ); // 1 >= 0
        expect(service.evaluate({ '>=': [true, true] }, mockContext)).toBe(
          true
        ); // 1 >= 1
        expect(service.evaluate({ '>=': [false, false] }, mockContext)).toBe(
          true
        ); // 0 >= 0
        expect(service.evaluate({ '>=': [false, true] }, mockContext)).toBe(
          false
        ); // 0 >= 1
        // Null coercion (null=0)
        expect(service.evaluate({ '>=': [1, null] }, mockContext)).toBe(true); // 1 >= 0
        expect(service.evaluate({ '>=': [0, null] }, mockContext)).toBe(true); // 0 >= 0
        expect(service.evaluate({ '>=': [null, -1] }, mockContext)).toBe(true); // 0 >= -1
        expect(service.evaluate({ '>=': [null, null] }, mockContext)).toBe(
          true
        ); // 0 >= 0
        expect(service.evaluate({ '>=': [-1, null] }, mockContext)).toBe(false); // -1 >= 0
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should compare missing variable (null) correctly', () => {
        const rule1 = { '>=': [{ var: 'missingValue' }, 0] }; // missing -> null >= 0 (0 >= 0)
        const rule2 = { '>=': [{ var: 'missingValue' }, 1] }; // missing -> null >= 1 (0 >= 1)
        const rule3 = { '>=': [{ var: 'missingValue' }, -1] }; // missing -> null >= -1 (0 >= -1)
        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });
  }); // End describe Comparison Operators

  // --- Future Tests Will Go Here ---
  // describe('evaluate method', () => { ... });
  // describe('addOperation method', () => { ... });
}); // End describe JsonLogicEvaluationService Unit Tests
