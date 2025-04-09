// src/actions/handlers/equipActionHandler.js

// Import necessary components and utilities
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js';
import {ItemComponent} from '../../components/itemComponent.js'; // Needed for requiredComponents
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js'; // ***** IMPORT NEW SERVICE *****

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

export function executeEquip(context) {
    const {playerEntity, targets, entityManager, dispatch} = context;
    const messages = [];
    // let success = false; // Determined later

    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('equip');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const targetItemName = targets.join(' ');

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // --- 1. Resolve Target Item using Service ---
    const itemInstanceToEquip = resolveTargetEntity(context, {
        scope: 'inventory',
        // Require ItemComponent as well, logically makes sense for something equippable.
        requiredComponents: [ItemComponent, EquippableComponent],
        actionVerb: 'equip',
        targetName: targetItemName,
        notFoundMessageKey: 'NOT_FOUND_EQUIPPABLE', // Specific key for this context
        // Custom empty message could be "You have nothing suitable to equip."
        // emptyScopeMessage: "You aren't carrying anything you can equip.",
    });

    // --- 2. Handle Resolver Result ---
    if (!itemInstanceToEquip) {
        // Failure message dispatched by resolver.
        // Check if the item exists but isn't equippable (more specific feedback)
        // This requires another lookup, might be better handled by a more sophisticated resolver later.
        // For now, rely on NOT_FOUND_EQUIPPABLE.
        const tempItemInstance = resolveTargetEntity(context, {
            scope: 'inventory',
            requiredComponents: [ItemComponent], // Check if *any* item matches name
            actionVerb: 'equip', // Verb doesn't really matter here
            targetName: targetItemName,
        });
        if (tempItemInstance && !tempItemInstance.hasComponent(EquippableComponent)) {
            const errorMsg = TARGET_MESSAGES.EQUIP_CANNOT(getDisplayName(tempItemInstance));
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        }
        // Otherwise, the resolver's original message (NOT_FOUND_EQUIPPABLE) stands.
        return {success: false, messages, newState: undefined};
    }

    // --- 3. Validate Equipment Slot ---
    const itemIdToEquip = itemInstanceToEquip.id;
    const itemDisplayName = getDisplayName(itemInstanceToEquip);
    const equippableComp = itemInstanceToEquip.getComponent(EquippableComponent); // Confirmed by resolver

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
        // Simple slot name extraction
        const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop().replace('slot_', '') : targetSlotId;
        const errorMsg = TARGET_MESSAGES.EQUIP_SLOT_FULL(currentItemName, slotName);
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- 4. Perform the Equip ---
    const removedFromInv = playerInventory.removeItem(itemIdToEquip);
    if (!removedFromInv) {
        const errorMsg = `(Internal Error: Failed to remove ${itemDisplayName} from inventory during equip.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: removeItem failed for ${itemIdToEquip} despite checks.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Removed ${itemIdToEquip} from inventory`, type: "internal"});

    const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
    if (!equipped) {
        const errorMsg = `(Internal Error: Failed to place ${itemDisplayName} into slot ${targetSlotId}.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: equipItem failed for ${itemIdToEquip} into ${targetSlotId}.`);
        playerInventory.addItem(itemIdToEquip); // Attempt to revert inventory change
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
        messages.push({text: "Internal warning: Failed to dispatch item_equipped event.", type: 'warning'});
        // Action still succeeded structurally.
    }

    return {success, messages, newState: undefined};
}