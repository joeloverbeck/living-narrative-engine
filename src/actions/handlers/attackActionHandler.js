// src/actions/handlers/attackActionHandler.js

import { EntitiesPresentComponent } from '../../components/entitiesPresentComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../src/components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../../src/components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../src/components/entitiesPresentComponent.js').EntitiesPresentComponent} EntitiesPresentComponent */

import { NameComponent } from '../../components/nameComponent.js';
import { HealthComponent } from '../../components/healthComponent.js';

/**
 * Executes the 'attack' action. Finds target in current location, applies damage,
 * checks for death, and dispatches event if needed.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeAttack(context) {
    const { playerEntity, currentLocation, targets, entityManager, dispatch } = context; // Destructure dispatch
    /** @type {ActionMessage[]} */
    const messages = [];
    let success = false;

    // --- 1. Check if targets were provided ---
    if (targets.length === 0) {
        messages.push({ text: "Attack what?", type: 'error' });
        return { success: false, messages, newState: undefined };
    }

    const targetName = targets.join(' ').toLowerCase(); // Combine targets and lowercase

    // --- 2. Find Target Entity in Current Location ---
    /** @type {Entity | null} */
    let targetEntity = null;

    const presentComp = currentLocation.getComponent(EntitiesPresentComponent);
    if (presentComp && Array.isArray(presentComp.entityIds)) {
        for (const entityId of presentComp.entityIds) {
            const potentialTarget = entityManager.getEntityInstance(entityId);
            if (potentialTarget) {
                const nameComp = potentialTarget.getComponent(NameComponent);
                if (nameComp && nameComp.value.toLowerCase() === targetName) {
                    targetEntity = potentialTarget;
                    break; // Found the first match
                }
            } else {
                console.warn(`Attack Handler: Entity ID '${entityId}' listed in location '${currentLocation.id}' but instance not found.`);
            }
        }
    } else {
        console.warn(`Attack Handler: Location '${currentLocation.id}' has no EntitiesPresentComponent.`);
        // Fallback or strict error depending on design. For MVP, fail if component is missing.
        messages.push({ text: "(Internal Error: Cannot determine who is in this room.)", type: 'error' });
        return { success: false, messages, newState: undefined };
    }

    // --- 3. Validate Target Entity ---
    if (!targetEntity) {
        messages.push({ text: `There is no '${targetName}' here to attack.`, type: 'error' });
        return { success: false, messages, newState: undefined };
    }

    // Cannot attack self
    if (targetEntity.id === playerEntity.id) {
        messages.push({ text: "Trying to attack yourself? That's not productive.", type: 'warning' });
        return { success: false, messages, newState: undefined };
    }

    const targetNameComp = targetEntity.getComponent(NameComponent); // For display name
    const targetDisplayName = targetNameComp ? targetNameComp.value : `entity ${targetEntity.id}`;

    // Check if target has health
    const healthComp = targetEntity.getComponent(HealthComponent);
    if (!healthComp) {
        messages.push({ text: `You can't attack the ${targetDisplayName}.`, type: 'warning' });
        return { success: false, messages, newState: undefined };
    }

    // Check if target is already dead
    if (healthComp.current <= 0) {
        messages.push({ text: `The ${targetDisplayName} is already defeated.`, type: 'info' });
        return { success: true, messages, newState: undefined }; // Considered success, no action needed
    }

    // --- 4. Calculate Damage (MVP: Fixed Value) ---
    const damage = 1; // Hardcoded for MVP
    const playerName = playerEntity.getComponent(NameComponent)?.value ?? 'You'; // Get player name if available

    messages.push({ text: `${playerName} swing${playerName === 'You' ? '' : 's'} at the ${targetDisplayName}!`, type: 'combat' }); // Use a distinct type

    // --- 5. Apply Damage ---
    const previousHealth = healthComp.current;
    healthComp.current = Math.max(0, previousHealth - damage); // Apply damage, clamp at 0

    messages.push({ text: `You hit the ${targetDisplayName} for ${damage} damage!`, type: 'combat-hit' });
    success = true; // Attack was performed

    // --- 6. Check for Death ---
    if (healthComp.current <= 0 && previousHealth > 0) {
        // Target died on this hit
        messages.push({ text: `The ${targetDisplayName} collapses, defeated!`, type: 'combat-crit' }); // Use crit style for death

        // --- 7. Dispatch Death Event ---
        try {
            dispatch('event:entity_died', {
                deceasedEntityId: targetEntity.id,
                killerEntityId: playerEntity.id,
                // Include full entities if needed by listeners, but IDs are often safer/simpler
                // deceasedEntity: targetEntity,
                // killerEntity: playerEntity
            });
        } catch (dispatchError) {
            console.error("Attack Handler: Failed to dispatch entity_died event:", dispatchError);
            messages.push({text: "(Internal Error: Death event dispatch failed)", type: 'error'});
        }

        // --- (Optional MVP+): Remove entity from location ---
        // This requires modifying the EntitiesPresentComponent instance
        if(presentComp) {
            presentComp.removeEntity(targetEntity.id);
            console.log(`Attack Handler: Removed deceased entity ${targetEntity.id} from location ${currentLocation.id}`);
        }
        // Note: The entity instance might still exist in entityManager.activeEntities
        // depending on game cleanup rules (outside MVP scope).

    } else if (healthComp.current > 0) {
        // Optional: Indicate current health state
        // messages.push({ text: `The ${targetDisplayName} looks wounded. (HP: ${healthComp.current}/${healthComp.max})`, type: 'combat-info' });
    }


    // --- 8. Return Result ---
    return { success, messages, newState: undefined }; // No state change requested by attack itself
}