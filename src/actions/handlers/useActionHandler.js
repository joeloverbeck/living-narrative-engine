// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_use' action.
 * Allows the player to use items from their inventory.
 * Relies solely on the provided context. Modifies component state (player health, item count)
 * but does NOT modify GameLoop's core state, so newState is undefined.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeUse(context) {
    const { targets } = context;
    const messages = [];
    let success = false; // Placeholder

    if (targets.length === 0) {
        messages.push({ text: "Use what?", type: 'error' });
    } else {
        const itemName = targets.join(' ');
        messages.push({ text: `(Placeholder) You use the ${itemName}...`, type: 'info' });
        messages.push({ text: "Using items not fully implemented.", type: 'warning' });
        // TODO: Implement logic: find item in inventory, check if usable, apply effect (heal, unlock, etc.), potentially consume item
    }
    return { success, messages };
}