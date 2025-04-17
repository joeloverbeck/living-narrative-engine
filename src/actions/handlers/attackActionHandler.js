// src/actions/handlers/attackActionHandler.js

// --- Core Components ---
import {HealthComponent} from '../../components/healthComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';

// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
// Import the new utility functions
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js';
import {EVENT_ATTACK_INTENDED, EVENT_DISPLAY_MESSAGE} from "../../types/eventTypes.js";

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/** @typedef {import('../../types/eventTypes.js').AttackIntendedEventPayload} AttackIntendedEventPayload */

/**
 * Validates the intent to execute the 'attack' action and fires an event.
 * Uses handleActionWithTargetResolution for streamlined target finding and validation.
 * Does NOT apply damage or handle death directly; dispatches EVENT_ATTACK_INTENDED.
 * @param {ActionContext} context
 * @returns {Promise<ActionResult>}
 */
export async function executeAttack(context) {
    const {playerEntity, dispatch} = context;

    /**
     * Callback executed when a unique, valid target is found by handleActionWithTargetResolution.
     * Contains the core logic for attempting an attack.
     * @param {ActionContext} innerContext - The action context passed through.
     * @param {Entity} targetEntity - The uniquely resolved target entity.
     * @param {ActionMessage[]} messages - The array of messages accumulated so far.
     * @returns {ActionResult} - The result of the attack attempt validation/dispatch.
     */
    const onFoundUnique = (innerContext, targetEntity, messages) => {
        const targetDisplayName = getDisplayName(targetEntity);
        const healthComp = targetEntity.getComponent(HealthComponent); // Already validated to exist by handleAction...

        // Check if target is already defeated
        if (healthComp.current <= 0) {
            const infoMsg = TARGET_MESSAGES.ATTACK_DEFEATED(targetDisplayName);
            innerContext.dispatch(EVENT_DISPLAY_MESSAGE, {text: infoMsg, type: 'info'});
            messages.push({text: infoMsg, type: 'info'}); // Add user message to internal log
            // Validation passed (found target), but no attack event dispatched.
            // Return success=true because the action handler successfully processed the intent.
            return {success: true, messages, newState: undefined};
        }

        // Calculate Potential Damage
        const playerAttackComp = playerEntity.getComponent(AttackComponent);
        const potentialDamage = playerAttackComp ? playerAttackComp.damage : 1; // Default damage if component missing
        const playerName = getDisplayName(playerEntity);

        if (!playerAttackComp) {
            console.warn(`Attack Handler (onFoundUnique): Player ${playerEntity.id} missing AttackComponent. Defaulting damage to 1.`);
            messages.push({text: "Player missing AttackComponent, defaulting damage", type: "internal"});
        }

        // Dispatch Swing Message (Visual Feedback)
        const swingMsg = `${playerName} swing${playerName === 'You' ? '' : 's'} at the ${targetDisplayName}!`;
        innerContext.dispatch(EVENT_DISPLAY_MESSAGE, {text: swingMsg, type: 'combat'});
        messages.push({text: swingMsg, type: 'combat'}); // Add user message to internal log

        // FIRE INTENT EVENT using dispatchEventWithCatch
        /** @type {AttackIntendedEventPayload} */
        const eventPayload = {
            attackerId: playerEntity.id,
            targetId: targetEntity.id,
            potentialDamage: potentialDamage,
        };

        const dispatchResult = dispatchEventWithCatch(
            innerContext,
            EVENT_ATTACK_INTENDED,
            eventPayload,
            messages, // Pass messages array for internal logging
            {
                success: `Dispatched ${EVENT_ATTACK_INTENDED} vs ${targetDisplayName} (${targetEntity.id})`,
                errorUser: TARGET_MESSAGES.INTERNAL_ERROR, // User message on dispatch failure
                errorInternal: `Failed to dispatch ${EVENT_ATTACK_INTENDED} vs ${targetDisplayName} (${targetEntity.id}).` // Internal log on failure
            }
        );

        // Return the result based on whether the event dispatch succeeded
        // handleActionWithTargetResolution will combine the messages.
        return {success: dispatchResult.success, messages: [], newState: undefined};
    };

    // --- Define options for handleActionWithTargetResolution ---
    /** @type {HandleActionWithOptions} */
    const options = {
        scope: 'location_non_items',         // AC: scope configured
        requiredComponents: [HealthComponent], // AC: requiredComponents configured
        commandPart: 'directObjectPhrase',   // AC: commandPart configured
        actionVerb: 'attack',                // AC: actionVerb configured
        onFoundUnique: onFoundUnique,        // AC: Original logic moved to callback
        failureMessages: {                   // AC: Optional failureMessages configured
            notFound: TARGET_MESSAGES.NOT_FOUND_ATTACKABLE, // Use specific message for attack
            // AMBIGUOUS, FILTER_EMPTY, INVALID_INPUT will use defaults unless overridden
        },
    };

    // --- Execute the core utility function ---
    // AC: Main body replaced by single call
    // AC: Large switch statement removed
    return await handleActionWithTargetResolution(context, options);
}