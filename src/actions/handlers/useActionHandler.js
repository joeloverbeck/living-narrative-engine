// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../../components/connectionsComponent.js').ConnectionsComponent} ConnectionsComponent */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actionTypes.js').ParsedCommand} ParsedCommand */

// --- Standard Imports ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
// NameComponent, PositionComponent, ConnectionsComponent likely not needed directly here anymore
import {ItemComponent} from '../../components/itemComponent.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {resolveTargetConnection} from '../../services/connectionResolver.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// --- Refactored Imports ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js'; // Import TARGET_MESSAGES and getDisplayName


/**
 * Handles the 'core:use' action.
 * Uses resolveTargetEntity for item (inventory) and optional target (location/connection).
 * Dispatches UI messages based on resolution status and 'event:item_use_attempted' on success.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    const {
        playerEntity,
        entityManager, // Still needed potentially for connection resolution details?
        dataManager,
        dispatch,
        eventBus, // Keep for final event dispatch
        currentLocation, // Needed for connection/target resolution context
        parsedCommand
    } = context;
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];

    // --- 1. Validate basic target presence & Get Full String ---
    if (!validateRequiredCommandPart(context, 'use', 'directObjectPhrase')) {
        // Message like "Use what?" dispatched by validator
        return {success: false, messages: [], newState: undefined};
    }

    // --- 2. Check if player entity/inventory exists (basic setup) ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'internal'});
        return {success: false, messages};
    }
    // Note: Checking for *completely* empty inventory is now handled by FILTER_EMPTY status below.

    // --- 3. Get Item Name and Potential Target Name from Parsed Command ---
    const itemNameGuess = parsedCommand.directObjectPhrase;
    const targetNameGuess = parsedCommand.indirectObjectPhrase; // May be null
    const usedPreposition = parsedCommand.preposition; // May be null

    messages.push({
        text: `Intent Parse: Item guess: '${itemNameGuess}'. Target guess: '${targetNameGuess || 'None'}'. Prep: '${usedPreposition || 'None'}'.`,
        type: 'internal'
    });

    // --- 4. Resolve the Item ---
    // Removed notFoundMessageKey
    const itemResolution = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        // actionVerb: 'use', // Keep for potential use
        targetName: itemNameGuess,
    });

    // --- Handle Item Resolution Status ---
    switch (itemResolution.status) {
        case 'FOUND_UNIQUE': {
            const targetItemEntity = itemResolution.entity;
            const itemInstanceId = targetItemEntity.id;
            // Get Definition ID (assuming ItemComponent stores it)
            const itemComponent = targetItemEntity.getComponent(ItemComponent);
            const itemDefinition = dataManager.getEntityDefinition(itemComponent?.definitionId || itemInstanceId);
            const itemDefinitionId = itemDefinition?.id || itemInstanceId;
            const foundItemName = getDisplayName(targetItemEntity);

            messages.push({
                text: `Intent Parse: Resolved item: ${foundItemName} (${itemInstanceId}, def: ${itemDefinitionId})`,
                type: 'internal'
            });

            // --- 5. Resolve the Explicit Target (if one was parsed) ---
            let explicitTargetEntityId = null;
            let explicitTargetConnectionId = null;

            if (targetNameGuess) {
                messages.push({
                    text: `Intent Parse: Attempting to resolve explicit target from IO: '${targetNameGuess}'`,
                    type: 'internal'
                });

                const targetResolutionContext = `use ${foundItemName} ${usedPreposition || 'on'}`;

                // --- 5a. Try resolving as a CONNECTION first ---
                const resolvedConnection = resolveTargetConnection(context, targetNameGuess, targetResolutionContext);

                if (resolvedConnection) {
                    explicitTargetConnectionId = resolvedConnection.connectionId;
                    messages.push({
                        text: `Intent Parse: Resolved explicit target to CONNECTION: ${resolvedConnection.name || resolvedConnection.direction} (${explicitTargetConnectionId})`,
                        type: 'internal'
                    });
                    // Connection found, proceed to dispatch event
                } else {
                    // --- 5b. If not a connection, try resolving as an ENTITY nearby ---
                    messages.push({
                        text: `Intent Parse: Target '${targetNameGuess}' not resolved as connection. Trying as entity...`,
                        type: 'internal'
                    });

                    // Removed notFoundMessageKey
                    const targetResolution = resolveTargetEntity(context, {
                        scope: 'location', // Search current location
                        requiredComponents: [], // Any named entity
                        // actionVerb: targetResolutionContext, // Keep for potential use
                        targetName: targetNameGuess,
                    });

                    // --- Handle Target Entity Resolution Status (Nested Switch) ---
                    switch (targetResolution.status) {
                        case 'FOUND_UNIQUE':
                            explicitTargetEntityId = targetResolution.entity.id;
                            messages.push({
                                text: `Intent Parse: Resolved explicit target to ENTITY: ${getDisplayName(targetResolution.entity)} (${explicitTargetEntityId})`,
                                type: 'internal'
                            });
                            // Entity found, proceed to dispatch event
                            break; // Break from nested switch

                        case 'NOT_FOUND':
                            dispatch('ui:message_display', {
                                text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetNameGuess),
                                type: 'info'
                            });
                            messages.push({
                                text: `Target resolution failed for '${targetNameGuess}', reason: NOT_FOUND.`,
                                type: 'internal'
                            });
                            return {success: false, messages}; // Exit outer function

                        case 'AMBIGUOUS':
                            const ambiguousTargetMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(targetResolutionContext, targetNameGuess, targetResolution.candidates);
                            dispatch('ui:message_display', {text: ambiguousTargetMsg, type: 'warning'});
                            messages.push({
                                text: `Target resolution failed for '${targetNameGuess}', reason: AMBIGUOUS.`,
                                type: 'internal'
                            });
                            return {success: false, messages}; // Exit outer function

                        case 'FILTER_EMPTY':
                            // Location scope was empty (or filtered empty)
                            dispatch('ui:message_display', {
                                text: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(targetResolutionContext, 'nearby'),
                                type: 'info'
                            });
                            messages.push({
                                text: `Target resolution failed for '${targetNameGuess}', reason: FILTER_EMPTY.`,
                                type: 'internal'
                            });
                            return {success: false, messages}; // Exit outer function

                        case 'INVALID_INPUT':
                            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                            messages.push({
                                text: `Target resolution failed for '${targetNameGuess}', reason: INVALID_INPUT.`,
                                type: 'internal_error'
                            });
                            console.error(`executeUse (Target): resolveTargetEntity returned INVALID_INPUT for target '${targetNameGuess}'. Context/Config issue?`);
                            return {success: false, messages}; // Exit outer function

                        default:
                            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                            console.error(`executeUse (Target): Unhandled resolution status: ${targetResolution.status}`);
                            messages.push({
                                text: `Unhandled target status: ${targetResolution.status}`,
                                type: 'internal_error'
                            });
                            return {success: false, messages}; // Exit outer function
                    }
                    // If nested switch case was 'FOUND_UNIQUE', execution continues below
                }
            } else {
                // No indirect object phrase was parsed. No target resolution needed.
                messages.push({text: `Intent Parse: No explicit target (IO Phrase) parsed.`, type: 'internal'});
            }

            // --- 6. Construct and Dispatch Event ---
            // Reached if:
            // a) Item resolved, no target needed.
            // b) Item resolved, target connection resolved.
            // c) Item resolved, target entity resolved.
            if (!eventBus) {
                console.error("executeUse: Critical Error! eventBus is not available.");
                dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                return {success: false, messages};
            }

            /** @type {ItemUseAttemptedEventPayload} */
            const eventPayload = {
                userEntityId: playerEntity.id,
                itemInstanceId: itemInstanceId,
                itemDefinitionId: itemDefinitionId,
                explicitTargetEntityId: explicitTargetEntityId,
                explicitTargetConnectionId: explicitTargetConnectionId,
            };

            try {
                eventBus.dispatch('event:item_use_attempted', eventPayload);
                let targetLog = explicitTargetEntityId ? ` on entity ${explicitTargetEntityId}` : (explicitTargetConnectionId ? ` on connection ${explicitTargetConnectionId}` : '');
                messages.push({
                    text: `Intent Success: Fired event:item_use_attempted for item ${itemDefinitionId}${targetLog}`,
                    type: 'internal'
                });
                return {success: true, messages}; // Parsing and dispatch successful
            } catch (error) {
                console.error(`executeUse: Error dispatching event:item_use_attempted:`, error);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: `Intent Failed: Error dispatching event. ${error.message}`, type: 'error'});
                return {success: false, messages};
            }
        } // End FOUND_UNIQUE case for item resolution

        case 'NOT_FOUND':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOT_FOUND_INVENTORY(itemNameGuess), type: 'info'});
            messages.push({
                text: `Item resolution failed for '${itemNameGuess}', reason: NOT_FOUND.`,
                type: 'internal'
            });
            return {success: false, messages};

        case 'AMBIGUOUS':
            const ambiguousItemMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('use', itemNameGuess, itemResolution.candidates);
            dispatch('ui:message_display', {text: ambiguousItemMsg, type: 'warning'});
            messages.push({
                text: `Item resolution failed for '${itemNameGuess}', reason: AMBIGUOUS.`,
                type: 'internal'
            });
            return {success: false, messages};

        case 'FILTER_EMPTY':
            // Inventory is empty
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
            messages.push({
                text: `Item resolution failed for '${itemNameGuess}', reason: FILTER_EMPTY (Inventory empty).`,
                type: 'internal'
            });
            return {success: false, messages};

        case 'INVALID_INPUT':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            messages.push({
                text: `Item resolution failed for '${itemNameGuess}', reason: INVALID_INPUT.`,
                type: 'internal_error'
            });
            console.error(`executeUse (Item): resolveTargetEntity returned INVALID_INPUT for target '${itemNameGuess}'. Context/Config issue?`);
            return {success: false, messages};

        default:
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            console.error(`executeUse (Item): Unhandled resolution status: ${itemResolution.status}`);
            messages.push({text: `Unhandled item status: ${itemResolution.status}`, type: 'internal_error'});
            return {success: false, messages};
    }
}