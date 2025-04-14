// src/actions/handlers/equipActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

export function executeEquip(context) {
    // Task 1: Update Context Destructuring - removed targets, added parsedCommand
    const {playerEntity, entityManager, dispatch, parsedCommand} = context;
    const messages = []; // Primarily for internal/debug logging now

    // --- Validate required targets ---
    // This utility now uses parsedCommand implicitly
    if (!validateRequiredCommandPart(context, 'equip', 'directObjectPhrase')) { // [cite: file:handlers/equipActionHandler.js]
        // Message already dispatched by utility
        return {success: false, messages: [], newState: undefined};
    }

    // Task 2: Assign Target Name from Parsed Command
    const targetItemName = parsedCommand.directObjectPhrase; // [cite: file:handlers/equipActionHandler.js]

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Component Existence Check ---
    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // --- 1. Resolve Target Item ---
    // Task 3: Verify resolveTargetEntity calls (targetName uses the updated targetItemName variable)
    const itemInstanceToEquip = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent, EquippableComponent],
        actionVerb: 'equip',
        targetName: targetItemName, // Verified: Uses targetItemName from parsedCommand [cite: file:handlers/equipActionHandler.js]
        notFoundMessageKey: null, // Let handler manage message
    });

    // --- 2. Handle Resolver Result & Validate Equippability ---
    if (!itemInstanceToEquip) {
        // Check if the item exists but isn't equippable, OR if it doesn't exist at all.
        // Task 3: Verify resolveTargetEntity calls (targetName uses the updated targetItemName variable)
        const tempItemInstance = resolveTargetEntity(context, {
            scope: 'inventory',
            requiredComponents: [ItemComponent],
            actionVerb: 'equip',
            targetName: targetItemName, // Verified: Uses targetItemName from parsedCommand [cite: file:handlers/equipActionHandler.js]
            notFoundMessageKey: null,
        });

        if (tempItemInstance && !tempItemInstance.hasComponent(EquippableComponent)) {
            // Item found, but cannot be equipped
            const errorMsg = TARGET_MESSAGES.EQUIP_CANNOT(getDisplayName(tempItemInstance));
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        } else {
            // Item not found in inventory at all
            // Use the targetItemName derived from parsedCommand for the message
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_EQUIPPABLE(targetItemName);
            dispatch('ui:message_display', {text: errorMsg, type: 'info'});
            return {success: false, messages: [{text: errorMsg, type: 'info'}], newState: undefined};
        }
    }

    // --- 3. Validate Equipment Slot Existence and Emptiness ---
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
        // Slot is not empty
        const currentItemInstance = entityManager.getEntityInstance(currentItemInSlotId);
        // Handle case where the item in the slot might somehow not exist in entityManager anymore
        const currentItemName = currentItemInstance ? getDisplayName(currentItemInstance) : `item ID ${currentItemInSlotId}`;
        const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop().replace(/^slot_/, '') : targetSlotId;

        const errorMsg = TARGET_MESSAGES.EQUIP_SLOT_FULL(currentItemName, slotName);
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- 4. Validation Passed - Dispatch Attempt Event ---
    try {
        dispatch('event:item_equip_attempted', {
            playerEntity: playerEntity,
            itemInstanceToEquip: itemInstanceToEquip, // Pass the actual instance
            targetSlotId: targetSlotId,
        });
        messages.push({
            text: `Dispatched event:item_equip_attempted for ${itemInstanceToEquip.id} to ${targetSlotId}`,
            type: "internal"
        });
        // The action handler's job is done once the intent is validated and the event is dispatched.
        // It succeeded in *validating the attempt*.
        return {success: true, messages, newState: undefined};
    } catch (e) {
        // Handle rare case where dispatch itself fails
        const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to dispatch item_equip_attempted event)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Failed to dispatch item_equip_attempted event:", e);
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages, newState: undefined};
    }
}