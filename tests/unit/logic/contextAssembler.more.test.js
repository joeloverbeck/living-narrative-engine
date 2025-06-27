// src/tests/logic/contextAssembler.more.test.js

/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/* eslint-disable jest/no-conditional-expect */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
// Import ONLY createJsonLogicContext
import { createJsonLogicContext } from '../../../src/logic/contextAssembler.js'; // Adjust path if necessary
import { LOGGER_INFO_METHOD_ERROR } from '../../common/constants.js';
// Import Entity type for creating mock entity structure
import Entity from '../../../src/entities/entity.js'; // Adjust path if necessary
import { createEntityInstance } from '../../common/entities/index.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */ // Import type for mocking

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager
/** @type {Partial<jest.Mocked<EntityManager>>} */
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
};

/**
 * Creates a simple mock entity object for testing.
 *
 * @param {string | number} id - Identifier for the entity.
 * @returns {Partial<Entity>} A mock entity object with an ID.
 */

// --- Test Suite ---

describe('Ticket 8: createJsonLogicContext (contextAssembler.js)', () => {
  // --- Test Setup ---
  /** @type {GameEvent} */
  let baseEvent;
  let actorId;
  let targetId;
  /** @type {Partial<Entity>} */
  let mockActorEntity;
  /** @type {Partial<Entity>} */
  let mockTargetEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    baseEvent = { type: 'DEFAULT_EVENT', payload: { value: 1 } };
    actorId = 'player-123';
    targetId = 'enemy-abc';
    mockActorEntity = createEntityInstance({ instanceId: actorId });
    mockTargetEntity = createEntityInstance({ instanceId: targetId });
    mockEntityManager.getEntityInstance.mockReturnValue(undefined);
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();
  });

  // --- Test Cases ---

  // ... (Keep 'Basic Structure and Initialization' and 'Event Population' tests as they were) ...
  describe('Basic Structure and Initialization', () => {
    test('should return a context object with all required top-level keys', () => {
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );

      expect(context).toBeDefined();
      expect(context).toHaveProperty('event');
      expect(context).toHaveProperty('actor');
      expect(context).toHaveProperty('target');
      expect(context).toHaveProperty('context');
      expect(context).toHaveProperty('globals');
      expect(context).toHaveProperty('entities');
    });

    test('should initialize actor and target as null when no IDs are provided', () => {
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.actor).toBeNull();
      expect(context.target).toBeNull();
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    test('should initialize context, globals, and entities as empty objects', () => {
      const context = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.context).toEqual({});
      expect(context.globals).toEqual({});
      expect(context.entities).toEqual({});
    });
  });

  describe('Event Population', () => {
    test('should correctly populate event.type', () => {
      const specificEvent = { type: 'PLAYER_ACTION' };
      const context = createJsonLogicContext(
        specificEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.event.type).toBe('PLAYER_ACTION');
    });

    test('should correctly populate event.payload when provided', () => {
      const eventWithPayload = {
        type: 'DAMAGE_DEALT',
        payload: { amount: 50, type: 'fire' },
      };
      const context = createJsonLogicContext(
        eventWithPayload,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.event.payload).toEqual({ amount: 50, type: 'fire' });
    });

    test('should populate event.payload as an empty object if payload is {}', () => {
      const eventWithEmptyPayload = { type: 'CONFIG_UPDATE', payload: {} };
      const context = createJsonLogicContext(
        eventWithEmptyPayload,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.event.payload).toEqual({});
    });

    test('should populate event.payload as null if payload is missing (undefined)', () => {
      const eventWithoutPayload = { type: 'GAME_START' };
      const context = createJsonLogicContext(
        eventWithoutPayload,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.event.payload).toBeNull();
    });

    test('should populate event.payload as null if payload is explicitly null', () => {
      const eventWithNullPayload = { type: 'EFFECT_REMOVED', payload: null };
      const context = createJsonLogicContext(
        eventWithNullPayload,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(context.event.payload).toBeNull();
    });
  });

  describe('Actor Population', () => {
    // ... (keep successful actor tests) ...
    test('should populate actor with id and components proxy when actorId is valid and entity exists', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActorEntity : undefined
      );
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(context.actor).not.toBeNull();
      expect(context.actor).toHaveProperty('id', actorId);
      expect(context.actor).toHaveProperty('components');
      expect(typeof context.actor.components).toBe('object');
      expect(context.actor.components).not.toBeNull();
    });

    test('should set actor to null and log warning when actorId is valid but entity does not exist', () => {
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(context.actor).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Actor entity not found for ID [${actorId}]`)
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    test('should set actor to null when actorId is null or undefined', () => {
      const contextNull = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(contextNull.actor).toBeNull();
      const contextUndefined = createJsonLogicContext(
        baseEvent,
        undefined,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(contextUndefined.actor).toBeNull();
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test.each([
      [true, 'boolean'],
      [false, 'boolean'],
      [12345, 'number'], // Number ID
      [{ obj: 'id' }, 'object'],
      [['array-id'], 'object'],
      [() => {}, 'function'],
    ])(
      'should set actor to null and log warning for invalid actorId type: %p (%s)',
      (invalidId, typeString) => {
        // Arrange: Make target exist
        mockEntityManager.getEntityInstance.mockImplementation((id) =>
          id === targetId ? mockTargetEntity : undefined
        );

        // Act
        const context = createJsonLogicContext(
          baseEvent,
          invalidId,
          targetId,
          mockEntityManager,
          mockLogger
        );

        // Assert
        expect(context.actor).toBeNull();

        if (typeof invalidId === 'number') {
          expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
            invalidId
          );
        } else {
          expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
            invalidId
          );
        }
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(
          typeof invalidId === 'number' ? 2 : 1
        );

        // *** Correction for Warning Message Assertion ***
        if (typeof invalidId === 'number') {
          // For number IDs where the entity isn't found (default mock behavior)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            // Assert the "entity not found" warning is logged
            expect.stringContaining(
              `Actor entity not found for ID [${invalidId}]`
            )
          );
          expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only this warning logged
        } else if (invalidId) {
          // For other truthy invalid types (boolean true, object, array, function)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            // Assert the "Invalid type" warning is logged
            expect.stringContaining(
              `Invalid actorId type provided: [${typeString}]`
            )
          );
          expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only this warning logged
        } else {
          // For falsy invalid types (like false), no warning should be logged
          expect(mockLogger.warn).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe('Target Population', () => {
    // ... (keep successful target tests) ...
    test('should populate target with id and components proxy when targetId is valid and entity exists', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTargetEntity : undefined
      );
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(context.target).not.toBeNull();
      expect(context.target).toHaveProperty('id', targetId);
      expect(context.target).toHaveProperty('components');
      expect(typeof context.target.components).toBe('object');
      expect(context.target.components).not.toBeNull();
    });

    test('should set target to null and log warning when targetId is valid but entity does not exist', () => {
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(context.target).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Target entity not found for ID [${targetId}]`)
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    test('should set target to null when targetId is null or undefined', () => {
      // *** Correction: Ensure actor is found to prevent actor warnings ***
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActorEntity;
        return undefined;
      });

      const contextNull = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(contextNull.target).toBeNull();

      const contextUndefined = createJsonLogicContext(
        baseEvent,
        actorId,
        undefined,
        mockEntityManager,
        mockLogger
      );
      expect(contextUndefined.target).toBeNull();

      // Check EM calls specifically within this test's scope after the setup
      // It should have been called twice (once for each context creation above) only with actorId
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
        null
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
        undefined
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2); // Called once in contextNull, once in contextUndefined

      // *** Correction: Check warnings AFTER ensuring actor is found ***
      // Now, no warnings should have been logged because the actor was found
      // and null/undefined target IDs don't trigger warnings.
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test.each([
      [true, 'boolean'],
      [false, 'boolean'],
      [9876, 'number'], // Number ID
      [{ complex: true }, 'object'],
      [[1, 2, 3], 'object'],
    ])(
      'should set target to null and log warning for invalid targetId type: %p (%s)',
      (invalidId, typeString) => {
        // Arrange: Make actor exist
        mockEntityManager.getEntityInstance.mockImplementation((id) =>
          id === actorId ? mockActorEntity : undefined
        );

        // Act
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          invalidId,
          mockEntityManager,
          mockLogger
        );

        // Assert
        expect(context.target).toBeNull();

        if (typeof invalidId === 'number') {
          expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
            invalidId
          );
        } else {
          expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
            invalidId
          );
        }
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(
          typeof invalidId === 'number' ? 2 : 1
        );

        // *** Correction for Warning Message Assertion ***
        if (typeof invalidId === 'number') {
          // For number IDs where the entity isn't found (default mock behavior)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            // Assert the "entity not found" warning is logged
            expect.stringContaining(
              `Target entity not found for ID [${invalidId}]`
            )
          );
          expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only this warning logged
        } else if (invalidId) {
          // For other truthy invalid types (boolean true, object, array, function)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            // Assert the "Invalid type" warning is logged
            expect.stringContaining(
              `Invalid targetId type provided: [${typeString}]`
            )
          );
          expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only this warning logged
        } else {
          // For falsy invalid types (like false), no warning should be logged
          expect(mockLogger.warn).not.toHaveBeenCalled();
        }
      }
    );
  });

  // ... (Keep 'Combined Actor and Target', 'Component Accessor Interaction', and 'Argument Validation Errors' tests as they were, they should be okay) ...
  describe('Combined Actor and Target', () => {
    test('should populate both actor and target when both IDs are valid and entities exist', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actorId) return mockActorEntity;
        if (id === targetId) return mockTargetEntity;
        return undefined;
      });
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe(actorId);
      expect(typeof context.actor.components).toBe('object');
      expect(context.target).not.toBeNull();
      expect(context.target.id).toBe(targetId);
      expect(typeof context.target.components).toBe('object');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('should populate actor correctly when target is not found', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActorEntity : undefined
      );
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe(actorId);
      expect(context.target).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Target entity not found for ID [${targetId}]`)
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    test('should populate target correctly when actor is not found', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTargetEntity : undefined
      );
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(context.actor).toBeNull();
      expect(context.target).not.toBeNull();
      expect(context.target.id).toBe(targetId);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Actor entity not found for ID [${actorId}]`)
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    test('should set both actor and target to null when neither entity is found', () => {
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(context.actor).toBeNull();
      expect(context.target).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Actor entity not found for ID [${actorId}]`)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Target entity not found for ID [${targetId}]`)
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    test('should handle one valid ID and one invalid ID type correctly', () => {
      const invalidTargetId = false;
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActorEntity : undefined
      );
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        invalidTargetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
        invalidTargetId
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe(actorId);
      expect(context.target).toBeNull();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Component Accessor Interaction (Indirect)', () => {
    test('accessing actor components should trigger EM getComponentData', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActorEntity : undefined
      );
      const mockHealthData = { current: 50, max: 100 };
      mockEntityManager.getComponentData.mockReturnValue(mockHealthData);
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      const health = context.actor?.components['health'];
      expect(context.actor).not.toBeNull();
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        'health'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
      expect(health).toEqual(mockHealthData);
    });

    test('accessing target components should trigger EM getComponentData', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === targetId ? mockTargetEntity : undefined
      );
      const mockStatusData = { effects: ['poisoned'] };
      mockEntityManager.getComponentData.mockReturnValue(mockStatusData);
      const context = createJsonLogicContext(
        baseEvent,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );
      const status = context.target?.components['status'];
      expect(context.target).not.toBeNull();
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        'status'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
      expect(status).toEqual(mockStatusData);
    });

    test('checking existence with "in" operator on components should trigger EM hasComponent', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId ? mockActorEntity : undefined
      );
      mockEntityManager.hasComponent.mockReturnValue(true);
      const context = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      const hasPosition =
        context.actor?.components && 'position' in context.actor.components;
      expect(context.actor).not.toBeNull();
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        actorId,
        'position'
      );
      expect(mockEntityManager.hasComponent).toHaveBeenCalledTimes(1);
      expect(hasPosition).toBe(true);
    });
  });

  describe('Argument Validation Errors', () => {
    test('should throw error if event is missing or invalid', () => {
      expect(() =>
        createJsonLogicContext(
          null,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        )
      ).toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
      expect(() =>
        createJsonLogicContext(
          { payload: {} },
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        )
      ).toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
      expect(() =>
        createJsonLogicContext(
          'string_event',
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        )
      ).toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
      expect(() =>
        createJsonLogicContext(
          { type: 123 },
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        )
      ).toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
    });

    test('should throw error if entityManager is missing or invalid', () => {
      expect(() =>
        createJsonLogicContext(baseEvent, actorId, targetId, null, mockLogger)
      ).toThrow(
        'Missing required dependency: createJsonLogicContext: entityManager.'
      );
      expect(() =>
        createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          { getComponentData: jest.fn() },
          mockLogger
        )
      ).toThrow(
        "Invalid or missing method 'getEntityInstance' on dependency 'createJsonLogicContext: entityManager'."
      );
      expect(() =>
        createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          { getEntityInstance: jest.fn() },
          mockLogger
        )
      ).toThrow(
        "Invalid or missing method 'getComponentData' on dependency 'createJsonLogicContext: entityManager'."
      );
      expect(() =>
        createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          {
            getEntityInstance: 'not a function',
            getComponentData: jest.fn(),
          },
          mockLogger
        )
      ).toThrow(
        "Invalid or missing method 'getEntityInstance' on dependency 'createJsonLogicContext: entityManager'."
      );
    });

    test('should throw error if logger is missing or invalid', () => {
      expect(() =>
        createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          null
        )
      ).toThrow('Missing required dependency: logger.');
      expect(() =>
        createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          {
            warn: jest.fn(),
            error: jest.fn(),
          }
        )
      ).toThrow(LOGGER_INFO_METHOD_ERROR);
      expect(() =>
        createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          {
            debug: 'nope',
            warn: jest.fn(),
            error: jest.fn(),
          }
        )
      ).toThrow(LOGGER_INFO_METHOD_ERROR);
    });
  });
});
