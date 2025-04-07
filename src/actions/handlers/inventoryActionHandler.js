// src/actions/handlers/inventoryActionHandler.js

import { InventoryComponent } from '../../components/inventoryComponent.js';
import { NameComponent } from '../../components/nameComponent.js';

// Import type definition JSDoc comments
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_inventory' action.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeInventory(context) {
    const { playerEntity, entityManager } = context;
    const messages = [];
    let success = true; // Checking inventory always succeeds

    messages.push({ text: "You check your inventory...", type: 'info' });

    const invComp = playerEntity.getComponent(InventoryComponent);
    if (invComp && Array.isArray(invComp.items) && invComp.items.length > 0) {
        let invList = "You are carrying:\n";
        const itemNames = invComp.items.map(itemId => {
            // Attempt to get the entity instance for the item ID
            const itemEntity = entityManager.getEntityInstance(itemId);
            // If instance exists and has a NameComponent, use its value, otherwise fallback to ID
            const nameComp = itemEntity?.getComponent(NameComponent);
            return nameComp ? nameComp.value : itemId;
        });
        invList += itemNames.map(name => `- ${name}`).join('\n');
        messages.push({ text: invList, type: 'info' }); // Use 'info' or a dedicated 'inventory' type

    } else {
        messages.push({ text: "Your inventory is empty.", type: 'info' });
    }

    return { success, messages }; // No newState change
}