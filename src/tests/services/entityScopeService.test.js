// src/services/entityScopeService.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {getEntityIdsForScopes} from '../../services/entityScopeService.js'; // Adjust path as needed
import Entity from '../../entities/entity.js'; // Adjust path as needed
import Component from '../../components/component.js'; // Assuming base Component exists for imports below
import {NameComponent} from '../../components/nameComponent.js'; // Adjust path as needed
import {ItemComponent} from '../../components/itemComponent.js'; // Adjust path as needed
import {EquippableComponent} from '../../components/equippableComponent.js'; // Adjust path as needed
import {HealthComponent} from '../../components/healthComponent.js'; // Adjust path as needed
import {InventoryComponent} from '../../components/inventoryComponent.js'; // Adjust path as needed
import {EquipmentComponent} from '../../components/equipmentComponent.js'; // Adjust path as needed
import {PositionComponent} from '../../components/positionComponent.js'; // Adjust path as needed
// ******** NEW IMPORTS NEEDED FOR THE TESTS ********
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Adjust path
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js'; // Adjust path
// ***************************************************

// --- Mocks ---
// Mock console methods BEFORE tests run to capture logs during setup/execution
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {
});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {
});
// Mock console.log as well to potentially suppress entity creation logs if needed
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {
});


// Mock EntityManager adhering to its expected interface
const mockEntityManager = {
    // Use jest.fn() for methods we want to spy on or provide mock implementations for
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
    // Internal state for the mock
    entities: new Map(), // Map<entityId, Entity>
    locations: new Map(), // Map<locationId, Set<entityId>>
};

// Mock Entities (will be instantiated in beforeEach)
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
// Mimics the ActionContext structure passed to the service
const mockContext = {
    playerEntity: null, // Will be set in beforeEach
    currentLocation: null, // Will be set in beforeEach
    entityManager: mockEntityManager,
    // Include other potential context properties even if not used by this service directly
    dispatch: jest.fn(),
    targets: [],
    gameDataRepository: {},
};

// --- Helper Functions (for setting up test data consistently) ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id); // Assuming Entity constructor takes ID
    // Add name component only if name is provided and not null
    if (name !== null && typeof name === 'string') {
        entity.addComponent(new NameComponent({value: name}));
    }
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity); // Register entity with mock manager
    return entity;
};


// Helper to correctly add component to mock entity (if not present)
const ensureComponent = (entity, ComponentClass, componentData = {}) => {
    if (!entity.hasComponent(ComponentClass)) {
        entity.addComponent(new ComponentClass(componentData));
    }
    return entity.getComponent(ComponentClass);
};

const placeInLocation = (entityId, locationId, x = 0, y = 0) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId).add(entityId); // Add entity ID to location set
    const entity = mockEntityManager.entities.get(entityId);
    // Ensure entity has a PositionComponent reflecting its location
    if (entity) {
        const posComp = ensureComponent(entity, PositionComponent, {locationId, x, y});
        posComp.setLocation(locationId, x, y); // Update it
    }
};

const addToInventory = (entityId, ownerEntity) => {
    const inv = ensureComponent(ownerEntity, InventoryComponent);
    inv.addItem(entityId); // Use component's method
    const entity = mockEntityManager.entities.get(entityId);
    // Items in inventory typically don't have a world location
    if (entity?.hasComponent(PositionComponent)) {
        entity.getComponent(PositionComponent).setLocation(null); // Set locationId to null
    }
};

const equipItem = (itemId, slotId, ownerEntity) => {
    // Ensure EquipmentComponent and the specific slot exist
    const eq = ensureComponent(ownerEntity, EquipmentComponent, {slots: {[slotId]: null}});
    if (!eq.hasSlot(slotId)) {
        eq.slots[slotId] = null; // Add slot if it doesn't exist dynamically
    }
    // Use component's method
    eq.equipItem(slotId, itemId);
};

// --- Test Suite ---
describe('entityScopeService', () => {
    // Declare variables for common test entities AT THE TOP LEVEL
    let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door;
    let expectedNearbySet;
    // *** Declare passage/blocker variables at the top level ***
    let passage1, passage2, blocker1, blocker2, location2;

    // --- Reset Mocks and Setup Common Test Data Before Each Test ---
    beforeEach(() => {
        // Clear mock function calls and internal states
        mockConsoleWarn.mockClear();
        mockConsoleError.mockClear();
        mockConsoleLog.mockClear(); // Clear log mock too
        mockEntityManager.entities.clear();
        mockEntityManager.locations.clear();
        // Reset mock implementations to default behavior
        mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.entities.get(id));
        // *** IMPORTANT: Updated getEntitiesInLocation mock to exclude player ***
        // This matches the behavior described in the code where _handleLocation relies on
        // the spatial index (mocked here) to already provide IDs excluding the player.
        mockEntityManager.getEntitiesInLocation.mockImplementation((locId) => {
            const allIds = mockEntityManager.locations.get(locId) || new Set();
            const filteredIds = new Set();
            for (const id of allIds) {
                // Exclude player if context is set and ID matches
                if (mockContext.playerEntity && id === mockContext.playerEntity.id) {
                    continue;
                }
                filteredIds.add(id);
            }
            return filteredIds;
        });
        mockContext.dispatch.mockClear();

        // Create fresh player and location for isolation
        // Use consistent IDs for easier debugging
        mockPlayerEntity = createMockEntity('player-1', 'Player');
        mockCurrentLocation = createMockEntity('loc-room1', 'Test Room');

        // Add standard components to player
        ensureComponent(mockPlayerEntity, InventoryComponent);
        ensureComponent(mockPlayerEntity, EquipmentComponent, {slots: {'main': null, 'off': null}});

        // Place player in the mock location (will be filtered out by mock getEntitiesInLocation)
        placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id, 1, 1);

        // Update context with fresh player/location references
        mockContext.playerEntity = mockPlayerEntity;
        mockContext.currentLocation = mockCurrentLocation;

        // Create common test entities
        sword = createMockEntity('item-sword', 'iron sword', [new ItemComponent(), new EquippableComponent({slotId: 'main'})]);
        shield = createMockEntity('item-shield', 'wooden shield', [new ItemComponent(), new EquippableComponent({slotId: 'off'})]);
        potion = createMockEntity('item-potion', 'red potion', [new ItemComponent()]);
        rustyKey = createMockEntity('item-key-rusty', 'rusty key', [new ItemComponent()]);
        shinyKey = createMockEntity('item-key-shiny', 'shiny key', [new ItemComponent()]);
        goblin = createMockEntity('npc-goblin', 'grumpy goblin', [new HealthComponent({current: 10, max: 10})]); // Non-item NPC
        rock = createMockEntity('scenery-rock', 'large rock', []); // Non-item scenery
        door = createMockEntity('obj-door', 'wooden door', []); // Non-item scenery/interactable

        // Distribute entities into the test environment
        placeInLocation(goblin.id, mockCurrentLocation.id, 2, 2);
        placeInLocation(rock.id, mockCurrentLocation.id, 3, 3);
        placeInLocation(rustyKey.id, mockCurrentLocation.id, 4, 4); // Key starts on the ground
        placeInLocation(door.id, mockCurrentLocation.id, 5, 5);

        addToInventory(sword.id, mockPlayerEntity); // Sword starts in inventory
        addToInventory(potion.id, mockPlayerEntity); // Potion starts in inventory
        addToInventory(shinyKey.id, mockPlayerEntity); // Other key starts in inventory

        equipItem(shield.id, 'off', mockPlayerEntity); // Shield starts equipped

        // Calculate the expected 'nearby' set based on this standard setup
        // 'nearby' = inventory + location (excluding player)
        expectedNearbySet = new Set([
            // Inventory items:
            sword.id, potion.id, shinyKey.id,
            // Location entities (player is excluded by the mock getEntitiesInLocation):
            goblin.id, rock.id, rustyKey.id, door.id
        ]);

        // *** INITIALIZE passage1, blocker1 etc. HERE in the main beforeEach ***
        location2 = createMockEntity('loc-room2', 'Another Room');
        passage1 = createMockEntity('conn-room1-room2-north', 'passage north', []);
        passage2 = createMockEntity('conn-room1-room2-east', 'passage east', []);
        blocker1 = createMockEntity('blocker-gate', 'iron gate', []);
        blocker2 = createMockEntity('blocker-guard', 'sleepy guard', [new HealthComponent({current: 5, max: 5})]);

        // Basic setup for passage1 (add core component)
        ensureComponent(passage1, PassageDetailsComponent, { // Use ensureComponent
            locationAId: mockCurrentLocation.id,
            locationBId: location2.id,
            directionAtoB: 'north',
            directionBtoA: 'south',
            blockerEntityId: null, // Initially no blocker
        });

        // Basic setup for passage2 (add core component)
        ensureComponent(passage2, PassageDetailsComponent, { // Use ensureComponent
            locationAId: mockCurrentLocation.id,
            locationBId: location2.id,
            directionAtoB: 'east',
            directionBtoA: 'west',
            blockerEntityId: null, // Initially no blocker
        });
    });

    // --- Tests for existing scopes (abbreviated for focus) ---
    describe('Scope: inventory', () => {
        test('should return items in player inventory', () => {
            const result = getEntityIdsForScopes('inventory', mockContext);
            expect(result).toEqual(new Set([sword.id, potion.id, shinyKey.id]));
        });
        // ... other inventory tests ...
        test('should return empty set and warn if playerEntity is missing', () => {
            mockContext.playerEntity = null;
            const result = getEntityIdsForScopes('inventory', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'inventory' requested but playerEntity is missing"));
        });

        test('should return empty set and warn if InventoryComponent is missing', () => {
            mockPlayerEntity.removeComponent(InventoryComponent);
            const result = getEntityIdsForScopes('inventory', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`player ${mockPlayerEntity.id} lacks InventoryComponent`));
        });

    });

    describe('Scope: location', () => {
        test('should return entities in location, excluding player', () => {
            const result = getEntityIdsForScopes('location', mockContext);
            // Player is excluded by the getEntitiesInLocation mock based on context
            expect(result).toEqual(new Set([goblin.id, rock.id, rustyKey.id, door.id]));
            expect(result.has(mockPlayerEntity.id)).toBe(false);
        });
        // ... other location tests ...
        test('should return empty set and warn if currentLocation is null', () => {
            mockContext.currentLocation = null;
            const result = getEntityIdsForScopes('location', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        });


        test('should return empty set and log error if entityManager is missing from context', () => {
            const originalEntityManager = mockContext.entityManager;
            mockContext.entityManager = null;
            const result = getEntityIdsForScopes('location', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleError).toHaveBeenCalledWith(
                "getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.",
                {context: mockContext} // Check the context object passed to the log
            );
            mockContext.entityManager = originalEntityManager; // Restore
        });
    });

    describe('Scope: equipment', () => {
        test('should return equipped items', () => {
            const result = getEntityIdsForScopes('equipment', mockContext);
            expect(result).toEqual(new Set([shield.id]));
        });
        // ... other equipment tests ...
        test('should return empty set and warn if playerEntity is missing', () => {
            mockContext.playerEntity = null;
            const result = getEntityIdsForScopes('equipment', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'equipment' requested but playerEntity is missing"));
        });

        test('should return empty set and warn if EquipmentComponent is missing', () => {
            mockPlayerEntity.removeComponent(EquipmentComponent);
            const result = getEntityIdsForScopes('equipment', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`player ${mockPlayerEntity.id} lacks EquipmentComponent`));
        });
    });

    describe('Scope: location_items', () => {
        test('should return only items in location', () => {
            const result = getEntityIdsForScopes('location_items', mockContext);
            expect(result).toEqual(new Set([rustyKey.id])); // Only key is item on ground
        });
        // ... other location_items tests ...
        test('should log warning for dangling entity IDs when checking ItemComponent', () => {
            const danglingId = 'dangling-item-123';
            // Add ID to location set, but not to entity map
            mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);

            // Ensure getEntityInstance returns undefined for this ID
            const originalGetEntityInstance = mockEntityManager.getEntityInstance;
            mockEntityManager.getEntityInstance = jest.fn((id) => {
                if (id === danglingId) return undefined;
                return originalGetEntityInstance.call(mockEntityManager, id); // Use .call()
            });


            const result = getEntityIdsForScopes('location_items', mockContext);
            // Expected result should not contain the dangling ID
            expect(result).toEqual(new Set([rustyKey.id])); // Only valid item
            // Check for the specific warning from _handleLocationItems
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} from location scope not found in entityManager when checking for ItemComponent`));

            // Restore mocks
            mockEntityManager.getEntityInstance = originalGetEntityInstance;
        });
    });

    describe('Scope: location_non_items', () => {
        test('should return only non-items in location', () => {
            const result = getEntityIdsForScopes('location_non_items', mockContext);
            expect(result).toEqual(new Set([goblin.id, rock.id, door.id]));
        });
        // ... other location_non_items tests ...
        test('should log warning for dangling entity IDs when checking non-ItemComponent', () => {
            const danglingId = 'dangling-nonitem-456';
            mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);

            const originalGetEntityInstance = mockEntityManager.getEntityInstance;
            mockEntityManager.getEntityInstance = jest.fn((id) => {
                if (id === danglingId) return undefined;
                return originalGetEntityInstance.call(mockEntityManager, id); // Use .call()
            });

            const result = getEntityIdsForScopes('location_non_items', mockContext);
            expect(result).toEqual(new Set([goblin.id, rock.id, door.id])); // Valid non-items
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} from location scope not found in entityManager when checking for non-ItemComponent`));

            mockEntityManager.getEntityInstance = originalGetEntityInstance;
        });
    });

    describe('Scope: nearby', () => {
        test('should return combined inventory and location (excluding player)', () => {
            const result = getEntityIdsForScopes('nearby', mockContext);
            expect(result).toEqual(expectedNearbySet); // Use pre-calculated set
        });
        // ... other nearby tests ...
        test('should log warning and return only inventory if currentLocation is null', () => {
            mockContext.currentLocation = null; // Simulate missing location context
            const result = getEntityIdsForScopes('nearby', mockContext);
            // Only inventory items should be returned
            expect(result).toEqual(new Set([sword.id, potion.id, shinyKey.id]));
            // Warning should come from _handleLocation being called by _handleNearby
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        });
    });


    // ******** NEW TEST SUITE FOR nearby_including_blockers ********
    describe('Scope: nearby_including_blockers', () => {

        // This beforeEach can reset state SPECIFIC to blocker tests if needed
        beforeEach(() => {
            // Reset blockers on passages before each test in this suite
            const p1Details = passage1?.getComponent(PassageDetailsComponent);
            if (p1Details) p1Details.blockerEntityId = null;
            const p2Details = passage2?.getComponent(PassageDetailsComponent);
            if (p2Details) p2Details.blockerEntityId = null;
            // Ensure the location doesn't have connections carrying over from previous tests
            if (mockCurrentLocation?.hasComponent(ConnectionsComponent)) {
                mockCurrentLocation.removeComponent(ConnectionsComponent); // Remove if exists
            }
        });


        // AC: Baseline / No Connections
        test('AC: should return same as "nearby" if currentLocation lacks ConnectionsComponent', () => {
            // No ConnectionsComponent added to mockCurrentLocation in setup
            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedNearbySet);
            expect(mockConsoleWarn).not.toHaveBeenCalled(); // No warning expected here
        });

        test('AC: should return same as "nearby" if ConnectionsComponent exists but is empty', () => {
            // Add an empty ConnectionsComponent
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {}});
            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedNearbySet);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        // AC: Connections, No Blockers
        test('AC: should return same as "nearby" if connections exist but passages have null blockerEntityId', () => {
            // Setup: Add connection to passage1 (which has blockerEntityId: null by default in this test setup)
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedNearbySet); // Should still match 'nearby'
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('AC: should return same as "nearby" if connections exist but passages lack PassageDetailsComponent', () => {
            // Create a passage entity without the details component
            const passageNoDetails = createMockEntity('conn-nodetails', 'broken passage');
            // Setup: Connect to this broken passage
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {south: passageNoDetails.id}});

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedNearbySet); // Should still match 'nearby'
            // Expect a warning about the missing component
            // --- UPDATED ASSERTION ---
            expect(console.warn).toHaveBeenCalledWith(
                `entityScopeService._handleNearbyIncludingBlockers: Passage entity '${passageNoDetails.id}' lacks PassageDetailsComponent. Cannot check for blocker.`
            );
        });


        // AC: Connections with Blockers
        test('AC: should include blocker ID if a connected passage is blocked', () => {
            // Setup: Make passage1 blocked by blocker1
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            // Setup: Add connection from current location to passage1
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            // Calculate expected: nearby + blocker1
            const expectedResult = new Set([...expectedNearbySet, blocker1.id]);

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedResult);
            expect(mockConsoleWarn).not.toHaveBeenCalled(); // No dangling IDs here
        });

        // AC: Multiple Distinct Blockers
        test('AC: should include all unique blocker IDs from multiple blocked passages', () => {
            // Setup: Block passage1 with blocker1, passage2 with blocker2
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            passage2.getComponent(PassageDetailsComponent).blockerEntityId = blocker2.id;
            // Setup: Connect current location to both passages
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {
                connections: {
                    north: passage1.id,
                    east: passage2.id
                }
            });

            // Calculate expected: nearby + blocker1 + blocker2
            const expectedResult = new Set([...expectedNearbySet, blocker1.id, blocker2.id]);

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedResult);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        // AC: Shared Blocker
        test('AC: should include a shared blocker ID only once', () => {
            // Setup: Block passage1 AND passage2 with blocker1
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            passage2.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            // Setup: Connect current location to both passages
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {
                connections: {
                    north: passage1.id,
                    east: passage2.id
                }
            });

            // Calculate expected: nearby + blocker1 (only once)
            const expectedResult = new Set([...expectedNearbySet, blocker1.id]);

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedResult);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        // AC: Dangling Passage ID
        test('AC: should log warning and skip connection if passage entity instance is missing', () => {
            const danglingPassageId = 'conn-dangling-west';
            // Setup: Connect current location to a non-existent passage ID
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {west: danglingPassageId}});

            // Expected result should just be 'nearby' as the connection fails silently after warning
            const expectedResult = expectedNearbySet;

            // Clear mocks specific to this call to isolate the warning check
            mockConsoleWarn.mockClear();

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

            expect(result).toEqual(expectedResult);
            // Verify the specific warning about the missing passage instance was logged
            expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
            expect(mockConsoleWarn).toHaveBeenCalledWith(
                `entityScopeService._handleNearbyIncludingBlockers: Passage entity instance not found for ID '${danglingPassageId}'. Skipping blocker check.`
            );
        });

        // AC: Dangling Blocker ID
        test('AC: should include blocker ID and log warning if blocker entity instance is missing', () => {
            const danglingBlockerId = 'blocker-dangling-ghost';
            // Setup: Block passage1 with a non-existent blocker ID
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = danglingBlockerId;
            // Setup: Connect current location to passage1
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            // Calculate expected: nearby + the dangling blocker ID
            const expectedResult = new Set([...expectedNearbySet, danglingBlockerId]);

            // Clear mocks specific to this call to isolate the warning check
            mockConsoleWarn.mockClear();

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

            expect(result).toEqual(expectedResult); // The ID should be included
            // Verify the specific warning about the missing blocker *instance* was logged
            expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
            // --- UPDATED ASSERTION ---
            expect(mockConsoleWarn).toHaveBeenCalledWith(
                `entityScopeService._handleNearbyIncludingBlockers: Added blocker ID '${danglingBlockerId}' but instance not found.`
            );
        });

        // Test edge case: Blocker ID is an empty string
        test('should ignore blocker ID if it is an empty string', () => {
            // Setup: Set blocker ID to empty string
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = '';
            // Setup: Add connection
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
            expect(result).toEqual(expectedNearbySet); // Should match nearby, empty string ignored
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        // Test edge case: Missing entity manager in context (Handled by top-level check in getEntityIdsForScopes)
        test('should return empty set and log error if entityManager is missing in context', () => {
            const originalEntityManager = mockContext.entityManager;
            mockContext.entityManager = null; // Remove entityManager

            // Add a connection that *would* have a blocker if EM was present
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            // Clear mocks to check for the specific error
            mockConsoleError.mockClear();

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

            // The main function should return early with an error
            expect(result).toEqual(new Set());
            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringContaining("Invalid or incomplete context provided"),
                expect.anything()
            );
            // No specific warning about blockers should occur as it exits earlier
            // expect(mockConsoleWarn).not.toHaveBeenCalledWith(expect.stringContaining("entityManager missing")); // This check is no longer relevant as the error happens sooner

            mockContext.entityManager = originalEntityManager; // Restore
        });


        // Test edge case: Missing current location in context
        test('should return only nearby results (inventory only) and warn if currentLocation is missing in context', () => {
            const originalCurrentLocation = mockContext.currentLocation;
            mockContext.currentLocation = null; // Remove currentLocation


            // Clear mocks to check for the specific warning
            mockConsoleWarn.mockClear();

            const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

            // Result should fall back to just 'nearby' results.
            // Without currentLocation:
            // _handleInventory works.
            // _handleLocation warns and returns empty set.
            // So, 'nearby' would return only inventory items.
            // Blocker check will also warn and not add anything.
            const expectedInventoryOnly = new Set([sword.id, potion.id, shinyKey.id]);

            expect(result).toEqual(expectedInventoryOnly);

            // Check for the specific warning from _handleNearbyIncludingBlockers
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation missing in context. Cannot check for blockers."));
            // We also expect a warning from _handleLocation called via _handleNearby
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));


            mockContext.currentLocation = originalCurrentLocation; // Restore
        });


    }); // End describe('Scope: nearby_including_blockers')

    // ******** NEW TEST SUITE FOR 'self' scope ********
    describe("Scope: self", () => {
        test("should return a set containing only the player's ID", () => {
            const result = getEntityIdsForScopes('self', mockContext);
            expect(result).toEqual(new Set([mockPlayerEntity.id]));
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test("should return an empty set and warn if playerEntity is missing in context", () => {
            mockContext.playerEntity = null;
            const result = getEntityIdsForScopes('self', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'self' requested but playerEntity or playerEntity.id is missing"));
        });

        test("should return an empty set and warn if playerEntity has no ID (edge case)", () => {
            mockContext.playerEntity.id = null; // Simulate missing ID
            const result = getEntityIdsForScopes('self', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'self' requested but playerEntity or playerEntity.id is missing"));
        });
    });

    // ******** NEW TEST SUITE FOR 'environment' mapping ********
    describe("Scope: environment (mapped)", () => {
        test("should behave like 'nearby_including_blockers'", () => {
            // Setup: Block passage1 with blocker1
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            // Setup: Add connection from current location to passage1
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            // Calculate expected: nearby + blocker1
            const expectedResult = new Set([...expectedNearbySet, blocker1.id]);

            const result = getEntityIdsForScopes('environment', mockContext); // Use 'environment' scope
            expect(result).toEqual(expectedResult);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test("should return 'nearby' results if no blockers configured, when called with 'environment'", () => {
            // No blockers configured in this setup
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}}); // Connect to unblocked passage

            const result = getEntityIdsForScopes('environment', mockContext);
            expect(result).toEqual(expectedNearbySet); // Should match nearby
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });
    });


    // --- Aggregator Function (`getEntityIdsForScopes`) Tests ---
    describe('getEntityIdsForScopes (Aggregator Logic)', () => {
        // These tests can now safely access passage1, blocker1 etc.

        test('should aggregate unique IDs correctly from multiple valid scopes including new ones', () => {
            // Setup a blocker for the 'environment' scope test
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            // Request equipment, self, and environment
            const result = getEntityIdsForScopes(['equipment', 'self', 'environment'], mockContext);

            // Expected: Equipment(shield) + Self(player) + Environment(nearby + blocker1)
            // The Set automatically handles duplicates. Player ID from 'self' might also be in inventory/equipment but Set handles it.
            const expected = new Set([
                // Equipment:
                shield.id,
                // Self
                mockPlayerEntity.id, // player-1
                // Environment -> nearby_including_blockers:
                // -> Nearby -> Inventory:
                sword.id, potion.id, shinyKey.id,
                // -> Nearby -> Location (player already excluded by mock):
                goblin.id, rock.id, rustyKey.id, door.id,
                // -> Blockers:
                blocker1.id
            ]);
            expect(result).toEqual(expected);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        test('should log warning and skip unknown scopes', () => {
            mockConsoleWarn.mockClear(); // Clear warnings from setup
            const result = getEntityIdsForScopes(['inventory', 'unknown_scope_xyz', 'location'], mockContext);
            const expected = new Set([
                sword.id, potion.id, shinyKey.id, // Inventory
                goblin.id, rock.id, rustyKey.id, door.id // Location
            ]);
            expect(result).toEqual(expected);
            // --- UPDATED ASSERTION ---
            expect(mockConsoleWarn).toHaveBeenCalledWith("getEntityIdsForScopes: Unknown or unhandled scope/domain requested: 'unknown_scope_xyz'. Skipping.");
        });

        test('should log message and skip "direction" and "none" scopes', () => {
            mockConsoleLog.mockClear(); // Clear log mock specifically
            const result = getEntityIdsForScopes(['inventory', 'direction', 'none', 'equipment'], mockContext);
            const expected = new Set([
                sword.id, potion.id, shinyKey.id, // Inventory
                shield.id // Equipment
            ]);
            expect(result).toEqual(expected);
            expect(mockConsoleLog).toHaveBeenCalledWith("getEntityIdsForScopes: Scope 'direction' does not resolve to entity IDs. Skipping.");
            expect(mockConsoleLog).toHaveBeenCalledWith("getEntityIdsForScopes: Scope 'none' does not resolve to entity IDs. Skipping.");
            expect(mockConsoleWarn).not.toHaveBeenCalled(); // Should be log, not warn
        });


        test('should log error and skip scope if handler throws, but process others', () => {
            // Mock the failing component method specifically for this test
            const originalGetComponent = mockPlayerEntity.getComponent;
            const erroringGetComponent = jest.fn((componentType) => {
                if (componentType === InventoryComponent) {
                    throw new Error("Test Error Getting Inventory");
                }
                // Use .call to maintain the correct 'this' context for the original method
                return originalGetComponent.call(mockPlayerEntity, componentType);
            });
            mockPlayerEntity.getComponent = erroringGetComponent;


            // Setup blocker for nearby_including_blockers part of the test (still relevant for error logging check)
            passage1.getComponent(PassageDetailsComponent).blockerEntityId = blocker1.id;
            ensureComponent(mockCurrentLocation, ConnectionsComponent, {connections: {north: passage1.id}});

            // Clear error mock before the call
            mockConsoleError.mockClear();

            // Request failing scope ('inventory') and successful ones ('equipment', 'nearby_including_blockers')
            const result = getEntityIdsForScopes(['inventory', 'equipment', 'nearby_including_blockers'], mockContext);

            // --- CORRECTED EXPECTATION ---
            // Expected: Only IDs from scopes that DON'T indirectly call the erroring mock.
            // - 'inventory': Fails directly (expected).
            // - 'equipment': Should succeed as it uses EquipmentComponent.
            // - 'nearby_including_blockers': Fails indirectly because it calls _handleNearby -> _handleInventory (expected).
            const expected = new Set([
                // Equipment:
                shield.id, // "item-shield"
                // Nothing from 'inventory' scope.
                // Nothing from 'nearby_including_blockers' scope.
            ]);
            // --- END CORRECTION ---

            // Assertion now checks if the result ONLY contains the shield ID
            expect(result).toEqual(expected); // This should now expect Set {'item-shield'}

            // Verify the errors were logged FOR BOTH failing scopes
            // --- UPDATED ASSERTION ---
            expect(mockConsoleError).toHaveBeenCalledTimes(2); // Once for 'inventory', once for 'nearby_including_blockers'

            // Check the error message for the 'inventory' scope failure
            // --- UPDATED ASSERTION ---
            expect(mockConsoleError).toHaveBeenCalledWith(
                "getEntityIdsForScopes: Error executing handler for scope/domain 'inventory':", // Updated string
                expect.objectContaining({message: "Test Error Getting Inventory"}) // Check the error object message
            );

            // Check the error message for the 'nearby_including_blockers' scope failure
            // --- UPDATED ASSERTION ---
            expect(mockConsoleError).toHaveBeenCalledWith(
                "getEntityIdsForScopes: Error executing handler for scope/domain 'nearby_including_blockers':", // Updated string
                expect.objectContaining({message: "Test Error Getting Inventory"}) // It fails with the same underlying error
            );


            mockPlayerEntity.getComponent = originalGetComponent; // Restore original method
        });


        test('should return empty set and log error if context is invalid (null)', () => {
            mockConsoleError.mockClear(); // Clear errors from setup/other tests
            const resultNull = getEntityIdsForScopes(['inventory'], null);
            expect(resultNull).toEqual(new Set());
            expect(mockConsoleError).toHaveBeenCalledWith("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", {context: null});
        });

        test('should return empty set and log error if context is invalid (missing entityManager)', () => {
            mockConsoleError.mockClear(); // Clear from previous test if needed
            const resultNoEM = getEntityIdsForScopes(['inventory'], {playerEntity: mockPlayerEntity}); // Missing EM
            expect(resultNoEM).toEqual(new Set());
            expect(mockConsoleError).toHaveBeenCalledWith("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", {context: {playerEntity: mockPlayerEntity}});
        });


    }); // End describe('getEntityIdsForScopes (Aggregator Logic)')

}); // End describe('entityScopeService')