// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../../components/usableComponent.js').UsableComponent} UsableComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */ // Added for clarity

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';

/**
 * Handles the 'core:action_use' action.
 * Allows targeting items by exact Item ID (case-sensitive) or exact Item Name (case-insensitive).
 * Prioritizes ID matches over Name matches. Handles ambiguity if multiple names match.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeUse(context) {
    const {playerEntity, targets, dataManager, dispatch} = context;
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];
    let success = false;

    // --- 1. Check for Target Input ---
    if (targets.length === 0) {
        const errorMsg = "Use what?";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages};
    }
    // Keep the raw target for case-sensitive ID matching
    const rawTarget = targets.join(' ');
    const lowerCaseTarget = rawTarget.toLowerCase(); // For case-insensitive name matching

    // --- 2. Get Player Inventory ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = "Internal Error: Cannot access your inventory.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages};
    }

    // --- 3. Find All Potential Matches in Inventory ---
    /** @type {{id: string, name: string}[]} */
    const idMatches = [];
    /** @type {{id: string, name: string}[]} */
    const nameMatches = [];

    const itemIds = inventoryComponent.getItems();
    for (const itemId of itemIds) {
        const itemDef = dataManager.getEntityDefinition(itemId);
        if (!itemDef) {
            console.warn(`executeUse: Could not find item definition for ID: ${itemId} in player inventory.`);
            continue; // Skip this item if definition is missing
        }

        // Get the item's canonical name (fall back to ID if NameComponent missing)
        const currentItemName = itemDef.components?.Name?.value || itemId;

        // Check for Exact, Case-Sensitive ID Match
        if (rawTarget === itemId) {
            idMatches.push({id: itemId, name: currentItemName});
            // Do *not* break, continue checking the rest of the inventory
        }

        // Check for Exact, Case-Insensitive Name Match
        if (currentItemName.toLowerCase() === lowerCaseTarget) {
            nameMatches.push({id: itemId, name: currentItemName});
            // Do *not* break
        }
    }

    // --- 4. Determine Final Target Based on Matches and Precedence ---
    let finalItemId = null;
    let finalItemName = null;
    let finalItemDefinition = null; // Will retrieve this once ID is final

    if (idMatches.length >= 1) {
        // ID Match takes precedence. Use the first one found (arbitrary but consistent).
        finalItemId = idMatches[0].id;
        finalItemName = idMatches[0].name;
        console.debug(`executeUse: Found exact ID match: ${finalItemId}`);
    } else if (nameMatches.length === 1) {
        // Exactly one Name Match found (and no ID match)
        finalItemId = nameMatches[0].id;
        finalItemName = nameMatches[0].name;
        console.debug(`executeUse: Found unique exact name match: ${finalItemId} (name: ${finalItemName})`);
    } else if (nameMatches.length > 1) {
        // Name Ambiguity: Multiple items match the name exactly.
        console.debug(`executeUse: Found ambiguous name match for "${rawTarget}"`);
        const options = nameMatches.map(match => `${match.name} (${match.id})`).join(' or ');
        const errorMsg = `Which item do you want to use? ${options}`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        messages.push({text: errorMsg, type: 'warning'});
        return {success: false, messages}; // Action fails due to ambiguity
    } else {
        // No Match: Neither ID nor Name matched anything.
        console.debug(`executeUse: No match found for "${rawTarget}"`);
        const errorMsg = `You don't have anything like "${rawTarget}".`;
        dispatch('ui:message_display', {text: errorMsg, type: 'info'});
        messages.push({text: errorMsg, type: 'info'});
        return {success: false, messages};
    }

    // --- 5. Retrieve Final Item Definition (if a match was determined) ---
    if (finalItemId) {
        finalItemDefinition = dataManager.getEntityDefinition(finalItemId);
        if (!finalItemDefinition) {
            // This would be an internal inconsistency, as we found it during matching
            console.error(`executeUse: Internal Error! Could not re-retrieve definition for matched item ID: ${finalItemId}`);
            const errorMsg = `Internal Error: Problem accessing item data for ${finalItemName}.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            return {success: false, messages};
        }
    } else {
        // Should not happen if logic above is correct, but safety check
        console.error(`executeUse: Internal Error! Reached item processing without a finalItemId.`);
        const errorMsg = "Internal Error: Failed to determine target item.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages};
    }


    // --- 6. Check Usability ---
    const usableData = finalItemDefinition.components?.Usable;
    if (!usableData) {
        const errorMsg = `You can't use the ${finalItemName} that way.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        messages.push({text: errorMsg, type: 'warning'});
        return {success: false, messages};
    }

    // --- 7. Apply Effect ---
    let effectApplied = false; // Track if an effect actually changed state
    switch (usableData.effect_type) {
        case 'heal':
            const healthComponent = playerEntity.getComponent(HealthComponent);
            const healAmount = usableData.effect_details?.amount;

            if (!healthComponent) {
                console.error(`executeUse: Player entity ${playerEntity.id} missing HealthComponent needed for 'heal' effect.`);
                const errorMsg = "Internal Error: Cannot access your health.";
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: errorMsg, type: 'error'});
                return {success: false, messages};
            }

            if (typeof healAmount !== 'number' || healAmount <= 0) {
                console.error(`executeUse: Invalid heal amount specified for item ${finalItemId}:`, healAmount);
                const errorMsg = `Internal Error: The ${finalItemName} seems misconfigured.`;
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: errorMsg, type: 'error'});
                return {success: false, messages};
            }

            if (healthComponent.current >= healthComponent.max) {
                const infoMsg = "You are already at full health.";
                dispatch('ui:message_display', {text: infoMsg, type: 'info'});
                messages.push({text: infoMsg, type: 'info'});
                // Even if no health gained, the *attempt* to use was valid
                // effectApplied remains false, but success will be true
            } else {
                const oldHealth = healthComponent.current;
                healthComponent.current = Math.min(healthComponent.max, oldHealth + healAmount);
                // Optional: add message about actual amount healed
                // const actualHeal = healthComponent.current - oldHealth;
                // messages.push({ text: `You recovered ${actualHeal} health.`, type: 'success' });
                effectApplied = true; // Healing occurred
            }
            success = true; // Mark action as successful because the item was targeted and usable
            break;

        // --- Add future effect types here ---
        // case 'unlock':
        //    // Logic to find nearby locked doors matching key properties...
        //    // If successful:
        //    //   success = true;
        //    //   effectApplied = true; // Or false if key isn't consumed but door opened
        //    // else: add appropriate failure message
        //    break;
        // case 'light':
        //    // Logic to apply 'Lit' status effect or modify environment...
        //    // success = true; effectApplied = true;
        //    break;

        default:
            console.warn(`executeUse: Unsupported effect_type "${usableData.effect_type}" for item ${finalItemId}.`);
            const errorMsg = `Using the ${finalItemName} doesn't seem to do anything right now.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            messages.push({text: errorMsg, type: 'warning'});
            return {success: false, messages}; // Fail because the defined effect is unknown/unsupported
    }

    // --- 8. Consume Item (if applicable) ---
    // Consume only if the action succeeded (item was targeted and usable)
    // AND the item is marked as consumable.
    // Note: We consume even if effectApplied is false (e.g., healing at full health)
    // because the player *intended* to use the consumable.
    if (success && usableData.consumable) {
        const removed = inventoryComponent.removeItem(finalItemId);
        if (!removed) {
            // This indicates an inventory inconsistency - item was matched but couldn't be removed.
            // This could happen if the player somehow had multiple refs but only one actual item? Unlikely with current InventoryComponent.
            console.error(`executeUse: Failed to remove consumed item ${finalItemId} from player inventory! Inventory state might be inconsistent.`);
            // Potentially add an error message, but the primary action succeeded.
            messages.push({text: `Internal Error: Problem consuming ${finalItemName}.`, type: 'error'});
        } else {
            console.debug(`executeUse: Consumed item ${finalItemId}`);
        }
    }

    // --- 9. Dispatch Success Message ---
    // Use the message defined in the item's Usable component data.
    // This message should ideally reflect the *attempt* or *action*, not necessarily the outcome.
    if (usableData.use_message) {
        dispatch('ui:message_display', {text: usableData.use_message, type: 'info'});
        messages.push({text: usableData.use_message, type: 'info'});
    } else {
        // Fallback message if use_message is missing
        const fallbackMsg = `You used the ${finalItemName}.`;
        dispatch('ui:message_display', {text: fallbackMsg, type: 'info'});
        messages.push({text: fallbackMsg, type: 'info'});
    }

    // --- 10. Return Final Result ---
    return {success, messages};
}