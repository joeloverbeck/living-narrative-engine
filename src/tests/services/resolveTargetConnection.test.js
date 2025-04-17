// src/tests/resolveTargetConnection.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Import ConnectionsComponent
import {
    resolveTargetConnection,
    // Import findPotentialConnectionMatches if needed for mocking/spying
} from '../../services/connectionResolver.js';
// Import necessary for helper functions, even if not directly tested here yet
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {EVENT_DISPLAY_MESSAGE} from "../../types/eventTypes.js"; // Import TARGET_MESSAGES


// ========================================================================
// == Test Setup: Mocks and Environment ===================================
// ========================================================================

// --- Mocks ---
// mockContext.dispatch mock
const mockDispatch = jest.fn();

// Mock EntityManager
const mockEntityManager = {
    entities: new Map(),
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    locations: new Map(), // Map<locationId, Set<entityId>> - Used by placeInLocation helper
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
};

// --- Mock EventBus ---  <-- ADD THIS
const mockEventBus = {
    dispatch: mockDispatch,
};

// --- Mock Entities (defined with let for beforeEach reassignment) ---
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
// mock ActionContext object (mockContext)
const mockContext = {
    // dispatch: mockDispatch, // You might be able to remove this top-level one if ONLY eventBus.dispatch is used by the function. Keep it for now if unsure.
    entityManager: mockEntityManager,
    playerEntity: null,
    currentLocation: null,
    targets: [],
    dataManager: {},
    eventBus: mockEventBus, // <-- ADD THIS LINE
};

// --- Helper Functions ---

/**
 * Helper function to create mock entities.
 * Instantiates an Entity, adds NameComponent, stores it in the mock EntityManager,
 * and optionally adds other components.
 * @param {string} id - The entity ID.
 * @param {string} name - The value for the NameComponent.
 * @param {Component[]} [components=[]] - An array of additional component instances to add.
 * @returns {Entity} The created mock entity.
 */
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity); // Store in mock manager
    return entity;
};

/**
 * Helper to simulate placing an entity in a location within the mock EntityManager.
 * Adds the entityId to the location's set in `mockEntityManager.locations`
 * and updates/adds a PositionComponent to the entity.
 * (Present in original code, useful for setting up context, kept)
 * @param {string} entityId - The ID of the entity to place.
 * @param {string} locationId - The ID of the location entity.
 */
const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId)?.add(entityId); // Use optional chaining

    const entity = mockEntityManager.entities.get(entityId);
    if (entity) {
        let posComp = entity.getComponent(PositionComponent);
        if (!posComp) {
            posComp = new PositionComponent({locationId: locationId});
            entity.addComponent(posComp);
        } else {
            posComp.setLocation(locationId); // Assuming PositionComponent has a setLocation method
        }
    }
};

// --- Global Setup ---
beforeEach(() => {
    // Clear/Reset Mocks and Data
    mockDispatch.mockClear();
    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear(); // Reset supporting mock data too

    // Reset mock function implementations (important!)
    jest.clearAllMocks(); // Clears spies and mocks defined with jest.spyOn or jest.mock
    // Re-apply simple implementations after jest.clearAllMocks
    mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());


    // Create *fresh* mock entities for each test
    mockPlayerEntity = createMockEntity('player-1', 'Tester');
    mockCurrentLocation = createMockEntity('loc-lobby', 'Lobby');

    // Place the player in the location (common setup)
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id);

    // Assign fresh instances to mockContext
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = []; // Reset targets array if used
});

// ========================================================================
// == Tests for resolveTargetConnection Utility Function ==================
// ========================================================================

// Top-level describe block for resolveTargetConnection
describe('resolveTargetConnection', () => {

    // --- Tests for Input Validation (CONN-5.1.4.2 - Assumed Implemented) ---
    describe('Input Validation', () => {
        test('should return null and not dispatch when connectionTargetName is null', () => {
            const targetName = null;
            const result = resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        test('should return null and not dispatch when connectionTargetName is undefined', () => {
            const targetName = undefined;
            const result = resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        test('should return null and not dispatch when connectionTargetName is an empty string', () => {
            const targetName = '';
            const result = resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        test('should return null and not dispatch when connectionTargetName is only whitespace', () => {
            const targetName = '   ';
            const result = resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    }); // End Input Validation describe

    // --- Tests for Successful Resolution (CONN-5.1.4.3 - Assumed Implemented) ---
    describe('Successful Resolution (Happy Path)', () => {
        // --- Mock Entities specific to these tests ---
        let mockNorthEntity;
        let mockSouthEntity;
        let mockWestDoorEntity;
        let mockEastDirectionEntity; // For priority test (matches direction 'east')
        let mockUpNameEntity;      // For priority test (matches name 'east')

        beforeEach(() => {
            // Create specific connection entities needed for the success scenarios
            mockNorthEntity = createMockEntity('conn-north', 'North Passage');
            mockSouthEntity = createMockEntity('conn-south', 'South Archway');
            mockWestDoorEntity = createMockEntity('conn-west-door', 'Wooden Door'); // Name matches 'door'
            mockEastDirectionEntity = createMockEntity('conn-east-dir', 'East Corridor'); // Direction 'east'
            mockUpNameEntity = createMockEntity('conn-up-name', 'East Passage'); // Name 'east passage', Direction 'up'


            // Add ConnectionsComponent to the current location
            const connectionsComp = new ConnectionsComponent({
                connections: {
                    // For AC1 (Direction Match)
                    north: mockNorthEntity.id,
                    south: mockSouthEntity.id,

                    // For AC2 (Name Match)
                    west: mockWestDoorEntity.id, // Direction 'west', Name 'Wooden Door'

                    // For AC3 (Prioritization)
                    east: mockEastDirectionEntity.id, // Direction 'east', Name 'East Corridor'
                    up: mockUpNameEntity.id,         // Direction 'up', Name 'East Passage'
                }
            });
            mockCurrentLocation.addComponent(connectionsComp);
        });

        // --- AC1: Direction Match ---
        describe('AC1: Direction Match', () => {
            test.each([
                ['north'], ['NORTH'], [' north '], [' NoRtH ']
            ])('should return the correct entity for direction input "%s"', (input) => {
                const result = resolveTargetConnection(mockContext, input);
                expect(result).toBe(mockNorthEntity);
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        });

        // --- AC2: Name Match (No Direction Match) ---
        describe('AC2: Name Match (No Direction Match)', () => {
            test.each([
                ['wooden door'], ['WOODEN DOOR'], [' door '], ['DOOR'], ['wooden'],
            ])('should return the correct entity for name input "%s" when no direction matches', (input) => {
                const result = resolveTargetConnection(mockContext, input);
                expect(result).toBe(mockWestDoorEntity);
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        });

        // --- AC3: Prioritization (Direction over Name) ---
        describe('AC3: Prioritization (Direction over Name)', () => {
            test('should return the entity matched by direction when input matches both a direction and a different entity\'s name', () => {
                const input = 'east';
                const result = resolveTargetConnection(mockContext, input);
                expect(result).toBe(mockEastDirectionEntity);
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        });

    }); // End Successful Resolution describe

    // --- Tests for Ambiguity Scenarios (CONN-5.1.4.4 - Assumed Implemented) ---
    // --- Tests for Ambiguity Scenarios (CONN-5.1.4.4 - Assumed Implemented) ---
    describe('Ambiguity Scenarios', () => {

        // --- AC1: Ambiguous Direction ---
        describe('AC1: Ambiguous Direction', () => {
            let mockWestGateEntity;
            let mockWestArchEntity;
            let mockFindPotentialMatchesFn; // Local mock function for the dependency

            beforeEach(() => {
                mockWestGateEntity = createMockEntity('conn-wg', 'West Gate');
                mockWestArchEntity = createMockEntity('conn-wa', 'Western Arch');

                // --- CREATE AND CONFIGURE THE MOCK FUNCTION ---
                mockFindPotentialMatchesFn = jest.fn();
                mockFindPotentialMatchesFn.mockReturnValue({
                    directionMatches: [
                        {direction: 'west', connectionEntity: mockWestGateEntity},
                        {direction: 'west', connectionEntity: mockWestArchEntity}
                    ],
                    nameMatches: [],
                });
                // No ConnectionsComponent needed on mockCurrentLocation for this specific test
            });

            test('should return null and dispatch AMBIGUOUS_DIRECTION when input matches multiple direction keys', () => {
                const ambiguousInput = 'west';
                const expectedNames = [getDisplayName(mockWestGateEntity), getDisplayName(mockWestArchEntity)];
                const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(ambiguousInput, expectedNames);

                // **** PASS THE MOCK FUNCTION AS THE LAST ARGUMENT ****
                const result = resolveTargetConnection(
                    mockContext,
                    ambiguousInput,
                    'go', // default actionVerb
                    mockFindPotentialMatchesFn // Provide the mock dependency
                );

                expect(result).toBeNull();
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    expect.objectContaining({
                        text: expectedMsg,
                        type: 'warning'
                    })
                );
                // Verify the mock function *we passed in* was called
                expect(mockFindPotentialMatchesFn).toHaveBeenCalledWith(mockContext, ambiguousInput);
            });
        });

        // --- AC2: Ambiguous Name (No Direction Match) ---
        describe('AC2: Ambiguous Name (No Direction Match)', () => {
            let mockNarrowPathEntity;
            let mockWidePathEntity;
            let mockOtherConnectionEntity;

            beforeEach(() => {
                mockNarrowPathEntity = createMockEntity('conn-np', 'Narrow Path'); // Matches 'path'
                mockWidePathEntity = createMockEntity('conn-wp', 'Wide Path');   // Matches 'path'
                mockOtherConnectionEntity = createMockEntity('conn-east', 'East Gate');

                const connectionsComp = new ConnectionsComponent({
                    connections: {
                        north: mockNarrowPathEntity.id,
                        south: mockWidePathEntity.id,
                        east: mockOtherConnectionEntity.id
                    }
                });
                mockCurrentLocation.addComponent(connectionsComp);
            });

            test('should return null and dispatch TARGET_AMBIGUOUS_CONTEXT when input matches multiple names but no directions', () => {
                const ambiguousInput = 'path';
                const actionVerb = 'go'; // Use the default verb or specify
                const expectedMatches = [mockNarrowPathEntity, mockWidePathEntity].sort((a, b) => a.id.localeCompare(b.id));
                const expectedMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, ambiguousInput, expectedMatches);

                const result = resolveTargetConnection(mockContext, ambiguousInput, actionVerb);

                expect(result).toBeNull();
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                // Check against the specifically formatted message
                expect(mockDispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    expect.objectContaining({
                        text: expectedMsg,
                        type: 'warning'
                    })
                );
                // Broader check for content if message format might vary slightly
                expect(mockDispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    expect.objectContaining({
                        type: 'warning',
                        text: expect.stringContaining(`Which '${ambiguousInput}' did you want to ${actionVerb}?`),
                        text: expect.stringContaining(getDisplayName(mockNarrowPathEntity)),
                        text: expect.stringContaining(getDisplayName(mockWidePathEntity)),
                    })
                );
            });
        });

    }); // End Ambiguity Scenarios describe

    // ========================================================================
    // == Tests for Not Found & Edge Cases (CONN-5.1.4.5) ====================
    // ========================================================================
    describe('Not Found and Edge Cases', () => {

        // --- AC1: No Match ---
        test('AC1: should return null and dispatch Not Found when input matches no connections', () => {
            // Arrange: Setup a location with some connections
            const mockNorthEntity = createMockEntity('conn-n', 'North Exit');
            const mockPortalEntity = createMockEntity('conn-portal', 'Magic Portal');
            const connectionsComp = new ConnectionsComponent({
                connections: {
                    north: mockNorthEntity.id,
                    portal: mockPortalEntity.id, // Name: 'Magic Portal'
                }
            });
            mockCurrentLocation.addComponent(connectionsComp);
            const targetName = 'teleporter'; // Input that doesn't match 'north' or 'portal' or 'magic portal'
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            // Act
            const result = resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull(); // AC1: returns null
            expect(mockDispatch).toHaveBeenCalledTimes(1); // AC1: dispatch called once
            expect(mockDispatch).toHaveBeenCalledWith( // AC1: dispatch details
                EVENT_DISPLAY_MESSAGE,
                expect.objectContaining({
                    text: expectedMsg,
                    type: 'info' // Not found is usually 'info' type
                })
            );
        });

        // --- AC2: Empty Connections Map ---
        test('AC2: should return null and dispatch Not Found when location has ConnectionsComponent but no connections', () => {
            // Arrange: Add ConnectionsComponent but don't populate it (or clear it)
            const connectionsComp = new ConnectionsComponent({}); // Initialize empty
            // OR: connectionsComp = new ConnectionsComponent({ connections: { north: 'id' } }); connectionsComp.clearConnections();
            mockCurrentLocation.addComponent(connectionsComp);
            const targetName = 'north'; // Any target name
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            // Act
            const result = resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull(); // AC2: returns null
            expect(mockDispatch).toHaveBeenCalledTimes(1); // AC2: dispatch called once
            expect(mockDispatch).toHaveBeenCalledWith( // AC2: dispatch details
                EVENT_DISPLAY_MESSAGE,
                expect.objectContaining({
                    text: expectedMsg,
                    type: 'info'
                })
            );
        });

        // --- AC3: Missing Connections Component ---
        test('AC3: should return null and dispatch Not Found when location has no ConnectionsComponent', () => {
            // Arrange: Ensure mockCurrentLocation does *not* have ConnectionsComponent
            // (It doesn't by default after beforeEach)
            const targetName = 'east'; // Any target name
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            // Act
            const result = resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull(); // AC3: returns null
            expect(mockDispatch).toHaveBeenCalledTimes(1); // AC3: dispatch called once
            expect(mockDispatch).toHaveBeenCalledWith( // AC3: dispatch details
                EVENT_DISPLAY_MESSAGE,
                expect.objectContaining({
                    text: expectedMsg,
                    type: 'info'
                })
            );
        });

        // --- AC4: Dangling Connection ID ---
        test('AC4: should return null and dispatch Not Found when connection ID points to non-existent entity', () => {
            // Arrange: Setup with a connection pointing to a missing ID
            const danglingId = 'conn-missing';
            const connectionsComp = new ConnectionsComponent({
                connections: {
                    up: danglingId, // This connection entity won't be found
                    // Optionally add another valid connection to ensure the missing one is the issue
                    // south: createMockEntity('conn-s', 'South Path').id
                }
            });
            mockCurrentLocation.addComponent(connectionsComp);

            // Configure EntityManager mock to return null for the dangling ID
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === danglingId) {
                    return null; // Or undefined
                }
                // Fallback to the default implementation for other IDs (like the location itself)
                return mockEntityManager.entities.get(id);
            });

            const targetName = 'up'; // Target the direction with the dangling ID
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            // Act
            const result = resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull(); // AC4: returns null (because 'up' match failed to resolve)
            expect(mockDispatch).toHaveBeenCalledTimes(1); // AC4: dispatch called once
            expect(mockDispatch).toHaveBeenCalledWith( // AC4: dispatch details
                EVENT_DISPLAY_MESSAGE,
                expect.objectContaining({
                    text: expectedMsg,
                    type: 'info'
                })
            );
            // Verify getEntityInstance was called with the dangling ID
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(danglingId);
        });

    }); // End Not Found and Edge Cases describe

    // --- Test for Basic Setup Verification (from CONN-5.1.4.1 - Kept for completeness) ---
    describe('Setup Verification', () => {
        test('test setup should complete without errors', () => {
            // Assert that the basic context setup in beforeEach worked
            expect(mockContext).toBeDefined();
            expect(mockContext.eventBus.dispatch).toBe(mockDispatch);
            expect(mockContext.entityManager).toBe(mockEntityManager);
            expect(mockContext.playerEntity).toBeInstanceOf(Entity);
            expect(mockContext.playerEntity.id).toBe('player-1');
            expect(mockContext.currentLocation).toBeInstanceOf(Entity);
            expect(mockContext.currentLocation.id).toBe('loc-lobby');
            expect(mockEntityManager.entities.has('player-1')).toBe(true);
            expect(mockEntityManager.entities.has('loc-lobby')).toBe(true);
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
            expect(mockDispatch).not.toHaveBeenCalled();
            expect(mockEntityManager.locations.get('loc-lobby')?.has('player-1')).toBe(true);
        });
    }); // End Setup Verification describe

}); // End describe for resolveTargetConnection