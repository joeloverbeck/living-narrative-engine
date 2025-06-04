// src/tests/services/actionValidationContextBuilder.test.js
// --- FILE START ---

/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ActionValidationContextBuilder } from '../../src/services/actionValidationContextBuilder.js'; // Adjust path as needed
import { ActionTargetContext } from '../../src/models/actionTargetContext.js'; // Adjust path as needed
// --- BEGIN FIX: Import component IDs for mocking ---
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
// --- END FIX ---

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager
/** @type {jest.Mocked<import('../../src/entities/entityManager.js').default>} */
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(), // Ensure this is part of the base mock
  hasComponent: jest.fn(),
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Mock Entity (Helper Function)
/**
 * Creates a mock Entity object.
 * @param {string} id - The entity ID.
 * @param {object | null} [componentsData] - Optional components data object.
 * @returns {jest.Mocked<import('../../src/entities/entity.js').default>}
 */
const createMockEntity = (id, componentsData = { mock: true }) => ({
  id: id,
  getAllComponentsData: jest.fn().mockReturnValue(componentsData),
  // --- BEGIN FIX: Add getComponentData to mock entity if needed, though builder uses entityManager ---
  // getComponentData: jest.fn((componentId) => componentsData ? componentsData[componentId] : undefined),
  // --- END FIX ---
});

// --- Test Suite ---

describe('ActionValidationContextBuilder', () => {
  let builder;

  const sampleActionDefinition = { id: 'action:test', name: 'Test Action' };
  const actorId = 'actor:1';
  const actorComponents = {
    [POSITION_COMPONENT_ID]: { locationId: 'loc:current' }, // Added for direction scenario
    Stats: { health: 10 },
    Location: { zone: 'start' },
  };
  const mockActor = createMockEntity(actorId, actorComponents);

  beforeEach(() => {
    jest.clearAllMocks();
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset(); // Reset this as well

    builder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  // --- Constructor Tests (Basic Dependency Validation) ---
  it('should throw an error if EntityManager dependency is invalid', () => {
    // --- BEGIN FIX: Update expected error message ---
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: null,
          logger: mockLogger,
        })
    ).toThrow(
      'ActionValidationContextBuilder requires a valid EntityManager with getEntityInstance and getComponentData methods.'
    );
    const incompleteEntityManager = { getEntityInstance: jest.fn() }; // Missing getComponentData
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: incompleteEntityManager,
          logger: mockLogger,
        })
    ).toThrow(
      'ActionValidationContextBuilder requires a valid EntityManager with getEntityInstance and getComponentData methods.'
    );
    const anotherIncompleteEntityManager = { getComponentData: jest.fn() }; // Missing getEntityInstance
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: anotherIncompleteEntityManager,
          logger: mockLogger,
        })
    ).toThrow(
      'ActionValidationContextBuilder requires a valid EntityManager with getEntityInstance and getComponentData methods.'
    );
    // --- END FIX ---
  });

  it('should throw an error if ILogger dependency is invalid', () => {
    // --- BEGIN FIX: Ensure validEntityManager meets new criteria ---
    const validEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(), // Add getComponentData to pass the first check
    };
    // --- END FIX ---
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: validEntityManager,
          logger: null,
        })
    ).toThrow(
      'ActionValidationContextBuilder requires a valid ILogger instance.'
    );
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: validEntityManager,
          logger: { debug: jest.fn(), error: jest.fn() }, // Missing warn
        })
    ).toThrow(
      'ActionValidationContextBuilder requires a valid ILogger instance.'
    );
  });

  it('should successfully create an instance with valid dependencies', () => {
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).not.toThrow();
  });

  // --- buildContext Method Tests ---
  describe('buildContext', () => {
    describe("Scenario 1: Target Type 'entity', Entity Found", () => {
      const targetId = 'target:A';
      const targetComponents = {
        Inventory: { items: ['key'] },
        State: { locked: false },
      };
      const mockTargetEntity = createMockEntity(targetId, targetComponents);
      const targetContext = ActionTargetContext.forEntity(targetId);

      beforeEach(() => {
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === targetId) return mockTargetEntity;
          return null;
        });
      });

      it('should build the context correctly', () => {
        let context;
        expect(() => {
          context = builder.buildContext(
            sampleActionDefinition,
            mockActor,
            targetContext
          );
        }).not.toThrow();

        expect(context).toBeDefined();
        expect(context).toHaveProperty('actor');
        expect(context).toHaveProperty('target');
        expect(context).toHaveProperty('action');

        expect(context.actor).toEqual({
          id: actorId,
          components: actorComponents,
        });
        expect(mockActor.getAllComponentsData).toHaveBeenCalledTimes(1);

        // --- BEGIN FIX: Add blocker and exitDetails to expected target object ---
        expect(context.target).toEqual({
          type: 'entity',
          id: targetId,
          direction: null,
          entity: targetComponents,
          blocker: undefined, // Now always present
          exitDetails: null, // Now always present
        });
        // --- END FIX ---
        expect(mockTargetEntity.getAllComponentsData).toHaveBeenCalledTimes(1);

        expect(context.action).toEqual({
          id: sampleActionDefinition.id,
        });

        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Building context for action '${sampleActionDefinition.id}', actor '${actorId}', target type '${targetContext.type}'`
          )
        );
      });

      it('should handle target entity having no getAllComponentsData method gracefully', () => {
        const mockTargetEntitySimple = { id: targetId };
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === targetId) return mockTargetEntitySimple;
          return null;
        });

        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          targetContext
        );
        // --- BEGIN FIX: Expect fallback data + new fields ---
        expect(context.target.entity).toEqual({ id: targetId });
        expect(context.target.blocker).toBeUndefined();
        expect(context.target.exitDetails).toBeNull();
        // --- END FIX ---
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle actor having no getAllComponentsData method gracefully', () => {
        const mockActorSimple = { id: actorId };

        const context = builder.buildContext(
          sampleActionDefinition,
          mockActorSimple,
          targetContext
        );
        expect(context.actor.components).toEqual({});
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
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
          throw new Error(
            `Unexpected call to getEntityInstance with id: ${id}`
          );
        });
      });

      it('should build the context with null target entity and log a warning', () => {
        let context;
        expect(() => {
          context = builder.buildContext(
            sampleActionDefinition,
            mockActor,
            targetContext
          );
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
          entity: null,
          blocker: undefined, // Now always present
          exitDetails: null, // Now always present
        });

        // Verify Dependency Calls / Side Effects
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          missingTargetId
        );

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // --- BEGIN FIX: Correct the expected substring for the logger.warn call ---
        expect(mockLogger.warn).toHaveBeenCalledWith(
          // This substring should now correctly match part of the actual log message
          expect.stringContaining(
            `Target entity '${missingTargetId}' not found for action '${sampleActionDefinition.id}'. Context will have null target entity data.`
          )
        );
        // --- END FIX ---
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalled(); // Debug log should still happen
      });
    });

    describe("Scenario 3: Target Type 'direction'", () => {
      const direction = 'north';
      const targetContext = ActionTargetContext.forDirection(direction);

      // This test previously only checked the default state when no exit data was mocked.
      // It will now continue to do so, but the expectation includes the new default fields.
      // New tests would be needed to cover successful exit finding.
      it('should build the context correctly for a direction target (when no exit data is found)', () => {
        // Mock actor's position component to be retrievable
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === actorId && componentId === POSITION_COMPONENT_ID) {
              return actorComponents[POSITION_COMPONENT_ID]; // e.g., { locationId: 'loc:current' }
            }
            // Mock no EXITS_COMPONENT_ID for the location to test this path
            if (
              entityId === 'loc:current' &&
              componentId === EXITS_COMPONENT_ID
            ) {
              return null; // Or an empty array, or not an array to trigger warnings
            }
            return undefined;
          }
        );

        let context;
        expect(() => {
          context = builder.buildContext(
            sampleActionDefinition,
            mockActor,
            targetContext
          );
        }).not.toThrow();

        expect(context).toBeDefined();
        expect(context.actor.id).toBe(actorId);
        expect(context.action.id).toBe(sampleActionDefinition.id);

        // --- BEGIN FIX: Add blocker and exitDetails to expected target object ---
        // Since no exits are mocked to be found for "north", these will be defaults.
        expect(context.target).toEqual({
          type: 'direction',
          id: null,
          direction: direction,
          entity: null,
          blocker: undefined, // Default because no exit for "north" is found
          exitDetails: null, // Default because no exit for "north" is found
        });
        // --- END FIX ---

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          POSITION_COMPONENT_ID
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'loc:current',
          EXITS_COMPONENT_ID
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `No valid ${EXITS_COMPONENT_ID} data (or not an array) found for location 'loc:current'`
          )
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Building context for action '${sampleActionDefinition.id}', actor '${actorId}', target type 'direction'`
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Actor '${actorId}' is at location 'loc:current'. Fetching exits for direction '${direction}'.`
          )
        );
      });

      // It would be good to add a new test here for when an exit IS found:
      it('should build the context with resolved exitDetails and blocker for a found direction target', () => {
        const specificDirection = 'to the crypt';
        const specificTargetContext =
          ActionTargetContext.forDirection(specificDirection);
        const mockExitObject = {
          direction: specificDirection,
          target: 'loc:crypt',
          blocker: 'entity:heavy_door',
        };
        const actorCurrentLocationId = 'loc:guild';

        // Mock actor's position component
        mockEntityManager.getComponentData
          .mockImplementationOnce((entityId, componentId) => {
            if (entityId === actorId && componentId === POSITION_COMPONENT_ID) {
              return { locationId: actorCurrentLocationId };
            }
            return undefined;
          })
          // Mock location's exits component
          .mockImplementationOnce((entityId, componentId) => {
            if (
              entityId === actorCurrentLocationId &&
              componentId === EXITS_COMPONENT_ID
            ) {
              return [
                { direction: 'out', target: 'loc:town', blocker: null },
                mockExitObject,
              ];
            }
            return undefined;
          });

        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          specificTargetContext
        );

        expect(context.target).toEqual({
          type: 'direction',
          id: null,
          direction: specificDirection,
          entity: null,
          blocker: 'entity:heavy_door',
          exitDetails: mockExitObject,
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Found matching exit for direction '${specificDirection}'`
          ),
          mockExitObject
        );
      });
    });

    describe("Scenario 4: Target Type 'none'", () => {
      const targetContext = ActionTargetContext.noTarget();

      it('should build the context correctly for no target', () => {
        let context;
        expect(() => {
          context = builder.buildContext(
            sampleActionDefinition,
            mockActor,
            targetContext
          );
        }).not.toThrow();

        expect(context).toBeDefined();
        expect(context.actor.id).toBe(actorId);
        expect(context.action.id).toBe(sampleActionDefinition.id);

        // --- BEGIN FIX: Add blocker and exitDetails to expected target object ---
        expect(context.target).toEqual({
          type: 'none',
          id: null,
          direction: null,
          entity: null,
          blocker: undefined, // Now always present
          exitDetails: null, // Now always present
        });
        // --- END FIX ---

        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Building context for action '${sampleActionDefinition.id}', actor '${actorId}', target type 'none'`
          )
        );
      });
    });

    describe('Scenario 5: Invalid Inputs', () => {
      const validActor = mockActor;
      const validActionDef = sampleActionDefinition;
      const validTargetContext = ActionTargetContext.noTarget();

      it('should throw Error and log error for null actionDefinition', () => {
        const action = () =>
          builder.buildContext(null, validActor, validTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow(
          'ActionValidationContextBuilder requires a valid ActionDefinition.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          { actionDefinition: null }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for actionDefinition without id', () => {
        const invalidActionDef = { name: 'Action without ID' };
        const action = () =>
          builder.buildContext(
            invalidActionDef,
            validActor,
            validTargetContext
          );
        expect(action).toThrow(Error);
        expect(action).toThrow(
          'ActionValidationContextBuilder requires a valid ActionDefinition.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          { actionDefinition: invalidActionDef }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for null actor', () => {
        const action = () =>
          builder.buildContext(validActionDef, null, validTargetContext);
        expect(action).toThrow(Error);
        expect(action).toThrow(
          'ActionValidationContextBuilder requires a valid actor Entity.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actor entity provided'),
          { actor: null }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for actor without id', () => {
        const invalidActor = { getAllComponentsData: jest.fn() };
        const action = () =>
          builder.buildContext(
            validActionDef,
            invalidActor,
            validTargetContext
          );
        expect(action).toThrow(Error);
        expect(action).toThrow(
          'ActionValidationContextBuilder requires a valid actor Entity.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actor entity provided'),
          { actor: invalidActor }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for null targetContext', () => {
        const action = () =>
          builder.buildContext(validActionDef, validActor, null);
        expect(action).toThrow(Error);
        expect(action).toThrow(
          'ActionValidationContextBuilder requires a valid ActionTargetContext.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid targetContext provided'),
          { targetContext: null }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should throw Error and log error for targetContext without type', () => {
        const invalidTargetContext = { entityId: 'some-id' };
        const action = () =>
          builder.buildContext(
            validActionDef,
            validActor,
            invalidTargetContext
          );
        expect(action).toThrow(Error);
        expect(action).toThrow(
          'ActionValidationContextBuilder requires a valid ActionTargetContext.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid targetContext provided'),
          { targetContext: invalidTargetContext }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });
    });
  });
});
// --- FILE END ---
