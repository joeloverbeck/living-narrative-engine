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

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
// Import the new connection resolver
import {resolveTargetEntity, resolveTargetConnection} from '../../services/targetResolutionService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'core:action_use' action.
 * Attempts to parse the input into an item (from inventory) and an optional target
 * (connection or entity nearby), then fires 'event:item_use_attempted'.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    const {playerEntity, targets, entityManager, dataManager, dispatch, eventBus, currentLocation} = context;
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];

    // --- 1. Validate basic target presence & Get Full String ---
    // Note: 'use' often needs a direct object (the item), even if 'use item on target' splits later.
    // The initial validation ensures *something* was typed after 'use'.
    if (!validateRequiredCommandPart(context, 'use', 'directObjectPhrase')) { // [cite: file:handlers/useActionHandler.js]
        return {success: false, messages: [], newState: undefined}; // Validation failed, semantic event dispatched
    }
    const fullTargetString = targets.join(' ').trim();
    messages.push({text: `Intent Parse: Raw input string: '${fullTargetString}'`, type: 'internal'});

    // --- 2. Pre-check Inventory ---
    // It's still reasonable to check if inventory is completely empty first.
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'internal'});
        return {success: false, messages};
    }
    // Check for *completely* empty inventory
    if (inventoryComponent.getItems().length === 0) {
        // *** This explains the "You aren't carrying anything" message in the specific test case ***
        // This check happens BEFORE attempting to resolve *any* item name.
        dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
        messages.push({text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'internal'});
        return {success: false, messages};
    }

    // --- 3. Parse Input String: Separate Item Guess from Target Guess ---
    let itemNameGuess = fullTargetString; // Default: assume entire string is item name
    let targetNameGuess = null; // Default: assume no separate target specified
    let usedSeparator = '';

    // Define separators (regex matching space-padded "on", "at", or ">")
    const separatorRegex = /\s+(on|at|>)\s+/i;
    const separatorMatch = fullTargetString.match(separatorRegex);

    if (separatorMatch && separatorMatch.index > 0) { // Make sure separator isn't at the very start
        usedSeparator = separatorMatch[1]; // "on", "at", or ">"
        itemNameGuess = fullTargetString.substring(0, separatorMatch.index).trim();
        targetNameGuess = fullTargetString.substring(separatorMatch.index + separatorMatch[0].length).trim();

        // Basic check: ensure guesses are not empty after splitting
        if (!itemNameGuess || !targetNameGuess) {
            messages.push({text: `Intent Parse: Invalid split with separator '${usedSeparator}'.`, type: 'warning'});
            // Treat as if no separator found if split results in empty parts
            itemNameGuess = fullTargetString;
            targetNameGuess = null;
            usedSeparator = '';
        } else {
            messages.push({
                text: `Intent Parse: Split with '${usedSeparator}'. Item guess: '${itemNameGuess}', Target guess: '${targetNameGuess}'`,
                type: 'internal'
            });
        }
    } else {
        messages.push({
            text: `Intent Parse: No separator found. Item guess: '${itemNameGuess}', No explicit target.`,
            type: 'internal'
        });
    }


    // --- 4. Resolve the Item ---
    // Use the itemNameGuess derived from parsing
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory', // IMPORTANT: Search only inventory for the item to USE
        requiredComponents: [ItemComponent],
        actionVerb: 'use',
        targetName: itemNameGuess, // Use the parsed item name guess
        notFoundMessageKey: 'NOT_FOUND_INVENTORY', // Use the correct key for item-not-found-in-inventory
    });

    if (!targetItemEntity) {
        // resolveTargetEntity should have dispatched the appropriate message (NOT_FOUND_INVENTORY or AMBIGUOUS_PROMPT)
        messages.push({
            text: `Intent Failed: Could not resolve unique item from '${itemNameGuess}' in inventory.`,
            type: 'internal'
        });
        return {success: false, messages}; // Failure, message already sent by resolver
    }

    // --- Successfully resolved unique item ---
    const itemInstanceId = targetItemEntity.id;
    const itemComponent = targetItemEntity.getComponent(ItemComponent);
    const itemDefinition = dataManager.getEntityDefinition(itemComponent?.definitionId || itemInstanceId);
    const itemDefinitionId = itemDefinition?.id || itemInstanceId; // Prefer definition ID if available
    const foundItemName = getDisplayName(targetItemEntity); // Get display name for messages/context
    messages.push({
        text: `Intent Parse: Resolved item: ${foundItemName} (${itemInstanceId}, def: ${itemDefinitionId})`,
        type: 'internal'
    });


    // --- 5. Resolve the Explicit Target (if one was parsed) ---
    let explicitTargetEntityId = null;
    let explicitTargetConnectionId = null;
    let resolvedTargetSuccess = false; // Flag to track if target resolution was needed and successful

    if (targetNameGuess) {
        messages.push({
            text: `Intent Parse: Attempting to resolve explicit target guess: '${targetNameGuess}'`,
            type: 'internal'
        });

        // --- 5a. Try resolving as a CONNECTION first ---
        const resolvedConnection = resolveTargetConnection(
            context,
            targetNameGuess,
            `use ${foundItemName} ${usedSeparator || 'on'}` // Provide context verb
        );

        if (resolvedConnection) {
            explicitTargetConnectionId = resolvedConnection.connectionId;
            resolvedTargetSuccess = true; // Found connection target
            messages.push({
                text: `Intent Parse: Resolved explicit target to CONNECTION: ${resolvedConnection.name || resolvedConnection.direction} (${explicitTargetConnectionId})`,
                type: 'internal'
            });
        } else {
            // --- 5b. If not a connection, try resolving as an ENTITY nearby ---
            // Note: resolveTargetConnection already dispatched failure message if ambiguous/not found *as connection*.
            messages.push({
                text: `Intent Parse: Target '${targetNameGuess}' not resolved as a connection. Trying as entity...`,
                type: 'internal'
            });

            const explicitTargetEntity = resolveTargetEntity(context, {
                // Search location, potentially excluding self if needed? Check resolver logic. Assume 'location' means 'others in location'.
                scope: 'location', // Search things in the current location (excluding player)
                // scope: 'nearby', // Alternative: includes inventory+location - choose appropriate scope
                requiredComponents: [], // Any named entity usually works for 'use on X'
                actionVerb: `use ${foundItemName} ${usedSeparator || 'on'}`,
                targetName: targetNameGuess, // Use the parsed target name guess
                // Use a specific message key for "couldn't find the thing you wanted to use the item ON"
                notFoundMessageKey: 'TARGET_NOT_FOUND_CONTEXT',
            });

            if (explicitTargetEntity) {
                explicitTargetEntityId = explicitTargetEntity.id;
                resolvedTargetSuccess = true; // Found entity target
                messages.push({
                    text: `Intent Parse: Resolved explicit target to ENTITY: ${getDisplayName(explicitTargetEntity)} (${explicitTargetEntityId})`,
                    type: 'internal'
                });
            } else {
                // Failed to resolve as EITHER connection or entity.
                // resolveTargetEntity (or resolveTargetConnection previously) should have dispatched the final failure message.
                resolvedTargetSuccess = false; // Target specified but resolution failed
                messages.push({
                    text: `Intent Failed: Explicit target '${targetNameGuess}' specified but could not be resolved uniquely as connection or entity nearby.`,
                    type: 'internal'
                });
                // Return failure because the user specified a target that wasn't valid
                return {success: false, messages};
            }
        }
    } else {
        // No target name was parsed after the item name.
        resolvedTargetSuccess = true; // Considered success as no target resolution was needed.
        messages.push({text: `Intent Parse: No explicit target name specified after item.`, type: 'internal'});
    }

    // --- 6. Construct and Dispatch Event ---
    // We only get here if item resolution succeeded AND (if target was specified) target resolution succeeded.
    if (!eventBus) {
        // ... (error handling for missing eventBus) ...
        console.error("executeUse: Critical Error! eventBus is not available.");
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages};
    }

    /** @type {ItemUseAttemptedEventPayload} */
    const eventPayload = {
        userEntityId: playerEntity.id,
        itemInstanceId: itemInstanceId,
        itemDefinitionId: itemDefinitionId, // Use the resolved definition ID
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
}