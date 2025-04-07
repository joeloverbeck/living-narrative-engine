// src/actions/handlers/inventoryActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {NameComponent} from '../../components/nameComponent.js';

// Import type definition JSDoc comments
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_inventory' action. Dispatches messages via context.dispatch.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeInventory(context) {
    // Destructure context, including dispatch
    const {playerEntity, entityManager, dispatch} = context;
    const messages = []; // Keep for potential non-UI use
    let success = true; // Checking inventory always succeeds

    const checkingMsg = "You check your inventory...";
    dispatch('ui:message_display', {text: checkingMsg, type: 'info'});
    messages.push({text: checkingMsg, type: 'info'}); // Optional retain

    const invComp = playerEntity.getComponent(InventoryComponent);
    if (invComp && Array.isArray(invComp.items) && invComp.items.length > 0) {
        let invListText = "You are carrying:\n"; // Use \n for potential console display, HTML for DOM
        let invListHtml = "<p>You are carrying:</p><ul>"; // Prepare HTML version for UI event

        const itemDetails = invComp.items.map(itemId => {
            const itemEntity = entityManager.getEntityInstance(itemId);
            const nameComp = itemEntity?.getComponent(NameComponent);
            const name = nameComp ? nameComp.value : itemId;
            return {name: name, id: itemId}; // Keep both for flexibility
        });

        invListText += itemDetails.map(item => `- ${item.name}`).join('\n');
        invListHtml += itemDetails.map(item => `<li>${item.name}</li>`).join('');
        invListHtml += "</ul>";

        dispatch('ui:message_display', {text: invListHtml, type: 'inventory-list'}); // Send HTML version to UI
        messages.push({text: invListText, type: 'info'}); // Keep text version in result

    } else {
        const emptyMsg = "Your inventory is empty.";
        dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        messages.push({text: emptyMsg, type: 'info'}); // Optional retain
    }

    return {success, messages}; // No newState change
}