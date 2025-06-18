// tests/context/worldContext.edgeCases.test.js
// --- FILE START ---
import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
  afterEach,
} from '@jest/globals';

// Define the mock object *first*
const mockEntityManagerInstance = {
  getEntitiesWithComponent: jest.fn(),
  getComponentData: jest.fn(),
  getEntityInstance: jest.fn(),
  // VVVVVV ADDED LINE VVVVVV
  getPrimaryInstanceByDefinitionId: jest.fn(), // Add the new method to the mock
  // ^^^^^^ ADDED LINE ^^^^^^
};

// Mock the *module*
jest.mock('../../src/entities/entityManager.js', () => {
  return jest.fn().mockImplementation(() => mockEntityManagerInstance);
});

// Now import the dependencies *after* the mocks are set up
import WorldContext from '../../src/context/worldContext.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/EntityDefinition.js';
import EntityInstanceData from '../../src/entities/EntityInstanceData.js';
import EntityManager from '../../src/entities/entityManager.js'; // Mocked constructor
import {
  POSITION_COMPONENT_ID,
  CURRENT_ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../src/constants/eventIds.js';

describe('WorldContext Edge Cases', () => {
  let worldContext;
  let logger;
  let loggerErrorSpy;
  let loggerWarnSpy;
  let dispatcher;
  let originalNodeEnv; // Variable to store original NODE_ENV

  // Helper function to create entity instances for testing
  const createTestEntity = (instanceId, definitionId, defComponents = {}, instanceOverrides = {}) => {
    const definition = new EntityDefinition(definitionId, { description: `Test Definition ${definitionId}`, components: defComponents });
    const instanceData = new EntityInstanceData(instanceId, definition, instanceOverrides);
    return new Entity(instanceData);
  };

  beforeEach(() => {
    // Store and set NODE_ENV to production for testing the non-throwing path
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Reset mocks for each test to ensure isolation
    jest.clearAllMocks();

    logger = new ConsoleLogger(); // Use the actual logger to spy on it
    // Suppress actual console output for errors and warnings during tests
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    // Also mock info/debug if necessary to suppress console noise during tests
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    // Assuming debug might map to log or info if not explicitly defined
    // If ConsoleLogger truly lacks debug, this spy won't hurt but won't catch anything.
    jest.spyOn(logger, 'debug').mockImplementation(() => {});

    const entityManagerForTest = new EntityManager(); // This uses the mocked implementation
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    worldContext = new WorldContext(entityManagerForTest, logger, dispatcher);
  });

  afterEach(() => {
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;

    // Restore spies
    jest.restoreAllMocks(); // Use restoreAllMocks to clean up all spies easily
  });

  test('getCurrentLocation() returns null and logs error when zero current actors found', () => {
    // Arrange: Mock EntityManager to return zero actors
    mockEntityManagerInstance.getEntitiesWithComponent.mockReturnValue([]);

    // Act
    const location = worldContext.getCurrentLocation();

    // Assert
    expect(location).toBeNull();
    expect(
      mockEntityManagerInstance.getEntitiesWithComponent
    ).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
    // #assertSingleCurrentActor logs the error in production mode
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          `Expected exactly one entity with component '${CURRENT_ACTOR_COMPONENT_ID}', but found 0.`
        ),
      })
    );
    // getCurrentLocation also logs a debug message when actor is null
    expect(logger.debug).toHaveBeenCalledWith(
      'WorldContext.getCurrentLocation: Cannot get location because current actor could not be determined.'
    );
    expect(mockEntityManagerInstance.getComponentData).not.toHaveBeenCalled(); // Should bail out early
  });

  test('getCurrentLocation() returns null and logs error when two current actors found', () => {
    // Arrange: Mock EntityManager to return two actors
    const actor1 = createTestEntity('actor1', 'dummy-def');
    const actor2 = createTestEntity('actor2', 'dummy-def');
    mockEntityManagerInstance.getEntitiesWithComponent.mockReturnValue([
      actor1,
      actor2,
    ]);

    // Act
    const location = worldContext.getCurrentLocation();

    // Assert
    expect(location).toBeNull();
    expect(
      mockEntityManagerInstance.getEntitiesWithComponent
    ).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
    // #assertSingleCurrentActor logs the error in production mode
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          `Expected exactly one entity with component '${CURRENT_ACTOR_COMPONENT_ID}', but found 2.`
        ),
      })
    );
    // getCurrentLocation also logs a debug message when actor is null
    expect(logger.debug).toHaveBeenCalledWith(
      'WorldContext.getCurrentLocation: Cannot get location because current actor could not be determined.'
    );
    expect(mockEntityManagerInstance.getComponentData).not.toHaveBeenCalled(); // Should bail out early
  });

  test('getCurrentLocation() returns null when the current actor has no position component', () => {
    // Arrange
    const actor1 = createTestEntity('player1', 'dummy-def');
    mockEntityManagerInstance.getEntitiesWithComponent.mockImplementation(
      (componentTypeId) => {
        return componentTypeId === CURRENT_ACTOR_COMPONENT_ID ? [actor1] : [];
      }
    );
    mockEntityManagerInstance.getComponentData.mockImplementation(
      (entityId, componentTypeId) => {
        return entityId === 'player1' &&
          componentTypeId === POSITION_COMPONENT_ID
          ? undefined
          : undefined;
      }
    );

    // Act
    const location = worldContext.getCurrentLocation();

    // Assert
    expect(location).toBeNull();
    expect(
      mockEntityManagerInstance.getEntitiesWithComponent
    ).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
    expect(mockEntityManagerInstance.getComponentData).toHaveBeenCalledWith(
      'player1',
      POSITION_COMPONENT_ID
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          `Current actor 'player1' is missing a valid '${POSITION_COMPONENT_ID}' component or locationId.`
        ),
      })
    );
    expect(mockEntityManagerInstance.getEntityInstance).not.toHaveBeenCalled();
  });

  test('getCurrentLocation() returns null when the current actor has position component but invalid locationId', () => {
    // Arrange
    const actor1 = createTestEntity('player1', 'dummy-def');
    mockEntityManagerInstance.getEntitiesWithComponent.mockImplementation(
      (componentTypeId) => {
        return componentTypeId === CURRENT_ACTOR_COMPONENT_ID ? [actor1] : [];
      }
    );
    mockEntityManagerInstance.getComponentData.mockImplementation(
      (entityId, componentTypeId) => {
        return entityId === 'player1' &&
          componentTypeId === POSITION_COMPONENT_ID
          ? { x: 1, y: 1 }
          : undefined; // No locationId
      }
    );

    // Act
    const location = worldContext.getCurrentLocation();

    // Assert
    expect(location).toBeNull();
    expect(
      mockEntityManagerInstance.getEntitiesWithComponent
    ).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
    expect(mockEntityManagerInstance.getComponentData).toHaveBeenCalledWith(
      'player1',
      POSITION_COMPONENT_ID
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          `Current actor 'player1' is missing a valid '${POSITION_COMPONENT_ID}' component or locationId.`
        ),
      })
    );
    expect(mockEntityManagerInstance.getEntityInstance).not.toHaveBeenCalled();
  });

  test('getCurrentLocation() returns location entity when actor and position are valid', () => {
    // Arrange
    const actor1 = createTestEntity('player1', 'dummy-def');
    const locationEntity = createTestEntity('loc1', 'dummy-def');
    const positionData = { locationId: 'loc1', x: 0, y: 0 };

    mockEntityManagerInstance.getEntitiesWithComponent.mockImplementation(
      (componentTypeId) => {
        return componentTypeId === CURRENT_ACTOR_COMPONENT_ID ? [actor1] : [];
      }
    );
    mockEntityManagerInstance.getComponentData.mockImplementation(
      (entityId, componentTypeId) => {
        return entityId === 'player1' &&
          componentTypeId === POSITION_COMPONENT_ID
          ? positionData
          : undefined;
      }
    );
    mockEntityManagerInstance.getEntityInstance.mockImplementation(
      (entityId) => {
        return entityId === 'loc1' ? locationEntity : undefined;
      }
    );

    // Act
    const location = worldContext.getCurrentLocation();

    // Assert
    expect(location).toBe(locationEntity);
    expect(
      mockEntityManagerInstance.getEntitiesWithComponent
    ).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
    expect(mockEntityManagerInstance.getComponentData).toHaveBeenCalledWith(
      'player1',
      POSITION_COMPONENT_ID
    );
    expect(mockEntityManagerInstance.getEntityInstance).toHaveBeenCalledWith(
      'loc1'
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  test('getCurrentLocation() returns null and warns when location entity referenced by position does not exist', () => {
    // Arrange
    const actor1 = createTestEntity('player1', 'dummy-def');
    const positionData = { locationId: 'nonexistent-loc', x: 0, y: 0 };

    // Ensure only one actor is returned
    mockEntityManagerInstance.getEntitiesWithComponent.mockImplementation(
      (componentTypeId) => {
        return componentTypeId === CURRENT_ACTOR_COMPONENT_ID ? [actor1] : [];
      }
    );
    // Return position data for the actor
    mockEntityManagerInstance.getComponentData.mockImplementation(
      (entityId, componentTypeId) => {
        return entityId === 'player1' &&
          componentTypeId === POSITION_COMPONENT_ID
          ? positionData
          : undefined;
      }
    );
    // Simulate location not found
    mockEntityManagerInstance.getEntityInstance.mockReturnValue(undefined);

    // Act
    const location = worldContext.getCurrentLocation();

    // Assert
    expect(location).toBeNull();
    expect(
      mockEntityManagerInstance.getEntitiesWithComponent
    ).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
    expect(mockEntityManagerInstance.getComponentData).toHaveBeenCalledWith(
      'player1',
      POSITION_COMPONENT_ID
    );
    expect(mockEntityManagerInstance.getEntityInstance).toHaveBeenCalledWith(
      'nonexistent-loc'
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled(); // No error expected here
    expect(loggerWarnSpy).toHaveBeenCalledTimes(1); // Warning expected
    // VVVVVV UPDATED LOG MESSAGE CHECK VVVVVV
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Could not find location entity INSTANCE with ID 'nonexistent-loc' referenced by actor 'player1'`
      )
    );
    // ^^^^^^ UPDATED LOG MESSAGE CHECK ^^^^^^
  });
});
// --- FILE END ---
