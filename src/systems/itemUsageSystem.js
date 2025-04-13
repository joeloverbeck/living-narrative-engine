// src/systems/itemUsageSystem.js

// Service Imports
import {TargetResolutionService} from '../services/targetResolutionService.js';

// Utilities
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */ //
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */ //
/** @typedef {import('../../data/schemas/item.schema.json').definitions.EffectObject} EffectObjectData */ //
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationResult} ConditionEvaluationResult */
/** @typedef {import('../services/targetResolutionService.js').ResolveItemTargetResult} ResolveItemTargetResult */
/** @typedef {import('../services/effectExecutionService.js').EffectExecutionResult} EffectExecutionResult */
/** @typedef {import('../services/effectExecutionService.js').EffectContext} EffectContext */ // Moved type def here for clarity

/**
 * ECS System responsible for handling the logic of using items.
 * Orchestrates calls to ConditionEvaluationService, TargetResolutionService,
 * and EffectExecutionService based on item definition data.
 * Listens for event:item_use_attempted to trigger logic.
 * Dispatches event:item_consume_requested for consumption.
 * Dispatches event:lock_entity_attempt and event:unlock_entity_attempt.
 * Dispatches final success UI messages. Failure messages are expected
 * to be dispatched by the service detecting the failure.
 */
class ItemUsageSystem {
    #eventBus;
    #entityManager;
    #dataManager;
    #conditionEvaluationService;
    #targetResolutionService;
    #effectExecutionService;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     * @param {ConditionEvaluationService} options.conditionEvaluationService
     * @param {TargetResolutionService} options.targetResolutionService
     * @param {EffectExecutionService} options.effectExecutionService
     */
    constructor({
                    eventBus,
                    entityManager,
                    dataManager,
                    conditionEvaluationService,
                    targetResolutionService,
                    effectExecutionService
                }) {
        // Dependency checks (no changes)
        if (!eventBus) throw new Error("ItemUsageSystem requires options.eventBus.");
        if (!entityManager) throw new Error("ItemUsageSystem requires options.entityManager.");
        if (!dataManager) throw new Error("ItemUsageSystem requires options.dataManager.");
        if (!conditionEvaluationService) throw new Error("ItemUsageSystem requires options.conditionEvaluationService.");
        if (!targetResolutionService) throw new Error("ItemUsageSystem requires options.targetResolutionService.");
        if (!effectExecutionService) throw new Error("ItemUsageSystem requires options.effectExecutionService.");

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
        this.#conditionEvaluationService = conditionEvaluationService;
        this.#targetResolutionService = targetResolutionService;
        this.#effectExecutionService = effectExecutionService;

        this.#eventBus.subscribe(
            'event:item_use_attempted',
            this._handleItemUseAttempt.bind(this)
        );

        console.log("ItemUsageSystem: Instance created and subscribed to event:item_use_attempted.");
    }

    // ========================================================================
    // == ORCHESTRATION HANDLER ===============================================
    // ========================================================================

    /**
     * Handles the event:item_use_attempted event. Orchestrates the item usage flow
     * by calling relevant services and handling the overall sequence.
     * Relies on services to perform detailed logic and dispatch specific failure messages.
     * Dispatches final success messages and consumption requests.
     *
     * @param {ItemUseAttemptedEventPayload} payload - The event data.
     * @private
     */
    async _handleItemUseAttempt(payload) {
        /** @type {ActionMessage[]} */
        const internalMessages = []; // For aggregated debug logging
        const log = (text, type = 'internal', data = null) => { // Updated log to potentially include data
            const message = {text, type};
            if (data) message.data = data; // Attach data if provided
            internalMessages.push(message);
        };


        const {
            userEntityId,
            itemInstanceId,
            itemDefinitionId,
            explicitTargetEntityId,
            explicitTargetConnectionId
        } = payload;

        let overallActionSuccess = false; // Tracks if the entire sequence succeeded for final reporting/consumption
        let validatedTarget = null; // Stores the resolved target (Entity | Connection | null)
        let targetType = 'none'; // 'entity', 'connection', or 'none'

        try {
            // --- 1. Setup & Basic Validation ---
            const userEntity = this.#entityManager.getEntityInstance(userEntityId);
            const itemInstance = this.#entityManager.getEntityInstance(itemInstanceId); // May be null if item already removed
            const itemDefinition = this.#dataManager.getEntityDefinition(itemDefinitionId);

            if (!userEntity || !itemDefinition) {
                if (!itemDefinition) {
                    this.#eventBus.dispatch('ui:message_display', {
                        text: "Error: Item definition is missing.",
                        type: 'error'
                    });
                }
                return; // Stop orchestration
            }
            const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";

            /** @type {UsableComponentData | undefined} */
            const usableComponentData = itemDefinition.components?.Usable;
            if (!usableComponentData) {
                this.#eventBus.dispatch('ui:message_display', {text: `You cannot use ${itemName}.`, type: 'info'});
                return; // Stop orchestration
            }

            // --- 2. Usability Check ---
            const usabilityContext = {userEntity: userEntity, targetEntityContext: null, targetConnectionContext: null};
            const usabilityOptions = {
                itemName: itemName,
                checkType: 'Usability',
                fallbackMessages: {
                    usability: usableComponentData.failure_message_default || TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                    default: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName)
                }
            };
            const usabilityCheckResult = this.#conditionEvaluationService.evaluateConditions(
                userEntity,
                usabilityContext,
                usableComponentData.usability_conditions,
                usabilityOptions
            );
            internalMessages.push(...usabilityCheckResult.messages);

            if (!usabilityCheckResult.success) {
                if (usabilityCheckResult.failureMessage) {
                    this.#eventBus.dispatch('item:use_condition_failed', {
                        actorId: userEntityId,
                        failureMessage: usabilityCheckResult.failureMessage
                    });
                } else {
                    log("Usability check failed, but no specific UI failure message provided by ConditionEvaluationService.", "debug");
                }
                return; // Stop orchestration
            }

            // --- 3. Target Resolution & Validation ---
            const targetServiceDependencies = {
                entityManager: this.#entityManager,
                eventBus: this.#eventBus,
                conditionEvaluationService: this.#conditionEvaluationService
            };
            const targetResult = await this.#targetResolutionService.resolveItemTarget(
                {userEntity, usableComponentData, explicitTargetEntityId, explicitTargetConnectionId, itemName},
                targetServiceDependencies
            );
            internalMessages.push(...targetResult.messages);

            if (!targetResult.success && usableComponentData.target_required) { // Ensure we only stop if target was required and failed
                return; // Stop orchestration (error message handled by service)
            }
            validatedTarget = targetResult.target;
            targetType = targetResult.targetType;
            const targetNameForLog = validatedTarget
                ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction)
                : 'None';


            // --- Separate Effects: Standard vs. Attempt --- (Ticket 7.6.2.1)
            /** @type {EffectObjectData[]} */
            const effectsToExecute = [];
            /** @type {EffectObjectData[]} */
            const attemptEffects = [];

            if (usableComponentData.effects && Array.isArray(usableComponentData.effects) && usableComponentData.effects.length > 0) {
                for (const effect of usableComponentData.effects) {
                    if (effect.type === 'attempt_lock' || effect.type === 'attempt_unlock') {
                        attemptEffects.push(effect);
                    } else {
                        effectsToExecute.push(effect);
                    }
                }
            }

            // --- Process Lock/Unlock Attempt Effects --- (Tickets 7.6.2.2 & 7.6.2.3.A & 7.6.2.3.B)
            if (attemptEffects.length > 0 && targetResult.success) { // Check targetResult.success here for safety
                log(`Processing ${attemptEffects.length} attempt effects for target type: ${targetType}`, 'debug');

                // --- Handle Entity Targets (Ticket 7.6.2.2 - Existing Logic) ---
                if (targetType === 'entity') {
                    const targetEntity = /** @type {Entity} */ (validatedTarget); // Cast target to Entity
                    if (targetEntity && targetEntity.id) {
                        const targetEntityIdForEvent = targetEntity.id;
                        log(`Target is entity ${targetEntityIdForEvent}. Dispatching lock/unlock attempt events.`, 'debug');

                        for (const effect of attemptEffects) {
                            let eventName = null;
                            if (effect.type === 'attempt_lock') {
                                eventName = 'event:lock_entity_attempt';
                            } else if (effect.type === 'attempt_unlock') {
                                eventName = 'event:unlock_entity_attempt';
                            }

                            if (eventName) {
                                const payload = {
                                    userId: userEntityId,
                                    targetEntityId: targetEntityIdForEvent,
                                    keyItemId: itemInstanceId // Confirmed correct per lockSystem
                                };
                                log(`Dispatching ${eventName} with payload:`, 'debug', payload); // Log event dispatch
                                this.#eventBus.dispatch(eventName, payload);
                            } else {
                                log(`Unhandled attempt effect type on entity: ${effect.type}`, 'warning');
                            }
                        }
                    } else {
                        log(`Attempt effects found, but target entity or ID is missing despite targetResult success. Cannot dispatch events.`, 'warning');
                    }
                }
                // --- Handle Connection Targets (Tickets 7.6.2.3.A & 7.6.2.3.B - Modified Logic) ---
                else if (targetType === 'connection') {
                    const validatedConnection = /** @type {Connection} */ (targetResult.target);
                    const blockerEntityId = validatedConnection.blockerEntityId;
                    // Use connectionId if available, otherwise direction as fallback identifier
                    const connectionIdentifier = validatedConnection.connectionId || validatedConnection.direction || 'unknown';

                    // Loop through attempt effects for this connection target
                    for (const effect of attemptEffects) {
                        // Check if there's a valid blocker entity associated with the connection *inside the loop*
                        if (blockerEntityId && typeof blockerEntityId === 'string') {
                            // --- SUCCESS CASE: Blocker exists ---
                            log(`Target is connection ('${connectionIdentifier}') with blocker entity ${blockerEntityId}. Processing effect type '${effect.type}'.`, 'debug');
                            let eventName = null;
                            if (effect.type === 'attempt_lock') {
                                eventName = 'event:lock_entity_attempt';
                            } else if (effect.type === 'attempt_unlock') {
                                eventName = 'event:unlock_entity_attempt';
                            }

                            if (eventName) {
                                const payload = {
                                    userId: userEntityId,           // Available from parent scope
                                    targetEntityId: blockerEntityId, // Crucial: Target the blocker entity
                                    keyItemId: itemInstanceId       // Available from parent scope (Confirmed correct for LockSystem)
                                };
                                log(`Dispatching ${eventName} targeting blocker entity ${blockerEntityId} via connection '${connectionIdentifier}'`, 'debug', payload); // Log event dispatch
                                this.#eventBus.dispatch(eventName, payload);
                            } else {
                                log(`Unhandled attempt effect type on connection: ${effect.type}`, 'warning'); // Keep warning for unexpected types
                            }
                        } else {
                            // --- FAILURE CASE: Blocker ID is missing or invalid (Ticket 7.6.2.3.B) ---
                            // Add the specific warning log here.
                            log(
                                `Attempting ${effect.type} on connection '${connectionIdentifier}' which has no blockerEntityId. Skipping event dispatch.`,
                                'warning' // Use 'warning' type as required
                            );
                            // Event dispatch is skipped implicitly by being in this else block.
                        }
                    } // End loop through effects
                }
                // --- Handle Other Target Types (or No Target) ---
                else {
                    log(`Attempt effects found, but target type is '${targetType}'. No entity/blocker lock/unlock attempt events dispatched.`, 'debug');
                }
            }


            // --- 4. Effect Execution (Standard Effects) ---
            let effectsProcessed = false;
            let effectExecutionResult = {success: true, messages: [], stopPropagation: false}; // Default if no effects

            // Check if there are *standard* effects to execute
            if (effectsToExecute.length > 0) {
                effectsProcessed = true;
                /** @type {EffectContext} */
                const effectContext = {
                    userEntity: userEntity,
                    target: validatedTarget, // Use the validated target
                    entityManager: this.#entityManager,
                    eventBus: this.#eventBus,
                    dataManager: this.#dataManager,
                    usableComponentData: usableComponentData,
                    itemName: itemName,
                    itemInstanceId: itemInstanceId,
                    itemDefinitionId: itemDefinitionId
                };

                // Execute only the filtered standard effects
                effectExecutionResult = await this.#effectExecutionService.executeEffects(
                    effectsToExecute, // Pass the filtered array
                    effectContext
                );
                internalMessages.push(...effectExecutionResult.messages);
            } else if (attemptEffects.length > 0) {
                // If there were only attempt effects, still mark effects as processed
                // (e.g., for consumption logic), even though no standard effects ran.
                effectsProcessed = true; // Mark as processed even if only attempts ran
                log(`Item use attempt had only attempt_lock/attempt_unlock effects. Standard effect execution skipped.`, 'debug');
            }

            overallActionSuccess = true; // Reaching here implies usability/targeting passed.

            // --- 5. Item Consumption ---
            if (overallActionSuccess && usableComponentData.consume_on_use) {
                const currentItemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
                if (currentItemInstance) {
                    log(`Requesting consumption for item: ${itemInstanceId}`, 'debug');
                    this.#eventBus.dispatch('event:item_consume_requested', {
                        userId: userEntityId,
                        itemInstanceId: itemInstanceId
                    });
                } else {
                    log(`Item instance ${itemInstanceId} was gone before consumption could be requested.`, 'debug');
                }
            }

            // --- 6. Final Outcome Reporting ---
            if (overallActionSuccess) {
                // Base success message on having passed initial checks and attempted execution.
                // Note: This doesn't guarantee the lock/unlock attempt *succeeded*, only that it was dispatched.
                // LockSystem handles the actual success/failure feedback for lock/unlock.

                const successMsgTemplate = usableComponentData.success_message;
                let finalMsg = '';

                if (successMsgTemplate) {
                    finalMsg = successMsgTemplate;
                    if (finalMsg.includes('{item}')) {
                        finalMsg = finalMsg.replace('{item}', itemName);
                    }
                    if (finalMsg.includes('{target}')) {
                        if (validatedTarget) {
                            const targetName = targetType === 'entity'
                                ? getDisplayName(/** @type {Entity} */ (validatedTarget))
                                : (/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction || 'the connection');
                            finalMsg = finalMsg.replace('{target}', targetName);
                        } else {
                            finalMsg = finalMsg.replace(/ on {target}/g, ''); // Remove ' on {target}' part
                            finalMsg = finalMsg.replace(/{target}/g, 'nothing'); // Replace remaining {target}
                        }
                    }
                } else {
                    // Generate default only if effects processed or target required
                    if (effectsProcessed || usableComponentData.target_required) {
                        if (validatedTarget) {
                            const targetName = targetType === 'entity'
                                ? `the ${getDisplayName(/** @type {Entity} */(validatedTarget))}`
                                : `the ${/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction || 'connection'}`;
                            finalMsg = `You use the ${itemName} on ${targetName}.`;
                        } else {
                            // Only generate "You use the item." if effects were actually processed.
                            if (effectsProcessed) {
                                finalMsg = `You use the ${itemName}.`;
                            }
                        }
                    }
                }

                // Dispatch the final success message only if one was determined
                // AND if no attempt effects were dispatched (let LockSystem handle feedback in that case).
                // If only standard effects ran, dispatch the message here.
                if (finalMsg && attemptEffects.length === 0) {
                    log(`Dispatching final success message: "${finalMsg}"`, 'debug');
                    this.#eventBus.dispatch('ui:message_display', {text: finalMsg, type: 'info'});
                } else if (finalMsg && attemptEffects.length > 0) {
                    log(`Final success message "${finalMsg}" generated but suppressed; LockSystem will provide feedback for lock/unlock attempt.`, 'debug');
                } else if (effectsProcessed) {
                    log(`Item use action succeeded but generated no final success message (Item: ${itemName}, Target: ${targetNameForLog})`, 'debug');
                }
            }

        } catch (error) {
            console.error("ItemUsageSystem: CRITICAL UNHANDLED ERROR during _handleItemUseAttempt orchestration:", error);
            log(`CRITICAL ERROR: ${error.message}`, 'error');
            this.#eventBus.dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            overallActionSuccess = false;
        } finally {
            if (internalMessages.length > 0) {
                console.debug(`ItemUsageSystem internal log for item use attempt (User: ${userEntityId}, ItemDef: ${itemDefinitionId}, ItemInstance: ${itemInstanceId}):`, internalMessages);
            }
        }
    }
}

export default ItemUsageSystem;