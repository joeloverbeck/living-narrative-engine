// src/effects/handlers/handleTriggerEventEffect.js

import {getDisplayName} from '../../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../../systems/itemUsageSystem.js').EffectContext} EffectContext */
/** @typedef {import('../../systems/itemUsageSystem.js').EffectResult} EffectResult */
/** @typedef {import('../../actions/actionTypes.js').ActionMessage} ActionMessage */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * Effect handler function for triggering events.
 * Relies solely on the provided context for dependencies.
 * @param {object | undefined} params - Effect parameters ({ event_name, event_payload?, feedback_message? }).
 * @param {EffectContext} context - The context of the effect execution.
 * @returns {EffectResult} - The result of the effect.
 */
export function handleTriggerEventEffect(params, context) {
    /** @type {ActionMessage[]} */
    const messages = [];
    // Ensure itemInstanceId and itemDefinitionId are used from context
    const {eventBus, userEntity, target, itemName, entityManager, itemInstanceId, itemDefinitionId} = context;
    const {
        event_name,
        event_payload = {},
        feedback_message
    } = params ?? {};

    // 1. Validate Parameters
    if (typeof event_name !== 'string' || event_name.trim() === '') {
        console.error(`EffectExecutionService: Invalid 'event_name' parameter for 'trigger_event' effect in item ${itemName}.`);
        messages.push({
            text: `Internal Error: ${itemName} trigger_event effect misconfigured (event_name).`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }
    if (typeof event_payload !== 'object' || event_payload === null) {
        console.error(`EffectExecutionService: Invalid 'event_payload' parameter for 'trigger_event' effect in item ${itemName}.`);
        messages.push({
            text: `Internal Error: ${itemName} trigger_event effect misconfigured (event_payload).`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }

    // 2. Construct Final Event Payload
    let targetId = null;
    let targetType = 'none';
    let resolvedTargetEntityId = null;
    let resolvedTargetConnectionId = null;

    if (target && typeof target.getComponent === 'function') { // Entity check
        targetId = target.id;
        targetType = 'entity';
        resolvedTargetEntityId = target.id;
    } else if (target && target.connectionId) { // Connection check
        targetId = target.connectionId; // Use connectionId as the ID
        targetType = 'connection';
        resolvedTargetConnectionId = target.connectionId;
    }

    const finalEventPayload = {
        ...event_payload, // Include properties from the item's effect_payload
        userId: userEntity.id,
        targetEntityId: resolvedTargetEntityId,   // Specific entity ID
        targetConnectionId: resolvedTargetConnectionId, // Specific connection ID
        targetId: targetId,       // Keep generic one for compatibility?
        targetType: targetType,
        sourceItemId: itemInstanceId,     // Use instance ID of the item triggering event
        sourceItemDefinitionId: itemDefinitionId, // Include definition ID too
    };

    // Specific handling for certain events, like connection_unlock_attempt
    if (event_name === 'event:connection_unlock_attempt') {
        // Get PositionComponent class via context's entityManager
        const PositionComponent = entityManager.componentRegistry.get('Position');
        if (!PositionComponent) {
            console.error("EffectExecutionService: Position component class not registered. Cannot get locationId.");
            messages.push({text: `CRITICAL: Cannot get locationId for ${event_name}.`, type: 'error'});
            finalEventPayload.locationId = null;
        } else {
            const positionComponent = userEntity.getComponent(PositionComponent);
            if (positionComponent?.locationId) {
                finalEventPayload.locationId = positionComponent.locationId;
                messages.push({
                    text: `Added locationId (${finalEventPayload.locationId}) for ${event_name}.`,
                    type: 'internal'
                });
            } else {
                console.warn(`EffectExecutionService: User ${userEntity.id} lacks PositionComponent or locationId when triggering ${event_name}. LocationId will be missing from payload.`);
                messages.push({
                    text: `User ${userEntity.id} missing locationId for ${event_name}.`,
                    type: 'warning'
                });
                finalEventPayload.locationId = null;
            }
        }

        // Ensure connectionId is correctly populated if target was a connection
        if (!finalEventPayload.connectionId && finalEventPayload.targetConnectionId) {
            finalEventPayload.connectionId = finalEventPayload.targetConnectionId;
            messages.push({
                text: `Populated connectionId (${finalEventPayload.connectionId}) from target context.`,
                type: 'internal'
            });
        }

        // Verify required fields specific to this event
        if (!finalEventPayload.connectionId) {
            console.error(`EffectExecutionService: Missing 'connectionId' in payload for ${event_name} triggered by ${itemName}. Target:`, target);
            messages.push({
                text: `CRITICAL: Missing connectionId for ${event_name}. Target was type ${targetType}.`,
                type: 'error'
            });
            return {success: false, messages: messages, stopPropagation: true}; // Fail if essential payload data is missing
        }
        // Ensure keyId is populated (should be the item instance ID)
        if (!finalEventPayload.keyId) {
            finalEventPayload.keyId = itemInstanceId;
            messages.push({text: `Added keyId (${itemInstanceId}) from item context.`, type: 'internal'});
        } else {
            messages.push({
                text: `Using pre-defined keyId (${finalEventPayload.keyId}) from effect_payload.`,
                type: 'internal'
            });
        }
    }

    // 3. Dispatch Event via context.eventBus
    try {
        console.debug(`EffectExecutionService: Dispatching event '${event_name}' via EventBus for item ${itemName}. Payload:`, finalEventPayload);
        eventBus.dispatch(event_name, finalEventPayload);
        messages.push({text: `Dispatched event '${event_name}' for ${itemName}.`, type: 'internal'});
    } catch (error) {
        const errorMsg = `Error dispatching event '${event_name}' for item ${itemName}: ${error.message}`;
        console.error(`EffectExecutionService: ${errorMsg}`, error);
        messages.push({text: `Internal Error: Failed to dispatch event for ${itemName}.`, type: 'error'});
        eventBus.dispatch('ui:message_display', {
            text: `An error occurred triggering an effect from ${itemName}.`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }

    // 4. Optional Feedback via context.eventBus
    if (typeof feedback_message === 'string' && feedback_message.trim() !== '') {
        console.debug(`EffectExecutionService: Triggering feedback message for ${itemName}: "${feedback_message}"`);
        // Placeholder replacement for feedback message
        let finalFeedback = feedback_message;
        if (finalFeedback.includes('{target}') && target) {
            const targetName = targetType === 'entity'
                ? getDisplayName(/** @type {Entity} */(target))
                : (/** @type {Connection} */(target).name || /** @type {Connection} */(target).direction);
            finalFeedback = finalFeedback.replace('{target}', targetName);
        } else if (finalFeedback.includes('{target}')) {
            finalFeedback = finalFeedback.replace('{target}', 'nothing');
        }
        eventBus.dispatch('ui:message_display', {text: finalFeedback, type: 'info'});
        messages.push({text: `Dispatched feedback message: "${finalFeedback}"`, type: 'internal'});
    }

    // 5. Return Success
    return {success: true, messages: messages};
}