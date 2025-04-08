// src/actions/handlers/inventoryActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {NameComponent} from '../../components/nameComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/**
 * Executes the 'inventory' action. Displays carried items and equipped items
 * in the format "Name (id)".
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeInventory(context) {
    const {playerEntity, entityManager, dispatch} = context;
    const messages = [];
    let messageText = "";

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Display Equipped Items ---
    if (playerEquipment) {
        messageText += "Equipped:\n";
        const equippedItems = playerEquipment.getAllEquipped();
        let anythingEquipped = false;
        // Define a typical order or sort slots if desired
        const slotOrder = ['core:slot_head', 'core:slot_body', 'core:slot_legs', 'core:slot_feet', 'core:slot_main_hand', 'core:slot_off_hand', 'core:slot_ranged', 'core:slot_amulet', 'core:slot_ring1', 'core:slot_ring2'];
        const displayedSlots = new Set();

        // Helper function to get formatted item string for equipped items
        const formatEquippedItem = (slotId) => {
            const itemId = equippedItems[slotId];
            const slotName = slotId.split(':').pop().replace('slot_', ''); // Simple name like 'Head', 'Main Hand'
            if (itemId) {
                const itemInstance = entityManager.getEntityInstance(itemId);
                const nameComponent = itemInstance?.getComponent(NameComponent);
                // Use placeholder if name component or its value is missing/empty
                const displayName = nameComponent?.value ? nameComponent.value : '(Unknown Name)';
                anythingEquipped = true;
                // Apply the required format: Slot: Name (ID)
                return `  - ${capitalize(slotName)}: ${displayName}\n`;
            } else {
                return `  - ${capitalize(slotName)}: (empty)\n`;
            }
        };

        // Display in preferred order
        for (const slotId of slotOrder) {
            if (Object.hasOwn(equippedItems, slotId)) {
                messageText += formatEquippedItem(slotId);
                displayedSlots.add(slotId);
            }
        }
        // Display any remaining slots not in the preferred order
        for (const slotId in equippedItems) {
            if (Object.hasOwn(equippedItems, slotId) && !displayedSlots.has(slotId)) {
                messageText += formatEquippedItem(slotId);
            }
        }

        if (!anythingEquipped && Object.keys(equippedItems).length === 0) {
            // Check if there are slots defined at all
            if (Object.keys(equippedItems).length > 0) {
                // If slots exist but all are empty
                messageText += "  (All slots empty)\n"; // Or keep previous "(Nothing equipped)"
            } else {
                // If no slots are defined on the component
                messageText += "  (No equipment slots defined)\n";
            }
        } else if (!anythingEquipped) {
            // This case handles if slots exist but were all empty
            messageText += "  (Nothing equipped)\n";
        }

    } else {
        messageText += "Equipped: (N/A - No Equipment Component)\n"; // Player doesn't have equipment capability
    }

    // --- Display Carried Items ---
    if (playerInventory) {
        messageText += "\nCarrying:\n";
        const items = playerInventory.getItems(); // Get item IDs

        if (items.length === 0) {
            messageText += "  (Nothing)";
        } else {
            items.forEach(itemId => {
                const itemInstance = entityManager.getEntityInstance(itemId);

                if (!itemInstance) {
                    dispatch('ui:message_display', {
                        text: 'Item instance of ' + itemId + ' not found on entityManager!',
                        type: 'error'
                    });
                }

                const nameComponent = itemInstance?.getComponent(NameComponent);
                // Use placeholder if name component or its value is missing/empty
                const displayName = nameComponent?.value ? nameComponent.value : '(Unknown Name)';
                // Apply the required format: - Name (ID)
                messageText += `  - ${displayName}\n`;
            });
            // Remove trailing newline if items were listed
            if (items.length > 0) messageText = messageText.trimEnd();
        }
    } else {
        messageText += "\nCarrying: (N/A - No Inventory Component)"; // Player doesn't have inventory capability
    }

    // Dispatch the combined message
    dispatch('ui:message_display', {text: messageText, type: 'info'});
    messages.push({text: messageText, type: 'info'}); // Also add to internal messages if needed

    return {success: true, messages, newState: undefined};
}

// Helper to capitalize slot names (unchanged)
function capitalize(s) {
    if (typeof s !== 'string' || s.length === 0) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
}