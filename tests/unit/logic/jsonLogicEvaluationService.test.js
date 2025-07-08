// src/logic/jsonLogicEvaluationService.test.js

/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/* eslint-disable no-unused-vars */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed
// --- Task 1: Import necessary modules (Ticket 2.6.3) ---
import { createJsonLogicContext } from '../../../src/logic/contextAssembler.js'; // Adjust path
import Entity from '../../../src/entities/entity.js'; // Adjust path
import EntityDefinition from '../../../src/entities/entityDefinition.js'; // Added
import EntityInstanceData from '../../../src/entities/entityInstanceData.js'; // Added
import { createEntityInstance } from '../../common/entities/index.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */ // Import type for mocking

// --- Adjust Mocking for Ticket 2.6.3 ---
// We still need json-logic-js, but we want the REAL 'apply' for end-to-end tests.
// We only mock 'add_operation' to isolate it if needed, though it's not the focus here.
// Note: If 'json-logic-js' is used elsewhere and needs mocking there, more complex setup might be needed.
// For THIS test file, we focus on *not* mocking 'apply' for the end-to-end suite.
// We can keep the mock for 'add_operation' to avoid potential side-effects if the service calls it unexpectedly.
import jsonLogic from 'json-logic-js'; // Import the actual library
const actualApply = jsonLogic.apply; // Keep a reference if needed, but we won't mock it globally here.
const actualAddOperation = jsonLogic.add_operation; // Keep reference if needed

// Mock ILogger (Reused from previous setup)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Minimal mock for the game data repository dependency
const mockGameDataRepository = {
  getConditionDefinition: jest.fn(),
};

// --- Task 2: Implement mock for EntityManager (Ticket 2.6.3) ---
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // Mock methods needed by createJsonLogicContext
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(), // createComponentAccessor might use this
  // Dummy implementations for unused methods
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
  // Added for completeness with new EntityManager structure
  _definitionCache: new Map(),
};

describe('JsonLogicEvaluationService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });
    mockLogger.info.mockClear();

    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => undefined
    );
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );
  });

  // --- Tests from Ticket 2.6.1 (Constructor) ---
  // (Keep existing constructor tests as they are)
  describe('Constructor', () => {
    test('should instantiate successfully with a valid logger', () => {
      expect(() => {
        new JsonLogicEvaluationService({
          logger: mockLogger,
          gameDataRepository: mockGameDataRepository,
        });
      }).not.toThrow();
    });

    test('should throw an error if logger dependency is missing or invalid', () => {
      const expectedErrorMsg = 'Missing required dependency: logger.';
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
        `JsonLogicEvaluationService: Evaluating rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JsonLogicEvaluationService: Rule evaluation raw result: true, Final boolean: true'
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
        `JsonLogicEvaluationService: Evaluating rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JsonLogicEvaluationService: Rule evaluation raw result: false, Final boolean: false'
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        `JsonLogicEvaluationService: Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeys}`,
        mockError
      );
    });
  });

  // --- End-to-End Tests (Ticket 2.6.3) ---
  // Test suite using REAL jsonLogic.apply and mocked createJsonLogicContext
  // dependencies (ILogger, EntityManager).
  // These tests verify the service works correctly with the actual json-logic library
  // and that the context is built and used as expected.
  describe('evaluate() method (End-to-End with REAL jsonLogic.apply)', () => {
    // Helper to create simple mock entity instance for these tests
    const DUMMY_DEFINITION_ID_FOR_MOCKS = 'def:mock-eval-service';

    // --- Test cases using createJsonLogicContext and actual jsonLogic.apply ---
    // Example: Test with actor component access
    test('should correctly evaluate rule accessing actor component data', () => {
      const actorId = 'player1';
      const componentId = 'health';
      const property = 'current';
      const rule = {
        '==': [{ var: `actor.components.${componentId}.${property}` }, 100],
      };
      /** @type {GameEvent} */
      const event = { type: 'CHECK_HEALTH', payload: {} };
      const mockActor = createEntityInstance({ instanceId: actorId });
      const healthComponentData = { current: 100, max: 100 };

      // Setup EntityManager mocks for this specific test
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === componentId) {
          return healthComponentData;
        }
        return undefined;
      });

      // --- Task 3: Create Context for test case (Ticket 2.6.3) ---
      const context = createJsonLogicContext(
        event,
        actorId,
        null, // No target for this test
        mockEntityManager,
        mockLogger
      );

      // --- Evaluate rule (uses actual jsonLogic.apply) ---
      const result = service.evaluate(rule, context);

      // --- Assertions ---
      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        componentId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Example: Test with event data access
    test('should correctly evaluate rule accessing event data', () => {
      const rule = { '==': [{ var: 'event.payload.value' }, 42] };
      /** @type {GameEvent} */
      const event = { type: 'CUSTOM_EVENT', payload: { value: 42 } };

      const context = createJsonLogicContext(
        event,
        null, // No actor
        null, // No target
        mockEntityManager, // Still needed by context assembler
        mockLogger
      );

      const result = service.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Example: Test with target component access
    test('should correctly evaluate rule accessing target component data', () => {
      const targetId = 'npc1';
      const componentId = 'status';
      const property = 'mood';
      const rule = {
        '==': [
          { var: `target.components.${componentId}.${property}` },
          'happy',
        ],
      };
      /** @type {GameEvent} */
      const event = { type: 'INTERACT', payload: {} };
      const mockTarget = createEntityInstance({ instanceId: targetId });
      const statusComponentData = { mood: 'happy', condition: 'normal' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTarget;
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === targetId && compId === componentId) {
          return statusComponentData;
        }
        return undefined;
      });

      const context = createJsonLogicContext(
        event,
        null, // No actor
        targetId,
        mockEntityManager,
        mockLogger
      );

      const result = service.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test for a more complex rule involving multiple entities or context parts
    test('should evaluate complex rule involving actor, target, and event', () => {
      const actorId = 'hero';
      const targetId = 'villain';
      const actorComponentId = 'inventory';
      const targetComponentId = 'vulnerability';

      const rule = {
        and: [
          {
            '==': [
              { var: `actor.components.${actorComponentId}.has_key` },
              true,
            ],
          },
          {
            '==': [
              { var: `target.components.${targetComponentId}.type` },
              { var: 'event.payload.damage_type' },
            ],
          },
        ],
      };

      /** @type {GameEvent} */
      const event = {
        type: 'ATTACK',
        payload: { damage_type: 'fire' },
      };
      const mockActor = createEntityInstance({ instanceId: actorId });
      const mockTarget = createEntityInstance({ instanceId: targetId });

      const actorInventoryData = { has_key: true, items: ['sword'] };
      const targetVulnerabilityData = { type: 'fire', level: 2 };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        if (id === targetId) return mockTarget;
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorComponentId) {
          return actorInventoryData;
        }
        if (id === targetId && compId === targetComponentId) {
          return targetVulnerabilityData;
        }
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
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorComponentId
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        targetComponentId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test to ensure globals are accessible
    test('should allow access to globals in context', () => {
      const rule = { '==': [{ var: 'globals.game_difficulty' }, 'hard'] };
      const event = { type: 'ANY_EVENT', payload: {} };
      const context = createJsonLogicContext(
        event,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      // Manually add to globals for this test, as contextAssembler sets it up
      context.globals.game_difficulty = 'hard';

      const result = service.evaluate(rule, context);
      expect(result).toBe(true);
    });

    // Test to ensure 'entity_definitions' accessor works if needed (though component accessor is preferred)
    // This depends on how createComponentAccessor makes entities available.
    // If it's direct via entities.actorId.property, this test applies.
    // If only via actor.components.comp.prop, then this test might be less relevant or need adjustment.
    test('should allow access to entity properties directly if supported by accessor (e.g., entity id)', () => {
      // Rule checks actor's ID directly using the `entities` part of the context if available
      const actorId = 'direct_access_actor';
      // This rule structure depends on how the entity accessor proxy exposes direct properties.
      // Assuming a hypothetical `entities.<id>.id` or similar if direct access is different from `actor.id`.
      // The current contextAssembler sets `actor` and `target` which directly give entity objects.
      // So `actor.id` is the standard.
      const rule = { '==': [{ var: 'actor.id' }, actorId] };
      const event = { type: 'ANY_EVENT', payload: {} };
      const mockActor = createEntityInstance({ instanceId: actorId });

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );

      const context = createJsonLogicContext(
        event,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      const result = service.evaluate(rule, context);
      expect(result).toBe(true);
      expect(context.actor.id).toBe(actorId); // Verify context structure
    });
  });

  describe('JSON Logic Validation', () => {
    let service;

    beforeEach(() => {
      mockLogger.error.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear();
      
      const mockGameDataRepository = {
        getConditionDefinition: jest.fn().mockReturnValue(null)
      };
      
      service = new JsonLogicEvaluationService({
        logger: mockLogger,
        gameDataRepository: mockGameDataRepository
      });
    });

    test('should allow valid operations', () => {
      const validRules = [
        { '==': [{ var: 'actor.id' }, 'entity123'] },
        { 'and': [{ '>': [{ var: 'value' }, 5] }, { '<': [{ var: 'value' }, 10] }] },
        { 'or': [{ '==': [{ var: 'type' }, 'npc'] }, { '==': [{ var: 'type' }, 'player'] }] },
        { 'if': [{ var: 'hasItem' }, 'yes', 'no'] },
        { 'in': [{ var: 'item' }, ['sword', 'shield', 'potion']] },
        { '+': [{ var: 'health' }, 10] },
        { 'not': { '==': [{ var: 'status' }, 'dead'] } }
      ];

      const context = {
        actor: { id: 'entity123' },
        value: 7,
        type: 'npc',
        hasItem: true,
        item: 'sword',
        health: 90,
        status: 'alive'
      };

      for (const rule of validRules) {
        const result = service.evaluate(rule, context);
        expect(mockLogger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('JSON Logic validation failed'),
          expect.anything()
        );
      }
    });

    test('should reject disallowed operations', () => {
      // Create object with __proto__ as an actual property key
      const protoRule = Object.create(null);
      protoRule['__proto__'] = {};
      
      const invalidRules = [
        { 'eval': ['dangerous code'] }, // Code execution
        { 'exec': ['rm -rf /'] }, // System commands
        { 'require': ['fs'] }, // Module loading
        protoRule, // Prototype pollution
        { 'constructor': {} }, // Constructor access
        { 'customOp': [1, 2] } // Unknown operation
      ];

      const context = { actor: { id: 'test' } };

      for (const rule of invalidRules) {
        const result = service.evaluate(rule, context);
        
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'JsonLogicEvaluationService: JSON Logic validation failed:',
          expect.any(Error)
        );
        mockLogger.error.mockClear();
      }
    });

    test('should reject deeply nested rules exceeding depth limit', () => {
      // Create a deeply nested rule
      let deepRule = { var: 'value' };
      for (let i = 0; i < 60; i++) {
        deepRule = { 'not': deepRule };
      }

      const context = { value: true };
      const result = service.evaluate(deepRule, context);
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'JsonLogicEvaluationService: JSON Logic validation failed:',
        expect.any(Error)
      );
    });

    test('should detect circular references in JSON Logic structures', () => {
      // Test circular reference detection in the validation
      const circularRule = { 'and': [] };
      // Create a circular reference
      const innerRule = { 'or': [circularRule] };
      circularRule.and.push(innerRule);

      const context = { actor: { id: 'test' } };
      const result = service.evaluate(circularRule, context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'JsonLogicEvaluationService: JSON Logic validation failed:',
        expect.any(Error)
      );
    });

    test('should handle complex nested structures', () => {
      // Test a deeply nested but valid structure
      const complexRule = {
        'and': [
          { '==': [{ var: 'a' }, 1] },
          {
            'or': [
              { '>': [{ var: 'b' }, 5] },
              {
                'and': [
                  { '<': [{ var: 'c' }, 10] },
                  { '!=': [{ var: 'd' }, null] }
                ]
              }
            ]
          }
        ]
      };

      const context = { 
        actor: { id: 'test' },
        a: 1,
        b: 6,
        c: 8,
        d: 'value'
      };
      const result = service.evaluate(complexRule, context);

      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('JsonLogicEvaluationService: JSON Logic validation failed'),
        expect.anything()
      );
    });

    test('should handle null and undefined rules safely', () => {
      const context = { actor: { id: 'test' } };

      // Test null rule
      let result = service.evaluate(null, context);
      expect(result).toBe(false); // Should return false for null

      // Test undefined rule
      result = service.evaluate(undefined, context);
      expect(result).toBe(false); // Should return false for undefined

      // No validation errors should be logged for null/undefined
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('JsonLogicEvaluationService: JSON Logic validation failed'),
        expect.anything()
      );
    });

    test('should validate nested operations correctly', () => {
      const nestedRule = {
        'and': [
          { '==': [{ var: 'actor.type' }, 'player'] },
          {
            'or': [
              { '>': [{ var: 'actor.level' }, 10] },
              { 'in': [{ var: 'actor.class' }, ['warrior', 'mage']] }
            ]
          },
          {
            'not': {
              '==': [{ var: 'actor.status' }, 'banned']
            }
          }
        ]
      };

      const context = {
        actor: {
          id: 'player123',
          type: 'player',
          level: 15,
          class: 'warrior',
          status: 'active'
        }
      };

      const result = service.evaluate(nestedRule, context);
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('JsonLogicEvaluationService: JSON Logic validation failed'),
        expect.anything()
      );
    });

    test('should allow condition_ref as it is whitelisted', () => {
      const ruleWithConditionRef = {
        'condition_ref': 'some_condition_id'
      };

      const context = { actor: { id: 'test' } };
      
      // Even though the condition_ref won't resolve (mock returns null),
      // the validation should pass
      const result = service.evaluate(ruleWithConditionRef, context);
      
      // Check that validation didn't fail
      const validationErrorCalls = mockLogger.error.mock.calls.filter(
        call => call[0] && call[0].includes('JSON Logic validation failed')
      );
      expect(validationErrorCalls.length).toBe(0);
    });

    test('should validate arrays of rules', () => {
      const arrayRule = [
        { '==': [1, 1] },
        { '>': [5, 3] },
        { 'var': 'someValue' }
      ];

      const context = { someValue: 42 };
      
      // Arrays themselves aren't operations, but their contents should be validated
      const result = service.evaluate(arrayRule, context);
      
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('JsonLogicEvaluationService: JSON Logic validation failed'),
        expect.anything()
      );
    });
  });
});

// Example of a default dummy definition ID that could be shared
const DEFAULT_MOCK_DEF_ID = 'test:default-mock-def';

// Helper if createMockEntity is needed globally in this file (outside the E2E describe)
// const createGlobalMockEntity = (instanceId, definitionId = DEFAULT_MOCK_DEF_ID, initialComponents = {}) => {
//   const defIdToUse = definitionId.includes(':') ? definitionId : `test:${definitionId}`;
//   const genericDefinition = new EntityDefinition(defIdToUse, { components: {} });
//   const instanceData = new EntityInstanceData(instanceId, genericDefinition, initialComponents);
//   return new Entity(instanceData);
// };
