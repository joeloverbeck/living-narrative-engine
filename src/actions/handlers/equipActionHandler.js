// src/actions/handlers/equipActionHandler.js

// --- Standard Imports ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// --- Refactored Imports ---
import {TARGET_MESSAGES, getDisplayName} from "../../utils/messages.js"; // Import TARGET_MESSAGES and getDisplayName

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

export function executeEquip(context) {
    const {playerEntity, entityManager, dispatch, parsedCommand} = context;
    const messages = []; // Primarily for internal/debug logging now

    // --- Validate required targets ---
    if (!validateRequiredCommandPart(context, 'equip', 'directObjectPhrase')) {
        // Message already dispatched by utility
        return {success: false, messages: [], newState: undefined};
    }

    const targetItemName = parsedCommand.directObjectPhrase;

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Component Existence Check ---
    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // --- 1. Resolve Target Item (any item in inventory) ---
    // Removed notFoundMessageKey, call only once looking for ItemComponent
    const resolution = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent], // Find any item matching the name first
        // actionVerb: 'equip', // Keep for potential future use
        targetName: targetItemName,
    });

    // --- 2. Handle Resolver Result ---
    switch (resolution.status) {
        case 'FOUND_UNIQUE': {
            const itemInstanceToEquip = resolution.entity;
            const itemDisplayName = getDisplayName(itemInstanceToEquip);

            // --- 2a. Validate Equippability ---
            if (!itemInstanceToEquip.hasComponent(EquippableComponent)) {
                // Item found, but cannot be equipped
                const errorMsg = TARGET_MESSAGES.EQUIP_CANNOT(itemDisplayName);
                dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
                messages.push({
                    text: `Equip failed: Item ${itemDisplayName} (${itemInstanceToEquip.id}) not equippable.`,
                    type: 'internal'
                });
                return {success: false, messages: messages, newState: undefined};
            }

            // --- 3. Validate Equipment Slot Existence and Emptiness ---
            const equippableComp = itemInstanceToEquip.getComponent(EquippableComponent);
            const targetSlotId = equippableComp.getSlotId();

            if (!playerEquipment.hasSlot(targetSlotId)) {
                const errorMsg = TARGET_MESSAGES.EQUIP_NO_SLOT(itemDisplayName, targetSlotId);
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                console.error(`executeEquip: Player tried to equip to slot '${targetSlotId}' but EquipmentComponent doesn't define it.`);
                messages.push({text: `Equip failed: Slot ${targetSlotId} does not exist.`, type: 'internal'});
                return {success: false, messages: messages, newState: undefined};
            }

            const currentItemInSlotId = playerEquipment.getEquippedItem(targetSlotId);
            if (currentItemInSlotId !== null) {
                // Slot is not empty
                const currentItemInstance = entityManager.getEntityInstance(currentItemInSlotId);
                const currentItemName = currentItemInstance ? getDisplayName(currentItemInstance) : `item ID ${currentItemInSlotId}`;
                const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop().replace(/^slot_/, '') : targetSlotId;

                const errorMsg = TARGET_MESSAGES.EQUIP_SLOT_FULL(currentItemName, slotName);
                dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
                messages.push({
                    text: `Equip failed: Slot ${targetSlotId} is full with ${currentItemName} (${currentItemInSlotId}).`,
                    type: 'internal'
                });
                return {success: false, messages: messages, newState: undefined};
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
                // Return success (validation passed, event dispatched)
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

        case 'NOT_FOUND':
            // Item not found in inventory at all
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(targetItemName); // Use general inventory not found
            dispatch('ui:message_display', {text: errorMsg, type: 'info'});
            messages.push({
                text: `Equip resolution failed for '${targetItemName}', reason: NOT_FOUND.`,
                type: 'internal'
            });
            return {success: false, messages: messages, newState: undefined};

        case 'AMBIGUOUS':
            const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('equip', targetItemName, resolution.candidates);
            dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
            messages.push({
                text: `Equip resolution failed for '${targetItemName}', reason: AMBIGUOUS.`,
                type: 'internal'
            });
            return {success: false, messages: messages, newState: undefined};

        case 'FILTER_EMPTY':
            // Inventory is empty
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
            messages.push({
                text: `Equip resolution failed for '${targetItemName}', reason: FILTER_EMPTY (Inventory empty).`,
                type: 'internal'
            });
            return {success: false, messages: messages, newState: undefined};

        case 'INVALID_INPUT':
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            messages.push({
                text: `Equip resolution failed for '${targetItemName}', reason: INVALID_INPUT.`,
                type: 'internal_error'
            });
            console.error(`executeEquip: resolveTargetEntity returned INVALID_INPUT for target '${targetItemName}'. Context/Config issue?`);
            return {success: false, messages: messages, newState: undefined};

        default:
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            console.error(`executeEquip: Unhandled resolution status: ${resolution.status}`);
            messages.push({text: `Unhandled status: ${resolution.status}`, type: 'internal_error'});
            return {success: false, messages: messages};
    }
}