// src/actions/handlers/equipActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';


/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */ // Adjusted path assuming src/entities

export function executeEquip(context) {
    const {playerEntity, targets, entityManager, dispatch} = context;
    const messages = [];

    // --- Validate required targets ---
    if (!validateRequiredTargets(context, 'equip')) {
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }

    const targetItemName = targets.join(' ');

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Use TARGET_MESSAGES for component check ---
    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // --- 1. Resolve Target Item using Service (Prevent immediate dispatch) ---
    const itemInstanceToEquip = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent, EquippableComponent],
        actionVerb: 'equip',
        targetName: targetItemName,
        notFoundMessageKey: null, // <-- CHANGE: Let executeEquip handle the final message
        // Assuming 'null' prevents resolveTargetEntity from dispatching.
        // If not, you might need a specific flag like 'dispatchNotFoundMessage: false'
        // added to resolveTargetEntity's config options.
    });

    // --- 2. Handle Resolver Result and Dispatch Appropriate Message ---
    if (!itemInstanceToEquip) {
        // Now check if the item exists but isn't equippable, OR if it doesn't exist at all.
        const tempItemInstance = resolveTargetEntity(context, {
            scope: 'inventory',
            requiredComponents: [ItemComponent], // Check if *any* item matches name
            actionVerb: 'equip', // Verb doesn't really matter here
            targetName: targetItemName,
            notFoundMessageKey: null, // Prevent dispatch here too
        });

        if (tempItemInstance && !tempItemInstance.hasComponent(EquippableComponent)) {
            // Item found, but cannot be equipped
            const errorMsg = TARGET_MESSAGES.EQUIP_CANNOT(getDisplayName(tempItemInstance));
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        } else {
            // Item not found in inventory at all (or failed component check)
            // Use the message originally intended for the first resolver call.
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE(targetItemName);
            dispatch('ui:message_display', {text: errorMsg, type: 'info'}); // <-- ADDED DISPATCH
            return {success: false, messages: [{text: errorMsg, type: 'info'}], newState: undefined};
        }
        // Note: If the initial component check failed (e.g., no Inventory), that error
        // message would have been dispatched earlier. This path handles item resolution failures.
    }

    // --- 3. Validate Equipment Slot ---
    // (Rest of the function remains the same)
    const itemIdToEquip = itemInstanceToEquip.id;
    const itemDisplayName = getDisplayName(itemInstanceToEquip);
    const equippableComp = itemInstanceToEquip.getComponent(EquippableComponent);

    const targetSlotId = equippableComp.getSlotId();

    if (!playerEquipment.hasSlot(targetSlotId)) {
        const errorMsg = TARGET_MESSAGES.EQUIP_NO_SLOT(itemDisplayName, targetSlotId);
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: Player tried to equip to slot '${targetSlotId}' but EquipmentComponent doesn't define it.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const currentItemInSlotId = playerEquipment.getEquippedItem(targetSlotId);
    if (currentItemInSlotId !== null) {
        const currentItemInstance = entityManager.getEntityInstance(currentItemInSlotId);
        const currentItemName = getDisplayName(currentItemInstance);
        const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop().replace(/^slot_/, '') : targetSlotId;

        const errorMsg = TARGET_MESSAGES.EQUIP_SLOT_FULL(currentItemName, slotName);
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- 4. Perform the Equip ---
    const removedFromInv = playerInventory.removeItem(itemIdToEquip);
    if (!removedFromInv) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: removeItem failed for ${itemIdToEquip} (${itemDisplayName}) despite checks.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Removed ${itemIdToEquip} from inventory`, type: "internal"});

    const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
    if (!equipped) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: equipItem failed for ${itemIdToEquip} (${itemDisplayName}) into ${targetSlotId}.`);
        // Attempt to revert inventory removal
        playerInventory.addItem(itemIdToEquip);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Equipped ${itemIdToEquip} to ${targetSlotId}`, type: "internal"});

    let success = true;
    const successMsg = `You equip the ${itemDisplayName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // Dispatch the game event
    try {
        dispatch('event:item_equipped', {
            entity: playerEntity,
            itemId: itemIdToEquip,
            slotId: targetSlotId,
            itemInstance: itemInstanceToEquip
        });
        messages.push({text: `Dispatched event:item_equipped for ${itemIdToEquip}`, type: "internal"});
    } catch (e) {
        console.error("Failed to dispatch item_equipped event:", e);
        messages.push({
            text: `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to dispatch item_equipped event)`,
            type: 'warning'
        });
    }

    return {success, messages, newState: undefined};
}