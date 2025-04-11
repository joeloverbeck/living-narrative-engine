// src/systems/itemUsageSystem.js

// Component Imports
import {InventoryComponent} from '../components/inventoryComponent.js';

// Service Imports
import ConditionEvaluationService from '../services/conditionEvaluationService.js';
import {TargetResolutionService} from '../services/targetResolutionService.js';
import EffectExecutionService from '../services/effectExecutionService.js'; // *** NEW ***

// Utilities
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../events/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.EffectObject} EffectObjectData */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationResult} ConditionEvaluationResult */
/** @typedef {import('../services/targetResolutionService.js').ResolveItemTargetResult} ResolveItemTargetResult */
/** @typedef {import('../services/effectExecutionService.js').EffectExecutionResult} EffectExecutionResult */ // *** NEW ***

/**
 * Defines the context passed to effect handlers.
 * @typedef {object} EffectContext
 * @property {Entity} userEntity - The entity using the item.
 * @property {Entity | Connection | null} target - The resolved and validated target object (if any).
 * @property {EntityManager} entityManager
 * @property {EventBus} eventBus
 * @property {DataManager} dataManager
 * @property {UsableComponentData} usableComponentData - The item's usable data.
 * @property {string} itemName - Display name of the item.
 * @property {string | null} itemInstanceId - Instance ID of the item being used.
 * @property {string} itemDefinitionId - Definition ID of the item being used.
 */

/**
 * Defines the return structure for individual effect handlers.
 * @typedef {object} EffectResult
 * @property {boolean} success - Whether the specific effect handler succeeded.
 * @property {ActionMessage[]} [messages] - Optional internal messages from the handler.
 * @property {boolean} [stopPropagation=false] - If true, stops processing subsequent effects for this item use.
 */

// EffectHandlerFunction typedef is no longer needed here, it belongs in EffectExecutionService


/**
 * ECS System responsible for handling the logic of using items.
 * Reads item behavior from UsableComponent data in item definitions.
 * Listens for event:item_use_attempted to trigger logic.
 * Delegates effect execution to EffectExecutionService.
 */
class ItemUsageSystem {
    #eventBus;
    #entityManager;
    #dataManager;
    #conditionEvaluationService;
    #targetResolutionService;
    #effectExecutionService; // *** NEW ***
    // #gameStateManager; // Future

    // #effectHandlers map and #registerEffectHandlers method are REMOVED

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     * @param {ConditionEvaluationService} options.conditionEvaluationService
     * @param {TargetResolutionService} options.targetResolutionService
     * @param {EffectExecutionService} options.effectExecutionService // *** NEW ***
     * // @param {GameStateManager} options.gameStateManager
     */
    constructor({
                    eventBus,
                    entityManager,
                    dataManager,
                    conditionEvaluationService,
                    targetResolutionService,
                    effectExecutionService // *** NEW ***
                }) {
        if (!eventBus) throw new Error("ItemUsageSystem requires options.eventBus.");
        if (!entityManager) throw new Error("ItemUsageSystem requires options.entityManager.");
        if (!dataManager) throw new Error("ItemUsageSystem requires options.dataManager.");
        if (!conditionEvaluationService) throw new Error("ItemUsageSystem requires options.conditionEvaluationService.");
        if (!targetResolutionService) throw new Error("ItemUsageSystem requires options.targetResolutionService.");
        if (!effectExecutionService) throw new Error("ItemUsageSystem requires options.effectExecutionService."); // *** NEW Check ***

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
        this.#conditionEvaluationService = conditionEvaluationService;
        this.#targetResolutionService = targetResolutionService;
        this.#effectExecutionService = effectExecutionService; // *** Store injected service ***

        // #registerEffectHandlers() call is REMOVED

        this.#eventBus.subscribe(
            'event:item_use_attempted',
            this._handleItemUseAttempt.bind(this)
        );

        console.log("ItemUsageSystem: Instance created and subscribed to event:item_use_attempted.");
    }

    // #registerEffectHandlers method is REMOVED

    // ========================================================================
    // == EVENT HANDLER =======================================================
    // ========================================================================

    /**
     * Handles the event:item_use_attempted event, implementing core usage logic.
     * Retrieves entities/connections, validates conditions, handles targeting,
     * delegates effect execution to EffectExecutionService, consumes the item,
     * and provides feedback via the EventBus.
     *
     * @param {ItemUseAttemptedEventPayload} payload - The event data.
     * @private
     */
    async _handleItemUseAttempt(payload) {
        console.log(`ItemUsageSystem: Received event:item_use_attempted`, payload);

        const {
            userEntityId,
            itemInstanceId,
            itemDefinitionId,
            explicitTargetEntityId,
            explicitTargetConnectionId
        } = payload;
        /** @type {ActionMessage[]} */
        const internalMessages = []; // For logging the process of this handler

        // --- 1. Retrieve Entities & Definitions ---
        const userEntity = this.#entityManager.getEntityInstance(userEntityId);
        const itemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
        const itemDefinition = this.#dataManager.getEntityDefinition(itemDefinitionId);

        // --- 2. Basic Validation ---
        if (!userEntity || !itemInstance || !itemDefinition) {
            // Basic validation logging
            if (!userEntity) console.error(`ItemUsageSystem: User entity ${userEntityId} not found.`);
            if (!itemInstance) console.error(`ItemUsageSystem: Item instance ${itemInstanceId} not found.`);
            if (!itemDefinition) {
                console.error(`ItemUsageSystem: Item definition ${itemDefinitionId} not found.`);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Error: Item definition is missing.",
                    type: 'error'
                });
            }
            return;
        }

        const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";

        // --- 3. Check if the item has a Usable component ---
        /** @type {UsableComponentData | undefined} */
        const usableComponentData = itemDefinition.components?.Usable;
        if (!usableComponentData) {
            console.warn(`ItemUsageSystem: Item ${itemDefinitionId} (${itemName}) definition lacks Usable component.`);
            this.#eventBus.dispatch('ui:message_display', {text: `You cannot use ${itemName}.`, type: 'info'});
            return;
        }

        // --- 4. Check Usability Conditions (User) ---
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
            userEntity, usabilityContext, usableComponentData.usability_conditions, usabilityOptions
        );
        internalMessages.push(...usabilityCheckResult.messages);
        if (!usabilityCheckResult.success) {
            console.log(`ItemUsageSystem: Usability conditions failed for ${itemName}.`);
            if (usabilityCheckResult.failureMessage) {
                this.#eventBus.dispatch('ui:message_display', {
                    text: usabilityCheckResult.failureMessage,
                    type: 'warning'
                });
            }
            console.log("ItemUsageSystem: _handleItemUseAttempt processing stopped due to usability conditions.");
            internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
            return;
        }
        internalMessages.push({text: `Usability checks passed for ${itemName}.`, type: 'internal'});


        // --- 5. Handle Targeting ---
        let validatedTarget = null;
        let targetType = 'none';
        const targetServiceDependencies = {
            entityManager: this.#entityManager,
            eventBus: this.#eventBus,
            conditionEvaluationService: this.#conditionEvaluationService
        };
        const targetResult = await this.#targetResolutionService.resolveItemTarget( // Added await just in case
            {userEntity, usableComponentData, explicitTargetEntityId, explicitTargetConnectionId, itemName},
            targetServiceDependencies
        );
        internalMessages.push(...targetResult.messages);
        if (!targetResult.success) {
            console.log(`ItemUsageSystem: Target resolution failed for ${itemName} (handled by TargetResolutionService).`);
            console.log("ItemUsageSystem: _handleItemUseAttempt processing stopped due to target resolution failure.");
            internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
            return;
        }
        validatedTarget = targetResult.target;
        targetType = targetResult.targetType;
        if (validatedTarget) {
            const targetName = targetType === 'entity'
                ? getDisplayName(/** @type {Entity} */ (validatedTarget))
                : (/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction);
            internalMessages.push({
                text: `Target resolved and validated: ${targetType} '${targetName}'`,
                type: 'internal'
            });
        } else if (usableComponentData.target_required) {
            console.error(`ItemUsageSystem: Target resolution reported success, but target is null when required for ${itemName}.`);
            internalMessages.push({
                text: `Error: Target resolution succeeded but target is null unexpectedly.`,
                type: 'error'
            });
            this.#eventBus.dispatch('ui:message_display', {
                text: `An error occurred determining the target for ${itemName}.`,
                type: 'error'
            });
            return;
        } else {
            internalMessages.push({text: `No target required or resolved for ${itemName}.`, type: 'internal'});
        }

        // --- 6. Execute the Effects via EffectExecutionService --- *** REFACTORED ***
        let overallEffectsSuccess = true;
        let effectsProcessed = false;

        if (usableComponentData.effects && usableComponentData.effects.length > 0) {
            effectsProcessed = true;
            // --- 6a. Create EffectContext ---
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
            internalMessages.push({
                text: `Delegating effect execution to EffectExecutionService for ${itemName}...`,
                type: 'internal'
            });

            // --- 6b. Call the service ---
            /** @type {EffectExecutionResult} */
            const executionResult = await this.#effectExecutionService.executeEffects(
                usableComponentData.effects,
                effectContext
            );

            // Log messages from the service
            internalMessages.push(...executionResult.messages);

            // Update overall success based on the service result
            overallEffectsSuccess = executionResult.success;

            // Note: Failure message dispatching is now primarily handled *within* the effect handlers
            // or by the EffectExecutionService for critical errors. ItemUsageSystem no longer needs
            // to dispatch default failure messages here, as the first handler that failed
            // (and didn't suppress messages) or the service itself should have already done so.
            internalMessages.push({
                text: `EffectExecutionService finished. Reported Success: ${executionResult.success}, StopPropagation: ${executionResult.stopPropagation}`,
                type: 'internal'
            });

        } else {
            internalMessages.push({text: `No effects defined for ${itemName}.`, type: 'internal'});
            // If no effects, the action is still considered "successful" if conditions/targeting passed
            overallEffectsSuccess = true; // Explicitly set true if no effects needed executing
        }


        // --- 7. Handle Item Consumption ---
        if (overallEffectsSuccess && usableComponentData.consume_on_use) {
            const inventoryComponent = userEntity.getComponent(InventoryComponent);
            if (inventoryComponent) {
                const removed = inventoryComponent.removeItem(itemInstanceId);
                if (removed) {
                    internalMessages.push({
                        text: `Consumed item instance ${itemInstanceId} (${itemName}).`,
                        type: 'internal'
                    });
                    console.log(`ItemUsageSystem: Consumed item instance ${itemInstanceId} (${itemName}) from ${userEntityId}'s inventory.`);
                } else {
                    console.warn(`ItemUsageSystem: Failed to remove item instance ${itemInstanceId} (${itemName}) during consumption for user ${userEntityId}. Item might have already been removed.`);
                    internalMessages.push({
                        text: `Attempted to consume instance ${itemInstanceId}, but it was not found in inventory.`,
                        type: 'warning'
                    });
                }
            } else {
                console.error(`ItemUsageSystem: User ${userEntityId} lacks InventoryComponent. Cannot consume item ${itemInstanceId}.`);
                internalMessages.push({text: `User missing inventory component, cannot consume item.`, type: 'error'});
            }
        } else {
            internalMessages.push({
                text: `Item consumption skipped. EffectsSuccess=${overallEffectsSuccess}, ConsumeFlag=${usableComponentData.consume_on_use}`,
                type: 'internal'
            });
        }

        // --- 8. Provide Final Feedback ---
        if (overallEffectsSuccess) {
            const successMsg = usableComponentData.success_message;
            if (successMsg) {
                let finalMsg = successMsg;
                if (finalMsg.includes('{target}') && validatedTarget) {
                    const targetName = targetType === 'entity'
                        ? getDisplayName(/** @type {Entity} */ (validatedTarget))
                        : (/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction);
                    finalMsg = finalMsg.replace('{target}', targetName);
                } else if (finalMsg.includes('{target}')) {
                    finalMsg = finalMsg.replace('{target}', 'nothing');
                }
                this.#eventBus.dispatch('ui:message_display', {text: finalMsg, type: 'info'});
                internalMessages.push({text: `Dispatched custom success message: "${finalMsg}"`, type: 'internal'});
            } else if (effectsProcessed || usableComponentData.target_required) { // Provide default if effects ran OR target was involved
                const targetName = validatedTarget
                    ? (targetType === 'entity' ? `the ${getDisplayName(/** @type {Entity} */(validatedTarget))}` : `the ${/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction}`)
                    : '';
                const fallbackMsg = targetName ? `You use the ${itemName} on ${targetName}.` : `You use the ${itemName}.`;
                this.#eventBus.dispatch('ui:message_display', {text: fallbackMsg, type: 'info'});
                internalMessages.push({text: `Dispatched generic success message: "${fallbackMsg}"`, type: 'internal'});
            } else {
                internalMessages.push({
                    text: `Overall success, but no effects processed, no target, and no success message defined. No final UI message dispatched.`,
                    type: 'internal'
                });
            }
        } else {
            internalMessages.push({
                text: `Overall action failed or was stopped. Final success feedback skipped.`,
                type: 'internal'
            });
            // Failure feedback was handled by condition checks, target resolution service, or effect handlers via EffectExecutionService.
        }

        // --- Log Internal Messages ---
        console.log("ItemUsageSystem: _handleItemUseAttempt processing complete.");
        internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
    }
}

export default ItemUsageSystem;