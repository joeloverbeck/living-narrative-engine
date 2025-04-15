// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

// --- Standard Imports ---
import {ItemComponent} from '../../components/itemComponent.js';
// InventoryComponent not strictly needed here anymore, but keep if used elsewhere potentially
// import { InventoryComponent } from '../../components/inventoryComponent.js';

// --- Refactored Imports ---
// AC: Import Utilities and Dependencies
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {resolveTargetEntity, ResolutionStatus} from '../../services/entityFinderService.js';
import {resolveTargetConnection} from '../../services/connectionResolver.js'; // Assumes path is correct
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';

// Removed validateRequiredCommandPart as utility handles it

/**
 * Handles the 'core:use' action ('use <item> [on <target>]').
 * Refactored to use handleActionWithTargetResolution for item resolution
 * and dispatchEventWithCatch for event dispatch.
 * The onFoundUnique callback handles optional target resolution (connection first, then entity).
 *
 * @param {ActionContext} context - The action context.
 * @returns {Promise<ActionResult>} - The result of the action attempt (async due to utility).
 */
export async function executeUse(context) {
    const {playerEntity, dispatch} = context; // Grab needed parts early

    // --- Basic Pre-checks (Optional, but good practice) ---
    if (!playerEntity) {
        // This check could arguably be within the utility, but checking early is fine.
        console.error("executeUse: Missing player in context.");
        // Ensure dispatch exists before using it
        if (dispatch) dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: [{text: "Critical: Missing player entity.", type: 'internal_error'}]};
    }
    // Note: Inventory check is implicitly handled by the 'inventory' scope in options below.

    // --- AC: Implement onFoundUnique Callback Logic ---
    /**
     * Callback executed when a unique item is found in the player's inventory.
     * Handles optional target resolution (connection or entity) and event dispatch.
     *
     * @param {ActionContext} innerContext - The action context passed through.
     * @param {Entity} targetItemEntity - The uniquely resolved item entity from inventory.
     * @param {ActionMessage[]} messages - The array of messages accumulated so far (mutated by dispatchEventWithCatch).
     * @returns {ActionResult} - The result indicating success/failure of the use attempt.
     */
    const onFoundUnique = (innerContext, targetItemEntity, messages) => {
        const {playerEntity, dataManager, entityManager, parsedCommand, dispatch} = innerContext; // Use innerContext
        const itemInstanceId = targetItemEntity.id;
        const itemComponent = targetItemEntity.getComponent(ItemComponent);

        // Safety check for component/definition ID
        if (!itemComponent?.definitionId) {
            console.error(`onFoundUnique (use): Item ${itemInstanceId} lacks ItemComponent or definitionId!`);
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            messages.push({
                text: `Internal Error: Item ${itemInstanceId} missing essential component data.`,
                type: 'internal_error'
            });
            return {success: false, messages: []}; // Callback fails
        }
        const itemDefinitionId = itemComponent.definitionId;
        const foundItemName = getDisplayName(targetItemEntity); // For logging/messages

        let explicitTargetEntityId = null;
        let explicitTargetConnectionEntityId = null;

        const targetNameGuess = parsedCommand.indirectObjectPhrase;

        // --- Handle Optional Explicit Target ---
        if (targetNameGuess) {
            messages.push({text: `Resolving explicit target: '${targetNameGuess}'`, type: 'internal'});
            const targetResolutionContext = `use ${foundItemName} on`; // Verb for target messages

            // 1. Try resolving as a CONNECTION entity first
            const resolvedConnectionEntity = resolveTargetConnection(innerContext, targetNameGuess, targetResolutionContext); // Assumes returns Entity | null

            if (resolvedConnectionEntity) {
                explicitTargetConnectionEntityId = resolvedConnectionEntity.id;
                explicitTargetEntityId = null; // Mutually exclusive
                messages.push({
                    text: `Resolved explicit target as CONNECTION: ${getDisplayName(resolvedConnectionEntity)} (${explicitTargetConnectionEntityId})`,
                    type: 'internal'
                });
            } else {
                // 2. If not a connection, try resolving as a regular ENTITY
                messages.push({
                    text: `Target '${targetNameGuess}' not a connection, trying as regular entity...`,
                    type: 'internal'
                });
                const entityTargetResolution = resolveTargetEntity(innerContext, {
                    scope: 'nearby', // 'location' or 'nearby' are appropriate choices
                    requiredComponents: [], // Any entity in scope is potentially targetable by 'use' initially
                    targetName: targetNameGuess,
                    actionVerb: targetResolutionContext, // Pass verb for potential ambiguity messages
                });

                switch (entityTargetResolution.status) {
                    case ResolutionStatus.FOUND_UNIQUE:
                        explicitTargetEntityId = entityTargetResolution.entity.id;
                        explicitTargetConnectionEntityId = null; // Mutually exclusive
                        messages.push({
                            text: `Resolved explicit target as ENTITY: ${getDisplayName(entityTargetResolution.entity)} (${explicitTargetEntityId})`,
                            type: 'internal'
                        });
                        break; // Proceed to event dispatch

                    // AC: Handle target resolution failures within the callback
                    case ResolutionStatus.NOT_FOUND:
                        dispatch('ui:message_display', {
                            text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetNameGuess),
                            type: 'info'
                        });
                        // No need to add internal message here, just return failure from callback
                        return {success: false, messages: []};
                    case ResolutionStatus.AMBIGUOUS:
                        const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(targetResolutionContext, targetNameGuess, entityTargetResolution.candidates);
                        dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
                        return {success: false, messages: []};
                    case ResolutionStatus.FILTER_EMPTY:
                        // Use a generic 'nearby' or 'location' message based on scope used
                        const filterEmptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(targetResolutionContext, 'nearby');
                        dispatch('ui:message_display', {text: filterEmptyMsg, type: 'info'});
                        return {success: false, messages: []};
                    case ResolutionStatus.INVALID_INPUT:
                        console.error(`onFoundUnique (use - target): resolveTargetEntity returned INVALID_INPUT for target '${targetNameGuess}'`);
                        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                        return {success: false, messages: []};
                    default: // Unexpected status
                        console.error(`onFoundUnique (use - target): Unhandled resolution status: ${entityTargetResolution.status}`);
                        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                        return {success: false, messages: []};
                }
            }
        } else {
            // No indirect object phrase, no explicit target
            messages.push({text: `No explicit target specified.`, type: 'internal'});
        }

        // --- Construct and Dispatch Event ---
        // AC: Use dispatchEventWithCatch for Final Event
        /** @type {ItemUseAttemptedEventPayload} */
        const eventPayload = {
            userEntityId: playerEntity.id,
            itemInstanceId: itemInstanceId,
            itemDefinitionId: itemDefinitionId,
            explicitTargetEntityId: explicitTargetEntityId,               // ID or null
            explicitTargetConnectionEntityId: explicitTargetConnectionEntityId, // ID or null (AC: Event Payload Update)
        };

        // Prepare logging details for the dispatch utility
        const dispatchLogDetails = {
            success: `Successfully dispatched event:item_use_attempted for ${foundItemName} (${itemDefinitionId})`,
            errorUser: `Something went wrong trying to use the ${foundItemName}.`, // User-facing on dispatch failure
            errorInternal: `Failed to dispatch event:item_use_attempted for ${foundItemName} (${itemInstanceId}).` // Internal log on dispatch failure
        };

        // Dispatch the event, messages array is mutated by the utility
        const dispatchResult = dispatchEventWithCatch(
            innerContext, // Pass innerContext which contains dispatch
            'event:item_use_attempted',
            eventPayload,
            messages, // Pass messages array to be mutated
            dispatchLogDetails
        );

        // AC: Return Result from Callback
        // Wrap the boolean success from dispatchEventWithCatch into the ActionResult format.
        // The messages array was mutated directly by dispatchEventWithCatch.
        return {
            success: dispatchResult.success,
            messages: [] // Return empty array; utility merges mutated messages
        };
    }; // End of onFoundUnique callback definition

    // --- Configure and Call handleActionWithTargetResolution for Item ---
    // AC: Use handleActionWithTargetResolution for Item
    /** @type {import('../actionExecutionUtils.js').HandleActionWithOptions} */
    const options = {
        scope: 'inventory',                     // AC: scope
        requiredComponents: [ItemComponent],    // AC: requiredComponents
        commandPart: 'directObjectPhrase',      // AC: commandPart
        actionVerb: 'use',                      // AC: actionVerb
        onFoundUnique: onFoundUnique,           // AC: onFoundUnique callback
        failureMessages: {                      // AC: failureMessages
            notFound: TARGET_MESSAGES.NOT_FOUND_INVENTORY,
            ambiguous: TARGET_MESSAGES.AMBIGUOUS_PROMPT, // Default takes (verb, name, matches)
            filterEmpty: TARGET_MESSAGES.NOTHING_CARRIED,
            // invalidInput will use the default TARGET_MESSAGES.INTERNAL_ERROR
        },
    };

    // Call the utility and return its promise
    // The utility handles validation, item resolution, calling onFoundUnique,
    // merging messages, and returning the final ActionResult.
    return await handleActionWithTargetResolution(context, options);
} // End executeUse function