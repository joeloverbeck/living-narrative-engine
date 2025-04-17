// src/actions/handlers/dropActionHandler.js

// --- Core Components ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from "../../components/itemComponent.js"; // AC: Imported
import {PositionComponent} from '../../components/positionComponent.js'; // Needed for currentLocationId if context missing

// --- Utilities and Services ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
// AC: Import required utilities
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {EVENT_DISPLAY_MESSAGE, EVENT_ITEM_DROP_ATTEMPTED} from "../../types/eventTypes.js";

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/** @typedef {import('../../types/eventTypes.js').ItemDropAttemptedEventPayload} ItemDropAttemptedEventPayload */

/**
 * Handles the 'drop' action ('core:drop'). Allows the player to attempt
 * to drop items from their inventory into the current location by dispatching
 * an event for a system to handle the actual state changes.
 * Refactored to use handleActionWithTargetResolution and dispatchEventWithCatch.
 * @param {ActionContext} context - The context for the action.
 * @returns {Promise<ActionResult>} The result of the action attempt.
 */
export async function executeDrop(context) {
    const {playerEntity, currentLocation, dispatch} = context; // dispatch needed for onFoundUnique

    // --- Basic Validation ---
    if (!playerEntity) {
        console.error("executeDrop: Missing player in context.");
        // Keep dispatch for critical errors, though handleAction... often covers user feedback
        dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: [{text: "Critical: Missing player entity.", type: 'internal_error'}]};
    }
    // Get location ID safely
    const playerPos = playerEntity.getComponent(PositionComponent);
    const locationId = currentLocation?.id ?? playerPos?.locationId;
    if (!locationId) {
        console.error("executeDrop: Missing location in context and player position component.");
        dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: [{text: "Critical: Missing location ID.", type: 'internal_error'}]};
    }
    // Check for Inventory Component early - handleAction requires valid scope context
    if (!playerEntity.hasComponent(InventoryComponent)) {
        const componentErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch(EVENT_DISPLAY_MESSAGE, {text: componentErrorMsg, type: 'error'});
        console.error("executeDrop: Player entity missing InventoryComponent.");
        return {success: false, messages: [{text: "Player missing InventoryComponent.", type: 'internal_error'}]};
    }


    /**
     * Callback executed when a unique item is found in the inventory.
     * @param {ActionContext} innerContext - The action context passed through.
     * @param {Entity} targetItemEntity - The uniquely resolved item entity.
     * @param {ActionMessage[]} messages - The array of messages accumulated so far by handleActionWithTargetResolution.
     * @returns {ActionResult} - The result of the drop attempt dispatch.
     */
    const onFoundUnique = (innerContext, targetItemEntity, messages) => {
        const targetItemId = targetItemEntity.id;
        const playerId = innerContext.playerEntity.id;
        const itemDisplayName = getDisplayName(targetItemEntity); // For logging

        // AC: Uses dispatchEventWithCatch inside callback for EVENT_ITEM_DROP_ATTEMPTED
        /** @type {ItemDropAttemptedEventPayload} */
        const eventPayload = {
            playerId: playerId,
            itemInstanceId: targetItemId,
            locationId: locationId // Use locationId determined earlier
        };

        const dispatchResult = dispatchEventWithCatch(
            innerContext,
            EVENT_ITEM_DROP_ATTEMPTED,
            eventPayload,
            messages, // Pass messages array for internal logging
            {
                success: `Dispatched ${EVENT_ITEM_DROP_ATTEMPTED} for ${itemDisplayName} (${targetItemId}) to location ${locationId}`,
                errorUser: TARGET_MESSAGES.INTERNAL_ERROR, // User message on dispatch failure
                errorInternal: `Failed to dispatch ${EVENT_ITEM_DROP_ATTEMPTED} for ${itemDisplayName} (${targetItemId}) to location ${locationId}.` // Internal log on failure
            }
        );

        // AC: Callback returns correct ActionResult
        // handleActionWithTargetResolution will combine messages.
        return {
            success: dispatchResult.success,
            messages: [], // Messages are mutated directly by dispatchEventWithCatch
            newState: undefined
        };
    };

    // --- Configure and Call handleActionWithTargetResolution ---
    /** @type {HandleActionWithOptions} */
    const options = {
        // AC: Imports and calls handleActionWithTargetResolution with correct options
        scope: 'inventory',                     // Scope: Check player's inventory
        requiredComponents: [ItemComponent],    // Must be an item
        commandPart: 'directObjectPhrase',      // Get item name from DO
        actionVerb: 'drop',                     // Action verb for messages
        onFoundUnique: onFoundUnique,           // AC: Original FOUND_UNIQUE logic moved to callback
        // Failure messages use defaults from TARGET_MESSAGES (NOT_FOUND_INVENTORY, AMBIGUOUS_PROMPT, SCOPE_EMPTY_PERSONAL -> NOTHING_CARRIED)
        // No custom overrides needed here unless specific wording is desired.
    };

    // AC: Resolution switch statement removed
    return await handleActionWithTargetResolution(context, options);
}