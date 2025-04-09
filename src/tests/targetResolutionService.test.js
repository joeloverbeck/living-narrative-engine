// src/tests/targetResolutionService.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals'; // Use ESM version of jest
import {resolveTargetEntity} from '../services/targetResolutionService.js';
import Entity from '../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../components/nameComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
import {EquippableComponent} from '../components/equippableComponent.js';
import {HealthComponent} from '../components/healthComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {PositionComponent} from '../components/positionComponent.js';
import {TARGET_MESSAGES} from '../utils/messages.js';

// --- Mocks ---
const mockDispatch = jest.fn();
const mockEntityManager = {
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
    entities: new Map(),
    locations: new Map(), // Map<locationId, Set<entityId>>
};
const mockPlayerEntity = new Entity('player');
const mockCurrentLocation = new Entity('loc-1');

const mockContext = {
    playerEntity: mockPlayerEntity,
    currentLocation: mockCurrentLocation,
    entityManager: mockEntityManager,
    dispatch: mockDispatch,
    targets: [], // Will be set per test
    dataManager: {}, // Mock if needed
};

// Helper to create mock entities
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

// Helper to place entity in location
const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId).add(entityId);
    // Add PositionComponent if missing, mimicking SpatialIndexManager
    const entity = mockEntityManager.entities.get(entityId);
    if (entity && !entity.hasComponent(PositionComponent)) {
        entity.addComponent(new PositionComponent({locationId: locationId}));
    } else if (entity) {
        entity.getComponent(PositionComponent).setLocation(locationId);
    }
};

// Helper to add item to inventory
const addToInventory = (entityId, ownerEntity) => {
    let inv = ownerEntity.getComponent(InventoryComponent);
    if (!inv) {
        inv = new InventoryComponent();
        ownerEntity.addComponent(inv);
    }
    inv.addItem(entityId);
    // Mimic PositionComponent update (set location to null)
    const entity = mockEntityManager.entities.get(entityId);
    if (entity?.hasComponent(PositionComponent)) {
        entity.getComponent(PositionComponent).setLocation(null);
    }
};

// Helper to equip item
const equipItem = (itemId, slotId, ownerEntity) => {
    let eq = ownerEntity.getComponent(EquipmentComponent);
    if (!eq) {
        // Add a basic equipment component with the target slot
        const slots = {};
        slots[slotId] = null;
        eq = new EquipmentComponent({slots});
        ownerEntity.addComponent(eq);
    } else if (!eq.hasSlot(slotId)) {
        // Add slot if it doesn't exist for the test
        eq.slots[slotId] = null;
    }
    eq.equipItem(slotId, itemId);
};

describe('resolveTargetEntity', () => {
    // --- Test Data Setup Variables ---
    // Defined here so they are accessible in all tests within this describe block
    let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door;

    // --- Main Setup Function ---
    const setupTestData = () => {
        // Ensure player always starts with core components for helpers
        if (!mockPlayerEntity.hasComponent(InventoryComponent)) {
            mockPlayerEntity.addComponent(new InventoryComponent());
        }
        if (!mockPlayerEntity.hasComponent(EquipmentComponent)) {
            mockPlayerEntity.addComponent(new EquipmentComponent({
                slots: {
                    'core:slot_main_hand': null,
                    'core:slot_off_hand': null
                }
            })); // Add common slots
        }

        // Create Items
        sword = createMockEntity('sword-1', 'iron sword', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_main_hand'})]);
        shield = createMockEntity('shield-1', 'wooden shield', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_off_hand'})]);
        potion = createMockEntity('potion-1', 'red potion', [new ItemComponent()]); // Not equippable
        rustyKey = createMockEntity('key-rusty', 'rusty key', [new ItemComponent()]);
        shinyKey = createMockEntity('key-shiny', 'shiny key', [new ItemComponent()]);

        // Create Non-items / NPCs / Scenery
        goblin = createMockEntity('goblin-1', 'grumpy goblin', [new HealthComponent({current: 10, max: 10})]);
        rock = createMockEntity('rock-1', 'large rock', []); // No ItemComponent
        door = createMockEntity('door-1', 'wooden door', []);

        // Place entities in Location
        placeInLocation(goblin.id, 'loc-1');
        placeInLocation(rock.id, 'loc-1');
        placeInLocation(rustyKey.id, 'loc-1'); // rusty key starts in location
        placeInLocation(door.id, 'loc-1');

        // Put some items in Player Inventory
        addToInventory(sword.id, mockPlayerEntity);
        addToInventory(potion.id, mockPlayerEntity);
        addToInventory(shinyKey.id, mockPlayerEntity); // shiny key starts in inventory
    };

    // --- Reset Mocks Before Each Test ---
    beforeEach(() => {
        mockDispatch.mockClear();
        mockEntityManager.entities.clear();
        mockEntityManager.locations.clear();
        mockEntityManager.getEntityInstance.mockClear();
        mockEntityManager.getEntitiesInLocation.mockClear();

        // Reset player/location (clear components added during tests, keep base ID)
        mockPlayerEntity.components.clear();
        mockCurrentLocation.components.clear(); // Assuming location doesn't need persistent components

        // Re-add core player/location entities to manager
        mockEntityManager.entities.set(mockPlayerEntity.id, mockPlayerEntity);
        mockEntityManager.entities.set(mockCurrentLocation.id, mockCurrentLocation);

        // Ensure player is in the location
        placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id);

        // Clear context targets
        mockContext.targets = [];
    });


    // --- Basic Tests ---
    test('should return null if targetName is empty', () => {
        setupTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'take',
            targetName: ' ', // Empty/whitespace
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).not.toHaveBeenCalled(); // Caller should handle "PROMPT_WHAT"
    });

    // --- Scope Tests ---
    test('should find unique item in inventory', () => {
        setupTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'sword',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(sword);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique item in location_items', () => {
        setupTestData();
        const config = {
            scope: 'location_items',
            requiredComponents: [ItemComponent],
            actionVerb: 'take',
            targetName: 'rusty key',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(rustyKey);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique non-item in location_non_items', () => {
        setupTestData();
        const config = {
            scope: 'location_non_items',
            requiredComponents: [], // Just NameComponent implicitly
            actionVerb: 'look',
            targetName: 'rock',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(rock);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique target in location (any type)', () => {
        setupTestData();
        const config = {
            scope: 'location',
            requiredComponents: [HealthComponent], // Find the goblin
            actionVerb: 'attack',
            targetName: 'goblin',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(goblin);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique equipped item', () => {
        setupTestData();
        equipItem(shield.id, 'core:slot_off_hand', mockPlayerEntity);
        const config = {
            scope: 'equipment',
            requiredComponents: [ItemComponent], // Equippable already implied by being equipped
            actionVerb: 'unequip',
            targetName: 'shield',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(shield);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique item using combined scope (inventory first)', () => {
        setupTestData();
        const config = {
            scope: ['inventory', 'location_items'],
            requiredComponents: [ItemComponent],
            actionVerb: 'examine',
            targetName: 'potion', // Exists only in inventory
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(potion);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique item using combined scope (location first)', () => {
        setupTestData();
        const config = {
            scope: ['location_items', 'inventory'],
            requiredComponents: [ItemComponent],
            actionVerb: 'examine',
            targetName: 'rusty', // Exists only in location
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(rustyKey);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique item using "nearby" scope (from inventory)', () => {
        setupTestData();
        const config = {
            scope: 'nearby',
            requiredComponents: [ItemComponent],
            actionVerb: 'use',
            targetName: 'shiny key',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(shinyKey);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique entity using "nearby" scope (from location)', () => {
        setupTestData();
        const config = {
            scope: 'nearby',
            requiredComponents: [], // Any named entity nearby
            actionVerb: 'look',
            targetName: 'door',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(door);
        expect(mockDispatch).not.toHaveBeenCalled();
    });


    // --- Component Filtering Tests ---
    test('should only find item with required EquippableComponent in inventory', () => {
        setupTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent, EquippableComponent], // Potion should be excluded
            actionVerb: 'equip',
            targetName: 'sword',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(sword);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should fail to find item without required EquippableComponent in inventory', () => {
        setupTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent, EquippableComponent],
            actionVerb: 'equip',
            targetName: 'potion', // Potion is not equippable
            // Omitting notFoundMessageKey to test default dispatch behavior
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        // Expect the default message for 'equip' action failure
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE('potion'),
            type: 'info',
        });
    });

    // --- findTarget Outcome Tests (Default Dispatch Behavior) ---
    test('should dispatch default NOT_FOUND_INVENTORY in inventory', () => {
        setupTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'helmet', // Doesn't exist
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_INVENTORY('helmet'),
            type: 'info',
        });
    });

    test('should dispatch default NOT_FOUND_LOCATION in location', () => {
        setupTestData();
        const config = {
            scope: 'location',
            requiredComponents: [],
            actionVerb: 'look',
            targetName: 'dragon', // Doesn't exist
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_LOCATION('dragon'),
            type: 'info',
        });
    });

    test('should dispatch default AMBIGUOUS_PROMPT (multiple keys)', () => {
        setupTestData();
        addToInventory(rustyKey.id, mockPlayerEntity); // shinyKey already in inventory from setup
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'key', // Ambiguous
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();

        // Use string matching for flexibility
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: "Which key do you want to drop: shiny key, rusty key?",
            type: 'warning',
        });
    });

    test('should dispatch default SCOPE_EMPTY_GENERIC for empty location scope', () => {
        setupTestData();
        // Remove all items from location for this test
        mockEntityManager.locations.get('loc-1').delete(rustyKey.id); // Remove the only item

        const config = {
            scope: 'location_items', // Look only for items
            requiredComponents: [ItemComponent],
            actionVerb: 'take',
            targetName: 'key',
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            // Expect SCOPE_EMPTY_GENERIC because scope='location_items' is not purely personal
            // The context 'here' is derived correctly.
            text: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('take', 'here'),
            type: 'info',
        });
    });

    // --- Custom Filter Tests ---
    test('should use custom filter', () => {
        setupTestData();
        const customFilter = (entity) => entity.id === 'potion-1'; // Only find the potion
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'use',
            targetName: 'potion', // Matches name
            customFilter: customFilter,
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBe(potion);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    // --- Edge Case Tests ---
    test('should handle missing player component during scope build (e.g., no inventory)', () => {
        // Don't add InventoryComponent to player
        // Note: beforeEach clears components, so just don't call setupTestData() or add it manually.

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        }); // Suppress console output
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'thing',
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull(); // Fails because scope is effectively empty
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("lacks InventoryComponent"));
        // Since the scope could not be processed, filteredEntities is empty.
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL('drop'),
            type: 'info',
        });
        consoleWarnSpy.mockRestore();
    });

    test('should use custom notFoundMessageKey when provided', () => {
        setupTestData();
        const config = {
            scope: 'location',
            requiredComponents: [],
            actionVerb: 'zap', // Custom verb
            targetName: 'widget', // Doesn't exist
            notFoundMessageKey: 'NOT_FOUND_TAKEABLE', // Use a different message explicitly
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        // Should use the *exact* key provided in the config
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_TAKEABLE('widget'),
            type: 'info',
        });
    });

    // ==============================================================
    // --- NEW: Tests for Message Suppression (notFoundMessageKey: null) ---
    // ==============================================================
    describe('resolveTargetEntity message suppression (notFoundMessageKey: null)', () => {
        // Note: Relies on the outer beforeEach for mock resets.

        test('should NOT dispatch when NOT_FOUND and notFoundMessageKey is null', () => {
            setupTestData(); // Ensure inventory/location have items
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                actionVerb: 'drop',
                targetName: 'nonexistent_item',
                notFoundMessageKey: null, // Suppress dispatch
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull();
            // Crucially check that *no* 'ui:message_display' event was dispatched.
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });

        test('should NOT dispatch when FOUND_AMBIGUOUS and notFoundMessageKey is null', () => {
            setupTestData();
            addToInventory(rustyKey.id, mockPlayerEntity); // shinyKey already added in setupTestData
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                actionVerb: 'drop',
                targetName: 'key', // Ambiguous target
                notFoundMessageKey: null, // Suppress dispatch
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });

        test('should NOT dispatch when scope is empty after filtering and notFoundMessageKey is null', () => {
            setupTestData();
            // Use a component filter that matches nothing in inventory
            const config = {
                scope: 'inventory',
                // Require a component none of the test items have
                requiredComponents: [ItemComponent, HealthComponent],
                actionVerb: 'drop',
                targetName: 'anything', // Target name doesn't matter if scope is empty
                notFoundMessageKey: null, // Suppress dispatch
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });

        test('should NOT dispatch when initial scope build fails (e.g. no inventory comp) and notFoundMessageKey is null', () => {
            // Player starts without InventoryComponent (due to outer beforeEach)
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                actionVerb: 'drop',
                targetName: 'anything',
                notFoundMessageKey: null, // Suppress dispatch
            };
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("lacks InventoryComponent"));
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
            consoleWarnSpy.mockRestore();
        });

        test('should still return found entity even if notFoundMessageKey is null', () => {
            setupTestData();
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                actionVerb: 'drop',
                targetName: 'sword', // Exists
                notFoundMessageKey: null, // Should have no effect on success case
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBe(sword); // Should find the sword
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });
    }); // End describe for message suppression tests

}); // End describe for resolveTargetEntity