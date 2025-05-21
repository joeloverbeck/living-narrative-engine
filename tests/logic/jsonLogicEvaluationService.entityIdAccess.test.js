// src/tests/logic/jsonLogicEvaluationService.entityIdAccess.test.js

/**
 * @jest-environment node
 *
 * @fileoverview This file contains unit tests for the JsonLogicEvaluationService.
 * It focuses on testing the service's core functionalities in isolation,
 * such as rule evaluation logic (comparison, logical, truthiness operators),
 * dependency usage (ILogger), error handling, and access to context data
 * like actor/target IDs.
 * It uses mocked dependencies (ILogger, EntityManager) to achieve this isolation.
 */

import {describe, expect, test, jest, beforeEach, afterEach, it} from '@jest/globals'; // Added 'it' alias for 'test'

// --- Class Under Test ---
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- Dependencies for Mocking & Context ---
import {createJsonLogicContext} from '../../src/logic/contextAssembler.js'; // Adjust path as needed - Needed for entity access tests
import Entity from '../../src/entities/entity.js'; // Adjust path as needed - Needed for mock context setup

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjust path as needed
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */ // Adjust path as needed
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

// Mock EntityManager (Required by createJsonLogicContext for entity resolution)
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

// Helper to create a simple mock entity instance for testing
const createMockEntity = (id) => new Entity(id);

// Define a base event structure for context creation
/** @type {GameEvent} */
const baseEvent = {type: 'TEST_EVENT', payload: {}};

// --- Test Suite ---

describe('JsonLogicEvaluationService Unit Tests', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;
  /** @type {JsonLogicEvaluationContext} */
  let mockContext; // Basic context for general tests

  // --- Test Setup & Teardown ---
  beforeEach(() => {
    // Task: Clear all mocks before each test
    jest.clearAllMocks();

    // Task: Instantiate JsonLogicEvaluationService using the mockLogger
    service = new JsonLogicEvaluationService({logger: mockLogger});
    mockLogger.info.mockClear(); // Clear constructor log if needed

    // Task: Reset mockEntityManager methods
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();
    mockEntityManager.createEntityInstance.mockReset();
    mockEntityManager.addComponent.mockReset();
    // ... reset other EM mocks if necessary ...

    // Set default mock implementations after resetting
    // Default: Entity Manager doesn't find entities unless specifically configured in a test
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => undefined);
    mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => undefined);
    mockEntityManager.hasComponent.mockImplementation((entityId, componentTypeId) => false);

    // Create a simple default context for tests that don't need complex entity setup
    mockContext = {
      event: baseEvent,
      actor: null,
      target: null,
      context: { // Variables accessed via "context.variableName"
        truthyVar: true,
        falsyVar: false,
        numVar: 1,
        zeroVar: 0,
        strVar: 'hello',
        emptyStrVar: '',
        arrayVar: [1, 2],
        emptyArrayVar: [], // Empty array IS truthy in raw JS, but handled differently by JsonLogic ops
        objVar: {a: 1},
        emptyObjVar: {}, // Empty object IS truthy in raw JS and JsonLogic
      },
      // globals: {}, // If used later
      // entities: {}, // If used later
    };
  });

  // --- [PARENT_ID].5: Entity ID Access Tests ---
  describe('Entity ID Access (actor.id, target.id)', () => {

    describe('actor.id Access', () => {
      const actorIdMatchRule = {'==': [{'var': 'actor.id'}, 'player1']};
      const actorIdNullRule = {'==': [{'var': 'actor.id'}, null]};
      const actorIdNotNullRule = {'!=': [{'var': 'actor.id'}, null]};

      test('should return true for actor.id match when entity exists', () => {
        const actorId = 'player1';
        const mockEntity = createMockEntity(actorId);
        mockEntityManager.getEntityInstance.mockImplementation((id) => id === actorId ? mockEntity : undefined);

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        const result = service.evaluate(actorIdMatchRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false for actor.id mismatch when entity exists', () => {
        const actorId = 'otherPlayer'; // ID is different from the rule
        const mockEntity = createMockEntity(actorId);
        mockEntityManager.getEntityInstance.mockImplementation((id) => id === actorId ? mockEntity : undefined);

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        const result = service.evaluate(actorIdMatchRule, context); // Rule checks for "player1"

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing actor.id to null when actorId is null', () => {
        const actorId = null;
        // EntityManager should not be called for null ID
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Should not be called');
        });

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        const result = service.evaluate(actorIdNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // Important check
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing actor.id to null when entity is not found by EntityManager', () => {
        const actorId = 'player1';
        // Configure EM to *not* find the entity
        mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        // When entity isn't found, context assembler sets actor to null, so actor.id resolves to null
        const result = service.evaluate(actorIdNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true checking actor.id is not null when entity exists', () => {
        const actorId = 'player1';
        const mockEntity = createMockEntity(actorId);
        mockEntityManager.getEntityInstance.mockImplementation((id) => id === actorId ? mockEntity : undefined);

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        const result = service.evaluate(actorIdNotNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false checking actor.id is not null when actorId is null', () => {
        const actorId = null;
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Should not be called');
        });

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        const result = service.evaluate(actorIdNotNullRule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false checking actor.id is not null when entity is not found', () => {
        const actorId = 'player1';
        // Configure EM to *not* find the entity
        mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);

        const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
        // When entity isn't found, context assembler sets actor to null, so actor.id resolves to null
        const result = service.evaluate(actorIdNotNullRule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

    }); // End describe actor.id Access

    describe('target.id Access', () => {
      const targetIdMatchRule = {'==': [{'var': 'target.id'}, 'enemy1']};
      const targetIdNullRule = {'==': [{'var': 'target.id'}, null]};
      const targetIdNotNullRule = {'!=': [{'var': 'target.id'}, null]};

      test('should return true for target.id match when entity exists', () => {
        const targetId = 'enemy1';
        const mockEntity = createMockEntity(targetId);
        mockEntityManager.getEntityInstance.mockImplementation((id) => id === targetId ? mockEntity : undefined);

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        const result = service.evaluate(targetIdMatchRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false for target.id mismatch when entity exists', () => {
        const targetId = 'otherEnemy'; // ID is different from the rule
        const mockEntity = createMockEntity(targetId);
        mockEntityManager.getEntityInstance.mockImplementation((id) => id === targetId ? mockEntity : undefined);

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        const result = service.evaluate(targetIdMatchRule, context); // Rule checks for "enemy1"

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing target.id to null when targetId is null', () => {
        const targetId = null;
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Should not be called');
        });

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        const result = service.evaluate(targetIdNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true comparing target.id to null when entity is not found by EntityManager', () => {
        const targetId = 'enemy1';
        // Configure EM to *not* find the entity
        mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        // When entity isn't found, context assembler sets target to null, so target.id resolves to null
        const result = service.evaluate(targetIdNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true checking target.id is not null when entity exists', () => {
        const targetId = 'enemy1';
        const mockEntity = createMockEntity(targetId);
        mockEntityManager.getEntityInstance.mockImplementation((id) => id === targetId ? mockEntity : undefined);

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        const result = service.evaluate(targetIdNotNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false checking target.id is not null when targetId is null', () => {
        const targetId = null;
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Should not be called');
        });

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        const result = service.evaluate(targetIdNotNullRule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false checking target.id is not null when entity is not found', () => {
        const targetId = 'enemy1';
        // Configure EM to *not* find the entity
        mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);

        const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);
        // When entity isn't found, context assembler sets target to null, so target.id resolves to null
        const result = service.evaluate(targetIdNotNullRule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

    }); // End describe target.id Access

  }); // End describe Entity ID Access

}); // End describe JsonLogicEvaluationService Unit Tests