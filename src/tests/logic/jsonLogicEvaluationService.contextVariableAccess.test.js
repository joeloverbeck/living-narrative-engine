// src/tests/logic/jsonLogicEvaluationService.contextVariableAccess.test.js

/**
 * @jest-environment node
 *
 * @fileoverview This file contains unit tests for the JsonLogicEvaluationService.
 * It focuses specifically on testing access to custom variables added directly
 * to the `context.context` object using the 'var' operator
 * (e.g., 'context.customVariable').
 * It uses mocked dependencies (ILogger, EntityManager) for isolation and
 * the context setup from Ticket [PARENT_ID].1.
 * Corresponds to Ticket: [PARENT_ID].8
 */

import {describe, expect, test, jest, beforeEach, it} from '@jest/globals';

// --- Class Under Test ---
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- Dependencies for Mocking & Context ---
import {createJsonLogicContext} from '../../logic/contextAssembler.js'; // Adjust path as needed
import Entity from '../../entities/entity.js'; // Adjust path as needed - For mock context setup

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */ // Adjust path as needed
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */ // Adjust path as needed
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjust path as needed
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */ // Adjust path as needed
/** @typedef {object} JSONLogicRule */

// --- Mock Dependencies ---

// Mock ILogger (Required by Service)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager (Required by createJsonLogicContext)
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // Core methods likely used by createJsonLogicContext or its dependencies
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),

  // Other common EntityManager methods (mocked as jest.fn() for completeness)
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Helper (not strictly needed for these tests, but maintains consistency)
const createMockEntity = (id) => new Entity(id);

// Define a base event structure for context creation
/** @type {GameEvent} */
const baseEvent = {type: 'TEST_EVENT', payload: {}};

// Define base actor/target IDs (can be null as they aren't the focus here)
const actorId = 'actor_for_context';
const targetId = 'target_for_context';

// --- Test Suite ---

describe('JsonLogicEvaluationService - Context Variable Access Tests ([PARENT_ID].8)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;

  // --- Test Setup & Teardown ---
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Instantiate JsonLogicEvaluationService using the mockLogger
    service = new JsonLogicEvaluationService({logger: mockLogger});

    // Reset mockEntityManager methods (though not directly used for context.* access, needed for context creation)
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Set default mock implementations: Assume entities are not found by default
    mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
    mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => undefined);
  });

  // --- [PARENT_ID].8: Context Variable Access Tests ---
  describe('Context Variable Access (context.*)', () => {

    describe('Existing Variable Access', () => {
      test('should access existing top-level variable (context.weather)', () => {
        const conditionJson = {'==': [{'var': 'context.weather'}, 'sunny']};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Manually add the variable to the context object
        mockContext.context.weather = 'sunny';

        const result = service.evaluate(conditionJson, mockContext);

        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should access existing nested variable (context.queryResult.value)', () => {
        const conditionJson = {'==': [{'var': 'context.queryResult.value'}, 100]};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Manually add the nested structure to the context object
        mockContext.context.queryResult = {value: 100, status: 'completed'};

        const result = service.evaluate(conditionJson, mockContext);

        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false for incorrect value comparison (context.weather)', () => {
        const conditionJson = {'==': [{'var': 'context.weather'}, 'rainy']};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Manually add the variable with a different value
        mockContext.context.weather = 'sunny';

        const result = service.evaluate(conditionJson, mockContext);

        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false for incorrect nested value comparison (context.queryResult.value)', () => {
        const conditionJson = {'==': [{'var': 'context.queryResult.value'}, 99]};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Manually add the nested structure
        mockContext.context.queryResult = {value: 100, status: 'completed'};

        const result = service.evaluate(conditionJson, mockContext);

        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Existing Variable Access

    describe('Missing Variable Access', () => {
      test('should return null for missing top-level variable (context.missingVar)', () => {
        // Rule checks if the result is null
        const conditionJson = {'==': [{'var': 'context.missingVar'}, null]};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Do NOT add mockContext.context.missingVar

        const result = service.evaluate(conditionJson, mockContext);

        // Expect true because the var operation returns null, and null == null
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return null for nested access when parent variable is missing (context.missingVar.prop)', () => {
        // Rule checks if the result is null
        const conditionJson = {'==': [{'var': 'context.missingVar.prop'}, null]};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Do NOT add mockContext.context.missingVar

        const result = service.evaluate(conditionJson, mockContext);

        // Expect true because accessing .prop on null (the result of context.missingVar) yields null
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return null for nested access when property is missing on existing parent (context.existingVar.missingProp)', () => {
        // Rule checks if the result is null
        const conditionJson = {'==': [{'var': 'context.existingVar.missingProp'}, null]};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Add the parent variable, but not the nested property
        mockContext.context.existingVar = {someValue: 42};

        const result = service.evaluate(conditionJson, mockContext);

        // Expect true because accessing .missingProp on existingVar yields undefined,
        // which json-logic-js typically treats as null in comparisons.
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should check truthiness (!!) evaluates to false for missing variable', () => {
        const conditionJson = {'!!': {'var': 'context.anotherMissingVar'}};
        const mockContext = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Do NOT add mockContext.context.anotherMissingVar

        const result = service.evaluate(conditionJson, mockContext);

        // Expect false because the var operation returns null, and !!null is false
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

    }); // End describe Missing Variable Access

  }); // End describe Context Variable Access

}); // End describe JsonLogicEvaluationService