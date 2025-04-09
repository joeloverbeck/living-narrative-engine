// src/actions/handlers/moveActionHandler.js

import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {TARGET_MESSAGES} from '../../utils/messages.js'; // Import TARGET_MESSAGES
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

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
    const messages = []; // Keep for potential logging/testing
    let success = false;

    // --- 1. Initial Validations ---
    if (!currentLocation) {
        // ***** MODIFIED: Use TARGET_MESSAGES *****
        const errorMsg = TARGET_MESSAGES.MOVE_LOCATION_UNKNOWN;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error("executeMove handler called with invalid currentLocation in context.");
        return {success, messages};
    }

    // --- Validate required target (direction) ---
    // Use specific verb/prompt if desired, or a generic one. 'move' implies direction.
    // Relies on validateRequiredTargets to use TARGET_MESSAGES.PROMPT_WHAT internally.
    if (!validateRequiredTargets(context, 'move')) {
        // No change needed here, assumes validateRequiredTargets is compliant.
        return {success: false, messages: [], newState: undefined};
    }

    // --- 2. Get Player's Position Component ---
    const playerPositionComp = playerEntity.getComponent(PositionComponent);
    if (!playerPositionComp) {
        // ***** MODIFIED: Use TARGET_MESSAGES *****
        const errorMsg = TARGET_MESSAGES.MOVE_POSITION_UNKNOWN;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error(`executeMove: Player entity ${playerEntity.id} is missing PositionComponent.`);
        return {success, messages};
    }
    const previousLocationId = playerPositionComp.locationId;

    if (previousLocationId !== currentLocation.id) {
        console.warn(`executeMove: Discrepancy between player PositionComponent location (${previousLocationId}) and context currentLocation (${currentLocation.id}). Proceeding based on context.`);
    }

    // --- 3. Process Direction and Connection ---
    const direction = targets[0].toLowerCase();

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp || !Array.isArray(connectionsComp.connections) || connectionsComp.connections.length === 0) {
        // ***** VERIFIED: Already uses TARGET_MESSAGES *****
        const infoMsg = TARGET_MESSAGES.MOVE_NO_EXITS;
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        return {success, messages}; // Not a failure, just no exits
    }

    const connection = connectionsComp.getConnection(direction);

    // --- 4. Handle Connection Result and Validation ---
    if (connection) {
        const currentState = connection.state ?? connection.initial_state;
        if (currentState === 'locked') {
            // ***** VERIFIED: Already uses TARGET_MESSAGES with override logic *****
            const lockMessage = connection.description_override || TARGET_MESSAGES.MOVE_LOCKED(direction);
            dispatch('ui:message_display', {text: lockMessage, type: 'info'});
            messages.push({text: lockMessage, type: 'info'});
            return {success, messages}; // Not a success, but not necessarily an error state
        }

        const targetLocationId = connection.target;
        if (!targetLocationId) {
            // ***** VERIFIED: Already uses TARGET_MESSAGES with parameter *****
            const errorMsg = TARGET_MESSAGES.MOVE_INVALID_CONNECTION(direction);
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error(`Invalid connection data in ${currentLocation.id} for direction ${direction}: missing target.`);
            return {success, messages};
        }

        const targetDefinition = dataManager.getEntityDefinition(targetLocationId);
        if (targetDefinition) {
            // --- Validation Passed - Dispatch Event ---
            try {
                const moveAttemptPayload = {
                    entityId: playerEntity.id,
                    targetLocationId: targetLocationId,
                    direction: direction,
                    previousLocationId: previousLocationId
                };
                dispatch('event:move_attempted', moveAttemptPayload);
                success = true;
                // ***** VERIFIED: Initial success message kept as hardcoded per ticket suggestion *****
                const infoMsg = `You move ${direction}.`; // Initial feedback
                dispatch('ui:message_display', {text: infoMsg, type: 'info'});
                messages.push({text: infoMsg, type: 'info'});
                console.log(`executeMove: Dispatched event:move_attempted for entity ${playerEntity.id} to ${targetLocationId} (direction: ${direction})`);
            } catch (error) {
                // Keep internal error handling as is, not typically a TARGET_MESSAGE scenario
                const errorMsg = `Error preparing move attempt: ${error.message}`;
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: errorMsg, type: 'error'});
                console.error(`executeMove: Failed to dispatch move attempt event for ${playerEntity.id} moving to ${targetLocationId}`, error);
                success = false;
            }

        } else {
            // ***** VERIFIED: Already uses TARGET_MESSAGES with parameter *****
            const errorMsg = TARGET_MESSAGES.MOVE_BAD_TARGET_DEF(direction);
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error(`Move handler validation failed: Target location definition not found via dataManager for ID: ${targetLocationId}`);
            // success remains false
        }
    } else {
        // ***** VERIFIED: Already uses TARGET_MESSAGES *****
        const infoMsg = TARGET_MESSAGES.MOVE_CANNOT_GO_WAY;
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        // success remains false
    }

    // --- 5. Return Result ---
    return {success, messages};
}