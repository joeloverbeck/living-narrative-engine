// src/actions/handlers/equipActionHandler.js

// Import the new utility and necessary components
import { findTarget } from '../../utils/targetFinder.js'; // Adjust path as needed
import { InventoryComponent } from '../../components/inventoryComponent.js';
import { EquipmentComponent } from '../../components/equipmentComponent.js';
import { EquippableComponent } from '../../components/equippableComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */


export function executeEquip(context) {
    const { playerEntity, targets, entityManager, dispatch } = context; // Removed dataManager if only instance needed
    const messages = [];
    let success = false;

    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('equip');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    const targetItemName = targets.join(' ');

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    // --- 1. Determine Search Scope (Equippable items in inventory) ---
    const inventoryItemIds = playerInventory.getItems();
    const searchableInventoryItems = [];
    for (const itemId of inventoryItemIds) {
        const itemInstance = entityManager.getEntityInstance(itemId);
        // Must exist, have EquippableComponent and NameComponent
        if (itemInstance && itemInstance.hasComponent(EquippableComponent) && itemInstance.hasComponent(NameComponent)) {
            searchableInventoryItems.push(itemInstance);
        } else if (itemInstance && !itemInstance.hasComponent(NameComponent)) {
            console.warn(`executeEquip: Item ${itemId} in inventory lacks NameComponent.`);
        } else if (itemInstance && !itemInstance.hasComponent(EquippableComponent)) {
            // This item is in inventory but cannot be equipped, so exclude silently.
        } else if (!itemInstance){
            console.warn(`executeEquip: Inventory contains ID '${itemId}' but instance not found.`);
        }
    }

    // Check if inventory has any equippable items before searching
    if (searchableInventoryItems.length === 0) {
        // Provide feedback based on whether they have the item but can't equip vs don't have it
        let itemExistsButNotEquippable = false;
        for (const itemId of inventoryItemIds) {
            const itemInstance = entityManager.getEntityInstance(itemId);
            const nameComp = itemInstance?.getComponent(NameComponent);
            if (nameComp && nameComp.value.toLowerCase().includes(targetItemName.toLowerCase())) {
                if (!itemInstance.hasComponent(EquippableComponent)){
                    itemExistsButNotEquippable = true;
                    break;
                }
            }
        }
        let errorMsg;
        if(itemExistsButNotEquippable) {
            errorMsg = TARGET_MESSAGES.EQUIP_CANNOT(targetItemName);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
        } else {
            errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(targetItemName); // Or more specific NOT_FOUND_EQUIPPABLE
            dispatch('ui:message_display', { text: errorMsg, type: 'info' });
        }

        return { success: false, messages: [{ text: errorMsg, type: 'info' }], newState: undefined };
    }


    // --- 2. Find Target Item using Utility ---
    const findResult = findTarget(targetItemName, searchableInventoryItems);
    let itemInstanceToEquip = null;
    let itemIdToEquip = null;
    let itemDisplayName = targetItemName; // Fallback

    switch (findResult.status) {
        case 'NOT_FOUND': {
            // Since scope was pre-filtered for equippable, this means no matching *equippable* item was found.
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE(targetItemName);
            dispatch('ui:message_display', { text: errorMsg, type: 'info' }); // Use info for not found
            return { success: false, messages: [{ text: errorMsg, type: 'info' }], newState: undefined };
        }
        case 'FOUND_AMBIGUOUS': {
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('equip', targetItemName, findResult.matches);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            return { success: false, messages: [{ text: errorMsg, type: 'warning' }], newState: undefined };
        }
        case 'FOUND_UNIQUE':
            itemInstanceToEquip = findResult.matches[0];
            itemIdToEquip = itemInstanceToEquip.id;
            itemDisplayName = getDisplayName(itemInstanceToEquip);
            break; // Proceed with validation
        default: {
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status)";
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            console.error("executeEquip: Unexpected status from findTarget:", findResult.status);
            return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
        }
    }

    // --- 3. Validate Equipment Slot ---
    const equippableComp = itemInstanceToEquip.getComponent(EquippableComponent); // Already confirmed to exist by scope filter

    const targetSlotId = equippableComp.getSlotId();

    if (!playerEquipment.hasSlot(targetSlotId)) {
        const errorMsg = TARGET_MESSAGES.EQUIP_NO_SLOT(itemDisplayName, targetSlotId);
        dispatch('ui:message_display', { text: errorMsg, type: 'error' }); // This is likely a config error
        console.error(`executeEquip: Player tried to equip to slot '${targetSlotId}' but EquipmentComponent doesn't define it.`);
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    const currentItemInSlotId = playerEquipment.getEquippedItem(targetSlotId);
    if (currentItemInSlotId !== null) {
        const currentItemInstance = entityManager.getEntityInstance(currentItemInSlotId);
        const currentItemName = getDisplayName(currentItemInstance);
        const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop().replace('slot_', '') : targetSlotId;
        const errorMsg = TARGET_MESSAGES.EQUIP_SLOT_FULL(currentItemName, slotName);
        dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
        return { success: false, messages: [{ text: errorMsg, type: 'warning' }], newState: undefined };
    }

    // --- 4. Perform the Equip ---
    const removedFromInv = playerInventory.removeItem(itemIdToEquip);
    if (!removedFromInv) {
        const errorMsg = `(Internal Error: Failed to remove ${itemDisplayName} from inventory during equip.)`;
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error(`executeEquip: removeItem failed for ${itemIdToEquip} despite checks.`);
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
    if (!equipped) {
        const errorMsg = `(Internal Error: Failed to place ${itemDisplayName} into slot ${targetSlotId}.)`;
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error(`executeEquip: equipItem failed for ${itemIdToEquip} into ${targetSlotId}.`);
        playerInventory.addItem(itemIdToEquip); // Attempt to revert inventory change
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    success = true;
    const successMsg = `You equip the ${itemDisplayName}.`;
    dispatch('ui:message_display', { text: successMsg, type: 'success' });
    messages.push({ text: successMsg, type: 'success' });

    // Dispatch the game event
    try {
        dispatch('event:item_equipped', {
            entity: playerEntity, // Pass the whole entity
            itemId: itemIdToEquip,
            slotId: targetSlotId,
            itemInstance: itemInstanceToEquip // Pass instance too if useful
        });
    } catch (e) {
        console.error("Failed to dispatch item_equipped event:", e);
        // The action itself succeeded, but log the event failure
        messages.push({text: "Internal warning: Failed to dispatch item_equipped event.", type: 'warning'});
    }

    return { success, messages, newState: undefined };
}