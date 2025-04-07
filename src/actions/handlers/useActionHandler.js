// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_use' action. Dispatches messages via context.dispatch.
 * Placeholder implementation.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeUse(context) {
    // Destructure context, including dispatch
    const {targets, dispatch} = context;
    const messages = []; // Keep for potential non-UI use
    let success = false; // Placeholder

    if (targets.length === 0) {
        const errorMsg = "Use what?";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'}); // Optional retain
    } else {
        const itemName = targets.join(' ');
        const tryMsg = `(Placeholder) You use the ${itemName}...`;
        const notImplMsg = "Using items not fully implemented.";

        dispatch('ui:message_display', {text: tryMsg, type: 'info'});
        dispatch('ui:message_display', {text: notImplMsg, type: 'warning'});
        messages.push({text: tryMsg, type: 'info'}); // Optional retain
        messages.push({text: notImplMsg, type: 'warning'}); // Optional retain
        // TODO: Implement logic: find item in inventory, check if usable, apply effect (heal, unlock, etc.), potentially consume item
    }
    return {success, messages};
}