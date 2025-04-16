// src/systems/itemUsageSystem.js

// Service Imports
// REMOVED: import {TargetResolutionService} from '../services/targetResolutionService.js';
import {ItemTargetResolverService} from '../services/itemTargetResolver.js';

// Utilities
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';
import {
    EVENT_ITEM_CONSUME_REQUESTED,
    EVENT_ITEM_USE_ATTEMPTED, EVENT_LOCK_ENTITY_ATTEMPT,
    EVENT_UNLOCK_ENTITY_ATTEMPT
} from "../types/eventTypes.js";

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/dataManager.js').default} DataManager */
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
// UPDATED: Typedef points to the new service
/** @typedef {import('../services/itemTargetResolver.js').ResolveItemTargetResult} ResolveItemTargetResult */
/** @typedef {import('../services/effectExecutionService.js').EffectExecutionResult} EffectExecutionResult */

/** @typedef {import('../services/effectExecutionService.js').EffectContext} EffectContext */

/**
 * ECS System responsible for handling the logic of using items.
 * Orchestrates calls to ConditionEvaluationService, ItemTargetResolverService,
 * and EffectExecutionService based on item definition data.
 * Listens for EVENT_ITEM_USE_ATTEMPTED to trigger logic.
 * Dispatches EVENT_ITEM_CONSUME_REQUESTED for consumption.
 * Dispatches event:lock_entity_attempt and EVENT_UNLOCK_ENTITY_ATTEMPT.
 * Dispatches final success UI messages. Failure messages are expected
 * to be dispatched by the service detecting the failure.
 */
class ItemUsageSystem {
    #eventBus;
    #entityManager;
    #dataManager;
    #conditionEvaluationService;
    #itemTargetResolverService; // ADDED: New service property
    #effectExecutionService;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     * @param {ConditionEvaluationService} options.conditionEvaluationService
     * @param {ItemTargetResolverService} options.itemTargetResolverService - Service for resolving item usage targets. // ADDED: JSDoc for new service
     * @param {EffectExecutionService} options.effectExecutionService
     */
    constructor({
                    eventBus,
                    entityManager,
                    dataManager,
                    conditionEvaluationService,
                    itemTargetResolverService,
                    effectExecutionService
                }) {
        // Dependency checks
        if (!eventBus) throw new Error("ItemUsageSystem requires options.eventBus.");
        if (!entityManager) throw new Error("ItemUsageSystem requires options.entityManager.");
        if (!dataManager) throw new Error("ItemUsageSystem requires options.dataManager.");
        if (!conditionEvaluationService) throw new Error("ItemUsageSystem requires options.conditionEvaluationService.");
        // REMOVED: if (!targetResolutionService) throw new Error("ItemUsageSystem requires options.targetResolutionService.");
        if (!itemTargetResolverService) throw new Error("ItemUsageSystem requires options.itemTargetResolverService."); // ADDED: Null check for new service
        if (!effectExecutionService) throw new Error("ItemUsageSystem requires options.effectExecutionService.");

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
        this.#conditionEvaluationService = conditionEvaluationService;
        // REMOVED: this.#targetResolutionService = targetResolutionService;
        this.#itemTargetResolverService = itemTargetResolverService; // ADDED: Assign new service
        this.#effectExecutionService = effectExecutionService;

        this.#eventBus.subscribe(
            EVENT_ITEM_USE_ATTEMPTED,
            this._handleItemUseAttempt.bind(this)
        );

        console.log("ItemUsageSystem: Instance created and subscribed to " + EVENT_ITEM_USE_ATTEMPTED + ".");
    }

    // ========================================================================
    // == ORCHESTRATION HANDLER ===============================================
    // ========================================================================

    /**
     * Handles the EVENT_ITEM_USE_ATTEMPTED event. Orchestrates the item usage flow
     * by calling relevant services and handling the overall sequence.
     * Relies on services to perform detailed logic and dispatch specific failure messages.
     * Dispatches final success messages and consumption requests.
     *
     * @param {ItemUseAttemptedEventPayload} payload - The event data.
     * @private
     */
    async _handleItemUseAttempt(payload) {
        /** @type {ActionMessage[]} */
        const internalMessages = [];
        const log = (text, type = 'internal', data = null) => {
            const message = {text, type};
            if (data) message.data = data;
            internalMessages.push(message);
        };


        const {
            userEntityId,
            itemInstanceId,
            itemDefinitionId,
            explicitTargetEntityId,
            explicitTargetConnectionEntityId
        } = payload;

        let overallActionSuccess = false;
        let validatedTarget = null;
        let targetType = 'none';

        try {
            // --- 1. Setup & Basic Validation ---
            const userEntity = this.#entityManager.getEntityInstance(userEntityId);
            const itemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
            const itemDefinition = this.#dataManager.getEntityDefinition(itemDefinitionId);

            if (!userEntity || !itemDefinition) {
                if (!itemDefinition) {
                    this.#eventBus.dispatch('ui:message_display', {
                        text: "Error: Item definition is missing.",
                        type: 'error'
                    });
                }
                return;
            }
            const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";

            /** @type {UsableComponentData | undefined} */
            const usableComponentData = itemDefinition.components?.Usable;
            if (!usableComponentData) {
                this.#eventBus.dispatch('ui:message_display', {text: `You cannot use ${itemName}.`, type: 'info'});
                return;
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
                return;
            }

            // --- 3. Target Resolution & Validation ---

            // UPDATED: Call the new service with the correct signature
            const targetResult = await this.#itemTargetResolverService.resolveItemTarget({
                userEntity,
                usableComponentData,
                explicitTargetEntityId,
                explicitTargetConnectionEntityId: explicitTargetConnectionEntityId, // Renamed key as per requirement
                itemName
            });
            // REMOVED: Second argument (targetServiceDependencies)

            internalMessages.push(...targetResult.messages);

            if (!targetResult.success && usableComponentData.target_required) {
                return;
            }
            validatedTarget = targetResult.target;
            targetType = targetResult.targetType;
            const targetNameForLog = validatedTarget
                ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction)
                : 'None';


            // --- Separate Effects: Standard vs. Attempt ---
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

            // --- Process Lock/Unlock Attempt Effects ---
            if (attemptEffects.length > 0 && targetResult.success) {
                log(`Processing ${attemptEffects.length} attempt effects for target type: ${targetType}`, 'debug');

                if (targetType === 'entity') {
                    const targetEntity = /** @type {Entity} */ (validatedTarget);
                    if (targetEntity && targetEntity.id) {
                        const targetEntityIdForEvent = targetEntity.id;
                        log(`Target is entity ${targetEntityIdForEvent}. Dispatching lock/unlock attempt events.`, 'debug');

                        for (const effect of attemptEffects) {
                            let eventName = null;
                            if (effect.type === 'attempt_lock') eventName = EVENT_LOCK_ENTITY_ATTEMPT;
                            else if (effect.type === 'attempt_unlock') eventName = EVENT_UNLOCK_ENTITY_ATTEMPT;

                            if (eventName) {
                                const payload = {
                                    userId: userEntityId,
                                    targetEntityId: targetEntityIdForEvent,
                                    keyItemId: itemInstanceId
                                };
                                log(`Dispatching ${eventName} with payload:`, 'debug', payload);
                                this.#eventBus.dispatch(eventName, payload);
                            } else {
                                log(`Unhandled attempt effect type on entity: ${effect.type}`, 'warning');
                            }
                        }
                    } else {
                        log(`Attempt effects found, but target entity or ID is missing despite targetResult success. Cannot dispatch events.`, 'warning');
                    }
                } else if (targetType === 'connection') {
                    // NOTE: Based on itemTargetResolver.js, targetResult.target is the *Connection Entity*, not the Connection object itself.
                    // The Connection object logic (like blockerEntityId) seems to reside within the resolver now.
                    // The events should still target the *blocker* entity if one exists.
                    // HOWEVER, the current itemTargetResolver returns the Connection *Entity*.
                    // This orchestration logic needs the *Blocker Entity ID* from the *actual Connection object*.
                    // Let's assume the ItemTargetResolverService result needs adjustment OR the LockSystem needs adapting.
                    // For *this specific ticket*, we follow the instructions which means the `target` is an Entity (the Connection Entity).
                    // We *cannot* reliably get the blockerEntityId here without fetching the *actual* Connection object again.
                    // Let's proceed by targeting the Connection *Entity* as per the available `validatedTarget`, acknowledging this discrepancy.
                    // TODO: Revisit LockSystem/ItemTargetResolverService interaction regarding Connection targets.

                    const connectionEntity = /** @type {Entity} */ (validatedTarget); // The target is the Connection Entity
                    const connectionEntityId = connectionEntity?.id;

                    if (connectionEntityId) {
                        log(`Target is connection entity ${connectionEntityId}. Attempting to dispatch lock/unlock events targeting this entity.`, 'debug');
                        // Existing logic might need refinement based on how LockSystem handles connection entities directly.
                        // Dispatching targeting the *connection entity* itself for now based on the refactored structure.

                        for (const effect of attemptEffects) {
                            let eventName = null;
                            if (effect.type === 'attempt_lock') eventName = 'event:lock_entity_attempt';
                            else if (effect.type === 'attempt_unlock') eventName = EVENT_UNLOCK_ENTITY_ATTEMPT;

                            if (eventName) {
                                const payload = {
                                    userId: userEntityId,
                                    targetEntityId: connectionEntityId, // Target the connection entity ID
                                    keyItemId: itemInstanceId
                                };
                                log(`Dispatching ${eventName} targeting connection entity ${connectionEntityId}`, 'debug', payload);
                                this.#eventBus.dispatch(eventName, payload);
                            } else {
                                log(`Unhandled attempt effect type on connection entity: ${effect.type}`, 'warning');
                            }
                        }

                    } else {
                        log(`Attempt effects found for connection target, but connection entity ID is missing. Cannot dispatch events.`, 'warning');
                    }

                } else {
                    log(`Attempt effects found, but target type is '${targetType}'. No entity/blocker lock/unlock attempt events dispatched.`, 'debug');
                }
            }


            // --- 4. Effect Execution (Standard Effects) ---
            let effectsProcessed = false;
            let effectExecutionResult = {success: true, messages: [], stopPropagation: false};

            if (effectsToExecute.length > 0) {
                effectsProcessed = true;
                /** @type {EffectContext} */
                const effectContext = {
                    userEntity: userEntity,
                    target: validatedTarget,
                    targetType: targetType,
                    entityManager: this.#entityManager,
                    eventBus: this.#eventBus,
                    dataManager: this.#dataManager,
                    usableComponentData: usableComponentData,
                    itemName: itemName,
                    itemInstanceId: itemInstanceId,
                    itemDefinitionId: itemDefinitionId
                };

                effectExecutionResult = await this.#effectExecutionService.executeEffects(
                    effectsToExecute,
                    effectContext
                );
                internalMessages.push(...effectExecutionResult.messages);
            } else if (attemptEffects.length > 0) {
                effectsProcessed = true;
                log(`Item use attempt had only attempt_lock/attempt_unlock effects. Standard effect execution skipped.`, 'debug');
            }

            overallActionSuccess = true;

            // --- 5. Item Consumption ---
            if (overallActionSuccess && usableComponentData.consume_on_use) {
                const currentItemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
                if (currentItemInstance) {
                    log(`Requesting consumption for item: ${itemInstanceId}`, 'debug');
                    this.#eventBus.dispatch(EVENT_ITEM_CONSUME_REQUESTED, {
                        userId: userEntityId,
                        itemInstanceId: itemInstanceId
                    });
                } else {
                    log(`Item instance ${itemInstanceId} was gone before consumption could be requested.`, 'debug');
                }
            }

            // --- 6. Final Outcome Reporting ---
            if (overallActionSuccess) {
                const successMsgTemplate = usableComponentData.success_message;
                let finalMsg = '';

                if (successMsgTemplate) {
                    finalMsg = successMsgTemplate;
                    if (finalMsg.includes('{item}')) finalMsg = finalMsg.replace('{item}', itemName);
                    if (finalMsg.includes('{target}')) {
                        if (validatedTarget) {
                            // Target name needs to handle both Entity and Connection Entity display names
                            const targetName = getDisplayName(/** @type {Entity} */ (validatedTarget)) || 'the target';
                            finalMsg = finalMsg.replace('{target}', targetName);
                        } else {
                            finalMsg = finalMsg.replace(/ on {target}/g, '');
                            finalMsg = finalMsg.replace(/{target}/g, 'nothing');
                        }
                    }
                } else {
                    if (effectsProcessed || usableComponentData.target_required) {
                        if (validatedTarget) {
                            const targetName = `the ${getDisplayName(/** @type {Entity} */(validatedTarget)) || 'target'}`;
                            finalMsg = `You use the ${itemName} on ${targetName}.`;
                        } else {
                            if (effectsProcessed) finalMsg = `You use the ${itemName}.`;
                        }
                    }
                }

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