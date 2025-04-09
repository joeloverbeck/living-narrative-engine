// src/actions/handlers/dropActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {ItemComponent} from "../../components/itemComponent.js";
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'drop' action ('core:action_drop'). Allows the player to drop items
 * from their inventory into the current location.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action.
 */
export function executeDrop(context) {
    const {playerEntity, currentLocation, targets, entityManager, dispatch} = context;
    const messages = [];
    // Use a consistent error message for internal issues in this handler
    const internalErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR;

    // --- Basic Validation ---
    if (!playerEntity || !currentLocation) {
        console.error("executeDrop: Missing player or location in context.");
        // Already using TARGET_MESSAGES.INTERNAL_ERROR - OK
        dispatch('ui:message_display', {text: internalErrorMsg, type: 'error'});
        return {success: false, messages: [{text: internalErrorMsg, type: 'error'}]};
    }

    // --- Validate required targets ---
    if (!validateRequiredTargets(context, 'drop')) {
        // Validation failed, message dispatched by utility (using TARGET_MESSAGES)
        return {success: false, messages: [], newState: undefined};
    }

    const targetName = targets.join(' ');

    // --- Get Player Inventory ---
    const playerInventory = playerEntity.getComponent(InventoryComponent);
    if (!playerInventory) {
        // Already using TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT - OK
        const componentErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: componentErrorMsg, type: 'error'});
        console.error("executeDrop: Player entity missing InventoryComponent.");
        return {success: false, messages: [{text: componentErrorMsg, type: 'error'}]};
    }

    // --- 1. Resolve Target Item using Service ---
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        actionVerb: 'drop',
        targetName: targetName,
        // Use specific inventory not found message if resolveTargetEntity determines NOT_FOUND
        notFoundMessageKey: 'NOT_FOUND_INVENTORY'
    });

    // --- 2. Handle Resolver Result ---
    if (!targetItemEntity) {
        // Failure message already dispatched by resolveTargetEntity (using TARGET_MESSAGES)
        return {success: false, messages: []}; // Return failure
    }

    // --- 3. Perform the Drop Action ---
    const targetItemId = targetItemEntity.id;
    const itemName = getDisplayName(targetItemEntity);

    // a. Remove itemId from playerEntity's InventoryComponent
    const removed = playerInventory.removeItem(targetItemId);
    if (!removed) {
        // Use the standard internal error message for user feedback
        dispatch('ui:message_display', {text: internalErrorMsg, type: 'error'});
        // Keep detailed console log for debugging
        console.error(`executeDrop: Failed to remove item ${targetItemId} (${itemName}) which was found by resolver.`);
        return {success: false, messages: [{text: internalErrorMsg, type: 'error'}]};
    }
    messages.push({text: `Removed ${itemName} (${targetItemId}) from inventory`, type: 'internal'});


    // b. Get/Ensure itemEntity has PositionComponent
    let positionComp = targetItemEntity.getComponent(PositionComponent);
    if (!positionComp) {
        console.warn(`executeDrop: Item ${targetItemId} (${itemName}) missing PositionComponent. Adding one.`);
        try {
            positionComp = new PositionComponent({locationId: null, x: 0, y: 0});
            targetItemEntity.addComponent(positionComp);
        } catch (addCompError) {
            // Use the standard internal error message for user feedback
            dispatch('ui:message_display', {text: internalErrorMsg, type: 'error'});
            // Keep detailed console log for debugging
            console.error(`executeDrop: Failed to add PositionComponent to item ${targetItemId} (${itemName}):`, addCompError);
            // Attempt to revert the inventory change on failure
            playerInventory.addItem(targetItemId);
            return {success: false, messages: [{text: internalErrorMsg, type: 'error'}]};
        }
    }

    // c. Set PositionComponent's locationId to currentLocation.id
    const oldLocationId = positionComp.locationId;
    positionComp.setLocation(currentLocation.id, 0, 0);
    messages.push({text: `Set ${itemName} (${targetItemId}) position to ${currentLocation.id}`, type: 'internal'});

    // d. Call entityManager.notifyPositionChange
    entityManager.notifyPositionChange(targetItemId, oldLocationId, currentLocation.id);
    messages.push({text: `Notified position change for ${itemName} (${targetItemId})`, type: 'internal'});

    // e. Add relevant UI messages
    // Success message remains as is, per ticket description
    const successMsg = `You drop the ${itemName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // f. (Optional) Dispatch game event
    try {
        dispatch('event:item_dropped', {
            dropperId: playerEntity.id,
            itemId: targetItemId,
            locationId: currentLocation.id,
            itemInstance: targetItemEntity
        });
        messages.push({text: `Dispatched event:item_dropped for ${itemName}`, type: 'internal'});
    } catch (e) {
        console.error("Failed to dispatch item_dropped event:", e);
        // This message is internal, not directly user-facing via dispatch, so keep as is per ticket scope.
        messages.push({text: "Internal warning: Failed to dispatch item_dropped event.", type: 'warning'});
    }


    // --- Return Success ---
    return {
        success: true,
        messages: messages,
        newState: undefined
    };
}