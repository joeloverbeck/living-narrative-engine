// src/effects/handlers/handleHealEffect.js

import {getDisplayName} from '../../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../../systems/itemUsageSystem.js').EffectContext} EffectContext */
/** @typedef {import('../../systems/itemUsageSystem.js').EffectResult} EffectResult */
/** @typedef {import('../../actions/actionTypes.js').ActionMessage} ActionMessage */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * Effect handler function for healing.
 * Relies solely on the provided context for dependencies.
 * @param {object | undefined} params - Effect parameters ({ amount, target?, fail_if_already_max? }).
 * @param {EffectContext} context - The context of the effect execution.
 * @returns {EffectResult} - The result of the effect.
 */
export function handleHealEffect(params, context) {
    /** @type {ActionMessage[]} */
    const messages = [];
    const {userEntity, target, entityManager, eventBus, itemName} = context;
    const {
        amount,
        target: targetSpecifier = 'user', // 'user' or 'target'
        fail_if_already_max = false
    } = params ?? {};

    // 1. Validate Parameters
    if (typeof amount !== 'number' || amount <= 0) {
        const errorMsg = `Invalid 'amount' parameter (${amount}) for 'heal' effect in item ${itemName}.`;
        console.error(`EffectExecutionService: ${errorMsg}`); // Log source is now service
        messages.push({text: `Internal Error: ${itemName} heal effect misconfigured.`, type: 'error'});
        return {success: false, messages: messages, stopPropagation: true};
    }

    // 2. Identify Target Entity for Healing
    let actualTargetEntity = null;
    if (targetSpecifier === 'target') {
        // Check if the context target is an entity (basic duck typing)
        if (target && typeof target.getComponent === 'function') {
            actualTargetEntity = /** @type {Entity} */ (target);
        } else {
            console.warn(`EffectExecutionService: Heal effect specified 'target', but context target is not an entity. Item: ${itemName}, Target:`, target);
            if (target) {
                eventBus.dispatch('ui:message_display', {text: `The ${itemName} cannot heal that.`, type: 'info'});
            }
            return {
                success: false,
                messages: [{text: 'Heal target is not an entity or was null.', type: 'internal'}],
                stopPropagation: false
            };
        }
    } else { // targetSpecifier === 'user'
        actualTargetEntity = userEntity;
    }

    // Target Entity should now be resolved or we returned
    if (!actualTargetEntity) {
        const errorMsg = `Could not determine target ('${targetSpecifier}') for 'heal' effect in item ${itemName}.`;
        console.error(`EffectExecutionService: ${errorMsg}`);
        messages.push({text: `Internal Error: Could not apply heal from ${itemName}.`, type: 'error'});
        eventBus.dispatch('ui:message_display', {text: `Couldn't apply healing from ${itemName}.`, type: 'error'});
        return {success: false, messages: messages, stopPropagation: true};
    }

    const targetName = getDisplayName(actualTargetEntity);

    // 3. Access Target's HealthComponent using context's entityManager
    const HealthComponent = entityManager.componentRegistry.get('Health');
    if (!HealthComponent) {
        console.error("EffectExecutionService: Health component class not registered in EntityManager provided in context.");
        eventBus.dispatch('ui:message_display', {
            text: `Internal Error: Cannot perform heal action.`,
            type: 'error'
        });
        return {
            success: false,
            messages: [{text: 'Health component not registered.', type: 'error'}],
            stopPropagation: true
        };
    }
    const healthComponent = actualTargetEntity.getComponent(HealthComponent);
    if (!healthComponent) {
        messages.push({text: `${itemName} has no effect on ${targetName}.`, type: 'internal'});
        eventBus.dispatch('ui:message_display', {
            text: `${targetName} cannot be healed by the ${itemName}.`,
            type: 'info'
        });
        return {success: false, messages: messages}; // Cannot heal non-health target
    }

    // 4. Check Health Status & Apply Healing
    const currentHealth = healthComponent.current;
    const maxHealth = healthComponent.max;
    const isFullHealth = currentHealth >= maxHealth;

    if (isFullHealth) {
        const feedbackMsg = `${targetName}'s health is already full.`;
        messages.push({text: feedbackMsg, type: 'internal'});
        eventBus.dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
        return {success: !fail_if_already_max, messages: messages, stopPropagation: fail_if_already_max};
    }

    // Apply healing
    const oldHealth = currentHealth;
    const newHealth = Math.min(maxHealth, oldHealth + amount);
    const actualHeal = newHealth - oldHealth;

    if (actualHeal > 0) {
        healthComponent.current = newHealth; // Update the component state
        const healMsg = `${targetName} recovered ${actualHeal} health.`;
        messages.push({text: healMsg, type: 'success'});
        eventBus.dispatch('ui:message_display', {text: healMsg, type: 'success'});
    } else {
        messages.push({text: `${targetName} health unchanged.`, type: 'internal'});
    }

    // 5. Return Success
    return {success: true, messages: messages};
}