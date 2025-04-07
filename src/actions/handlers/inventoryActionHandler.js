// src/actions/handlers/inventoryActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js'; // <-- Import EquipmentComponent
import {NameComponent} from '../../components/nameComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/**
 * Executes the 'inventory' action. Displays carried items and equipped items.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeInventory(context) {
    const {playerEntity, entityManager, dispatch} = context;
    const messages = [];
    let messageText = "";

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent); // <-- Get EquipmentComponent

    // --- Display Equipped Items ---
    if (playerEquipment) {
        messageText += "Equipped:\n";
        const equippedItems = playerEquipment.getAllEquipped();
        let anythingEquipped = false;
        // Define a typical order or sort slots if desired
        const slotOrder = ['core:slot_head', 'core:slot_body', 'core:slot_legs', 'core:slot_feet', 'core:slot_main_hand', 'core:slot_off_hand', 'core:slot_ranged', 'core:slot_amulet', 'core:slot_ring1', 'core:slot_ring2'];
        const displayedSlots = new Set();

        // Display in preferred order
        for (const slotId of slotOrder) {
            if (Object.hasOwn(equippedItems, slotId)) {
                const itemId = equippedItems[slotId];
                const slotName = slotId.split(':').pop().replace('slot_', ''); // Simple name
                if (itemId) {
                    const itemInstance = entityManager.getEntityInstance(itemId);
                    const itemName = itemInstance?.getComponent(NameComponent)?.value ?? itemId;
                    messageText += `  - ${capitalize(slotName)}: ${itemName}\n`;
                    anythingEquipped = true;
                } else {
                    messageText += `  - ${capitalize(slotName)}: (empty)\n`;
                }
                displayedSlots.add(slotId);
            }
        }
        // Display any remaining slots not in the preferred order
        for (const slotId in equippedItems) {
            if (Object.hasOwn(equippedItems, slotId) && !displayedSlots.has(slotId)) {
                const itemId = equippedItems[slotId];
                const slotName = slotId.split(':').pop().replace('slot_', ''); // Simple name
                if (itemId) {
                    const itemInstance = entityManager.getEntityInstance(itemId);
                    const itemName = itemInstance?.getComponent(NameComponent)?.value ?? itemId;
                    messageText += `  - ${capitalize(slotName)}: ${itemName}\n`;
                    anythingEquipped = true;
                } else {
                    messageText += `  - ${capitalize(slotName)}: (empty)\n`;
                }
            }
        }


        if (!anythingEquipped && Object.keys(equippedItems).length === 0) {
            messageText += "  (Nothing equipped)\n";
        }
    } else {
        messageText += "Equipped: (N/A)\n"; // Player doesn't have equipment capability
    }

    // --- Display Carried Items ---
    if (playerInventory) {
        messageText += "\nCarrying:\n";
        const items = playerInventory.getItems(); // Get item IDs

        if (items.length === 0) {
            messageText += "  (Nothing)";
        } else {
            // Group stackable items later if needed
            items.forEach(itemId => {
                const itemInstance = entityManager.getEntityInstance(itemId);
                const itemName = itemInstance?.getComponent(NameComponent)?.value ?? itemId; // Get name or fallback to ID
                messageText += `  - ${itemName}\n`;
            });
            // Remove trailing newline if items were listed
            if (items.length > 0) messageText = messageText.trimEnd();
        }
    } else {
        messageText += "\nCarrying: (N/A)"; // Player doesn't have inventory capability
    }

    // Dispatch the combined message
    dispatch('ui:message_display', {text: messageText, type: 'info'});
    messages.push({text: messageText, type: 'info'}); // Also add to internal messages if needed

    return {success: true, messages, newState: undefined};
}

// Helper to capitalize slot names
function capitalize(s) {
    if (typeof s !== 'string' || s.length === 0) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
}