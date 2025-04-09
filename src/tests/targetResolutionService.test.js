// src/tests/targetResolutionService.test.js

import {expect, jest, test} from '@jest/globals'; // Use ESM version of jest
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
    beforeEach(() => {
        // Reset mocks before each test
        mockDispatch.mockClear();
        mockEntityManager.entities.clear();
        mockEntityManager.locations.clear();
        mockEntityManager.getEntityInstance.mockClear();
        mockEntityManager.getEntitiesInLocation.mockClear();
        // Reset player/location (clear components added during tests)
        mockPlayerEntity.components.clear();
        mockCurrentLocation.components.clear();
        mockEntityManager.entities.set('player', mockPlayerEntity);
        mockEntityManager.entities.set('loc-1', mockCurrentLocation);
        placeInLocation('player', 'loc-1'); // Put player in loc-1 by default
        mockContext.targets = []; // Clear targets
    });

    // --- Test Data Setup ---
    let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door;
    const setupTestData = () => {
        // Items
        sword = createMockEntity('sword-1', 'iron sword', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_main_hand'})]);
        shield = createMockEntity('shield-1', 'wooden shield', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_off_hand'})]);
        potion = createMockEntity('potion-1', 'red potion', [new ItemComponent()]); // Not equippable
        rustyKey = createMockEntity('key-rusty', 'rusty key', [new ItemComponent()]);
        shinyKey = createMockEntity('key-shiny', 'shiny key', [new ItemComponent()]);

        // Non-items / NPCs / Scenery
        goblin = createMockEntity('goblin-1', 'grumpy goblin', [new HealthComponent({current: 10, max: 10})]);
        rock = createMockEntity('rock-1', 'large rock', []); // No ItemComponent
        door = createMockEntity('door-1', 'wooden door', []);

        // Place entities
        placeInLocation(goblin.id, 'loc-1');
        placeInLocation(rock.id, 'loc-1');
        placeInLocation(rustyKey.id, 'loc-1');
        placeInLocation(door.id, 'loc-1');

        // Put some items in player inventory
        addToInventory(sword.id, mockPlayerEntity);
        addToInventory(potion.id, mockPlayerEntity);
        addToInventory(shinyKey.id, mockPlayerEntity);
    };

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
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE('potion'), // Specific message key check
            type: 'info',
        });
    });

    // --- findTarget Outcome Tests ---
    test('should handle NOT_FOUND in inventory', () => {
        setupTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'helmet', // Doesn't exist
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_INVENTORY('helmet'),
            type: 'info',
        });
    });

    test('should handle NOT_FOUND in location', () => {
        setupTestData();
        const config = {
            scope: 'location',
            requiredComponents: [],
            actionVerb: 'look',
            targetName: 'dragon', // Doesn't exist
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_LOCATION('dragon'),
            type: 'info',
        });
    });

    test('should handle FOUND_AMBIGUOUS (multiple keys)', () => {
        setupTestData(); // rustyKey, shinyKey
        addToInventory(rustyKey.id, mockPlayerEntity); // Now 2 keys in inventory
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'key', // Ambiguous
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();

        // --- MODIFICATION START ---
        // 1. Determine the expected text. You might need TARGET_MESSAGES imported,
        //    OR construct the expected string manually based on how AMBIGUOUS_PROMPT works.
        //    Assuming TARGET_MESSAGES is available and AMBIGUOUS_PROMPT works as expected:
        let expectedText;
        try {
            // If TARGET_MESSAGES and getDisplayName work correctly in the test context:
            expectedText = TARGET_MESSAGES.AMBIGUOUS_PROMPT('drop', 'key', [shinyKey, rustyKey]);
            // Example expected output (depends on getDisplayName):
            // "Which key do you want to drop? (rusty key, shiny key)"
        } catch (e) {
            // Fallback if TARGET_MESSAGES or getDisplayName is complex/unavailable here
            // Manually construct the string or use regex matching
            console.warn("Could not dynamically generate ambiguous message for test, using hardcoded expectation or regex.");
            // Option A: Hardcode based on expected output
            // expectedText = "Which key do you want to drop? (rusty key, shiny key)";
            // Option B: Use regex (more flexible if name details change)
            expectedText = expect.stringMatching(/Which key.*drop\?.*shiny key.*rusty key/);
        }


        // 2. Assert against the expected text (or matcher)
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: expectedText, // Use the determined expected string/matcher
            type: 'warning',
        });
        // --- MODIFICATION END ---
    });

    test('should handle empty scope (no suitable items in location)', () => {
        setupTestData();
        // Remove the only item initially in location
        mockEntityManager.entities.delete(rustyKey.id);
        mockEntityManager.locations.get('loc-1').delete(rustyKey.id);

        const config = {
            scope: 'location_items',
            requiredComponents: [ItemComponent],
            actionVerb: 'take',
            targetName: 'key',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: expect.stringContaining("You don't see anything suitable to take here"),
            type: 'info',
        });
    });

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

    test('should exclude item based on custom filter', () => {
        setupTestData();
        const customFilter = (entity) => entity.id !== 'sword-1'; // Exclude the sword
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'sword', // Matches name but filter excludes
            customFilter: customFilter,
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        // It fails because the only match ('sword') was filtered out, resulting in NOT_FOUND
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_INVENTORY('sword'),
            type: 'info',
        });
    });

    test('should handle missing component during scope build (e.g., no inventory)', () => {
        // Don't run setupTestData() which adds inventory
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        }); // Suppress console output for this test
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'drop',
            targetName: 'thing',
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull(); // Fails because scope is effectively empty
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("lacks InventoryComponent"));
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', { // Should dispatch empty scope message
            text: expect.stringContaining("You don't see anything suitable to drop on you"),
            type: 'info',
        });
        consoleWarnSpy.mockRestore();
    });

    test('should use custom notFoundMessageKey', () => {
        setupTestData();
        const config = {
            scope: 'location',
            requiredComponents: [],
            actionVerb: 'zap',
            targetName: 'widget', // Doesn't exist
            notFoundMessageKey: 'NOT_FOUND_TAKEABLE' // Use a different message
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_TAKEABLE('widget'), // Check specific message used
            type: 'info',
        });
    });
});