// src/actions/handlers/attackActionHandler.js

import {EntitiesPresentComponent} from '../../components/entitiesPresentComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../src/components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../../src/components/nameComponent.js').NameComponent} NameComponent */

/** @typedef {import('../../src/components/entitiesPresentComponent.js').EntitiesPresentComponent} EntitiesPresentComponent */

/**
 * Executes the 'attack' action. Finds target, applies damage, checks for death,
 * dispatches messages via context.dispatch, and dispatches game events.
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
    const presentComp = currentLocation.getComponent(EntitiesPresentComponent);

    if (presentComp && Array.isArray(presentComp.entityIds)) {
        for (const entityId of presentComp.entityIds) {
            const potentialTarget = entityManager.getEntityInstance(entityId);
            if (potentialTarget) {
                const nameComp = potentialTarget.getComponent(NameComponent);
                if (nameComp && nameComp.value.toLowerCase() === targetName) {
                    targetEntity = potentialTarget;
                    break;
                }
            } else {
                console.warn(`Attack Handler: Entity ID '${entityId}' listed in location '${currentLocation.id}' but instance not found.`);
            }
        }
    } else {
        const errorMsg = "(Internal Error: Cannot determine who is in this room.)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.warn(`Attack Handler: Location '${currentLocation.id}' has no EntitiesPresentComponent or invalid entityIds.`);
        return {success: false, messages, newState: undefined};
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
        return {success: true, messages, newState: undefined}; // Considered success
    }

    // --- 4. Calculate Damage (MVP: Fixed Value) ---
    const damage = 1;
    const playerName = playerEntity.getComponent(NameComponent)?.value ?? 'You';

    const swingMsg = `${playerName} swing${playerName === 'You' ? '' : 's'} at the ${targetDisplayName}!`;
    dispatch('ui:message_display', {text: swingMsg, type: 'combat'});
    messages.push({text: swingMsg, type: 'combat'});

    // --- 5. Apply Damage ---
    const previousHealth = healthComp.current;
    healthComp.current = Math.max(0, previousHealth - damage);

    const hitMsg = `You hit the ${targetDisplayName} for ${damage} damage!`;
    dispatch('ui:message_display', {text: hitMsg, type: 'combat-hit'});
    messages.push({text: hitMsg, type: 'combat-hit'});
    success = true;

    // --- 6. Check for Death ---
    if (healthComp.current <= 0 && previousHealth > 0) {
        const deathMsg = `The ${targetDisplayName} collapses, defeated!`;
        dispatch('ui:message_display', {text: deathMsg, type: 'combat-crit'});
        messages.push({text: deathMsg, type: 'combat-crit'});

        // --- 7. Dispatch Death Event (GAME EVENT - not UI) ---
        try {
            dispatch('event:entity_died', { // <<-- THIS dispatch stays the same
                deceasedEntityId: targetEntity.id,
                killerEntityId: playerEntity.id,
            });
        } catch (dispatchError) {
            const errorMsg = "(Internal Error: Death event dispatch failed)";
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            messages.push({text: errorMsg, type: 'error'});
            console.error("Attack Handler: Failed to dispatch entity_died event:", dispatchError);
        }

        // --- Remove entity from location ---
        if (presentComp) {
            presentComp.removeEntity(targetEntity.id);
            console.log(`Attack Handler: Removed deceased entity ${targetEntity.id} from location ${currentLocation.id}`);
            // Maybe dispatch a UI message about removal? Optional.
            // dispatch('ui:message_display', { text: `The body of the ${targetDisplayName} disappears.`, type: 'info' });
        }
    } else if (healthComp.current > 0) {
        // Optional: Indicate current health state
        // const woundMsg = `The ${targetDisplayName} looks wounded. (HP: ${healthComp.current}/${healthComp.max})`;
        // dispatch('ui:message_display', { text: woundMsg, type: 'combat-info' });
        // messages.push({ text: woundMsg, type: 'combat-info' });
    }

    // --- 8. Return Result ---
    return {success, messages, newState: undefined};
}