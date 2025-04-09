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
/** @typedef {import('../../src/entities/entity.js').default} Entity */

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
        // This already used TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT, no change needed here.
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // --- 1. Resolve Target Item using Service ---
    const itemInstanceToEquip = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent, EquippableComponent],
        actionVerb: 'equip',
        targetName: targetItemName,
        notFoundMessageKey: 'NOT_FOUND_EQUIPPABLE', // Correct key used by resolver
    });

    // --- 2. Handle Resolver Result ---
    if (!itemInstanceToEquip) {
        // Try to give more specific feedback if item exists but isn't equippable
        const tempItemInstance = resolveTargetEntity(context, {
            scope: 'inventory',
            requiredComponents: [ItemComponent], // Check if *any* item matches name
            actionVerb: 'equip', // Verb doesn't really matter here
            targetName: targetItemName,
            // Prevent resolver from dispatching its own 'not found' message here
            notFoundMessageKey: null, // Or a dummy key if needed, relies on outer check
        });
        if (tempItemInstance && !tempItemInstance.hasComponent(EquippableComponent)) {
            // --- Use TARGET_MESSAGES ---
            // This already used TARGET_MESSAGES.EQUIP_CANNOT, no change needed.
            const errorMsg = TARGET_MESSAGES.EQUIP_CANNOT(getDisplayName(tempItemInstance));
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        }
        // Otherwise, the resolver's original message (dispatched internally) stands if item wasn't found at all.
        return {success: false, messages, newState: undefined};
    }

    // --- 3. Validate Equipment Slot ---
    const itemIdToEquip = itemInstanceToEquip.id;
    const itemDisplayName = getDisplayName(itemInstanceToEquip);
    const equippableComp = itemInstanceToEquip.getComponent(EquippableComponent); // Confirmed by resolver

    const targetSlotId = equippableComp.getSlotId();

    if (!playerEquipment.hasSlot(targetSlotId)) {
        // --- Use TARGET_MESSAGES ---
        // This already used TARGET_MESSAGES.EQUIP_NO_SLOT, no change needed.
        const errorMsg = TARGET_MESSAGES.EQUIP_NO_SLOT(itemDisplayName, targetSlotId);
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: Player tried to equip to slot '${targetSlotId}' but EquipmentComponent doesn't define it.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const currentItemInSlotId = playerEquipment.getEquippedItem(targetSlotId);
    if (currentItemInSlotId !== null) {
        const currentItemInstance = entityManager.getEntityInstance(currentItemInSlotId);
        const currentItemName = getDisplayName(currentItemInstance);
        // Extract a user-friendly slot name if possible (e.g., 'hand' from 'slot_hand')
        const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop().replace(/^slot_/, '') : targetSlotId;

        // --- Use TARGET_MESSAGES ---
        // This already used TARGET_MESSAGES.EQUIP_SLOT_FULL, no change needed.
        const errorMsg = TARGET_MESSAGES.EQUIP_SLOT_FULL(currentItemName, slotName);
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- 4. Perform the Equip ---
    const removedFromInv = playerInventory.removeItem(itemIdToEquip);
    if (!removedFromInv) {
        // --- Refactor Internal Error ---
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR; // Use generic internal error template
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        // Keep specific details in the console log for debugging
        console.error(`executeEquip: removeItem failed for ${itemIdToEquip} (${itemDisplayName}) despite checks.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Removed ${itemIdToEquip} from inventory`, type: "internal"});

    const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
    if (!equipped) {
        // --- Refactor Internal Error ---
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR; // Use generic internal error template
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        // Keep specific details in the console log for debugging
        console.error(`executeEquip: equipItem failed for ${itemIdToEquip} (${itemDisplayName}) into ${targetSlotId}.`);
        
        playerInventory.addItem(itemIdToEquip);

        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Equipped ${itemIdToEquip} to ${targetSlotId}`, type: "internal"});

    let success = true;
    // --- Assess Success Message ---
    // As per ticket: "Likely okay as is." Leaving the hardcoded success message.
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
        // --- Refactor Internal Warning (using INTERNAL_ERROR template for consistency) ---
        // Although not directly dispatched to UI, standardize internal messages.
        messages.push({
            text: `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to dispatch item_equipped event)`,
            type: 'warning'
        });
    }

    return {success, messages, newState: undefined};
}