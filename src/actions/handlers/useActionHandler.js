// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../../components/connectionsComponent.js').ConnectionsComponent} ConnectionsComponent */
// Connection type likely not directly needed here anymore
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */ // Ensure this type is up-to-date
/** @typedef {import('../actionTypes.js').ParsedCommand} ParsedCommand */

// --- Standard Imports ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
// NameComponent, PositionComponent, ConnectionsComponent likely not needed directly here anymore
import {ItemComponent} from '../../components/itemComponent.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {resolveTargetConnection} from '../../services/connectionResolver.js'; // Assumes this returns Entity | null per CONN-5
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// --- Refactored Imports ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';


/**
 * Handles the 'core:use' action.
 * Resolves the item to be used from inventory.
 * If an indirect object is specified, attempts to resolve it first as a Connection Entity,
 * then as a regular Entity in the location.
 * Dispatches UI messages based on resolution status and 'event:item_use_attempted' on success,
 * with a payload distinguishing between entity and connection entity targets.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    const {
        playerEntity,
        entityManager, // Still needed for entity resolution
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
        return {success: false, messages: [], newState: undefined};
    }

    // --- 2. Check if player entity/inventory exists ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'internal'});
        return {success: false, messages};
    }

    // --- 3. Get Item Name and Potential Target Name from Parsed Command ---
    const itemNameGuess = parsedCommand.directObjectPhrase;
    const targetNameGuess = parsedCommand.indirectObjectPhrase; // May be null
    const usedPreposition = parsedCommand.preposition; // May be null

    messages.push({
        text: `Intent Parse: Item guess: '${itemNameGuess}'. Target guess: '${targetNameGuess || 'None'}'. Prep: '${usedPreposition || 'None'}'.`,
        type: 'internal'
    });

    // --- 4. Resolve the Item ---
    const itemResolution = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        targetName: itemNameGuess,
    });

    // --- Handle Item Resolution Status ---
    switch (itemResolution.status) {
        case 'FOUND_UNIQUE': {
            const targetItemEntity = itemResolution.entity;
            const itemInstanceId = targetItemEntity.id;
            const itemComponent = targetItemEntity.getComponent(ItemComponent);
            const itemDefinition = dataManager.getEntityDefinition(itemComponent?.definitionId || itemInstanceId);
            const itemDefinitionId = itemDefinition?.id || itemInstanceId;
            const foundItemName = getDisplayName(targetItemEntity);

            messages.push({
                text: `Intent Parse: Resolved item: ${foundItemName} (${itemInstanceId}, def: ${itemDefinitionId})`,
                type: 'internal'
            });

            // --- 5. Resolve the Explicit Target (if one was parsed) ---
            // Initialize target IDs - they are mutually exclusive
            let explicitTargetEntityId = null;
            let explicitTargetConnectionEntityId = null; // << CHANGED: Renamed variable
            let resolvedConnectionEntity = null; // << ADDED: To store the resolved Connection Entity object

            if (targetNameGuess) {
                messages.push({
                    text: `Intent Parse: Attempting to resolve explicit target from IO: '${targetNameGuess}'`,
                    type: 'internal'
                });

                const targetResolutionContext = `use ${foundItemName} ${usedPreposition || 'on'}`;

                // --- 5a. Try resolving as a CONNECTION ENTITY first ---
                // resolveTargetConnection now returns the Entity object or null (per CONN-5)
                resolvedConnectionEntity = resolveTargetConnection(context, targetNameGuess, targetResolutionContext); // << CHANGED: Store resolved Entity

                if (resolvedConnectionEntity) {
                    // Connection Entity found!
                    explicitTargetConnectionEntityId = resolvedConnectionEntity.id; // << CHANGED: Store the Entity's ID
                    explicitTargetEntityId = null; // Ensure regular entity target is null
                    messages.push({
                        text: `Intent Parse: Resolved explicit target to CONNECTION ENTITY: ${getDisplayName(resolvedConnectionEntity)} (${explicitTargetConnectionEntityId})`, // << CHANGED: Log uses Entity ID
                        type: 'internal'
                    });
                    // Proceed directly to event dispatch
                } else {
                    // --- 5b. If not a connection entity, try resolving as a regular ENTITY nearby ---
                    messages.push({
                        text: `Intent Parse: Target '${targetNameGuess}' not resolved as connection entity. Trying as regular entity...`, // << CHANGED: Wording
                        type: 'internal'
                    });

                    const targetResolution = resolveTargetEntity(context, {
                        scope: 'location', // Search current location
                        requiredComponents: [], // Any named entity
                        targetName: targetNameGuess,
                    });

                    // --- Handle Target Entity Resolution Status (Nested Switch) ---
                    switch (targetResolution.status) {
                        case 'FOUND_UNIQUE':
                            // Regular Entity found!
                            explicitTargetEntityId = targetResolution.entity.id;
                            explicitTargetConnectionEntityId = null; // Ensure connection entity target is null
                            messages.push({
                                text: `Intent Parse: Resolved explicit target to ENTITY: ${getDisplayName(targetResolution.entity)} (${explicitTargetEntityId})`,
                                type: 'internal'
                            });
                            // Proceed to event dispatch
                            break; // Break from nested switch

                        // --- Failure cases for target resolution ---
                        case 'NOT_FOUND':
                            dispatch('ui:message_display', {text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetNameGuess), type: 'info'});
                            messages.push({text: `Target resolution failed for '${targetNameGuess}', reason: NOT_FOUND.`, type: 'internal'});
                            return {success: false, messages}; // Exit outer function
                        case 'AMBIGUOUS':
                            const ambiguousTargetMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(targetResolutionContext, targetNameGuess, targetResolution.candidates);
                            dispatch('ui:message_display', {text: ambiguousTargetMsg, type: 'warning'});
                            messages.push({text: `Target resolution failed for '${targetNameGuess}', reason: AMBIGUOUS.`, type: 'internal'});
                            return {success: false, messages}; // Exit outer function
                        case 'FILTER_EMPTY':
                            dispatch('ui:message_display', {text: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(targetResolutionContext, 'nearby'), type: 'info'});
                            messages.push({text: `Target resolution failed for '${targetNameGuess}', reason: FILTER_EMPTY.`, type: 'internal'});
                            return {success: false, messages}; // Exit outer function
                        case 'INVALID_INPUT':
                            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                            messages.push({text: `Target resolution failed for '${targetNameGuess}', reason: INVALID_INPUT.`, type: 'internal_error'});
                            console.error(`executeUse (Target): resolveTargetEntity returned INVALID_INPUT for target '${targetNameGuess}'. Context/Config issue?`);
                            return {success: false, messages}; // Exit outer function
                        default: // Unhandled status
                            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                            console.error(`executeUse (Target): Unhandled resolution status: ${targetResolution.status}`);
                            messages.push({text: `Unhandled target status: ${targetResolution.status}`, type: 'internal_error'});
                            return {success: false, messages}; // Exit outer function
                    }
                    // If nested switch case was 'FOUND_UNIQUE' for entity, execution continues below
                }
            } else {
                // No indirect object phrase was parsed. No explicit target.
                // Both explicitTargetEntityId and explicitTargetConnectionEntityId remain null.
                messages.push({text: `Intent Parse: No explicit target (IO Phrase) parsed.`, type: 'internal'});
            }

            // --- 6. Construct and Dispatch Event ---
            // Reached if:
            // a) Item resolved, no target specified.
            // b) Item resolved, target resolved as Connection Entity.
            // c) Item resolved, target resolved as regular Entity.
            if (!eventBus) {
                console.error("executeUse: Critical Error! eventBus is not available.");
                dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                return {success: false, messages};
            }

            // Construct the payload using the potentially populated target IDs
            /** @type {ItemUseAttemptedEventPayload} */
            const eventPayload = {
                userEntityId: playerEntity.id,
                itemInstanceId: itemInstanceId,
                itemDefinitionId: itemDefinitionId,
                explicitTargetEntityId: explicitTargetEntityId,           // Will be ID or null
                explicitTargetConnectionEntityId: explicitTargetConnectionEntityId // << CHANGED: Use new field name and value
            };

            try {
                eventBus.dispatch('event:item_use_attempted', eventPayload);
                // Update log message to reflect the correct target type and ID
                let targetLog = '';
                if (eventPayload.explicitTargetEntityId) {
                    targetLog = ` on entity ${eventPayload.explicitTargetEntityId}`;
                } else if (eventPayload.explicitTargetConnectionEntityId) {
                    targetLog = ` on connection entity ${eventPayload.explicitTargetConnectionEntityId}`; // << CHANGED: Log message clarity
                }
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

        // --- Failure cases for item resolution ---
        case 'NOT_FOUND':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOT_FOUND_INVENTORY(itemNameGuess), type: 'info'});
            messages.push({text: `Item resolution failed for '${itemNameGuess}', reason: NOT_FOUND.`, type: 'internal'});
            return {success: false, messages};
        case 'AMBIGUOUS':
            const ambiguousItemMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('use', itemNameGuess, itemResolution.candidates);
            dispatch('ui:message_display', {text: ambiguousItemMsg, type: 'warning'});
            messages.push({text: `Item resolution failed for '${itemNameGuess}', reason: AMBIGUOUS.`, type: 'internal'});
            return {success: false, messages};
        case 'FILTER_EMPTY':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
            messages.push({text: `Item resolution failed for '${itemNameGuess}', reason: FILTER_EMPTY (Inventory empty).`, type: 'internal'});
            return {success: false, messages};
        case 'INVALID_INPUT':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            messages.push({text: `Item resolution failed for '${itemNameGuess}', reason: INVALID_INPUT.`, type: 'internal_error'});
            console.error(`executeUse (Item): resolveTargetEntity returned INVALID_INPUT for target '${itemNameGuess}'. Context/Config issue?`);
            return {success: false, messages};
        default: // Unhandled status
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            console.error(`executeUse (Item): Unhandled resolution status: ${itemResolution.status}`);
            messages.push({text: `Unhandled item status: ${itemResolution.status}`, type: 'internal_error'});
            return {success: false, messages};
    }
}