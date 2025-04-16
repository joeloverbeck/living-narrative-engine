// src/actions/handlers/inventoryActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js"; // Import TARGET_MESSAGES

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */ // Added for helper type hint
/** @typedef {import('../../managers/entityManager.js').EntityManager} EntityManager */ // Added for helper type hint

// --- REFACTOR: Ticket 11 ---
// Internal static helper to get display data for an item instance.
// Centralizes instance lookup, name component access, and default name logic.
/**
 * @param {EntityManager} entityManager
 * @param {string} itemId
 * @returns {{instance: Entity | null, displayName: string}}
 */
const _getItemDisplayData = (entityManager, itemId) => {
    const itemInstance = entityManager.getEntityInstance(itemId);
    if (!itemInstance) {
        // The calling code should handle the case where the instance is missing if specific
        // error handling (like logging/dispatching) is needed for that context.
        // This helper focuses on getting the name *if* the instance exists.
        return {instance: null, displayName: '(Unknown Item)'};
    }
    // Use the shared getDisplayName utility which handles NameComponent lookup and fallbacks
    const displayName = getDisplayName(itemInstance);
    return {instance: itemInstance, displayName: displayName};
};

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
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Display Equipped Items ---
    if (playerEquipment) {
        messageText += "Equipped:\n";
        const equippedItems = playerEquipment.getAllEquipped();
        let anythingEquipped = false;
        const slotOrder = ['core:slot_head', 'core:slot_body', 'core:slot_legs', 'core:slot_feet', 'core:slot_main_hand', 'core:slot_off_hand', 'core:slot_ranged', 'core:slot_amulet', 'core:slot_ring1', 'core:slot_ring2'];
        const displayedSlots = new Set();

        // Helper function to format a single equipped item line
        const formatEquippedItem = (slotId) => {
            const itemId = equippedItems[slotId];
            const slotName = slotId.split(':').pop().replace('slot_', ''); // Simple name
            if (itemId) {
                // --- REFACTOR: Ticket 11 ---
                // Use the helper to get display name
                const {displayName} = _getItemDisplayData(entityManager, itemId);
                // We don't need the instance object here, just the name.
                // --- END REFACTOR: Ticket 11 ---

                anythingEquipped = true;
                // Format: Slot: Name
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
        // Display any remaining slots
        for (const slotId in equippedItems) {
            if (Object.hasOwn(equippedItems, slotId) && !displayedSlots.has(slotId)) {
                messageText += formatEquippedItem(slotId);
            }
        }

        // Informational messages for empty equipment states (unchanged)
        if (!anythingEquipped) {
            if (Object.keys(equippedItems).length === 0) {
                messageText += "  (No equipment slots defined)\n";
            } else {
                messageText += "  (Nothing equipped)\n";
            }
        }

    } else {
        messageText += "Equipped: (N/A - No Equipment Component)\n";
    }

    // --- Display Carried Items ---
    if (playerInventory) {
        messageText += "\nCarrying:\n";
        const itemIds = playerInventory.getItems(); // Get item IDs

        if (itemIds.length === 0) {
            messageText += "  (Nothing)";
        } else {
            itemIds.forEach(itemId => {
                // --- REFACTOR: Ticket 11 ---
                // First, attempt to get the instance to handle potential inventory corruption explicitly here.
                const itemInstance = entityManager.getEntityInstance(itemId);

                if (!itemInstance) {
                    // Specific error handling for corrupted inventory data remains here.
                    console.error(`executeInventory: Item instance for ID ${itemId} not found on entityManager! Inventory data might be corrupt.`);
                    dispatch('ui:message_display', {
                        text: TARGET_MESSAGES.INTERNAL_ERROR, // Use standard message
                        type: 'error'
                    });
                    messageText += `  - (Error: Unknown Item ID ${itemId})\n`; // Add placeholder in list
                    return; // Skip this item
                }

                // Now use the shared getDisplayName utility since we know the instance exists.
                const displayName = getDisplayName(itemInstance);
                // --- END REFACTOR: Ticket 11 ---

                // Format: - Name
                messageText += `  - ${displayName}\n`;
            });
            // Remove trailing newline if items were listed
            if (itemIds.length > 0) messageText = messageText.trimEnd();
        }
    } else {
        messageText += "\nCarrying: (N/A - No Inventory Component)";
    }

    // Dispatch the combined message
    dispatch('ui:message_display', {text: messageText, type: 'info'});
    messages.push({text: `Displayed inventory and equipment.`, type: 'internal'}); // Simplified internal message

    return {success: true, messages, newState: undefined};
}

// Helper to capitalize slot names (unchanged)
function capitalize(s) {
    if (typeof s !== 'string' || s.length === 0) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
}