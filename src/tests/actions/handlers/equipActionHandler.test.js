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
jest.mock('../../../services/targetResolutionService.js'); // Mock the service
jest.mock('../../../utils/actionValidationUtils.js'); // Mock validation

import {resolveTargetEntity} from '../../../services/targetResolutionService.js';
import {validateRequiredCommandPart} from '../../../utils/actionValidationUtils.js';

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
            // Use parsedCommand.directObjectPhrase instead of config.targetName
            const targetName = context.parsedCommand?.directObjectPhrase?.toLowerCase();
            if (!targetName) return null; // No target provided in command

            const inv = context.playerEntity.getComponent(InventoryComponent);
            let found = null;

            for (const itemId of inv.items) {
                const item = context.entityManager.getEntityInstance(itemId);
                const itemName = item?.getComponent(NameComponent)?.value?.toLowerCase();
                if (itemName?.includes(targetName)) {
                    // Check required components
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
                        found = item; // Simple first match logic for test
                        break;
                    }
                }
            }
            return found;
        });
    });

    // --- THE CRITICAL TEST ---
    it('should display ONE message when trying to equip an item NOT in inventory', () => {
        addToInventory(leatherVest, playerEntity); // Player has *something* equippable
        // mockContext.targets removed
        mockContext.parsedCommand = {directObjectPhrase: 'rusty'}; // Using parsedCommand

        const result = executeEquip(mockContext);

        expect(result.success).toBe(false);
        // Ensure the specific message was dispatched ONLY ONCE
        // Note: The message generation inside executeEquip now uses parsedCommand.directObjectPhrase
        const expectedMsg = TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE('rusty');
        const calls = mockDispatch.mock.calls.filter(call =>
            call[0] === 'ui:message_display' && call[1].text === expectedMsg
        );
        expect(calls).toHaveLength(1);

        // More general check: ensure only one 'ui:message_display' happened overall
        const totalDisplayCalls = mockDispatch.mock.calls.filter(call => call[0] === 'ui:message_display');
        expect(totalDisplayCalls).toHaveLength(1);

        // Verify the state hasn't changed incorrectly
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
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
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
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
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
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.EQUIP_NO_SLOT('Rusty Sword', 'core:slot_main_hand'), // Message depends on getDisplayName
            type: 'error',
        });
        expect(playerEntity.getComponent(InventoryComponent).hasItem(rustySword.id)).toBe(true); // Still in inventory
    });
});