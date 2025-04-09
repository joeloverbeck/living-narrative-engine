// src/actions/handlers/unequipActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

export function executeUnequip(context) {
    const {playerEntity, targets, entityManager, dispatch} = context;
    const messages = [];

    // --- Validate required targets ---
    // Target presence (e.g., "unequip what?") handled by validateRequiredTargets
    if (!validateRequiredTargets(context, 'unequip')) {
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }

    const targetName = targets.join(' '); // Could be slot name or item name

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Internal Error: Missing Essential Components ---
    if (!playerInventory || !playerEquipment) {
        // Using standard INTERNAL_ERROR_COMPONENT message
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeUnequip: Player entity missing Inventory/Equipment components.");
        // Return the same standard message in the result
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    let slotIdToUnequip = null;
    let itemInstanceToUnequip = null; // The resolved entity instance

    // --- Strategy: Check slot name first, then resolve by item name ---

    // 1. Try matching slot name
    // Construct a potential slot ID based on user input
    const potentialSlotId = `core:slot_${targetName.toLowerCase().replace(/\s+/g, '_')}`;
    if (playerEquipment.hasSlot(potentialSlotId)) {
        const itemIdInSlot = playerEquipment.getEquippedItem(potentialSlotId);
        if (itemIdInSlot) {
            // Found an item in the explicitly named slot
            slotIdToUnequip = potentialSlotId;
            itemInstanceToUnequip = entityManager.getEntityInstance(itemIdInSlot);
            // --- Internal Error: Missing Item Instance ---
            if (!itemInstanceToUnequip) {
                console.error(`executeUnequip: Found item ID ${itemIdInSlot} in slot ${slotIdToUnequip} but instance is missing!`);
                // Using standard INTERNAL_ERROR message
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: errorMsg + " (Equipped item instance missing)", type: 'error'}); // Append detail for UI/log if needed, but base on standard msg
                // Return the standard message in the result
                return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
            }
            console.debug(`executeUnequip: Matched slot name '${targetName}' to slot ${slotIdToUnequip}`);
        } else {
            // --- Validation Error: Slot is Empty ---
            // Use TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY
            const errorMsg = TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY(targetName); // Pass the user-provided slot name
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        }
    } else {
        // --- 2. If not a slot name, Resolve Target Item by Name using Service ---
        console.debug(`executeUnequip: '${targetName}' not a direct slot match, resolving equipped item name.`);

        // Delegate item finding to the resolution service.
        // It handles NOT_FOUND and AMBIGUOUS cases using TARGET_MESSAGES internally.
        itemInstanceToUnequip = resolveTargetEntity(context, {
            scope: 'equipment', // Only search equipped items
            requiredComponents: [], // NameComponent is implicit
            actionVerb: 'unequip',
            targetName: targetName,
            // Specify the message key for "not found" to be used by the resolver
            notFoundMessageKey: 'NOT_FOUND_UNEQUIPPABLE',
        });

        // --- Handle Resolver Result ---
        if (!itemInstanceToUnequip) {
            // Failure message (not found / ambiguous) was already dispatched by resolveTargetEntity
            return {success: false, messages, newState: undefined};
        }

        // --- Find the Slot for the Resolved Item ---
        const equippedItemsMap = playerEquipment.getAllEquipped();
        slotIdToUnequip = Object.keys(equippedItemsMap).find(slotId => equippedItemsMap[slotId] === itemInstanceToUnequip.id);

        // --- Internal Error: Cannot Find Slot for Resolved Item ---
        if (!slotIdToUnequip) {
            console.error(`executeUnequip: Found unique item ${itemInstanceToUnequip.id} ('${getDisplayName(itemInstanceToUnequip)}') by name but couldn't find its slot!`);
            // Using standard INTERNAL_ERROR message
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: errorMsg + " (Cannot find resolved item's slot)", type: 'error'}); // Append detail if needed
            // Return the standard message in the result
            return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
        }
        console.debug(`executeUnequip: Matched item name '${targetName}' to item ${itemInstanceToUnequip.id} in slot ${slotIdToUnequip}`);
    }


    // --- 3. Perform the Unequip ---
    // At this point, we should have a valid itemInstanceToUnequip and slotIdToUnequip
    const itemIdToUnequip = itemInstanceToUnequip.id;
    const itemDisplayName = getDisplayName(itemInstanceToUnequip);

    const actuallyUnequippedId = playerEquipment.unequipItem(slotIdToUnequip);

    // --- Internal Error: Unequip Consistency Check Failed ---
    if (actuallyUnequippedId !== itemIdToUnequip) {
        console.error(`executeUnequip: unequipItem inconsistency for slot ${slotIdToUnequip}. Expected ${itemIdToUnequip}, got ${actuallyUnequippedId}. Item: '${itemDisplayName}'.`);
        // Using standard INTERNAL_ERROR message
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg + " (Unequip failed internally)", type: 'error'}); // Append detail if needed
        // Return the standard message in the result
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Unequipped ${itemIdToUnequip} from ${slotIdToUnequip}`, type: "internal"});

    // Add back to inventory
    playerInventory.addItem(itemIdToUnequip);
    messages.push({text: `Added ${itemIdToUnequip} to inventory`, type: "internal"});

    // --- Success Message ---
    // Per ticket, this specific message format is likely okay as is.
    const successMsg = `You unequip the ${itemDisplayName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // Dispatch the game event
    try {
        dispatch('event:item_unequipped', {
            entity: playerEntity,
            itemId: itemIdToUnequip,
            slotId: slotIdToUnequip,
            itemInstance: itemInstanceToUnequip
        });
        messages.push({text: `Dispatched event:item_unequipped for ${itemIdToUnequip}`, type: "internal"});
    } catch (e) {
        // This is an internal warning, not directly user-facing via dispatch. Keep as is.
        console.error("Failed to dispatch item_unequipped event:", e);
        messages.push({text: "Internal warning: Failed to dispatch item_unequipped event.", type: 'warning'});
    }

    return {success: true, messages, newState: undefined};
}