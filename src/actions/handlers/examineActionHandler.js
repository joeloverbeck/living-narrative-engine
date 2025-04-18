// src/actions/handlers/examineActionHandler.js

// --- Utilities and Services ---
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// Import the event constant and payload type
import {EVENT_EXAMINE_INTENDED} from '../../types/eventTypes.js';
/** @typedef {import('../../types/eventTypes.js').ExamineIntendedPayload} ExamineIntendedPayload */
// Import the robust dispatch utility (adjust path if necessary)
import {dispatchEventWithCatch} from "../actionExecutionUtils.js";

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * Handles the 'core:examine' action intent.
 * Resolves the target entity based on the command. If a unique entity is found,
 * dispatches an EVENT_EXAMINE_INTENDED event for other systems to handle description generation.
 * Does NOT generate or dispatch UI messages directly.
 *
 * @param {ActionContext} context
 * @returns {Promise<ActionResult>} // Now returns a Promise because dispatch is async
 */
export async function executeExamine(context) {
    const {playerEntity, parsedCommand} = context; // EventBus is accessed within dispatchEventWithCatch via context
    /** @type {ActionMessage[]} */
    const messages = [];
    let success = false; // Default to failure

    // --- 1. Validate required target name ---
    // Assuming validateRequiredCommandPart is synchronous. If it becomes async, add await.
    if (!validateRequiredCommandPart(context, 'examine', 'directObjectPhrase')) {
        // Message "Examine what?" should be dispatched by the utility.
        // Add internal log.
        messages.push({text: "Validation failed: 'directObjectPhrase' missing for examine.", type: 'internal'});
        return {success: false, messages: messages, newState: undefined};
    }
    const targetName = parsedCommand.directObjectPhrase;
    messages.push({text: `Examine intent: Raw target name '${targetName}'`, type: 'internal'});

    // --- Get Actor ID ---
    const actorEntity = playerEntity;
    if (!actorEntity) {
        messages.push({text: "Examine failed: Could not identify actor.", type: 'internal_error'});
        // No UI dispatch here. Rely on system integrity or other checks.
        console.error("executeExamine: Could not retrieve player/actor entity from context.");
        return {success: false, messages: messages, newState: undefined};
    }
    const actorId = actorEntity.id;
    messages.push({text: `Actor identified: ${actorId}`, type: 'internal'});

    // --- 2. Resolve Target Entity using Service ---
    const resolution = resolveTargetEntity(context, {
        scope: 'nearby_including_blockers',
        requiredComponents: [], // Examine any named entity initially
        actionVerb: 'examine', // For potential internal message construction in resolver
        targetName: targetName,
    });
    messages.push({text: `Target resolution status: ${resolution.status}`, type: 'internal'});

    // --- 3. Handle Resolver Result ---
    switch (resolution.status) {
        case 'FOUND_UNIQUE': {
            const targetEntity = resolution.entity;
            const targetEntityId = targetEntity.id;
            messages.push({text: `Unique target found: ${targetEntityId}`, type: 'internal'});

            // --- Dispatch Intent Event ---
            /** @type {ExamineIntendedPayload} */
            const payload = {actorId, targetEntityId};

            const logDetails = {
                success: `Dispatched EVENT_EXAMINE_INTENDED for actor ${actorId} on target ${targetEntityId}`,
                // User message if dispatch fails (should be rare, indicates deeper issue)
                errorUser: "There was an unexpected problem trying to examine that.",
                errorInternal: `Failed to dispatch EVENT_EXAMINE_INTENDED for target ${targetEntityId}.`
            };

            // Use the robust dispatch utility
            const dispatchResult = await dispatchEventWithCatch(
                context, // Pass the whole context
                EVENT_EXAMINE_INTENDED,
                payload,
                messages, // The messages array to add internal logs to
                logDetails
            );

            success = dispatchResult.success; // Success depends ONLY on dispatching the event
            // Internal success/error message is added by dispatchEventWithCatch

            // ** Removed UI message construction and dispatch **
            // ** Removed previous internal message about 'Examined X' **

            break;
        }

        case 'NOT_FOUND': {
            // ** Removed feedbackMsg and UI dispatch **
            messages.push({text: `Resolution failed: NOT_FOUND for name '${targetName}'.`, type: 'internal'});
            success = false;
            break;
        }

        case 'AMBIGUOUS': {
            // ** Removed feedbackMsg and UI dispatch **
            const candidateIds = resolution.candidates.map(c => c.id).join(', ');
            messages.push({
                text: `Resolution failed: AMBIGUOUS for name '${targetName}'. Candidates: [${candidateIds}]`,
                type: 'internal'
            });
            success = false;
            break;
        }

        case 'FILTER_EMPTY': {
            // ** Removed feedbackMsg and UI dispatch **
            messages.push({
                text: `Resolution failed: FILTER_EMPTY for scope 'nearby_including_blockers', action 'examine'.`,
                type: 'internal'
            });
            success = false;
            break;
        }

        case 'INVALID_INPUT': {
            // ** Removed feedbackMsg and UI dispatch **
            messages.push({
                text: `Resolution failed: INVALID_INPUT calling resolveTargetEntity for examine.`,
                type: 'internal_error'
            });
            // Keep console error for developer visibility
            console.error(`executeExamine: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
            success = false;
            break;
        }

        default: {
            // ** Removed feedbackMsg and UI dispatch **
            messages.push({text: `Resolution failed: Unhandled status '${resolution.status}'`, type: 'internal_error'});
            // Keep console error for developer visibility
            console.error(`executeExamine: Unhandled resolution status: ${resolution.status}`);
            success = false;
            break;
        }
    } // End switch

    // --- 4. Return Result ---
    // Result now strictly reflects the success of resolving the intent and dispatching the event,
    // and contains only internal log messages.
    return {success, messages, newState: undefined};
}