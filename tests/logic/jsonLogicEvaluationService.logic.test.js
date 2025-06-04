// src/tests/logic/jsonLogicEvaluationService.logic.test.js

/**
 * @jest-environment node
 * @fileoverview This file contains unit tests for the JsonLogicEvaluationService.
 * It focuses on testing the service's core functionalities in isolation,
 * such as rule evaluation logic (comparison, logical, truthiness operators),
 * dependency usage (ILogger), and error handling.
 * It uses mocked dependencies (ILogger, EntityManager) to achieve this isolation.
 * This is distinct from E2E tests which test the service in conjunction with
 * context assembly and specific rule patterns.
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
/** @typedef {object} JSONLogicRule */
 * @property

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
// Kept for potential future tests in this file, but not strictly needed by comparison/logical op tests.
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
      context: {
        // Variables accessed via "context.variableName"
        truthyVar: true,
        falsyVar: false,
        numVar: 1,
        zeroVar: 0,
        strVar: 'hello',
        emptyStrVar: '',
        arrayVar: [1, 2],
        emptyArrayVar: [], // Empty array IS truthy in raw JS
        objVar: { a: 1 },
        emptyObjVar: {},
      },
      // globals: {}, // If used later
      // entities: {}, // If used later
    };
  });

  // --- [PARENT_ID].3: Logical and Truthiness Operator Tests ---
  describe('Logical (and, or, !) & Truthiness (!!) Operators', () => {
    // Operator: and
    describe('Operator: and', () => {
      // ... other 'and' tests ...

      it('should handle truthy/falsy variables', () => {
        // Corrected var paths to use "context." prefix
        const rule1 = {
          and: [{ var: 'context.truthyVar' }, { var: 'context.numVar' }],
        }; // true AND 1 -> 1 -> !!1 -> true
        const rule2 = {
          and: [{ var: 'context.truthyVar' }, { var: 'context.falsyVar' }],
        }; // true AND false -> false -> !!false -> false
        const rule3 = {
          and: [{ var: 'context.truthyVar' }, { var: 'context.zeroVar' }],
        }; // true AND 0 -> 0 -> !!0 -> false
        const rule4 = {
          and: [{ var: 'context.truthyVar' }, { var: 'context.emptyStrVar' }],
        }; // true AND "" -> "" -> !!"" -> false
        // Note: Empty array [] is TRUTHY in JavaScript. 'and' returns last value []. !![] is true.
        const rule5 = {
          and: [{ var: 'context.truthyVar' }, { var: 'context.emptyArrayVar' }],
        }; // true AND [] -> [] -> !![] -> true

        expect(service.evaluate(rule1, mockContext)).toBe(true);
        expect(service.evaluate(rule2, mockContext)).toBe(false);
        expect(service.evaluate(rule3, mockContext)).toBe(false);
        expect(service.evaluate(rule4, mockContext)).toBe(false);
        // FIX: Corrected expectation from false to true based on JS truthiness of []
        expect(service.evaluate(rule5, mockContext)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // ... other operator tests ...

    // Operator: ! (Not)
    describe('Operator: ! (Not)', () => {
      // ... ! tests ...

      it('should evaluate !falsy values -> true', () => {
        expect(service.evaluate({ '!': [0] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!': [''] }, mockContext)).toBe(true);
        expect(service.evaluate({ '!': [null] }, mockContext)).toBe(true);
        // Note: json-logic-js specifically treats [] as falsy for its operations like '!'
        // even though raw JS [] is truthy. This aligns with the http://jsonlogic.com/truthy.html examples.
        expect(service.evaluate({ '!': [[]] }, mockContext)).toBe(true); // ! applied to raw []
        // Corrected var paths to use "context." prefix
        expect(
          service.evaluate({ '!': { var: 'context.falsyVar' } }, mockContext)
        ).toBe(true); // !false -> true
        expect(
          service.evaluate({ '!': { var: 'context.zeroVar' } }, mockContext)
        ).toBe(true); // !0 -> true
        expect(
          service.evaluate({ '!': { var: 'context.emptyStrVar' } }, mockContext)
        ).toBe(true); // !"" -> true
        // This tests ! applied to the result of var lookup, which is []
        expect(
          service.evaluate(
            { '!': { var: 'context.emptyArrayVar' } },
            mockContext
          )
        ).toBe(true); // ![] -> true (JSONLogic specific)
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      // ... other ! tests ...
    });

    // Operator: !! (Truthy Check / Boolean Cast)
    describe('Operator: !! (Truthy Check)', () => {
      // ... !! tests ...

      it('should evaluate !!falsy values -> false', () => {
        expect(service.evaluate({ '!!': [0] }, mockContext)).toBe(false);
        expect(service.evaluate({ '!!': [''] }, mockContext)).toBe(false);
        expect(service.evaluate({ '!!': [null] }, mockContext)).toBe(false);
        // Note: json-logic-js specifically treats [] as falsy for its operations like '!!'
        expect(service.evaluate({ '!!': [[]] }, mockContext)).toBe(false); // !! applied to raw []
        expect(service.evaluate({ '!!': [false] }, mockContext)).toBe(false);
        // Corrected var paths to use "context." prefix
        expect(
          service.evaluate({ '!!': { var: 'context.falsyVar' } }, mockContext)
        ).toBe(false); // !!false -> false
        expect(
          service.evaluate({ '!!': { var: 'context.zeroVar' } }, mockContext)
        ).toBe(false); // !!0 -> false
        expect(
          service.evaluate(
            { '!!': { var: 'context.emptyStrVar' } },
            mockContext
          )
        ).toBe(false); // !!"" -> false
        // This tests !! applied to the result of var lookup, which is []
        expect(
          service.evaluate(
            { '!!': { var: 'context.emptyArrayVar' } },
            mockContext
          )
        ).toBe(false); // !![] -> false (JSONLogic specific)
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      // ... other !! tests ...
    });
  }); // End describe Logical and Truthiness Operators

  // --- Future Tests Will Go Here ---
  // describe('evaluate method', () => { ... });
  // describe('addOperation method', () => { ... });
}); // End describe JsonLogicEvaluationService Unit Tests
