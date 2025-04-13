// src/effects/handlers/handleTriggerEventEffect.js

import {getDisplayName} from '../../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../../systems/itemUsageSystem.js').EffectContext} EffectContext */
/** @typedef {import('../../systems/itemUsageSystem.js').EffectResult} EffectResult */
/** @typedef {import('../../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../entities/entity.js').default} Entity */

/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */


/**
 * Effect handler function for triggering events.
 * Relies solely on the provided context for dependencies.
 * Aligned with schema expecting parameters: { eventName: string, payload?: object }.
 * @param {object | undefined} params - Effect parameters according to schema.
 * @param {string} params.eventName - The name of the event to trigger.
 * @param {object} [params.payload={}] - Optional event-specific data provided in the item definition.
 * @param {EffectContext} context - The context of the effect execution.
 * @returns {EffectResult} - The result of the effect.
 */
export function handleTriggerEventEffect(params, context) {
    /** @type {ActionMessage[]} */
    const messages = [];
    const {eventBus, userEntity, target, itemName, entityManager, itemInstanceId, itemDefinitionId} = context;

    // 1. Validate and Extract Parameters according to the NEW SCHEMA
    if (!params || typeof params.eventName !== 'string' || params.eventName.trim() === '') {
        console.error(`EffectExecutionService: Invalid or missing 'eventName' parameter for 'trigger_event' effect in item ${itemName}. Params:`, params);
        messages.push({
            text: `Internal Error: ${itemName} trigger_event effect misconfigured (missing/invalid eventName).`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }
    const eventName = params.eventName;

    if (params.payload !== undefined && (typeof params.payload !== 'object' || params.payload === null)) {
        console.error(`EffectExecutionService: Invalid 'payload' parameter (must be an object or undefined) for 'trigger_event' effect in item ${itemName}. Params:`, params);
        messages.push({
            text: `Internal Error: ${itemName} trigger_event effect misconfigured (invalid payload type).`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }

    // Use the nested 'payload' object from the schema, default to empty object if missing
    const providedPayload = params.payload || {}; // e.g., { keyItemId: "demo:item_key_rusty" }

    messages.push({
        text: `Handling trigger_event: '${eventName}'. Provided payload: ${JSON.stringify(providedPayload)}`,
        type: 'internal'
    });

    // 2. Determine Target Information from Context
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

    // 3. Construct Final Event Payload - Merge provided payload with context
    // Start with the context information
    const finalEventPayload = {
        userId: userEntity.id,
        targetEntityId: resolvedTargetEntityId,
        targetConnectionId: resolvedTargetConnectionId,
        targetId: targetId,
        targetType: targetType,
        sourceItemId: itemInstanceId,           // Keep source info
        sourceItemDefinitionId: itemDefinitionId, // Keep source info
        // NOW, carefully merge the payload from the item definition,
        // allowing it to potentially override context if necessary,
        // but ensuring keys like 'keyItemId' are preserved.
        ...providedPayload, // Spread the specific payload last!
    };
    messages.push({text: `Constructed final payload: ${JSON.stringify(finalEventPayload)}`, type: 'internal'});

    // 4. Specific Handling/Enrichment for Certain Events
    // Ensure the correct key identifier is passed for unlock attempts
    if (eventName === 'event:unlock_entity_attempt' || eventName === 'event:connection_unlock_attempt') {
        // If the payload from the item definition *didn't* already provide a keyItemId,
        // use the source item's definition ID as the keyItemId.
        // Locks usually check against the *type* of key, not the specific instance.
        if (finalEventPayload.keyItemId === undefined && finalEventPayload.sourceItemDefinitionId) {
            finalEventPayload.keyItemId = finalEventPayload.sourceItemDefinitionId;
            messages.push({
                text: `Mapped sourceItemDefinitionId (${finalEventPayload.keyItemId}) to keyItemId for ${eventName}.`,
                type: 'internal'
            });
        } else if (finalEventPayload.keyItemId !== undefined) {
            messages.push({
                text: `Using keyItemId (${finalEventPayload.keyItemId}) provided directly in payload for ${eventName}.`,
                type: 'internal'
            });
        }
        // You might also need similar logic for connectionId if handling connection unlocks here
        // (Your existing connection_unlock_attempt logic might need slight adjustment/review based on this)
    }


    // 4. Specific Handling/Enrichment for Certain Events (Example: connection_unlock_attempt)
    if (eventName === 'event:connection_unlock_attempt') {
        // Ensure locationId is present (derived from user's context)
        const PositionComponent = entityManager.componentRegistry.get('Position');
        if (!PositionComponent) {
            console.error("EffectExecutionService: Position component class not registered. Cannot get locationId.");
            messages.push({text: `CRITICAL: Cannot get locationId for ${eventName}.`, type: 'error'});
            // Decide if this is fatal - perhaps set to null or fail? Let's set to null.
            finalEventPayload.locationId = null;
        } else {
            const positionComponent = userEntity.getComponent(PositionComponent);
            // Add locationId if not already provided in the payload AND available in context
            if (finalEventPayload.locationId === undefined && positionComponent?.locationId) {
                finalEventPayload.locationId = positionComponent.locationId;
                messages.push({
                    text: `Added locationId (${finalEventPayload.locationId}) from context for ${eventName}.`,
                    type: 'internal'
                });
            } else if (finalEventPayload.locationId === undefined) {
                console.warn(`EffectExecutionService: User ${userEntity.id} lacks PositionComponent or locationId when triggering ${eventName}. LocationId will be missing/null unless provided in payload.`);
                messages.push({text: `User ${userEntity.id} missing locationId for ${eventName}.`, type: 'warning'});
                finalEventPayload.locationId = null; // Ensure it's null if undefined
            } else {
                messages.push({
                    text: `Using locationId (${finalEventPayload.locationId}) provided in payload for ${eventName}.`,
                    type: 'internal'
                });
            }
        }

        // Ensure connectionId is correctly populated (prioritize payload, fallback to context)
        if (!finalEventPayload.connectionId && finalEventPayload.targetConnectionId) {
            messages.push({
                text: `Using connectionId (${finalEventPayload.targetConnectionId}) derived from target context as fallback.`,
                type: 'internal'
            });
            finalEventPayload.connectionId = finalEventPayload.targetConnectionId;
        } else if (!finalEventPayload.connectionId) {
            console.error(`EffectExecutionService: Missing 'connectionId' in payload and target context for ${eventName} triggered by ${itemName}. Target:`, target);
            messages.push({
                text: `CRITICAL: Missing connectionId for ${eventName}. Target was type ${targetType}.`,
                type: 'error'
            });
            return {success: false, messages: messages, stopPropagation: true}; // Fail if essential payload data is missing
        } else {
            messages.push({
                text: `Using connectionId (${finalEventPayload.connectionId}) provided in payload.`,
                type: 'internal'
            });
        }

        // Ensure keyId is populated (prioritize payload, fallback to item instance context)
        if (!finalEventPayload.keyId) {
            messages.push({
                text: `Using keyId (${itemInstanceId}) derived from item instance context as fallback.`,
                type: 'internal'
            });
            finalEventPayload.keyId = itemInstanceId;
        } else {
            messages.push({text: `Using keyId (${finalEventPayload.keyId}) provided in payload.`, type: 'internal'});
        }
    } // End specific handling for event:connection_unlock_attempt

    // 5. Dispatch Event via context.eventBus
    try {
        // Now the finalEventPayload should contain 'keyItemId' when eventName is 'event:unlock_entity_attempt'
        console.debug(`EffectExecutionService: Dispatching event '${eventName}' via EventBus for item ${itemName}. Final Payload:`, finalEventPayload);
        eventBus.dispatch(eventName, finalEventPayload);
        messages.push({text: `Dispatched event '${eventName}' for ${itemName}.`, type: 'internal'});
    } catch (error) {
        const errorMsg = `Error dispatching event '${eventName}' for item ${itemName}: ${error.message}`;
        console.error(`EffectExecutionService: ${errorMsg}`, error);
        messages.push({text: `Internal Error: Failed to dispatch event for ${itemName}.`, type: 'error'});
        eventBus.dispatch('ui:message_display', {
            text: `An error occurred triggering an effect from ${itemName}.`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }

    // 6. Optional Feedback via context.eventBus
    if (typeof params.feedback_message === 'string' && params.feedback_message.trim() !== '') {
        console.debug(`EffectExecutionService: Triggering feedback message for ${itemName}: "${params.feedback_message}"`);
        // Placeholder replacement for feedback message
        let finalFeedback = params.feedback_message;
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

    // 7. Return Success
    return {success: true, messages: messages};
}