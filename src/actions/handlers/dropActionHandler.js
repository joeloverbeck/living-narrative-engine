// src/actions/handlers/dropActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- Standard Imports ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from "../../components/itemComponent.js";
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// --- Refactored Imports ---
import {TARGET_MESSAGES} from '../../utils/messages.js'; // Import TARGET_MESSAGES

/**
 * Handles the 'drop' action ('core:drop'). Allows the player to attempt
 * to drop items from their inventory into the current location by dispatching
 * an event for a system to handle the actual state changes.
 * Uses the updated resolveTargetEntity service.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action attempt.
 */
export function executeDrop(context) {
    const {playerEntity, currentLocation, dispatch, parsedCommand} = context;
    const messages = [];
    const internalErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR; // Keep for critical errors

    // --- Basic Validation ---
    if (!playerEntity || !currentLocation) {
        console.error("executeDrop: Missing player or location in context.");
        dispatch('ui:message_display', {text: internalErrorMsg, type: 'error'});
        return {success: false, messages: [{text: internalErrorMsg, type: 'error'}]};
    }
    messages.push({
        text: `Context validated: Player ${playerEntity.id}, Location ${currentLocation.id}`,
        type: 'internal'
    });

    // --- Validate required command part ---
    if (!validateRequiredCommandPart(context, 'drop', 'directObjectPhrase')) {
        // Validation failed, message dispatched by utility
        return {success: false, messages: [], newState: undefined};
    }
    messages.push({text: `Required command part validated for 'drop'.`, type: 'internal'});

    const targetName = parsedCommand.directObjectPhrase;
    messages.push({text: `Target name from parsed command: '${targetName}'.`, type: 'internal'});

    // --- Get Player Inventory (Check existence) ---
    const playerInventory = playerEntity.getComponent(InventoryComponent);
    if (!playerInventory) {
        const componentErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: componentErrorMsg, type: 'error'});
        console.error("executeDrop: Player entity missing InventoryComponent.");
        return {success: false, messages: [{text: componentErrorMsg, type: 'error'}]};
    }
    // No need to check if empty here, FILTER_EMPTY status will handle it
    messages.push({text: `Player inventory component found.`, type: 'internal'});

    // --- 1. Resolve Target Item using Service ---
    // Removed notFoundMessageKey
    const resolution = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        // actionVerb: 'drop', // Kept for potential future use
        targetName: targetName,
    });

    // --- 2. Handle Resolver Result ---
    switch (resolution.status) {
        case 'FOUND_UNIQUE': {
            const targetItemEntity = resolution.entity;
            const targetItemId = targetItemEntity.id;
            const playerId = playerEntity.id;
            const locationId = currentLocation.id;

            messages.push({text: `Resolved target '${targetName}' to item ${targetItemId}.`, type: 'internal'});

            // --- 3. Validation Success - Dispatch Event for System Handling ---
            try {
                dispatch('event:item_drop_attempted', {
                    playerId: playerId,
                    itemInstanceId: targetItemId,
                    locationId: locationId
                });
                messages.push({
                    text: `Dispatched event:item_drop_attempted for player ${playerId}, item ${targetItemId}, location ${locationId}`,
                    type: 'internal'
                });
                // Return success (validation passed, event dispatched)
                return {success: true, messages: messages, newState: undefined};
            } catch (e) {
                // Log critical error if dispatch fails
                console.error("executeDrop: CRITICAL - Failed to dispatch event:item_drop_attempted:", e);
                // Provide an internal error message to the user
                dispatch('ui:message_display', {text: internalErrorMsg, type: 'error'});
                messages.push({
                    text: `CRITICAL: Failed to dispatch event:item_drop_attempted. Error: ${e.message}`,
                    type: 'error'
                });
                // Return failure
                return {success: false, messages: messages};
            }
        }

        case 'NOT_FOUND':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOT_FOUND_INVENTORY(targetName), type: 'info'});
            messages.push({
                text: `Item resolution failed for target '${targetName}', reason: NOT_FOUND.`,
                type: 'internal'
            });
            return {success: false, messages: messages};

        case 'AMBIGUOUS':
            const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('drop', targetName, resolution.candidates);
            dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
            messages.push({
                text: `Item resolution failed for target '${targetName}', reason: AMBIGUOUS.`,
                type: 'internal'
            });
            return {success: false, messages: messages};

        case 'FILTER_EMPTY':
            // Inventory is empty or contains no items matching ItemComponent (shouldn't happen if inventory exists)
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
            messages.push({
                text: `Item resolution failed for target '${targetName}', reason: FILTER_EMPTY (Inventory empty).`,
                type: 'internal'
            });
            return {success: false, messages: messages};

        case 'INVALID_INPUT':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            messages.push({
                text: `Item resolution failed for target '${targetName}', reason: INVALID_INPUT.`,
                type: 'internal_error'
            });
            console.error(`executeDrop: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
            return {success: false, messages: messages};

        default:
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            console.error(`executeDrop: Unhandled resolution status: ${resolution.status}`);
            messages.push({text: `Unhandled status: ${resolution.status}`, type: 'internal_error'});
            return {success: false, messages};
    }
}