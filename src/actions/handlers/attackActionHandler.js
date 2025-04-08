// src/actions/handlers/attackActionHandler.js

import {NameComponent} from '../../components/nameComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';
import {AttackComponent} from '../../components/attackComponent.js'; // Ensure AttackComponent is imported if used directly

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../src/components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../../src/components/nameComponent.js').NameComponent} NameComponent */

/** @typedef {import('../../src/components/attackComponent.js').AttackComponent} AttackComponent */

/**
 * Validates the intent to execute the 'attack' action and fires an event.
 * Does NOT apply damage or handle death directly.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeAttack(context) {
    // Destructure context, including dispatch
    const {playerEntity, currentLocation, targets, entityManager, dispatch} = context;
    const messages = []; // Keep for potential non-UI use
    let success = false;

    // --- 1. Check if targets were provided ---
    if (targets.length === 0) {
        const errorMsg = "Attack what?";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages, newState: undefined};
    }

    const targetName = targets.join(' ').toLowerCase(); // Combine targets and lowercase

    // --- 2. Find Target Entity in Current Location ---

    let targetEntity = null;
    // Use the new spatial query function to get entity IDs in the location
    const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);

    if (entityIdsInLocation && entityIdsInLocation.size > 0) {
        // Iterate through the entity IDs obtained from the spatial index
        for (const entityId of entityIdsInLocation) {
            const potentialTarget = entityManager.getEntityInstance(entityId);
            if (potentialTarget) {
                const nameComp = potentialTarget.getComponent(NameComponent);
                // Check if the entity has a name and if it matches the target name (case-insensitive)
                if (nameComp && nameComp.value.toLowerCase() === targetName) {
                    targetEntity = potentialTarget;
                    break; // Found the target, exit the loop
                }
            } else {
                // This case should be less common now that the spatial index is synced, but good to log
                console.warn(`Attack Handler: Entity ID '${entityId}' listed in location '${currentLocation.id}' via spatial index, but instance not found in EntityManager.`);
            }
        }
    } else {
        // Handle case where the spatial index reports no entities or the set is empty
        console.warn(`Attack Handler: No entities found in location '${currentLocation.id}' via spatial index or index is empty.`);
        // Note: We don't immediately return an error here; the check for !targetEntity below handles the case where the specific target wasn't found.
    }

    // --- 3. Validate Target Entity ---
    if (!targetEntity) {
        const errorMsg = `There is no '${targetName}' here to attack.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages, newState: undefined};
    }

    if (targetEntity.id === playerEntity.id) {
        const warnMsg = "Trying to attack yourself? That's not productive.";
        dispatch('ui:message_display', {text: warnMsg, type: 'warning'});
        messages.push({text: warnMsg, type: 'warning'});
        return {success: false, messages, newState: undefined};
    }

    const targetNameComp = targetEntity.getComponent(NameComponent);
    const targetDisplayName = targetNameComp ? targetNameComp.value : `entity ${targetEntity.id}`;

    const healthComp = targetEntity.getComponent(HealthComponent);
    if (!healthComp) {
        const warnMsg = `You can't attack the ${targetDisplayName}.`;
        dispatch('ui:message_display', {text: warnMsg, type: 'warning'});
        messages.push({text: warnMsg, type: 'warning'});
        return {success: false, messages, newState: undefined};
    }

    if (healthComp.current <= 0) {
        const infoMsg = `The ${targetDisplayName} is already defeated.`;
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        // Keep original logic: return success true even if target is dead
        return {success: true, messages, newState: undefined};
    }

    // --- 4. Calculate Potential Damage ---
    // Read from player's AttackComponent, fallback to MVP fixed value if needed
    const playerAttackComp = playerEntity.getComponent(AttackComponent);
    const potentialDamage = playerAttackComp ? playerAttackComp.damage : 1; // Default to 1 if no AttackComponent
    if (!playerAttackComp) {
        console.warn(`Attack Handler: Player entity ${playerEntity.id} has no AttackComponent. Defaulting damage to 1.`);
    }

    const playerName = playerEntity.getComponent(NameComponent)?.value ?? 'You';

    // --- 5. Dispatch Swing Message (Attempt Indication) ---
    const swingMsg = `${playerName} swing${playerName === 'You' ? '' : 's'} at the ${targetDisplayName}!`;
    dispatch('ui:message_display', {text: swingMsg, type: 'combat'});
    messages.push({text: swingMsg, type: 'combat'});

    // --- 6. FIRE INTENT EVENT ---
    // Validation successful, fire the intent event for other systems (CombatSystem) to handle.
    const eventPayload = {
        attackerId: playerEntity.id,
        targetId: targetEntity.id,
        potentialDamage: potentialDamage,
        // Future: add weaponId, damageType etc. here
    };

    try {
        dispatch('event:attack_intended', eventPayload);
        success = true; // Mark success as the intent was valid and event fired
    } catch (dispatchError) {
        const errorMsg = "(Internal Error: Attack intent event dispatch failed)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error("Attack Handler: Failed to dispatch event:attack_intended event:", dispatchError);
        success = false; // If dispatch fails, the action effectively failed
    }

    // --- 7. Return Result ---
    // Result indicates if the *intent* was successfully validated and the event fired.
    // It does NOT indicate if the attack hit or killed the target.
    return {success, messages, newState: undefined};
}