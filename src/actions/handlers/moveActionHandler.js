// src/actions/handlers/moveActionHandler.js

import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */ // Keep for structure

/**
 * Handles the 'core:action_move' action.
 * Validates the player's intent to move and emits an 'event:move_attempted' if valid.
 * Does NOT modify player position directly. Relies on a MovementSystem to handle the event.
 * Relies solely on the provided context. Dispatches UI messages via context.dispatch.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action validation (success/fail, messages).
 */
export function executeMove(context) {
    // Destructure context, including dispatch
    const {playerEntity, currentLocation, targets, dataManager, entityManager, dispatch} = context;
    const messages = []; // Keep for potential logging/testing, but UI uses dispatch
    let success = false;

    // --- 1. Initial Validations ---
    if (!currentLocation) {
        const errorMsg = "Cannot move: your current location is unknown.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error("executeMove handler called with invalid currentLocation in context.");
        return {success, messages};
    }

    if (!targets || targets.length === 0) {
        const errorMsg = "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success, messages};
    }

    // --- 2. Get Player's Position Component (Required for Validation and Event Payload) ---
    const playerPositionComp = playerEntity.getComponent(PositionComponent);
    if (!playerPositionComp) {
        const errorMsg = "Cannot move: Your position is unknown (Missing PositionComponent).";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error(`executeMove: Player entity ${playerEntity.id} is missing PositionComponent.`);
        return {success, messages};
    }
    // Capture the current location ID *before* any potential (but now removed) changes
    const previousLocationId = playerPositionComp.locationId;

    // Verify current location ID consistency
    if (previousLocationId !== currentLocation.id) {
        console.warn(`executeMove: Discrepancy between player PositionComponent location (${previousLocationId}) and context currentLocation (${currentLocation.id}). Proceeding based on context.`);
        // Potentially dispatch an error or rely on context location? For now, proceed using context location ID as authoritative 'previous' ID if needed.
        // Using playerPositionComp.locationId for the event payload as it reflects the entity's state.
    }

    // --- 3. Process Direction and Connection ---
    const direction = targets[0].toLowerCase();

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp || !Array.isArray(connectionsComp.connections) || connectionsComp.connections.length === 0) {
        const infoMsg = "There are no obvious exits from here.";
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        return {success, messages};
    }

    const connection = connectionsComp.getConnection(direction);

    // --- 4. Handle Connection Result and Validation ---
    if (connection) {
        // Check connection state (locked, etc.)
        const currentState = connection.state ?? connection.initial_state;
        if (currentState === 'locked') {
            const lockMessage = connection.description_override || `The way ${direction} is locked.`;
            dispatch('ui:message_display', {text: lockMessage, type: 'info'});
            messages.push({text: lockMessage, type: 'info'});
            // success remains false
            return {success, messages};
        }
        // Add checks for other blocking states if needed ('blocked', 'hidden', etc.)

        const targetLocationId = connection.target;
        if (!targetLocationId) {
            const errorMsg = `The way ${direction} seems improperly constructed.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error(`Invalid connection data in ${currentLocation.id} for direction ${direction}: missing target.`);
            return {success, messages};
        }

        // Check if the target location definition exists *before* declaring the attempt valid
        const targetDefinition = dataManager.getEntityDefinition(targetLocationId);
        if (targetDefinition) {
            // --- Core Refactor: Validation Passed - Dispatch Event ---
            try {
                // 1. Construct the event payload
                const moveAttemptPayload = {
                    entityId: playerEntity.id,
                    targetLocationId: targetLocationId,
                    direction: direction,
                    previousLocationId: previousLocationId // Use the location ID captured earlier
                };

                // 2. Dispatch the event:move_attempted event
                dispatch('event:move_attempted', moveAttemptPayload);

                // 3. Set success and provide *initial* feedback (MovementSystem might provide final confirmation)
                success = true;
                // Keep UI message dispatch here for now as per ticket MOVE-01
                const infoMsg = `You move ${direction}.`;
                dispatch('ui:message_display', {text: infoMsg, type: 'info'});
                messages.push({text: infoMsg, type: 'info'}); // For logging/testing

                console.log(`executeMove: Dispatched event:move_attempted for entity ${playerEntity.id} to ${targetLocationId} (direction: ${direction})`);
            } catch (error) {
                // Handle potential errors during event dispatch (unlikely but possible)
                const errorMsg = `Error preparing move attempt: ${error.message}`;
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: errorMsg, type: 'error'});
                console.error(`executeMove: Failed to dispatch move attempt event for ${playerEntity.id} moving to ${targetLocationId}`, error);
                success = false; // Ensure failure if the dispatch process fails
            }

        } else {
            // Target location definition doesn't exist
            const errorMsg = `Something is wrong with the passage leading ${direction}.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error(`Move handler validation failed: Target location definition not found via dataManager for ID: ${targetLocationId}`);
            // success remains false
        }
    } else {
        // No connection found for the specified direction
        const infoMsg = "You can't go that way.";
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        // success remains false
    }

    // --- 5. Return Result ---
    // Note: The `messages` array contains copies of dispatched messages, mainly for logging/testing.
    // Success now indicates if the *attempt* was deemed valid and an event was dispatched.
    return {success, messages};
}