// src/tests/logic/jsonLogicPatterns.entityState.e2e.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js'; // Adjust path if needed
import { createJsonLogicContext } from '../../../src/logic/contextAssembler.js'; // Adjust path if needed
import Entity from '../../../src/entities/entity.js'; // Adjust path if needed for mock creation
import EntityDefinition from '../../../src/entities/entityDefinition.js'; // Added
import EntityInstanceData from '../../../src/entities/entityInstanceData.js'; // Added
import { createEntityInstance } from '../../common/entities/index.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjusted path
/** @typedef {import('../../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjusted path
/** @typedef {import('../../../src/logic/defs.js').GameEvent} GameEvent */ // Adjusted path
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */ // Adjusted path

// --- Mock Dependencies ---

// Mock ILogger (Required by Service and Context Assembler)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager (Required by Context Assembler)
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // --- Core methods used by Context Assembler ---
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(), // Needed by component accessor proxy
  hasComponent: jest.fn(), // Needed by component accessor proxy

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

const DUMMY_DEFINITION_ID_FOR_MOCKS = 'def:mock-entity-state';

// --- Test Suite ---

describe('TEST-108: Validate JSON-LOGIC-PATTERNS.MD - Entity/Context State Patterns (10-11)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;
  /** @type {GameEvent} */
  const baseEvent = { type: 'test_event', payload: {} }; // A basic event for context creation

  // --- Test Setup ---
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Instantiate the JsonLogicEvaluationService with mock logger
    // This uses the *real* json-logic-js library internally
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    mockLogger.info.mockClear(); // Clear constructor log call if any

    // Reset EntityManager mocks to a clean default state for each test
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Default mock implementations (can be overridden in specific tests)
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    ); // Default: entity not found
  });

  // --- Acceptance Criteria Tests ---

  // AC1: Pattern 10 (Target ID Check)
  describe('AC1: Pattern 10 - Target ID Check {"==": [{"var": "target.id"}, "npc:shopkeeper"]}', () => {
    const rule = { '==': [{ var: 'target.id' }, 'npc:shopkeeper'] };
    const targetId = 'npc:shopkeeper';
    const otherTargetId = 'npc:guard';
    const mockShopkeeper = createEntityInstance({ instanceId: targetId });
    const mockGuard = createEntityInstance({ instanceId: otherTargetId });

    test('should evaluate true when targetId matches and entity exists', () => {
      // Arrange: EM finds the specific target
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockShopkeeper;
        return undefined;
      });
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(context.target).not.toBeNull(); // Ensure target object was created
      expect(context.target.id).toBe(targetId); // Verify the context structure
    });

    test('should evaluate false when targetId differs (but entity exists)', () => {
      // Arrange: EM finds a *different* target
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === otherTargetId) return mockGuard;
        return undefined;
      });
      const context = createJsonLogicContext(
        baseEvent,
        null,
        otherTargetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // "npc:guard" == "npc:shopkeeper" -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        otherTargetId
      );
      expect(context.target).not.toBeNull();
      expect(context.target.id).toBe(otherTargetId);
    });

    test('should evaluate false when targetId is null (target is null)', () => {
      // Arrange: No targetId provided
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      // context.target will be null

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null == "npc:shopkeeper" -> false
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(context.target).toBeNull();
    });

    test('should evaluate false when targetId matches but entity is not found', () => {
      // Arrange: EM does *not* find the target despite being asked
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      // context.target will be null because EM returned undefined

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null == "npc:shopkeeper" -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(context.target).toBeNull();
    });
  });

  // AC2: Pattern 10 (Actor ID Check)
  describe('AC2: Pattern 10 - Actor ID Check {"==": [{"var": "actor.id"}, "core:player"]}', () => {
    const rule = { '==': [{ var: 'actor.id' }, 'core:player'] };
    const actorId = 'core:player';
    const otherActorId = 'npc:ally';
    const mockPlayer = createEntityInstance({ instanceId: actorId });
    const mockAlly = createEntityInstance({ instanceId: otherActorId });

    test('should evaluate true when actorId matches and entity exists', () => {
      // Arrange: EM finds the specific actor
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockPlayer;
        return undefined;
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
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe(actorId);
    });

    test('should evaluate false when actorId differs (but entity exists)', () => {
      // Arrange: EM finds a *different* actor
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === otherActorId) return mockAlly;
        return undefined;
      });
      const context = createJsonLogicContext(
        baseEvent,
        otherActorId,
        null,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // "npc:ally" == "core:player" -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        otherActorId
      );
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe(otherActorId);
    });

    test('should evaluate false when actorId is null (actor is null)', () => {
      // Arrange: No actorId provided
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      // context.actor will be null

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null == "core:player" -> false
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(context.actor).toBeNull();
    });

    test('should evaluate false when actorId matches but entity is not found', () => {
      // Arrange: EM does *not* find the actor despite being asked
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      // context.actor will be null because EM returned undefined

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null == "core:player" -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(context.actor).toBeNull();
    });
  });

  // AC3: Pattern 11 (Target Existence Check)
  describe('AC3: Pattern 11 - Target Existence Check {"!=": [{"var": "target"}, null]}', () => {
    const rule = { '!=': [{ var: 'target' }, null] };
    const targetId = 'item:chest';
    const mockTarget = createEntityInstance({ instanceId: targetId });

    test('should evaluate true when targetId resolves to an entity', () => {
      // Arrange: EM finds the target
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTarget;
        return undefined;
      });
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(true); // context.target is an object -> object != null -> true
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(context.target).not.toBeNull();
    });

    test('should evaluate false when targetId is null', () => {
      // Arrange: No targetId provided
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      // context.target will be null

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null != null -> false
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(context.target).toBeNull();
    });

    test('should evaluate false when targetId is provided but entity not found', () => {
      // Arrange: EM does *not* find the target
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      // context.target will be null because EM returned undefined

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null != null -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(context.target).toBeNull();
    });
  });

  // AC4: Pattern 11 (Actor Existence Check)
  describe('AC4: Pattern 11 - Actor Existence Check {"!=": [{"var": "actor"}, null]}', () => {
    const rule = { '!=': [{ var: 'actor' }, null] };
    const actorId = 'core:player';
    const mockActor = createEntityInstance({ instanceId: actorId });

    test('should evaluate true when actorId resolves to an entity', () => {
      // Arrange: EM finds the actor
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        return undefined;
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
      expect(result).toBe(true); // context.actor is an object -> object != null -> true
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(context.actor).not.toBeNull();
    });

    test('should evaluate false when actorId is null', () => {
      // Arrange: No actorId provided
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      // context.actor will be null

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null != null -> false
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(context.actor).toBeNull();
    });

    test('should evaluate false when actorId is provided but entity not found', () => {
      // Arrange: EM does *not* find the actor
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      // context.actor will be null because EM returned undefined

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // null != null -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(context.actor).toBeNull();
    });
  });
}); // End describe TEST-108
