// src/systems/itemUsageSystem.js

// Component Imports
import {InventoryComponent} from '../components/inventoryComponent.js';
import {PositionComponent} from '../components/positionComponent.js'; // Needed for target context
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Needed for target context

// Service Imports
import ConditionEvaluationService from '../services/conditionEvaluationService.js';
import {TargetResolutionService} from '../services/targetResolutionService.js';
import EffectExecutionService from '../services/effectExecutionService.js';

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

        log(`--- Starting Item Usage Orchestration: event:item_use_attempted ---`, 'info');
        log(`Payload: ${JSON.stringify(payload)}`, 'debug');

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
            log("Step 1: Retrieving entities and definitions...");
            const userEntity = this.#entityManager.getEntityInstance(userEntityId);
            const itemInstance = this.#entityManager.getEntityInstance(itemInstanceId); // May be null if item already removed
            const itemDefinition = this.#dataManager.getEntityDefinition(itemDefinitionId);

            if (!userEntity || !itemDefinition) {
                if (!userEntity) log(`Basic Validation Failed: User entity ${userEntityId} not found.`, 'error');
                // Item instance check is less critical here; effects might remove it. Check before consumption.
                if (!itemDefinition) {
                    log(`Basic Validation Failed: Item definition ${itemDefinitionId} not found.`, 'error');
                    // Dispatch a generic error as this is a data setup issue
                    this.#eventBus.dispatch('ui:message_display', {
                        text: "Error: Item definition is missing.",
                        type: 'error'
                    });
                }
                log("--- Orchestration Failed (Basic Validation) ---", 'error');
                return; // Stop orchestration
            }
            const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";
            log(`User: ${getDisplayName(userEntity)}(${userEntityId}), Item: ${itemName}(${itemInstanceId ?? 'N/A'}, Def: ${itemDefinitionId})`);

            /** @type {UsableComponentData | undefined} */
            const usableComponentData = itemDefinition.components?.Usable;
            if (!usableComponentData) {
                log(`Validation Failed: Item ${itemDefinitionId} (${itemName}) lacks Usable component.`, 'warning');
                this.#eventBus.dispatch('ui:message_display', {text: `You cannot use ${itemName}.`, type: 'info'});
                log("--- Orchestration Stopped (No Usable Component) ---", 'info');
                return; // Stop orchestration
            }
            log("Basic validation passed.");

            // --- 2. Usability Check ---
            log("Step 2: Checking Usability Conditions...");
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
                log(`Usability Check Failed. Reason: "${usabilityCheckResult.failureMessage ?? 'See Condition logs'}"`, 'warning');
                // Failure message should be dispatched by ConditionEvaluationService or listener
                log("--- Orchestration Stopped (Usability Failed) ---", 'info');
                return; // Stop orchestration
            }
            log("Usability Check Passed.");

            // --- 3. Target Resolution & Validation ---
            log("Step 3: Resolving and Validating Target...");
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
                log(`Target Resolution/Validation Failed. (See TargetResolutionService logs)`, 'warning');
                // Failure message dispatched by TargetResolutionService
                log("--- Orchestration Stopped (Targeting Failed) ---", 'info');
                return; // Stop orchestration
            }
            validatedTarget = targetResult.target; // Store result
            targetType = targetResult.targetType;   // Store result
            const targetNameForLog = validatedTarget
                ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction)
                : 'None';
            log(`Target Resolution Succeeded. Target: ${targetType} '${targetNameForLog}'`);


            // --- 4. Effect Execution ---
            log("Step 4: Executing Effects...");
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
                log(`Delegating ${usableComponentData.effects.length} effects to EffectExecutionService.`);

                effectExecutionResult = await this.#effectExecutionService.executeEffects(
                    usableComponentData.effects,
                    effectContext
                );
                internalMessages.push(...effectExecutionResult.messages); // Aggregate logs

                if (!effectExecutionResult.success) {
                    log(`Effect Execution Reported Failure. StopPropagation: ${effectExecutionResult.stopPropagation}`, 'warning');
                    // Failure messages handled by EffectExecutionService/handlers
                } else {
                    log("Effect Execution Reported Success.");
                }
            } else {
                log("No effects defined for this item.");
            }
            // Determine if the *overall action* is considered successful for consumption/final feedback
            // It passed usability, targeting, and effect execution didn't critically fail (stopPropagation might have occurred on failure, but we might still consume)
            // Let's consider the action successful if it got this far without hard stops (usability/targeting)
            overallActionSuccess = true; // If we reached here, basic conditions and targeting passed. Effects might have failed individually.

            // --- 5. Item Consumption ---
            log("Step 5: Handling Item Consumption...");
            if (overallActionSuccess && usableComponentData.consume_on_use) {
                // Re-check item instance existence *just before* dispatching consumption
                const currentItemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
                if (currentItemInstance) {
                    log(`Requesting consumption for item instance ${itemInstanceId} (${itemName}).`);
                    this.#eventBus.dispatch('event:item_consume_requested', {
                        userId: userEntityId,
                        itemInstanceId: itemInstanceId // Use the original instance ID
                    });
                } else {
                    log(`Consumption requested, but item instance ${itemInstanceId} no longer exists (likely removed by an effect). Skipping consumption dispatch.`, 'warning');
                }
            } else {
                log(`Consumption skipped. OverallSuccess=${overallActionSuccess}, ConsumeFlag=${usableComponentData.consume_on_use}`);
            }

            // --- 6. Final Outcome Reporting ---
            log("Step 6: Final Outcome Reporting...");
            if (overallActionSuccess) {
                log("Action considered successful for final reporting.");
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
                    log(`Using custom success message: "${finalMsg}"`); // Log the *interpolated* message
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
                        log(`Using generated success message: "${finalMsg}"`);
                    } else {
                        log(`No custom success message and no effects/target involved. No final UI message dispatched.`);
                    }
                }

                // Dispatch the final success message if one was determined
                if (finalMsg) {
                    // Now dispatches the fully interpolated message
                    this.#eventBus.dispatch('ui:message_display', {text: finalMsg, type: 'info'});
                }
            } else {
                // This case should technically not be reached if prior steps return on failure.
                // If reached (e.g., if effect failure is designed *not* to stop orchestration but *should* suppress success msg), log it.
                log("Overall action failed or was stopped before completion. Final success feedback skipped.", 'info');
                // Failure messages should have been handled by the service that detected the failure.
            }

        } catch (error) {
            console.error("ItemUsageSystem: CRITICAL UNHANDLED ERROR during _handleItemUseAttempt orchestration:", error);
            log(`CRITICAL ERROR: ${error.message}`, 'error');
            // Dispatch a generic internal error message to the user
            this.#eventBus.dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            // Ensure overall success is false if an error occurs
            overallActionSuccess = false;
        } finally {
            // --- Log Aggregated Internal Messages ---
            console.log(`ItemUsageSystem: Orchestration complete for item ${itemDefinitionId}. OverallSuccess: ${overallActionSuccess}`);
            internalMessages.forEach(msg => console.debug(`  [${msg.type}] ${msg.text}`));
            console.log("--- End Item Usage Orchestration ---")
        }
    }
}

export default ItemUsageSystem;