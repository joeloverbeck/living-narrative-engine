import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {getEntityIdsForScopes} from '../../services/entityScopeService.js'; // Adjust path as needed
import Entity from '../../entities/entity.js'; // Adjust path as needed
import {NameComponent} from '../../components/nameComponent.js'; // Adjust path as needed
import {ItemComponent} from '../../components/itemComponent.js'; // Adjust path as needed
import {EquippableComponent} from '../../components/equippableComponent.js'; // Adjust path as needed
import {HealthComponent} from '../../components/healthComponent.js'; // Adjust path as needed
import {InventoryComponent} from '../../components/inventoryComponent.js'; // Adjust path as needed
import {EquipmentComponent} from '../../components/equipmentComponent.js'; // Adjust path as needed
import {PositionComponent} from '../../components/positionComponent.js'; // Adjust path as needed

// --- Mocks ---
// Mock console methods BEFORE tests run to capture logs during setup/execution
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {
});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {
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
    dataManager: {},
};

// --- Helper Functions (for setting up test data consistently) ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity); // Register entity with mock manager
    return entity;
};

const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId).add(entityId); // Add entity ID to location set
    const entity = mockEntityManager.entities.get(entityId);
    // Ensure entity has a PositionComponent reflecting its location
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

const addToInventory = (entityId, ownerEntity) => {
    let inv = ownerEntity.getComponent(InventoryComponent);
    if (!inv) {
        inv = new InventoryComponent();
        ownerEntity.addComponent(inv);
    }
    inv.addItem(entityId); // Use component's method
    const entity = mockEntityManager.entities.get(entityId);
    // Items in inventory typically don't have a world location
    if (entity?.hasComponent(PositionComponent)) {
        entity.getComponent(PositionComponent).setLocation(null);
    }
};

const equipItem = (itemId, slotId, ownerEntity) => {
    let eq = ownerEntity.getComponent(EquipmentComponent);
    // Ensure EquipmentComponent and the specific slot exist
    if (!eq) {
        const slots = {};
        slots[slotId] = null;
        eq = new EquipmentComponent({slots});
        ownerEntity.addComponent(eq);
    } else if (!eq.hasSlot(slotId)) {
        eq.slots[slotId] = null; // Add slot if it doesn't exist
    }
    // Use component's method
    eq.equipItem(slotId, itemId);
};

// --- Test Suite ---
describe('entityScopeService', () => {
    // Declare variables for test entities
    let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door;

    // --- Reset Mocks and Setup Common Test Data Before Each Test ---
    beforeEach(() => {
        // Clear mock function calls and internal states
        mockConsoleWarn.mockClear();
        mockConsoleError.mockClear();
        mockEntityManager.entities.clear();
        mockEntityManager.locations.clear();
        // Reset mock implementations to default behavior
        mockEntityManager.getEntityInstance.mockClear().mockImplementation((id) => mockEntityManager.entities.get(id));
        mockEntityManager.getEntitiesInLocation.mockClear().mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());
        mockContext.dispatch.mockClear();

        // Create fresh player and location for isolation
        mockPlayerEntity = createMockEntity('player', 'Player');
        mockCurrentLocation = createMockEntity('loc-1', 'Test Room');

        // Add standard components to player
        mockPlayerEntity.addComponent(new InventoryComponent());
        mockPlayerEntity.addComponent(new EquipmentComponent({slots: {'main': null, 'off': null}})); // Define standard slots

        // Place player in the mock location
        placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id);

        // Update context with fresh player/location references
        mockContext.playerEntity = mockPlayerEntity;
        mockContext.currentLocation = mockCurrentLocation;

        // Create common test entities
        sword = createMockEntity('sword-1', 'iron sword', [new ItemComponent(), new EquippableComponent({slotId: 'main'})]);
        shield = createMockEntity('shield-1', 'wooden shield', [new ItemComponent(), new EquippableComponent({slotId: 'off'})]);
        potion = createMockEntity('potion-1', 'red potion', [new ItemComponent()]);
        rustyKey = createMockEntity('key-rusty', 'rusty key', [new ItemComponent()]);
        shinyKey = createMockEntity('key-shiny', 'shiny key', [new ItemComponent()]);
        goblin = createMockEntity('goblin-1', 'grumpy goblin', [new HealthComponent({current: 10, max: 10})]); // Non-item NPC
        rock = createMockEntity('rock-1', 'large rock', []); // Non-item scenery
        door = createMockEntity('door-1', 'wooden door', []); // Non-item scenery/interactable

        // Distribute entities into the test environment
        placeInLocation(goblin.id, mockCurrentLocation.id);
        placeInLocation(rock.id, mockCurrentLocation.id);
        placeInLocation(rustyKey.id, mockCurrentLocation.id); // Key starts on the ground
        placeInLocation(door.id, mockCurrentLocation.id);

        addToInventory(sword.id, mockPlayerEntity); // Sword starts in inventory
        addToInventory(potion.id, mockPlayerEntity); // Potion starts in inventory
        addToInventory(shinyKey.id, mockPlayerEntity); // Other key starts in inventory

        equipItem(shield.id, 'off', mockPlayerEntity); // Shield starts equipped
    });

    // --- Individual Scope Handler Tests (Tested via the public getEntityIdsForScopes function) ---

    describe('Scope: inventory', () => {
        test('should return IDs of all items currently in player inventory', () => {
            const result = getEntityIdsForScopes('inventory', mockContext);
            // Sword, potion, shinyKey start in inventory
            expect(result).toEqual(new Set([sword.id, potion.id, shinyKey.id]));
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return empty set and log warning if playerEntity is missing from context', () => {
            mockContext.playerEntity = null; // Simulate missing player context
            const result = getEntityIdsForScopes('inventory', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("playerEntity is missing"));
        });

        test('should return empty set and log warning if player lacks InventoryComponent', () => {
            mockPlayerEntity.removeComponent(InventoryComponent); // Remove the component
            const result = getEntityIdsForScopes('inventory', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("lacks InventoryComponent"));
        });

        test('should return an empty set if the inventory component exists but holds no items', () => {
            // Clear inventory items directly for the test (assuming no public 'clear' method)
            mockPlayerEntity.getComponent(InventoryComponent).items.length = 0;
            const result = getEntityIdsForScopes('inventory', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });
    });

    describe('Scope: location', () => {
        test('should return IDs of all entities in the current location, excluding the player', () => {
            const result = getEntityIdsForScopes('location', mockContext);
            // Goblin, rock, rustyKey, door start in location
            expect(result).toEqual(new Set([goblin.id, rock.id, rustyKey.id, door.id]));
            expect(result.has(mockPlayerEntity.id)).toBe(false); // Explicitly check player exclusion
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return empty set and log warning if currentLocation is null in context', () => {
            mockContext.currentLocation = null; // Simulate missing location context
            const result = getEntityIdsForScopes('location', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        });

        test('should correctly exclude player instance even if playerEntity context is provided but its ID is temporarily null', () => {
            // This tests robustness of instance comparison vs ID comparison for player exclusion
            const originalId = mockPlayerEntity.id;
            mockPlayerEntity.id = null; // Make ID on the object null
            mockContext.playerEntity = mockPlayerEntity; // Context still has the player object

            // Ensure the original ID is still in the location map for the handler to find initially
            placeInLocation(originalId, mockCurrentLocation.id); // Re-add original ID if needed

            const result = getEntityIdsForScopes('location', mockContext);

            // Expectation: Player should still be excluded based on object instance comparison in _handleLocation
            expect(result).toEqual(new Set([goblin.id, rock.id, rustyKey.id, door.id]));
            expect(result.has(originalId)).toBe(false); // Ensure original ID is not included

            // Restore ID for subsequent tests
            mockPlayerEntity.id = originalId;
        });

        test('should return an empty set if the location is empty (aside from the player)', () => {
            // Remove everything except the player from the location set
            mockEntityManager.locations.get(mockCurrentLocation.id).clear();
            mockEntityManager.locations.get(mockCurrentLocation.id).add(mockPlayerEntity.id);

            const result = getEntityIdsForScopes('location', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should log warning and exclude dangling entity IDs (IDs in location set but not in entity map)', () => {
            const danglingId = 'dangling-entity-123';
            // Add an ID to the location set that doesn't correspond to a known entity
            mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);
            // Ensure getEntityInstance will return undefined for this specific ID
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === danglingId) return undefined;
                return mockEntityManager.entities.get(id); // Default behavior for others
            });

            const result = getEntityIdsForScopes('location', mockContext);
            // Expected result should contain only the valid entities
            expect(result).toEqual(new Set([goblin.id, rock.id, rustyKey.id, door.id]));
            expect(result.has(danglingId)).toBe(false); // Ensure dangling ID is excluded
            // Verify the warning was logged
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} listed in location ${mockCurrentLocation.id} but instance not found`));
        });
    });

    describe('Scope: equipment', () => {
        test('should return IDs of all items currently equipped by the player', () => {
            const result = getEntityIdsForScopes('equipment', mockContext);
            // Shield starts equipped
            expect(result).toEqual(new Set([shield.id]));
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return multiple IDs if multiple items are equipped', () => {
            equipItem(sword.id, 'main', mockPlayerEntity); // Equip the sword too
            const result = getEntityIdsForScopes('equipment', mockContext);
            // Expect both shield (off-hand) and sword (main-hand)
            expect(result).toEqual(new Set([shield.id, sword.id]));
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return empty set and log warning if playerEntity is missing from context', () => {
            mockContext.playerEntity = null;
            const result = getEntityIdsForScopes('equipment', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("playerEntity is missing"));
        });

        test('should return empty set and log warning if player lacks EquipmentComponent', () => {
            mockPlayerEntity.removeComponent(EquipmentComponent);
            const result = getEntityIdsForScopes('equipment', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("lacks EquipmentComponent"));
        });

        test('should return an empty set if the equipment component exists but no items are equipped', () => {
            // Unequip the shield (assuming a method exists, otherwise manipulate slots directly)
            mockPlayerEntity.getComponent(EquipmentComponent).unequipItem('off');
            const result = getEntityIdsForScopes('equipment', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });
    });

    describe('Scope: location_items', () => {
        test('should return only IDs of entities with ItemComponent from the location, excluding player', () => {
            const result = getEntityIdsForScopes('location_items', mockContext);
            // Only rustyKey starts in the location and has ItemComponent
            expect(result).toEqual(new Set([rustyKey.id]));
            // Explicitly check others are excluded
            expect(result.has(mockPlayerEntity.id)).toBe(false);
            expect(result.has(goblin.id)).toBe(false); // Not an item
            expect(result.has(rock.id)).toBe(false); // Not an item
            expect(result.has(door.id)).toBe(false); // Not an item
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return an empty set if no items are present in the location (only non-items or player)', () => {
            // Remove the only item (rustyKey) from the location
            mockEntityManager.locations.get(mockCurrentLocation.id).delete(rustyKey.id);
            const result = getEntityIdsForScopes('location_items', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return empty set and log warning if currentLocation is null', () => {
            mockContext.currentLocation = null;
            const result = getEntityIdsForScopes('location_items', mockContext);
            expect(result).toEqual(new Set());
            // Warning comes from the underlying _handleLocation call
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        });

        test('should correctly handle and exclude dangling IDs from the location', () => {
            const danglingId = 'dangling-item-456';
            mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === danglingId) return undefined;
                return mockEntityManager.entities.get(id);
            });

            const result = getEntityIdsForScopes('location_items', mockContext);
            expect(result).toEqual(new Set([rustyKey.id])); // Dangling ID should not be included
            // Warning comes from the underlying _handleLocation call
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} listed in location ${mockCurrentLocation.id} but instance not found`));
        });
    });

    describe('Scope: location_non_items', () => {
        test('should return only IDs of entities without ItemComponent from location, excluding player', () => {
            const result = getEntityIdsForScopes('location_non_items', mockContext);
            // Goblin, rock, door start in location and lack ItemComponent
            expect(result).toEqual(new Set([goblin.id, rock.id, door.id]));
            // Explicitly check others are excluded
            expect(result.has(mockPlayerEntity.id)).toBe(false);
            expect(result.has(rustyKey.id)).toBe(false); // Has ItemComponent
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return an empty set if only items (or player) are present in the location', () => {
            // Remove all non-items
            mockEntityManager.locations.get(mockCurrentLocation.id).delete(goblin.id);
            mockEntityManager.locations.get(mockCurrentLocation.id).delete(rock.id);
            mockEntityManager.locations.get(mockCurrentLocation.id).delete(door.id);
            // Only player and rustyKey (item) remain in the location set

            const result = getEntityIdsForScopes('location_non_items', mockContext);
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should return empty set and log warning if currentLocation is null', () => {
            mockContext.currentLocation = null;
            const result = getEntityIdsForScopes('location_non_items', mockContext);
            expect(result).toEqual(new Set());
            // Warning comes from the underlying _handleLocation call
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        });

        test('should correctly handle and exclude dangling IDs from the location', () => {
            const danglingId = 'dangling-nonitem-789';
            mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === danglingId) return undefined;
                return mockEntityManager.entities.get(id);
            });

            const result = getEntityIdsForScopes('location_non_items', mockContext);
            // Dangling ID should not be included
            expect(result).toEqual(new Set([goblin.id, rock.id, door.id]));
            // Warning comes from the underlying _handleLocation call
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} listed in location ${mockCurrentLocation.id} but instance not found`));
        });
    });

    describe('Scope: nearby', () => {
        test('should return combined unique IDs from inventory and location (excluding player from location)', () => {
            const result = getEntityIdsForScopes('nearby', mockContext);
            const expected = new Set([
                // Inventory items
                sword.id, potion.id, shinyKey.id,
                // Location entities (excluding player)
                goblin.id, rock.id, rustyKey.id, door.id
            ]);
            expect(result).toEqual(expected);
            expect(result.has(mockPlayerEntity.id)).toBe(false);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
        });

        test('should work correctly if inventory is empty but location has entities', () => {
            // Clear inventory
            mockPlayerEntity.getComponent(InventoryComponent).items.length = 0;

            const result = getEntityIdsForScopes('nearby', mockContext);
            const expected = new Set([
                // Location entities only (excluding player)
                goblin.id, rock.id, rustyKey.id, door.id
            ]);
            expect(result).toEqual(expected);
            expect(mockConsoleWarn).not.toHaveBeenCalled(); // No warnings expected here
        });

        test('should work correctly if location is empty (except player) but inventory has items', () => {
            // Clear location except for player
            mockEntityManager.locations.get(mockCurrentLocation.id).clear();
            mockEntityManager.locations.get(mockCurrentLocation.id).add(mockPlayerEntity.id);

            const result = getEntityIdsForScopes('nearby', mockContext);
            const expected = new Set([
                // Inventory items only
                sword.id, potion.id, shinyKey.id,
            ]);
            expect(result).toEqual(expected);
            expect(mockConsoleWarn).not.toHaveBeenCalled(); // No warnings expected here
        });

        test('should handle missing playerEntity context (inventory fails, location proceeds but includes player ID)', () => {
            const originalPlayerId = mockPlayerEntity.id; // Get ID before nulling context
            mockContext.playerEntity = null; // Remove player from context

            const result = getEntityIdsForScopes('nearby', mockContext);

            // Expectation: Location handler runs but cannot exclude player instance. Inventory handler fails.
            const expected = new Set([
                // Location entities (player exclusion doesn't happen as playerEntity is null in context)
                goblin.id, rock.id, rustyKey.id, door.id, originalPlayerId // Player should be included now
            ]);
            expect(result).toEqual(expected);

            // Warning expected from _handleInventory (due to null playerEntity)
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("playerEntity is missing"));
            // Should also get warning from equipment if it were requested, but not from location itself
        });

        test('should handle missing currentLocation context (location fails, inventory proceeds)', () => {
            mockContext.currentLocation = null; // Remove location from context

            const result = getEntityIdsForScopes('nearby', mockContext);
            const expected = new Set([
                // Inventory items only
                sword.id, potion.id, shinyKey.id,
            ]);
            expect(result).toEqual(expected);
            // Warning expected from _handleLocation (and derivatives)
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        });

        test('should correctly handle and exclude dangling IDs originating from the location part', () => {
            const danglingId = 'dangling-nearby-000';
            mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === danglingId) return undefined;
                return mockEntityManager.entities.get(id);
            });

            const result = getEntityIdsForScopes('nearby', mockContext);
            const expected = new Set([
                // Inventory items
                sword.id, potion.id, shinyKey.id,
                // Location entities (excluding player, excluding dangling)
                goblin.id, rock.id, rustyKey.id, door.id
            ]);
            expect(result).toEqual(expected);
            // Warning comes from the underlying _handleLocation call
            expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} listed in location ${mockCurrentLocation.id} but instance not found`));
        });
    });

    // --- Aggregator Function (`getEntityIdsForScopes`) Tests ---

    describe('getEntityIdsForScopes (Aggregator Logic)', () => {
        test('should aggregate unique IDs correctly from multiple valid scopes', () => {
            // Requesting inventory, location, and equipment
            const result = getEntityIdsForScopes(['inventory', 'location', 'equipment'], mockContext);
            const expected = new Set([
                // Inventory:
                sword.id, potion.id, shinyKey.id,
                // Location (player excluded):
                goblin.id, rock.id, rustyKey.id, door.id,
                // Equipment:
                shield.id
            ]);
            expect(result).toEqual(expected);
            expect(mockConsoleWarn).not.toHaveBeenCalled();
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        test('should handle a single scope string input correctly', () => {
            const result = getEntityIdsForScopes('inventory', mockContext); // Single string scope
            expect(result).toEqual(new Set([sword.id, potion.id, shinyKey.id]));
            expect(mockConsoleWarn).not.toHaveBeenCalled();
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        test('should log warning and skip unknown scopes, while still processing valid ones', () => {
            const result = getEntityIdsForScopes(['inventory', 'unknown_scope_xyz', 'location'], mockContext);
            const expected = new Set([
                // Inventory results:
                sword.id, potion.id, shinyKey.id,
                // Location results:
                goblin.id, rock.id, rustyKey.id, door.id
                // 'unknown_scope_xyz' should be skipped
            ]);
            expect(result).toEqual(expected); // Contains results only from valid scopes
            expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
            expect(mockConsoleWarn).toHaveBeenCalledWith("getEntityIdsForScopes: Unknown scope requested: 'unknown_scope_xyz'. Skipping.");
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        test('should log error and skip a scope if its handler throws an exception, but process other scopes', () => {
            // Arrange: Make the inventory handler effectively throw by mocking a dependency call within it
            const expectedErrorMessage = "Simulated failure during inventory processing!";
            const originalGetComponent = mockPlayerEntity.getComponent; // Store original method
            // Mock getComponent specifically for InventoryComponent to throw an error
            mockPlayerEntity.getComponent = jest.fn((componentType) => {
                if (componentType === InventoryComponent) {
                    throw new Error(expectedErrorMessage);
                }
                // Call the original method for other component types (important for other scopes)
                return originalGetComponent.call(mockPlayerEntity, componentType);
            });

            // Act: Request scopes including the one designed to fail ('inventory')
            const result = getEntityIdsForScopes(['equipment', 'inventory', 'location'], mockContext);

            // Assert: Check results and logs
            // Expected: Results from 'equipment' and 'location', but not 'inventory'.
            const expected = new Set([
                shield.id, // from equipment
                goblin.id, rock.id, rustyKey.id, door.id // from location
            ]);

            expect(result).toEqual(expected); // Contains results from non-failing scopes
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(mockConsoleError).toHaveBeenCalledWith(
                "getEntityIdsForScopes: Error executing handler for scope 'inventory':", // Check message prefix
                expect.any(Error) // Check an Error object was logged
            );
            // Optionally check the specific error message logged
            expect(mockConsoleError.mock.calls[0][1].message).toBe(expectedErrorMessage);
            // Verify the mock causing the throw was indeed called
            expect(mockPlayerEntity.getComponent).toHaveBeenCalledWith(InventoryComponent);
            // No warnings expected for this specific failure scenario
            expect(mockConsoleWarn).not.toHaveBeenCalled();

            // Clean up the mock by restoring the original method
            mockPlayerEntity.getComponent = originalGetComponent;
        });

        test('should return an empty set if the input scopes array is empty', () => {
            const result = getEntityIdsForScopes([], mockContext); // Empty array
            expect(result).toEqual(new Set());
            expect(mockConsoleWarn).not.toHaveBeenCalled();
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        test('should return an empty set and log error if the provided context is null or undefined', () => {
            const resultNull = getEntityIdsForScopes(['inventory'], null);
            expect(resultNull).toEqual(new Set());
            expect(mockConsoleError).toHaveBeenCalledWith("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", {context: null});

            mockConsoleError.mockClear(); // Clear mock before next check

            const resultUndefined = getEntityIdsForScopes(['inventory'], undefined);
            expect(resultUndefined).toEqual(new Set());
            expect(mockConsoleError).toHaveBeenCalledWith("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", {context: undefined});
        });

        test('should return an empty set and log error if the context lacks the entityManager property', () => {
            // Create context object missing the essential entityManager
            const incompleteContext = {...mockContext, entityManager: undefined};
            const result = getEntityIdsForScopes(['inventory'], incompleteContext);
            expect(result).toEqual(new Set());
            // Check error log with the problematic context
            expect(mockConsoleError).toHaveBeenCalledWith("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", expect.objectContaining({context: incompleteContext}));
        });

    }); // End describe('getEntityIdsForScopes (Aggregator Logic)')

}); // End describe('entityScopeService')