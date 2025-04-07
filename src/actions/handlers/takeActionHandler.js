// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_take' action. Dispatches messages via context.dispatch.
 * Placeholder implementation.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeTake(context) {
    // Destructure context, including dispatch
    const {targets, dispatch} = context;
    const messages = []; // Keep for potential non-UI use
    let success = false; // Placeholder: Assume failure until implemented

    if (targets.length === 0) {
        const errorMsg = "Take what?";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'}); // Optional retain
    } else {
        const itemName = targets.join(' ');
        const tryMsg = `(Placeholder) You try to take the ${itemName}...`;
        const notImplMsg = "Taking items not fully implemented.";

        dispatch('ui:message_display', {text: tryMsg, type: 'info'});
        dispatch('ui:message_display', {text: notImplMsg, type: 'warning'});
        messages.push({text: tryMsg, type: 'info'}); // Optional retain
        messages.push({text: notImplMsg, type: 'warning'}); // Optional retain
        // TODO: Implement logic: find item in room, check weight/capacity, add to player inv, remove from room
    }
    return {success, messages};
}