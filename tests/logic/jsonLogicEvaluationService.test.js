// src/logic/jsonLogicEvaluationService.test.js

/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/* eslint-disable no-unused-vars */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed
// --- Task 1: Import necessary modules (Ticket 2.6.3) ---
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js'; // Adjust path
import Entity from '../../src/entities/entity.js'; // Adjust path

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Import type for mocking

// --- Adjust Mocking for Ticket 2.6.3 ---
// We still need json-logic-js, but we want the REAL 'apply' for end-to-end tests.
// We only mock 'add_operation' to isolate it if needed, though it's not the focus here.
// Note: If 'json-logic-js' is used elsewhere and needs mocking there, more complex setup might be needed.
// For THIS test file, we focus on *not* mocking 'apply' for the end-to-end suite.
// We can keep the mock for 'add_operation' to avoid potential side-effects if the service calls it unexpectedly.
import jsonLogic from 'json-logic-js'; // Import the actual library
const actualApply = jsonLogic.apply; // Keep a reference if needed, but we won't mock it globally here.
const actualAddOperation = jsonLogic.add_operation; // Keep reference if needed

// Mock only 'add_operation' for isolation if needed, but let 'apply' be real.
// We achieve this by selectively mocking within tests or ensuring no global mock overrides 'apply'.
// Simpler approach: Don't mock the whole module, or use jest.spyOn if selective mocking per test is desired.
// Let's proceed assuming no global mock is needed for 'apply' in the end-to-end suite.

// Mock ILogger (Reused from previous setup)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Task 2: Implement mock for EntityManager (Ticket 2.6.3) ---
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // Mock methods needed by createJsonLogicContext
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  // Add mocks for any other methods if they were unexpectedly called, initially keep it minimal.
  // We don't need the full implementation, just the interface methods used.
  hasComponent: jest.fn(), // createComponentAccessor might use this
  // Dummy implementations for unused methods if constructor requires them (adapt based on actual EM constructor)
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  // Add mock for activeEntities if needed, though unlikely for context creation
  activeEntities: new Map(),
};

describe('JsonLogicEvaluationService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    // Instantiate service with the mock logger
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    mockLogger.info.mockClear(); // Clear constructor log call

    // Reset EntityManager mocks before each test
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Default mock implementations (can be overridden in specific tests)
    // getEntityInstance: Return undefined by default, override in tests where entity should exist
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    // getComponentData: Return undefined by default
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => undefined
    );
    // hasComponent: Return false by default
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );
  });

  // --- Tests from Ticket 2.6.1 (Constructor) ---
  // (Keep existing constructor tests as they are)
  describe('Constructor', () => {
    test('should instantiate successfully with a valid logger', () => {
      expect(() => {
        new JsonLogicEvaluationService({ logger: mockLogger });
      }).not.toThrow();
    });

    test('should throw an error if logger dependency is missing or invalid', () => {
      const expectedErrorMsg =
        'JsonLogicEvaluationService requires a valid ILogger instance.';
      expect(() => new JsonLogicEvaluationService({})).toThrow(
        expectedErrorMsg
      );
      expect(() => new JsonLogicEvaluationService({ logger: null })).toThrow(
        expectedErrorMsg
      );
      // ... other invalid logger checks
    });
  });

  // --- Tests for Ticket 2.6.2 (evaluate method interaction - MOCKED apply) ---
  // These tests remain valid for testing the service's *internal* logic
  // (logging, error handling around apply), assuming apply IS mocked.
  // We might rename the describe block slightly for clarity.
  describe('evaluate() method (Unit Tests with Mocked Apply)', () => {
    // eslint-disable-next-line jsdoc/no-undefined-types
    /** @type {JSONLogicRule} */
    const sampleRule = { '==': [{ var: 'event.type' }, 'TEST_EVENT'] };
    /** @type {JsonLogicEvaluationContext} */
    const sampleContext = {
      event: { type: 'TEST_EVENT', payload: { data: 'sample' } },
      actor: null,
      target: null,
      context: {},
      globals: {},
      entities: {},
    };
    const expectedRuleSummary = JSON.stringify(sampleRule); // Simplified for example
    const expectedContextKeys =
      'event, actor, target, context, globals, entities'; // Based on sampleContext

    let applySpy;
    beforeEach(() => {
      applySpy = jest.spyOn(jsonLogic, 'apply');
    });
    afterEach(() => {
      // Make sure spy is restored
      if (applySpy) applySpy.mockRestore();
    });

    test('should call jsonLogic.apply and return true when apply returns true', () => {
      applySpy.mockReturnValue(true);
      const result = service.evaluate(sampleRule, sampleContext);
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(sampleRule, sampleContext);
      expect(result).toBe(true); // Correct

      // --- MODIFIED DEBUG CHECK ---
      // Check for the actual debug messages logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Evaluating rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Rule evaluation raw result: true, Final boolean: true' // Check actual log message
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should call jsonLogic.apply and return false when apply returns false', () => {
      applySpy.mockReturnValue(false);
      const result = service.evaluate(sampleRule, sampleContext);
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy).toHaveBeenCalledWith(sampleRule, sampleContext);
      expect(result).toBe(false); // Correct

      // --- MODIFIED DEBUG CHECK ---
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Evaluating rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Rule evaluation raw result: false, Final boolean: false' // Check actual log message
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return false and log error if jsonLogic.apply throws', () => {
      const mockError = new Error('Internal json-logic error');
      applySpy.mockImplementation(() => {
        throw mockError;
      });
      const result = service.evaluate(sampleRule, sampleContext);
      expect(result).toBe(false); // Correct (catch block returns false)
      expect(applySpy).toHaveBeenCalledTimes(1);
      // Check that error IS logged
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Correct
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error evaluating JSON Logic rule: ${expectedRuleSummary}`
        ), // Check message format
        mockError // Check error object
      );
    });

    // --- MODIFIED Non-Boolean Test ---
    test('should return true (via truthiness) and NOT log error if jsonLogic.apply returns truthy non-boolean (42)', () => {
      const nonBooleanValue = 42;
      applySpy.mockReturnValue(nonBooleanValue);
      const result = service.evaluate(sampleRule, sampleContext);

      // Expect truthiness conversion: !!42 is true
      expect(result).toBe(true); // MODIFIED: Expect true based on !!42
      expect(applySpy).toHaveBeenCalledTimes(1);

      // Expect error NOT to be logged
      expect(mockLogger.error).not.toHaveBeenCalled(); // MODIFIED: Error should not be logged

      // Check debug logs (optional but good practice)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Evaluating rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Rule evaluation raw result: ${JSON.stringify(nonBooleanValue)}, Final boolean: true`
      );
    });

    // Optional: Add a test for a FALSY non-boolean value if desired
    test('should return false (via truthiness) and NOT log error if jsonLogic.apply returns falsy non-boolean (0)', () => {
      const nonBooleanValue = 0;
      applySpy.mockReturnValue(nonBooleanValue);
      const result = service.evaluate(sampleRule, sampleContext);

      // Expect truthiness conversion: !!0 is false
      expect(result).toBe(false); // MODIFIED: Expect false based on !!0
      expect(applySpy).toHaveBeenCalledTimes(1);

      // Expect error NOT to be logged
      expect(mockLogger.error).not.toHaveBeenCalled(); // MODIFIED: Error should not be logged

      // Check debug logs
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Evaluating rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Rule evaluation raw result: ${JSON.stringify(nonBooleanValue)}, Final boolean: false`
      );
    });
  }); // End describe evaluate() (Unit Tests)

  // --- NEW: Tests for Ticket 2.6.3 (End-to-End with REAL apply) ---
  describe('evaluate() method (End-to-End Tests with Real Apply)', () => {
    // Helper to create mock entity instance
    const createMockEntity = (id) => {
      // Use the actual Entity class constructor but methods might need mocking if used
      const entity = new Entity(id, 'dummy');
      // Mock methods if needed by createComponentAccessor or other logic
      // For now, we rely on mocking EntityManager.getComponentData directly
      return entity;
    };

    // --- Equality Test ---
    describe('Equality Rule: {"==": [{"var": "event.payload.value"}, 10]}', () => {
      const rule = { '==': [{ var: 'event.payload.value' }, 10] };

      test('should return true when event.payload.value is 10', () => {
        /** @type {GameEvent} */
        const event = { type: 'TEST_EVENT', payload: { value: 10 } };
        // No actor/target needed for this rule
        const actorId = null;
        const targetId = null;

        // No EntityManager setup needed as rule only accesses event

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);

        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when event.payload.value is 5', () => {
        /** @type {GameEvent} */
        const event = { type: 'TEST_EVENT', payload: { value: 5 } };
        const actorId = null;
        const targetId = null;

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);

        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when event.payload.value is missing', () => {
        /** @type {GameEvent} */
        const event = { type: 'TEST_EVENT', payload: {} }; // value is missing
        const actorId = null;
        const targetId = null;

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        // JSON Logic treats missing var as null, null == 10 is false
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // --- Inequality Test ---
    describe('Inequality Rule: {"!=": [{"var": "actor.id"}, "player"]}', () => {
      const rule = { '!=': [{ var: 'actor.id' }, 'player'] };
      /** @type {GameEvent} */
      const event = { type: 'OTHER_EVENT', payload: {} };
      const targetId = null;

      test('should return false when actor.id is "player"', () => {
        const actorId = 'player';
        const mockActor = createMockEntity(actorId);

        // Setup EntityManager mock
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === actorId) return mockActor;
          return undefined;
        });
        // No component data needed for this rule

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true when actor.id is "npc1"', () => {
        const actorId = 'npc1';
        const mockActor = createMockEntity(actorId);

        // Setup EntityManager mock
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === actorId) return mockActor;
          return undefined;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true when actor is null', () => {
        const actorId = null; // No actor provided

        // Setup EntityManager mock (getEntityInstance shouldn't be called for null id)
        mockEntityManager.getEntityInstance.mockImplementation(
          (id) => undefined
        );

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // Rule accesses actor.id -> null
        // "!=" : [null, "player"] -> true
        const result = service.evaluate(rule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // --- Comparison Test ---
    describe('Comparison Rule: {">": [{"var": "target.components.Health.current"}, 50]}', () => {
      const rule = { '>': [{ var: 'target.components.Health.current' }, 50] };
      const componentTypeId = 'Health';
      const targetId = 'enemy1';
      const mockTarget = createMockEntity(targetId);
      /** @type {GameEvent} */
      const event = { type: 'DAMAGE_EVENT', payload: {} };
      const actorId = 'player'; // Assume an actor exists but isn't used by rule

      beforeEach(() => {
        // Common EM setup for target entity existence
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === targetId) return mockTarget;
          if (id === actorId) return createMockEntity(actorId); // Actor exists
          return undefined;
        });
      });

      test('should return true when target Health.current is 75 (> 50)', () => {
        const healthData = { current: 75, max: 100 };

        // Setup EM mock for component data
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === componentTypeId) return healthData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === targetId && compId === componentTypeId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);

        expect(result).toBe(true);
        // Check that EM methods were called by createJsonLogicContext/accessor
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        // The proxy access will call getComponentData:
        // Use expect.anything() as the proxy object itself is complex to match exactly
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentTypeId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target Health.current is 50 (not > 50)', () => {
        const healthData = { current: 50, max: 100 };

        // Setup EM mock for component data
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === componentTypeId) return healthData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === targetId && compId === componentTypeId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentTypeId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target Health.current is 30 (<= 50)', () => {
        const healthData = { current: 30, max: 100 };
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === componentTypeId) return healthData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === targetId && compId === componentTypeId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target Health component is missing', () => {
        // Setup EM mock - Health component does *not* exist
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          // Only return data for *other* components if needed, but not Health
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          // Explicitly return false for Health
          return !(id === targetId && compId === componentTypeId);
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // Accessing target.components.Health -> null
        // Accessing target.components.Health.current -> null
        // Rule becomes {">": [null, 50]} -> false
        const result = service.evaluate(rule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentTypeId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target entity is missing', () => {
        const missingTargetId = 'nonexistent_enemy';
        // Setup EM mock - target entity does *not* exist
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === actorId) return createMockEntity(actorId); // Actor exists
          // Target does NOT exist
          if (id === missingTargetId) return undefined;
          return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation(() => undefined); // Won't have component data
        mockEntityManager.hasComponent.mockImplementation(() => false);

        const context = createJsonLogicContext(
          event,
          actorId,
          missingTargetId,
          mockEntityManager,
          mockLogger
        );
        // Accessing target -> null
        // Accessing target.components -> null
        // Accessing target.components.Health.current -> null
        // Rule becomes {">": [null, 50]} -> false
        const result = service.evaluate(rule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          missingTargetId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // --- Logical AND Test ---
    describe('Logical AND Rule: {"and": [{"==": [{"var": "event.type"}, "TEST_EVENT"]}, {">": [{"var": "actor.components.Stamina.current"}, 0]}]}', () => {
      const rule = {
        and: [
          { '==': [{ var: 'event.type' }, 'TEST_EVENT'] },
          { '>': [{ var: 'actor.components.Stamina.current' }, 0] },
        ],
      };
      const staminaComponentId = 'Stamina';
      const actorId = 'player';
      const mockActor = createMockEntity(actorId);
      const targetId = null;

      beforeEach(() => {
        // Common EM setup for actor entity existence
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === actorId) return mockActor;
          return undefined;
        });
      });

      // Test cases for AND (True/True, True/False, False/True, False/False)
      test('should return true when event.type is "TEST_EVENT" AND actor Stamina > 0', () => {
        /** @type {GameEvent} */
        const event = { type: 'TEST_EVENT', payload: {} };
        const staminaData = { current: 10, max: 100 };
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === staminaComponentId)
            return staminaData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === actorId && compId === staminaComponentId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when event.type is "TEST_EVENT" BUT actor Stamina is 0', () => {
        /** @type {GameEvent} */
        const event = { type: 'TEST_EVENT', payload: {} };
        const staminaData = { current: 0, max: 100 }; // Stamina NOT > 0
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === staminaComponentId)
            return staminaData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === actorId && compId === staminaComponentId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(false); // First is true, second is false -> AND is false
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when event.type is NOT "TEST_EVENT" even if actor Stamina > 0', () => {
        /** @type {GameEvent} */
        const event = { type: 'WRONG_EVENT', payload: {} }; // Event type mismatch
        const staminaData = { current: 10, max: 100 }; // Stamina > 0
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === staminaComponentId)
            return staminaData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === actorId && compId === staminaComponentId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(false); // First is false -> AND is false (short-circuits)
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when event.type is NOT "TEST_EVENT" AND actor Stamina is 0', () => {
        /** @type {GameEvent} */
        const event = { type: 'WRONG_EVENT', payload: {} };
        const staminaData = { current: 0, max: 100 };
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === staminaComponentId)
            return staminaData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          return id === actorId && compId === staminaComponentId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(false); // Both false -> AND is false
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when actor Stamina component is missing', () => {
        /** @type {GameEvent} */
        const event = { type: 'TEST_EVENT', payload: {} }; // Event type matches
        // Stamina component missing
        mockEntityManager.getComponentData.mockImplementation(
          (id, compId) => undefined
        );
        mockEntityManager.hasComponent.mockImplementation(() => false);

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // actor.components.Stamina.current -> null
        // ">": [null, 0] -> false
        const result = service.evaluate(rule, context);
        expect(result).toBe(false); // First true, second false -> AND false
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // --- Logical OR Test ---
    describe('Logical OR Rule: {"or": [{"==": [{"var": "target.components.Status.effect"}, "POISON"]}, {"==": [{"var": "target.components.Status.effect"}, "STUN"]}]}', () => {
      const rule = {
        or: [
          { '==': [{ var: 'target.components.Status.effect' }, 'POISON'] },
          { '==': [{ var: 'target.components.Status.effect' }, 'STUN'] },
        ],
      };
      const statusComponentId = 'Status';
      const targetId = 'monster';
      const mockTarget = createMockEntity(targetId);
      /** @type {GameEvent} */
      const event = { type: 'CHECK_STATUS', payload: {} };
      const actorId = 'player';

      beforeEach(() => {
        // Common EM setup
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === targetId) return mockTarget;
          if (id === actorId) return createMockEntity(actorId);
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          // Assume Status component always exists for these tests unless specified otherwise
          return id === targetId && compId === statusComponentId;
        });
      });

      // Test cases for OR (True/True, True/False, False/True, False/False)
      test('should return true when target Status.effect is "POISON"', () => {
        const statusData = { effect: 'POISON', duration: 5 };
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === statusComponentId)
            return statusData;
          return undefined;
        });
        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(true); // First true -> OR true (short-circuits)
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return true when target Status.effect is "STUN"', () => {
        const statusData = { effect: 'STUN', duration: 2 };
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === statusComponentId)
            return statusData;
          return undefined;
        });
        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(true); // First false, second true -> OR true
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target Status.effect is "BURN" (neither POISON nor STUN)', () => {
        const statusData = { effect: 'BURN', duration: 3 };
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === statusComponentId)
            return statusData;
          return undefined;
        });
        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(rule, context);
        expect(result).toBe(false); // Both false -> OR false
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target Status component is missing', () => {
        // Setup EM mock - Status component does *not* exist
        mockEntityManager.getComponentData.mockImplementation(() => undefined);
        mockEntityManager.hasComponent.mockImplementation(() => false); // Status doesn't exist

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // target.components.Status.effect -> null
        // Rule becomes {"or": [{"==": [null, "POISON"]}, {"==": [null, "STUN"]}]}
        // which is {"or": [false, false]} -> false
        const result = service.evaluate(rule, context);
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when target Status.effect property is missing', () => {
        const statusData = { duration: 3 }; // effect property is missing
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === statusComponentId)
            return statusData;
          return undefined;
        });
        mockEntityManager.hasComponent.mockImplementation((id, compId) => {
          // Status component *exists* but lacks the property
          return id === targetId && compId === statusComponentId;
        });

        const context = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // target.components.Status.effect -> null (accessing missing property yields null in json-logic)
        // Rule becomes {"or": [{"==": [null, "POISON"]}, {"==": [null, "STUN"]}]} -> false
        const result = service.evaluate(rule, context);
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    // --- Logical NOT Test ---
    describe('Logical NOT Rule: {"!": {"==": [{"var": "context.queryResult"}, null]}}', () => {
      const rule = { '!': { '==': [{ var: 'context.queryResult' }, null] } };
      /** @type {GameEvent} */
      const event = { type: 'CONTEXT_TEST', payload: {} };
      const actorId = null;
      const targetId = null;

      test('should return true when context.queryResult is NOT null (e.g., has data)', () => {
        // Context needs to be manually augmented *after* creation by createJsonLogicContext
        // because createJsonLogicContext initializes context: {}
        const baseContext = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // Manually add the property that the rule expects
        baseContext.context.queryResult = { id: 'item1', value: 100 };

        // Rule: ! (queryResult == null) -> ! (false) -> true
        const result = service.evaluate(rule, baseContext);
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when context.queryResult IS null', () => {
        const baseContext = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        baseContext.context.queryResult = null; // Explicitly null

        // Rule: ! (queryResult == null) -> ! (true) -> false
        const result = service.evaluate(rule, baseContext);
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should return false when context.queryResult is missing (treated as null)', () => {
        const baseContext = createJsonLogicContext(
          event,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // queryResult is missing from baseContext.context

        // Rule: ! (queryResult == null) -> ! (null == null) -> ! (true) -> false
        const result = service.evaluate(rule, baseContext);
        expect(result).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });
  }); // End describe evaluate() (End-to-End Tests)

  // --- Tests for addOperation() method ---
  // These tests might need adjustment depending on whether jsonLogic.add_operation
  // needs mocking or can be called on the real library instance.
  // Let's keep them mocked for isolation for now.
  describe('addOperation() method', () => {
    let addOpSpy;
    beforeEach(() => {
      addOpSpy = jest.spyOn(jsonLogic, 'add_operation');
    });
    afterEach(() => {
      if (addOpSpy) addOpSpy.mockRestore();
    });

    test('should call jsonLogic.add_operation with name and function', () => {
      const operationName = 'customOp';
      const operationFunc = jest.fn();
      addOpSpy.mockImplementation(() => {}); // Mock implementation

      service.addOperation(operationName, operationFunc);

      expect(addOpSpy).toHaveBeenCalledTimes(1);
      expect(addOpSpy).toHaveBeenCalledWith(operationName, operationFunc);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Custom JSON Logic operation "${operationName}" added successfully.`
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should log an error if jsonLogic.add_operation throws', () => {
      const operationName = 'failingOp';
      const operationFunc = jest.fn();
      const mockError = new Error('Failed to add');
      addOpSpy.mockImplementation(() => {
        throw mockError;
      });

      service.addOperation(operationName, operationFunc);

      expect(addOpSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to add custom JSON Logic operation "${operationName}":`,
        mockError
      );
    });
  }); // End describe addOperation()
}); // End describe JsonLogicEvaluationService
