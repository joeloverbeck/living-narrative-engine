// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../types/eventTypes.js').ItemPickedUpEventPayload} ItemPickedUpEventPayload */

// --- Standard Imports ---
import {ItemComponent} from "../../components/itemComponent.js";
// Import PositionComponent for location fallback
import {PositionComponent} from '../../components/positionComponent.js';
// Removed resolveTargetEntity and validateRequiredCommandPart as they are handled by the utility

// --- Refactored Imports ---
// AC 1: Import Utilities
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {TARGET_MESSAGES, getDisplayName} from "../../utils/messages.js";
import {EVENT_ITEM_PICKED_UP} from "../../types/eventTypes";

/**
 * Handles the 'take' action ('core:take'). Allows the player to attempt
 * to pick up items from the current location.
 * Refactored to use handleActionWithTargetResolution and dispatchEventWithCatch.
 * @param {ActionContext} context - The context for the action.
 * @returns {Promise<ActionResult>} The result of the action attempt.
 */
export async function executeTake(context) {
    const {playerEntity, currentLocation, dispatch} = context; // dispatch needed for initial checks & onFoundUnique

    // --- Basic Validation ---
    if (!playerEntity) {
        console.error("executeTake: Missing player in context.");
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: [{text: "Critical: Missing player entity.", type: 'internal_error'}]};
    }
    // Get location ID safely, falling back to PositionComponent
    const playerPos = playerEntity.getComponent(PositionComponent);
    const locationId = currentLocation?.id ?? playerPos?.locationId;
    if (!locationId) {
        console.error("executeTake: Missing location in context and player position component.");
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: [{text: "Critical: Missing location ID.", type: 'internal_error'}]};
    }
    // No need to check InventoryComponent here, handleAction... does scope validation internally

    /**
     * AC 3: Implement onFoundUnique Callback
     * Callback executed when a unique item is found in the location.
     * @param {ActionContext} innerContext - The action context passed through.
     * @param {Entity} targetItemEntity - The uniquely resolved item entity.
     * @param {ActionMessage[]} messages - The array of messages accumulated so far by handleActionWithTargetResolution.
     * @returns {ActionResult} - The result of the take attempt dispatch.
     */
    const onFoundUnique = (innerContext, targetItemEntity, messages) => {
        const targetItemId = targetItemEntity.id;
        const pickerId = innerContext.playerEntity.id;
        const itemName = getDisplayName(targetItemEntity); // For logging and events

        // AC 4: Use dispatchEventWithCatch inside callback for EVENT_ITEM_PICKED_UP
        /** @type {ItemPickedUpEventPayload} */
        const eventPayload = {
            pickerId: pickerId,
            itemId: targetItemId,
            locationId: locationId // Use locationId determined earlier
        };

        const dispatchResult = dispatchEventWithCatch(
            innerContext,
            EVENT_ITEM_PICKED_UP, // The core game event
            eventPayload,
            messages, // Pass messages array for internal logging from the utility
            {
                success: `Dispatched ${EVENT_ITEM_PICKED_UP} for ${itemName} (${targetItemId}) from location ${locationId}`,
                errorUser: TARGET_MESSAGES.INTERNAL_ERROR, // User message on dispatch failure
                errorInternal: `Failed to dispatch ${EVENT_ITEM_PICKED_UP} for ${itemName} (${targetItemId}) from location ${locationId}.` // Internal log on failure
            }
        );

        // AC 5: Handle Success/Failure Feedback
        if (dispatchResult.success) {
            // Dispatch semantic SUCCESS event
            // Using innerContext.dispatch directly as dispatchEventWithCatch is mainly for the core event.
            try {
                innerContext.dispatch('action:take_succeeded', {
                    actorId: pickerId,
                    itemId: targetItemId,
                    itemName: itemName,
                    locationId: locationId
                });
                messages.push({
                    text: `Dispatched action:take_succeeded for ${itemName} (${targetItemId})`,
                    type: 'internal'
                });
            } catch (semanticError) {
                console.error(`executeTake (onFoundUnique): Failed to dispatch action:take_succeeded for ${itemName}:`, semanticError);
                messages.push({
                    text: `Failed to dispatch semantic success event for ${itemName}.`,
                    type: 'internal_error'
                });
                // Continue as success=true because the core action succeeded.
            }
        } else {
            // dispatchEventWithCatch already handled UI feedback and console logging.
            // Dispatch semantic FAILURE event.
            try {
                innerContext.dispatch('action:take_failed', {
                    actorId: pickerId,
                    // Use original target name from command if available, else resolved name
                    targetName: innerContext.parsedCommand.directObjectPhrase || itemName,
                    reasonCode: 'INTERNAL_PICKUP_ERROR', // Indicate failure during event dispatch
                    locationId: locationId,
                    details: `Failed to dispatch ${EVENT_ITEM_PICKED_UP} for ${itemName}` // Pass limited details
                });
                messages.push({
                    text: `Dispatched action:take_failed for ${itemName} due to pickup event dispatch error`,
                    type: 'internal'
                });
            } catch (semanticError) {
                console.error(`executeTake (onFoundUnique): Failed to dispatch action:take_failed for ${itemName}:`, semanticError);
                messages.push({
                    text: `Failed to dispatch semantic failure event for ${itemName}.`,
                    type: 'internal_error'
                });
            }
        }

        // AC 6: Return correct ActionResult
        // The success field reflects the success of the core game event dispatch.
        // Messages are mutated directly by dispatchEventWithCatch, return empty array here.
        return {
            success: dispatchResult.success,
            messages: [],
            newState: undefined
        };
    };

    // --- Configure and Call handleActionWithTargetResolution ---
    /** @type {HandleActionWithOptions} */
    const options = {
        // AC 2: Call handleActionWithTargetResolution with correct options
        scope: 'location_items',             // Scope: Check items in the current location
        requiredComponents: [ItemComponent], // Must be an item
        commandPart: 'directObjectPhrase',   // Get item name from DO
        actionVerb: 'take',                  // Action verb for messages
        onFoundUnique: onFoundUnique,        // The callback defined above
        failureMessages: {
            // Override defaults to use specific 'take' messages from original handler
            notFound: TARGET_MESSAGES.NOT_FOUND_TAKEABLE,
            filterEmpty: TARGET_MESSAGES.TAKE_EMPTY_LOCATION,
            // AMBIGUOUS and INVALID_INPUT will use standard defaults unless overridden
        },
    };

    // AC 7: Original switch statement removed
    // AC 8: Functionality preservation checked via AC implementation
    // The main body is now just the call to the utility function.
    return await handleActionWithTargetResolution(context, options);
}