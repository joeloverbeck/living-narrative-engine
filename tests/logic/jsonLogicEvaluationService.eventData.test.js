// src/tests/logic/jsonLogicEvaluationService.eventData.test.js

/**
 * @jest-environment node
 *
 * @fileoverview This file contains unit tests for the JsonLogicEvaluationService,
 * specifically focusing on accessing event data (event.type, event.payload)
 * within the JsonLogic context using the 'var' operator.
 * Corresponds to Ticket [PARENT_ID].4.
 */

import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed
import {createJsonLogicContext} from '../../src/logic/contextAssembler.js'; // Adjust path as needed
import Entity from '../../src/entities/entity.js'; // Adjust path - Needed for mock context setup

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */ // Adjust path as needed
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Adjust path as needed
/** @typedef {object} JSONLogicRule */

// --- Mock Dependencies (Setup from Ticket [PARENT_ID].1) ---

// Mock ILogger
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // --- Core methods used by createJsonLogicContext ---
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(), // Needed for component accessors if actor/target were involved
  hasComponent: jest.fn(),

  // --- Dummy implementations for other EM methods ---
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Helper to create mock entity instance (though not directly used by event.* rules)
// const createMockEntity = (id) => new Entity(id); // Keep if needed for consistency or future tests

// --- Test Suite ---

describe('JsonLogicEvaluationService - Event Data Access Tests (Ticket [PARENT_ID].4)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Instantiate the service with the mock logger
    service = new JsonLogicEvaluationService({logger: mockLogger});
    mockLogger.info.mockClear(); // Clear constructor log call

    // Reset EntityManager mocks (needed for createJsonLogicContext)
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Default mock behavior (no entities found, no components)
    mockEntityManager.getEntityInstance.mockImplementation(() => undefined);
    mockEntityManager.getComponentData.mockImplementation(() => undefined);
    mockEntityManager.hasComponent.mockImplementation(() => false);
  });

  // --- Describe block specifically for event data access tests ---
  describe('Event Data Access (event.type, event.payload.*)', () => {

    // --- event.type Access ---
    describe('event.type Access', () => {
      const ruleMatch = {'==': [{'var': 'event.type'}, 'ACTION:PERFORMED']};
      const ruleMismatch = {'==': [{'var': 'event.type'}, 'ACTION:FAILED']};

      test('should return true when event.type matches the rule', () => {
        /** @type {GameEvent} */
        const event = {type: 'ACTION:PERFORMED', payload: {}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
        const result = service.evaluate(ruleMatch, context);

        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when event.type does not match the rule', () => {
        /** @type {GameEvent} */
        const event = {type: 'ACTION:PERFORMED', payload: {}}; // Event type differs from ruleMismatch
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
        const result = service.evaluate(ruleMismatch, context);

        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe event.type Access

    // --- event.payload Access ---
    describe('event.payload Access', () => {
      const eventType = 'PAYLOAD_ACCESS_TEST';

      test('should return true when accessing an existing payload property with a matching value', () => {
        const rule = {'==': [{'var': 'event.payload.value'}, 10]};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {value: 10, other: 'abc'}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when accessing an existing payload property with a non-matching value', () => {
        const rule = {'==': [{'var': 'event.payload.value'}, 99]};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {value: 10}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true when accessing an existing nested payload property with a matching value', () => {
        const rule = {'==': [{'var': 'event.payload.nested.key'}, 'foundIt']};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {nested: {key: 'foundIt', index: 1}}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when accessing an existing nested payload property with a non-matching value', () => {
        const rule = {'==': [{'var': 'event.payload.nested.key'}, 'wrongValue']};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {nested: {key: 'foundIt'}}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing to null when accessing a missing key within an existing payload', () => {
        // JsonLogic 'var' resolves missing properties to null
        const rule = {'==': [{'var': 'event.payload.missingKey'}, null]};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {existingKey: 'hello'}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing to null when accessing a missing nested key', () => {
        const rule = {'==': [{'var': 'event.payload.nested.missingKey'}, null]};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {nested: {existingKey: 123}}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing to null when accessing a key via a missing intermediate nested object', () => {
        const rule = {'==': [{'var': 'event.payload.missingNested.key'}, null]};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {anotherNested: {}}}; // missingNested object doesn't exist
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
        // event.payload.missingNested resolves to null, accessing .key on null is still null in JsonLogic context

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing to null when accessing a payload property and payload itself is missing (undefined)', () => {
        // createJsonLogicContext should handle event.payload being undefined gracefully
        const rule = {'==': [{'var': 'event.payload.anyKey'}, null]};
        /** @type {GameEvent} */
        const event = {type: eventType}; // No payload property
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
        // Accessing event.payload (which becomes {} or similar in context) .anyKey should resolve to null

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing to null when accessing a payload property and payload is an empty object', () => {
        const rule = {'==': [{'var': 'event.payload.anyKey'}, null]};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {}}; // Empty payload
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      // Test accessing the payload object itself (truthiness)
      test('should return true using !! when payload exists and is not empty', () => {
        const rule = {'!!': {'var': 'event.payload'}};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {key: 'value'}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        // Non-empty object is truthy
        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      // Note: json-logic-js treats empty objects {} as TRUTHY, unlike empty arrays [].
      // See http://jsonlogic.com/truthy.html
      test('should return true using !! when payload exists but is an empty object', () => {
        const rule = {'!!': {'var': 'event.payload'}};
        /** @type {GameEvent} */
        const event = {type: eventType, payload: {}};
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);

        // Empty object {} is TRUTHY in JsonLogic
        expect(service.evaluate(rule, context)).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false using !! when payload is missing (undefined)', () => {
        const rule = {'!!': {'var': 'event.payload'}};
        /** @type {GameEvent} */
        const event = {type: eventType}; // No payload property
        const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
        // 'var' lookup for event.payload itself (when missing) might resolve to null, which is falsy.
        // The exact behavior depends slightly on createJsonLogicContext, but the expected outcome is falsy.

        expect(service.evaluate(rule, context)).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

    }); // End describe event.payload Access

  }); // End describe Event Data Access

}); // End describe JsonLogicEvaluationService - Event Data Access Tests