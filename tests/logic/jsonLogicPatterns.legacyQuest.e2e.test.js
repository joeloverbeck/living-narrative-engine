// src/tests/logic/jsonLogicPatterns.legacyQuest.e2e.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js'; // Adjust path as needed
import Entity from '../../src/entities/entity.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {object} JSONLogicRule */
 * @property

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn((...args) => console.error('<<<< LOGGER ERROR >>>>', ...args)), // Print errors
  debug: jest.fn(),
};

// Mock EntityManager
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(), // Although 'in' doesn't rely on 'has', keep mock consistent
  // Dummy implementations for other potential EM methods
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Helper to create mock entity instance
const createMockEntity = (id) => {
  const entity = new Entity(id, 'dummy');
  return entity;
};

// --- Test Suite ---

describe('TEST-110: Validate JSON-LOGIC-PATTERNS.MD - Legacy Quest State (Pattern 15)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;
  /** @type {GameEvent} */
  const baseEvent = { type: 'test_event', payload: {} };
  const actorId = 'player:1';
  const questLogComponentId = 'core:quest_log'; // Component ID from pattern example
  const mockActor = createMockEntity(actorId);

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    // Reset mocks to default state (entity not found, component data null)
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset(); // Reset just in case
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => null
    );
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );

    // Default setup: Actor entity exists
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      id === actorId ? mockActor : undefined
    );
  });

  // --- AC1: Pattern 15 (Quest Active - in) ---
  describe('AC1: Pattern 15 - Quest Active Check (in)', () => {
    const questIdToCheck = 'quest_1';
    const rule = {
      in: [
        questIdToCheck,
        { var: `actor.components.${questLogComponentId}.active_quests` },
      ],
    };

    test('should evaluate TRUE when quest IS in active_quests array', () => {
      // Arrange: Mock quest log with quest_1 active
      const mockQuestLogData = {
        active_quests: ['quest_0', 'quest_1', 'quest_5'],
        completed_quests: ['quest_3'],
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate FALSE when quest is NOT in active_quests array', () => {
      // Arrange: Mock quest log without quest_1 active
      const mockQuestLogData = {
        active_quests: ['quest_0', 'quest_5'], // quest_1 missing
        completed_quests: ['quest_3'],
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate FALSE when active_quests array is empty', () => {
      // Arrange: Mock quest log with empty active_quests
      const mockQuestLogData = {
        active_quests: [],
        completed_quests: ['quest_3'],
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate FALSE when active_quests property is missing', () => {
      // Arrange: Mock quest log data without the active_quests property
      const mockQuestLogData = {
        // active_quests property deliberately missing
        completed_quests: ['quest_3'],
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `actor.components.core:quest_log.active_quests` resolves to undefined.
      // `in` operator returns false when the second argument is not an array/string.
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate FALSE when quest_log component is missing', () => {
      // Arrange: Default mock EM setup returns null for getComponentData
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `actor.components.core:quest_log` resolves to null.
      // Accessing `.active_quests` on null within `var` resolves to null.
      // `in` operator returns false when the second argument is null.
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate FALSE when actor is missing', () => {
      // Arrange: Override default setup - actor entity not found
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `actor` is null in context. `var` resolves to null.
      // `in` operator returns false when the second argument is null.
      expect(result).toBe(false);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      // getComponentData should NOT be called as actor context is null
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  // --- AC2: Pattern 15 (Quest Not Completed - ! in) ---
  describe('AC2: Pattern 15 - Quest Not Completed Check (! in)', () => {
    const questIdToCheck = 'quest_2';
    const rule = {
      '!': {
        in: [
          questIdToCheck,
          { var: `actor.components.${questLogComponentId}.completed_quests` },
        ],
      },
    };

    test('should evaluate TRUE when quest is NOT in completed_quests array', () => {
      // Arrange: Mock quest log without quest_2 completed
      const mockQuestLogData = {
        active_quests: ['quest_1'],
        completed_quests: ['quest_3', 'quest_4'], // quest_2 missing
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `in` returns false, `!` makes it true
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate FALSE when quest IS in completed_quests array', () => {
      // Arrange: Mock quest log with quest_2 completed
      const mockQuestLogData = {
        active_quests: ['quest_1'],
        completed_quests: ['quest_2', 'quest_3'], // quest_2 present
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `in` returns true, `!` makes it false
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate TRUE when completed_quests array is empty', () => {
      // Arrange: Mock quest log with empty completed_quests
      const mockQuestLogData = {
        active_quests: ['quest_1'],
        completed_quests: [],
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `in` returns false, `!` makes it true
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate TRUE when completed_quests property is missing', () => {
      // Arrange: Mock quest log data without the completed_quests property
      const mockQuestLogData = {
        active_quests: ['quest_1'],
        // completed_quests property deliberately missing
      };
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === questLogComponentId) {
          return mockQuestLogData;
        }
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `actor.components.core:quest_log.completed_quests` resolves to undefined.
      // `in` operator returns false. `!` makes it true.
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate TRUE when quest_log component is missing', () => {
      // Arrange: Default mock EM setup returns null for getComponentData
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `actor.components.core:quest_log` resolves to null.
      // Accessing `.completed_quests` on null within `var` resolves to null.
      // `in` operator returns false. `!` makes it true.
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        questLogComponentId
      );
    });

    test('should evaluate TRUE when actor is missing', () => {
      // Arrange: Override default setup - actor entity not found
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // `actor` is null in context. `var` resolves to null.
      // `in` operator returns false. `!` makes it true.
      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      // getComponentData should NOT be called as actor context is null
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });
}); // End describe TEST-110
