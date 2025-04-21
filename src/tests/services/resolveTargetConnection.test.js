// src/tests/services/resolveTargetConnection.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import Entity from '../../entities/entity.js';
// NOTE: Component class imports are no longer needed if they don't exist

// **** START CHANGE ****
// Import Component Type IDs from the central types file
// Adjust the path '../../types/components.js' if it's different in your structure
import {
    NAME_COMPONENT_TYPE_ID,
    POSITION_COMPONENT_ID,
    CONNECTIONS_COMPONENT_TYPE_ID,
    PASSAGE_DETAILS_COMPONENT_TYPE_ID // Import this if findPotentialConnectionMatches uses it for blockers
} from '../../types/components.js';
// **** END CHANGE ****

import {
    resolveTargetConnection,
    // Import findPotentialConnectionMatches if mocking directly
} from '../../services/connectionResolver.js';
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';

// Add other component type IDs used in tests here...
// const PASSAGE_DETAILS_COMPONENT_TYPE_ID = 'core:passage_details'; // Example

// ========================================================================
// == Test Setup: Mocks and Environment ===================================
// ========================================================================

// --- Mocks ---
const mockEventBusDispatch = jest.fn();
const mockValidatedDispatcher = {
    dispatchValidated: jest.fn(async (eventType, payload) => {
        mockEventBusDispatch(eventType, payload);
        return Promise.resolve();
    }),
};
const mockLogger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockEntityManager = {
    entities: new Map(),
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    locations: new Map(),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
};
const mockEventBus = {
    dispatch: mockEventBusDispatch,
};

// --- Mock Entities ---
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
const mockContext = {
    entityManager: mockEntityManager,
    playerEntity: null,
    currentLocation: null,
    targets: [],
    gameDataRepository: {},
    eventBus: mockEventBus,
    validatedDispatcher: mockValidatedDispatcher,
    logger: mockLogger,
};

// --- Helper Functions (Updated for Plain Component Objects) ---

/**
 * Helper function to create mock entities with plain component objects.
 * ASSUMES component objects contain a `typeId` string property.
 * @param {string} id - The entity ID.
 * @param {string} name - The value for the standard NameComponent.
 * @param {object[]} [components=[]] - An array of additional component OBJECTS to add.
 * @returns {Entity} The created mock entity.
 */
const createMockEntity = (id, name, components = []) => {
    // console.log(`Creating mock entity with plain objects: ${id} (${name})`);
    const entity = new Entity(id);

    // 1. Create and add the standard Name Component object
    const nameComponentObject = {
        typeId: NAME_COMPONENT_TYPE_ID, // Use the defined constant/string
        value: name
    };
    if (!nameComponentObject.typeId || typeof nameComponentObject.typeId !== 'string') {
        throw new Error(`createMockEntity: Failed to create valid name component object for ID ${id}. Missing or invalid typeId.`);
    }
    entity.addComponent(nameComponentObject.typeId, nameComponentObject); // Pass typeId string and the object

    // 2. Add other components passed in the array
    components.forEach(compObject => {
        if (!compObject || typeof compObject !== 'object') {
            console.error(`ERROR in test setup: Invalid item found in 'components' array for entity ${id}. Expected an object.`, compObject);
            throw new Error(`Invalid component object passed to createMockEntity for ${id}. Expected object.`);
        }
        if (!compObject.typeId || typeof compObject.typeId !== 'string') {
            console.error(`ERROR in test setup: Component object is missing 'typeId' string property. Entity ID: ${id}`, compObject);
            throw new Error(`Component object is missing 'typeId' string property during mock entity creation for ${id}.`);
        }
        entity.addComponent(compObject.typeId, compObject); // Pass typeId string and the object
    });

    mockEntityManager.entities.set(id, entity);
    return entity;
};


/**
 * Helper to simulate placing an entity in a location using plain component objects.
 * Adds the entityId to the location's set in `mockEntityManager.locations`
 * and updates/adds a PositionComponent object to the entity.
 * @param {string} entityId - The ID of the entity to place.
 * @param {string} locationId - The ID of the location entity.
 */
const placeInLocation = (entityId, locationId) => {
    // Add entity to location set in mock EntityManager
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId)?.add(entityId);

    const entity = mockEntityManager.entities.get(entityId);
    if (entity) {
        // Get the existing position component data object
        let posCompObject = entity.getComponentData(POSITION_COMPONENT_ID);

        if (!posCompObject) {
            // Create a NEW position component OBJECT if it doesn't exist
            posCompObject = {
                typeId: POSITION_COMPONENT_ID, // Include the typeId
                locationId: locationId
            };
            entity.addComponent(POSITION_COMPONENT_ID, posCompObject);
        } else {
            // If data exists, assume it's the plain object and modify its property
            if (typeof posCompObject === 'object' && posCompObject !== null) {
                posCompObject.locationId = locationId; // Directly update the property
            } else {
                console.warn(`Entity ${entityId} has PositionComponent data, but it's not an object as expected.`, posCompObject);
                // Overwrite with a new valid object if structure is wrong
                const newPosCompObject = {
                    typeId: POSITION_COMPONENT_ID,
                    locationId: locationId
                };
                entity.addComponent(POSITION_COMPONENT_ID, newPosCompObject);
            }
        }
    }
};


// --- Global Setup ---
beforeEach(() => {
    // Clear/Reset Mocks and Data
    mockEventBusDispatch.mockClear();
    mockValidatedDispatcher.dispatchValidated.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();

    // Reset mock function implementations
    jest.clearAllMocks();
    mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());
    mockValidatedDispatcher.dispatchValidated.mockImplementation(async (eventType, payload) => {
        mockEventBusDispatch(eventType, payload);
        return Promise.resolve();
    });

    // Create *fresh* mock entities using the updated helper
    mockPlayerEntity = createMockEntity('player-1', 'Tester');
    mockCurrentLocation = createMockEntity('loc-lobby', 'Lobby');

    // Place the player in the location using the updated helper
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id);

    // Assign fresh instances/references to mockContext
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = [];
    mockContext.validatedDispatcher = mockValidatedDispatcher;
    mockContext.logger = mockLogger;
});

// ========================================================================
// == Tests for resolveTargetConnection Utility Function ==================
// ========================================================================

describe('resolveTargetConnection', () => {

    // --- Tests for Input Validation ---
    describe('Input Validation', () => {
        // These tests don't depend on specific component setup, so they remain the same
        test('should return null and log warning when connectionTargetName is null', async () => {
            const targetName = null;
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        test('should return null and log warning when connectionTargetName is undefined', async () => {
            const targetName = undefined;
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        test('should return null and log warning when connectionTargetName is an empty string', async () => {
            const targetName = '';
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        test('should return null and log warning when connectionTargetName is only whitespace', async () => {
            const targetName = '   ';
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        // Dependency checks remain the same
        test('should return null and console.error when context is missing dispatcher', async () => {
            const incompleteContext = {...mockContext, validatedDispatcher: undefined};
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const result = await resolveTargetConnection(incompleteContext, 'north');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid context or missing validatedDispatcher/logger functions provided."));
            consoleErrorSpy.mockRestore();
        });

        test('should return null and console.error when context is missing logger', async () => {
            const incompleteContext = {...mockContext, logger: undefined};
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const result = await resolveTargetConnection(incompleteContext, 'north');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid context or missing validatedDispatcher/logger functions provided."));
            consoleErrorSpy.mockRestore();
        });
    }); // End Input Validation describe

    // --- Tests for Successful Resolution (Happy Path) ---
    describe('Successful Resolution (Happy Path)', () => {
        let mockNorthEntity;
        let mockSouthEntity;
        let mockWestDoorEntity;
        let mockEastDirectionEntity;
        let mockUpNameEntity;

        beforeEach(() => {
            // Create connection target entities (these only need Name component usually)
            mockNorthEntity = createMockEntity('conn-north', 'North Passage');
            mockSouthEntity = createMockEntity('conn-south', 'South Archway');
            mockWestDoorEntity = createMockEntity('conn-west-door', 'Wooden Door');
            mockEastDirectionEntity = createMockEntity('conn-east-dir', 'East Corridor');
            mockUpNameEntity = createMockEntity('conn-up-name', 'East Passage'); // Note: name conflict with 'east' direction

            // **UPDATED**: Create the connections component OBJECT
            const connectionsCompData = {
                typeId: CONNECTIONS_COMPONENT_TYPE_ID, // Uses the IMPORTED constant
                connections: {
                    north: mockNorthEntity.id,
                    south: mockSouthEntity.id,
                    west: mockWestDoorEntity.id,
                    east: mockEastDirectionEntity.id,
                    up: mockUpNameEntity.id, // Note: Target name is 'East Passage'
                }
            };
            // Add the component object to the location entity correctly
            mockCurrentLocation.addComponent(connectionsCompData.typeId, connectionsCompData);
        });

        describe('AC1: Direction Match', () => {
            test.each([
                ['north'], ['NORTH'], [' north '], [' NoRtH ']
            ])('should return the correct entity for direction input "%s"', async (input) => {
                const result = await resolveTargetConnection(mockContext, input);
                expect(result).toBe(mockNorthEntity);
                expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: north -> ${mockNorthEntity.id}`));
            });
        });

        describe('AC2: Name Match (No Direction Match)', () => {
            test.each([
                ['wooden door'], ['WOODEN DOOR'], [' door '], ['DOOR'], ['wooden'],
            ])('should return the correct entity for name input "%s" when no direction matches', async (input) => {
                const result = await resolveTargetConnection(mockContext, input);
                // Assuming getDisplayName is adapted to read from name component object
                const expectedDisplayName = getDisplayName(mockWestDoorEntity);
                expect(result).toBe(mockWestDoorEntity);
                expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique name match: ${expectedDisplayName} (${mockWestDoorEntity.id}) via direction west`));
            });
        });

        describe('AC3: Prioritization (Direction over Name)', () => {
            // Input 'east' matches direction 'east' (mockEastDirectionEntity)
            // Input 'east' also PARTIALLY matches name 'East Passage' (mockUpNameEntity)
            test('should return the entity matched by direction when input matches both a direction and a different entity\'s name', async () => {
                const input = 'east'; // Matches 'east' direction AND part of 'East Passage' name (linked via 'up')
                const result = await resolveTargetConnection(mockContext, input);
                expect(result).toBe(mockEastDirectionEntity); // Should prioritize the direction match
                expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: east -> ${mockEastDirectionEntity.id}`));
            });
        });

    }); // End Successful Resolution describe

    // --- Tests for Ambiguity Scenarios ---
    describe('Ambiguity Scenarios', () => {

        describe('AC1: Ambiguous Direction', () => {
            // This test mocks findPotentialConnectionMatches, so doesn't need Connections component setup
            let mockWestGateEntity;
            let mockWestArchEntity;
            let mockFindPotentialMatchesFn;

            beforeEach(() => {
                mockWestGateEntity = createMockEntity('conn-wg', 'West Gate');
                mockWestArchEntity = createMockEntity('conn-wa', 'Western Arch');

                // Mock the finder function directly for this scenario
                mockFindPotentialMatchesFn = jest.fn().mockReturnValue({
                    directionMatches: [
                        {direction: 'west', connectionEntity: mockWestGateEntity},
                        {direction: 'west', connectionEntity: mockWestArchEntity}
                    ],
                    nameMatches: [],
                });
                // No Connections component needed on mockCurrentLocation here
            });

            test('should return null and dispatch AMBIGUOUS_DIRECTION when input matches multiple direction keys', async () => {
                const ambiguousInput = 'west';
                // Assuming getDisplayName works
                const expectedNames = [getDisplayName(mockWestGateEntity), getDisplayName(mockWestArchEntity)];
                const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(ambiguousInput, expectedNames);

                const result = await resolveTargetConnection(
                    mockContext,
                    ambiguousInput,
                    'go', // actionVerb
                    mockFindPotentialMatchesFn // Provide the mock dependency
                );

                expect(result).toBeNull();
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                    "event:display_message",
                    expect.objectContaining({text: expectedMsg, type: 'warning'})
                );
                // Check the mock finder function was called correctly (including logger)
                expect(mockFindPotentialMatchesFn).toHaveBeenCalledWith(mockContext, ambiguousInput, mockLogger);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous direction match for '${ambiguousInput}'. Dispatching message.`));
            });
        });

        describe('AC2: Ambiguous Name (No Direction Match)', () => {
            let mockNarrowPathEntity;
            let mockWidePathEntity;
            let mockOtherConnectionEntity;

            beforeEach(() => {
                // Create target entities
                mockNarrowPathEntity = createMockEntity('conn-np', 'Narrow Path');
                mockWidePathEntity = createMockEntity('conn-wp', 'Wide Path');
                mockOtherConnectionEntity = createMockEntity('conn-east', 'East Gate');

                // **UPDATED**: Create connections component OBJECT
                const connectionsCompData = {
                    typeId: CONNECTIONS_COMPONENT_TYPE_ID,
                    connections: {
                        north: mockNarrowPathEntity.id,
                        south: mockWidePathEntity.id,
                        east: mockOtherConnectionEntity.id
                    }
                };
                // Add the component object correctly
                mockCurrentLocation.addComponent(connectionsCompData.typeId, connectionsCompData);
            });

            test('should return null and dispatch TARGET_AMBIGUOUS_CONTEXT when input matches multiple names but no directions', async () => {
                const ambiguousInput = 'path';
                const actionVerb = 'go';
                // Note: TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT expects entity objects
                const expectedMatches = [mockNarrowPathEntity, mockWidePathEntity].sort((a, b) => a.id.localeCompare(b.id));
                const expectedMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, ambiguousInput, expectedMatches);

                const result = await resolveTargetConnection(mockContext, ambiguousInput, actionVerb);

                expect(result).toBeNull();
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                    "event:display_message",
                    expect.objectContaining({text: expectedMsg, type: 'warning'})
                );
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous name match for '${ambiguousInput}'. Dispatching message.`));
            });
        });

    }); // End Ambiguity Scenarios describe

    // --- Tests for Not Found & Edge Cases ---
    describe('Not Found and Edge Cases', () => {

        test('AC1: should return null and dispatch Not Found when input matches no connections', async () => {
            // Setup
            const mockNorthEntity = createMockEntity('conn-n', 'North Exit');
            const mockPortalEntity = createMockEntity('conn-portal', 'Magic Portal');
            // **UPDATED**: Create connections component OBJECT
            const connectionsCompData = {
                typeId: CONNECTIONS_COMPONENT_TYPE_ID,
                connections: {north: mockNorthEntity.id, portal: mockPortalEntity.id}
            };
            mockCurrentLocation.addComponent(connectionsCompData.typeId, connectionsCompData);

            // Test
            const targetName = 'teleporter';
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);
            const result = await resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
        });

        test('AC2: should return null and dispatch Not Found when location has ConnectionsComponent but no connections', async () => {
            // **UPDATED**: Create EMPTY connections component OBJECT
            const connectionsCompData = {
                typeId: CONNECTIONS_COMPONENT_TYPE_ID,
                connections: {} // Empty connections map
            };
            mockCurrentLocation.addComponent(connectionsCompData.typeId, connectionsCompData);

            // Test
            const targetName = 'north';
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);
            const result = await resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
        });

        test('AC3: should return null and dispatch Not Found when location has no ConnectionsComponent', async () => {
            // No setup needed - mockCurrentLocation has no connections by default
            const targetName = 'east';
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);
            const result = await resolveTargetConnection(mockContext, targetName);

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
        });

        test('AC4: should return null and dispatch Not Found when connection ID points to non-existent entity', async () => {
            // Setup
            const danglingId = 'conn-missing';
            const validSouthEntity = createMockEntity('conn-s', 'South Path');
            // **UPDATED**: Create connections component OBJECT with dangling ID
            const connectionsCompData = {
                typeId: CONNECTIONS_COMPONENT_TYPE_ID,
                connections: {up: danglingId, south: validSouthEntity.id}
            };
            mockCurrentLocation.addComponent(connectionsCompData.typeId, connectionsCompData);

            // Ensure getEntityInstance returns null specifically for the dangling ID
            // (Need to redefine mock implementation *after* global beforeEach clearAllMocks)
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === danglingId) return null;
                // Fallback to original Map lookup for other IDs
                return mockEntityManager.entities.get(id);
            });

            // Test
            const targetName = 'up'; // Target the dangling connection
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);
            const result = await resolveTargetConnection(mockContext, targetName);

            // Assert
            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            // Check that the system tried to get the missing entity
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(danglingId);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
            // Note: The underlying findPotentialConnectionMatches function (not mocked here)
            // should ideally log a warning about the missing entity 'conn-missing',
            // which could be checked via mockLogger.warn if needed.
        });

    }); // End Not Found and Edge Cases describe

    // --- Setup Verification Test (Remains Synchronous) ---
    describe('Setup Verification', () => {
        // This test primarily checks if mocks are initialized correctly
        test('test setup should complete without errors and include required mocks', () => {
            expect(mockContext).toBeDefined();
            expect(mockContext.entityManager).toBe(mockEntityManager);
            expect(mockContext.playerEntity).toBeInstanceOf(Entity);
            expect(mockContext.currentLocation).toBeInstanceOf(Entity);
            expect(mockEntityManager.entities.has('player-1')).toBe(true);
            expect(mockEntityManager.entities.has('loc-lobby')).toBe(true);
            // Check player has Name and Position components added by helpers
            expect(mockPlayerEntity.hasComponent(NAME_COMPONENT_TYPE_ID)).toBe(true);
            expect(mockPlayerEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
            expect(mockPlayerEntity.getComponentData(POSITION_COMPONENT_ID)?.locationId).toBe('loc-lobby');
            // Check location has Name component
            expect(mockCurrentLocation.hasComponent(NAME_COMPONENT_TYPE_ID)).toBe(true);
            // Check player is in the location set
            expect(mockEntityManager.locations.get('loc-lobby')?.has('player-1')).toBe(true);

            // Verify mocks are present and correctly assigned
            expect(mockContext.validatedDispatcher).toBe(mockValidatedDispatcher);
            expect(typeof mockContext.validatedDispatcher.dispatchValidated).toBe('function');
            expect(mockContext.logger).toBe(mockLogger);
            expect(typeof mockContext.logger.warn).toBe('function');

            // Initial state checks
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });

}); // End describe for resolveTargetConnection