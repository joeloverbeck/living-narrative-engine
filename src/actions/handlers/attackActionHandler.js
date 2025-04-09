// Import the new utility and necessary components
import { findTarget } from '../../utils/targetFinder.js'; // Adjust path as needed
import { NameComponent } from '../../components/nameComponent.js';
import { HealthComponent } from '../../components/healthComponent.js';
import { AttackComponent } from '../../components/attackComponent.js';
import { getDisplayName, TARGET_MESSAGES } from "../../utils/messages.js";

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */


/**
 * Validates the intent to execute the 'attack' action and fires an event.
 * Uses findTarget for partial, case-insensitive matching.
 * Does NOT apply damage or handle death directly.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeAttack(context) {
    const { playerEntity, currentLocation, targets, entityManager, dispatch } = context;
    const messages = [];
    let success = false;

    // --- 1. Check if targets were provided ---
    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('attack');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: errorMsg, type: 'error' });
        return { success: false, messages, newState: undefined };
    }

    const targetName = targets.join(' '); // Keep original case for messages if needed, findTarget handles lowercasing

    // --- 2. Determine Search Scope (Attackable entities in location) ---
    const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
    const searchableEntities = [];
    if (entityIdsInLocation) {
        for (const entityId of entityIdsInLocation) {
            // Exclude self
            if (entityId === playerEntity.id) continue;

            const potentialTarget = entityManager.getEntityInstance(entityId);
            // Include if entity exists and has health (basic attackable check)
            if (potentialTarget && potentialTarget.hasComponent(HealthComponent)) {
                // Ensure it has a name for matching
                if (potentialTarget.hasComponent(NameComponent)) {
                    searchableEntities.push(potentialTarget);
                } else {
                    console.warn(`Attack Handler: Potential target ${entityId} in location ${currentLocation.id} has HealthComponent but no NameComponent, excluding from search.`);
                }
            }
        }
    }

    // --- 3. Find Target Entity using Utility ---
    const findResult = findTarget(targetName, searchableEntities);
    let targetEntity = null;

    switch (findResult.status) {
        case 'NOT_FOUND': {
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_ATTACKABLE(targetName);
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            messages.push({ text: errorMsg, type: 'error' });
            return { success: false, messages, newState: undefined };
        }
        case 'FOUND_AMBIGUOUS': {
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('attack', targetName, findResult.matches);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            messages.push({ text: errorMsg, type: 'warning' });
            return { success: false, messages, newState: undefined }; // Ambiguity pauses the action
        }
        case 'FOUND_UNIQUE':
            targetEntity = findResult.matches[0];
            break; // Proceed with validation using the unique target
        default: {
            // Should not happen
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status)";
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            console.error("executeAttack: Unexpected status from findTarget:", findResult.status);
            return { success: false, messages, newState: undefined };
        }
    }

    // --- 4. Validate Identified Target Entity ---
    // Note: Self-attack check is technically handled by scope filtering now, but kept as safeguard
    if (targetEntity.id === playerEntity.id) {
        const warnMsg = TARGET_MESSAGES.ATTACK_SELF;
        dispatch('ui:message_display', { text: warnMsg, type: 'warning' });
        messages.push({ text: warnMsg, type: 'warning' });
        return { success: false, messages, newState: undefined };
    }

    // Double-check HealthComponent (already filtered in scope, but good practice)
    const healthComp = targetEntity.getComponent(HealthComponent);
    const targetDisplayName = getDisplayName(targetEntity);
    if (!healthComp) {
        // This case implies an issue with scope filtering or component removal race condition
        const warnMsg = TARGET_MESSAGES.ATTACK_NON_COMBATANT(targetDisplayName);
        dispatch('ui:message_display', { text: warnMsg, type: 'warning' });
        messages.push({ text: warnMsg, type: 'warning' });
        console.warn(`executeAttack: Target ${targetEntity.id} selected but lacks HealthComponent.`);
        return { success: false, messages, newState: undefined };
    }

    if (healthComp.current <= 0) {
        const infoMsg = TARGET_MESSAGES.ATTACK_DEFEATED(targetDisplayName);
        dispatch('ui:message_display', { text: infoMsg, type: 'info' });
        messages.push({ text: infoMsg, type: 'info' });
        // Keep original logic: return success true even if target is dead
        return { success: true, messages, newState: undefined };
    }

    // --- 5. Calculate Potential Damage ---
    const playerAttackComp = playerEntity.getComponent(AttackComponent);
    const potentialDamage = playerAttackComp ? playerAttackComp.damage : 1;
    if (!playerAttackComp) {
        console.warn(`Attack Handler: Player entity ${playerEntity.id} has no AttackComponent. Defaulting damage to 1.`);
    }

    const playerName = getDisplayName(playerEntity);

    // --- 6. Dispatch Swing Message ---
    const swingMsg = `${playerName} swing${playerName === 'You' ? '' : 's'} at the ${targetDisplayName}!`;
    dispatch('ui:message_display', { text: swingMsg, type: 'combat' });
    messages.push({ text: swingMsg, type: 'combat' });

    // --- 7. FIRE INTENT EVENT ---
    const eventPayload = {
        attackerId: playerEntity.id,
        targetId: targetEntity.id,
        potentialDamage: potentialDamage,
    };

    try {
        dispatch('event:attack_intended', eventPayload);
        success = true;
    } catch (dispatchError) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Attack intent event dispatch failed)";
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: errorMsg, type: 'error' });
        console.error("Attack Handler: Failed to dispatch event:attack_intended event:", dispatchError);
        success = false;
    }

    // --- 8. Return Result ---
    return { success, messages, newState: undefined };
}