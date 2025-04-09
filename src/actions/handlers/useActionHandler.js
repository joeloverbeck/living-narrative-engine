// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
// NameComponent needed for parsing, PositionComponent needed for player location
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../events/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ItemComponent} from '../../components/itemComponent.js'; // Assume usable things are items

// Import messages and the new service
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/targetResolutionService.js'; // ***** IMPORT NEW SERVICE *****

/**
 * Handles the 'core:action_use' action.
 * Validates player intent using TargetResolutionService, identifies the item instance
 * and an optional explicit target entity nearby, then fires 'event:item_use_attempted'.
 * Does NOT check usability, conditions, apply effects, or consume the item.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    const {playerEntity, targets, entityManager, dispatch, eventBus} = context; // Added eventBus
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];

    // --- 1. Check for Target Input (Item Name) ---
    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('use');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: No item target provided.", type: 'internal'});
        return {success: false, messages};
    }
    const fullTargetString = targets.join(' '); // Full user input string

    // --- 2. Get Player Inventory (Still needed for pre-check) ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'error'});
        return {success: false, messages};
    }
    if (inventoryComponent.getItems().length === 0) {
        // Give specific "nothing carried" feedback before trying to resolve
        dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
        return {success: false, messages: [{text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'}]};
    }


    // --- 3. Find Target Item using Service ---
    // Use the full target string initially to find the item.
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent], // Assume usable things are items
        actionVerb: 'use',
        targetName: fullTargetString, // Try matching against the whole string first
        notFoundMessageKey: 'NOT_FOUND_INVENTORY',
        // emptyScopeMessage: TARGET_MESSAGES.NOTHING_CARRIED, // Already checked above
    });

    // --- Handle Item Resolver Result ---
    if (!targetItemEntity) {
        // Failure message dispatched by resolver.
        // This could be NOT_FOUND or AMBIGUOUS based on the full string.
        messages.push({
            text: `Intent Failed: Could not resolve unique item from '${fullTargetString}' in inventory.`,
            type: 'internal'
        });
        return {success: false, messages};
    }

    // --- Successfully found unique item ---
    const itemInstanceId = targetItemEntity.id;
    // Assume Definition ID = Instance ID for now, adjust if necessary
    const itemDefinitionId = targetItemEntity.id;
    const foundItemName = getDisplayName(targetItemEntity);
    messages.push({text: `Intent Parse: Found item: ${foundItemName} (${itemInstanceId})`, type: 'internal'});


    // --- 4. Identify Explicit Target Entity (if any) ---
    let explicitTargetEntityId = null;
    let explicitTargetEntity = null; // Store the entity instance if found

    // Heuristic: Try to extract target name after item name + potential preposition
    // Example: "use red potion on goblin"
    const foundItemNameWords = foundItemName.toLowerCase().split(' ');
    const targetWords = fullTargetString.toLowerCase().split(' ');

    // Find end index of item name within the target words
    let itemWordsEndIndex = -1;
    let match = true;
    for (let i = 0; i < foundItemNameWords.length; i++) {
        if (i >= targetWords.length || targetWords[i] !== foundItemNameWords[i]) {
            match = false;
            break;
        }
    }
    if (match) {
        itemWordsEndIndex = foundItemNameWords.length - 1;
    } else {
        // Fallback/Alternative: Might need more robust parsing if item names can be substrings
        // For now, assume the resolver correctly matched the start of the string
        itemWordsEndIndex = foundItemNameWords.length - 1;
        console.warn(`executeUse: Potential parsing mismatch between resolved item name '${foundItemName}' and input '${fullTargetString}'`);
        messages.push({
            text: `Intent Parse: Potential item name mismatch. Proceeding assuming item is '${foundItemName}'.`,
            type: 'internal'
        });
    }

    // Extract potential target words, removing common prepositions
    const remainingTargetWords = targets.slice(itemWordsEndIndex + 1).filter(
        word => word.toLowerCase() !== 'on' && word.toLowerCase() !== 'at'
    );

    if (remainingTargetWords.length > 0) {
        const explicitTargetName = remainingTargetWords.join(' ');
        messages.push({
            text: `Intent Parse: Potential explicit target name: '${explicitTargetName}'`,
            type: 'internal'
        });

        // --- Use Resolver to find the explicit target nearby ---
        const playerPos = playerEntity.getComponent(PositionComponent);
        if (!playerPos?.locationId) {
            console.warn(`executeUse: Player ${playerEntity.id} missing PositionComponent or locationId; cannot resolve explicit target '${explicitTargetName}'.`);
            messages.push({
                text: `Intent Failed: Cannot resolve explicit target '${explicitTargetName}' - player location unknown.`,
                type: 'warning'
            });
            // Dispatch UI message? Maybe not, let USE system handle lack of target later if needed.
            // We can proceed without an explicit target ID.
        } else {
            // Use resolver to find the target in the location
            explicitTargetEntity = resolveTargetEntity(context, {
                scope: 'location', // Search things in the current location (excluding player)
                requiredComponents: [], // Any named entity in the location
                actionVerb: `use ${foundItemName} on`, // More specific verb for messages
                targetName: explicitTargetName,
                // Use specific message keys for context target resolution
                notFoundMessageKey: 'TARGET_NOT_FOUND_CONTEXT', // Pass the item name somehow? No, just target desc.
                // Ambiguous prompt uses actionVerb, targetName, matches - should be okay.
            });

            // --- Handle Explicit Target Resolver Result ---
            if (explicitTargetEntity) {
                explicitTargetEntityId = explicitTargetEntity.id;
                messages.push({
                    text: `Intent Parse: Resolved explicit target to ${getDisplayName(explicitTargetEntity)} (${explicitTargetEntityId})`,
                    type: 'internal'
                });
            } else {
                // Failure message (NOT_FOUND or AMBIGUOUS) dispatched by resolver.
                // If a target name was provided but not resolved, fail the action intent.
                messages.push({
                    text: `Intent Failed: Could not resolve unique explicit target '${explicitTargetName}' nearby.`,
                    type: 'internal'
                });
                return {success: false, messages};
            }
        }
    } else {
        messages.push({text: `Intent Parse: No explicit target name specified.`, type: 'internal'});
        // explicitTargetEntityId remains null
    }

    // --- 5. Construct and Dispatch Event ---
    if (!eventBus) {
        console.error("executeUse: Critical Error! eventBus is not available in the action context.");
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Event system unavailable)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Event bus missing.", type: 'error'});
        return {success: false, messages};
    }

    /** @type {ItemUseAttemptedEventPayload} */
    const eventPayload = {
        userEntityId: playerEntity.id,
        itemInstanceId: itemInstanceId,
        itemDefinitionId: itemDefinitionId,
        explicitTargetEntityId: explicitTargetEntityId,
        // Could pass resolved item/target instances too if systems need them directly
        // itemInstance: targetItemEntity,
        // explicitTargetInstance: explicitTargetEntity,
    };

    let success = false; // Default false
    try {
        eventBus.dispatch('event:item_use_attempted', eventPayload);
        success = true; // Set success only if dispatch works
        messages.push({
            text: `Intent Success: Fired event:item_use_attempted for item ${itemDefinitionId}` + (explicitTargetEntityId ? ` on ${explicitTargetEntityId}` : ''),
            type: 'internal'
        });
    } catch (error) {
        console.error(`executeUse: Error dispatching event:item_use_attempted:`, error);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Event dispatch failed)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: `Intent Failed: Error dispatching event. ${error.message}`, type: 'error'});
        // success remains false
    }

    // --- 6. Return Success (Intent validated and event dispatched) ---
    return {success, messages};
}