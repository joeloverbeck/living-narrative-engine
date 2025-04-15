// src/effects/handlers/handleTriggerEventEffect.js

import {getDisplayName} from '../../utils/messages.js';
// Import PassageDetailsComponent to access blocker information
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js'; // <<< ADDED IMPORT

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
 * Handles translation of 'event:connection_unlock_attempt' to 'event:unlock_entity_attempt'
 * if the connection has a blocker.
 * @param {object | undefined} params - Effect parameters according to schema.
 * @param {string} params.eventName - The name of the event to trigger.
 * @param {object} [params.payload={}] - Optional event-specific data provided in the item definition.
 * @param {EffectContext} context - The context of the effect execution.
 * @returns {EffectResult} - The result of the effect.
 */
export function handleTriggerEventEffect(params, context) {
    /** @type {ActionMessage[]} */
    const messages = [];
    // Destructure targetType explicitly as it's needed for translation logic
    const {
        eventBus,
        userEntity,
        target,
        targetType: resolvedTargetType,
        itemName,
        entityManager,
        itemInstanceId,
        itemDefinitionId
    } = context;

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

    const providedPayload = params.payload || {};

    messages.push({
        text: `Handling trigger_event: '${eventName}'. Provided payload: ${JSON.stringify(providedPayload)}`,
        type: 'internal'
    });

    // 2. Determine Target Information from Context (Remains mostly the same)
    let targetId = null;
    // Use resolvedTargetType from context directly
    let targetType = resolvedTargetType || 'none';
    let resolvedTargetEntityId = null;
    let resolvedTargetConnectionId = null;

    if (targetType === 'entity' && target && typeof target.getComponent === 'function') {
        targetId = target.id;
        resolvedTargetEntityId = target.id;
    } else if (targetType === 'connection' && target && target.id) { // Assume connection entity has an ID
        targetId = target.id; // Use the connection entity's ID as the targetId
        resolvedTargetConnectionId = target.id; // Store connection entity ID
    }

    // 3. Construct Initial Event Payload - Merge provided payload with context
    const initialEventPayload = {
        userId: userEntity.id,
        targetEntityId: resolvedTargetEntityId,
        targetConnectionId: resolvedTargetConnectionId, // Now holds the connection *entity* ID
        targetId: targetId,
        targetType: targetType,
        sourceItemId: itemInstanceId,
        sourceItemDefinitionId: itemDefinitionId,
        ...providedPayload,
    };
    messages.push({text: `Constructed initial payload: ${JSON.stringify(initialEventPayload)}`, type: 'internal'});

    // 4. Specific Handling/Enrichment for Certain Events (Pre-Translation)
    // This block prepares the payload *as if* it were going to be dispatched directly.
    // The keyItemId logic is important for *both* the original and potentially translated events.
    // Combine the check for both lock and unlock attempts
    if (eventName === 'event:unlock_entity_attempt' ||
        eventName === 'event:connection_unlock_attempt' ||
        eventName === 'event:lock_entity_attempt') {
        // Determine the definitive keyItemId for this attempt.
        // Priority: Explicit keyItemId in payload > Item Definition ID from context > Context keyItemId (if tests inject it).
        let derivedKeyItemId = initialEventPayload.keyItemId; // Check if payload provided it directly
        let keyIdSource = 'payload';

        // Option A: Check context.keyItemId if not in payload (Matches test setup)
        // Note: This assumes context.keyItemId is a valid way to pass this info for trigger_event
        if (derivedKeyItemId === undefined && context.keyItemId !== undefined) {
            derivedKeyItemId = context.keyItemId;
            keyIdSource = 'context';
            messages.push({
                text: `Using keyItemId (${derivedKeyItemId}) found directly in context for ${eventName}.`,
                type: 'internal'
            });
        }
        // Option B: Fallback to sourceItemDefinitionId (Original logic for unlock)
        else if (derivedKeyItemId === undefined && initialEventPayload.sourceItemDefinitionId) {
            derivedKeyItemId = initialEventPayload.sourceItemDefinitionId;
            keyIdSource = 'definition'; // Source changed for clarity
            messages.push({
                text: `Mapped sourceItemDefinitionId (${derivedKeyItemId}) to keyItemId for ${eventName}.`,
                type: 'internal'
            });
        } else if (derivedKeyItemId !== undefined) {
            messages.push({
                text: `Using keyItemId (${derivedKeyItemId}) provided directly in payload for ${eventName}.`,
                type: 'internal'
            });
        } else {
            // Neither provided nor derivable - set to null or undefined explicitly?
            // LockSystem expects null if no key used. Let's default to null here.
            derivedKeyItemId = null; // Explicitly set to null if no key info found
            keyIdSource = 'none';
            messages.push({
                text: `No keyItemId provided in payload, context, or derived from sourceItemDefinitionId for ${eventName}. keyItemId defaulted to null.`,
                type: 'warning' // Changed to warning
            });
        }

        // Ensure the derived keyItemId is in the payload we might use later.
        // IMPORTANT: Update the payload that will become finalPayload
        initialEventPayload.keyItemId = derivedKeyItemId; // Make sure this gets into the payload

    }

    // Enrichment for event:connection_unlock_attempt (if it were to be dispatched directly)
    // This is less critical now as we translate, but keeps the original structure consistent.
    // The translation logic below will build its own payload.
    if (eventName === 'event:connection_unlock_attempt') {
        // Ensure locationId is present (derived from user's context)
        // This part is kept for consistency but locationId isn't typically needed for event:unlock_entity_attempt
        const PositionComponent = entityManager.componentRegistry.get('Position');
        if (!PositionComponent) {
            console.error("EffectExecutionService: Position component class not registered. Cannot get locationId.");
            messages.push({text: `CRITICAL: Cannot get locationId for ${eventName}.`, type: 'error'});
            initialEventPayload.locationId = null;
        } else {
            const positionComponent = userEntity.getComponent(PositionComponent);
            if (initialEventPayload.locationId === undefined && positionComponent?.locationId) {
                initialEventPayload.locationId = positionComponent.locationId;
                messages.push({
                    text: `Added locationId (${initialEventPayload.locationId}) from context for potential ${eventName}.`,
                    type: 'internal'
                });
            } else if (initialEventPayload.locationId === undefined) {
                console.warn(`EffectExecutionService: User ${userEntity.id} lacks PositionComponent or locationId when triggering ${eventName}. LocationId will be missing/null unless provided in payload.`);
                messages.push({
                    text: `User ${userEntity.id} missing locationId for potential ${eventName}.`,
                    type: 'warning'
                });
                initialEventPayload.locationId = null;
            } else {
                messages.push({
                    text: `Using locationId (${initialEventPayload.locationId}) provided in payload for potential ${eventName}.`,
                    type: 'internal'
                });
            }
        }
        // Note: ConnectionId and KeyId checks from original code are less relevant here
        // as we'll rebuild the payload if translating. The critical part is deriving `keyItemId`.
    }


    // ================================================================
    // == Phase 2, Step 4: Connection Unlock Attempt Translation Logic ==
    // ================================================================
    let finalEventName = eventName; // Event name to actually dispatch
    // --- Ensure finalPayload uses the potentially updated initialEventPayload ---
    let finalPayload = {...initialEventPayload}; // Payload to actually dispatch (start with potentially modified initial)
    let dispatchTranslatedEvent = false; // Flag to indicate if translation occurred

    if (params.eventName === 'event:connection_unlock_attempt') {
        messages.push({text: "Checking for connection unlock translation...", type: 'internal'});

        // 1. Verify Target Type is 'connection'
        if (resolvedTargetType !== 'connection') {
            console.error(`EffectExecutionService: 'event:connection_unlock_attempt' received but resolved targetType is '${resolvedTargetType}' (expected 'connection'). Item: ${itemName}, Target:`, target);
            messages.push({
                text: `Internal Error: Invalid target type for connection unlock attempt. Expected 'connection', got '${resolvedTargetType}'.`,
                type: 'error'
            });
            return {success: false, messages: messages, stopPropagation: true}; // Return failure
        }

        // 2. Verify Target (Connection Entity instance) is valid
        // Check if target looks like an Entity (basic check: has getComponent)
        if (!target || typeof target.getComponent !== 'function') {
            console.error(`EffectExecutionService: 'event:connection_unlock_attempt' received but context.target is invalid or not an Entity. Item: ${itemName}, Target:`, target);
            messages.push({
                text: `Internal Error: Invalid connection target instance provided for unlock attempt.`,
                type: 'error'
            });
            return {success: false, messages: messages, stopPropagation: true}; // Return failure
        }
        const connectionEntity = /** @type {Entity} */ (target); // Cast for clarity

        // 3. Get PassageDetailsComponent
        const passageDetails = connectionEntity.getComponent(PassageDetailsComponent);
        if (!passageDetails) {
            // Gracefully handle missing component: Log warning, do not dispatch event, return success.
            console.warn(`EffectExecutionService: Connection Entity '${connectionEntity.id}' (${getDisplayName(connectionEntity)}) is missing PassageDetailsComponent. Cannot translate unlock attempt. Item: ${itemName}`);
            messages.push({
                text: `Cannot attempt unlock: The connection '${getDisplayName(connectionEntity)}' lacks required details (PassageDetailsComponent).`,
                type: 'warning'
            });
            // Return success, preventing dispatch of any unlock event for this instance.
            return {success: true, messages: messages};
        }

        // 4. Get Blocker ID
        const blockerEntityId = passageDetails.getBlockerId();

        // 5. Handle Translation or No Blocker
        // Ensure the translation logic also uses the correctly derived keyItemId
        if (blockerEntityId) {
            // --- Blocker Found: Translate the event ---
            messages.push({
                text: `Blocker '${blockerEntityId}' found for connection '${connectionEntity.id}'. Translating 'connection_unlock_attempt' to 'unlock_entity_attempt'.`,
                type: 'internal'
            });

            finalEventName = 'event:unlock_entity_attempt'; // Change the event name
            dispatchTranslatedEvent = true; // Set the flag

            // --- Ensure keyItemId is correct in the *translated* payload ---
            const keyItemIdToUse = finalPayload.keyItemId; // Get it from the already-updated payload

            // Rebuild the payload for the translated event
            finalPayload = {
                userId: userEntity.id,
                targetEntityId: blockerEntityId,
                keyItemId: keyItemIdToUse, // <<< Use the derived keyItemId

                // Optional: Include original context for debugging/traceability
                _sourceConnectionId: connectionEntity.id,
                _sourceItemId: itemInstanceId,
                _sourceItemDefinitionId: itemDefinitionId,
                // Do NOT include fields specific to connection_unlock_attempt like locationId unless needed by unlock_entity_attempt
            };
            messages.push({
                text: `Rebuilt payload for translated event '${finalEventName}': ${JSON.stringify(finalPayload)}`,
                type: 'internal'
            });

        } else {
            // --- No Blocker Found: Log info, prevent dispatch, return success ---
            messages.push({
                text: `Connection '${connectionEntity.id}' (${getDisplayName(connectionEntity)}) has no blocker. The way isn't blocked by a lock. No unlock event dispatched.`,
                type: 'info'
            });
            // Return success early, effectively stopping the dispatch for this specific effect instance.
            return {success: true, messages: messages};
        }
    } // End of 'event:connection_unlock_attempt' translation logic

    // ================================================================
    // == Final Event Dispatch ========================================
    // ================================================================

    try {
        // Use finalEventName and finalPayload which might have been modified by translation logic
        if (dispatchTranslatedEvent) {
            console.debug(`EffectExecutionService: Dispatching TRANSLATED event '${finalEventName}' via EventBus for item ${itemName}. Payload:`, finalPayload);
        } else {
            // Avoid redundant logging if we already returned early (e.g., no blocker case)
            // This block only runs if we didn't hit an early return above.
            console.debug(`EffectExecutionService: Dispatching event '${finalEventName}' via EventBus for item ${itemName}. Final Payload:`, finalPayload);
        }

        eventBus.dispatch(finalEventName, finalPayload);
        messages.push({
            text: `Dispatched ${dispatchTranslatedEvent ? 'translated ' : ''}event '${finalEventName}' for ${itemName}.`,
            type: 'internal'
        });

    } catch (error) {
        const errorMsg = `Error dispatching event '${finalEventName}' for item ${itemName}: ${error.message}`;
        console.error(`EffectExecutionService: ${errorMsg}`, error);
        messages.push({text: `Internal Error: Failed to dispatch event for ${itemName}.`, type: 'error'});
        // Dispatch UI error only if it's a real dispatch error, not a handled case like no blocker
        eventBus.dispatch('ui:message_display', {
            text: `An error occurred triggering an effect from ${itemName}.`,
            type: 'error'
        });
        return {success: false, messages: messages, stopPropagation: true};
    }

    // 6. Optional Feedback via context.eventBus (Remains the same)
    if (typeof params.feedback_message === 'string' && params.feedback_message.trim() !== '') {
        console.debug(`EffectExecutionService: Triggering feedback message for ${itemName}: "${params.feedback_message}"`);
        let finalFeedback = params.feedback_message;
        if (finalFeedback.includes('{target}') && target) {
            // Use the original 'target' from context for feedback message consistency
            const targetName = resolvedTargetType === 'entity'
                ? getDisplayName(/** @type {Entity} */(target))
                : (target.name || target.direction); // Use name or direction for connection display
            finalFeedback = finalFeedback.replace('{target}', targetName || `Connection(${target.id})`); // Added fallback for connection
        } else if (finalFeedback.includes('{target}')) {
            finalFeedback = finalFeedback.replace('{target}', 'nothing');
        }
        eventBus.dispatch('ui:message_display', {text: finalFeedback, type: 'info'});
        messages.push({text: `Dispatched feedback message: "${finalFeedback}"`, type: 'internal'});
    }

    // 7. Return Success (Remains the same)
    return {success: true, messages: messages};
}