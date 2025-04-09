// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../../components/usableComponent.js').UsableComponent} UsableComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

import { InventoryComponent } from '../../components/inventoryComponent.js';
import { HealthComponent } from '../../components/healthComponent.js';
import { NameComponent } from '../../components/nameComponent.js'; // Ensure imported

// Import the findTarget utility and messages
import { findTarget } from '../../utils/targetFinder.js';
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';

/**
 * Handles the 'core:action_use' action.
 * Uses findTarget for partial, case-insensitive matching within player's inventory.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeUse(context) {
    const { playerEntity, targets, entityManager, dataManager, dispatch } = context; // Added entityManager
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];
    let success = false;

    // --- 1. Check for Target Input ---
    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('use'); // Use standard prompt
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: errorMsg, type: 'error' });
        return { success: false, messages };
    }
    const targetName = targets.join(' '); // Keep case for messages if needed

    // --- 2. Get Player Inventory ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: errorMsg, type: 'error' });
        return { success: false, messages };
    }

    // --- 3. Determine Search Scope (Items in inventory with NameComponent) ---
    const itemIds = inventoryComponent.getItems();
    const searchableInventoryItems = [];
    for (const itemId of itemIds) {
        const itemInstance = entityManager.getEntityInstance(itemId);
        // Must exist and have NameComponent for findTarget
        if (itemInstance && itemInstance.hasComponent(NameComponent)) {
            searchableInventoryItems.push(itemInstance);
        } else if (itemInstance) {
            console.warn(`executeUse: Item ${itemId} in inventory lacks NameComponent.`);
        } else {
            console.warn(`executeUse: Inventory contains ID '${itemId}' but instance not found.`);
        }
    }

    // Check if inventory has any searchable items before searching
    if (searchableInventoryItems.length === 0) {
        // If inventory is completely empty or has no items with names
        const errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(targetName); // Or just "Your inventory is empty."?
        dispatch('ui:message_display', { text: errorMsg, type: 'info' });
        return { success: false, messages: [{ text: errorMsg, type: 'info' }] };
    }


    // --- 4. Find Target Item using Utility ---
    const findResult = findTarget(targetName, searchableInventoryItems);
    let targetItemEntity = null;
    let finalItemId = null;
    let finalItemName = targetName; // Fallback for messages if needed early

    switch (findResult.status) {
        case 'NOT_FOUND': {
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(targetName);
            dispatch('ui:message_display', { text: errorMsg, type: 'info' });
            messages.push({ text: errorMsg, type: 'info' });
            return { success: false, messages };
        }
        case 'FOUND_AMBIGUOUS': {
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('use', targetName, findResult.matches);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            messages.push({ text: errorMsg, type: 'warning' });
            return { success: false, messages }; // Ambiguity pauses the action
        }
        case 'FOUND_UNIQUE':
            targetItemEntity = findResult.matches[0];
            finalItemId = targetItemEntity.id;
            finalItemName = getDisplayName(targetItemEntity); // Get proper name
            console.debug(`executeUse: Found unique match: ${finalItemName} (${finalItemId})`);
            break; // Proceed with validation using the unique target
        default: {
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status)";
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            console.error("executeUse: Unexpected status from findTarget:", findResult.status);
            return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
        }
    }

    // --- 5. Retrieve Final Item Definition (Required for UsableComponent checks) ---
    // This part remains necessary as component data often resides on the definition
    const finalItemDefinition = dataManager.getEntityDefinition(finalItemId);
    if (!finalItemDefinition) {
        console.error(`executeUse: Internal Error! Could not retrieve definition for matched item ID: ${finalItemId}`);
        const errorMsg = `Internal Error: Problem accessing item data for ${finalItemName}.`;
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: errorMsg, type: 'error' });
        return { success: false, messages };
    }

    // --- 6. Check Usability (Using Definition) ---
    const usableData = finalItemDefinition.components?.Usable;
    if (!usableData) {
        const errorMsg = TARGET_MESSAGES.USE_CANNOT(finalItemName);
        dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
        messages.push({ text: errorMsg, type: 'warning' });
        return { success: false, messages };
    }

    // --- 7. Apply Effect (Logic remains mostly the same, uses playerEntity and usableData) ---
    let effectApplied = false;
    switch (usableData.effect_type) {
        case 'heal':
            const healthComponent = playerEntity.getComponent(HealthComponent);
            const healAmount = usableData.effect_details?.amount;

            if (!healthComponent) {
                console.error(`executeUse: Player entity ${playerEntity.id} missing HealthComponent needed for 'heal' effect.`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Health');
                dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                messages.push({ text: errorMsg, type: 'error' });
                return { success: false, messages };
            }

            if (typeof healAmount !== 'number' || healAmount <= 0) {
                console.error(`executeUse: Invalid heal amount specified for item ${finalItemId}:`, healAmount);
                const errorMsg = `Internal Error: The ${finalItemName} seems misconfigured.`;
                dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                messages.push({ text: errorMsg, type: 'error' });
                return { success: false, messages };
            }

            if (healthComponent.current >= healthComponent.max) {
                const infoMsg = TARGET_MESSAGES.USE_FULL_HEALTH;
                dispatch('ui:message_display', { text: infoMsg, type: 'info' });
                messages.push({ text: infoMsg, type: 'info' });
                // Attempt to use was valid, even if no health gained
            } else {
                const oldHealth = healthComponent.current;
                healthComponent.current = Math.min(healthComponent.max, oldHealth + healAmount);
                // Optional: Add message about actual amount healed
                const actualHeal = healthComponent.current - oldHealth;
                const healMsg = `You recovered ${actualHeal} health.`;
                dispatch('ui:message_display', { text: healMsg, type: 'success' }); // Specific heal success message
                messages.push({ text: healMsg, type: 'success' });
                effectApplied = true;
            }
            success = true; // Mark action as successful (item targeted and usable)
            break;

        // --- Add future effect types here ---
        // case 'unlock': ...
        // case 'light': ...

        default:
            console.warn(`executeUse: Unsupported effect_type "${usableData.effect_type}" for item ${finalItemId}.`);
            const errorMsg = `Using the ${finalItemName} doesn't seem to do anything right now.`;
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            messages.push({ text: errorMsg, type: 'warning'});
            return { success: false, messages }; // Fail if effect is unknown
    }

    // --- 8. Consume Item (if applicable) ---
    // Consumed if the action succeeded (success=true) and item is consumable
    if (success && usableData.consumable) {
        const removed = inventoryComponent.removeItem(finalItemId);
        if (!removed) {
            console.error(`executeUse: Failed to remove consumed item ${finalItemId} from player inventory!`);
            messages.push({ text: `Internal Error: Problem consuming ${finalItemName}.`, type: 'error' });
            // Continue anyway? The effect likely already happened.
        } else {
            console.debug(`executeUse: Consumed item ${finalItemId}`);
        }
    }

    // --- 9. Dispatch General Success Message (if defined) ---
    // This message comes *after* specific effect messages (like healing amount)
    // Only display the general 'use_message' if one is defined.
    if (success && usableData.use_message) {
        // Avoid displaying generic message if specific feedback (like healing) was already given,
        // unless the use_message is explicitly different/adds value.
        // For now, display it if present. Consider refining this logic based on effect types.
        dispatch('ui:message_display', { text: usableData.use_message, type: 'info' });
        messages.push({ text: usableData.use_message, type: 'info' });
    } else if (success && !effectApplied && usableData.effect_type === 'heal') {
        // If healing was attempted at full health, we already gave the "full health" message.
        // Don't add a generic "You used the X" message unless `use_message` is explicitly set.
    } else if (success && !usableData.use_message && !effectApplied) {
        // If successful but no specific message was given (e.g. non-healing effect without use_message)
        // Provide a fallback. But avoid doubling up with heal message.
        const fallbackMsg = `You used the ${finalItemName}.`;
        dispatch('ui:message_display', { text: fallbackMsg, type: 'info' });
        messages.push({ text: fallbackMsg, type: 'info' });
    }


    // --- 10. Return Final Result ---
    return { success, messages };
}
