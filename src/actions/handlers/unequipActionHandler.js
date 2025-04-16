// src/actions/handlers/unequipActionHandler.js

// --- Core Components ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
// ItemComponent might be needed if we resolve by item name, but utilities handle it
// import { ItemComponent } from "../../components/itemComponent.js";

// --- Utilities and Services ---
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
// --- Refactored Imports (Ticket 9) ---
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {EVENT_ITEM_UNEQUIP_ATTEMPTED} from "../../types/eventTypes.js";

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/** @typedef {import('../../types/eventTypes.js').ItemUnequipAttemptedEventPayload} ItemUnequipAttemptedEventPayload */


/**
 * Helper to attempt converting user input (e.g., "main hand", "head") to a canonical slot ID.
 * Returns the potential slot ID (e.g., "core:slot_main_hand") or null if input is unlikely to be a slot name.
 * @param {string} input - The user's target name input.
 * @returns {string | null} - The potential slot ID or null.
 */
function mapInputToSlotId(input) {
    if (!input || typeof input !== 'string') return null;
    const cleanedInput = input.toLowerCase().trim().replace(/\s+/g, '_');
    // Basic check: does it look like a plausible slot name fragment?
    // You might have a more robust mapping/validation here based on your game's slots.
    if (['head', 'body', 'legs', 'feet', 'main_hand', 'off_hand', 'ranged', 'amulet', 'ring1', 'ring2'].includes(cleanedInput)) {
        return `core:slot_${cleanedInput}`;
    }
    // Also allow direct canonical IDs like "core:slot_head"
    if (cleanedInput.startsWith('core:slot_')) {
        return cleanedInput;
    }
    return null; // Input doesn't look like a slot name/ID
}

/**
 * Handles the 'core:unequip' action. Allows the player to unequip items
 * either by specifying the slot name or the item name.
 * Refactored to use handleActionWithTargetResolution for item name resolution.
 * @param {ActionContext} context
 * @returns {Promise<ActionResult>}
 */
export async function executeUnequip(context) {
    const {playerEntity, entityManager, dispatch, parsedCommand} = context;
    /** @type {ActionMessage[]} */
    const messages = [];

    // --- 1. Validate Required Command Part ---
    if (!validateRequiredCommandPart(context, 'unequip', 'directObjectPhrase')) {
        return {success: false, messages: [], newState: undefined};
    }
    const targetName = parsedCommand.directObjectPhrase; // Could be slot name or item name

    // --- 2. Check Essential Player Components ---
    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);
    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeUnequip: Player entity missing Inventory/Equipment components.");
        messages.push({text: "Internal Error: Player missing Inventory/Equipment components.", type: 'internal_error'});
        return {success: false, messages};
    }

    // --- 3. Attempt Resolution via Slot Name First (AC 1) ---
    const potentialSlotId = mapInputToSlotId(targetName);
    if (potentialSlotId && playerEquipment.hasSlot(potentialSlotId)) {
        messages.push({
            text: `Unequip intent: Identified '${targetName}' as potential slot ID '${potentialSlotId}'.`,
            type: 'internal'
        });
        const itemIdInSlot = playerEquipment.getEquippedItem(potentialSlotId);

        if (itemIdInSlot) {
            // --- Slot Found & Occupied (AC 2) ---
            const itemInstanceToUnequip = entityManager.getEntityInstance(itemIdInSlot);
            if (!itemInstanceToUnequip) {
                console.error(`executeUnequip: Found item ID ${itemIdInSlot} in slot ${potentialSlotId} but instance is missing!`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Equipped item instance missing)";
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({
                    text: `Internal Error: Instance for equipped item ${itemIdInSlot} missing.`,
                    type: 'internal_error'
                });
                return {success: false, messages};
            }
            const itemName = getDisplayName(itemInstanceToUnequip);

            // Use dispatchEventWithCatch for the event dispatch
            /** @type {ItemUnequipAttemptedEventPayload} */
            const eventPayload = {
                playerEntity: playerEntity,
                itemInstanceToUnequip: itemInstanceToUnequip,
                slotIdToUnequip: potentialSlotId
            };

            const dispatchResult = dispatchEventWithCatch(
                context,
                EVENT_ITEM_UNEQUIP_ATTEMPTED,
                eventPayload,
                messages,
                {
                    success: `Dispatched ${EVENT_ITEM_UNEQUIP_ATTEMPTED} for ${itemName} (${itemIdInSlot}) from slot ${potentialSlotId}`,
                    errorUser: TARGET_MESSAGES.INTERNAL_ERROR,
                    errorInternal: `Failed to dispatch ${EVENT_ITEM_UNEQUIP_ATTEMPTED} for ${itemName} (${itemIdInSlot}) from slot ${potentialSlotId}.`
                }
            );
            // Return based on dispatch success. Messages are mutated by the utility.
            return {success: dispatchResult.success, messages};

        } else {
            // --- Slot Found & Empty (AC 3) ---
            const errorMsg = TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY(targetName); // Pass user input for message
            dispatch('ui:message_display', {text: errorMsg, type: 'info'}); // Typically 'info' or 'warning' for empty slot
            messages.push({
                text: `Unequip failed: Slot '${potentialSlotId}' specified by '${targetName}' is empty.`,
                type: 'internal'
            });
            return {success: false, messages};
        }
    } else {
        // --- 4. Input is Not a Slot Name - Delegate to Utility for Item Name Resolution (AC 4) ---
        messages.push({
            text: `Unequip intent: '${targetName}' not a known slot, resolving equipped item by name.`,
            type: 'internal'
        });

        /**
         * onFoundUnique Callback for Item Resolution (AC 5)
         * @param {ActionContext} innerContext
         * @param {Entity} targetItemEntity - The resolved equipped item.
         * @param {ActionMessage[]} accumulatedMessages - Messages from handleAction...
         * @returns {ActionResult}
         */
        const onFoundUnique = (innerContext, targetItemEntity, accumulatedMessages) => {
            const targetItemId = targetItemEntity.id;
            const targetItemName = getDisplayName(targetItemEntity);

            // Find the slot ID for the resolved item
            const equippedItemsMap = playerEquipment.getAllEquipped(); // Use the component from the outer scope
            const slotIdToUnequip = Object.keys(equippedItemsMap).find(slotId => equippedItemsMap[slotId] === targetItemId);

            if (!slotIdToUnequip) {
                // This indicates an inconsistency - item resolved in equipment scope but slot not found
                console.error(`executeUnequip (onFoundUnique): Found unique item ${targetItemId} ('${targetItemName}') but failed to find its slot in EquipmentComponent!`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Cannot locate resolved item's slot)";
                innerContext.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                accumulatedMessages.push({
                    text: `Internal Error: Slot not found for resolved item ${targetItemId}.`,
                    type: 'internal_error'
                });
                return {success: false, messages: []}; // Return failure
            }

            accumulatedMessages.push({
                text: `Resolved item ${targetItemId} ('${targetItemName}') found in slot ${slotIdToUnequip}.`,
                type: 'internal'
            });

            // Use dispatchEventWithCatch for the event dispatch (AC 5 & 6)
            /** @type {ItemUnequipAttemptedEventPayload} */
            const eventPayload = {
                playerEntity: innerContext.playerEntity,
                itemInstanceToUnequip: targetItemEntity,
                slotIdToUnequip: slotIdToUnequip
            };

            const dispatchResult = dispatchEventWithCatch(
                innerContext,
                EVENT_ITEM_UNEQUIP_ATTEMPTED,
                eventPayload,
                accumulatedMessages, // Pass messages for internal logging
                {
                    success: `Dispatched ${EVENT_ITEM_UNEQUIP_ATTEMPTED} for ${targetItemName} (${targetItemId}) from slot ${slotIdToUnequip}`,
                    errorUser: TARGET_MESSAGES.INTERNAL_ERROR,
                    errorInternal: `Failed to dispatch ${EVENT_ITEM_UNEQUIP_ATTEMPTED} for ${targetItemName} (${targetItemId}) from slot ${slotIdToUnequip}.`
                }
            );

            // Return result based on dispatch success. handleAction... merges messages.
            return {success: dispatchResult.success, messages: []};
        };

        // Configure options for handleActionWithTargetResolution
        /** @type {HandleActionWithOptions} */
        const options = {
            scope: 'equipment', // AC 4: Scope
            requiredComponents: [], // AC 4: Any equipped item
            commandPart: 'directObjectPhrase', // AC 4: Command Part
            actionVerb: 'unequip', // AC 4: Action Verb
            onFoundUnique: onFoundUnique, // AC 4 & 5: Callback
            failureMessages: { // AC 4: Failure Messages
                // Override default 'inventory' not found with specific 'unequip' message
                notFound: TARGET_MESSAGES.NOT_FOUND_UNEQUIPPABLE,
                // Use default AMBIGUOUS_PROMPT
                // Use default SCOPE_EMPTY_PERSONAL for 'equipment' scope (nothing equipped)
            },
        };

        // Call the utility and return its result directly
        return await handleActionWithTargetResolution(context, options);
    }
}