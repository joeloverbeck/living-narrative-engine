// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../types/eventTypes.js').ItemPickedUpEventPayload} ItemPickedUpEventPayload */

// --- Standard Imports ---
import {ItemComponent} from "../../components/itemComponent.js";
// Import PositionComponent for location fallback (if needed, context should provide location)
// import { PositionComponent } from '../../components/positionComponent.js';

// --- Refactored Imports ---
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {TARGET_MESSAGES, getDisplayName} from "../../utils/messages.js";
import {EVENT_DISPLAY_MESSAGE, EVENT_ITEM_PICKED_UP} from "../../types/eventTypes.js"; // Core event
// Optional: Define/import semantic event names if used consistently
const ACTION_TAKE_SUCCEEDED = 'action:take_succeeded';
const ACTION_TAKE_FAILED = 'action:take_failed';

/**
 * Handles the 'take' action ('core:take'). Allows the player to attempt
 * to pick up items from the current location.
 * Refactored to use handleActionWithTargetResolution and dispatchEventWithCatch.
 * @param {ActionContext} context - The context for the action.
 * @returns {Promise<ActionResult>} The result of the action attempt.
 */
export async function executeTake(context) {
    const {playerEntity, currentLocation, eventBus} = context; // Use eventBus from context

    // --- Basic Validation (Optional - handleAction... might cover some) ---
    if (!playerEntity) {
        console.error("executeTake: Missing player in context.");
        // Use eventBus directly if available in context, otherwise log
        if (eventBus) {
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        }
        return {success: false, messages: [{text: "Critical: Missing player entity.", type: 'internal_error'}]};
    }
    if (!currentLocation) {
        console.error("executeTake: Missing location in context.");
        if (eventBus) {
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        }
        return {success: false, messages: [{text: "Critical: Missing location entity.", type: 'internal_error'}]};
    }
    // Location ID for events
    const locationId = currentLocation.id;


    /**
     * Callback executed when a unique item is found in the location.
     * Marked async because it awaits event dispatches.
     * @param {ActionContext} innerContext - The action context passed through.
     * @param {Entity} targetItemEntity - The uniquely resolved item entity.
     * @param {ActionMessage[]} messages - The array of messages accumulated so far (mutated by dispatchEventWithCatch).
     * @returns {Promise<ActionResult>} - The result indicating success of the core pickup event dispatch.
     */
    const onFoundUnique = async (innerContext, targetItemEntity, messages) => {
        const targetItemId = targetItemEntity.id;
        const pickerId = innerContext.playerEntity.id;
        const itemName = getDisplayName(targetItemEntity); // For logging and events

        /** @type {ItemPickedUpEventPayload} */
        const eventPayload = {
            pickerId: pickerId,
            itemId: targetItemId,
            locationId: locationId // Use locationId from outer scope
        };

        const logDetails = {
            success: `Dispatched ${EVENT_ITEM_PICKED_UP} for ${itemName} (${targetItemId}) from location ${locationId}`,
            errorUser: TARGET_MESSAGES.INTERNAL_ERROR, // User message on dispatch failure
            errorInternal: `Failed to dispatch ${EVENT_ITEM_PICKED_UP} for ${itemName} (${targetItemId}) from location ${locationId}.` // Internal log on failure
        };

        // --- Call dispatchEventWithCatch (Correctly awaits and assigns) ---
        const dispatchResult = await dispatchEventWithCatch(
            innerContext,
            EVENT_ITEM_PICKED_UP,
            eventPayload,
            messages, // Pass messages array for internal logging
            logDetails
        );

        // --- Debug Logging (Keep temporarily if needed) ---
        console.log('[DEBUG onFoundUnique] Type of dispatchResult:', typeof dispatchResult);
        console.log('[DEBUG onFoundUnique] dispatchResult itself:', dispatchResult);
        console.log('[DEBUG onFoundUnique] dispatchResult.success:', dispatchResult?.success);
        console.log('[DEBUG onFoundUnique] Stringified dispatchResult:', JSON.stringify(dispatchResult));
        // --- End Debug Logging ---

        // Handle Semantic Success/Failure Feedback (Await these dispatches too)
        if (dispatchResult?.success === true) {
            try {
                await innerContext.eventBus.dispatch(ACTION_TAKE_SUCCEEDED, { // Use innerContext.eventBus
                    actorId: pickerId,
                    itemId: targetItemId,
                    itemName: itemName,
                    locationId: locationId
                });
                messages.push({
                    text: `Dispatched ${ACTION_TAKE_SUCCEEDED} for ${itemName} (${targetItemId})`,
                    type: 'internal'
                });
            } catch (semanticError) {
                console.error(`executeTake (onFoundUnique): Failed to dispatch ${ACTION_TAKE_SUCCEEDED} for ${itemName}:`, semanticError);
                messages.push({
                    text: `Failed to dispatch semantic success event for ${itemName}.`,
                    type: 'internal_error'
                });
                // Continue as success=true because the core action succeeded.
            }
        } else {
            console.warn('[DEBUG onFoundUnique] Entering failure block because dispatchResult.success is not true. Value:', dispatchResult?.success); // Add log here
            try {
                await innerContext.eventBus.dispatch(ACTION_TAKE_FAILED, { // Use innerContext.eventBus
                    actorId: pickerId,
                    targetName: innerContext.parsedCommand.directObjectPhrase || itemName, // Use original target name from command if available, else resolved name
                    reasonCode: 'INTERNAL_PICKUP_ERROR', // Indicate failure during event dispatch
                    locationId: locationId,
                    details: `Failed to dispatch ${EVENT_ITEM_PICKED_UP} for ${itemName}` // Pass limited details
                });
                messages.push({
                    text: `Dispatched ${ACTION_TAKE_FAILED} for ${itemName} due to pickup event dispatch error`,
                    type: 'internal'
                });
            } catch (semanticError) {
                console.error(`executeTake (onFoundUnique): Failed to dispatch ${ACTION_TAKE_FAILED} for ${itemName}:`, semanticError);
                messages.push({
                    text: `Failed to dispatch semantic failure event for ${itemName}.`,
                    type: 'internal_error'
                });
            }
        }

        // --- Final Return (Crucial: Reflect dispatchResult.success) ---
        const finalReturnObject = {
            // Use direct check for safety and clarity
            success: dispatchResult?.success === true,
            messages: [], // Return empty, messages array was mutated
            newState: undefined
        };
        console.log('[DEBUG onFoundUnique] Returning:', JSON.stringify(finalReturnObject)); // Keep temporarily if needed
        return finalReturnObject;
    }; // End onFoundUnique

    // --- Configure and Call handleActionWithTargetResolution ---
    /** @type {HandleActionWithOptions} */
    const options = {
        scope: 'location_items',             // Scope: Check items in the current location
        requiredComponents: [ItemComponent], // Must be an item
        commandPart: 'directObjectPhrase',   // Get item name from DO
        actionVerb: 'take',                  // Action verb for messages
        onFoundUnique: onFoundUnique,        // The callback defined above (which is async)
        failureMessages: {
            // Override defaults to use specific 'take' messages if desired
            notFound: TARGET_MESSAGES.NOT_FOUND_TAKEABLE, // e.g., "You don't see 'widget' here you can take."
            filterEmpty: TARGET_MESSAGES.TAKE_EMPTY_LOCATION, // e.g., "There is nothing here to take."
            // AMBIGUOUS and INVALID_INPUT will use standard defaults unless overridden
        },
        // customFilter: (entity) => { /* Add custom logic if needed */ return true; } // Example
    };

    // Await the result of handleAction... since it calls the async onFoundUnique
    return await handleActionWithTargetResolution(context, options);
} // End executeTake