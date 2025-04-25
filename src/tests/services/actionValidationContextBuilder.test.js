// src/tests/services/actionValidationContextBuilder.test.js

/**
 * @jest-environment node
 */
import {describe, expect, it, jest, beforeEach} from '@jest/globals';
import {ActionValidationContextBuilder} from '../../services/actionValidationContextBuilder.js'; // Adjust path as needed
import {ActionTargetContext} from '../../models/actionTargetContext.js'; // Adjust path as needed

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<import('../../core/interfaces/coreServices.js').ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager
/** @type {jest.Mocked<import('../../entities/entityManager.js').default>} */
const mockEntityManager = {
  // Core method needed by the builder
  getEntityInstance: jest.fn(),
  // Add other methods to satisfy potential interface checks or future use
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
  // Add any other methods expected by the real EntityManager if necessary
};

// Mock Entity (Helper Function)
/**
 * Creates a mock Entity object.
 * @param {string} id - The entity ID.
 * @param {object | null} [componentsData=null] - Optional components data object.
 * @returns {jest.Mocked<import('../../entities/entity.js').default>}
 */
const createMockEntity = (id, componentsData = {mock: true}) => ({
  id: id,
  getAllComponentsData: jest.fn().mockReturnValue(componentsData),
  // Mock other Entity methods if they were ever needed by the builder
  // tryGetComponent: jest.fn(),
  // addComponent: jest.fn(),
  // hasComponent: jest.fn(),
  // etc.
});

// --- Test Suite ---

describe('ActionValidationContextBuilder', () => {
  let builder;

  // Sample data for reuse
  const sampleActionDefinition = {id: 'action:test', name: 'Test Action'};
  const actorId = 'actor:1';
  const actorComponents = {Stats: {health: 10}, Location: {zone: 'start'}};
  const mockActor = createMockEntity(actorId, actorComponents);

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Reset specific mock implementations if needed (though clearAllMocks often suffices)
    mockEntityManager.getEntityInstance.mockReset();

    // Create a new builder instance for isolation
    builder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  // --- Constructor Tests (Basic Dependency Validation) ---
  it('should throw an error if EntityManager dependency is invalid', () => {
    expect(() => new ActionValidationContextBuilder({entityManager: null, logger: mockLogger}))
      .toThrow('ActionValidationContextBuilder requires a valid EntityManager.');
    expect(() => new ActionValidationContextBuilder({entityManager: {}, logger: mockLogger}))
      .toThrow('ActionValidationContextBuilder requires a valid EntityManager.');
  });

  it('should throw an error if ILogger dependency is invalid', () => {
    const validEntityManager = {getEntityInstance: jest.fn()};
    expect(() => new ActionValidationContextBuilder({entityManager: validEntityManager, logger: null}))
      .toThrow('ActionValidationContextBuilder requires a valid ILogger instance.');
    expect(() => new ActionValidationContextBuilder({
      entityManager: validEntityManager,
      logger: {debug: jest.fn()}
    })) // Missing warn/error
      .toThrow('ActionValidationContextBuilder requires a valid ILogger instance.');
  });

  it('should successfully create an instance with valid dependencies', () => {
    expect(() => new ActionValidationContextBuilder({entityManager: mockEntityManager, logger: mockLogger}))
      .not.toThrow();
  });


  // --- buildContext Method Tests ---
  describe('buildContext', () => {

    // --- Scenario 1: Target Type 'entity', Entity Found ---
    describe("Scenario 1: Target Type 'entity', Entity Found", () => {
      const targetId = 'target:A';
      const targetComponents = {Inventory: {items: ['key']}, State: {locked: false}};
      const mockTargetEntity = createMockEntity(targetId, targetComponents);
      const targetContext = ActionTargetContext.forEntity(targetId);

      beforeEach(() => {
        // Setup mock for this scenario
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === targetId) return mockTargetEntity;
          return null; // Should only be called for targetId here
        });
      });

      it('should build the context correctly', () => {
        let context;
        expect(() => {
          context = builder.buildContext(sampleActionDefinition, mockActor, targetContext);
        }).not.toThrow();

        // Verify Structure and Key Values
        expect(context).toBeDefined();
        expect(context).toHaveProperty('actor');
        expect(context).toHaveProperty('target');
        expect(context).toHaveProperty('action');

        // Actor Assertions
        expect(context.actor).toEqual({
          id: actorId,
          components: actorComponents,
        });
        expect(mockActor.getAllComponentsData).toHaveBeenCalledTimes(1);

        // Target Assertions
        expect(context.target).toEqual({
          type: 'entity',
          id: targetId,
          direction: null,
          entity: targetComponents, // Should contain the components data
        });
        expect(mockTargetEntity.getAllComponentsData).toHaveBeenCalledTimes(1);

        // Action Assertions
        expect(context.action).toEqual({
          id: sampleActionDefinition.id,
        });

        // Verify Dependency Calls / Side Effects
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        // --- FIX START: Corrected logger.debug assertion ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
          // Check that the single argument received contains the expected substring
          expect.stringContaining(`Building context for action '${sampleActionDefinition.id}', actor '${actorId}', target type '${targetContext.type}'`)
        );
        // --- FIX END ---
      });

      it('should handle target entity having no getAllComponentsData method gracefully', () => {
        // Arrange: Modify mock target entity for this specific test
        const mockTargetEntitySimple = {id: targetId}; // No getAllComponentsData method
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === targetId) return mockTargetEntitySimple;
          return null;
        });

        const context = builder.buildContext(sampleActionDefinition, mockActor, targetContext);

        // Target Assertions: Expect fallback data (just id)
        expect(context.target.entity).toEqual({id: targetId});

        // Verify Dependency Calls / Side Effects
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle actor having no getAllComponentsData method gracefully', () => {
        // Arrange: Modify mock actor entity for this specific test
        const mockActorSimple = {id: actorId}; // No getAllComponentsData method

        const context = builder.buildContext(sampleActionDefinition, mockActorSimple, targetContext);

        // Actor Assertions: Expect fallback data (empty object)
        expect(context.actor.components).toEqual({});

        // Verify Dependency Calls / Side Effects are still correct for target
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    // --- Scenario 2: Target Type 'entity', Entity Not Found ---
    describe("Scenario 2: Target Type 'entity', Entity Not Found", () => {
      const missingTargetId = 'target:missing';
      const targetContext = ActionTargetContext.forEntity(missingTargetId);

      beforeEach(() => {
        // Setup mock: Entity not found
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === missingTargetId) return null;
          // Fail test if called with unexpected ID
          throw new Error(`Unexpected call to getEntityInstance with id: ${id}`);
        });
      });

      it('should build the context with null target entity and log a warning', () => {
        let context;
        expect(() => {
          context = builder.buildContext(sampleActionDefinition, mockActor, targetContext);
        }).not.toThrow();

        // Verify Structure and Key Values
        expect(context).toBeDefined();
        expect(context.actor.id).toBe(actorId); // Actor still present
        expect(context.action.id).toBe(sampleActionDefinition.id); // Action still present

        // Target Assertions (Entity Not Found)
        expect(context.target).toEqual({
          type: 'entity',
          id: missingTargetId,
          direction: null,
          entity: null, // Key assertion: entity is null
        });

        // Verify Dependency Calls / Side Effects
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(missingTargetId);

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // --- FIX START: Corrected logger.warn assertion ---
        expect(mockLogger.warn).toHaveBeenCalledWith(
          // Check that the single argument received contains the expected substring
          expect.stringContaining(`Target entity '${missingTargetId}' not found while building context for action '${sampleActionDefinition.id}'`)
        );
        // --- FIX END ---
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalled(); // Debug log should still happen
      });
    });

    // --- Scenario 3: Target Type 'direction' ---
    describe("Scenario 3: Target Type 'direction'", () => {
      const direction = 'north';
      const targetContext = ActionTargetContext.forDirection(direction);

      it('should build the context correctly for a direction target', () => {
        let context;
        expect(() => {
          context = builder.buildContext(sampleActionDefinition, mockActor, targetContext);
        }).not.toThrow();

        // Verify Structure and Key Values
        expect(context).toBeDefined();
        expect(context.actor.id).toBe(actorId);
        expect(context.action.id).toBe(sampleActionDefinition.id);

        // Target Assertions (Direction)
        expect(context.target).toEqual({
          type: 'direction',
          id: null,
          direction: direction,
          entity: null,
        });

        // Verify Dependency Calls / Side Effects
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // IMPORTANT
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalled(); // Debug called with 1 arg, check content below
        // Corrected check for debug call in this scenario
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Building context for action '${sampleActionDefinition.id}', actor '${actorId}', target type 'direction'`)
        );
      });
    });

    // --- Scenario 4: Target Type 'none' ---
    describe("Scenario 4: Target Type 'none'", () => {
      const targetContext = ActionTargetContext.noTarget();

      it('should build the context correctly for no target', () => {
        let context;
        expect(() => {
          context = builder.buildContext(sampleActionDefinition, mockActor, targetContext);
        }).not.toThrow();

        // Verify Structure and Key Values
        expect(context).toBeDefined();
        expect(context.actor.id).toBe(actorId);
        expect(context.action.id).toBe(sampleActionDefinition.id);

        // Target Assertions (None)
        expect(context.target).toEqual({
          type: 'none',
          id: null,
          direction: null,
          entity: null,
        });

        // Verify Dependency Calls / Side Effects
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // IMPORTANT
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalled(); // Debug called with 1 arg, check content below
        // Corrected check for debug call in this scenario
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Building context for action '${sampleActionDefinition.id}', actor '${actorId}', target type 'none'`)
        );
      });
    });

    // --- Scenario 5: Invalid Inputs ---
    describe('Scenario 5: Invalid Inputs', () => {
      const validActor = mockActor;
      const validActionDef = sampleActionDefinition;
      const validTargetContext = ActionTargetContext.noTarget();

      // Test Case 5a: Invalid actionDefinition
      it('should throw Error and log error for null actionDefinition', () => {
        const action = () => builder.buildContext(null, validActor, validTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow('ActionValidationContextBuilder requires a valid ActionDefinition.');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          {actionDefinition: null}
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // Should fail before entity lookup
      });

      it('should throw Error and log error for actionDefinition without id', () => {
        const invalidActionDef = {name: 'Action without ID'};
        const action = () => builder.buildContext(invalidActionDef, validActor, validTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow('ActionValidationContextBuilder requires a valid ActionDefinition.');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          {actionDefinition: invalidActionDef}
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      // Test Case 5b: Invalid actor
      it('should throw Error and log error for null actor', () => {
        const action = () => builder.buildContext(validActionDef, null, validTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow('ActionValidationContextBuilder requires a valid actor Entity.');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actor entity provided'),
          {actor: null}
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for actor without id', () => {
        const invalidActor = {getAllComponentsData: jest.fn()}; // Missing id
        const action = () => builder.buildContext(validActionDef, invalidActor, validTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow('ActionValidationContextBuilder requires a valid actor Entity.');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actor entity provided'),
          {actor: invalidActor}
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      // Test Case 5c: Invalid targetContext
      it('should throw Error and log error for null targetContext', () => {
        const action = () => builder.buildContext(validActionDef, validActor, null);
        expect(action).toThrow(Error);
        expect(action).toThrow('ActionValidationContextBuilder requires a valid ActionTargetContext.');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid targetContext provided'),
          {targetContext: null}
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for targetContext without type', () => {
        const invalidTargetContext = {entityId: 'some-id'}; // Missing type
        const action = () => builder.buildContext(validActionDef, validActor, invalidTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow('ActionValidationContextBuilder requires a valid ActionTargetContext.');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid targetContext provided'),
          {targetContext: invalidTargetContext}
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });
    });
  });
});