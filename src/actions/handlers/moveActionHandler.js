// src/actions/handlers/moveActionHandler.js

import {ConnectionsComponent} from '../../components/connectionsComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */ // Keep for structure

/**
 * Handles the 'core:action_move' action.
 * Relies solely on the provided context. Dispatches messages via context.dispatch.
 * Signals a location change back to GameLoop via `ActionResult.newState`.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeMove(context) {
    // Destructure context, including dispatch
    const {playerEntity, currentLocation, targets, dataManager, entityManager, dispatch} = context;
    const messages = []; // Keep for potential logging/testing, but UI uses dispatch
    let success = false;
    let newState = undefined;

    if (!currentLocation) {
        const errorMsg = "Cannot move: your current location is unknown.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'}); // Optional: keep for return value
        console.error("executeMove handler called with invalid currentLocation in context.");
        return {success, messages, newState};
    }

    if (targets.length === 0) {
        const errorMsg = "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success, messages, newState};
    }

    const direction = targets[0].toLowerCase();

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp || !Array.isArray(connectionsComp.connections) || connectionsComp.connections.length === 0) {
        const infoMsg = "There are no obvious exits from here.";
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        return {success, messages, newState};
    }

    // Use the component's method to find the connection
    const connection = connectionsComp.getConnection(direction);


    if (connection) {
        // Check the current runtime state of the connection.
        // Prioritize `state`, fall back to `initial_state` if `state` is not set yet.
        const currentState = connection.state ?? connection.initial_state;
        if (currentState === 'locked') {
            // Use description_override if available and seems relevant to the locked state, else use generic message.
            const lockMessage = connection.description_override || `The way ${direction} is locked.`;
            dispatch('ui:message_display', {text: lockMessage, type: 'info'});
            messages.push({text: lockMessage, type: 'info'});
            // success remains false, return early
            return {success, messages, newState};
        }
        // Add checks for other potential blocking states if needed (e.g., 'blocked')
        // if (currentState === 'blocked') { ... }

        const targetLocationId = connection.target;
        if (!targetLocationId) {
            const errorMsg = `The way ${direction} seems improperly constructed.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error(`Invalid connection data in ${currentLocation.id} for direction ${direction}: missing target.`);
            return {success, messages, newState};
        }

        // --- Check target definition *after* lock check ---
        const targetDefinition = dataManager.getEntityDefinition(targetLocationId);
        if (targetDefinition) {
            success = true;
            const infoMsg = `You move ${direction}.`;
            dispatch('ui:message_display', {text: infoMsg, type: 'info'});
            messages.push({text: infoMsg, type: 'info'});
            newState = {currentLocationId: targetLocationId};
        } else {
            const errorMsg = `Something is wrong with the passage leading ${direction}.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error(`Move handler failed: Target location definition not found via dataManager for ID: ${targetLocationId}`);
            // success remains false
        }
    } else {
        const infoMsg = "You can't go that way.";
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        // success remains false
    }

    // Return the complete ActionResult (messages array might be less important now)
    return {success, messages, newState};
}