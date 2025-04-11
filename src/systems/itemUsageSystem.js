// src/systems/itemUsageSystem.js

// Service Imports
import {TargetResolutionService} from '../services/targetResolutionService.js';

// Utilities
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.EffectObject} EffectObjectData */
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
        const log = (text, type = 'internal') => internalMessages.push({text, type});

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
                // Item instance check is less critical here; effects might remove it. Check before consumption.
                if (!itemDefinition) {
                    // Dispatch a generic error as this is a data setup issue
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
            /** @type {ConditionEvaluationContext} */
            const usabilityContext = {userEntity: userEntity, targetEntityContext: null, targetConnectionContext: null};
            /** @type {ConditionEvaluationOptions} */
            const usabilityOptions = {
                itemName: itemName,
                checkType: 'Usability',
                fallbackMessages: {
                    usability: usableComponentData.failure_message_default || TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                    default: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName)
                }
            };
            const usabilityCheckResult = this.#conditionEvaluationService.evaluateConditions(
                userEntity, // Conditions apply to the user for usability
                usabilityContext,
                usableComponentData.usability_conditions,
                usabilityOptions
            );
            internalMessages.push(...usabilityCheckResult.messages); // Aggregate logs

            if (!usabilityCheckResult.success) {
                // Only dispatch if a user-facing message was actually generated by the service.
                if (usabilityCheckResult.failureMessage) {
                    this.#eventBus.dispatch('item:use_condition_failed', {
                        actorId: userEntityId, // Pass the user ID for potential filtering
                        failureMessage: usabilityCheckResult.failureMessage // Pass the message to display
                    });
                } else {
                    // Optional: Log if no UI message was intended/generated
                    log("Usability check failed, but no specific UI failure message provided by ConditionEvaluationService.", "debug");
                    // You might still want a generic fallback UI message here if ConditionEvaluationService *should* always provide one
                    // this.#eventBus.dispatch('ui:message_display', { text: "You cannot use that right now.", type: 'warning' });
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
            internalMessages.push(...targetResult.messages); // Aggregate logs

            if (!targetResult.success) {
                // Failure message dispatched by TargetResolutionService
                return; // Stop orchestration
            }
            validatedTarget = targetResult.target; // Store result
            targetType = targetResult.targetType;   // Store result
            const targetNameForLog = validatedTarget
                ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction)
                : 'None';


            // --- 4. Effect Execution ---
            let effectsProcessed = false;
            let effectExecutionResult = {success: true, messages: [], stopPropagation: false}; // Default if no effects

            if (usableComponentData.effects && usableComponentData.effects.length > 0) {
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
                    itemInstanceId: itemInstanceId, // Pass instance ID for effects that might modify/remove the item
                    itemDefinitionId: itemDefinitionId
                };

                effectExecutionResult = await this.#effectExecutionService.executeEffects(
                    usableComponentData.effects,
                    effectContext
                );
                internalMessages.push(...effectExecutionResult.messages); // Aggregate logs
            }
            // Determine if the *overall action* is considered successful for consumption/final feedback
            // It passed usability, targeting, and effect execution didn't critically fail (stopPropagation might have occurred on failure, but we might still consume)
            // Let's consider the action successful if it got this far without hard stops (usability/targeting)
            overallActionSuccess = true; // If we reached here, basic conditions and targeting passed. Effects might have failed individually.

            // --- 5. Item Consumption ---
            if (overallActionSuccess && usableComponentData.consume_on_use) {
                // Re-check item instance existence *just before* dispatching consumption
                const currentItemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
                if (currentItemInstance) {
                    this.#eventBus.dispatch('event:item_consume_requested', {
                        userId: userEntityId,
                        itemInstanceId: itemInstanceId // Use the original instance ID
                    });
                }
            }

            // --- 6. Final Outcome Reporting ---
            if (overallActionSuccess) {
                const successMsgTemplate = usableComponentData.success_message;
                let finalMsg = '';

                if (successMsgTemplate) {
                    finalMsg = successMsgTemplate; // e.g., "You use the {item} on the {target}."

                    // Interpolate {item} - Get item name derived earlier
                    if (finalMsg.includes('{item}')) {
                        finalMsg = finalMsg.replace('{item}', itemName); // Use the resolved itemName
                    }

                    // Interpolate {target} if needed and possible
                    if (finalMsg.includes('{target}')) {
                        if (validatedTarget) {
                            const targetName = targetType === 'entity'
                                ? getDisplayName(/** @type {Entity} */ (validatedTarget))
                                // Make sure to handle connection name correctly
                                : (/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction || 'the connection');
                            finalMsg = finalMsg.replace('{target}', targetName);
                        } else {
                            finalMsg = finalMsg.replace('{target}', 'nothing'); // Replace even if target was null/not required
                        }
                    }
                } else {
                    // Generate default message only if effects ran or target was involved
                    if (effectsProcessed || usableComponentData.target_required) {
                        if (validatedTarget) {
                            const targetName = targetType === 'entity'
                                ? `the ${getDisplayName(/** @type {Entity} */(validatedTarget))}`
                                : `the ${/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction || 'connection'}`;
                            finalMsg = `You use the ${itemName} on ${targetName}.`;
                        } else {
                            finalMsg = `You use the ${itemName}.`;
                        }
                    }
                }

                // Dispatch the final success message if one was determined
                if (finalMsg) {
                    // Now dispatches the fully interpolated message
                    this.#eventBus.dispatch('ui:message_display', {text: finalMsg, type: 'info'});
                }
            }

        } catch (error) {
            console.error("ItemUsageSystem: CRITICAL UNHANDLED ERROR during _handleItemUseAttempt orchestration:", error);
            log(`CRITICAL ERROR: ${error.message}`, 'error');
            // Dispatch a generic internal error message to the user
            this.#eventBus.dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            // Ensure overall success is false if an error occurs
            overallActionSuccess = false;
        }
    }
}

export default ItemUsageSystem;