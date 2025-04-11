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
 * Aligned with schema expecting parameters: { event_name: string, payload?: object }.
 * @param {object | undefined} params - Effect parameters according to schema.
 * @param {string} params.event_name - The name of the event to trigger.
 * @param {object} [params.payload={}] - Optional event-specific data provided in the item definition.
 * @param {EffectContext} context - The context of the effect execution.
 * @returns {EffectResult} - The result of the effect.
 */
export function handleTriggerEventEffect(params, context) {
    /** @type {ActionMessage[]} */
    const messages = [];
    const {eventBus, userEntity, target, itemName, entityManager, itemInstanceId, itemDefinitionId} = context;

    // 1. Validate and Extract Parameters according to the NEW SCHEMA
    if (!params || typeof params.event_name !== 'string' || params.event_name.trim() === '') {
        console.error(`EffectExecutionService: Invalid or missing 'event_name' parameter for 'trigger_event' effect in item ${itemName}. Params:`, params);
        messages.push({ text: `Internal Error: ${itemName} trigger_event effect misconfigured (missing/invalid event_name).`, type: 'error' });
        return {success: false, messages: messages, stopPropagation: true};
    }
    const event_name = params.event_name;
    // Use the nested 'payload' object from the schema, default to empty object if missing
    const providedPayload = (params.payload && typeof params.payload === 'object') ? params.payload : {};

    messages.push({ text: `Handling trigger_event: '${event_name}'. Provided payload: ${JSON.stringify(providedPayload)}`, type: 'internal' });


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
    // Start with the payload defined in the item schema
    const finalEventPayload = {
        ...providedPayload, // Spread the payload from params.payload FIRST
        // Add/Overwrite with standard context information
        userId: userEntity.id,
        targetEntityId: resolvedTargetEntityId,   // Specific entity ID from context (null if not entity)
        targetConnectionId: resolvedTargetConnectionId, // Specific connection ID from context (null if not connection)
        targetId: targetId,       // Generic target ID from context
        targetType: targetType,   // Target type from context
        sourceItemId: itemInstanceId,     // Instance ID of the item triggering event (from context)
        sourceItemDefinitionId: itemDefinitionId, // Definition ID of the item (from context)
    };
    messages.push({ text: `Base final payload with context: ${JSON.stringify(finalEventPayload)}`, type: 'internal' });


    // 4. Specific Handling/Enrichment for Certain Events (Example: connection_unlock_attempt)
    if (event_name === 'event:connection_unlock_attempt') {
        // Ensure locationId is present (derived from user's context)
        const PositionComponent = entityManager.componentRegistry.get('Position');
        if (!PositionComponent) {
            console.error("EffectExecutionService: Position component class not registered. Cannot get locationId.");
            messages.push({ text: `CRITICAL: Cannot get locationId for ${event_name}.`, type: 'error' });
            // Decide if this is fatal - perhaps set to null or fail? Let's set to null.
            finalEventPayload.locationId = null;
        } else {
            const positionComponent = userEntity.getComponent(PositionComponent);
            // Add locationId if not already provided in the payload AND available in context
            if (finalEventPayload.locationId === undefined && positionComponent?.locationId) {
                finalEventPayload.locationId = positionComponent.locationId;
                messages.push({ text: `Added locationId (${finalEventPayload.locationId}) from context for ${event_name}.`, type: 'internal' });
            } else if (finalEventPayload.locationId === undefined) {
                console.warn(`EffectExecutionService: User ${userEntity.id} lacks PositionComponent or locationId when triggering ${event_name}. LocationId will be missing/null unless provided in payload.`);
                messages.push({ text: `User ${userEntity.id} missing locationId for ${event_name}.`, type: 'warning' });
                finalEventPayload.locationId = null; // Ensure it's null if undefined
            } else {
                messages.push({ text: `Using locationId (${finalEventPayload.locationId}) provided in payload for ${event_name}.`, type: 'internal' });
            }
        }

        // Ensure connectionId is correctly populated (prioritize payload, fallback to context)
        if (!finalEventPayload.connectionId && finalEventPayload.targetConnectionId) {
            messages.push({ text: `Using connectionId (${finalEventPayload.targetConnectionId}) derived from target context as fallback.`, type: 'internal' });
            finalEventPayload.connectionId = finalEventPayload.targetConnectionId;
        } else if (!finalEventPayload.connectionId) {
            console.error(`EffectExecutionService: Missing 'connectionId' in payload and target context for ${event_name} triggered by ${itemName}. Target:`, target);
            messages.push({ text: `CRITICAL: Missing connectionId for ${event_name}. Target was type ${targetType}.`, type: 'error' });
            return {success: false, messages: messages, stopPropagation: true}; // Fail if essential payload data is missing
        } else {
            messages.push({ text: `Using connectionId (${finalEventPayload.connectionId}) provided in payload.`, type: 'internal' });
        }

        // Ensure keyId is populated (prioritize payload, fallback to item instance context)
        if (!finalEventPayload.keyId) {
            messages.push({ text: `Using keyId (${itemInstanceId}) derived from item instance context as fallback.`, type: 'internal' });
            finalEventPayload.keyId = itemInstanceId;
        } else {
            messages.push({ text: `Using keyId (${finalEventPayload.keyId}) provided in payload.`, type: 'internal' });
        }
    } // End specific handling for event:connection_unlock_attempt

    // 5. Dispatch Event via context.eventBus
    try {
        console.debug(`EffectExecutionService: Dispatching event '${event_name}' via EventBus for item ${itemName}. Final Payload:`, finalEventPayload);
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