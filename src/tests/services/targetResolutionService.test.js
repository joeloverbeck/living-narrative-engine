// src/tests/services/targetResolutionService.test.js

// ** Imports for Jest and Core Testing Utilities **
import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

// ** Import Service Functions & Class Under Test (Excluding resolveItemTarget logic) **
import {
    resolveTargetEntity,
    findPotentialConnectionMatches,
    resolveTargetConnection,
    // Assuming internalFindPotentialConnectionMatches might be needed for resolveTargetConnection tests
    internalFindPotentialConnectionMatches
} from '../../services/targetResolutionService.js';

// ** Import Core Entities/Components needed for remaining tests **
import Entity from '../../entities/entity.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js'; // Needed for resolveTargetEntity (inventory/nearby scope)
import {EquipmentComponent} from '../../components/equipmentComponent.js'; // Needed for resolveTargetEntity (equipment/nearby scope)
import {ItemComponent} from '../../components/itemComponent.js'; // Needed for resolveTargetEntity (location_items scope, etc.)

// ** Import Utilities **
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js'; // Likely used by message dispatching in remaining functions

// ** Import Types needed for remaining tests **
/** @typedef {import('../../core/eventBus.js').default} EventBus */ // Needed for mock
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */ // Needed for mock
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */ // Likely context type for remaining functions
/** @typedef {import('../../components/baseComponent.js').ComponentConstructor} ComponentConstructor */ // For resolveTargetEntity config
/** @typedef {import('../../services/targetResolutionService.js').TargetResolverConfig} TargetResolverConfig */ // For resolveTargetEntity
/** @typedef {import('../../services/targetResolutionService.js').FetchedConnectionData} FetchedConnectionData */ // For connection functions
/** @typedef {import('../../services/targetResolutionService.js').PotentialConnectionMatches} PotentialConnectionMatches */ // For connection functions
// ** NOTE: Removed UsableComponentData and ConditionEvaluationService types as they were specific to resolveItemTarget **

// --- Mocks Needed for Remaining Functions ---
const mockEventBusDispatch = jest.fn();
const mockEntityManager = {
    entities: new Map(),
    getEntityInstance: jest.fn((entityId) => mockEntityManager.entities.get(entityId)),
    // Mock getEntitiesInLocation needed by resolveTargetEntity
    getEntitiesInLocation: jest.fn((locationId) => {
        const ids = [];
        for (const entity of mockEntityManager.entities.values()) {
            // Simple mock implementation - assumes entity has PositionComponent if in a location
            const pos = entity.getComponent(PositionComponent);
            if (pos && pos.locationId === locationId) {
                ids.push(entity.id);
            }
        }
        return ids;
    }),
    // Add other EntityManager mocks if required by resolveTargetEntity, findPotentialConnectionMatches, etc.
};
// ** NOTE: Removed mockConditionEvaluationService as it's not used by remaining functions here **

// --- Mock Entities (Declare variables needed commonly for remaining tests) ---
let mockPlayerEntity; // Likely needed for resolveTargetEntity/resolveTargetConnection
let mockCurrentLocation; // Likely needed for resolveTargetEntity/resolveTargetConnection

// --- Service Instance (Optional - only if testing other *methods* of TargetResolutionService class) ---
// const targetResolutionService = new TargetResolutionService();

// --- Helper Functions (Still useful for setting up remaining tests) ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

const setupLocationConnections = (locationEntity, connections = []) => {
    let connectionsComp = locationEntity.getComponent(ConnectionsComponent);

    if (!connectionsComp) {
        // Create a new, empty ConnectionsComponent if it doesn't exist
        connectionsComp = new ConnectionsComponent({}); // Pass empty data, constructor handles this correctly
        locationEntity.addComponent(connectionsComp);
    } else {
        // Clear existing connections if the component was already there (good practice for tests)
        connectionsComp.clearConnections();
    }

    // Now, add connections using the component's public addConnection method
    connections.forEach(conn => {
        // Basic validation for the data structure passed to the helper
        if (conn && typeof conn.direction === 'string' && typeof conn.connectionEntityId === 'string') {
            // addConnection handles trimming and lowercasing the direction internally
            connectionsComp.addConnection(conn.direction, conn.connectionEntityId);
        } else {
            console.warn("setupLocationConnections: Skipping invalid connection data format in input array:", conn);
        }
    });

    // Ensure the entity manager's map is updated (important if component was added/modified)
    mockEntityManager.entities.set(locationEntity.id, locationEntity);
};

const placeInLocation = (entity, locationId) => {
    let posComp = entity.getComponent(PositionComponent);
    if (!posComp) {
        posComp = new PositionComponent({locationId: locationId});
        entity.addComponent(posComp);
    } else {
        if (typeof posComp.setLocation === 'function') {
            posComp.setLocation(locationId);
        } else {
            posComp.locationId = locationId; // Direct update if no setter
        }
    }
    mockEntityManager.entities.set(entity.id, entity); // Ensure map is updated
};
// --- End Helper Functions ---


// --- Global Setup for Remaining Tests ---
beforeEach(() => {
    // Clear mocks relevant to remaining tests
    jest.clearAllMocks();
    mockEntityManager.entities.clear();
    // mockEntityManager.getEntityInstance.mockClear(); // jest.clearAllMocks() handles this
    // mockEntityManager.getEntitiesInLocation?.mockClear(); // jest.clearAllMocks() handles this
    // mockEventBusDispatch.mockClear(); // jest.clearAllMocks() handles this

    // Setup common entities potentially needed by multiple test suites below
    mockPlayerEntity = createMockEntity('player-user', 'Player');
    mockCurrentLocation = createMockEntity('loc-room', 'A Room');
    placeInLocation(mockPlayerEntity, mockCurrentLocation.id);
});

// ========================================================================
// == Tests for TargetResolutionService (Excluding resolveItemTarget) ===
// ========================================================================
describe('TargetResolutionService (Core Functions)', () => {

    // =======================================================
    // == Test Suite for resolveTargetEntity ===
    // =======================================================
    describe('resolveTargetEntity', () => {
        // --- Add tests specific to resolveTargetEntity ---

        test('should find an entity in the current location by name', () => {
            // Arrange
            const targetItem = createMockEntity('item-box', 'Cardboard Box', [new ItemComponent({})]);
            placeInLocation(targetItem, mockCurrentLocation.id); // Place item in the same room as player

            const context = {
                playerEntity: mockPlayerEntity,
                currentLocation: mockCurrentLocation,
                entityManager: mockEntityManager,
                dispatch: mockEventBusDispatch,
            };
            const config = {
                scope: 'location', // Search the location
                requiredComponents: [ItemComponent], // Must be an item
                actionVerb: 'examine',
                targetName: 'box', // Target name
            };

            // Act
            const result = resolveTargetEntity(context, config);

            // Assert
            expect(result).toBe(targetItem);
            expect(mockEventBusDispatch).not.toHaveBeenCalled(); // No ambiguity or not found messages
            expect(mockEntityManager.getEntitiesInLocation).toHaveBeenCalledWith(mockCurrentLocation.id);
        });

        test('should return null and dispatch message if target not found in scope', () => {
            // Arrange
            const context = {
                playerEntity: mockPlayerEntity,
                currentLocation: mockCurrentLocation,
                entityManager: mockEntityManager,
                dispatch: mockEventBusDispatch,
            };
            const config = {
                scope: 'inventory', // Search inventory
                requiredComponents: [ItemComponent],
                actionVerb: 'drop',
                targetName: 'nonexistent', // Target doesn't exist
            };
            // Add expected message generation (might depend on TARGET_MESSAGES content)
            // const expectedMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY('nonexistent'); // Example

            // Act
            const result = resolveTargetEntity(context, config);

            // Assert
            expect(result).toBeNull();
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            // expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({ text: expectedMsg, type: 'info' }));
            // Verify the specific message based on TARGET_MESSAGES contents and logic within resolveTargetEntity
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'info'})); // General check
        });

        test('should handle ambiguous targets and dispatch warning', () => {
            // Arrange
            const box1 = createMockEntity('box-1', 'Wooden Box', [new ItemComponent({})]);
            const box2 = createMockEntity('box-2', 'Wooden Box', [new ItemComponent({})]);
            placeInLocation(box1, mockCurrentLocation.id);
            placeInLocation(box2, mockCurrentLocation.id);

            const context = {
                playerEntity: mockPlayerEntity,
                currentLocation: mockCurrentLocation,
                entityManager: mockEntityManager,
                dispatch: mockEventBusDispatch,
            };
            const config = {
                scope: 'location',
                requiredComponents: [ItemComponent],
                actionVerb: 'take',
                targetName: 'box', // Ambiguous name
            };
            // Add expected message generation if needed
            // const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('take', 'box', [box1, box2]); // Example

            // Act
            const result = resolveTargetEntity(context, config);

            // Assert
            expect(result).toBeNull();
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            // expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({ text: expectedMsg, type: 'warning' }));
            // Verify the specific message based on TARGET_MESSAGES contents and logic within resolveTargetEntity
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'warning'})); // General check
        });

        // --- Add more tests for: ---
        // Different scopes ('inventory', 'equipment', 'location_items', 'location_non_items', 'nearby')
        // Different requiredComponents combinations
        // Custom filters
        // Specific message overrides (notFoundMessageKey, emptyScopeMessage)
        // Edge cases (empty target name, invalid scope)

    }); // End describe('resolveTargetEntity')


    // =======================================================
    // == Test Suite for findPotentialConnectionMatches ===
    // =======================================================
    describe('findPotentialConnectionMatches', () => {
        // --- Add tests specific to findPotentialConnectionMatches ---
        // Test setup will involve creating mock connection entities and
        // using setupLocationConnections on mockCurrentLocation.

        test('should find a connection by exact direction match (case-insensitive)', () => {
            // Arrange
            const connNorth = createMockEntity('conn-n', 'North Exit');
            setupLocationConnections(mockCurrentLocation, [
                {direction: 'north', connectionEntityId: connNorth.id}
            ]);
            const context = {currentLocation: mockCurrentLocation, entityManager: mockEntityManager}; // Simplified context needed
            const targetName = 'NORTH'; // Case-insensitive target

            // Act
            const result = findPotentialConnectionMatches(context, targetName);

            // Assert
            expect(result.directionMatches).toHaveLength(1);
            expect(result.directionMatches[0].connectionEntity).toBe(connNorth);
            expect(result.directionMatches[0].direction).toBe('north'); // Should store normalized direction
            expect(result.nameMatches).toHaveLength(0);
        });

        test('should find connections by partial name match (case-insensitive)', () => {
            // Arrange
            const connDoor = createMockEntity('conn-d', 'Heavy Door');
            const connWindow = createMockEntity('conn-w', 'Open Window'); // Does not match 'door'
            setupLocationConnections(mockCurrentLocation, [
                {direction: 'east', connectionEntityId: connDoor.id},
                {direction: 'west', connectionEntityId: connWindow.id}
            ]);
            const context = {currentLocation: mockCurrentLocation, entityManager: mockEntityManager};
            const targetName = 'door'; // Partial, case-insensitive target

            // Act
            const result = findPotentialConnectionMatches(context, targetName);

            // Assert
            expect(result.directionMatches).toHaveLength(0);
            expect(result.nameMatches).toHaveLength(1);
            expect(result.nameMatches[0].connectionEntity).toBe(connDoor);
            expect(result.nameMatches[0].direction).toBe('east');
        });

        test('should return both direction and name matches if applicable', () => {
            // Arrange
            const connNorthDoor = createMockEntity('conn-nd', 'North Door'); // Matches direction 'north' and name 'door'
            const connEastDoor = createMockEntity('conn-ed', 'East Door');   // Matches name 'door' only
            setupLocationConnections(mockCurrentLocation, [
                {direction: 'north', connectionEntityId: connNorthDoor.id},
                {direction: 'east', connectionEntityId: connEastDoor.id}
            ]);
            const context = {currentLocation: mockCurrentLocation, entityManager: mockEntityManager};

            // Act: Search for 'north'
            const resultNorth = findPotentialConnectionMatches(context, 'north');
            // Act: Search for 'door'
            const resultDoor = findPotentialConnectionMatches(context, 'door');

            // Assert North Search
            expect(resultNorth.directionMatches).toHaveLength(1);
            expect(resultNorth.directionMatches[0].connectionEntity).toBe(connNorthDoor);
            expect(resultNorth.nameMatches).toHaveLength(0); // Name 'North Door' doesn't contain 'north'

            // Assert Door Search
            expect(resultDoor.directionMatches).toHaveLength(0);
            expect(resultDoor.nameMatches).toHaveLength(2); // Both entities have 'Door' in name
            // Check if both entities are present (order might vary)
            expect(resultDoor.nameMatches.map(m => m.connectionEntity)).toEqual(expect.arrayContaining([connNorthDoor, connEastDoor]));
        });

        // --- Add more tests for: ---
        // No matches found
        // Multiple direction matches
        // Multiple name matches
        // Edge cases (empty location, location without ConnectionsComponent, connection entity fetch failures)

    }); // End describe('findPotentialConnectionMatches')


    // =======================================================
    // == Test Suite for resolveTargetConnection ===
    // =======================================================
    describe('resolveTargetConnection', () => {
        // --- Add tests specific to resolveTargetConnection ---
        // These tests will likely involve mocking the 'findPotentialConnectionMatches' function
        // passed as an argument or relying on its actual implementation with pre-set mock data.

        test('should prioritize and return unique direction match', () => {
            // Arrange
            const connNorth = createMockEntity('conn-n', 'North Door');
            const mockFindMatches = jest.fn().mockReturnValue({
                directionMatches: [{direction: 'north', connectionEntity: connNorth}],
                nameMatches: [] // Assume no name match for simplicity
            });
            const context = {dispatch: mockEventBusDispatch}; // Only dispatch needed directly by resolveTargetConnection
            const targetName = 'north';

            // Act
            const result = resolveTargetConnection(context, targetName, 'go', mockFindMatches);

            // Assert
            expect(result).toBe(connNorth);
            expect(mockFindMatches).toHaveBeenCalledWith(context, targetName);
            expect(mockEventBusDispatch).not.toHaveBeenCalled(); // No ambiguity/not found
        });

        test('should return null and dispatch warning for ambiguous direction matches', () => {
            // Arrange
            const connNorth1 = createMockEntity('conn-n1', 'North Exit 1');
            const connNorth2 = createMockEntity('conn-n2', 'North Exit 2');
            const mockFindMatches = jest.fn().mockReturnValue({
                directionMatches: [ // << Ambiguous direction
                    {direction: 'north', connectionEntity: connNorth1},
                    {direction: 'north', connectionEntity: connNorth2}
                ],
                nameMatches: []
            });
            const context = {dispatch: mockEventBusDispatch};
            const targetName = 'north';

            // Act
            const result = resolveTargetConnection(context, targetName, 'go', mockFindMatches);

            // Assert
            expect(result).toBeNull();
            expect(mockFindMatches).toHaveBeenCalledWith(context, targetName);
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'warning'}));
            // Could add more specific check for TARGET_MESSAGES.AMBIGUOUS_DIRECTION message if needed
        });

        test('should fallback to and return unique name match if no direction match', () => {
            // Arrange
            const connDoor = createMockEntity('conn-d', 'Wooden Door');
            const mockFindMatches = jest.fn().mockReturnValue({
                directionMatches: [], // << No direction match
                nameMatches: [{direction: 'east', connectionEntity: connDoor}] // << Unique name match
            });
            const context = {dispatch: mockEventBusDispatch};
            const targetName = 'door';

            // Act
            const result = resolveTargetConnection(context, targetName, 'go', mockFindMatches);

            // Assert
            expect(result).toBe(connDoor);
            expect(mockFindMatches).toHaveBeenCalledWith(context, targetName);
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        test('should return null and dispatch warning for ambiguous name matches (no direction match)', () => {
            // Arrange
            const connDoor1 = createMockEntity('conn-d1', 'Wooden Door');
            const connDoor2 = createMockEntity('conn-d2', 'Iron Door');
            const mockFindMatches = jest.fn().mockReturnValue({
                directionMatches: [], // << No direction match
                nameMatches: [ // << Ambiguous name match
                    {direction: 'east', connectionEntity: connDoor1},
                    {direction: 'south', connectionEntity: connDoor2}
                ]
            });
            const context = {dispatch: mockEventBusDispatch};
            const targetName = 'door';

            // Act
            const result = resolveTargetConnection(context, targetName, 'go', mockFindMatches);

            // Assert
            expect(result).toBeNull();
            expect(mockFindMatches).toHaveBeenCalledWith(context, targetName);
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'warning'}));
            // Could add more specific check for TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT message
        });

        test('should return null and dispatch info if no direction or name matches found', () => {
            // Arrange
            const mockFindMatches = jest.fn().mockReturnValue({
                directionMatches: [], // << No direction match
                nameMatches: [] // << No name match
            });
            const context = {dispatch: mockEventBusDispatch};
            const targetName = 'portal';
            // const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName); // Example

            // Act
            const result = resolveTargetConnection(context, targetName, 'go', mockFindMatches);

            // Assert
            expect(result).toBeNull();
            expect(mockFindMatches).toHaveBeenCalledWith(context, targetName);
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            // expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({ text: expectedMsg, type: 'info' }));
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'info'}));
        });

        // --- Add more tests for: ---
        // Different action verbs
        // Edge cases (empty target name)
        // Interaction with the *actual* findPotentialConnectionMatches (integration-style test)

    }); // End describe('resolveTargetConnection')


}); // End describe('TargetResolutionService (Core Functions)')