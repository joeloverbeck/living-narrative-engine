/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

// --- Standard Imports ---
// Removed ItemComponent import as it's no longer directly needed for definitionId
// Ensure DefinitionRefComponent is correctly imported
import DefinitionRefComponent from '../../components/definitionRefComponent.js'; // <<< ADDED IMPORT

// --- Utility Imports ---
// Ensure these utilities are correctly imported (adjust paths if necessary)
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {resolveTargetEntity, ResolutionStatus} from '../../services/entityFinderService.js';
import {resolveTargetConnection} from '../../services/connectionResolver.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {EVENT_DISPLAY_MESSAGE, EVENT_ITEM_USE_ATTEMPTED} from "../../types/eventTypes.js";

/**
 * Handles the 'core:use' action ('use <item> [on <target>]').
 * Resolves the item from inventory and optionally the target from the surroundings.
 * Retrieves item definition ID from DefinitionRefComponent.
 * Dispatches EVENT_ITEM_USE_ATTEMPTED for systems like ItemUsageSystem to handle effects.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Promise<ActionResult>} - The result of the action attempt (async due to utility usage).
 */
export async function executeUse(context) {
    const {playerEntity, eventBus} = context; // Use eventBus from context

    // --- Basic Pre-checks ---
    if (!playerEntity) {
        console.error("executeUse: Missing player in context.");
        // Use eventBus directly for critical early errors if available
        if (eventBus && typeof eventBus.dispatch === 'function') {
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        }
        return {success: false, messages: [{text: "Critical: Missing player entity.", type: 'internal_error'}]};
    }

    // --- Define the callback for when the item is uniquely resolved ---
    // <<< Make the callback async >>>
    const onFoundUnique = async (innerContext, targetItemEntity, messages) => {
        // Use innerContext which includes eventBus
        const {playerEntity, gameDataRepository: gameDataRepository, entityManager, parsedCommand, eventBus: innerEventBus} = innerContext;
        const itemInstanceId = targetItemEntity.id;

        const itemDefinitionId = targetItemEntity.getComponent(DefinitionRefComponent)?.id;

        // Safety check for component/definition ID (essential for looking up Usable data)
        if (!itemDefinitionId) {
            const errorMsg = `Internal Error: Item ${itemInstanceId} (${getDisplayName(targetItemEntity)}) is missing required DefinitionRefComponent or its ID. Cannot determine item type.`;
            console.error(`onFoundUnique (use): ${errorMsg}`);
            if (innerEventBus) { // Check if eventBus is available
                await innerEventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                    text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'
                });
            }
            messages.push({text: errorMsg, type: 'internal_error'});
            return {success: false, messages: []}; // Callback fails
        }

        const foundItemName = getDisplayName(targetItemEntity);

        let explicitTargetEntityId = null;
        let explicitTargetConnectionEntityId = null;
        const targetNameGuess = parsedCommand.indirectObjectPhrase;

        // --- Handle Optional Explicit Target Resolution ---
        if (targetNameGuess) {
            messages.push({text: `Resolving explicit target: '${targetNameGuess}'`, type: 'internal'});
            const targetResolutionContext = `use ${foundItemName} on`;

            // 1. Try resolving as a CONNECTION entity first
            const resolvedConnectionEntity = resolveTargetConnection(innerContext, targetNameGuess, targetResolutionContext);

            if (resolvedConnectionEntity) {
                explicitTargetConnectionEntityId = resolvedConnectionEntity.id;
                explicitTargetEntityId = null;
                messages.push({
                    text: `Resolved explicit target as CONNECTION: ${getDisplayName(resolvedConnectionEntity)} (${explicitTargetConnectionEntityId})`,
                    type: 'internal'
                });
            } else {
                // 2. If not a connection, try resolving as a regular ENTITY
                messages.push({
                    text: `Target '${targetNameGuess}' not a connection, trying as regular entity...`, type: 'internal'
                });
                const entityTargetResolution = resolveTargetEntity(innerContext, {
                    scope: 'nearby', // Or 'location' - adjust based on desired targeting rules
                    requiredComponents: [], // Allow targeting any nearby entity initially
                    targetName: targetNameGuess, actionVerb: targetResolutionContext,
                });

                switch (entityTargetResolution.status) {
                    case ResolutionStatus.FOUND_UNIQUE:
                        explicitTargetEntityId = entityTargetResolution.entity.id;
                        explicitTargetConnectionEntityId = null;
                        messages.push({
                            text: `Resolved explicit target as ENTITY: ${getDisplayName(entityTargetResolution.entity)} (${explicitTargetEntityId})`,
                            type: 'internal'
                        });
                        break; // Proceed

                    case ResolutionStatus.NOT_FOUND:
                        if (innerEventBus) await innerEventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                            text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetNameGuess), type: 'info'
                        });
                        return {success: false, messages: []};
                    case ResolutionStatus.AMBIGUOUS:
                        const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(targetResolutionContext, targetNameGuess, entityTargetResolution.candidates);
                        if (innerEventBus) await innerEventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                            text: ambiguousMsg, type: 'warning'
                        });
                        return {success: false, messages: []};
                    case ResolutionStatus.FILTER_EMPTY:
                        const filterEmptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(targetResolutionContext, 'nearby'); // Adjust scope string if needed
                        if (innerEventBus) await innerEventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                            text: filterEmptyMsg, type: 'info'
                        });
                        return {success: false, messages: []};
                    case ResolutionStatus.INVALID_INPUT: // Should ideally not happen if input is validated
                    default: // Handle unexpected status
                        console.error(`onFoundUnique (use - target): Unhandled resolution status: ${entityTargetResolution.status}`);
                        if (innerEventBus) await innerEventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                            text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'
                        });
                        return {success: false, messages: []};
                }
            }
        } else {
            messages.push({text: `No explicit target specified.`, type: 'internal'});
            // Check if the item requires a target based on its definition
            // NOTE: This uses itemDefinitionId which is now correctly sourced
            const itemDefinition = gameDataRepository.getEntityDefinition(itemDefinitionId);
            const usableData = itemDefinition?.components?.Usable;
            if (usableData?.target_required) {
                // Item requires a target, but none was provided.
                if (innerEventBus) await innerEventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                    text: TARGET_MESSAGES.USE_REQUIRES_TARGET(foundItemName), type: 'warning'
                });
                messages.push({
                    text: `Item '${foundItemName}' requires a target, but none provided.`, type: 'internal'
                });
                return {success: false, messages: []};
            }
        }

        // --- Construct and Dispatch Event ---
        /** @type {ItemUseAttemptedEventPayload} */
        const eventPayload = {
            userEntityId: playerEntity.id,
            itemInstanceId: itemInstanceId,
            itemDefinitionId: itemDefinitionId, // <<< This now comes from DefinitionRefComponent
            explicitTargetEntityId: explicitTargetEntityId,
            explicitTargetConnectionEntityId: explicitTargetConnectionEntityId,
        };

        const dispatchLogDetails = {
            success: `Successfully dispatched ${EVENT_ITEM_USE_ATTEMPTED} for ${foundItemName} (${itemDefinitionId})`,
            errorUser: `Something went wrong trying to use the ${foundItemName}.`,
            errorInternal: `Failed to dispatch ${EVENT_ITEM_USE_ATTEMPTED} for ${foundItemName} (${itemInstanceId}).`
        };

        // Dispatch the event using the utility, messages array is mutated by it
        // <<< ADDED await HERE >>>
        const dispatchResult = await dispatchEventWithCatch(innerContext, // Pass the context containing eventBus
            EVENT_ITEM_USE_ATTEMPTED, eventPayload, messages, // Pass messages array for internal logging
            dispatchLogDetails);

        // Return success based on the dispatch result
        return {
            success: dispatchResult.success, messages: [] // Return empty; messages array was mutated if needed
        };
    }; // End of onFoundUnique callback definition

    // --- Configure and Call handleActionWithTargetResolution for Item Resolution ---
    /** @type {import('../actionExecutionUtils.js').HandleActionWithOptions} */
    const options = {
        scope: 'inventory',
        // NOTE: Still require ItemComponent generally, as 'use' implies something usable,
        // which is often tied to ItemComponent's presence, even if definitionId comes elsewhere.
        // If *only* DefinitionRefComponent matters, this could be changed.
        requiredComponents: [/* ItemComponent, */ DefinitionRefComponent], // Ensure it has a DefinitionRefComponent
        commandPart: 'directObjectPhrase', // 'use <item> ...'
        actionVerb: 'use',
        onFoundUnique: onFoundUnique, // The async callback defined above
        failureMessages: {
            notFound: TARGET_MESSAGES.NOT_FOUND_INVENTORY,
            ambiguous: TARGET_MESSAGES.AMBIGUOUS_PROMPT,
            filterEmpty: TARGET_MESSAGES.NOTHING_CARRIED,
            // Add specific message if something lacks DefinitionRefComponent?
            // filterFail: (name) => `You see ${name}, but cannot determine what it is.`
        },
    };

    // Call the utility; it handles target resolution and calls the callback
    // Returns a Promise<ActionResult>
    return await handleActionWithTargetResolution(context, options);
}