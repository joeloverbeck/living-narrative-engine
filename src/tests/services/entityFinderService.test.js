// src/tests/services/entityFinderService.test.js

import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

// *** Import the function under test ***
import {resolveTargetEntity} from '../../services/entityFinderService.js'; // Adjusted import path

// *** Import Core classes and Components used in tests ***
import Entity from '../../entities/entity.js';
import {NameComponent} from '../../components/nameComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js'; // Assuming exists
import {HealthComponent} from '../../components/healthComponent.js'; // Assuming exists
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
// REMOVED: TARGET_MESSAGES and getDisplayName are no longer needed here as the service doesn't dispatch messages
// import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';

// *** Import Utilities needed for mocking/spying ***
// Import the entire module to spy on the exported function
import * as TargetFinderModule from '../../utils/targetFinder.js';
// Import the scope service to potentially spy/verify calls if needed (though not strictly required by current tests)
import * as EntityScopeServiceModule from '../../services/entityScopeService.js';

// --- Mocks ---
// mockDispatch remains useful for testing the CALLER's logic elsewhere, but we REMOVE assertions against it here.
const mockDispatch = jest.fn();
const mockEntityManager = {
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
    entities: new Map(),
    locations: new Map(), // Map<locationId, Set<entityId>>
};

// Mock Entities (using let for beforeEach reset)
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
// dispatch is kept in context in case other services called *by* entityFinderService used it,
// although resolveTargetEntity itself should not call it.
const mockContext = {
    playerEntity: null, // Will be set in beforeEach
    currentLocation: null, // Will be set in beforeEach
    entityManager: mockEntityManager,
    dispatch: mockDispatch,
    targets: [],
    gameDataRepository: {}, // Placeholder
};

// --- Helper Functions (Create Entity, Place in Location, Add to Inventory, Equip) ---
// (Keep existing helper functions: createMockEntity, placeInLocation, addToInventory, equipItem)
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    // Add NameComponent only if name is provided and non-null
    if (name !== null && typeof name === 'string') {
        entity.addComponent(new NameComponent({value: name}));
    }
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

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
    // Ensure item doesn't have a location position if in inventory
    const entity = mockEntityManager.entities.get(entityId);
    if (entity?.hasComponent(PositionComponent)) {
        entity.getComponent(PositionComponent)?.setLocation(null);
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
        eq.slots[slotId] = null; // Add slot if missing
    }
    // Simulate equipping - check if slot exists before setting
    if (Object.prototype.hasOwnProperty.call(eq.slots, slotId)) {
        eq.slots[slotId] = itemId;
    } else {
        console.warn(`equipItem helper: Slot ${slotId} does not exist on entity ${ownerEntity.id}.`);
    }
};


// --- Global Setup/Teardown ---
let consoleErrorSpy;
let consoleWarnSpy;
let findTargetSpy;
let getEntityIdsForScopesSpy; // Spy on the scope service

beforeEach(() => {
    // Clear mocks and spies
    mockDispatch.mockClear();
    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();
    jest.clearAllMocks(); // Clears all mocks, including spies

    // Re-apply simple mock implementations after clearAllMocks
    mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());

    // Re-establish spies on console AFTER clearAllMocks
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
    }); // Suppress console noise
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
    }); // Suppress console noise
    // Re-establish spy on findTarget utility
    findTargetSpy = jest.spyOn(TargetFinderModule, 'findTarget');
    // Give findTarget a default behavior (important for tests not focused on its return)
    findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});
    // Spy on the scope service function
    getEntityIdsForScopesSpy = jest.spyOn(EntityScopeServiceModule, 'getEntityIdsForScopes');
    // Give it a default implementation that returns an empty set
    getEntityIdsForScopesSpy.mockReturnValue(new Set());


    // Create fresh base entities for context
    mockPlayerEntity = createMockEntity('player', 'Player');
    mockCurrentLocation = createMockEntity('loc-1', 'Test Room');
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id); // Place player in the room

    // Update context object
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = [];
});

afterEach(() => {
    // Restore original console functions and other spies
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    findTargetSpy.mockRestore();
    getEntityIdsForScopesSpy.mockRestore();
});


// ========================================================================
// == Tests for resolveTargetEntity =======================================
// ========================================================================
describe('resolveTargetEntity', () => {

    // --- Test Data Setup Variables ---
    let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door, warningSign, stopSign, helmet, axe;
    let itemOnlyEntity, equipOnlyEntity, itemAndEquipEntity; // For specific filtering tests
    let grumpyGoblin, sneakyGoblin; // For ambiguity tests

    // --- Main Setup Function for resolveTargetEntity tests needing data ---
    const setupResolveEntityTestData = () => {
        // Add necessary components to player/location if not already present
        if (!mockPlayerEntity.hasComponent(InventoryComponent)) {
            mockPlayerEntity.addComponent(new InventoryComponent());
        }
        if (!mockPlayerEntity.hasComponent(EquipmentComponent)) {
            mockPlayerEntity.addComponent(new EquipmentComponent({
                slots: {'core:slot_main_hand': null, 'core:slot_off_hand': null, 'core:slot_head': null} // Add head slot
            }));
        } else {
            // Ensure slots exist if component was already there
            const eqComp = mockPlayerEntity.getComponent(EquipmentComponent);
            if (!eqComp.hasSlot('core:slot_main_hand')) eqComp.slots['core:slot_main_hand'] = null;
            if (!eqComp.hasSlot('core:slot_off_hand')) eqComp.slots['core:slot_off_hand'] = null;
            if (!eqComp.hasSlot('core:slot_head')) eqComp.slots['core:slot_head'] = null;
        }

        if (!mockCurrentLocation.hasComponent(PositionComponent)) {
            mockCurrentLocation.addComponent(new PositionComponent({locationId: mockCurrentLocation.id}));
        }

        // Create Items
        sword = createMockEntity('sword-1', 'iron sword', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_main_hand'})]);
        shield = createMockEntity('shield-1', 'wooden shield', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_off_hand'})]);
        potion = createMockEntity('potion-1', 'red potion', [new ItemComponent()]);
        rustyKey = createMockEntity('key-rusty', 'rusty key', [new ItemComponent()]);
        shinyKey = createMockEntity('key-shiny', 'shiny key', [new ItemComponent()]);
        helmet = createMockEntity('helmet-1', 'iron helmet', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_head'})]); // Equippable
        axe = createMockEntity('axe-1', 'rusty axe', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_main_hand'})]); // Another main hand

        // Create Non-items / NPCs / Scenery
        grumpyGoblin = createMockEntity('goblin-1', 'grumpy goblin', [new HealthComponent({current: 10, max: 10})]);
        sneakyGoblin = createMockEntity('goblin-2', 'sneaky goblin', [new HealthComponent({current: 8, max: 8})]); // For ambiguity
        rock = createMockEntity('rock-1', 'large rock', []); // No ItemComponent, HAS NameComponent
        door = createMockEntity('door-1', 'wooden door', []); // HAS NameComponent

        // Punctuation test entities
        warningSign = createMockEntity('sign-warn', 'Warning Sign.', []);
        stopSign = createMockEntity('sign-stop', 'Stop Sign.', []);

        // Entities specifically for filtering tests
        itemOnlyEntity = createMockEntity('item-only', 'item thing', [new ItemComponent()]);
        // Create equipOnlyEntity with a name now, as NameComponent is implicitly required
        equipOnlyEntity = createMockEntity('equip-only', 'equip thing', [new EquippableComponent({slotId: 'core:slot_main_hand'})]);
        itemAndEquipEntity = createMockEntity('item-equip', 'item equip thing', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_main_hand'})]);


        // Place entities in Location
        placeInLocation(grumpyGoblin.id, mockCurrentLocation.id);
        placeInLocation(sneakyGoblin.id, mockCurrentLocation.id); // Place second goblin
        placeInLocation(rock.id, mockCurrentLocation.id);
        placeInLocation(rustyKey.id, mockCurrentLocation.id); // Item in location
        placeInLocation(door.id, mockCurrentLocation.id);
        placeInLocation(warningSign.id, mockCurrentLocation.id);
        placeInLocation(stopSign.id, mockCurrentLocation.id);
        // Player ('player') is already placed in the location in beforeEach

        // Put some items in Player Inventory
        addToInventory(sword.id, mockPlayerEntity); // Item in inventory
        addToInventory(potion.id, mockPlayerEntity); // Item in inventory
        addToInventory(shinyKey.id, mockPlayerEntity); // Item in inventory
        addToInventory(helmet.id, mockPlayerEntity); // Item in inventory
        addToInventory(axe.id, mockPlayerEntity); // Item in inventory

        // Add filtering-specific entities to inventory as well for ease of testing
        addToInventory(itemOnlyEntity.id, mockPlayerEntity);
        addToInventory(equipOnlyEntity.id, mockPlayerEntity); // Add equipOnlyEntity (it has Name now)
        addToInventory(itemAndEquipEntity.id, mockPlayerEntity); // Has both Item and Equippable

        // Equip one item for equipment scope tests
        equipItem(shield.id, 'core:slot_off_hand', mockPlayerEntity);

        // *** MOCK getEntityIdsForScopes behavior AFTER data is set up ***
        // Make the spy call the actual implementation by default for most tests
        // Tests specifically targeting scope service errors/warnings will override this mock locally.
        getEntityIdsForScopesSpy.mockImplementation((scopes, context) => {
            // Call the *real* implementation (or a simplified test version if preferred)
            // Using a simplified version here to avoid full dependency:
            const entityIds = new Set();
            const playerInv = context.playerEntity?.getComponent(InventoryComponent);
            const playerEq = context.playerEntity?.getComponent(EquipmentComponent);
            const locId = context.currentLocation?.id;
            const locEntities = locId ? mockEntityManager.locations.get(locId) || new Set() : new Set();

            const scopeArray = Array.isArray(scopes) ? scopes : [scopes];

            for (const scope of scopeArray) {
                switch (scope) {
                    case 'inventory':
                        if (playerInv) {
                            playerInv.getItems().forEach(id => entityIds.add(id));
                        } else {
                            // Simulate warning if component missing
                            // console.warn(`entityScopeService._handleInventory: Scope 'inventory' requested but player ${context.playerEntity?.id} lacks InventoryComponent.`);
                        }
                        break;
                    case 'equipment':
                        if (playerEq) {
                            // --- FIX IS HERE ---
                            // Use getAllEquipped() and extract non-null item IDs
                            const allSlots = playerEq.getAllEquipped();
                            Object.values(allSlots).forEach(itemId => {
                                if (itemId !== null) { // Only add actual item IDs
                                    entityIds.add(itemId);
                                }
                            });
                            // --- END FIX ---
                        } else {
                            // Simulate warning if component missing
                            // console.warn(`entityScopeService._handleEquipment: Scope 'equipment' requested but player ${context.playerEntity?.id} lacks EquipmentComponent.`);
                        }
                        break;
                    case 'location':
                    case 'location_items':
                    case 'location_non_items':
                        if (locId) {
                            locEntities.forEach(id => {
                                if (id === context.playerEntity?.id) return; // Exclude player
                                const entity = mockEntityManager.getEntityInstance(id);
                                if (!entity) {
                                    // Simulate warning for dangling ID
                                    // console.warn(`entityScopeService._handleLocation: Entity ID ${id} listed in location ${locId} but instance not found (dangling ID). Skipping.`);
                                    return;
                                }
                                const isItem = entity.hasComponent(ItemComponent);
                                if (scope === 'location' || (scope === 'location_items' && isItem) || (scope === 'location_non_items' && !isItem)) {
                                    entityIds.add(id);
                                }
                            });
                        } else {
                            // Simulate warning if location missing
                            // console.warn("entityScopeService._handleLocation: Scope 'location' (or derived) requested but currentLocation is null.");
                        }
                        break;
                    case 'nearby':
                        // Simulate combining inventory and location
                        if (playerInv) playerInv.getItems().forEach(id => entityIds.add(id));
                        if (locId) {
                            locEntities.forEach(id => {
                                if (id !== context.playerEntity?.id) { // Exclude player
                                    const entity = mockEntityManager.getEntityInstance(id);
                                    if (entity) entityIds.add(id);
                                }
                            });
                        }
                        break;
                    // default:
                    // Simulate warning for unknown scope
                    // console.warn(`getEntityIdsForScopes: Unknown scope requested: '${scope}'. Skipping.`);
                }
            }
            return entityIds;
        });
    };

    // ========================================================================
    // == Sub-suite: Input Validation and Basic Setup ========================
    // ========================================================================
    describe('Input Validation and Setup', () => {
        // --- Null/Undefined Context ---
        test.each([
            [null],
            [undefined],
        ])('should return INVALID_INPUT status and log error if context is %s', (invalidContext) => {
            const config = {
                scope: 'inventory',
                requiredComponents: [], /* actionVerb: 'get', REMOVED INTERNAL USAGE */
                targetName: 'thing'
            }; // Valid config
            const result = resolveTargetEntity(invalidContext, config);

            expect(result).toEqual({
                status: 'INVALID_INPUT',
                entity: null,
                candidates: null,
            });
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "resolveTargetEntity: Invalid context or configuration provided.",
                expect.objectContaining({context: invalidContext, config})
            );
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

        // --- Null/Undefined Config ---
        test.each([
            [null],
            [undefined],
        ])('should return INVALID_INPUT status and log error if config is %s', (invalidConfig) => {
            const result = resolveTargetEntity(mockContext, invalidConfig);

            expect(result).toEqual({
                status: 'INVALID_INPUT',
                entity: null,
                candidates: null,
            });
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "resolveTargetEntity: Invalid context or configuration provided.",
                expect.objectContaining({context: mockContext, config: invalidConfig})
            );
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

        // --- Missing Required Config Properties ---
        test.each([
            ['scope', {requiredComponents: [], targetName: 'thing'}],
            ['requiredComponents', {scope: 'inventory', targetName: 'thing'}],
            // ['actionVerb', {scope: 'inventory', requiredComponents: [], targetName: 'thing'}], // No longer required internally
            ['targetName', {scope: 'inventory', requiredComponents: []}],
            // Test case where targetName is not a string
            ['targetName (not string)', {scope: 'inventory', requiredComponents: [], targetName: 123}],
        ])('should return INVALID_INPUT status and log error if config is missing/invalid "%s"', (desc, invalidConfig) => {
            const result = resolveTargetEntity(mockContext, invalidConfig);

            expect(result).toEqual({
                status: 'INVALID_INPUT',
                entity: null,
                candidates: null,
            });
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "resolveTargetEntity: Invalid context or configuration provided.",
                expect.objectContaining({context: mockContext, config: invalidConfig})
            );
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

        // --- Empty/Whitespace targetName ---
        test.each([
            ['empty string', ''],
            ['whitespace', '   '],
        ])('should return INVALID_INPUT status and log warning for %s targetName', (desc, invalidName) => {
            const config = {scope: 'inventory', requiredComponents: [], targetName: invalidName};
            const result = resolveTargetEntity(mockContext, config);

            expect(result).toEqual({
                status: 'INVALID_INPUT',
                entity: null,
                candidates: null,
            });
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "resolveTargetEntity: Received empty targetName. Resolution cannot proceed."
            );
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

        // --- Implicit NameComponent Requirement ---
        describe('Implicit NameComponent Requirement', () => {
            let entityWithNameAndItem;
            let entityWithOnlyItem; // No NameComponent
            let entityWithOnlyName;
            let entityWithNeither; // No NameComponent

            beforeEach(() => {
                // Setup entities specifically for this test within inventory scope
                if (!mockPlayerEntity.hasComponent(InventoryComponent)) {
                    mockPlayerEntity.addComponent(new InventoryComponent());
                }

                entityWithNameAndItem = createMockEntity('item-both', 'Named Item', [new ItemComponent()]);
                entityWithOnlyItem = createMockEntity('item-no-name', null, [new ItemComponent()]); // Pass null for name
                entityWithOnlyName = createMockEntity('item-only-name', 'Just Name');
                entityWithNeither = createMockEntity('item-neither', null, []); // No name, no item comp

                addToInventory(entityWithNameAndItem.id, mockPlayerEntity);
                addToInventory(entityWithOnlyItem.id, mockPlayerEntity);
                addToInventory(entityWithOnlyName.id, mockPlayerEntity);
                addToInventory(entityWithNeither.id, mockPlayerEntity);

                // Mock scope service to return all these items
                getEntityIdsForScopesSpy.mockReturnValue(new Set([
                    entityWithNameAndItem.id, entityWithOnlyItem.id,
                    entityWithOnlyName.id, entityWithNeither.id
                ]));
                // Ensure findTarget returns NOT_FOUND for these tests focused on filtering *before* findTarget
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});
            });

            test('should filter out entities without NameComponent when NameComponent is not explicitly required', () => {
                const config = {
                    scope: 'inventory',
                    requiredComponents: [ItemComponent], // Only require ItemComponent explicitly
                    targetName: 'item', // Target name doesn't matter much here
                };

                const result = resolveTargetEntity(mockContext, config);

                // Verify findTarget was called (or would have been called if potential matches existed)
                // and inspect the array passed to it (the second argument)
                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1]; // Get the 'filteredEntities' array

                // Assert: Only the entity with BOTH NameComponent and ItemComponent should be passed
                expect(entitiesPassedToFindTarget).toEqual(expect.arrayContaining([entityWithNameAndItem]));
                expect(entitiesPassedToFindTarget.length).toBe(1); // Verify length based on local setup
                expect(entitiesPassedToFindTarget).not.toContain(entityWithOnlyItem);
                expect(entitiesPassedToFindTarget).not.toContain(entityWithOnlyName); // Filtered by missing ItemComponent
                expect(entitiesPassedToFindTarget).not.toContain(entityWithNeither);

                // Assert final result status (based on findTarget mock)
                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('should handle NameComponent correctly when it IS explicitly required (no duplication)', () => {
                const config = {
                    scope: 'inventory',
                    requiredComponents: [NameComponent, ItemComponent], // Explicitly require both
                    targetName: 'item',
                };

                const result = resolveTargetEntity(mockContext, config);

                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];

                // Assert: The result should be identical to the implicit case
                expect(entitiesPassedToFindTarget).toEqual(expect.arrayContaining([entityWithNameAndItem]));
                expect(entitiesPassedToFindTarget.length).toBe(1); // Verify length based on local setup
                expect(entitiesPassedToFindTarget).not.toContain(entityWithOnlyItem);
                expect(entitiesPassedToFindTarget).not.toContain(entityWithOnlyName);
                expect(entitiesPassedToFindTarget).not.toContain(entityWithNeither);

                // Assert final result status
                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('should filter correctly when only NameComponent is implicitly required', () => {
                const config = {
                    scope: 'inventory',
                    requiredComponents: [], // Require nothing explicitly (so only Name implicitly)
                    targetName: 'item',
                };

                const result = resolveTargetEntity(mockContext, config);

                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];

                // Assert: Entities with NameComponent should be passed, others filtered out
                expect(entitiesPassedToFindTarget).toEqual(expect.arrayContaining([entityWithNameAndItem, entityWithOnlyName]));
                expect(entitiesPassedToFindTarget.length).toBe(2); // entityWithNameAndItem, entityWithOnlyName
                expect(entitiesPassedToFindTarget).not.toContain(entityWithOnlyItem);
                expect(entitiesPassedToFindTarget).not.toContain(entityWithNeither);

                // Assert final result status
                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        }); // End Implicit NameComponent describe

    }); // End describe 'Input Validation and Setup'


    // ========================================================================
    // == Sub-suite: Scope Processing Logic ===================================
    // ========================================================================
    describe('Scope Processing Logic', () => {
        // Note: These tests rely on setupResolveEntityTestData mocking getEntityIdsForScopes correctly.
        // The focus is on how resolveTargetEntity uses the result of getEntityIdsForScopes.

        // --- Scope 'inventory' ---
        describe("Scope 'inventory'", () => {
            test('AC Success: should return FOUND_UNIQUE status for unique item in inventory', () => {
                setupResolveEntityTestData(); // Player gets InventoryComponent and items
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [sword]}); // Assume findTarget finds it
                const config = {
                    scope: 'inventory',
                    requiredComponents: [ItemComponent], // Implicitly NameComponent too
                    targetName: 'sword',
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['inventory'], mockContext);
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([sword])); // Verify findTarget was called with potential matches
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: sword, candidates: null}); // Found sword
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC Failure: should return FILTER_EMPTY status if InventoryComponent is missing (scope yields empty)', () => {
                setupResolveEntityTestData(); // Run setup first
                mockPlayerEntity.removeComponent(InventoryComponent); // Explicitly remove for test
                // Mock scope service to return empty set specifically for this case
                getEntityIdsForScopesSpy.mockReturnValue(new Set());

                const config = {
                    scope: 'inventory',
                    requiredComponents: [ItemComponent],
                    targetName: 'sword', // Doesn't matter, scope is empty
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['inventory'], mockContext);
                // Warning comes from scope service, not tested here directly unless we want to refine the spy mock.
                // expect(consoleWarnSpy).toHaveBeenCalledWith(...);
                expect(findTargetSpy).not.toHaveBeenCalled(); // Should not be called if scope is empty
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
            });
        }); // End Scope 'inventory'

        // --- Scopes 'location', 'location_items', 'location_non_items' ---
        describe("Scopes 'location', 'location_items', 'location_non_items'", () => {
            beforeEach(() => {
                setupResolveEntityTestData(); // Sets up entities in loc-1
            });

            test('AC `location`: should return FOUND_UNIQUE status for an item in location', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rustyKey]});
                const config = {
                    scope: 'location',
                    requiredComponents: [ItemComponent], // Still require ItemComponent for 'take' context
                    targetName: 'rusty key'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location'], mockContext);
                // --- FIX IS HERE ---
                // Only entities in location WITH NameComponent AND ItemComponent should be passed to findTarget
                const expectedFilteredEntities = [rustyKey];
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expectedFilteredEntities);
                // --- END FIX ---
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rustyKey, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC `location`: should return FOUND_UNIQUE status for a non-item in location', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rock]});
                const config = {scope: 'location', requiredComponents: [], targetName: 'rock'};
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location'], mockContext);
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([rock]));
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rock, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC `location`: should return NOT_FOUND status when targeting player (player excluded from scope)', () => {
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []}); // findTarget won't find 'Player' in the filtered list
                const config = {scope: 'location', requiredComponents: [], targetName: 'Player'};
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location'], mockContext);
                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];
                // Verify player entity was NOT passed to findTarget
                expect(entitiesPassedToFindTarget).not.toEqual(expect.arrayContaining([mockPlayerEntity]));

                // Expect NOT_FOUND because 'Player' wasn't included in the search scope passed to findTarget
                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC `location_items`: should return FOUND_UNIQUE status for unique item', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rustyKey]});
                const config = {
                    scope: 'location_items',
                    requiredComponents: [ItemComponent], // Implicitly NameComponent too
                    targetName: 'rusty key'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location_items'], mockContext);
                // Scope service should only return items (rustyKey)
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([rustyKey]));
                expect(findTargetSpy.mock.calls[0][1]).not.toEqual(expect.arrayContaining([rock, door])); // Ensure non-items were filtered by scope service

                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rustyKey, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC `location_items`: should return NOT_FOUND status when targeting non-item (filtered by scope)', () => {
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []}); // findTarget receives filtered list (no rock), finds nothing for 'rock'
                const config = {
                    scope: 'location_items',
                    requiredComponents: [], // No extra requirements beyond scope filtering
                    targetName: 'rock',
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location_items'], mockContext);
                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];
                // Verify findTarget received a list excluding the rock due to scope filter
                expect(entitiesPassedToFindTarget).not.toEqual(expect.arrayContaining([rock]));

                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC `location_non_items`: should return FOUND_UNIQUE status for unique non-item', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rock]});
                const config = {
                    scope: 'location_non_items',
                    requiredComponents: [],
                    targetName: 'rock'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location_non_items'], mockContext);
                // Scope service should return non-items (rock, door, goblins, signs)
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([rock]));
                expect(findTargetSpy.mock.calls[0][1]).not.toEqual(expect.arrayContaining([rustyKey])); // Ensure items filtered by scope

                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rock, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC `location_non_items`: should return NOT_FOUND status for item (filtered by scope)', () => {
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});
                const config = {
                    scope: 'location_non_items',
                    requiredComponents: [],
                    targetName: 'rusty key',
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location_non_items'], mockContext);
                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];
                // Verify findTarget received a list excluding the rusty key due to scope filter
                expect(entitiesPassedToFindTarget).not.toEqual(expect.arrayContaining([rustyKey]));

                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC Failure: should return FILTER_EMPTY status if location context is missing (scope yields empty)', () => {
                mockContext.currentLocation = null; // Remove location from context
                // Mock scope service to return empty set specifically for this case
                getEntityIdsForScopesSpy.mockReturnValue(new Set());

                const config = {scope: 'location', requiredComponents: [], targetName: 'rock'};
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location'], mockContext);
                // Warning comes from scope service, not checked here directly.
                // expect(consoleWarnSpy).toHaveBeenCalledWith(...);
                expect(findTargetSpy).not.toHaveBeenCalled(); // Should not be called if scope is empty
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
            });
        }); // End Scopes 'location', 'location_items', 'location_non_items'

        // --- Scope 'equipment' ---
        describe("Scope 'equipment'", () => {
            test('AC Success: should return FOUND_UNIQUE status for unique equipped item', () => {
                setupResolveEntityTestData(); // shield is equipped in setup
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [shield]});
                const config = {
                    scope: 'equipment',
                    requiredComponents: [ItemComponent], // Implicitly NameComponent too
                    targetName: 'shield',
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['equipment'], mockContext);
                // Scope service should return only equipped items (shield)
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, [shield]);

                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: shield, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC Failure: should return FILTER_EMPTY status if EquipmentComponent is missing (scope yields empty)', () => {
                setupResolveEntityTestData(); // Setup data
                mockPlayerEntity.removeComponent(EquipmentComponent); // Ensure it's removed
                // Mock scope service to return empty set specifically for this case
                getEntityIdsForScopesSpy.mockReturnValue(new Set());

                const config = {
                    scope: 'equipment',
                    requiredComponents: [ItemComponent],
                    targetName: 'shield', // Doesn't matter, scope is empty
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['equipment'], mockContext);
                // Warning comes from scope service.
                // expect(consoleWarnSpy).toHaveBeenCalledWith(...);
                expect(findTargetSpy).not.toHaveBeenCalled();
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        }); // End Scope 'equipment'

        // --- Scope 'nearby' ---
        describe("Scope 'nearby'", () => {
            beforeEach(() => {
                setupResolveEntityTestData(); // Sets up items in inv and loc, player in loc
            });

            test('AC: should return FOUND_UNIQUE status for unique item from inventory', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [shinyKey]});
                const config = {
                    scope: 'nearby',
                    requiredComponents: [ItemComponent],
                    targetName: 'shiny key'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['nearby'], mockContext);
                // --- FIX IS HERE ---
                // Entities from inventory OR location WITH NameComponent AND ItemComponent
                const expectedFilteredEntities = [
                    sword, potion, shinyKey, helmet, axe, itemOnlyEntity, itemAndEquipEntity, // Inventory with ItemComponent
                    rustyKey // Location with ItemComponent
                ].filter(Boolean); // Filter out any potentially undefined if setup changes
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining(expectedFilteredEntities));
                // Optionally add a length check for stricter assertion:
                expect(findTargetSpy.mock.calls[0][1].length).toBe(expectedFilteredEntities.length);
                // --- END FIX ---

                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: shinyKey, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC: should return FOUND_UNIQUE status for unique entity from location (non-item)', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [door]});
                const config = {scope: 'nearby', requiredComponents: [], targetName: 'door'};
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['nearby'], mockContext);
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([door]));
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: door, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC: should return FOUND_UNIQUE status for unique entity from location (item)', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rustyKey]});
                const config = {
                    scope: 'nearby',
                    requiredComponents: [ItemComponent],
                    targetName: 'rusty key'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['nearby'], mockContext);
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([rustyKey]));
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rustyKey, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC: should return NOT_FOUND status when targeting player (excluded from scope)', () => {
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});
                const config = {scope: 'nearby', requiredComponents: [], targetName: 'Player'};
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['nearby'], mockContext);
                expect(findTargetSpy).toHaveBeenCalled();
                // Verify player entity was NOT passed to findTarget
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];
                expect(entitiesPassedToFindTarget).not.toEqual(expect.arrayContaining([mockPlayerEntity]));

                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        }); // End Scope 'nearby'

        // --- Multiple Scopes ---
        describe("Multiple Scopes", () => {
            beforeEach(() => {
                setupResolveEntityTestData(); // Sets up items in inv and loc
            });

            test('AC: should return FOUND_UNIQUE status with combined scope (match in first scope - inventory)', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [potion]});
                const config = {
                    scope: ['inventory', 'location_items'],
                    requiredComponents: [ItemComponent],
                    targetName: 'potion'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['inventory', 'location_items'], mockContext);
                // Combined scope should contain inventory items + location items
                const expectedCombinedAfterFilter = [
                    sword, potion, shinyKey, helmet, axe, itemOnlyEntity, /* REMOVED: equipOnlyEntity, */ itemAndEquipEntity, // Inventory passing Name+Item
                    rustyKey // Location Items passing Name+Item
                ].filter(Boolean); // Keep .filter(Boolean) in case setup changes yield undefined
                // Use the corrected list in the assertion
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining(expectedCombinedAfterFilter));
                // ALSO, it's good practice to check the length for exactness if possible/reliable:
                expect(findTargetSpy.mock.calls[0][1].length).toBe(expectedCombinedAfterFilter.length);
            });

            test('AC: should return FOUND_UNIQUE status with combined scope (match in second scope - location)', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rustyKey]});
                const config = {
                    scope: ['inventory', 'location_items'],
                    requiredComponents: [ItemComponent],
                    targetName: 'rusty key'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['inventory', 'location_items'], mockContext);
                // --- CORRECTION START ---
                // Define the expected entities AFTER component filtering (Name + Item required)
                const expectedCombinedAfterFilter = [
                    sword, potion, shinyKey, helmet, axe, itemOnlyEntity, /* REMOVED: equipOnlyEntity, */ itemAndEquipEntity, // Inventory passing filter
                    rustyKey // Location Items passing filter
                ].filter(Boolean); // Keep filter for safety

                // Assert findTargetSpy was called with the CORRECTLY filtered list
                expect(findTargetSpy).toHaveBeenCalledWith(
                    config.targetName, // "rusty key"
                    expect.arrayContaining(expectedCombinedAfterFilter)
                );
                // Optional but recommended: check exact length
                expect(findTargetSpy.mock.calls[0][1].length).toBe(expectedCombinedAfterFilter.length);
                // --- CORRECTION END ---

                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rustyKey, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('AC: should return FOUND_UNIQUE status with combined scope (order reversed, match in first - location)', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [rustyKey]});
                const config = {
                    scope: ['location_items', 'inventory'], // Order reversed
                    requiredComponents: [ItemComponent],
                    targetName: 'rusty key'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['location_items', 'inventory'], mockContext);
                // --- CORRECTION START ---
                // Define the expected entities AFTER component filtering (Name + Item required)
                // The actual order from getEntityIdsForScopes might vary, but the content should be the same set.
                const expectedCombinedAfterFilter = [
                    rustyKey, // Location Items passing filter
                    sword, potion, shinyKey, helmet, axe, itemOnlyEntity, /* REMOVED: equipOnlyEntity, */ itemAndEquipEntity // Inventory passing filter
                ].filter(Boolean); // Keep filter for safety

                // Assert findTargetSpy was called with the CORRECTLY filtered list
                expect(findTargetSpy).toHaveBeenCalledWith(
                    config.targetName, // "rusty key"
                    expect.arrayContaining(expectedCombinedAfterFilter) // expect.arrayContaining handles order difference
                );
                // Optional but recommended: check exact length
                expect(findTargetSpy.mock.calls[0][1].length).toBe(expectedCombinedAfterFilter.length);
                // --- CORRECTION END ---

                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: rustyKey, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });
        }); // End Multiple Scopes

        // --- Robustness and Error Handling (from scope service perspective) ---
        describe("Robustness and Error Handling (Scope Service Interaction)", () => {
            // These tests verify resolveTargetEntity handles empty/partial results from the scope service.
            // Direct testing of scope service warnings/errors should be in entityScopeService.test.js.

            test('should return FILTER_EMPTY status if scope service returns empty set (e.g., unsupported scope)', () => {
                setupResolveEntityTestData();
                // Mock scope service to simulate it returning nothing (e.g., due to invalid scope)
                getEntityIdsForScopesSpy.mockReturnValue(new Set());

                const config = {
                    scope: 'invalid_scope', // Use an example invalid scope
                    requiredComponents: [],
                    targetName: 'thing',
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(['invalid_scope'], mockContext);
                // Scope service handles logging the warning for 'invalid_scope'
                expect(findTargetSpy).not.toHaveBeenCalled(); // findTarget not called because list is empty
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null}); // Correct status
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('should process valid scopes even if others yield empty/invalid results', () => {
                setupResolveEntityTestData();
                // Mock scope service to return only results for 'inventory'
                const inventoryIds = new Set();
                mockPlayerEntity.getComponent(InventoryComponent)?.getItems().forEach(id => inventoryIds.add(id));
                getEntityIdsForScopesSpy.mockReturnValue(inventoryIds);

                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [sword]});
                const config = {
                    scope: ['inventory', 'invalid_scope', 'equipment_error_scope'], // Mix valid and potentially problematic
                    requiredComponents: [ItemComponent],
                    targetName: 'sword'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith(config.scope, mockContext);
                // Scope service handles warnings/errors for other scopes.
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining([sword])); // Called because 'inventory' yielded results
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: sword, candidates: null}); // Found in valid scope
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            test('should return FILTER_EMPTY status if scope service returns only dangling IDs (filtered out)', () => {
                setupResolveEntityTestData();
                const danglingId = 'item-dangling-loc';
                // Mock scope service returning only a dangling ID
                getEntityIdsForScopesSpy.mockReturnValue(new Set([danglingId]));
                // Ensure getEntityInstance returns null for the dangling ID
                const originalGetEntityInstance = mockEntityManager.getEntityInstance;
                mockEntityManager.getEntityInstance = jest.fn((id) => {
                    if (id === danglingId) return null;
                    return originalGetEntityInstance.call(mockEntityManager, id);
                });


                const config = {
                    scope: 'location_items', // Scope where dangling ID might appear
                    requiredComponents: [ItemComponent],
                    targetName: 'anything'
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(getEntityIdsForScopesSpy).toHaveBeenCalledWith([config.scope], mockContext);
                // The filtering step (Array.from(entityIdSet).map(...).filter(Boolean)) will remove the null entity.
                expect(findTargetSpy).not.toHaveBeenCalled(); // List becomes empty *before* findTarget
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null}); // Correct status
                expect(mockDispatch).not.toHaveBeenCalled();

                // Restore mock
                mockEntityManager.getEntityInstance = originalGetEntityInstance;
            });

        }); // End Robustness

    }); // End describe Scope Processing Logic


    // ========================================================================
    // == Sub-suite: Filtering Logic ==========================================
    // ========================================================================
    describe('Filtering Logic', () => {

        // --- requiredComponents Filtering ---
        describe('requiredComponents Filtering', () => {
            beforeEach(() => {
                setupResolveEntityTestData(); // Ensures entities exist in inventory
                // Mock scope service to return all inventory items for these component tests
                const inventoryIds = new Set();
                mockPlayerEntity.getComponent(InventoryComponent)?.getItems().forEach(id => inventoryIds.add(id));
                getEntityIdsForScopesSpy.mockReturnValue(inventoryIds);
            });

            // Covers AC 3.1.1 (Success)
            test('should return FOUND_UNIQUE status when entity has all required components', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [itemAndEquipEntity]}); // Assume findTarget finds it
                const config = {
                    scope: 'inventory',
                    requiredComponents: [ItemComponent, EquippableComponent], // NameComponent is implicit
                    targetName: 'item equip thing', // Target the entity with both
                };
                const result = resolveTargetEntity(mockContext, config);

                // Verify findTarget was called with the correct entity list AFTER component filtering
                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassed = findTargetSpy.mock.calls[0][1];
                // Entities with Name, Item, AND Equippable in inventory: sword, helmet, axe, itemAndEquipEntity
                const expectedPassed = [itemAndEquipEntity, sword, helmet, axe].filter(Boolean);
                expect(entitiesPassed).toEqual(expect.arrayContaining(expectedPassed));
                expect(entitiesPassed.length).toBe(expectedPassed.length); // Ensure ONLY expected ones passed

                // Assert final result
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: itemAndEquipEntity, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            // Covers AC 3.1.2 (Failure - Filtered Out by Component Check) -> NOT_FOUND from findTarget
            test('should return NOT_FOUND status when target lacks required components (but others exist)', () => {
                // Mock findTarget to NOT find 'item thing' in the list *after* component filtering
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});
                const config = {
                    scope: 'inventory',
                    requiredComponents: [ItemComponent, EquippableComponent], // Require both
                    targetName: 'item thing', // Target the entity with only ItemComponent (and Name)
                };
                const result = resolveTargetEntity(mockContext, config);

                // Verify the entity lacking the component was filtered out before findTarget
                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassed = findTargetSpy.mock.calls[0][1];
                expect(entitiesPassed).not.toEqual(expect.arrayContaining([itemOnlyEntity])); // Ensure the target was filtered out
                // Ensure entities *with* both components were included
                expect(entitiesPassed).toEqual(expect.arrayContaining([itemAndEquipEntity, sword, helmet, axe]));

                // Assert final result is NOT_FOUND because findTarget didn't match the targetName in the filtered list
                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            // Covers AC 3.1.3 (Failure - Scope Empty After Filter) -> FILTER_EMPTY
            test('should return FILTER_EMPTY status when ALL entities lack required components', () => {
                // No need to mock findTarget return value, it shouldn't be called.
                const config = {
                    scope: 'inventory',
                    // Require a component none of the test items have (e.g., HealthComponent)
                    requiredComponents: [ItemComponent, HealthComponent],
                    targetName: 'anything', // Target name doesn't matter here
                };
                const result = resolveTargetEntity(mockContext, config);

                // Verify findTarget was NOT called because component filtering removed everything
                expect(findTargetSpy).not.toHaveBeenCalled();

                // Assert final result is FILTER_EMPTY
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            // Test edge case: Explicitly requiring NameComponent doesn't break anything
            test('should work correctly when NameComponent is explicitly required', () => {
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [itemAndEquipEntity]});
                const config = {
                    scope: 'inventory',
                    requiredComponents: [NameComponent, ItemComponent, EquippableComponent], // Explicit NameComponent
                    targetName: 'item equip thing',
                };
                const result = resolveTargetEntity(mockContext, config);

                expect(findTargetSpy).toHaveBeenCalled();
                const entitiesPassed = findTargetSpy.mock.calls[0][1];
                // Same expected entities as the test without explicit NameComponent
                const expectedPassed = [itemAndEquipEntity, sword, helmet, axe].filter(Boolean);
                expect(entitiesPassed).toEqual(expect.arrayContaining(expectedPassed));
                expect(entitiesPassed.length).toBe(expectedPassed.length);

                // Assert final result
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: itemAndEquipEntity, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

        }); // End requiredComponents Filtering

        // --- Custom Filter Application ---
        describe('customFilter Application', () => {
            beforeEach(() => {
                setupResolveEntityTestData();
                // Mock scope service to return all inventory items
                const inventoryIds = new Set();
                mockPlayerEntity.getComponent(InventoryComponent)?.getItems().forEach(id => inventoryIds.add(id));
                getEntityIdsForScopesSpy.mockReturnValue(inventoryIds);
            });

            // Covers AC 3.2.1 (Success)
            test('should return FOUND_UNIQUE status when entity passes components and customFilter', () => {
                // *** CORRECTION: Filter now targets equipOnlyEntity ***
                const customFilter = jest.fn((entity) => entity.id === equipOnlyEntity.id);
                // *** CORRECTION: findTarget mock expects equipOnlyEntity ***
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [equipOnlyEntity]});

                const config = {
                    scope: 'inventory',
                    // *** CORRECTION: Require EquippableComponent which equipOnlyEntity has ***
                    requiredComponents: [EquippableComponent], // NameComponent is implicit
                    // *** CORRECTION: Target the correct entity name ***
                    targetName: 'equip thing',
                    customFilter: customFilter,
                };
                const result = resolveTargetEntity(mockContext, config);

                // Verify customFilter was called for entities passing component check (Name + Equippable)
                // *** CORRECTION: Update list of entities expected to reach the filter ***
                const expectedComponentPass = [sword, helmet, axe, equipOnlyEntity, itemAndEquipEntity]; // In inventory with Name+Equippable
                expectedComponentPass.forEach(entity => {
                    if (entity) expect(customFilter).toHaveBeenCalledWith(entity);
                });
                // Make sure it wasn't called for entities failing the component check (e.g., potion)
                expect(customFilter).not.toHaveBeenCalledWith(potion);


                // Verify findTarget received only the entity passing the custom filter
                // *** CORRECTION: Expect findTarget to be called with only equipOnlyEntity ***
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, [equipOnlyEntity]);

                // Assert final result
                // *** CORRECTION: Expect the correct entity in the result ***
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: equipOnlyEntity, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            // Covers AC 3.2.2 (Failure - Scope Empty After Filter) -> FILTER_EMPTY
            test('should return FILTER_EMPTY status when customFilter excludes all entities', () => {
                const customFilter = jest.fn(() => false); // Exclude everything
                // findTarget will NOT be called as filtered list becomes empty.

                const config = {
                    scope: 'inventory',
                    // *** CORRECTION: Require EquippableComponent which equipOnlyEntity has ***
                    requiredComponents: [EquippableComponent], // NameComponent is implicit
                    // Target name doesn't matter much here, but align for consistency
                    targetName: 'equip thing',
                    customFilter: customFilter,
                };
                const result = resolveTargetEntity(mockContext, config);

                // Verify customFilter was called for entities passing component check (Name + Equippable)
                // *** CORRECTION: Update list of entities expected to reach the filter ***
                const expectedComponentPass = [sword, helmet, axe, equipOnlyEntity, itemAndEquipEntity]; // In inventory with Name+Equippable
                expectedComponentPass.forEach(entity => {
                    // Check if the entity exists before asserting, setup might change
                    if (entity) {
                        // Ensure the filter was actually called with the entity that passed component checks
                        expect(customFilter).toHaveBeenCalledWith(entity);
                    }
                });
                // Make sure it wasn't called for entities failing the component check (e.g., potion)
                expect(customFilter).not.toHaveBeenCalledWith(potion);


                // Verify findTarget was NOT called
                expect(findTargetSpy).not.toHaveBeenCalled();

                // Assert final result is FILTER_EMPTY (this remains correct)
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            // Test custom filter is NOT called for entities failing component check
            test('should NOT call customFilter for entities failing requiredComponents', () => {
                const customFilter = jest.fn(() => true); // Simple filter, doesn't matter

                const config = {
                    scope: 'inventory',
                    // Require EquippableComponent (potion, itemOnlyEntity, shinyKey fail this)
                    requiredComponents: [EquippableComponent], // Name is implicit
                    targetName: 'sword',
                    customFilter: customFilter,
                };
                // Mock findTarget to return sword from the filtered list
                findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [sword]});

                const result = resolveTargetEntity(mockContext, config);

                // Verify customFilter was called ONLY for entities with Name AND EquippableComponent
                const expectedToPassComponents = [sword, helmet, axe, itemAndEquipEntity, equipOnlyEntity]; // Shield is equipped, not in inv scope
                expectedToPassComponents.forEach(entity => {
                    if (entity) expect(customFilter).toHaveBeenCalledWith(entity);
                });
                // Verify customFilter was NOT called for entities lacking EquippableComponent in inventory
                expect(customFilter).not.toHaveBeenCalledWith(potion);
                expect(customFilter).not.toHaveBeenCalledWith(shinyKey);
                expect(customFilter).not.toHaveBeenCalledWith(itemOnlyEntity);


                // Verify findTarget received only those passing components AND filter
                expect(findTargetSpy).toHaveBeenCalledWith(config.targetName, expect.arrayContaining(expectedToPassComponents));
                expect(findTargetSpy.mock.calls[0][1].length).toBe(expectedToPassComponents.length);

                // Assert final result
                expect(result).toEqual({status: 'FOUND_UNIQUE', entity: sword, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

        }); // End customFilter Application

        // --- Custom Filter Error Handling ---
        describe('customFilter Error Handling', () => {
            beforeEach(() => {
                setupResolveEntityTestData();
                // Mock scope service to return all inventory items
                const inventoryIds = new Set();
                mockPlayerEntity.getComponent(InventoryComponent)?.getItems().forEach(id => inventoryIds.add(id));
                getEntityIdsForScopesSpy.mockReturnValue(inventoryIds);
            });

            // Covers AC 3.3.1 (Error Handling) -> NOT_FOUND (if target errored but others remain)
            test('should log error, exclude entity, and return NOT_FOUND status when customFilter throws for target', () => {
                const filterError = new Error("Filter boom!");
                // Keep filter throwing for 'sword', ensure 'sword' passes component check
                const customFilter = jest.fn((entity) => {
                    if (entity.id === sword.id) {
                        throw filterError;
                    }
                    return true; // Allow others passing component check
                });
                // Mock findTarget: searching for 'sword' in the list *after* sword is excluded yields NOT_FOUND
                findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});

                const config = {
                    scope: 'inventory',
                    // *** CORRECTION: Require EquippableComponent. Sword AND equipOnlyEntity both have this. ***
                    requiredComponents: [EquippableComponent],
                    targetName: 'sword', // Target the entity that causes the error
                    customFilter: customFilter,
                };

                const result = resolveTargetEntity(mockContext, config);

                // Verify console.error was called ONCE with the specific error for sword-1
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    // Check for the correct error message format and entity ID
                    `resolveTargetEntity: Error executing customFilter for entity ${sword.id}:`,
                    // *** CORRECTION: Assert the actual error object was logged ***
                    filterError
                );

                // Verify findTarget was called with the list EXCLUDING sword-1 but INCLUDING others that passed components+filter
                // *** CORRECTION: Update the list of entities expected to be passed to findTarget ***
                // (Entities in inventory with Name+Equippable, excluding sword)
                const expectedEntitiesPassedToFindTarget = [helmet, axe, equipOnlyEntity, itemAndEquipEntity].filter(Boolean);
                expect(findTargetSpy).toHaveBeenCalledWith(
                    config.targetName, // "sword"
                    // Use expect.arrayContaining because the order might not be guaranteed
                    expect.arrayContaining(expectedEntitiesPassedToFindTarget)
                );
                // Also check the length for stricter assertion
                const entitiesPassedToFindTarget = findTargetSpy.mock.calls[0][1];
                expect(entitiesPassedToFindTarget.length).toBe(expectedEntitiesPassedToFindTarget.length);


                // Verify result status is NOT_FOUND (this remains correct)
                expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

            // Test case where the *only* candidate entity throws in the custom filter -> FILTER_EMPTY
            test('should return FILTER_EMPTY status if the only candidate throws in customFilter', () => {
                // Isolate sword as the only item in scope for this test
                const inventoryIds = new Set([sword.id]);
                getEntityIdsForScopesSpy.mockReturnValue(inventoryIds);

                const filterError = new Error("Only item failed!");
                const customFilter = jest.fn((entity) => {
                    if (entity.id === sword.id) {
                        throw filterError;
                    }
                    return false; // Should not be reached here
                });

                const config = {
                    scope: 'inventory',
                    requiredComponents: [ItemComponent], // Sword passes this
                    targetName: 'anything', // Target doesn't matter
                    customFilter: customFilter,
                };
                const result = resolveTargetEntity(mockContext, config);

                // Verify console.error was called
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    `resolveTargetEntity: Error executing customFilter for entity ${sword.id}:`, filterError
                );

                // Verify findTarget was NOT called because filteredEntities became empty due to the error
                expect(findTargetSpy).not.toHaveBeenCalled();

                // Verify result status is FILTER_EMPTY
                expect(result).toEqual({status: 'FILTER_EMPTY', entity: null, candidates: null});
                expect(mockDispatch).not.toHaveBeenCalled();
            });

        }); // End customFilter Error Handling

    }); // End describe Filtering Logic


    // ========================================================================
    // == Sub-suite: Result Handling (findTarget outcomes) ====================
    // ========================================================================
    describe('Result Handling (findTarget outcomes)', () => {

        beforeEach(() => {
            // Ensure fresh test data and mocked scope service
            setupResolveEntityTestData();
            // Mock scope service to return relevant items (e.g., all inventory) for simplicity
            const inventoryIds = new Set();
            mockPlayerEntity.getComponent(InventoryComponent)?.getItems().forEach(id => inventoryIds.add(id));
            getEntityIdsForScopesSpy.mockReturnValue(inventoryIds);
        });

        // --- Test FOUND_UNIQUE result ---
        test('should return FOUND_UNIQUE status and entity when findTarget finds unique match', () => {
            const expectedEntity = sword;
            // Mock findTarget to return FOUND_UNIQUE
            findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [expectedEntity]});
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                targetName: 'sword',
            };

            const result = resolveTargetEntity(mockContext, config);

            expect(result).toEqual({status: 'FOUND_UNIQUE', entity: expectedEntity, candidates: null});
            expect(mockDispatch).not.toHaveBeenCalled(); // Double-check no dispatch
        });

        // --- Test NOT_FOUND result ---
        test('should return NOT_FOUND status when findTarget finds no match', () => {
            const targetName = 'nonexistent';
            // Mock findTarget to return NOT_FOUND
            findTargetSpy.mockReturnValue({status: 'NOT_FOUND', matches: []});
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                targetName: targetName,
            };

            const result = resolveTargetEntity(mockContext, config);

            expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

        // --- Test FOUND_AMBIGUOUS result ---
        test('should return AMBIGUOUS status and candidates when findTarget finds multiple matches', () => {
            const targetName = 'key';
            const ambiguousMatches = [shinyKey, rustyKey]; // Assume both pass filters
            // Mock findTarget to return FOUND_AMBIGUOUS
            findTargetSpy.mockReturnValue({status: 'FOUND_AMBIGUOUS', matches: ambiguousMatches});
            // Adjust scope mock to include location for rustyKey
            const combinedIds = new Set([...mockPlayerEntity.getComponent(InventoryComponent).getItems(), rustyKey.id]);
            getEntityIdsForScopesSpy.mockReturnValue(combinedIds);


            const config = {
                scope: ['inventory', 'location'], // Include location where rustyKey is
                requiredComponents: [ItemComponent],
                targetName: targetName,
            };
            const result = resolveTargetEntity(mockContext, config);

            expect(result).toEqual({status: 'AMBIGUOUS', entity: null, candidates: ambiguousMatches});
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

        // --- Test unexpected findTarget status ---
        test('should return NOT_FOUND status and log error for unexpected findTarget status', () => {
            const unexpectedStatus = 'INVALID_FINDER_STATE';
            // Mock findTarget to return an unexpected status
            findTargetSpy.mockReturnValue({status: unexpectedStatus, matches: []});
            const config = {
                scope: 'inventory',
                requiredComponents: [ItemComponent],
                targetName: 'sword', // Target doesn't matter here
            };

            const result = resolveTargetEntity(mockContext, config);

            // Expect fallback to NOT_FOUND status
            expect(result).toEqual({status: 'NOT_FOUND', entity: null, candidates: null});
            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `resolveTargetEntity: Internal error - Unexpected findTarget status: ${unexpectedStatus}`
            );
            expect(mockDispatch).not.toHaveBeenCalled(); // Verify no dispatch
        });

    }); // End describe Result Handling (findTarget outcomes)


    // ========================================================================
    // == Other Functional Tests (e.g., Punctuation Interaction) =============
    // ========================================================================
    describe('Punctuation Matching Interaction', () => {
        // These tests verify interaction with findTarget correctly, asserting the final ResolutionResult
        beforeEach(() => {
            setupResolveEntityTestData(); // Includes warningSign and stopSign
            // Mock scope to return location entities
            const locationIds = new Set();
            mockEntityManager.locations.get(mockCurrentLocation.id)?.forEach(id => {
                if (id !== mockPlayerEntity.id) locationIds.add(id);
            });
            getEntityIdsForScopesSpy.mockReturnValue(locationIds);
        });

        test('should return FOUND_UNIQUE status when findTarget matches name with punctuation', () => {
            // Mock findTarget to simulate finding the punctuated sign
            findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [warningSign]});
            const config = {
                scope: 'location',
                requiredComponents: [], // NameComponent implicitly
                targetName: 'Warning Sign.', // Exact match including '.'
            };
            const result = resolveTargetEntity(mockContext, config);

            expect(findTargetSpy).toHaveBeenCalledWith('Warning Sign.', expect.arrayContaining([warningSign, stopSign])); // Verify input to findTarget
            expect(result).toEqual({status: 'FOUND_UNIQUE', entity: warningSign, candidates: null});
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        test('should return FOUND_UNIQUE status when findTarget matches name ignoring punctuation', () => {
            // Mock findTarget to simulate finding the sign even without punctuation input
            findTargetSpy.mockReturnValue({status: 'FOUND_UNIQUE', matches: [warningSign]});
            const config = {
                scope: 'location',
                requiredComponents: [], // NameComponent implicitly
                targetName: 'Warning Sign', // Match without '.'
            };
            const result = resolveTargetEntity(mockContext, config);

            expect(findTargetSpy).toHaveBeenCalledWith('Warning Sign', expect.arrayContaining([warningSign, stopSign]));
            expect(result).toEqual({status: 'FOUND_UNIQUE', entity: warningSign, candidates: null});
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        test('should return AMBIGUOUS status when findTarget returns ambiguous for punctuated substring', () => {
            // Mock findTarget returning ambiguous result for the punctuated input
            const ambiguousMatches = [warningSign, stopSign];
            findTargetSpy.mockReturnValue({status: 'FOUND_AMBIGUOUS', matches: ambiguousMatches});

            const targetName = 'sign.'; // Ambiguous punctuated substring
            const config = {
                scope: 'location',
                requiredComponents: [], // Name implicitly
                targetName: targetName,
            };

            const result = resolveTargetEntity(mockContext, config);

            expect(findTargetSpy).toHaveBeenCalledWith(targetName, expect.arrayContaining([warningSign, stopSign]));
            expect(result).toEqual({status: 'AMBIGUOUS', entity: null, candidates: ambiguousMatches}); // Correct status and candidates
            expect(mockDispatch).not.toHaveBeenCalled(); // No dispatch check
        });
    }); // End describe Punctuation Matching Interaction


}); // End describe resolveTargetEntity