// tests/context/worldContext.test.js
// --- FILE START ---

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import WorldContext from '../../../src/context/worldContext.js';
import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const createMockEntityManager = () => ({
  getEntitiesWithComponent: jest.fn(),
  getComponentData: jest.fn(),
  getEntityInstance: jest.fn(),
  activeEntities: new Map(),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Helper function to create entity instances for testing
const createTestEntity = (
  instanceId,
  definitionId,
  defComponents = {},
  instanceOverrides = {},
  logger = console
) => {
  const definition = new EntityDefinition(definitionId, {
    description: `Test Definition ${definitionId}`,
    components: defComponents,
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    definition,
    instanceOverrides,
    logger
  );
  return new Entity(instanceData);
};

describe('WorldContext (Stateless)', () => {
  let mockEntityManager;
  let mockLogger;
  let worldContext;

  let mockDispatcher;

  const PLAYER_ID = 'player-1';
  const NPC_ACTOR_ID = 'npc-actor-1';
  const LOCATION_1_ID = 'location-start-instance'; // Using more instance-like IDs
  const LOCATION_2_ID = 'location-room-instance';
  const ITEM_ID = 'item-key-instance';

  let playerEntity;
  let npcActorEntity;
  let location1Entity;
  let location2Entity;
  let itemEntity;

  let originalNodeEnv;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
    mockLogger = createMockLogger();
    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    worldContext = new WorldContext(
      mockEntityManager,
      mockLogger,
      mockDispatcher
    );

    playerEntity = createTestEntity(PLAYER_ID, 'player-def');
    npcActorEntity = createTestEntity(NPC_ACTOR_ID, 'npc-def');
    location1Entity = createTestEntity(LOCATION_1_ID, 'location-def-1');
    location2Entity = createTestEntity(LOCATION_2_ID, 'location-def-2');
    itemEntity = createTestEntity(ITEM_ID, 'item-def');

    jest.clearAllMocks();

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
    mockEntityManager.getComponentData.mockReturnValue(undefined);
    mockEntityManager.getEntityInstance.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Constructor', () => {
    it('should throw if EntityManager is invalid or missing key methods', () => {
      const expectedErrorMessage =
        'WorldContext requires a valid EntityManager instance with getEntitiesWithComponent and getEntityInstance methods.';

      expect(() => new WorldContext(null, mockLogger, mockDispatcher)).toThrow(
        expectedErrorMessage
      );

      const incompleteEntityManager = {
        // Simulating missing getEntityInstance
        getEntitiesWithComponent: jest.fn(),
        // getEntityInstance: jest.fn(), // This was causing the test to incorrectly pass the constructor check
      };
      expect(
        () =>
          new WorldContext(incompleteEntityManager, mockLogger, mockDispatcher)
      ).toThrow(expectedErrorMessage);

      const anotherIncompleteEntityManager = {}; // Missing both methods
      expect(
        () =>
          new WorldContext(
            anotherIncompleteEntityManager,
            mockLogger,
            mockDispatcher
          )
      ).toThrow(expectedErrorMessage);
    });

    it('should throw if Logger is invalid or missing', () => {
      expect(
        () => new WorldContext(mockEntityManager, null, mockDispatcher)
      ).toThrow('WorldContext requires a valid ILogger instance');
      expect(
        () => new WorldContext(mockEntityManager, {}, mockDispatcher)
      ).toThrow('WorldContext requires a valid ILogger instance');
      expect(
        () => new WorldContext(mockEntityManager, mockLogger, null)
      ).toThrow('Missing required dependency: safeEventDispatcher.');
    });

    it('should successfully initialize with valid dependencies', () => {
      expect(
        () => new WorldContext(mockEntityManager, mockLogger, mockDispatcher)
      ).not.toThrow();
    });
  });

  describe('getCurrentActor', () => {
    it('should return the actor entity when exactly one entity has the CURRENT_ACTOR component', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        playerEntity,
      ]);
      const actor = worldContext.getCurrentActor();
      expect(actor).toBe(playerEntity);
    });

    it('should return null and log/throw error if zero entities have the CURRENT_ACTOR component', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      process.env.NODE_ENV = 'test';
      expect(() => worldContext.getCurrentActor()).toThrow(`but found 0`);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('found 0'),
        })
      );
      process.env.NODE_ENV = 'production';
      expect(worldContext.getCurrentActor()).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('found 0'),
        })
      );
    });

    it('should return null and log/throw error if more than one entity has the CURRENT_ACTOR component', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        playerEntity,
        npcActorEntity,
      ]);
      process.env.NODE_ENV = 'test';
      expect(() => worldContext.getCurrentActor()).toThrow(`but found 2`);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('found 2'),
        })
      );
      process.env.NODE_ENV = 'production';
      expect(worldContext.getCurrentActor()).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('found 2'),
        })
      );
    });
  });

  describe('getCurrentLocation', () => {
    beforeEach(() => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        playerEntity,
      ]);
    });

    it('should return the location entity when the current actor exists and has a valid position', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: LOCATION_1_ID,
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === LOCATION_1_ID ? location1Entity : undefined
      );
      const location = worldContext.getCurrentLocation();
      expect(location).toBe(location1Entity);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        PLAYER_ID,
        POSITION_COMPONENT_ID
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        LOCATION_1_ID
      );
    });

    it('should return null if the current actor cannot be determined (0 actors)', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      process.env.NODE_ENV = 'production';
      const location = worldContext.getCurrentLocation();
      expect(location).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot get location because current actor could not be determined'
        )
      );
    });

    it('should return null and log error if the current actor exists but lacks a POSITION component', () => {
      mockEntityManager.getComponentData.mockReturnValue(undefined);
      const location = worldContext.getCurrentLocation();
      expect(location).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            `Current actor '${PLAYER_ID}' is missing a valid '${POSITION_COMPONENT_ID}' component`
          ),
        })
      );
    });

    it('should return null and log error if the current actor exists but position data lacks a valid locationId', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        someOtherProp: 'value',
      });
      const location = worldContext.getCurrentLocation();
      expect(location).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            `Current actor '${PLAYER_ID}' is missing a valid '${POSITION_COMPONENT_ID}' component or locationId`
          ),
        })
      );
    });

    it('should return null and log warning if the actor position points to a non-existent location entity', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'nonexistent-location',
      });
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);
      const location = worldContext.getCurrentLocation();
      expect(location).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not find location entity INSTANCE with ID 'nonexistent-location' referenced by actor '${PLAYER_ID}'`
        )
      );
    });
  });

  describe('getLocationOfEntity', () => {
    it('should return the location entity for a given entityId with a valid position', () => {
      itemEntity.addComponent(POSITION_COMPONENT_ID, {
        locationId: LOCATION_2_ID,
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === ITEM_ID) return itemEntity;
        if (id === LOCATION_2_ID) return location2Entity;
        return undefined;
      });

      const location = worldContext.getLocationOfEntity(ITEM_ID);

      expect(location).toBe(location2Entity);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(ITEM_ID);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        LOCATION_2_ID
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return null if the entityId is invalid', () => {
      expect(worldContext.getLocationOfEntity(null)).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId provided: null')
      );
      jest.clearAllMocks();
      expect(worldContext.getLocationOfEntity('')).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId provided: ')
      );
    });

    it('should return null and log warning if the entity for entityId is not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);
      const location = worldContext.getLocationOfEntity(ITEM_ID);
      expect(location).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Entity with ID '${ITEM_ID}' not found.`)
      );
    });

    it('should return null if the entity does not have a POSITION component', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(itemEntity);
      const location = worldContext.getLocationOfEntity(ITEM_ID);
      expect(location).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity '${ITEM_ID}' has no position component.`
        )
      );
    });

    it('should return null and log warning if the entity position data lacks a valid locationId', () => {
      itemEntity.addComponent(POSITION_COMPONENT_ID, {
        someOtherProp: 'value',
      });
      mockEntityManager.getEntityInstance.mockReturnValue(itemEntity);

      const location = worldContext.getLocationOfEntity(ITEM_ID);

      expect(location).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity '${ITEM_ID}' has a position component but is missing a valid locationId`
        )
      );
    });

    it('should return null and log warning if the entity position points to a non-existent location entity', () => {
      itemEntity.addComponent(POSITION_COMPONENT_ID, {
        locationId: 'nonexistent-location',
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === ITEM_ID) return itemEntity;
        if (id === 'nonexistent-location') return undefined;
        return undefined;
      });

      const location = worldContext.getLocationOfEntity(ITEM_ID);

      expect(location).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not find location entity INSTANCE with ID 'nonexistent-location' referenced by entity '${ITEM_ID}'`
        )
      );
    });
  });
});
