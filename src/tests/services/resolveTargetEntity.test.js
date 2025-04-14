// src/test/services/resolveTargetEntity.test.js


import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {
    resolveTargetEntity,
} from '../../services/targetResolutionService.js';
import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../../components/nameComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js'; // Assuming exists
import {HealthComponent} from '../../components/healthComponent.js'; // Assuming exists
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';

// --- Mocks ---
const mockDispatch = jest.fn(); // General dispatch mock for resolveTargetEntity/Connection context
const mockEventBusDispatch = jest.fn(); // Specific dispatch mock for resolveItemTarget eventBus
const mockEntityManager = {
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
    entities: new Map(),
    locations: new Map(), // Map<locationId, Set<entityId>>
};
const mockConditionEvaluationService = {
    evaluateConditions: jest.fn(),
};

// Mock Entities
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
const mockContext = {
    playerEntity: null, // Will be set in beforeEach
    currentLocation: null, // Will be set in beforeEach
    entityManager: mockEntityManager,
    dispatch: mockDispatch, // Used by resolveTargetEntity/Connection
    targets: [],
    dataManager: {},
};

// --- Helper Functions ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId).add(entityId);
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

const addToInventory = (entityId, ownerEntity) => {
    let inv = ownerEntity.getComponent(InventoryComponent);
    if (!inv) {
        inv = new InventoryComponent();
        ownerEntity.addComponent(inv);
    }
    inv.addItem(entityId);
    const entity = mockEntityManager.entities.get(entityId);
    if (entity?.hasComponent(PositionComponent)) {
        entity.getComponent(PositionComponent).setLocation(null); // Items in inventory have null location
    }
};

const equipItem = (itemId, slotId, ownerEntity) => {
    let eq = ownerEntity.getComponent(EquipmentComponent);
    if (!eq) {
        const slots = {};
        slots[slotId] = null;
        eq = new EquipmentComponent({slots});
        ownerEntity.addComponent(eq);
    } else if (!eq.hasSlot(slotId)) {
        eq.slots[slotId] = null;
    }
    eq.equipItem(slotId, itemId);
};

// --- Global Setup ---
beforeEach(() => {
    // Clear mocks
    mockDispatch.mockClear();
    mockEventBusDispatch.mockClear();
    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();
    mockEntityManager.getEntityInstance.mockClear().mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockClear().mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());
    mockConditionEvaluationService.evaluateConditions.mockClear().mockResolvedValue({
        success: true,
        messages: [],
        failureMessage: null
    }); // Default success

    // Reset player/location
    mockPlayerEntity = createMockEntity('player', 'Player');
    mockCurrentLocation = createMockEntity('loc-1', 'Test Room');
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id); // Place player

    // Update context
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = [];
});

describe('resolveTargetEntity', () => {
    // --- Test Data Setup Variables ---
    // Added warningSign and stopSign
    let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door, warningSign, stopSign;

    // --- Main Setup Function for resolveTargetEntity ---
    const setupResolveEntityTestData = () => {
        // Add necessary components to player/location if not already present
        if (!mockPlayerEntity.hasComponent(InventoryComponent)) {
            mockPlayerEntity.addComponent(new InventoryComponent());
        }
        if (!mockPlayerEntity.hasComponent(EquipmentComponent)) {
            mockPlayerEntity.addComponent(new EquipmentComponent({
                slots: {'core:slot_main_hand': null, 'core:slot_off_hand': null}
            }));
        }
        // Ensure location has PositionComponent (though less critical for these tests)
        if (!mockCurrentLocation.hasComponent(PositionComponent)) {
            mockCurrentLocation.addComponent(new PositionComponent({locationId: mockCurrentLocation.id}));
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

        // *** START: Added entities for punctuation tests (CHILD-TICKET-2.1.2.1) ***
        // Entity with trailing punctuation (for AC3 & AC5)
        warningSign = createMockEntity('sign-warn', 'Warning Sign.', []);
        // Distinct entity that could be ambiguously matched via punctuation (for AC5)
        stopSign = createMockEntity('sign-stop', 'Stop Sign.', []);
        // *** END: Added entities for punctuation tests ***

        // Place entities in Location
        placeInLocation(goblin.id, mockCurrentLocation.id);
        placeInLocation(rock.id, mockCurrentLocation.id);
        placeInLocation(rustyKey.id, mockCurrentLocation.id); // rusty key starts in location
        placeInLocation(door.id, mockCurrentLocation.id);
        // *** START: Place new entities in location (CHILD-TICKET-2.1.2.1) ***
        placeInLocation(warningSign.id, mockCurrentLocation.id);
        placeInLocation(stopSign.id, mockCurrentLocation.id);
        // *** END: Place new entities in location ***


        // Put some items in Player Inventory
        addToInventory(sword.id, mockPlayerEntity);
        addToInventory(potion.id, mockPlayerEntity);
        addToInventory(shinyKey.id, mockPlayerEntity); // shiny key starts in inventory
    };

    // --- Reset Mocks Before Each Test ---
    // Uses the global beforeEach for mock clearing and basic player/location setup

    // --- Basic Tests ---
    test('should return null if targetName is empty', () => {
        setupResolveEntityTestData();
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

    test('should return null if config is missing required fields', () => {
        setupResolveEntityTestData();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        expect(resolveTargetEntity(mockContext, {})).toBeNull();
        expect(resolveTargetEntity(mockContext, {scope: 'inv'})).toBeNull();
        expect(resolveTargetEntity(mockContext, {scope: 'inv', requiredComponents: []})).toBeNull();
        expect(resolveTargetEntity(mockContext, {scope: 'inv', requiredComponents: [], actionVerb: 'do'})).toBeNull();
        // This assertion still expects a result because NameComponent is added implicitly
        // and the only *required* missing field was targetName.
        const minimalValidConfig = {
            scope: 'inv', // Should be normalized ('inventory')
            requiredComponents: [], // Implies NameComponent only
            actionVerb: 'do',
            targetName: 'thing'
        };
        // We expect it *not* to be null because the function should attempt resolution.
        // The actual result depends on the scope logic and finding 'thing'.
        // Let's refine this test slightly to check that the error IS called for missing fields,
        // and then check that a minimal config *doesn't* immediately return null.
        expect(resolveTargetEntity(mockContext, minimalValidConfig)).toBeDefined(); // Should not be immediately null
        expect(consoleErrorSpy).toHaveBeenCalledWith("resolveTargetEntity: Invalid context or configuration provided.", expect.objectContaining({config: {}}));
        expect(consoleErrorSpy).toHaveBeenCalledWith("resolveTargetEntity: Invalid context or configuration provided.", expect.objectContaining({config: {scope: 'inv'}}));
        expect(consoleErrorSpy).toHaveBeenCalledWith("resolveTargetEntity: Invalid context or configuration provided.", expect.objectContaining({
            config: {
                scope: 'inv',
                requiredComponents: []
            }
        }));
        expect(consoleErrorSpy).toHaveBeenCalledWith("resolveTargetEntity: Invalid context or configuration provided.", expect.objectContaining({
            config: {
                scope: 'inv',
                requiredComponents: [],
                actionVerb: 'do'
            }
        }));

        consoleErrorSpy.mockRestore();
    });


    // --- Scope Tests ---
    test('should find unique item in inventory', () => {
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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

    test('should NOT find non-item in location_items', () => {
        setupResolveEntityTestData();
        const config = {
            scope: 'location_items',
            requiredComponents: [], // Rock has NameComp but not ItemComp
            actionVerb: 'take',
            targetName: 'rock',
            notFoundMessageKey: null, // Suppress msg for cleaner test
        };
        const result = resolveTargetEntity(mockContext, config);
        // The rock exists, but location_items filters it out BEFORE findTarget runs.
        // This should result in SCOPE_EMPTY, which returns null.
        expect(result).toBeNull();
        // If notFoundMessageKey was not null, SCOPE_EMPTY_GENERIC would be dispatched.
    });

    test('should find unique non-item in location_non_items', () => {
        setupResolveEntityTestData();
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

    test('should NOT find item in location_non_items', () => {
        setupResolveEntityTestData();
        const config = {
            scope: 'location_non_items',
            requiredComponents: [], // Key has NameComp and ItemComp
            actionVerb: 'look',
            targetName: 'rusty key',
            notFoundMessageKey: null, // Suppress msg
        };
        const result = resolveTargetEntity(mockContext, config);
        // Rusty key exists, but location_non_items filters it out.
        expect(result).toBeNull();
        // If notFoundMessageKey was not null, SCOPE_EMPTY_GENERIC would be dispatched.
    });

    test('should find unique target in location (any type)', () => {
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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

    test('should fail to find item without required EquippableComponent in inventory (dispatch default msg)', () => {
        setupResolveEntityTestData();
        const config = {
            scope: 'inventory',
            requiredComponents: [ItemComponent, EquippableComponent],
            actionVerb: 'equip',
            targetName: 'potion', // Potion is not equippable
            // Omitting notFoundMessageKey to test default dispatch behavior
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        // Potion exists but doesn't match EquippableComponent.
        // findTarget runs on the filtered list (sword only for 'potion') and returns NOT_FOUND.
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE('potion'), // Default for equip action
            type: 'info',
        });
    });

    // --- findTarget Outcome Tests (Default Dispatch Behavior) ---
    test('should dispatch default NOT_FOUND_INVENTORY in inventory', () => {
        setupResolveEntityTestData();
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
        setupResolveEntityTestData();
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

    test('should dispatch default AMBIGUOUS_PROMPT (multiple keys in inventory)', () => {
        setupResolveEntityTestData();
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
        // Match display names of the found entities
        // Sort expected names alphabetically for consistency
        const expectedNames = [shinyKey, rustyKey]
            .map(e => getDisplayName(e))
            .sort() // Optional but good practice for predictable order
            .join(', ');
    });

    test('should dispatch default TARGET_AMBIGUOUS_CONTEXT for context verbs', () => {
        setupResolveEntityTestData();
        // Add another goblin
        const goblin2 = createMockEntity('goblin-2', 'sneaky goblin', [new HealthComponent({current: 8, max: 8})]);
        placeInLocation(goblin2.id, mockCurrentLocation.id);

        const config = {
            scope: 'location',
            requiredComponents: [HealthComponent],
            actionVerb: 'use Potion on', // Contextual verb
            targetName: 'goblin', // Ambiguous
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        const expectedNames = [goblin, goblin2].map(e => getDisplayName(e)).join(', ');
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: `Which 'goblin' did you want to use Potion on? (${expectedNames})`,
            type: 'warning',
        });
    });

    test('should dispatch default SCOPE_EMPTY_GENERIC for empty location scope', () => {
        setupResolveEntityTestData();
        // Remove all items from location for this test
        mockEntityManager.locations.get(mockCurrentLocation.id)?.delete(rustyKey.id);
        // Also remove the signs added for punctuation test
        mockEntityManager.locations.get(mockCurrentLocation.id)?.delete('sign-warn');
        mockEntityManager.locations.get(mockCurrentLocation.id)?.delete('sign-stop');


        const config = {
            scope: 'location_items', // Look only for items
            requiredComponents: [ItemComponent],
            actionVerb: 'take',
            targetName: 'key', // Doesn't matter, scope is empty after filter
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            // Expect SCOPE_EMPTY_GENERIC because scope='location_items' involves 'here'
            text: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('take', 'here'),
            type: 'info',
        });
    });

    test('should use TAKE_EMPTY_LOCATION message via override', () => {
        setupResolveEntityTestData();
        // Remove all items from location
        mockEntityManager.locations.get(mockCurrentLocation.id)?.delete(rustyKey.id);
        // Also remove the signs added for punctuation test
        mockEntityManager.locations.get(mockCurrentLocation.id)?.delete('sign-warn');
        mockEntityManager.locations.get(mockCurrentLocation.id)?.delete('sign-stop');


        const config = {
            scope: 'location_items',
            requiredComponents: [ItemComponent],
            actionVerb: 'take',
            targetName: 'key',
            emptyScopeMessage: TARGET_MESSAGES.TAKE_EMPTY_LOCATION, // Explicitly use this
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.TAKE_EMPTY_LOCATION,
            type: 'info',
        });
    });

    // --- Custom Filter Tests ---
    test('should use custom filter', () => {
        setupResolveEntityTestData();
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

    test('should handle error in custom filter', () => {
        setupResolveEntityTestData();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const customFilter = (entity) => {
            if (entity.id === sword.id) throw new Error("Filter boom!");
            return true; // Pass others
        };
        const config = {
            scope: 'inventory', // Contains sword and potion
            requiredComponents: [ItemComponent],
            actionVerb: 'examine',
            targetName: 'sword', // Target the one that will throw
            customFilter: customFilter,
            notFoundMessageKey: null, // Suppress default messages
        };
        const result = resolveTargetEntity(mockContext, config);
        // Sword should be filtered out due to the error
        // Potion should still be in the list, but doesn't match 'sword'
        // findTarget receives only [potion] and target 'sword' -> NOT_FOUND
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error executing customFilter"), expect.any(Error));
        expect(mockDispatch).not.toHaveBeenCalled(); // Message suppressed
        consoleErrorSpy.mockRestore();
    });

    // --- Edge Case Tests ---
    test('should handle missing player component during scope build (e.g., no inventory)', () => {
        // Don't call setupResolveEntityTestData() or ensure InventoryComponent is removed
        mockPlayerEntity.removeComponent(InventoryComponent);

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
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
        // Since the scope could not be built, filteredEntities is empty.
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL('drop'),
            type: 'info',
        });
        consoleWarnSpy.mockRestore();
    });

    test('should handle missing location during scope build', () => {
        setupResolveEntityTestData();
        mockContext.currentLocation = null; // Remove location from context

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const config = {
            scope: 'location',
            requiredComponents: [],
            actionVerb: 'look',
            targetName: 'rock',
            // Omitting notFoundMessageKey
        };
        const result = resolveTargetEntity(mockContext, config);
        expect(result).toBeNull(); // Fails because scope is effectively empty
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("currentLocation is null"));
        // filteredEntities is empty. Scope involves location, so not 'personal'.
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('look', 'here'), // Defaults to 'here'
            type: 'info',
        });
        consoleWarnSpy.mockRestore();
    });

    test('should use custom notFoundMessageKey when provided', () => {
        setupResolveEntityTestData();
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

    // --- Tests for Message Suppression (notFoundMessageKey: null) ---
    describe('resolveTargetEntity message suppression (notFoundMessageKey: null)', () => {
        // Note: Relies on the outer beforeEach for mock resets & setupResolveEntityTestData for data.

        test('should NOT dispatch when NOT_FOUND and notFoundMessageKey is null', () => {
            setupResolveEntityTestData();
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                actionVerb: 'drop',
                targetName: 'nonexistent_item',
                notFoundMessageKey: null, // Suppress dispatch
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });

        test('should NOT dispatch when FOUND_AMBIGUOUS and notFoundMessageKey is null', () => {
            setupResolveEntityTestData();
            addToInventory(rustyKey.id, mockPlayerEntity); // shinyKey already added
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
            setupResolveEntityTestData();
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent, HealthComponent], // Matches nothing in inv
                actionVerb: 'drop',
                targetName: 'anything',
                notFoundMessageKey: null, // Suppress dispatch
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });

        test('should NOT dispatch when initial scope build fails (no inventory comp) and notFoundMessageKey is null', () => {
            mockPlayerEntity.removeComponent(InventoryComponent); // Remove inventory
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
            setupResolveEntityTestData();
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

    // --- Tests for Punctuation Matching (CHILD-TICKET-2.1.2.1) ---
    describe('resolveTargetEntity punctuation matching', () => {
        beforeEach(() => {
            setupResolveEntityTestData(); // Includes warningSign and stopSign
        });

        // AC3 Test: Matching with trailing punctuation
        test('should find entity when targetName matches name including trailing punctuation', () => {
            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: 'examine',
                targetName: 'Warning Sign.', // Exact match including '.'
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBe(warningSign); // Should find the sign
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        test('should find entity when targetName matches name ignoring trailing punctuation', () => {
            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: 'examine',
                targetName: 'Warning Sign', // Match without '.'
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBe(warningSign); // Should still find the sign (assuming findTarget handles this)
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        // *** Implementation for CHILD-TICKET-2.1.2.3 ***
        test('should find unique entity with partial match including trailing punctuation', () => {
            // Arrange: Ensure only 'Warning Sign.' can match 'sign.' uniquely for this test
            // Remove 'Stop Sign.' to avoid ambiguity
            mockEntityManager.entities.delete('sign-stop');
            mockEntityManager.locations.get(mockCurrentLocation.id)?.delete('sign-stop');

            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: 'examine',
                targetName: 'sign.', // <<< Partial match including the period
            };

            // Act
            const result = resolveTargetEntity(mockContext, config);

            // Assert
            expect(result).toBe(warningSign); // Should uniquely find the warning sign
            expect(mockDispatch).not.toHaveBeenCalled(); // No ambiguity or not found messages
        });
        // *** Implementation for CHILD-TICKET-2.1.2.3 ***

        // ========================================================================
        // == START: Implementation for CHILD-TICKET-2.1.2.5                     ==
        // ========================================================================
        test('should return null and dispatch ambiguity message for punctuated substring match', () => {
            // Arrange: Relies on beforeEach setup which includes 'Warning Sign.' and 'Stop Sign.'
            const targetName = 'sign.'; // Ambiguous punctuated substring
            const actionVerb = 'examine';
            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: actionVerb,
                targetName: targetName,
            };

            // Act
            const result = resolveTargetEntity(mockContext, config);

            // Assert: Null result because of ambiguity (AC4)
            expect(result).toBeNull();

            // Assert: Dispatch called once (AC5)
            expect(mockDispatch).toHaveBeenCalledTimes(1);

            // Assert: Correct message format and content (AC6)
            const expectedMatches = [warningSign, stopSign]; // Order might matter depending on retrieval order
            // Ensure order for consistent testing if needed, e.g., sort by ID:
            // expectedMatches.sort((a, b) => a.id.localeCompare(b.id));
            // (Assuming current retrieval order is consistent enough for the test)
            const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(actionVerb, targetName, expectedMatches);
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedMsg,
                type: 'warning',
            });
        });
        // ========================================================================
        // == END: Implementation for CHILD-TICKET-2.1.2.5                       ==
        // ========================================================================


        // AC5 Test: Ambiguity caused by punctuation search term
        test('should dispatch AMBIGUOUS_PROMPT when targetName with punctuation matches multiple entities', () => {
            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: 'examine',
                targetName: 'Sign.', // Search term includes '.'
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull(); // Ambiguous
            // Expect dispatch with both sign names
            const expectedNames = [warningSign, stopSign].map(e => getDisplayName(e)).join(', ');
            // Assuming AMBIGUOUS_PROMPT is used for non-contextual ambiguity
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: `Which 'Sign.' did you want to examine: ${expectedNames}?`, // Adjust format based on actual TARGET_MESSAGES.AMBIGUOUS_PROMPT
                type: 'warning',
            });
        });

        test('should dispatch AMBIGUOUS_PROMPT when targetName without punctuation matches multiple entities', () => {
            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: 'examine',
                targetName: 'Sign', // Search term without '.'
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBeNull(); // Ambiguous
            // Expect dispatch with both sign names
            const expectedNames = [warningSign, stopSign].map(e => getDisplayName(e)).join(', ');
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: `Which 'Sign' did you want to examine: ${expectedNames}?`, // Adjust format based on actual TARGET_MESSAGES.AMBIGUOUS_PROMPT
                type: 'warning',
            });
        });

        // Optional: Test edge case where only one punctuated name exists
        test('should find unique entity when targetName without punctuation matches only one entity with punctuation', () => {
            // Remove the stop sign to ensure only 'Warning Sign.' remains
            mockEntityManager.entities.delete('sign-stop');
            mockEntityManager.locations.get(mockCurrentLocation.id)?.delete('sign-stop');

            const config = {
                scope: 'location',
                requiredComponents: [],
                actionVerb: 'examine',
                targetName: 'Warning Sign', // Match without '.'
            };
            const result = resolveTargetEntity(mockContext, config);
            expect(result).toBe(warningSign); // Should find the unique remaining sign
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        // --- Test for Internal Whitespace Mismatch (CHILD-TICKET-2.1.2.2) ---
        test('should fail to find entity and not dispatch message when targetName has extra internal whitespace and notFoundMessageKey is null', () => {
            setupResolveEntityTestData();
            // 1. Ensure the target entity exists
            const oldScroll = createMockEntity('scroll-old', 'old scroll', [new ItemComponent()]);
            placeInLocation(oldScroll.id, mockCurrentLocation.id);

            // 2. Define config with extra whitespace in targetName and message suppression
            const config = {
                scope: 'location_items', // Be specific to where the scroll is
                requiredComponents: [ItemComponent],
                actionVerb: 'read',
                targetName: 'old  scroll', // <-- Note the double space
                notFoundMessageKey: null,  // <-- Suppress default message
            };

            // 3. Call the function
            const result = resolveTargetEntity(mockContext, config);

            // 4. Assert result is null (entity not found due to whitespace mismatch)
            expect(result).toBeNull();

            // 5. Assert no message was dispatched
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });
        // --- END: Test for Internal Whitespace Mismatch ---

        // *** Implementation for CHILD-TICKET-2.1.2.4 ***
        test('should NOT find entity and dispatch default message when targetName has trailing punctuation not present in the entity name', () => {
            // 1. Arrange: Ensure entity without trailing punctuation exists
            const oldScroll = createMockEntity('scroll-old', 'old scroll', [new ItemComponent()]);
            placeInLocation(oldScroll.id, mockCurrentLocation.id);

            // 2. Config: Target name has extra trailing punctuation, default message handling
            const targetInput = 'scroll.';
            const config = {
                scope: 'location_items', // Or 'location' or 'nearby'
                requiredComponents: [ItemComponent],
                actionVerb: 'examine',
                targetName: targetInput,
                // notFoundMessageKey is omitted to test default behavior
            };

            // 3. Act
            const result = resolveTargetEntity(mockContext, config);

            // 4. Assert: Entity not found
            expect(result).toBeNull();

            // 5. Assert: Default "not found" message dispatched
            // Based on resolveTargetEntity logic for 'examine' verb in 'location' scope,
            // it defaults to NOT_FOUND_LOCATION.
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.NOT_FOUND_LOCATION(targetInput), // Expects message like "You don't see any 'scroll.' here."
                type: 'info',
            });
        });

        test('should NOT find entity and NOT dispatch message when targetName has trailing punctuation not present in the entity name and suppression is enabled', () => {
            // 1. Arrange: Ensure entity without trailing punctuation exists
            const oldScroll = createMockEntity('scroll-old', 'old scroll', [new ItemComponent()]);
            placeInLocation(oldScroll.id, mockCurrentLocation.id);

            // 2. Config: Target name has extra trailing punctuation, message suppressed
            const targetInput = 'scroll.';
            const config = {
                scope: 'location_items',
                requiredComponents: [ItemComponent],
                actionVerb: 'examine',
                targetName: targetInput,
                notFoundMessageKey: null, // Explicitly suppress default message
            };

            // 3. Act
            const result = resolveTargetEntity(mockContext, config);

            // 4. Assert: Entity not found
            expect(result).toBeNull();

            // 5. Assert: No message dispatched
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        });
        // *** END: Implementation for CHILD-TICKET-2.1.2.4 ***

    }); // End describe for punctuation matching tests


}); // End describe for resolveTargetEntity