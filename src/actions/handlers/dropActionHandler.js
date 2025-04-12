// src/actions/handlers/dropActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

// Keep InventoryComponent for the initial check
import {InventoryComponent} from '../../components/inventoryComponent.js';
// PositionComponent and notifyPositionChange are removed from direct use here
// import {PositionComponent} from '../../components/positionComponent.js';
import {TARGET_MESSAGES} from '../../utils/messages.js'; // getDisplayName removed
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {ItemComponent} from "../../components/itemComponent.js";
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'drop' action ('core:action_drop'). Allows the player to attempt
 * to drop items from their inventory into the current location by dispatching
 * an event for a system to handle the actual state changes.
 * Refactored to use parsedCommand based on Ticket 9.3.1.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action attempt.
 */
export function executeDrop(context) {
    // Ticket 9.3.1: Remove 'targets', add 'parsedCommand'
    const {playerEntity, currentLocation, dispatch, parsedCommand} = context; // entityManager removed from direct use
    const messages = [];
    const internalErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR;

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
    // Ticket 9.3.1: Ensure this validation uses 'directObjectPhrase'
    if (!validateRequiredCommandPart(context, 'drop', 'directObjectPhrase')) { // [cite: file:handlers/dropActionHandler.js]
        // Validation failed, message dispatched by utility
        return {success: false, messages: [], newState: undefined};
    }
    messages.push({text: `Required command part validated for 'drop'.`, type: 'internal'});

    // Ticket 9.3.1: Assign targetName from parsedCommand, remove targets.join(' ')
    const targetName = parsedCommand.directObjectPhrase;
    messages.push({text: `Target name from parsed command: '${targetName}'.`, type: 'internal'});


    // --- Get Player Inventory ---
    const playerInventory = playerEntity.getComponent(InventoryComponent);
    if (!playerInventory) {
        const componentErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: componentErrorMsg, type: 'error'});
        console.error("executeDrop: Player entity missing InventoryComponent.");
        return {success: false, messages: [{text: componentErrorMsg, type: 'error'}]};
    }
    messages.push({text: `Player inventory component found.`, type: 'internal'});

    // --- 1. Resolve Target Item using Service ---
    // Ticket 9.3.1: Ensure resolved target uses targetName from parsedCommand
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        actionVerb: 'drop',
        targetName: targetName, // Pass the name derived from parsedCommand [cite: file:handlers/dropActionHandler.js]
        notFoundMessageKey: 'NOT_FOUND_INVENTORY'
    });

    // --- 2. Handle Resolver Result ---
    if (!targetItemEntity) {
        // Failure message already dispatched by resolveTargetEntity
        messages.push({text: `Item resolution failed for target '${targetName}'.`, type: 'internal'});
        return {success: false, messages: messages}; // Return failure, include internal logs
    }
    messages.push({text: `Resolved target '${targetName}' to item ${targetItemEntity.id}.`, type: 'internal'});


    // --- 3. Validation Success - Dispatch Event for System Handling ---
    const targetItemId = targetItemEntity.id;
    const playerId = playerEntity.id;
    const locationId = currentLocation.id;

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
    } catch (e) {
        // Log a critical error if dispatch fails, as the action cannot proceed.
        console.error("executeDrop: CRITICAL - Failed to dispatch event:item_drop_attempted:", e);
        // Provide an internal error message to the user, as the action failed unexpectedly.
        dispatch('ui:message_display', {text: internalErrorMsg, type: 'error'});
        messages.push({
            text: `CRITICAL: Failed to dispatch event:item_drop_attempted. Error: ${e.message}`,
            type: 'error'
        });
        // Return failure because the core mechanism (event dispatch) failed.
        return {success: false, messages: messages};
    }

    // --- Return Success (Validation passed, event dispatched) ---
    // The action handler's job is done; success means the attempt was valid and initiated.
    // The actual outcome depends on the system processing the event.
    return {
        success: true,
        messages: messages, // Include internal logs for debugging/tracing
        newState: undefined // No direct state change here
    };
}