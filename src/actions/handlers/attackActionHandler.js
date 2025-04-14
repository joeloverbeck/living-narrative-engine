// src/actions/handlers/attackActionHandler.js
// Import necessary components and utilities
import {HealthComponent} from '../../components/healthComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js"; // Corrected path assumption
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../../entities/entity.js').default} Entity */ // Corrected path assumption

/**
 * Validates the intent to execute the 'attack' action and fires an event.
 * Uses TargetResolutionService.
 * Does NOT apply damage or handle death directly.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeAttack(context) {
    // Destructure context, adding parsedCommand and removing targets
    const {playerEntity, dispatch, entityManager, parsedCommand} = context;
    const messages = []; // Keep for internal logs if needed

    // --- 1. Validate required targets using parsedCommand ---
    // The validation utility now implicitly uses parsedCommand.directObjectPhrase
    if (!validateRequiredCommandPart(context, 'attack', 'directObjectPhrase')) { // [cite: file:handlers/attackActionHandler.js]
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }

    // Get target name from parsedCommand instead of targets array
    const targetName = parsedCommand.directObjectPhrase; // *** Ticket 9.1.1 Change ***

    // --- 2. Resolve Target Entity using Service ---
    const targetEntity = resolveTargetEntity(context, {
        scope: 'location_non_items',
        requiredComponents: [HealthComponent], // Must have health to be attackable
        actionVerb: 'attack',
        targetName: targetName, // Use the targetName from parsedCommand *** Ticket 9.1.1 Change *** [cite: file:handlers/attackActionHandler.js]
        notFoundMessageKey: 'NOT_FOUND_ATTACKABLE', // Explicitly use the key from TARGET_MESSAGES
    });

    // --- 3. Handle Resolver Result ---
    if (!targetEntity) {
        // Failure message already dispatched by resolveTargetEntity (using TARGET_MESSAGES via notFoundMessageKey)
        return {success: false, messages, newState: undefined};
    }

    // --- 4. Validate Identified Target Entity ---
    const healthComp = targetEntity.getComponent(HealthComponent);
    const targetDisplayName = getDisplayName(targetEntity);

    // Check if target has health component (redundant if requiredComponents is strictly enforced by resolver, but safe check)
    if (!healthComp) {
        // This case *should* ideally be caught by the resolver's requiredComponents,
        // but checking defensively post-resolution.
        const warnMsg = TARGET_MESSAGES.ATTACK_NON_COMBATANT(targetDisplayName);
        dispatch('ui:message_display', {text: warnMsg, type: 'warning'});
        messages.push({text: warnMsg, type: 'warning'});
        console.warn(`executeAttack: Target ${targetEntity.id} ('${targetDisplayName}') selected but lacks HealthComponent post-resolution.`);
        return {success: false, messages, newState: undefined};
    }

    // Check if target is already defeated
    if (healthComp.current <= 0) {
        const infoMsg = TARGET_MESSAGES.ATTACK_DEFEATED(targetDisplayName);
        dispatch('ui:message_display', {text: infoMsg, type: 'info'});
        messages.push({text: infoMsg, type: 'info'});
        return {success: true, messages, newState: undefined}; // Still counts as success (intent wise), no action needed
    }

    // --- 5. Calculate Potential Damage ---
    const playerAttackComp = playerEntity.getComponent(AttackComponent);
    const potentialDamage = playerAttackComp ? playerAttackComp.damage : 1; // Default damage if player lacks component
    if (!playerAttackComp) {
        // Internal warning, not user-facing via dispatch
        console.warn(`Attack Handler: Player entity ${playerEntity.id} has no AttackComponent. Defaulting damage to 1.`);
        messages.push({text: "Player missing AttackComponent, defaulting damage", type: "internal"});
    }

    const playerName = getDisplayName(playerEntity);

    // --- 6. Dispatch Swing Message ---
    // Assessed as flavor text, not target validation/error, so left as is per ticket guidance.
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
        // --- REFACTOR START ---
        // Use the generic internal error message from TARGET_MESSAGES for the user.
        const errorMsgForUser = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsgForUser, type: 'error'});
        // Add more specific detail to internal messages/logs.
        const internalErrorDetail = `Attack intent event dispatch failed for target ${targetEntity.id}`;
        messages.push({text: `${errorMsgForUser} (${internalErrorDetail})`, type: 'error'});
        console.error(`Attack Handler: Failed to dispatch event:attack_intended event: ${internalErrorDetail}`, dispatchError);
        // --- REFACTOR END ---
        // success remains false
    }

    // --- 8. Return Result ---
    return {success, messages, newState: undefined};
}