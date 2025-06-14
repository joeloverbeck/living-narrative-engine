// src/tests/services/ActionValidationService.prerequisites.test.js
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

// --- Function Under Test ---
import { createActionValidationContext } from '../../src/logic/createActionValidationContext.js'; // Adjust path as needed

// --- Dependencies to Mock/Use ---
import Entity from '../../src/entities/entity.js'; // Needed to create mock entity instances
import { ActionTargetContext } from '../../src/models/actionTargetContext.js'; // Needed for test inputs
// +++ Import ActionDefinition type if needed for strict typing of the mock +++
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

// --- Mocking Dependencies ---

// Mock EntityManager
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
};

// Mock ILogger
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

// Mock createComponentAccessor (from contextAssembler.js)
jest.mock('../../src/logic/contextAssembler.js', () => ({
  createComponentAccessor: jest.fn(),
}));
// Import the *mocked* version after jest.mock()
import { createComponentAccessor } from '../../src/logic/contextAssembler.js';
import { ATTEMPT_ACTION_ID } from '../../src/constants/eventIds.js';

// --- Test Suite ---

describe('Unit Test: createActionValidationContext', () => {
  /** @type {ActionDefinition} */ // Optional: Strong type for the mock
  let mockActionDefinition;
  /** @type {Entity} */
  let mockActorEntity;
  /** @type {ActionTargetContext} */
  let mockTargetContext;
  /** @type {object} */
  let mockActorAccessor;
  /** @type {object} */
  let mockTargetAccessor;

  // --- Test Setup ---
  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    jest.clearAllMocks();

    // --- >>> DEFINE MOCK ACTION DEFINITION <<< ---
    mockActionDefinition = {
      id: 'test:action:basic', // Needs a non-empty string ID
      // Add other properties if required by the function's internal logic
      // or downstream consumers not mocked away (e.g., prerequisites, effects).
      // For basic context creation, often just the ID is needed for the guard.
      prerequisites: [], // Example placeholder
      effects: [], // Example placeholder
    };
    // --- >>> END <<< ---

    // Recreate mock entities/contexts for clean state
    mockActorEntity = new Entity('actor-1', 'dummy');
    // mockActorEntity.addComponent('core:test', { value: 1 }); // Example if components needed

    // Default target context (can be overridden in tests)
    mockTargetContext = ActionTargetContext.noTarget();

    // Default mock return values for createComponentAccessor
    mockActorAccessor = { id: 'actor-1-accessor-proxy', isProxy: true };
    mockTargetAccessor = { id: 'target-1-accessor-proxy', isProxy: true };

    // Provide default implementation for createComponentAccessor mock
    createComponentAccessor.mockImplementation(
      (entityId, _entityManager, _logger) => {
        if (entityId === 'actor-1') {
          return mockActorAccessor;
        } else if (entityId === 'target-1') {
          return mockTargetAccessor;
        }
        return { id: `${entityId}-accessor-proxy`, isProxy: true };
      }
    );

    // Default mock implementation for EntityManager
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    mockEntityManager.getComponentData.mockImplementation(
      (_entityId, _componentTypeId) => undefined
    );
    mockEntityManager.hasComponent.mockImplementation(
      (_entityId, _componentTypeId) => false
    );
  });

  afterEach(() => {
    // Optional: Verify no unexpected error logs occurred if not testing errors
    // expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Test Cases ---

  describe('AC-3.1: Basic Structure', () => {
    test('should return an object with the correct top-level keys and default values', () => {
      // Arrange
      mockActorEntity = new Entity('actor-basic', 'dummy'); // Use a specific ID if needed
      mockTargetContext = ActionTargetContext.noTarget();
      createComponentAccessor.mockReturnValueOnce({ mocked: 'actorAccessor' }); // For the actor

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass the new mock definition FIRST
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(context).toBeDefined();
      expect(context).toHaveProperty('actor');
      expect(context).toHaveProperty('target');
      expect(context).toHaveProperty('event'); // Check the new event property
      expect(context).toHaveProperty('context');
      expect(context).toHaveProperty('globals');
      expect(context).toHaveProperty('entities');

      // Check default/expected values
      expect(context.context).toEqual({});
      expect(context.globals).toEqual({});
      expect(context.entities).toEqual({});

      // Actor should be populated, target null in this case
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe(mockActorEntity.id);
      expect(context.target).toBeNull();

      // Check the structure of the new 'event' property
      expect(context.event).not.toBeNull();
      expect(context.event).toEqual({
        eventType: ATTEMPT_ACTION_ID,
        actionId: mockActionDefinition.id,
        actorId: mockActorEntity.id,
        targetContext: mockTargetContext,
        actionDefinition: mockActionDefinition, // Verify the definition is included
      });
    });
  });

  describe('AC-3.2: Actor Population', () => {
    test('should populate context.actor with ID and components from createComponentAccessor', () => {
      // Arrange: Setup already done in beforeEach

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass the new mock definition FIRST
        mockActorEntity,
        mockTargetContext, // No target needed for this test
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(context.actor).toBeDefined();
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe('actor-1');

      // Verify createComponentAccessor was called correctly for the actor
      expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only called for actor
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager,
        mockLogger
      );

      // Verify the returned accessor was assigned
      expect(context.actor.components).toBe(mockActorAccessor);

      // Verify the event property is populated correctly
      expect(context.event.actionId).toBe(mockActionDefinition.id);
      expect(context.event.actorId).toBe(mockActorEntity.id);
    });
  });

  describe('Target Population', () => {
    test('AC-3.3: should populate context.target when target is Entity and Found', () => {
      // Arrange
      const targetId = 'target-1';
      const mockTargetEntity = new Entity(targetId, 'dummy');
      mockTargetContext = ActionTargetContext.forEntity(targetId);

      // Mock EntityManager to find the target entity
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTargetEntity;
        return undefined;
      });

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass the new mock definition FIRST
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );

      expect(context.target).toBeDefined();
      expect(context.target).not.toBeNull();
      expect(context.target.id).toBe(targetId);

      expect(createComponentAccessor).toHaveBeenCalledTimes(2);
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager,
        mockLogger
      );
      expect(createComponentAccessor).toHaveBeenCalledWith(
        targetId,
        mockEntityManager,
        mockLogger
      );

      expect(context.target.components).toBe(mockTargetAccessor);
    });

    test('AC-3.4: should set context.target representing non-found entity when target is Entity but Not Found', () => {
      // Arrange
      const targetId = 'target-nonexistent';
      mockTargetContext = ActionTargetContext.forEntity(targetId);

      // Mock EntityManager to NOT find the target entity (default beforeEach behavior)
      mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass the new mock definition FIRST
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );

      // Verify target represents a non-found entity
      // (Based on the *updated* logic in createActionValidationContext)
      expect(context.target).toEqual({ id: targetId, components: null });

      // Verify createComponentAccessor was only called for the actor
      expect(createComponentAccessor).toHaveBeenCalledTimes(1);
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager,
        mockLogger
      );
    });

    test('AC-3.5: should set context.target to null when targetContext type is entity but entityId is missing/invalid', () => {
      // Arrange
      const testCases = [
        { type: 'entity', entityId: null },
        { type: 'entity', entityId: undefined },
        { type: 'entity', entityId: '' },
        { type: 'entity' },
      ];

      testCases.forEach((invalidContext) => {
        // Reset specific mocks for this iteration
        jest.clearAllMocks(); // Clear all mocks to be safe
        // Redefine mock implementations needed for this iteration
        createComponentAccessor.mockImplementation((entityId) => {
          if (entityId === 'actor-1') return mockActorAccessor;
          return { isProxy: true };
        });
        mockEntityManager.getEntityInstance.mockImplementation(() => undefined); // Ensure it doesn't find anything

        // Act
        const context = createActionValidationContext(
          mockActionDefinition, // <<< Pass the new mock definition FIRST
          mockActorEntity,
          // @ts-ignore - Intentionally testing invalid structure
          invalidContext,
          mockEntityManager,
          mockLogger
        );

        // Assert
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // Shouldn't try to get instance if ID is invalid
        expect(context.target).toBeNull(); // Target should be null if context is invalid
        expect(createComponentAccessor).toHaveBeenCalledTimes(1);
        expect(createComponentAccessor).toHaveBeenCalledWith(
          'actor-1',
          mockEntityManager,
          mockLogger
        );
      });
    });

    test('AC-3.6: should set context.target representing direction when target is Direction', () => {
      // Arrange
      const direction = 'north';
      mockTargetContext = ActionTargetContext.forDirection(direction);

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass the new mock definition FIRST
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      // Verify target represents the direction
      // (Based on the *updated* logic in createActionValidationContext)
      expect(context.target).toEqual({
        type: 'direction',
        id: null,
        direction,
        components: null,
        blocker: undefined,
        exitDetails: null,
      });
      // Accessor only called for actor
      expect(createComponentAccessor).toHaveBeenCalledTimes(1);
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager,
        mockLogger
      );
    });

    test('AC-3.7: should set context.target to null when target is None', () => {
      // Arrange
      mockTargetContext = ActionTargetContext.noTarget(); // Already default

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass the new mock definition FIRST
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(context.target).toBeNull();
      expect(createComponentAccessor).toHaveBeenCalledTimes(1);
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor-1',
        mockEntityManager,
        mockLogger
      );
    });
  });

  describe('AC-3.8: Error Handling (Inputs)', () => {
    // +++ Optional but recommended: Test for invalid actionDefinition +++
    test('should throw error if actionDefinition is missing or invalid', () => {
      const invalidDefs = [null, undefined, {}, { id: '' }, { id: '  ' }];
      invalidDefs.forEach((invalidDef) => {
        expect(() => {
          // @ts-ignore - Intentionally passing invalid type
          createActionValidationContext(
            invalidDef,
            mockActorEntity,
            mockTargetContext,
            mockEntityManager,
            mockLogger
          );
        }).toThrow('createActionValidationContext: invalid actionDefinition');
      });
    });
    // +++ End Optional +++

    test('should throw error if actorEntity is missing or invalid', () => {
      const invalidActors = [
        null,
        undefined,
        {},
        { id: '' },
        { id: 'valid', hasComponent: 'not-a-function' },
      ];
      invalidActors.forEach((invalidActor) => {
        expect(() => {
          // @ts-ignore - Intentionally passing invalid type
          createActionValidationContext(
            mockActionDefinition,
            invalidActor,
            mockTargetContext,
            mockEntityManager,
            mockLogger
          ); // <<< Pass actionDefinition
        }).toThrow('createActionValidationContext: invalid actorEntity');
      });
    });

    test('should throw error if targetContext is missing or invalid', () => {
      const invalidTargets = [null, undefined, {}, { type: null }];
      invalidTargets.forEach((invalidTarget) => {
        expect(() => {
          // @ts-ignore - Intentionally passing invalid type
          createActionValidationContext(
            mockActionDefinition,
            mockActorEntity,
            invalidTarget,
            mockEntityManager,
            mockLogger
          ); // <<< Pass actionDefinition
        }).toThrow('createActionValidationContext: invalid targetContext');
      });
    });

    test('should throw error if entityManager is missing or invalid', () => {
      const invalidManagers = [
        null,
        undefined,
        {},
        { getEntityInstance: 'not-a-function' },
      ];
      invalidManagers.forEach((invalidManager) => {
        expect(() => {
          // @ts-ignore - Intentionally passing invalid type
          createActionValidationContext(
            mockActionDefinition,
            mockActorEntity,
            mockTargetContext,
            invalidManager,
            mockLogger
          ); // <<< Pass actionDefinition
        }).toThrow('createActionValidationContext: invalid entityManager');
      });
    });

    test('should throw error if logger is missing or invalid', () => {
      const invalidLoggers = [
        null,
        undefined,
        {},
        { debug: jest.fn() },
        { debug: jest.fn(), warn: jest.fn(), error: null },
      ];
      invalidLoggers.forEach((invalidLogger) => {
        expect(() => {
          // @ts-ignore - Intentionally passing invalid type
          createActionValidationContext(
            mockActionDefinition,
            mockActorEntity,
            mockTargetContext,
            mockEntityManager,
            invalidLogger
          ); // <<< Pass actionDefinition
        }).toThrow('createActionValidationContext: invalid logger');
      });
    });
  });

  describe('AC-3.9: Error Handling (Internal - Optional)', () => {
    // Note: Your function's internal error handling for entity lookup/accessor creation seems modified.
    // These tests assume the function *logs* errors but may not always *re-throw* them,
    // or it might throw different messages. Adjust expects based on the *actual* behavior
    // of your modified createActionValidationContext.

    test('should log error and set target appropriately if entityManager.getEntityInstance throws', () => {
      // Arrange
      const targetId = 'target-error';
      mockTargetContext = ActionTargetContext.forEntity(targetId);
      const internalError = new Error('Database connection failed');

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) {
          throw internalError;
        }
        return undefined;
      });

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass actionDefinition
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      // Verify logger was called
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error looking up target entity ID [${targetId}]`
        ),
        internalError // Check that the original Error object was logged
      );
      // Verify target represents the error state (based on updated function logic)
      expect(context.target).toEqual({ id: targetId, components: null });
      // Verify actor was still processed
      expect(context.actor).not.toBeNull();
      expect(createComponentAccessor).toHaveBeenCalledWith(
        mockActorEntity.id,
        mockEntityManager,
        mockLogger
      );
    });

    test('should throw error if createComponentAccessor throws for Actor', () => {
      // Arrange
      const internalError = new Error('Accessor generation failed');
      createComponentAccessor.mockImplementation(
        (entityId, _entityManager, _logger) => {
          if (entityId === mockActorEntity.id) {
            throw internalError;
          }
          return { isProxy: true };
        }
      );

      // Act & Assert
      expect(() => {
        createActionValidationContext(
          mockActionDefinition, // <<< Pass actionDefinition
          mockActorEntity,
          mockTargetContext,
          mockEntityManager,
          mockLogger
        );
      }).toThrow(internalError); // Should re-throw the original error

      // Verify logger was called before throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error creating component accessor for actor ID [${mockActorEntity.id}]`
        ),
        internalError // Check that the original Error object was logged
      );
    });

    test('should log error and set target appropriately if createComponentAccessor throws for Target', () => {
      // Arrange
      const targetId = 'target-1';
      const mockTargetEntity = new Entity(targetId, 'dummy');
      mockTargetContext = ActionTargetContext.forEntity(targetId);
      const internalError = new Error('Target accessor generation failed');

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTargetEntity;
        return undefined;
      });

      createComponentAccessor.mockImplementation(
        (entityId, _entityManager, _logger) => {
          if (entityId === mockActorEntity.id) {
            return mockActorAccessor; // Actor accessor succeeds
          } else if (entityId === targetId) {
            throw internalError; // Target accessor fails
          }
          return { isProxy: true };
        }
      );

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< Pass actionDefinition
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      // Verify logger was called for the target accessor error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error creating component accessor for target ID [${targetId}]`
        ),
        internalError // Check that the original Error object was logged
      );
      // Verify target represents the error state (based on updated function logic)
      expect(context.target).toEqual({ id: targetId, components: null });
      // Ensure the actor accessor *was* created and assigned
      expect(context.actor).not.toBeNull();
      expect(context.actor.components).toBe(mockActorAccessor);
      expect(createComponentAccessor).toHaveBeenCalledWith(
        mockActorEntity.id,
        mockEntityManager,
        mockLogger
      );
      expect(createComponentAccessor).toHaveBeenCalledWith(
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only one error logged
    });
  });
}); // End describe Unit Test: createActionValidationContext
