// src/actions/handlers/attackActionHandler.js

// --- Core Components ---
import {HealthComponent} from '../../components/healthComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';
// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * Validates the intent to execute the 'attack' action and fires an event.
 * Uses resolveTargetEntity service.
 * Does NOT apply damage or handle death directly.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeAttack(context) {
    const {playerEntity, dispatch, entityManager, parsedCommand} = context;
    const messages = []; // Keep for internal logs if needed
    let success = false; // Default to failure

    // --- 1. Validate required target name ---
    if (!validateRequiredCommandPart(context, 'attack', 'directObjectPhrase')) {
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }
    const targetName = parsedCommand.directObjectPhrase;
    messages.push({text: `Attack intent: Target name '${targetName}'`, type: 'internal'});

    // --- 2. Resolve Target Entity using Service ---
    const resolution = resolveTargetEntity(context, {
        scope: 'location_non_items', // Attack things in the location (not loose items)
        requiredComponents: [HealthComponent], // Must have health to be attackable
        actionVerb: 'attack', // For potential message construction
        targetName: targetName,
    });

    // --- 3. Handle Resolver Result ---
    switch (resolution.status) {
        case 'FOUND_UNIQUE': {
            const targetEntity = resolution.entity;
            const targetDisplayName = getDisplayName(targetEntity);
            messages.push({text: `Resolved target to ${targetDisplayName} (${targetEntity.id})`, type: 'internal'});

            // --- 4. Validate Identified Target Entity ---
            // HealthComponent presence is already ensured by requiredComponents in the resolver,
            // but we still need the instance for checks.
            const healthComp = targetEntity.getComponent(HealthComponent);

            // Check if target is already defeated (using the resolved entity)
            if (healthComp.current <= 0) {
                const infoMsg = TARGET_MESSAGES.ATTACK_DEFEATED(targetDisplayName);
                dispatch('ui:message_display', {text: infoMsg, type: 'info'});
                messages.push({text: infoMsg, type: 'info'});
                // Intent validation passed (found a target), even if it's defeated.
                // No actual attack event dispatched. Consider success=true as validation passed.
                success = true;
                break; // Exit switch
            }

            // --- 5. Calculate Potential Damage ---
            const playerAttackComp = playerEntity.getComponent(AttackComponent);
            const potentialDamage = playerAttackComp ? playerAttackComp.damage : 1;
            const playerName = getDisplayName(playerEntity);
            if (!playerAttackComp) {
                console.warn(`Attack Handler: Player ${playerEntity.id} missing AttackComponent. Defaulting damage to 1.`);
                messages.push({text: "Player missing AttackComponent, defaulting damage", type: "internal"});
            }

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

            try {
                dispatch('event:attack_intended', eventPayload);
                success = true; // Mark success only if dispatch doesn't throw
                messages.push({text: `Dispatched event:attack_intended vs ${targetEntity.id}`, type: 'internal'});
            } catch (dispatchError) {
                const errorMsgForUser = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: errorMsgForUser, type: 'error'});
                const internalErrorDetail = `Attack intent event dispatch failed for target ${targetEntity.id}`;
                messages.push({text: `${errorMsgForUser} (${internalErrorDetail})`, type: 'error'});
                console.error(`Attack Handler: Failed to dispatch event:attack_intended event: ${internalErrorDetail}`, dispatchError);
                success = false; // Ensure success is false
            }
            break; // Exit switch
        }

        case 'NOT_FOUND': {
            const feedbackMsg = TARGET_MESSAGES.NOT_FOUND_ATTACKABLE(targetName);
            dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
            messages.push({text: `Resolution failed: NOT_FOUND. User message: "${feedbackMsg}"`, type: 'internal'});
            success = false;
            break;
        }

        case 'AMBIGUOUS': {
            const feedbackMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('attack', targetName, resolution.candidates);
            dispatch('ui:message_display', {text: feedbackMsg, type: 'warning'});
            messages.push({text: `Resolution failed: AMBIGUOUS. User message: "${feedbackMsg}"`, type: 'internal'});
            success = false;
            break;
        }

        case 'FILTER_EMPTY': {
            // This means the scope ('location_non_items') was empty OR nothing met the HealthComponent criteria.
            // Use a generic "nothing here" or a specific "nothing attackable" message.
            // Assuming TARGET_MESSAGES.SCOPE_EMPTY_GENERIC exists:
            const feedbackMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('attack', 'location'); // Or create TARGET_MESSAGES.NOTHING_ATTACKABLE_HERE
            // const feedbackMsg = `You don't see anything attackable here.` // Hardcoded alternative
            dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
            messages.push({text: `Resolution failed: FILTER_EMPTY. User message: "${feedbackMsg}"`, type: 'internal'});
            success = false;
            break;
        }

        case 'INVALID_INPUT': {
            const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
            messages.push({
                text: `Resolution failed: INVALID_INPUT. Configuration error calling resolveTargetEntity.`,
                type: 'internal_error'
            });
            console.error(`executeAttack: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
            success = false;
            break;
        }

        default: {
            // Handle unexpected status from resolveTargetEntity
            const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
            messages.push({text: `Resolution failed: Unhandled status '${resolution.status}'`, type: 'internal_error'});
            console.error(`executeAttack: Unhandled resolution status: ${resolution.status}`);
            success = false;
            break;
        }
    } // End switch

    // --- 8. Return Result ---
    // Success indicates if the intent validation and processing (up to dispatching events) succeeded.
    return {success, messages, newState: undefined};
}