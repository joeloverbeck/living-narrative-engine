// src/tests/core/worldContext.test.js
// --- FILE START ---

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import WorldContext from '../../core/worldContext.js'; // Adjust path if needed
import Entity from '../../entities/entity.js'; // Adjust path if needed
import {POSITION_COMPONENT_ID, CURRENT_ACTOR_COMPONENT_ID} from '../../constants/componentIds.js'; // Adjust path

// --- Mock Implementations ---

// We need a more complete mock for Entity Manager than just jest.fn()
const createMockEntityManager = () => ({
    // Method mocks
    getEntitiesWithComponent: jest.fn(),
    getComponentData: jest.fn(),
    getEntityInstance: jest.fn(),
    // Properties (if needed by other tested methods, not strictly by WorldContext itself)
    activeEntities: new Map(),
});

const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// --- Test Suite ---
describe('WorldContext (Stateless)', () => {
    let mockEntityManager;
    let mockLogger;
    let worldContext;

    // --- Test Entities ---
    const PLAYER_ID = 'player-1';
    const NPC_ACTOR_ID = 'npc-actor-1';
    const LOCATION_1_ID = 'location-start';
    const LOCATION_2_ID = 'location-room';
    const ITEM_ID = 'item-key'; // An entity without current_actor or position

    let playerEntity;
    let npcActorEntity;
    let location1Entity;
    let location2Entity;
    let itemEntity;

    // Store original NODE_ENV
    let originalNodeEnv;

    beforeEach(() => {
        mockEntityManager = createMockEntityManager();
        mockLogger = createMockLogger();

        // Default to 'test' environment for assertion throwing behavior
        originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test'; // Or 'development'

        worldContext = new WorldContext(mockEntityManager, mockLogger);

        // Create mock entity instances
        playerEntity = new Entity(PLAYER_ID);
        npcActorEntity = new Entity(NPC_ACTOR_ID);
        location1Entity = new Entity(LOCATION_1_ID);
        location2Entity = new Entity(LOCATION_2_ID);
        itemEntity = new Entity(ITEM_ID); // Doesn't need components for these tests

        // Reset mocks before each test
        jest.clearAllMocks();

        // Default mock setups (can be overridden in specific tests)
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([]); // Default: no actors
        mockEntityManager.getComponentData.mockReturnValue(undefined); // Default: no component data
        mockEntityManager.getEntityInstance.mockReturnValue(undefined); // Default: no entity found
    });

    afterEach(() => {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should throw if EntityManager is invalid or missing', () => {
            expect(() => new WorldContext(null, mockLogger)).toThrow('WorldContext requires a valid EntityManager instance.');
            expect(() => new WorldContext({}, mockLogger)).toThrow('WorldContext requires a valid EntityManager instance.');
        });

        it('should throw if Logger is invalid or missing', () => {
            expect(() => new WorldContext(mockEntityManager, null)).toThrow('WorldContext requires a valid ILogger instance.');
            expect(() => new WorldContext(mockEntityManager, {})).toThrow('WorldContext requires a valid ILogger instance.');
        });

        it('should successfully initialize with valid dependencies', () => {
            expect(() => new WorldContext(mockEntityManager, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('WorldContext: Initialized'));
        });
    });

    // --- getCurrentActor Tests ---
    describe('getCurrentActor', () => {
        it('should return the actor entity when exactly one entity has the CURRENT_ACTOR component', () => {
            mockEntityManager.getEntitiesWithComponent.mockReturnValue([playerEntity]);

            const actor = worldContext.getCurrentActor();

            expect(actor).toBe(playerEntity);
            expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(CURRENT_ACTOR_COMPONENT_ID);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return null and log/throw error if zero entities have the CURRENT_ACTOR component', () => {
            mockEntityManager.getEntitiesWithComponent.mockReturnValue([]); // Explicitly empty

            // Expecting throw because NODE_ENV is 'test'
            expect(() => {
                worldContext.getCurrentActor();
            }).toThrow(`WorldContext: Expected exactly one entity with component '${CURRENT_ACTOR_COMPONENT_ID}', but found 0.`);

            // Also verify the logger was called before the throw
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`found 0. (Throwing in dev mode)`));
            // Ensure it returns null if the throw is caught or if in production
            // To test production behaviour:
            process.env.NODE_ENV = 'production';
            const resultInProd = worldContext.getCurrentActor();
            expect(resultInProd).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`found 0. (Returning null in prod mode)`));

        });

        it('should return null and log/throw error if more than one entity has the CURRENT_ACTOR component', () => {
            mockEntityManager.getEntitiesWithComponent.mockReturnValue([playerEntity, npcActorEntity]);

            // Expecting throw because NODE_ENV is 'test'
            expect(() => {
                worldContext.getCurrentActor();
            }).toThrow(`WorldContext: Expected exactly one entity with component '${CURRENT_ACTOR_COMPONENT_ID}', but found 2.`);

            // Also verify the logger was called before the throw
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`found 2. (Throwing in dev mode)`));
            // Ensure it returns null if the throw is caught or if in production
            // To test production behaviour:
            process.env.NODE_ENV = 'production';
            const resultInProd = worldContext.getCurrentActor();
            expect(resultInProd).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`found 2. (Returning null in prod mode)`));
        });
    });

    // --- getCurrentLocation Tests ---
    describe('getCurrentLocation', () => {
        beforeEach(() => {
            // Assume player is the single current actor for most location tests
            mockEntityManager.getEntitiesWithComponent.mockReturnValue([playerEntity]);
        });

        it('should return the location entity when the current actor exists and has a valid position', () => {
            mockEntityManager.getComponentData.mockReturnValue({locationId: LOCATION_1_ID});
            mockEntityManager.getEntityInstance.mockReturnValue(location1Entity);

            const location = worldContext.getCurrentLocation();

            expect(location).toBe(location1Entity);
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(PLAYER_ID, POSITION_COMPONENT_ID);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(LOCATION_1_ID);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return null if the current actor cannot be determined (0 actors)', () => {
            mockEntityManager.getEntitiesWithComponent.mockReturnValue([]); // No actors

            process.env.NODE_ENV = 'production'; // Prevent throw, test return value
            const location = worldContext.getCurrentLocation();

            expect(location).toBeNull();
            // Error logged by getCurrentActor
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('found 0'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Cannot get location because current actor could not be determined'));
            expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });

        it('should return null and log error if the current actor exists but lacks a POSITION component', () => {
            mockEntityManager.getComponentData.mockReturnValue(undefined); // No position data

            const location = worldContext.getCurrentLocation();

            expect(location).toBeNull();
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(PLAYER_ID, POSITION_COMPONENT_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Current actor '${PLAYER_ID}' is missing a valid '${POSITION_COMPONENT_ID}' component`));
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });

        it('should return null and log error if the current actor exists but position data lacks a valid locationId', () => {
            mockEntityManager.getComponentData.mockReturnValue({someOtherProp: 'value'}); // Missing locationId

            const location = worldContext.getCurrentLocation();

            expect(location).toBeNull();
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(PLAYER_ID, POSITION_COMPONENT_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Current actor '${PLAYER_ID}' is missing a valid '${POSITION_COMPONENT_ID}' component or locationId`));
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });

        it('should return null and log warning if the actor position points to a non-existent location entity', () => {
            mockEntityManager.getComponentData.mockReturnValue({locationId: 'nonexistent-location'});
            mockEntityManager.getEntityInstance.mockReturnValue(undefined); // Location not found

            const location = worldContext.getCurrentLocation();

            expect(location).toBeNull();
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(PLAYER_ID, POSITION_COMPONENT_ID);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('nonexistent-location');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Could not find location entity with ID 'nonexistent-location' referenced by actor '${PLAYER_ID}'`));
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    // --- getLocationOfEntity Tests ---
    describe('getLocationOfEntity', () => {
        it('should return the location entity for a given entityId with a valid position', () => {
            mockEntityManager.getComponentData.mockReturnValue({locationId: LOCATION_2_ID});
            mockEntityManager.getEntityInstance.mockReturnValue(location2Entity);

            const location = worldContext.getLocationOfEntity(ITEM_ID);

            expect(location).toBe(location2Entity);
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(ITEM_ID, POSITION_COMPONENT_ID);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(LOCATION_2_ID);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return null if the entityId is invalid', () => {
            expect(worldContext.getLocationOfEntity(null)).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId provided: null'));

            jest.clearAllMocks();
            expect(worldContext.getLocationOfEntity('')).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId provided: '));

            expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });

        it('should return null if the entity does not have a POSITION component', () => {
            mockEntityManager.getComponentData.mockReturnValue(undefined); // No position data for itemEntity

            const location = worldContext.getLocationOfEntity(ITEM_ID);

            expect(location).toBeNull();
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(ITEM_ID, POSITION_COMPONENT_ID);
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn if component is just missing
        });

        it('should return null and log warning if the entity position data lacks a valid locationId', () => {
            mockEntityManager.getComponentData.mockReturnValue({someOtherProp: 'value'}); // Missing locationId

            const location = worldContext.getLocationOfEntity(ITEM_ID);

            expect(location).toBeNull();
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(ITEM_ID, POSITION_COMPONENT_ID);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Entity '${ITEM_ID}' has a position component but is missing a valid locationId`));
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });

        it('should return null and log warning if the entity position points to a non-existent location entity', () => {
            mockEntityManager.getComponentData.mockReturnValue({locationId: 'nonexistent-location'});
            mockEntityManager.getEntityInstance.mockReturnValue(undefined); // Location not found

            const location = worldContext.getLocationOfEntity(ITEM_ID);

            expect(location).toBeNull();
            expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(ITEM_ID, POSITION_COMPONENT_ID);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('nonexistent-location');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Could not find location entity with ID 'nonexistent-location' referenced by entity '${ITEM_ID}'`));
        });
    });
});
// --- FILE END ---