// Import necessary components and utilities
import {HealthComponent} from '../../components/healthComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js'; // ***** IMPORT NEW SERVICE *****

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../../src/entities/entity.js').default} Entity */

/**
 * Validates the intent to execute the 'attack' action and fires an event.
 * Uses TargetResolutionService.
 * Does NOT apply damage or handle death directly.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeAttack(context) {
    const {playerEntity, targets, dispatch} = context; // Removed currentLocation, entityManager (handled by resolver)
    const messages = []; // Keep for internal logs if needed
    // let success = false; // Determined later

    // --- 1. Check if targets were provided ---
    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('attack');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        // messages.push({ text: errorMsg, type: 'error' }); // Optional internal log
        return {success: false, messages, newState: undefined};
    }

    const targetName = targets.join(' ');

    // --- 2. Resolve Target Entity using Service ---
    const targetEntity = resolveTargetEntity(context, {
        // Scope: Non-item entities in the current location (excluding player)
        // Option 1: Specific scope
        scope: 'location_non_items',
        // Option 2: Generic scope + component filter (might be slightly less performant if many items)
        // scope: 'location',
        requiredComponents: [HealthComponent], // Must have health to be attackable (implicitly needs NameComponent)
        actionVerb: 'attack',
        targetName: targetName,
        notFoundMessageKey: 'NOT_FOUND_ATTACKABLE', // Use specific message
        // emptyScopeMessage: "There's nothing here to attack.", // Custom empty message
    });

    // --- 3. Handle Resolver Result ---
    if (!targetEntity) {
        // Failure message already dispatched by resolveTargetEntity
        return {success: false, messages, newState: undefined};
    }

    // --- 4. Validate Identified Target Entity ---
    // Note: Self-attack check is handled by the 'location' scope excluding player.
    // Double-check HealthComponent (already filtered by resolver, but good practice)
    const healthComp = targetEntity.getComponent(HealthComponent);
    const targetDisplayName = getDisplayName(targetEntity);
    if (!healthComp) {
        // This case implies an issue with resolver or component removal race condition
        const warnMsg = TARGET_MESSAGES.ATTACK_NON_COMBATANT(targetDisplayName);
        dispatch('ui:message_display', {text: warnMsg, type: 'warning'});
        messages.push({text: warnMsg, type: 'warning'});
        console.warn(`executeAttack: Target ${targetEntity.id} selected but lacks HealthComponent post-resolution.`);
        return {success: false, messages, newState: undefined};
    }

    // Check if target is already defeated
    if (healthComp.current <= 0) {
        const infoMsg = TARGET_MESSAGES.ATTACK_DEFEATED(targetDisplayName);
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        // Keep original logic: return success true even if target is dead
        return {success: true, messages, newState: undefined};
    }

    // --- 5. Calculate Potential Damage ---
    const playerAttackComp = playerEntity.getComponent(AttackComponent);
    const potentialDamage = playerAttackComp ? playerAttackComp.damage : 1;
    if (!playerAttackComp) {
        console.warn(`Attack Handler: Player entity ${playerEntity.id} has no AttackComponent. Defaulting damage to 1.`);
        messages.push({text: "Player missing AttackComponent", type: "internal"});
    }

    const playerName = getDisplayName(playerEntity);

    // --- 6. Dispatch Swing Message ---
    const swingMsg = `${playerName} swing${playerName === 'You' ? '' : 's'} at the ${targetDisplayName}!`;
    dispatch('ui:message_display', {text: swingMsg, type: 'combat'});
    messages.push({text: swingMsg, type: 'combat'});

    // --- 7. FIRE INTENT EVENT ---
    const eventPayload = {
        attackerId: playerEntity.id,
        targetId: targetEntity.id,
        potentialDamage: potentialDamage,
    };

    let success = false; // Default to false
    try {
        dispatch('event:attack_intended', eventPayload);
        success = true; // Set success only if dispatch doesn't throw
        messages.push({text: `Dispatched event:attack_intended vs ${targetEntity.id}`, type: 'internal'});
    } catch (dispatchError) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Attack intent event dispatch failed)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error("Attack Handler: Failed to dispatch event:attack_intended event:", dispatchError);
        // success remains false
    }

    // --- 8. Return Result ---
    return {success, messages, newState: undefined};
}