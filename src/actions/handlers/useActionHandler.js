// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../events/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

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
    const {playerEntity, targets, entityManager, dispatch, eventBus} = context;
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];

    // --- 1. Validate required target (item name) ---
    if (!validateRequiredTargets(context, 'use')) {
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }
    const fullTargetString = targets.join(' '); // Full user input string

    // --- 2. Get Player Inventory (Still needed for pre-check) ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        // Uses TARGET_MESSAGES as required
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'internal'}); // Internal log message
        return {success: false, messages};
    }
    if (inventoryComponent.getItems().length === 0) {
        // Uses TARGET_MESSAGES as required
        dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
        messages.push({text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'internal'}); // Internal log message mirrors user message
        return {success: false, messages};
    }

    // --- 3. Find Target Item using Service ---
    // Note: resolveTargetEntity handles its own user-facing messages for NOT_FOUND/AMBIGUOUS
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        actionVerb: 'use',
        targetName: fullTargetString,
        notFoundMessageKey: 'NOT_FOUND_INVENTORY',
    });

    // --- Handle Item Resolver Result ---
    if (!targetItemEntity) {
        // No user-facing message here; resolveTargetEntity dispatched it.
        messages.push({
            text: `Intent Failed: Could not resolve unique item from '${fullTargetString}' in inventory.`,
            type: 'internal'
        });
        return {success: false, messages};
    }

    // --- Successfully found unique item ---
    const itemInstanceId = targetItemEntity.id;
    const itemDefinitionId = targetItemEntity.id; // Assume Definition ID = Instance ID for now
    const foundItemName = getDisplayName(targetItemEntity);
    messages.push({text: `Intent Parse: Found item: ${foundItemName} (${itemInstanceId})`, type: 'internal'});


    // --- 4. Identify Explicit Target Entity (if any) ---
    let explicitTargetEntityId = null;
    let explicitTargetEntity = null;

    // (Parsing logic to separate item name from potential explicit target name - remains unchanged)
    const foundItemNameWords = foundItemName.toLowerCase().split(' ');
    const targetWords = fullTargetString.toLowerCase().split(' ');

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
        // Fallback if exact name match fails (e.g., partial match)
        // This might indicate resolveTargetEntity found a synonym or alias
        itemWordsEndIndex = foundItemNameWords.length - 1;
        console.warn(`executeUse: Potential parsing mismatch between resolved item name '${foundItemName}' and input '${fullTargetString}'`);
        messages.push({
            text: `Intent Parse: Potential item name mismatch. Proceeding assuming item is '${foundItemName}'.`,
            type: 'internal'
        });
    }

    const remainingTargetWords = targets.slice(itemWordsEndIndex + 1).filter(
        word => word.toLowerCase() !== 'on' && word.toLowerCase() !== 'at'
    );

    if (remainingTargetWords.length > 0) {
        const explicitTargetName = remainingTargetWords.join(' ');
        messages.push({
            text: `Intent Parse: Potential explicit target name: '${explicitTargetName}'`,
            type: 'internal'
        });

        const playerPos = playerEntity.getComponent(PositionComponent);
        if (!playerPos?.locationId) {
            console.warn(`executeUse: Player ${playerEntity.id} missing PositionComponent or locationId; cannot resolve explicit target '${explicitTargetName}'.`);
            // Note: No direct user message here, resolution failure below will handle it if target not found.
            messages.push({
                text: `Intent Failed: Cannot resolve explicit target '${explicitTargetName}' - player location unknown.`,
                type: 'internal' // Internal log
            });
            // Continue, maybe the item doesn't *need* an explicit target found nearby
        } else {
            // Note: resolveTargetEntity handles its own user-facing messages for NOT_FOUND/AMBIGUOUS
            explicitTargetEntity = resolveTargetEntity(context, {
                scope: 'location', // Search things in the current location (excluding player)
                requiredComponents: [], // Any named entity in the location
                actionVerb: `use ${foundItemName} on`,
                targetName: explicitTargetName,
                notFoundMessageKey: 'TARGET_NOT_FOUND_CONTEXT',
            });

            if (explicitTargetEntity) {
                explicitTargetEntityId = explicitTargetEntity.id;
                messages.push({
                    text: `Intent Parse: Resolved explicit target to ${getDisplayName(explicitTargetEntity)} (${explicitTargetEntityId})`,
                    type: 'internal'
                });
            } else {
                // No user-facing message here; resolveTargetEntity dispatched it.
                messages.push({
                    text: `Intent Failed: Could not resolve unique explicit target '${explicitTargetName}' nearby.`,
                    type: 'internal'
                });
                return {success: false, messages}; // Fail the action if explicit target was specified but not found
            }
        }
    } else {
        messages.push({text: `Intent Parse: No explicit target name specified.`, type: 'internal'});
    }

    // --- 5. Construct and Dispatch Event ---
    if (!eventBus) {
        console.error("executeUse: Critical Error! eventBus is not available in the action context.");
        // --- REFACTOR START ---
        // Use the generic internal error message from TARGET_MESSAGES
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        // --- REFACTOR END ---
        messages.push({text: "Intent Failed: Event bus missing.", type: 'error'});
        return {success: false, messages};
    }

    /** @type {ItemUseAttemptedEventPayload} */
    const eventPayload = {
        userEntityId: playerEntity.id,
        itemInstanceId: itemInstanceId,
        itemDefinitionId: itemDefinitionId, // Assuming this is correct for now
        explicitTargetEntityId: explicitTargetEntityId,
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
        // --- REFACTOR START ---
        // Use the generic internal error message from TARGET_MESSAGES
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        // --- REFACTOR END ---
        messages.push({text: `Intent Failed: Error dispatching event. ${error.message}`, type: 'error'});
        // success remains false
    }

    // --- 6. Return Result ---
    return {success, messages}; // Return success based on event dispatch attempt
}