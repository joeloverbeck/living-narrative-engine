// src/tests/equipActionHandler.test.js

import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import {executeEquip} from '../../../actions/handlers/equipActionHandler.js'; // Adjust path
import Entity from '../../../entities/entity.js'; // Adjust path
import {InventoryComponent} from '../../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../../components/equipmentComponent.js';
import {EquippableComponent} from '../../../components/equippableComponent.js';
import {ItemComponent} from '../../../components/itemComponent.js';
import {NameComponent} from '../../../components/nameComponent.js';
import {TARGET_MESSAGES} from '../../../utils/messages.js'; // Adjust path

// Mock dependencies
jest.mock('../../../services/entityFinderService.js'); // Mock the service
jest.mock('../../../utils/actionValidationUtils.js'); // Mock validation

import {resolveTargetEntity} from '../../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../../utils/actionValidationUtils.js';
import {EVENT_DISPLAY_MESSAGE} from "../../../types/eventTypes.js";

// --- Mocks Setup ---
const mockDispatch = jest.fn();
const mockEntityManager = {
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    entities: new Map(),
};

// Helper to create mock entities
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

// Helper for setting up player inventory/equipment
const setupPlayer = (entity) => {
    if (!entity.hasComponent(InventoryComponent)) {
        entity.addComponent(new InventoryComponent());
    }
    if (!entity.hasComponent(EquipmentComponent)) {
        entity.addComponent(new EquipmentComponent({slots: {'core:slot_body': null, 'core:slot_head': null}}));
    }
    return entity;
}

// Helper to add item to inventory component
const addToInventory = (itemEntity, ownerEntity) => {
    ownerEntity.getComponent(InventoryComponent).addItem(itemEntity.id);
};


describe('executeEquip', () => {
    let playerEntity;
    let mockContext;
    let leatherVest;
    let rustySword; // Equippable
    let rock;      // Not Equippable

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.entities.clear();

        playerEntity = createMockEntity('player', 'Player');
        setupPlayer(playerEntity);

        leatherVest = createMockEntity('item_leather_vest', 'Leather Vest', [
            new ItemComponent(),
            new EquippableComponent({slotId: 'core:slot_body'})
        ]);
        rustySword = createMockEntity('item_rusty_sword', 'Rusty Sword', [
            new ItemComponent(),
            new EquippableComponent({slotId: 'core:slot_main_hand'}) // Assume main hand exists or add it
        ]);
        // Ensure player has the main hand slot needed for sword
        if (!playerEntity.getComponent(EquipmentComponent).hasSlot('core:slot_main_hand')) {
            playerEntity.getComponent(EquipmentComponent).slots['core:slot_main_hand'] = null;
        }

        rock = createMockEntity('item_rock', 'Rock', [new ItemComponent()]); // Item, but not equippable

        mockContext = {
            playerEntity,
            entityManager: mockEntityManager,
            dispatch: mockDispatch,
            // targets property removed
            parsedCommand: {}, // Will be set per test
            dataManager: {}, // Mock if needed
            currentLocation: null, // Not directly used by equip scope='inventory'
        };

        // Default mock implementations
        validateRequiredCommandPart.mockReturnValue(true); // Assume validation passes by default

        // Default resolveTargetEntity mock (can be overridden in tests)
        // *** This mock needs to be updated to use context.parsedCommand.directObjectPhrase ***
        resolveTargetEntity.mockImplementation((context, config) => {
            const targetName = context.parsedCommand?.directObjectPhrase?.toLowerCase() || config?.targetName?.toLowerCase(); // Use either source
            if (!targetName) {
                // Mimic real service behavior if input is invalid
                return {status: 'INVALID_INPUT', message: 'No target name provided.'};
            }

            const inv = context.playerEntity.getComponent(InventoryComponent);
            if (!inv || inv.items.length === 0) {
                // Mimic real service behavior if inventory is empty
                return {status: 'FILTER_EMPTY'}; // Or 'NOT_FOUND', depending on real service logic
            }

            let foundEntity = null;
            const candidates = []; // For ambiguity

            for (const itemId of inv.items) {
                const item = context.entityManager.getEntityInstance(itemId);
                if (!item) continue; // Skip if entity somehow doesn't exist

                const itemName = item.getComponent(NameComponent)?.value?.toLowerCase();
                if (itemName?.includes(targetName)) {
                    // Check required components if specified in config
                    let meetsReqs = true;
                    if (config.requiredComponents) {
                        for (const Comp of config.requiredComponents) {
                            if (!item.hasComponent(Comp)) {
                                meetsReqs = false;
                                break;
                            }
                        }
                    }

                    if (meetsReqs) {
                        candidates.push(item); // Add to potential candidates
                    }
                }
            }

            // Determine final status based on candidates
            if (candidates.length === 1) {
                return {status: 'FOUND_UNIQUE', entity: candidates[0]};
            } else if (candidates.length > 1) {
                // Handle ambiguity - return candidates for the handler to deal with
                return {status: 'AMBIGUOUS', candidates: candidates};
            } else {
                // No candidates found that meet requirements
                return {status: 'NOT_FOUND'};
            }
        });
    });

    // --- THE CRITICAL TEST ---
    it('should display ONE message when trying to equip an item NOT in inventory', () => {
        addToInventory(leatherVest, playerEntity);
        mockContext.parsedCommand = {directObjectPhrase: 'rusty'};

        const result = executeEquip(mockContext);

        expect(result.success).toBe(false);

        // Correct the expected message key/text
        const expectedMsgText = TARGET_MESSAGES.NOT_FOUND_INVENTORY('rusty'); // Use the correct message
        const expectedMsgType = 'info'; // Check the type used in the NOT_FOUND case

        // Verify the specific call
        expect(mockDispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
            text: expectedMsgText,
            type: expectedMsgType, // Make sure type matches too
        });

        // Verify it was called only once
        expect(mockDispatch).toHaveBeenCalledTimes(1);

        // Verify state
        expect(playerEntity.getComponent(InventoryComponent).hasItem(leatherVest.id)).toBe(true);
        expect(playerEntity.getComponent(EquipmentComponent).getEquippedItem('core:slot_body')).toBeNull();
    });
    // --- END CRITICAL TEST ---

    it('should display correct message when trying to equip an item that exists but is not equippable', () => {
        addToInventory(rock, playerEntity); // Player has a rock (Item, not Equippable)
        // mockContext.targets removed
        mockContext.parsedCommand = {directObjectPhrase: 'rock'}; // Using parsedCommand

        const result = executeEquip(mockContext);

        expect(result.success).toBe(false);
        // Check for the specific "cannot equip" message
        expect(mockDispatch).toHaveBeenCalledTimes(1); // Ensure only one message total
        expect(mockDispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
            text: TARGET_MESSAGES.EQUIP_CANNOT('Rock'), // Message depends on getDisplayName
            type: 'warning',
        });
        expect(playerEntity.getComponent(InventoryComponent).hasItem(rock.id)).toBe(true); // Still has rock
    });

    it('should fail if the required slot is occupied', () => {
        addToInventory(leatherVest, playerEntity);
        // Pre-equip something else in the body slot
        const oldVest = createMockEntity('old_vest', 'Old Vest', [new ItemComponent(), new EquippableComponent({slotId: 'core:slot_body'})]);
        addToInventory(oldVest, playerEntity); // Add to inv first
        playerEntity.getComponent(InventoryComponent).removeItem(oldVest.id); // Remove from inv
        playerEntity.getComponent(EquipmentComponent).equipItem('core:slot_body', oldVest.id); // Equip it

        // mockContext.targets removed
        mockContext.parsedCommand = {directObjectPhrase: 'leather vest'}; // Using parsedCommand

        const result = executeEquip(mockContext);

        expect(result.success).toBe(false);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockDispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
            text: TARGET_MESSAGES.EQUIP_SLOT_FULL('Old Vest', 'body'), // Message depends on getDisplayName and slot processing
            type: 'warning',
        });
        // Ensure the leather vest wasn't removed from inventory
        expect(playerEntity.getComponent(InventoryComponent).hasItem(leatherVest.id)).toBe(true);
        // Ensure the old vest is still equipped
        expect(playerEntity.getComponent(EquipmentComponent).getEquippedItem('core:slot_body')).toBe(oldVest.id);
    });

    it('should fail if the player lacks the required slot', () => {
        addToInventory(rustySword, playerEntity); // Sword goes in main_hand
        // Intentionally remove the main_hand slot from the player's equipment for this test
        delete playerEntity.getComponent(EquipmentComponent).slots['core:slot_main_hand'];

        // mockContext.targets removed
        mockContext.parsedCommand = {directObjectPhrase: 'rusty sword'}; // Using parsedCommand

        const result = executeEquip(mockContext);

        expect(result.success).toBe(false);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockDispatch).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, {
            text: TARGET_MESSAGES.EQUIP_NO_SLOT('Rusty Sword', 'core:slot_main_hand'), // Message depends on getDisplayName
            type: 'error',
        });
        expect(playerEntity.getComponent(InventoryComponent).hasItem(rustySword.id)).toBe(true); // Still in inventory
    });
});