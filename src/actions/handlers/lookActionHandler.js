// src/actions/handlers/lookActionHandler.js

// --- Utilities and Services ---
// Import only what's absolutely necessary for intent recognition and target resolution.
import {TARGET_MESSAGES} from '../../utils/messages.js'; // For target resolution failure messages
import {handleActionWithTargetResolution} from '../actionExecutionUtils.js';
import {EVENT_LOOK_INTENDED} from '../../types/eventTypes.js'; // *** IMPORTED ***

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../types/eventTypes.js').LookIntendedPayload} LookIntendedPayload */ // Optional: For stricter payload typing

/**
 * Handles the 'core:look' action intent.
 * Determines the scope of the player's look ('location', 'self', or 'target')
 * and dispatches an EVENT_LOOK_INTENDED event containing this intent.
 * Does NOT perform the look action directly (data gathering, UI formatting)
 * or dispatch any UI events itself.
 *
 * @param {ActionContext} context - The action context containing player, location, command, and event bus.
 * @returns {Promise<ActionResult>} Result indicating success/failure of recognizing
 * and dispatching the look intent. Messages included are for internal/debug purposes only.
 */
export async function executeLook(context) {
    const {currentLocation, playerEntity, parsedCommand, eventBus} = context;
    const messages = []; // For internal/debug messages only

    // --- 1. Handle Invalid Context ---
    // If essential context is missing, fail early without dispatching intent.
    if (!playerEntity) {
        // This should ideally not happen if the action dispatcher ensures a valid player context
        const errorMsg = "Cannot execute look: Player entity is missing.";
        messages.push({text: errorMsg, type: 'internal', level: 'error'});
        return {success: false, messages};
    }
    if (!currentLocation) {
        const errorMsg = `Cannot execute look for ${playerEntity.id}: Player location is unknown.`;
        messages.push({text: errorMsg, type: 'internal', level: 'warn'});
        // Do NOT dispatch a UI event here. The system listening for look intent might handle this.
        return {success: false, messages};
    }

    // --- 2. Determine Look Scope ---
    const targetName = parsedCommand.directObjectPhrase;
    /** @type {LookIntendedPayload | null} */
    let payload = null;

    // --- Case: Look at Current Location ---
    if (!targetName) {
        messages.push({
            text: `Look intent identified: Scope 'location' for actor ${playerEntity.id}`,
            type: 'internal'
        });
        payload = {
            actorId: playerEntity.id,
            scope: 'location',
            targetEntityId: null
        };
        await eventBus.dispatch(EVENT_LOOK_INTENDED, payload);
        messages.push({text: `Dispatched ${EVENT_LOOK_INTENDED} (location) for ${playerEntity.id}.`, type: 'internal'});
        return {success: true, messages};

        // --- Case: Look at Self ---
    } else if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
        messages.push({text: `Look intent identified: Scope 'self' for actor ${playerEntity.id}`, type: 'internal'});
        payload = {
            actorId: playerEntity.id,
            scope: 'self',
            targetEntityId: playerEntity.id // Target is the actor itself
        };
        await eventBus.dispatch(EVENT_LOOK_INTENDED, payload);
        messages.push({text: `Dispatched ${EVENT_LOOK_INTENDED} (self) for ${playerEntity.id}.`, type: 'internal'});
        return {success: true, messages};

        // --- Case: Look at Specific Target ---
    } else {
        messages.push({
            text: `Look intent identified: Scope 'target' for phrase '${targetName}'. Actor: ${playerEntity.id}. Resolving...`,
            type: 'internal'
        });

        // Define the callback for when handleActionWithTargetResolution finds a unique target
        const onFoundUniqueLookTarget = async (innerContext, targetEntity, accumulatedMessages) => {
            // We found a unique target. Now dispatch the intent event.
            const targetPayload = {
                actorId: innerContext.playerEntity.id, // Use the player from the provided context
                scope: 'target',
                targetEntityId: targetEntity.id
            };

            await innerContext.eventBus.dispatch(EVENT_LOOK_INTENDED, targetPayload);

            // Return a minimal success result. Ignore accumulatedMessages as they might contain UI hints.
            // Add our own internal message confirming dispatch.
            const dispatchMsg = `Dispatched ${EVENT_LOOK_INTENDED} (target: ${targetEntity.id}) for actor ${innerContext.playerEntity.id}.`;
            return {success: true, messages: [{text: dispatchMsg, type: 'internal'}]};
        };

        // Configure options for target resolution
        const options = {
            scope: 'nearby_including_blockers', // Look in current location + player's inventory
            requiredComponents: [], // Can look at anything, no specific component needed
            commandPart: 'directObjectPhrase',
            actionVerb: 'look at', // Used for potential disambiguation messages if needed
            onFoundUnique: onFoundUniqueLookTarget, // The callback defined above
            // Failure messages from TARGET_MESSAGES are used by handleAction...
            // if resolution fails (not found, ambiguous). The utility returns these
            // messages in the ActionResult.
            failureMessages: {
                // Use a message suitable for looking/examining
                notFound: TARGET_MESSAGES.NOT_FOUND_EXAMINABLE(targetName),
                // Use default ambiguous message if needed:
                // ambiguous: TARGET_MESSAGES.AMBIGUOUS_PROMPT('look at', targetName, candidates),
                // Use default scope empty messages if needed:
                // scopeEmptyPersonal: TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL('look at'),
                // scopeEmptyGeneric: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('look at', 'nearby'),
                filterEmpty: "You don't see that here.",
            },
        };

        // Execute the resolution process.
        // This will either call `onFoundUniqueLookTarget` on success (which dispatches the event and returns success),
        // or return a failure ActionResult directly if the target is not found or is ambiguous.
        // The `ActionResult` returned by this utility becomes the final result of `executeLook`.
        return await handleActionWithTargetResolution(context, options);
    }
}