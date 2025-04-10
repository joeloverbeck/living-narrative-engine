// src/systems/itemUsageSystem.js

// Component Imports (Ensure all necessary components are imported)
import {InventoryComponent} from '../components/inventoryComponent.js';

// Service Imports
import ConditionEvaluationService from '../services/conditionEvaluationService.js';
import {TargetResolutionService} from '../services/targetResolutionService.js';

// Utilities
// findTarget is no longer needed directly here
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
/** @typedef {import('../services/targetResolutionService.js').ResolveItemTargetResult} ResolveItemTargetResult */ // *** NEW ***

/**
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
 * @typedef {object} EffectResult
 * @property {boolean} success - Whether the specific effect handler succeeded.
 * @property {ActionMessage[]} [messages] - Optional internal messages from the handler.
 * @property {boolean} [stopPropagation=false] - If true, stops processing subsequent effects for this item use.
 */

/** @typedef {(params: object | undefined, context: EffectContext) => EffectResult} EffectHandlerFunction */


/**
 * ECS System responsible for handling the logic of using items.
 * Reads item behavior from UsableComponent data in item definitions.
 * Listens for event:item_use_attempted to trigger logic.
 */
class ItemUsageSystem {
    #eventBus;
    #entityManager;
    #dataManager;
    #conditionEvaluationService; // *** MODIFIED ***
    #targetResolutionService;   // *** NEW ***
    // #gameStateManager; // Future

    /** @type {Map<string, EffectHandlerFunction>} */
    #effectHandlers = new Map();

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     * @param {ConditionEvaluationService} options.conditionEvaluationService // *** NEW ***
     * @param {TargetResolutionService} options.targetResolutionService     // *** NEW ***
     * // @param {GameStateManager} options.gameStateManager
     */
    constructor({
                    eventBus,
                    entityManager,
                    dataManager,
                    conditionEvaluationService, // Inject service instance
                    targetResolutionService      // Inject service instance
                }) {
        if (!eventBus) throw new Error("ItemUsageSystem requires options.eventBus.");
        if (!entityManager) throw new Error("ItemUsageSystem requires options.entityManager.");
        if (!dataManager) throw new Error("ItemUsageSystem requires options.dataManager.");
        if (!conditionEvaluationService) throw new Error("ItemUsageSystem requires options.conditionEvaluationService."); // *** NEW Check ***
        if (!targetResolutionService) throw new Error("ItemUsageSystem requires options.targetResolutionService.");       // *** NEW Check ***

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
        this.#conditionEvaluationService = conditionEvaluationService; // *** Store injected instance ***
        this.#targetResolutionService = targetResolutionService;     // *** Store injected instance ***

        this.#registerEffectHandlers(); // Populate the effect handler registry

        this.#eventBus.subscribe(
            'event:item_use_attempted',
            this._handleItemUseAttempt.bind(this) // Use bind to maintain 'this' context
        );

        console.log("ItemUsageSystem: Instance created and subscribed to event:item_use_attempted.");
    }

    /**
     * Registers handlers for known effect types.
     * @private
     */
    #registerEffectHandlers() {
        // Register REAL handlers using arrow functions bound to the instance
        // Ensure these handlers use context.eventBus for UI messages.
        this.#effectHandlers.set('heal', this.#handleHealEffect);
        this.#effectHandlers.set('trigger_event', this.#handleTriggerEventEffect);
        this.#effectHandlers.set('apply_status_effect', this.#handleApplyStatusEffectStub);
        this.#effectHandlers.set('damage', this.#handleDamageEffectStub);
        this.#effectHandlers.set('spawn_entity', this.#handleSpawnEntityEffectStub);
        this.#effectHandlers.set('remove_status_effect', this.#handleRemoveStatusEffectStub);

        console.log(`ItemUsageSystem: Registered ${this.#effectHandlers.size} effect handlers.`);
    }

    // ========================================================================
    // == EVENT HANDLER =======================================================
    // ========================================================================

    /**
     * Handles the event:item_use_attempted event, implementing core usage logic.
     * Retrieves entities/connections, validates conditions, handles targeting, executes effects,
     * consumes the item, and provides feedback via the EventBus.
     * Uses ConditionEvaluationService and TargetResolutionService.
     *
     * @param {ItemUseAttemptedEventPayload} payload - The event data.
     * @private
     */
    async _handleItemUseAttempt(payload) { // Marked async for potential await on service call
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
            // Basic validation logging (as before)
            if (!userEntity) console.error(`ItemUsageSystem: User entity ${userEntityId} not found.`);
            if (!itemInstance) console.error(`ItemUsageSystem: Item instance ${itemInstanceId} not found.`);
            if (!itemDefinition) {
                console.error(`ItemUsageSystem: Item definition ${itemDefinitionId} not found.`);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Error: Item definition is missing.",
                    type: 'error'
                });
            }
            return; // Stop processing if essential data is missing
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
        // *** REFACTORED using ConditionEvaluationService ***
        /** @type {ConditionEvaluationContext} */
        const usabilityContext = {
            userEntity: userEntity,
            targetEntityContext: null, // No specific target for usability check
            targetConnectionContext: null
        };
        /** @type {ConditionEvaluationOptions} */
        const usabilityOptions = {
            itemName: itemName,
            checkType: 'Usability',
            fallbackMessages: {
                usability: usableComponentData.failure_message_default || TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                default: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName) // Generic fallback
            }
        };

        const usabilityCheckResult = this.#conditionEvaluationService.evaluateConditions(
            userEntity, // Object being checked is the user itself
            usabilityContext,
            usableComponentData.usability_conditions,
            usabilityOptions
        );

        internalMessages.push(...usabilityCheckResult.messages); // Log internal messages from service

        if (!usabilityCheckResult.success) {
            console.log(`ItemUsageSystem: Usability conditions failed for ${itemName}.`);
            // Dispatch failure message returned by the service
            if (usabilityCheckResult.failureMessage) {
                this.#eventBus.dispatch('ui:message_display', {
                    text: usabilityCheckResult.failureMessage,
                    type: 'warning'
                });
            }
            // Log end of attempt and return
            console.log("ItemUsageSystem: _handleItemUseAttempt processing stopped due to usability conditions.");
            internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
            return; // Stop processing
        }
        internalMessages.push({text: `Usability checks passed for ${itemName}.`, type: 'internal'});


        // --- 5. Handle Targeting ---
        // *** REFACTORED using TargetResolutionService ***
        let validatedTarget = null; // Can be Entity or Connection object
        let targetType = 'none'; // 'entity', 'connection', or 'none'

        // Prepare dependencies for the target service
        const targetServiceDependencies = {
            entityManager: this.#entityManager,
            eventBus: this.#eventBus,
            conditionEvaluationService: this.#conditionEvaluationService // Pass the instance
        };

        // Call the service to resolve and validate the target
        // Note: resolveItemTarget is currently synchronous in the provided code. Add await if it becomes async.
        const targetResult = this.#targetResolutionService.resolveItemTarget(
            {
                userEntity,
                usableComponentData,
                explicitTargetEntityId,
                explicitTargetConnectionId,
                itemName
            },
            targetServiceDependencies
        );

        internalMessages.push(...targetResult.messages); // Log internal messages from the service

        // Check the result from the service
        if (!targetResult.success) {
            // The service is responsible for dispatching UI failure messages.
            console.log(`ItemUsageSystem: Target resolution failed for ${itemName} (handled by TargetResolutionService).`);
            // Log end of attempt and return
            console.log("ItemUsageSystem: _handleItemUseAttempt processing stopped due to target resolution failure.");
            internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
            return; // Stop processing
        }

        // Target resolution succeeded (or no target was required)
        validatedTarget = targetResult.target; // Store the resolved target (Entity, Connection, or null)
        targetType = targetResult.targetType;   // Store the type ('entity', 'connection', 'none')

        if (validatedTarget) {
            const targetName = targetType === 'entity'
                ? getDisplayName(/** @type {Entity} */ (validatedTarget))
                : (/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction);
            internalMessages.push({
                text: `Target resolved and validated: ${targetType} '${targetName}'`,
                type: 'internal'
            });
        } else if (usableComponentData.target_required) {
            // Should not happen if targetResult.success is true unless logic error in service
            console.error(`ItemUsageSystem: Target resolution reported success, but target is null when required for ${itemName}.`);
            internalMessages.push({
                text: `Error: Target resolution succeeded but target is null unexpectedly.`,
                type: 'error'
            });
            // Maybe add a fallback UI message?
            this.#eventBus.dispatch('ui:message_display', {
                text: `An error occurred determining the target for ${itemName}.`,
                type: 'error'
            });
            return;
        } else {
            internalMessages.push({text: `No target required or resolved for ${itemName}.`, type: 'internal'});
        }

        // --- 6. Execute the Effects Loop ---
        let overallEffectsSuccess = true;
        let effectsProcessed = false;

        if (usableComponentData.effects && usableComponentData.effects.length > 0) {
            // --- 6a. Create EffectContext ---
            // *** Updated to use validatedTarget from service ***
            /** @type {EffectContext} */
            const effectContext = {
                userEntity: userEntity,
                target: validatedTarget, // Use the validated target from TargetResolutionService
                entityManager: this.#entityManager,
                eventBus: this.#eventBus,
                dataManager: this.#dataManager,
                usableComponentData: usableComponentData,
                itemName: itemName,
                itemInstanceId: itemInstanceId,     // Pass instance ID
                itemDefinitionId: itemDefinitionId // Pass definition ID
            };
            internalMessages.push({text: `Executing effects loop for ${itemName}...`, type: 'internal'});

            // --- 6b. Iterate through effects ---
            // (Effect execution logic remains the same)
            for (const effect of usableComponentData.effects) {
                effectsProcessed = true;
                /** @type {EffectObjectData} */
                const effectData = effect;
                const handler = this.#effectHandlers.get(effectData.effect_type);

                if (handler) {
                    try {
                        internalMessages.push({text: `Executing effect: ${effectData.effect_type}`, type: 'internal'});
                        // Pass effectData.effect_params and the correctly populated effectContext
                        const result = handler(effectData.effect_params, effectContext);
                        internalMessages.push(...(result.messages || []));

                        if (!result.success) {
                            internalMessages.push({
                                text: `Effect ${effectData.effect_type} reported failure. StopPropagation: ${result.stopPropagation}`,
                                type: 'internal'
                            });
                            // Failure message handling remains the same (handler might dispatch, or fallback used)
                            if (!result.messages?.some(m => m.type === 'error' || m.type === 'warning')) {
                                const defaultFailMsg = usableComponentData.failure_message_default || `Using ${itemName} failed.`;
                                this.#eventBus.dispatch('ui:message_display', {text: defaultFailMsg, type: 'warning'});
                            }

                            if (result.stopPropagation) {
                                overallEffectsSuccess = false;
                                break; // Stop processing further effects
                            }
                            // If stopPropagation is false, consider action partially successful, continue effects
                        } else {
                            internalMessages.push({
                                text: `Effect ${effectData.effect_type} reported success.`,
                                type: 'internal'
                            });
                        }
                    } catch (error) {
                        console.error(`ItemUsageSystem: Error executing effect handler '${effectData.effect_type}' for ${itemName}:`, error);
                        internalMessages.push({
                            text: `CRITICAL ERROR executing effect ${effectData.effect_type}. ${error.message}`,
                            type: 'error'
                        });
                        overallEffectsSuccess = false;
                        this.#eventBus.dispatch('ui:message_display', {
                            text: `An error occurred while using ${itemName}.`,
                            type: 'error'
                        });
                        break;
                    }
                } else {
                    console.warn(`ItemUsageSystem: No registered effect handler found for type: ${effectData.effect_type} in item ${itemName}. Skipping effect.`);
                    internalMessages.push({
                        text: `Unknown effect type '${effectData.effect_type}'. Skipping.`,
                        type: 'warning'
                    });
                }
            }
            internalMessages.push({
                text: `Effects loop finished. Overall Success: ${overallEffectsSuccess}`,
                type: 'internal'
            });

        } else {
            internalMessages.push({text: `No effects defined for ${itemName}.`, type: 'internal'});
            // If no effects, the action is still considered "successful" if conditions/targeting passed
        }

        // --- 7. Handle Item Consumption ---
        // (Consumption logic remains the same, depends on overallEffectsSuccess)
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
        // (Feedback logic remains the same, relies on overallEffectsSuccess and uses validatedTarget/targetType)
        if (overallEffectsSuccess) {
            const successMsg = usableComponentData.success_message;
            if (successMsg) {
                // Replace placeholders if needed (using validatedTarget and targetType)
                // Basic example: replace {target} - needs more robust templating ideally
                let finalMsg = successMsg;
                if (finalMsg.includes('{target}') && validatedTarget) {
                    const targetName = targetType === 'entity'
                        ? getDisplayName(/** @type {Entity} */ (validatedTarget))
                        : (/** @type {Connection} */ (validatedTarget).name || /** @type {Connection} */ (validatedTarget).direction);
                    finalMsg = finalMsg.replace('{target}', targetName);
                } else if (finalMsg.includes('{target}')) {
                    finalMsg = finalMsg.replace('{target}', 'nothing'); // Replace placeholder if no target exists
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
                // Success, but no effects, no target, and no custom message (e.g., examining something?)
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
            // Failure feedback was handled by condition checks, target resolution service, or failing effect handlers.
        }

        // --- Log Internal Messages ---
        console.log("ItemUsageSystem: _handleItemUseAttempt processing complete.");
        internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
    }


    // ========================================================================
    // == EFFECT HANDLERS =====================================================
    // ========================================================================

    // #handleHealEffect, #handleTriggerEventEffect, and Stub handlers remain unchanged.
    // They already receive the 'target' via the EffectContext, which is now populated
    // by the result of the TargetResolutionService.

    /** @type {EffectHandlerFunction} */
    #handleHealEffect = (params, context) => { /* ... as provided ... */
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
            console.error(`ItemUsageSystem: ${errorMsg}`);
            messages.push({text: `Internal Error: ${itemName} heal effect misconfigured.`, type: 'error'});
            return {success: false, messages: messages, stopPropagation: true};
        }

        // 2. Identify Target Entity for Healing
        let actualTargetEntity = null;
        if (targetSpecifier === 'target') {
            // Check if the context target is an entity
            if (target && typeof target.getComponent === 'function') { // Check if it behaves like an Entity
                actualTargetEntity = /** @type {Entity} */ (target);
            } else {
                console.warn(`ItemUsageSystem: Heal effect specified 'target', but context target is not an entity. Item: ${itemName}, Target:`, target);
                if (target) { // Only give feedback if there *was* a target, just not the right type
                    eventBus.dispatch('ui:message_display', {text: `The ${itemName} cannot heal that.`, type: 'info'});
                } // else: No target specified, but effect wanted one -> should have failed target conditions earlier
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
            // This case might indicate a logic error if 'user' was specified but userEntity is null somehow
            const errorMsg = `Could not determine target ('${targetSpecifier}') for 'heal' effect in item ${itemName}.`;
            console.error(`ItemUsageSystem: ${errorMsg}`);
            messages.push({text: `Internal Error: Could not apply heal from ${itemName}.`, type: 'error'});
            eventBus.dispatch('ui:message_display', {text: `Couldn't apply healing from ${itemName}.`, type: 'error'});
            return {success: false, messages: messages, stopPropagation: true};
        }

        const targetName = getDisplayName(actualTargetEntity);

        // 3. Access Target's HealthComponent
        const HealthComponent = this.#entityManager.componentRegistry.get('Health');
        if (!HealthComponent) {
            console.error("ItemUsageSystem: Health component class not registered in EntityManager.");
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
            // This case should technically not happen if !isFullHealth, but good for robustness
            messages.push({text: `${targetName} health unchanged.`, type: 'internal'});
        }

        // 8. Return Success
        return {success: true, messages: messages};
    };
    /** @type {EffectHandlerFunction} */
    #handleTriggerEventEffect = (params, context) => {
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
            console.error(`ItemUsageSystem: Invalid 'event_name' parameter for 'trigger_event' effect in item ${itemName}.`);
            messages.push({
                text: `Internal Error: ${itemName} trigger_event effect misconfigured (event_name).`,
                type: 'error'
            });
            return {success: false, messages: messages, stopPropagation: true};
        }
        if (typeof event_payload !== 'object' || event_payload === null) {
            console.error(`ItemUsageSystem: Invalid 'event_payload' parameter for 'trigger_event' effect in item ${itemName}.`);
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
            const PositionComponent = this.#entityManager.componentRegistry.get('Position');
            if (!PositionComponent) {
                console.error("ItemUsageSystem: Position component class not registered. Cannot get locationId.");
                messages.push({text: `CRITICAL: Cannot get locationId for ${event_name}.`, type: 'error'});
            } else {
                const positionComponent = userEntity.getComponent(PositionComponent);
                if (positionComponent?.locationId) {
                    finalEventPayload.locationId = positionComponent.locationId;
                    messages.push({
                        text: `Added locationId (${finalEventPayload.locationId}) for ${event_name}.`,
                        type: 'internal'
                    });
                } else {
                    console.warn(`ItemUsageSystem: User ${userEntity.id} lacks PositionComponent or locationId when triggering ${event_name}. LocationId will be missing from payload.`);
                    messages.push({
                        text: `User ${userEntity.id} missing locationId for ${event_name}.`,
                        type: 'warning'
                    });
                    finalEventPayload.locationId = null;
                }
            }

            // Ensure connectionId is correctly populated if target was a connection
            // Use the specific targetConnectionId derived above
            if (!finalEventPayload.connectionId && finalEventPayload.targetConnectionId) {
                finalEventPayload.connectionId = finalEventPayload.targetConnectionId;
                messages.push({
                    text: `Populated connectionId (${finalEventPayload.connectionId}) from target context.`,
                    type: 'internal'
                });
            }

            // Verify required fields specific to this event
            if (!finalEventPayload.connectionId) {
                console.error(`ItemUsageSystem: Missing 'connectionId' in payload for ${event_name} triggered by ${itemName}. Target:`, target);
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
            console.debug(`ItemUsageSystem: Dispatching event '${event_name}' via EventBus for item ${itemName}. Payload:`, finalEventPayload);
            eventBus.dispatch(event_name, finalEventPayload);
            messages.push({text: `Dispatched event '${event_name}' for ${itemName}.`, type: 'internal'});
        } catch (error) {
            const errorMsg = `Error dispatching event '${event_name}' for item ${itemName}: ${error.message}`;
            console.error(`ItemUsageSystem: ${errorMsg}`, error);
            messages.push({text: `Internal Error: Failed to dispatch event for ${itemName}.`, type: 'error'});
            eventBus.dispatch('ui:message_display', {
                text: `An error occurred triggering an effect from ${itemName}.`,
                type: 'error'
            });
            return {success: false, messages: messages, stopPropagation: true};
        }

        // 4. Optional Feedback via context.eventBus
        if (typeof feedback_message === 'string' && feedback_message.trim() !== '') {
            console.debug(`ItemUsageSystem: Triggering feedback message for ${itemName}: "${feedback_message}"`);
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
    };

    // --- Stub Handlers ---
    /** @type {EffectHandlerFunction} */
    #handleApplyStatusEffectStub = (params, context) => {
        const messages = [{
            text: `Apply_status_effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
            type: 'internal'
        }];
        console.log(messages[0].text, "Params:", params);
        return {success: true, messages};
    }
    /** @type {EffectHandlerFunction} */
    #handleDamageEffectStub = (params, context) => {
        const messages = [{
            text: `Damage effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
            type: 'internal'
        }];
        console.log(messages[0].text, "Params:", params);
        return {success: true, messages};
    }
    /** @type {EffectHandlerFunction} */
    #handleSpawnEntityEffectStub = (params, context) => {
        const messages = [{
            text: `Spawn_entity effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
            type: 'internal'
        }];
        console.log(messages[0].text, "Params:", params);
        return {success: true, messages};
    }
    /** @type {EffectHandlerFunction} */
    #handleRemoveStatusEffectStub = (params, context) => {
        const messages = [{
            text: `Remove_status_effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
            type: 'internal'
        }];
        console.log(messages[0].text, "Params:", params);
        return {success: true, messages};
    }

}

export default ItemUsageSystem;