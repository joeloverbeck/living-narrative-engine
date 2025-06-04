// src/tests/logic/jsonLogicPatterns.compound.e2e.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path if needed
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js'; // Adjust path if needed
import Entity from '../../src/entities/entity.js'; // Adjust path if needed for mock creation

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjusted path
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjusted path
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */ // Adjusted path
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Adjusted path

// --- Mock Dependencies ---

// Mock ILogger (Required by Service and Context Assembler)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn((...args) => console.error('<<<< LOGGER ERROR >>>>', ...args)), // Make it print!
  debug: jest.fn(),
};

// Mock EntityManager (Required by Context Assembler)
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  // --- Core methods used by Context Assembler & Component Accessor ---
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(), // Keep the mock, even if not used by this specific rule

  // --- Dummy implementations for other potential EM methods ---
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Helper to create mock entity instance for tests
const createMockEntity = (id) => {
  const entity = new Entity(id, 'dummy');
  return entity;
};

// --- Test Suite ---

describe('TEST-109: Validate JSON-LOGIC-PATTERNS.MD - Compound Logic (Patterns 12-14)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;
  /** @type {GameEvent} */
  const baseEvent = { type: 'test_event', payload: {} };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    mockLogger.info.mockClear();
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => null
    );
  });

  // AC1: Pattern 12 (AND - Lockable)
  describe('AC1: Pattern 12 - AND Lockable', () => {
    const rule = {
      and: [
        { '!!': { var: 'target.components.game:lockable' } },
        { '==': [{ var: 'target.components.game:lockable.state' }, 'locked'] },
      ],
    };
    const targetId = 'door:1';
    const componentId = 'game:lockable';
    const mockTarget = createMockEntity(targetId);
    const lockedState = { state: 'locked' };
    const unlockedState = { state: 'unlocked' };

    test('should evaluate TRUE when target exists, component exists, AND state is "locked"', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      // No need to mock hasComponent for this rule path
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        // Both parts of the 'and' rule access the component via 'var'
        if (id === targetId && compId === componentId) {
          return lockedState;
        }
        return null;
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
      // Verify getComponentData was called (by the 'var' operations)
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      );
      // It might be called twice (once for `!!` check, once for `==` check's state access)
      // We can check it was called at least once.
      expect(
        mockEntityManager.getComponentData.mock.calls.length
      ).toBeGreaterThanOrEqual(1);
    });

    test('should evaluate FALSE when target exists, component exists, BUT state is NOT "locked"', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      // No need to mock hasComponent for this rule path
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === targetId && compId === componentId) {
          return unlockedState; // Component exists but is unlocked
        }
        return null;
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
      expect(result).toBe(false);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      // Verify getComponentData was called
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      );
      expect(
        mockEntityManager.getComponentData.mock.calls.length
      ).toBeGreaterThanOrEqual(1); // Called for component access
    });

    test('should evaluate FALSE when target exists BUT component is missing', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      // getComponentData will return default null (simulating missing component)
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
      expect(result).toBe(false); // First condition `{"!!": null}` becomes false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      // Verify getComponentData was called by the first 'var' access
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      );
      // Should only be called once due to short-circuiting
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
      // hasComponent should NOT have been called by this rule
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    // This test remains the same as hasComponent/getComponentData aren't called when target is null
    test('should evaluate FALSE when target entity is missing', () => {
      // Arrange
      // Mocks default to entity not found
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
      expect(result).toBe(false);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  // --- Other AC describe blocks (AC2 to AC6) ---
  // Assuming the assertions in AC2-AC6 might need similar review
  // if they incorrectly rely on hasComponent for `!!` checks.
  // Let's re-evaluate AC2's first test as an example:

  // AC2: Pattern 12 (AND - Key/Door)
  describe('AC2: Pattern 12 - AND Key/Door', () => {
    const rule = {
      and: [
        { '!!': { var: 'actor.components.game:quest_item_key' } }, // Uses !! var
        { '==': [{ var: 'target.id' }, 'blocker:main_gate_door'] },
        { '==': [{ var: 'target.components.game:lockable.state' }, 'locked'] }, // Uses var
      ],
    };
    const actorId = 'core:player';
    const targetId = 'blocker:main_gate_door';
    const otherTargetId = 'door:side_entrance';
    const actorKeyComp = 'game:quest_item_key';
    const targetLockComp = 'game:lockable';

    const mockActor = createMockEntity(actorId);
    const mockTargetDoor = createMockEntity(targetId);
    const mockOtherDoor = createMockEntity(otherTargetId);
    const lockedState = { state: 'locked' };
    const unlockedState = { state: 'unlocked' };

    test('should evaluate TRUE when all conditions are met', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        if (id === targetId) return mockTargetDoor;
        return undefined;
      });
      // No need to mock hasComponent for this rule path
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorKeyComp)
          return { desc: 'A shiny key' }; // For !! var check
        if (id === targetId && compId === targetLockComp) return lockedState; // For == var check
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      // Check getComponentData was called for both component accesses via 'var'
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorKeyComp
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        targetLockComp
      );
      // hasComponent should NOT have been called by this rule
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    // --- Other tests in AC2 ---
    test('should evaluate FALSE when actor is missing the key component', () => {
      // Arrange: Actor exists but NO key component data
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        if (id === targetId) return mockTargetDoor;
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorKeyComp) return null; // Key component missing (getComponentData returns null)
        if (id === targetId && compId === targetLockComp) return lockedState;
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // First condition `{"!!": null}` is false
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorKeyComp
      ); // getComponentData was called for the check
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1); // Short-circuited
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled(); // hasComponent not called
    });

    // Rest of AC2 tests... ensure assertions match the logic (check getComponentData where `var` is used)

    test('should evaluate FALSE when target ID does not match', () => {
      // Arrange: Actor has key, Target ID is WRONG
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        if (id === otherTargetId) return mockOtherDoor; // Found the *wrong* target
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorKeyComp)
          return { desc: 'A shiny key' };
        // State of other door doesn't matter due to ID check failing first
        if (id === otherTargetId && compId === targetLockComp)
          return lockedState;
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        otherTargetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // Second condition {"==": ["door:side_entrance", "blocker:main_gate_door"]} is false
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorKeyComp
      ); // First part called
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1); // Short-circuited before target component check
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when target exists, ID matches, but state is not "locked"', () => {
      // Arrange: Actor has key, Target ID matches, Target is UNLOCKED
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        if (id === targetId) return mockTargetDoor;
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorKeyComp)
          return { desc: 'A shiny key' };
        if (id === targetId && compId === targetLockComp) return unlockedState; // Target is unlocked
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // Third condition {"==": ["unlocked", "locked"]} is false
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorKeyComp
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        targetLockComp
      ); // Both checks performed
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when target exists, ID matches, but lock component is missing', () => {
      // Arrange: Actor has key, Target ID matches, Target has NO lock component data
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        if (id === targetId) return mockTargetDoor;
        return undefined;
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorKeyComp)
          return { desc: 'A shiny key' };
        if (id === targetId && compId === targetLockComp) return null; // Lock component missing
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      // Third condition: `target.components.game:lockable.state` resolves to null.
      // `{"==": [null, "locked"]}` evaluates to false.
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorKeyComp
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        targetLockComp
      ); // Both checks performed
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when target entity is missing', () => {
      // Arrange: Actor has key, Target entity does NOT exist
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActor;
        return undefined; // Target not found
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === actorKeyComp)
          return { desc: 'A shiny key' };
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // Second condition `{"==": [null, ... ]}` is false
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        actorKeyComp
      ); // First part called
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1); // Short-circuited
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when actor entity is missing', () => {
      // Arrange: Actor entity does NOT exist
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTargetDoor; // Target exists
        return undefined; // Actor not found
      });
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        // Actor component check won't happen via getComponentData if actor is null
        if (id === targetId && compId === targetLockComp) return lockedState;
        return null;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // Act
      const result = service.evaluate(rule, context);

      // Assert
      expect(result).toBe(false); // First condition `{"!!": null}` is false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId); // Attempted to get actor
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // Not called because actor was null
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });
  });

  // AC3: Pattern 13 (OR - Status)
  describe('AC3: Pattern 13 - OR Status', () => {
    const rule = {
      or: [
        { '!!': { var: 'actor.components.effect:poison' } }, // Uses !! var
        { '!!': { var: 'actor.components.effect:disease' } }, // Uses !! var
      ],
    };
    const actorId = 'core:player';
    const poisonComp = 'effect:poison';
    const diseaseComp = 'effect:disease';
    const mockActor = createMockEntity(actorId);

    test('should evaluate TRUE if actor has poison component ONLY', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === poisonComp) return { ticks: 3 }; // Has poison data
        if (id === actorId && compId === diseaseComp) return null; // No disease data
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
        poisonComp
      ); // Called for poison check
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1); // Short-circuited
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE if actor has disease component ONLY', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === poisonComp) return null; // No poison data
        if (id === actorId && compId === diseaseComp) return { severity: 1 }; // Has disease data
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
        poisonComp
      ); // Called for poison check (returns null)
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        diseaseComp
      ); // Called for disease check
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE if actor has BOTH poison and disease components', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === actorId && compId === poisonComp) return { ticks: 3 };
        if (id === actorId && compId === diseaseComp) return { severity: 1 };
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
        poisonComp
      ); // Called for poison check
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1); // Short-circuited
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE if actor has NEITHER poison nor disease component', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );
      // getComponentData returns default null
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
        poisonComp
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        diseaseComp
      );
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE if actor entity is missing', () => {
      // Arrange
      // getEntityInstance returns default undefined
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
      expect(result).toBe(false); // {"!!": null} or {"!!": null} -> false
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });
  });

  // AC4: Pattern 14 (NOT - Lockable)
  describe('AC4: Pattern 14 - NOT Lockable', () => {
    const rule = {
      '!': {
        '==': [{ var: 'target.components.game:lockable.state' }, 'locked'], // Uses var
      },
    };
    const targetId = 'chest:1';
    const componentId = 'game:lockable';
    const mockTarget = createMockEntity(targetId);
    const lockedState = { state: 'locked' };
    const unlockedState = { state: 'unlocked' };
    const jammedState = { state: 'jammed' };

    test('should evaluate TRUE when target state is NOT "locked" (e.g., "unlocked")', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === targetId && compId === componentId ? unlockedState : null
      );
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
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when target state is NOT "locked" (e.g., "jammed")', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === targetId && compId === componentId ? jammedState : null
      );
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
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when target state IS "locked"', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === targetId && compId === componentId ? lockedState : null
      );
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
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when component is missing', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      // getComponentData returns default null
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
      // `target.components.game:lockable.state` -> null. {"==": [null, "locked"]} -> false. {"not": false} -> true.
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when target entity is missing', () => {
      // Arrange
      // getEntityInstance returns default undefined
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
      // `target.components.game:lockable.state` -> null. {"==": [null, "locked"]} -> false. {"not": false} -> true.
      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });
  });

  // AC5: Pattern 14 (NOT - Alternative)
  describe('AC5: Pattern 14 - NOT Alternative', () => {
    const rule = {
      '!=': [{ var: 'target.components.game:lockable.state' }, 'locked'], // Uses var
    };
    // Variables and states defined as in AC4...
    const targetId = 'chest:1';
    const componentId = 'game:lockable';
    const mockTarget = createMockEntity(targetId);
    const lockedState = { state: 'locked' };
    const unlockedState = { state: 'unlocked' };
    const jammedState = { state: 'jammed' };

    test('should evaluate TRUE when target state is NOT "locked" (e.g., "unlocked")', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === targetId && compId === componentId ? unlockedState : null
      );
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
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when target state is NOT "locked" (e.g., "jammed")', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === targetId && compId === componentId ? jammedState : null
      );
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
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when target state IS "locked"', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === targetId && compId === componentId ? lockedState : null
      );
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
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when component is missing', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTarget : undefined
      );
      // getComponentData returns default null
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
      // `target.components.game:lockable.state` -> null. {"!=": [null, "locked"]} -> true.
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when target entity is missing', () => {
      // Arrange
      // getEntityInstance returns default undefined
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
      // `target.components.game:lockable.state` -> null. {"!=": [null, "locked"]} -> true.
      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });
  });

  // AC6: Pattern 14 (NOT - Status)
  describe('AC6: Pattern 14 - NOT Status', () => {
    const rule = {
      '!': { var: 'actor.components.status:burdened' }, // Uses ! var
    };
    const actorId = 'npc:mule';
    const componentId = 'status:burdened';
    const mockActor = createMockEntity(actorId);
    const componentData = { weightFactor: 1.5 };

    test('should evaluate TRUE when component is missing', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );
      // getComponentData returns default null
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
      expect(result).toBe(true); // {"!": null} -> true
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate FALSE when component exists', () => {
      // Arrange
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActor : undefined
      );
      mockEntityManager.getComponentData.mockImplementation((id, compId) =>
        id === actorId && compId === componentId ? componentData : null
      );
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
      expect(result).toBe(false); // {"!": {<data>}} -> false
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        componentId
      ); // Called by var
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    test('should evaluate TRUE when actor entity is missing', () => {
      // Arrange
      // getEntityInstance returns default undefined
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
      expect(result).toBe(true); // {"!": null} -> true
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });
  });
}); // End describe TEST-109
