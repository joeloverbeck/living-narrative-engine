// src/tests/logic/jsonLogicPatterns.component.e2e.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed
import { createJsonLogicContext } from '../../../src/logic/contextAssembler.js'; // Adjust path
import Entity from '../../../src/entities/entity.js'; // Adjust path - Needed for mock setup
import EntityDefinition from '../../../src/entities/entityDefinition.js'; // Added
import EntityInstanceData from '../../../src/entities/entityInstanceData.js'; // Added
import { createEntityInstance } from '../../common/entities/index.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */ // Import type for mocking

// --- Mock Dependencies ---

// Mock ILogger (Required by Service and Context Assembler)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Minimal mock for the required game data repository dependency
const mockGameDataRepository = {
  getConditionDefinition: jest.fn(),
};

// Mock EntityManager (Required by Context Assembler)
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
  // Added for completeness with new EntityManager structure
  _definitionCache: new Map(),
};

const DUMMY_DEFINITION_ID_FOR_MOCKS = 'def:mock-component-patterns';

// Helper to create mock entity instance for tests

// --- Test Suite ---

describe('JsonLogicEvaluationService - Component Patterns (TEST-105)', () => {
  let service;
  const actorId = 'testActor:p1';
  const targetId = 'testTarget:p1';
  const mockActor = createEntityInstance({ instanceId: actorId });
  const mockTarget = createEntityInstance({ instanceId: targetId });
  const compAId = 'compA'; // Generic component for tests
  const compBId = 'compB'; // Another generic component

  /** @type {GameEvent} */
  const baseEvent = { type: 'PATTERN_TEST', payload: {} };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Instantiate the service with the mock logger
    // Uses the REAL json-logic-js library and REAL createJsonLogicContext
    service = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });
    mockLogger.info.mockClear(); // Clear constructor log call

    // Reset EntityManager mocks
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Default mock implementations: Entities exist, components do not by default
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === actorId) return mockActor;
      if (id === targetId) return mockTarget;
      return undefined;
    });
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => undefined
    );
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );
  });

  // --- AC1: Pattern 1 (Component Existence Check) ---
  describe('AC1: Pattern 1 - Existence Check {"!!": {"var": "..."}}', () => {
    const rule = { '!!': { var: `actor.components.${compAId}` } };
    const targetRule = { '!!': { var: `target.components.${compAId}` } };

    test('should return true when actor component exists', () => {
      const compAData = { prop: 'value' };
      // Setup: Actor has compA
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === compAId) return compAData;
        return undefined;
      });

      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      const result = service.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        compAId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return false when actor component is missing', () => {
      // Setup: Actor does NOT have compA (default mock behavior)
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      const result = service.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        compAId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return true when target component exists (Target Example)', () => {
      const compAData = { prop: 'target value' };
      // Setup: Target has compA
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === targetId && compId === compAId) return compAData;
        return undefined;
      });

      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      const result = service.evaluate(targetRule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        compAId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should return false when target component is missing (Target Example)', () => {
      // Setup: Target does NOT have compA (default mock behavior)
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      const result = service.evaluate(targetRule, context);

      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        compAId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  // --- AC2: Pattern 2 (Numeric Comparison) ---
  describe('AC2: Pattern 2 - Numeric Comparison', () => {
    // Test case: {"<=": [{"var": "target.components.health.current"}, 0]}
    describe('Rule: {"<=": [{"var": "target.components.health.current"}, 0]}', () => {
      const rule = { '<=': [{ var: 'target.components.health.current' }, 0] };
      const healthCompId = 'health';
      const healthProp = 'current';

      test('should return true when value <= 0 (e.g., -10)', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === healthCompId)
            return { [healthProp]: -10 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return true when value <= 0 (e.g., 0)', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === healthCompId)
            return { [healthProp]: 0 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value > 0 (e.g., 100)', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === healthCompId)
            return { [healthProp]: 100 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      // --- CORRECTED TEST ---
      test('should return true when property "current" is missing (null <= 0 is true)', () => {
        // Updated description and expectation
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === healthCompId) return { max: 100 }; // Missing 'current'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // JsonLogic 'var' resolves missing property to null.
        // json-logic-js treats null as 0 in <= comparison, so null <= 0 becomes 0 <= 0 -> true.
        expect(service.evaluate(rule, context)).toBe(true); // Changed expectation to true
      });

      // --- CORRECTED TEST ---
      test('should return true when component "health" is missing (null <= 0 is true)', () => {
        // Updated description and expectation
        // Default mock behavior: getComponentData returns undefined
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // JsonLogic 'var' resolves missing component path to null.
        // json-logic-js treats null as 0 in <= comparison, so null <= 0 becomes 0 <= 0 -> true.
        expect(service.evaluate(rule, context)).toBe(true); // Changed expectation to true
      });
    });

    // Test case: {">": [{"var": "actor.components.inv.gold"}, 5]}
    describe('Rule: {">": [{"var": "actor.components.inv.gold"}, 5]}', () => {
      const rule = { '>': [{ var: 'actor.components.inv.gold' }, 5] };
      const invCompId = 'inv';
      const goldProp = 'gold';

      test('should return true when value > 5 (e.g., 10)', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId) return { [goldProp]: 10 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value = 5', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId) return { [goldProp]: 5 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when value < 5 (e.g., 3)', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId) return { [goldProp]: 3 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when property "gold" is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId) return { items: {} }; // Missing 'gold'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // null > 5 is false
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when component "inv" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // null > 5 is false
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });

    // Test case: {">=": [{"var": "context.rollResult"}, 10]}
    describe('Rule: {">=": [{"var": "context.rollResult"}, 10]}', () => {
      const rule = { '>=': [{ var: 'context.rollResult' }, 10] };

      test('should return true when context value >= 10 (e.g., 15)', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          null,
          mockEntityManager,
          mockLogger
        );
        context.context.rollResult = 15; // Manually add context variable
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return true when context value >= 10 (e.g., 10)', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          null,
          mockEntityManager,
          mockLogger
        );
        context.context.rollResult = 10; // Manually add context variable
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when context value < 10 (e.g., 9)', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          null,
          mockEntityManager,
          mockLogger
        );
        context.context.rollResult = 9; // Manually add context variable
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when context variable is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          null,
          mockEntityManager,
          mockLogger
        );
        // context.context.rollResult is not set
        // null >= 10 is false
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });
  });

  // --- AC3: Pattern 3 (String Comparison) ---
  describe('AC3: Pattern 3 - String Comparison {"==": [{"var": "..."}, "..."]}', () => {
    // Test case: {"==": [{"var": "target.components.lock.state"}, "locked"]}
    describe('Rule: {"==": [{"var": "target.components.lock.state"}, "locked"]}', () => {
      const rule = {
        '==': [{ var: 'target.components.lock.state' }, 'locked'],
      };
      const lockCompId = 'lock';
      const stateProp = 'state';

      test('should return true when value is "locked"', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === lockCompId)
            return { [stateProp]: 'locked' };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value is "unlocked"', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === lockCompId)
            return { [stateProp]: 'unlocked' };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when property "state" is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === lockCompId)
            return { keyType: 'iron' }; // Missing 'state'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // null == "locked" is false
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when component "lock" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // null == "locked" is false
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });

    // Test case: {"==": [{"var": "actor.components.class.id"}, "mage"]}
    describe('Rule: {"==": [{"var": "actor.components.class.id"}, "mage"]}', () => {
      const rule = { '==': [{ var: 'actor.components.class.id' }, 'mage'] };
      const classCompId = 'class';
      const idProp = 'id';

      test('should return true when value is "mage"', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === classCompId)
            return { [idProp]: 'mage', level: 5 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value is "warrior"', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === classCompId)
            return { [idProp]: 'warrior', level: 5 };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when property "id" is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === classCompId) return { level: 5 }; // Missing 'id'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // null == "mage" is false
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when component "class" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // null == "mage" is false
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });
  });

  // --- AC4: Pattern 4 (Boolean Check) ---
  describe('AC4: Pattern 4 - Boolean Check', () => {
    // Test case: {"==": [{"var": "target.components.door.isOpen"}, true]}
    describe('Rule: {"==": [{"var": "target.components.door.isOpen"}, true]}', () => {
      const rule = { '==': [{ var: 'target.components.door.isOpen' }, true] };
      const doorCompId = 'door';
      const isOpenProp = 'isOpen';

      test('should return true when value is true', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === doorCompId)
            return { [isOpenProp]: true };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value is false', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === doorCompId)
            return { [isOpenProp]: false };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when property "isOpen" is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === doorCompId)
            return { color: 'brown' }; // Missing 'isOpen'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // null == true is false
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when component "door" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // null == true is false
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });

    // Test case: { "var": "target.components.door.isOpen"} (shorthand)
    describe('Rule: { "var": "target.components.door.isOpen"} (Shorthand)', () => {
      const rule = { var: 'target.components.door.isOpen' };
      const doorCompId = 'door';
      const isOpenProp = 'isOpen';

      test('should return true when value is true', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === doorCompId)
            return { [isOpenProp]: true };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value is false', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === doorCompId)
            return { [isOpenProp]: false };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when property "isOpen" is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === targetId && compId === doorCompId)
            return { color: 'brown' }; // Missing 'isOpen'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, which is falsy
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when component "door" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          targetId,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, which is falsy
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });

    // Test case: {"var": "actor.components.hidden.isActive"}
    describe('Rule: {"var": "actor.components.hidden.isActive"}', () => {
      const rule = { var: 'actor.components.hidden.isActive' };
      const hiddenCompId = 'hidden';
      const isActiveProp = 'isActive';

      test('should return true when value is true', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === hiddenCompId)
            return { [isActiveProp]: true };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when value is false', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === hiddenCompId)
            return { [isActiveProp]: false };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when property "isActive" is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === hiddenCompId)
            return { duration: 10 }; // Missing 'isActive'
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, which is falsy
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when component "hidden" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, which is falsy
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });
  });

  // --- AC5: Pattern 5 (Simplified Item Check - Component/Property Existence) ---
  describe('AC5: Pattern 5 - Simplified Item Check {"!!": {"var": "..."}}', () => {
    // Test case: {"!!": {"var": "actor.components.quest_item_key"}}
    describe('Rule: {"!!": {"var": "actor.components.quest_item_key"}}', () => {
      const rule = { '!!': { var: 'actor.components.quest_item_key' } };
      const questKeyCompId = 'quest_item_key';

      test('should return true when component "quest_item_key" exists', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === questKeyCompId) return { uses: 1 }; // Data exists
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when component "quest_item_key" is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });

    // Test case: {"!!": {"var": "actor.components.inv.items.orb"}}
    describe('Rule: {"!!": {"var": "actor.components.inv.items.orb"}}', () => {
      const rule = { '!!': { var: 'actor.components.inv.items.orb' } };
      const invCompId = 'inv';

      test('should return true when the full path exists (inv.items.orb)', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId)
            return {
              gold: 50,
              items: {
                key: { id: 'key_01' },
                orb: { id: 'orb_of_light', charges: 3 }, // Orb exists
              },
            };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        expect(service.evaluate(rule, context)).toBe(true);
      });

      test('should return false when the final property ("orb") is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId)
            return {
              gold: 50,
              items: {
                key: { id: 'key_01' }, // Orb is missing
              },
            };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, !!null is false
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when an intermediate property ("items") is missing', () => {
        mockEntityManager.getComponentData.mockImplementation((id, compId) => {
          if (id === actorId && compId === invCompId)
            return {
              gold: 50, // 'items' property is missing
            };
          return undefined;
        });
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, !!null is false
        expect(service.evaluate(rule, context)).toBe(false);
      });

      test('should return false when the component ("inv") is missing', () => {
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        // var resolves to null, !!null is false
        expect(service.evaluate(rule, context)).toBe(false);
      });
    });
  });
}); // End describe JsonLogicEvaluationService - Component Patterns (TEST-105)
