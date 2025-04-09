// src/actions/handlers/unequipActionHandler.js
// Import the new utility and necessary components
import { findTarget } from '../../utils/targetFinder.js'; // Adjust path as needed
import { InventoryComponent } from '../../components/inventoryComponent.js';
import { EquipmentComponent } from '../../components/equipmentComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

export function executeUnequip(context) {
    const { playerEntity, targets, entityManager, dispatch } = context;
    const messages = [];
    let success = false;

    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('unequip') + " (item name or slot name)";
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    const targetName = targets.join(' '); // Keep case for messages if needed

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error("executeUnequip: Player entity missing InventoryComponent or EquipmentComponent.");
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    let slotIdToUnequip = null;
    let itemIdToUnequip = null;
    let itemInstanceToUnequip = null; // Store the instance
    let itemDisplayName = targetName; // Fallback

    // Strategy:
    // 1. Check if targetName matches a SLOT NAME/ID convention.
    // 2. If not, use findTarget to match the NAME of an EQUIPPED item.

    // Try matching slot name first (simple convention)
    const potentialSlotId = `core:slot_${targetName.toLowerCase().replace(/\s+/g, '_')}`; // e.g., "main hand" -> "core:slot_main_hand"
    if (playerEquipment.hasSlot(potentialSlotId)) {
        itemIdToUnequip = playerEquipment.getEquippedItem(potentialSlotId);
        if (itemIdToUnequip) {
            slotIdToUnequip = potentialSlotId;
            itemInstanceToUnequip = entityManager.getEntityInstance(itemIdToUnequip);
            if (!itemInstanceToUnequip) {
                console.error(`executeUnequip: Found item ID ${itemIdToUnequip} in slot ${slotIdToUnequip} but instance is missing!`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Equipped item instance missing)";
                dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
            }
            itemDisplayName = getDisplayName(itemInstanceToUnequip);
            console.debug(`executeUnequip: Matched slot name '${targetName}' to slot ${slotIdToUnequip}`);
        } else {
            const errorMsg = TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY(targetName);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            return { success: false, messages: [{ text: errorMsg, type: 'warning' }], newState: undefined };
        }
    } else {
        // --- 2. If not a slot name, Find Target Item by Name using Utility ---
        console.debug(`executeUnequip: '${targetName}' not a direct slot match, searching equipped item names.`);
        // --- 2a. Determine Search Scope (Equipped items) ---
        const equippedItemsMap = playerEquipment.getAllEquipped();
        const equippedItemInstances = [];
        for (const itemId of Object.values(equippedItemsMap)) {
            if (itemId) {
                const instance = entityManager.getEntityInstance(itemId);
                // Must exist and have NameComponent to be searchable by name
                if (instance && instance.hasComponent(NameComponent)) {
                    equippedItemInstances.push(instance);
                } else if (instance) {
                    console.warn(`executeUnequip: Equipped item ${itemId} lacks NameComponent.`);
                } else {
                    console.warn(`executeUnequip: Equipped item ID ${itemId} instance not found.`);
                }
            }
        }

        if (equippedItemInstances.length === 0) {
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_EQUIPPED(targetName); // Or "Nothing equipped"?
            dispatch('ui:message_display', { text: errorMsg, type: 'info' });
            return { success: false, messages: [{ text: errorMsg, type: 'info' }], newState: undefined };
        }

        // --- 2b. Call findTarget ---
        const findResult = findTarget(targetName, equippedItemInstances);

        switch (findResult.status) {
            case 'NOT_FOUND': {
                const errorMsg = TARGET_MESSAGES.NOT_FOUND_UNEQUIPPABLE(targetName);
                dispatch('ui:message_display', { text: errorMsg, type: 'info' }); // Use info
                return { success: false, messages: [{ text: errorMsg, type: 'info' }], newState: undefined };
            }
            case 'FOUND_AMBIGUOUS': {
                const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('unequip', targetName, findResult.matches);
                dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
                return { success: false, messages: [{ text: errorMsg, type: 'warning' }], newState: undefined };
            }
            case 'FOUND_UNIQUE':
                itemInstanceToUnequip = findResult.matches[0];
                itemIdToUnequip = itemInstanceToUnequip.id;
                itemDisplayName = getDisplayName(itemInstanceToUnequip);
                // Find the slot this unique item is in
                slotIdToUnequip = Object.keys(equippedItemsMap).find(slotId => equippedItemsMap[slotId] === itemIdToUnequip);
                if (!slotIdToUnequip) {
                    // Should not happen if scope was built correctly
                    console.error(`executeUnequip: Found unique item ${itemIdToUnequip} by name but couldn't find its slot!`);
                    const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Cannot find item's slot)";
                    dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                    return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
                }
                console.debug(`executeUnequip: Matched item name '${targetName}' to item ${itemIdToUnequip} in slot ${slotIdToUnequip}`);
                break; // Proceed with unequip
            default: {
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status)";
                dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                console.error("executeUnequip: Unexpected status from findTarget:", findResult.status);
                return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
            }
        }
    }


    // --- 3. Perform the Unequip ---
    // Inventory space check could be added here if needed:
    // if (!playerInventory.canAddItem(itemIdToUnequip)) { ... return failure ... }

    const actuallyUnequippedId = playerEquipment.unequipItem(slotIdToUnequip);

    // Verification check
    if (actuallyUnequippedId !== itemIdToUnequip) {
        const errorMsg = `(Internal Error: Failed to unequip ${itemDisplayName} from slot ${slotIdToUnequip}. Mismatch detected.)`;
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error(`executeUnequip: unequipItem inconsistency for slot ${slotIdToUnequip}. Expected ${itemIdToUnequip}, got ${actuallyUnequippedId}`);
        // Attempt to revert? Risky. Log and fail.
        // if (actuallyUnequippedId) playerEquipment.equipItem(slotIdToUnequip, actuallyUnequippedId); // Maybe try to put back whatever came out?
        return { success: false, messages: [{ text: errorMsg, type: 'error' }], newState: undefined };
    }

    // Add back to inventory *after* successful removal from equipment
    playerInventory.addItem(itemIdToUnequip);

    success = true;
    const successMsg = `You unequip the ${itemDisplayName}.`;
    dispatch('ui:message_display', { text: successMsg, type: 'success' });
    messages.push({ text: successMsg, type: 'success' });

    // Dispatch the game event
    try {
        dispatch('event:item_unequipped', {
            entity: playerEntity,
            itemId: itemIdToUnequip,
            slotId: slotIdToUnequip,
            itemInstance: itemInstanceToUnequip // Pass instance if useful
        });
    } catch (e) {
        console.error("Failed to dispatch item_unequipped event:", e);
        messages.push({text: "Internal warning: Failed to dispatch item_unequipped event.", type: 'warning'});
    }

    return { success, messages, newState: undefined };
}