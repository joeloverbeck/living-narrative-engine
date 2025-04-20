// src/tests/services/resolveTargetConnection.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import Entity from '../../entities/entity.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {
    resolveTargetConnection,
    // You might need to import findPotentialConnectionMatches if you directly mock it for specific tests
} from '../../services/connectionResolver.js';
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';

// ========================================================================
// == Test Setup: Mocks and Environment ===================================
// ========================================================================

// --- Mocks ---
// Mock the event bus dispatch function (used by validated dispatcher)
const mockEventBusDispatch = jest.fn();

// Mock ValidatedEventDispatcher <-- NEW
const mockValidatedDispatcher = {
    dispatchValidated: jest.fn(async (eventType, payload) => { // Make mock async if the real one is
        // Simulate dispatching via the event bus if needed for other integration tests,
        // or just record the call for resolver tests.
        mockEventBusDispatch(eventType, payload);
        return Promise.resolve(); // Simulate async dispatch completion
    }),
};

// Mock Logger <-- NEW
const mockLogger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Added debug as it's used in the function
};

// Mock EntityManager (Keep existing)
const mockEntityManager = {
    entities: new Map(),
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    locations: new Map(),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
};

// --- Mock EventBus (Keep existing, potentially used by dispatcher) ---
const mockEventBus = {
    dispatch: mockEventBusDispatch, // Use the specific mock function
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
    eventBus: mockEventBus, // Still needed if dispatcher uses it
    validatedDispatcher: mockValidatedDispatcher, // <-- ADD THIS
    logger: mockLogger,                       // <-- ADD THIS
};

// --- Helper Functions (Keep existing: createMockEntity, placeInLocation) ---
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
    // console.log(`Creating mock entity: ${id} (${name})`); // Keep console logs if helpful during debugging
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
 * @param {string} entityId - The ID of the entity to place.
 * @param {string} locationId - The ID of the location entity.
 */
const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId)?.add(entityId);

    const entity = mockEntityManager.entities.get(entityId);
    if (entity) {
        let posComp = entity.getComponent(PositionComponent);
        if (!posComp) {
            posComp = new PositionComponent({locationId: locationId});
            entity.addComponent(posComp);
        } else {
            posComp.setLocation(locationId);
        }
    }
};


// --- Global Setup ---
beforeEach(() => {
    // Clear/Reset Mocks and Data
    mockEventBusDispatch.mockClear(); // Clear the underlying event bus mock
    mockValidatedDispatcher.dispatchValidated.mockClear(); // <-- Clear dispatcher mock
    mockLogger.warn.mockClear(); // <-- Clear logger mocks
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();

    // Reset mock function implementations
    jest.clearAllMocks(); // Clears spies and mocks defined with jest.spyOn or jest.mock
    // Re-apply simple implementations AFTER jest.clearAllMocks
    mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());
    // Re-apply dispatcher mock implementation if cleared by jest.clearAllMocks
    mockValidatedDispatcher.dispatchValidated.mockImplementation(async (eventType, payload) => {
        mockEventBusDispatch(eventType, payload);
        return Promise.resolve();
    });

    // Create *fresh* mock entities for each test
    mockPlayerEntity = createMockEntity('player-1', 'Tester');
    mockCurrentLocation = createMockEntity('loc-lobby', 'Lobby');

    // Place the player in the location
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id);

    // Assign fresh instances to mockContext
    // IMPORTANT: Ensure mockContext itself gets the fresh mocks if they were redefined,
    // but since they are objects, modifying their methods (like with jest.fn()) is usually sufficient.
    // The references in mockContext should still point to the cleared/re-implemented mocks.
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = [];
    // Ensure the context references the *correct*, potentially reset, mocks
    mockContext.validatedDispatcher = mockValidatedDispatcher;
    mockContext.logger = mockLogger;
});

// ========================================================================
// == Tests for resolveTargetConnection Utility Function ==================
// ========================================================================

describe('resolveTargetConnection', () => {

    // --- Tests for Input Validation ---
    describe('Input Validation', () => {
        // Mark the test function as async
        test('should return null and log warning when connectionTargetName is null', async () => {
            const targetName = null;
            // Use await when calling the async function
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            // Check that the logger was called for invalid input
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            // Ensure no messages were dispatched for this specific failure
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        // Mark the test function as async
        test('should return null and log warning when connectionTargetName is undefined', async () => {
            const targetName = undefined;
            // Use await
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        // Mark the test function as async
        test('should return null and log warning when connectionTargetName is an empty string', async () => {
            const targetName = '';
            // Use await
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
            // The console.error about missing context should NO LONGER appear here
        });

        // Mark the test function as async
        test('should return null and log warning when connectionTargetName is only whitespace', async () => {
            const targetName = '   ';
            // Use await
            const result = await resolveTargetConnection(mockContext, targetName);
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName provided."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        // Test for the initial dependency check (optional but good practice)
        test('should return null and console.error when context is missing dispatcher', async () => {
            // Temporarily remove dispatcher for this test
            const incompleteContext = {...mockContext, validatedDispatcher: undefined};
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            }); // Suppress error logging in test output

            const result = await resolveTargetConnection(incompleteContext, 'north');

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid context or missing validatedDispatcher/logger functions provided."));
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not reach the target name validation
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore(); // Clean up spy
        });

        test('should return null and console.error when context is missing logger', async () => {
            // Temporarily remove logger for this test
            const incompleteContext = {...mockContext, logger: undefined};
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            const result = await resolveTargetConnection(incompleteContext, 'north');

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid context or missing validatedDispatcher/logger functions provided."));
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

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
            // This setup remains largely the same
            mockNorthEntity = createMockEntity('conn-north', 'North Passage');
            mockSouthEntity = createMockEntity('conn-south', 'South Archway');
            mockWestDoorEntity = createMockEntity('conn-west-door', 'Wooden Door');
            mockEastDirectionEntity = createMockEntity('conn-east-dir', 'East Corridor');
            mockUpNameEntity = createMockEntity('conn-up-name', 'East Passage');

            const connectionsComp = new ConnectionsComponent({
                connections: {
                    north: mockNorthEntity.id,
                    south: mockSouthEntity.id,
                    west: mockWestDoorEntity.id,
                    east: mockEastDirectionEntity.id,
                    up: mockUpNameEntity.id,
                }
            });
            mockCurrentLocation.addComponent(connectionsComp);
        });

        describe('AC1: Direction Match', () => {
            // Add async and await
            test.each([
                ['north'], ['NORTH'], [' north '], [' NoRtH ']
            ])('should return the correct entity for direction input "%s"', async (input) => {
                const result = await resolveTargetConnection(mockContext, input); // await
                expect(result).toBe(mockNorthEntity);
                expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Check the correct mock
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: north -> ${mockNorthEntity.id}`));
            });
        });

        describe('AC2: Name Match (No Direction Match)', () => {
            // Add async and await
            test.each([
                ['wooden door'], ['WOODEN DOOR'], [' door '], ['DOOR'], ['wooden'],
            ])('should return the correct entity for name input "%s" when no direction matches', async (input) => {
                const result = await resolveTargetConnection(mockContext, input); // await
                expect(result).toBe(mockWestDoorEntity);
                expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Check correct mock
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique name match: ${getDisplayName(mockWestDoorEntity)} (${mockWestDoorEntity.id}) via direction west`));

            });
        });

        describe('AC3: Prioritization (Direction over Name)', () => {
            // Add async and await
            test('should return the entity matched by direction when input matches both a direction and a different entity\'s name', async () => {
                const input = 'east';
                const result = await resolveTargetConnection(mockContext, input); // await
                expect(result).toBe(mockEastDirectionEntity); // Should match direction 'east'
                expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Check correct mock
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: east -> ${mockEastDirectionEntity.id}`));

            });
        });

    }); // End Successful Resolution describe

    // --- Tests for Ambiguity Scenarios ---
    describe('Ambiguity Scenarios', () => {

        describe('AC1: Ambiguous Direction', () => {
            let mockWestGateEntity;
            let mockWestArchEntity;
            // Keep the local mock for findPotentialMatches, but ensure the main function uses await
            let mockFindPotentialMatchesFn;

            beforeEach(() => {
                mockWestGateEntity = createMockEntity('conn-wg', 'West Gate');
                mockWestArchEntity = createMockEntity('conn-wa', 'Western Arch');

                mockFindPotentialMatchesFn = jest.fn();
                mockFindPotentialMatchesFn.mockReturnValue({
                    directionMatches: [
                        {direction: 'west', connectionEntity: mockWestGateEntity},
                        {direction: 'west', connectionEntity: mockWestArchEntity}
                    ],
                    nameMatches: [],
                });
                // No ConnectionsComponent needed here as findMatchesFn is mocked
            });

            // Add async and await
            test('should return null and dispatch AMBIGUOUS_DIRECTION when input matches multiple direction keys', async () => {
                const ambiguousInput = 'west';
                const expectedNames = [getDisplayName(mockWestGateEntity), getDisplayName(mockWestArchEntity)];
                const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(ambiguousInput, expectedNames);

                const result = await resolveTargetConnection( // await
                    mockContext,
                    ambiguousInput,
                    'go',
                    mockFindPotentialMatchesFn // Provide the mock dependency
                );

                expect(result).toBeNull();
                // Check the validated dispatcher mock now
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                    "event:display_message", // Use the correct event name string if it changed
                    expect.objectContaining({
                        text: expectedMsg,
                        type: 'warning'
                    })
                );
                expect(mockFindPotentialMatchesFn).toHaveBeenCalledWith(mockContext, ambiguousInput, mockLogger); // Add mockLogger here
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous direction match for '${ambiguousInput}'. Dispatching message.`));

            });
        });

        describe('AC2: Ambiguous Name (No Direction Match)', () => {
            let mockNarrowPathEntity;
            let mockWidePathEntity;
            let mockOtherConnectionEntity;

            beforeEach(() => {
                // Setup remains the same
                mockNarrowPathEntity = createMockEntity('conn-np', 'Narrow Path');
                mockWidePathEntity = createMockEntity('conn-wp', 'Wide Path');
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

            // Add async and await
            test('should return null and dispatch TARGET_AMBIGUOUS_CONTEXT when input matches multiple names but no directions', async () => {
                const ambiguousInput = 'path';
                const actionVerb = 'go';
                const expectedMatches = [mockNarrowPathEntity, mockWidePathEntity].sort((a, b) => a.id.localeCompare(b.id)); // Sorting might be needed if TARGET_MESSAGES sorts internally
                const expectedMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, ambiguousInput, expectedMatches);

                const result = await resolveTargetConnection(mockContext, ambiguousInput, actionVerb); // await

                expect(result).toBeNull();
                // Check the validated dispatcher mock now
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
                expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                    "event:display_message", // Use the correct event name string
                    expect.objectContaining({
                        text: expectedMsg, // Check against the exact formatted message
                        type: 'warning'
                    })
                );
                // Check logger warning
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous name match for '${ambiguousInput}'. Dispatching message.`));

            });
        });

    }); // End Ambiguity Scenarios describe

    // --- Tests for Not Found & Edge Cases ---
    describe('Not Found and Edge Cases', () => {

        // Add async and await
        test('AC1: should return null and dispatch Not Found when input matches no connections', async () => {
            const mockNorthEntity = createMockEntity('conn-n', 'North Exit');
            const mockPortalEntity = createMockEntity('conn-portal', 'Magic Portal');
            const connectionsComp = new ConnectionsComponent({
                connections: {north: mockNorthEntity.id, portal: mockPortalEntity.id}
            });
            mockCurrentLocation.addComponent(connectionsComp);
            const targetName = 'teleporter';
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            const result = await resolveTargetConnection(mockContext, targetName); // await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Check correct mock
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message", // Use correct event name
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
        });

        // Add async and await
        test('AC2: should return null and dispatch Not Found when location has ConnectionsComponent but no connections', async () => {
            const connectionsComp = new ConnectionsComponent({});
            mockCurrentLocation.addComponent(connectionsComp);
            const targetName = 'north';
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            const result = await resolveTargetConnection(mockContext, targetName); // await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Check correct mock
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
        });

        // Add async and await
        test('AC3: should return null and dispatch Not Found when location has no ConnectionsComponent', async () => {
            const targetName = 'east';
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            const result = await resolveTargetConnection(mockContext, targetName); // await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Check correct mock
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            // Note: findPotentialConnectionMatches might log a console warning here, which is expected.
            // We check the final outcome (dispatching Not Found).
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));

        });

        // Add async and await
        test('AC4: should return null and dispatch Not Found when connection ID points to non-existent entity', async () => {
            const danglingId = 'conn-missing';
            const validSouthEntity = createMockEntity('conn-s', 'South Path'); // Add a valid one too
            const connectionsComp = new ConnectionsComponent({
                connections: {up: danglingId, south: validSouthEntity.id}
            });
            mockCurrentLocation.addComponent(connectionsComp);

            // Ensure getEntityInstance returns null specifically for the dangling ID
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === danglingId) return null;
                return mockEntityManager.entities.get(id); // Default behavior for others
            });

            const targetName = 'up'; // Target the dangling connection
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName);

            const result = await resolveTargetConnection(mockContext, targetName); // await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Check correct mock
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                expect.objectContaining({text: expectedMsg, type: 'info'})
            );
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(danglingId);
            // It finds 'up' as a direction, tries to fetch, fails, resulting in no matches found overall.
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${targetName}'. Dispatching message.`));
            // You might also expect a console.warn from findPotentialConnectionMatches about the missing entity.
        });

    }); // End Not Found and Edge Cases describe

    // --- Setup Verification Test (Remains Synchronous) ---
    describe('Setup Verification', () => {
        test('test setup should complete without errors and include new mocks', () => {
            expect(mockContext).toBeDefined();
            expect(mockContext.eventBus.dispatch).toBe(mockEventBusDispatch);
            expect(mockContext.entityManager).toBe(mockEntityManager);
            expect(mockContext.playerEntity).toBeInstanceOf(Entity);
            expect(mockContext.currentLocation).toBeInstanceOf(Entity);
            expect(mockEntityManager.entities.has('player-1')).toBe(true);
            expect(mockEntityManager.entities.has('loc-lobby')).toBe(true);
            expect(mockEntityManager.locations.get('loc-lobby')?.has('player-1')).toBe(true);

            // Verify new mocks are present and are functions/objects as expected
            expect(mockContext.validatedDispatcher).toBe(mockValidatedDispatcher);
            expect(typeof mockContext.validatedDispatcher.dispatchValidated).toBe('function');
            expect(mockContext.logger).toBe(mockLogger);
            expect(typeof mockContext.logger.warn).toBe('function');
            expect(typeof mockContext.logger.info).toBe('function');
            expect(typeof mockContext.logger.error).toBe('function');
            expect(typeof mockContext.logger.debug).toBe('function');

            // Initial state checks
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });

}); // End describe for resolveTargetConnection