// src/tests/logic/createActionValidationContext.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';

// --- Function Under Test ---
import {createActionValidationContext} from '../../logic/createActionValidationContext.js'; // Adjust path as needed

// --- Dependencies to Mock/Use ---
import Entity from '../../entities/entity.js'; // Needed to create mock entity instances
import {ActionTargetContext} from '../../models/actionTargetContext.js'; // Needed for test inputs
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */ // Added typedef for clarity

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

// Mock createComponentAccessor
jest.mock('../../logic/contextAssembler.js', () => ({
  createComponentAccessor: jest.fn(),
}));
import {createComponentAccessor} from '../../logic/contextAssembler.js';

// --- Test Suite ---

describe('Unit Test: createActionValidationContext', () => {
  /** @type {ActionDefinition} */ // <<< ADDED: Type for mock action definition
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
    jest.clearAllMocks();

    // <<< ADDED: Mock Action Definition
    mockActionDefinition = {
      id: 'test:action-mock',
      // Add other properties if needed by the function or rules later
      prerequisites: [],
      effects: [],
    };

    mockActorEntity = new Entity('actor-1');
    mockTargetContext = ActionTargetContext.noTarget();

    mockActorAccessor = {id: 'actor-1-accessor-proxy', isProxy: true};
    mockTargetAccessor = {id: 'target-1-accessor-proxy', isProxy: true};

    createComponentAccessor.mockImplementation((entityId, _entityManager, _logger) => {
      if (entityId === 'actor-1') return mockActorAccessor;
      if (entityId === 'target-1') return mockTargetAccessor;
      return {id: `${entityId}-accessor-proxy`, isProxy: true};
    });

    mockEntityManager.getEntityInstance.mockImplementation((entityId) => undefined);
    mockEntityManager.getComponentData.mockImplementation((_entityId, _componentTypeId) => undefined);
    mockEntityManager.hasComponent.mockImplementation((_entityId, _componentTypeId) => false);
  });

  afterEach(() => {
    // expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Test Cases ---

  describe('AC-3.1: Basic Structure', () => {
    // THIS TEST WAS FAILING
    test('should return an object with the correct top-level keys and default values', () => {
      // Arrange
      // Use mocks from beforeEach, override if necessary
      mockActorEntity = new Entity('actor-basic'); // Override actor for this test
      mockTargetContext = ActionTargetContext.noTarget(); // Explicitly no target

      // Create a specific accessor mock *for this specific actor ID* if needed
      const specificActorAccessor = {mocked: 'actorBasicAccessor'};
      createComponentAccessor.mockImplementation((entityId) => {
        if (entityId === 'actor-basic') return specificActorAccessor;
        return {id: `${entityId}-proxy`, isProxy: true};
      });


      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED: Pass actionDefinition first
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(context).toBeDefined();
      expect(context).toHaveProperty('actor');
      expect(context).toHaveProperty('target');
      expect(context).toHaveProperty('event'); // <<< ADDED: Check new property
      expect(context).toHaveProperty('context');
      expect(context).toHaveProperty('globals');
      expect(context).toHaveProperty('entities');

      // Check defaults
      expect(context.context).toEqual({});
      expect(context.globals).toEqual({});
      expect(context.entities).toEqual({});

      // Check actor (should be populated)
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe('actor-basic');
      expect(context.actor.components).toBe(specificActorAccessor);

      // Check target (should be null for noTarget context)
      expect(context.target).toBeNull();

      // <<< ADDED: Check event structure <<<
      expect(context.event).not.toBeNull();
      expect(context.event.eventType).toBe('action:attempt');
      expect(context.event.actionId).toBe(mockActionDefinition.id);
      expect(context.event.actorId).toBe(mockActorEntity.id);
      expect(context.event.targetContext).toBe(mockTargetContext); // Contains the original target context
      expect(context.event.actionDefinition).toBe(mockActionDefinition); // Contains the definition object
    });
  });

  describe('AC-3.2: Actor Population', () => {
    // THIS TEST WAS FAILING
    test('should populate context.actor with ID and components from createComponentAccessor', () => {
      // Arrange: Setup already done in beforeEach, uses actor-1

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED: Pass actionDefinition first
        mockActorEntity,      // actor-1 from beforeEach
        mockTargetContext,    // noTarget from beforeEach
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(context.actor).toBeDefined();
      expect(context.actor).not.toBeNull();
      expect(context.actor.id).toBe('actor-1');

      // Verify createComponentAccessor was called correctly for the actor
      expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only called for actor (target is 'none')
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor-1', // Correct actor ID
        mockEntityManager,
        mockLogger
      );

      // Verify the returned accessor was assigned
      // It should be the mockActorAccessor defined in beforeEach for 'actor-1'
      expect(context.actor.components).toBe(mockActorAccessor);
    });
  });

  describe('Target Population', () => {
    test('AC-3.3: should populate context.target when target is Entity and Found', () => {
      // Arrange
      const targetId = 'target-1';
      const mockTargetEntity = new Entity(targetId);
      mockTargetContext = ActionTargetContext.forEntity(targetId);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTargetEntity;
        if (id === 'actor-1') return mockActorEntity; // Ensure actor can also be "found" if needed by accessor
        return undefined;
      });

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1); // Only called for target
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);

      expect(context.target).toBeDefined();
      expect(context.target).not.toBeNull();
      expect(context.target.id).toBe(targetId);

      expect(createComponentAccessor).toHaveBeenCalledTimes(2); // Actor + Target
      expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
      expect(createComponentAccessor).toHaveBeenCalledWith(targetId, mockEntityManager, mockLogger);

      expect(context.target.components).toBe(mockTargetAccessor); // From beforeEach mock
    });

    test('AC-3.4: should represent non-found target when target is Entity but Not Found', () => {
      // Arrange
      const targetId = 'target-nonexistent';
      mockTargetContext = ActionTargetContext.forEntity(targetId);
      // EntityManager mock from beforeEach already returns undefined

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);

      // Updated expectation based on revised logic: Target IS populated but components are null
      expect(context.target).toEqual({id: targetId, components: null});

      expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only for actor
      expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
    });


    test('AC-3.5: should set context.target to null when targetContext type is entity but entityId is missing/invalid', () => {
      const testCases = [
        {type: 'entity', entityId: null},
        {type: 'entity', entityId: undefined},
        {type: 'entity', entityId: ''},
        {type: 'entity'},
      ];

      testCases.forEach(invalidContext => {
        jest.clearAllMocks(); // Clear for loop iteration
        createComponentAccessor.mockImplementation((entityId) => { // Reset mock impl for loop
          if (entityId === 'actor-1') return mockActorAccessor;
          return {isProxy: true};
        });
        mockEntityManager.getEntityInstance.mockClear(); // Clear calls for loop


        const context = createActionValidationContext(
          mockActionDefinition, // <<< FIXED
          mockActorEntity,
          // @ts-ignore
          invalidContext,
          mockEntityManager,
          mockLogger
        );

        // Assert
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(context.target).toBeNull(); // Invalid entityId -> null target
        expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only actor
        expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
      });
    });

    test('AC-3.6: should represent direction target when target is Direction', () => {
      // Arrange
      const direction = 'north';
      mockTargetContext = ActionTargetContext.forDirection(direction);

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      // Updated expectation based on revised logic
      expect(context.target).toEqual({id: null, direction: direction, components: null});
      expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only actor
      expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
    });


    test('AC-3.7: should set context.target to null when target is None', () => {
      // Arrange
      mockTargetContext = ActionTargetContext.noTarget(); // Default from beforeEach

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(context.target).toBeNull();
      expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only actor
      expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
    });
  });

  describe('AC-3.8: Error Handling (Inputs)', () => {
    // <<< NEW Test for invalid actionDefinition
    test('should throw error if actionDefinition is missing or invalid', () => {
      const invalidDefs = [null, undefined, {}, {id: ''}, {id: '  '}];
      invalidDefs.forEach(invalidDef => {
        expect(() => {
          createActionValidationContext(
            // @ts-ignore
            invalidDef, // <<< Testing the FIRST argument
            mockActorEntity,
            mockTargetContext,
            mockEntityManager,
            mockLogger
          );
        }).toThrow('createActionValidationContext: invalid actionDefinition');
      });
    });


    test('should throw error if actorEntity is missing or invalid', () => {
      const invalidActors = [null, undefined, {}, {id: ''}, {id: 'valid', hasComponent: 'not-a-function'}];
      invalidActors.forEach(invalidActor => {
        expect(() => {
          createActionValidationContext(
            mockActionDefinition, // <<< FIXED: Valid first arg
            // @ts-ignore
            invalidActor,       // <<< Testing the SECOND argument
            mockTargetContext,
            mockEntityManager,
            mockLogger
          );
        }).toThrow('createActionValidationContext: invalid actorEntity');
      });
    });

    test('should throw error if targetContext is missing or invalid', () => {
      const invalidTargets = [null, undefined, {}, {type: null}];
      invalidTargets.forEach(invalidTarget => {
        expect(() => {
          createActionValidationContext(
            mockActionDefinition, // <<< FIXED
            mockActorEntity,
            // @ts-ignore
            invalidTarget,      // <<< Testing the THIRD argument
            mockEntityManager,
            mockLogger
          );
        }).toThrow('createActionValidationContext: invalid targetContext');
      });
    });

    test('should throw error if entityManager is missing or invalid', () => {
      const invalidManagers = [null, undefined, {}, {getEntityInstance: 'not-a-function'}];
      invalidManagers.forEach(invalidManager => {
        expect(() => {
          createActionValidationContext(
            mockActionDefinition, // <<< FIXED
            mockActorEntity,
            mockTargetContext,
            // @ts-ignore
            invalidManager,     // <<< Testing the FOURTH argument
            mockLogger
          );
        }).toThrow('createActionValidationContext: invalid entityManager');
      });
    });

    test('should throw error if logger is missing or invalid', () => {
      const invalidLoggers = [
        null, undefined, {}, {debug: jest.fn()}, {debug: jest.fn(), warn: jest.fn(), error: null}
      ];
      invalidLoggers.forEach(invalidLogger => {
        expect(() => {
          createActionValidationContext(
            mockActionDefinition, // <<< FIXED
            mockActorEntity,
            mockTargetContext,
            mockEntityManager,
            // @ts-ignore
            invalidLogger       // <<< Testing the FIFTH argument
          );
        }).toThrow('createActionValidationContext: invalid logger');
      });
    });
  });

  describe('AC-3.9: Error Handling (Internal - Optional)', () => {
    test('should log error but represent target as {id, null} if entityManager.getEntityInstance throws', () => {
      // Arrange
      const targetId = 'target-error';
      mockTargetContext = ActionTargetContext.forEntity(targetId);
      const internalError = new Error('Database connection failed');

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) {
          throw internalError;
        }
        // Allow actor lookup if needed by its accessor
        if (id === 'actor-1') return mockActorEntity;
        return undefined;
      });

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert: Should not throw, should log error and return specific structure
      expect(context.target).toEqual({id: targetId, components: null}); // Represents failed lookup
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error looking up target entity ID [${targetId}]`),
        internalError // Check that the original Error object was logged
      );
      // Actor accessor should still be created
      expect(createComponentAccessor).toHaveBeenCalledTimes(1);
      expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
      expect(context.actor.components).toBe(mockActorAccessor);
    });

    test('should re-throw error if createComponentAccessor throws for Actor', () => {
      // Arrange
      const internalError = new Error('Accessor generation failed');
      createComponentAccessor.mockImplementation((entityId, _entityManager, _logger) => {
        if (entityId === mockActorEntity.id) {
          throw internalError;
        }
        // Should not be reached for target in this specific test path (target=none)
        return {isProxy: true};
      });

      // Act & Assert
      expect(() => {
        createActionValidationContext(
          mockActionDefinition, // <<< FIXED
          mockActorEntity,
          mockTargetContext, // Target = none
          mockEntityManager,
          mockLogger
        );
      }).toThrow('Accessor generation failed'); // Should re-throw the original error

      // Verify logger was called before throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error creating component accessor for actor ID [${mockActorEntity.id}]`),
        internalError // Check that the original Error object was logged
      );
    });

    test('should represent target as {id, null} and log error if createComponentAccessor throws for Target', () => {
      // Arrange
      const targetId = 'target-1';
      const mockTargetEntity = new Entity(targetId);
      mockTargetContext = ActionTargetContext.forEntity(targetId);
      const internalError = new Error('Target accessor generation failed');

      // Mock EntityManager to find the target entity
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTargetEntity;
        if (id === 'actor-1') return mockActorEntity;
        return undefined;
      });

      createComponentAccessor.mockImplementation((entityId, _entityManager, _logger) => {
        if (entityId === mockActorEntity.id) {
          return mockActorAccessor; // Actor accessor succeeds
        } else if (entityId === targetId) {
          throw internalError; // Target accessor fails
        }
        return {isProxy: true};
      });

      // Act
      const context = createActionValidationContext(
        mockActionDefinition, // <<< FIXED
        mockActorEntity,
        mockTargetContext,
        mockEntityManager,
        mockLogger
      );

      // Assert: Should not throw, should log and represent target state
      expect(context.target).toEqual({id: targetId, components: null}); // Represents target entity found, but accessor failed
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error creating component accessor for target ID [${targetId}]`),
        internalError
      );
      // Ensure the actor accessor *was* created successfully
      expect(createComponentAccessor).toHaveBeenCalledWith(mockActorEntity.id, mockEntityManager, mockLogger);
      expect(createComponentAccessor).toHaveBeenCalledWith(targetId, mockEntityManager, mockLogger); // It was called, but threw
      expect(context.actor.components).toBe(mockActorAccessor); // Actor part is fine
    });
  });

}); // End describe Unit Test: createActionValidationContext
