// src/systems/itemUsageSystem.js

import {ItemTargetResolverService} from '../services/itemTargetResolver.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';
import {
    EVENT_ITEM_CONSUME_REQUESTED,
    EVENT_ITEM_USE_ATTEMPTED,
    UI_MESSAGE_DISPLAY, // Added for clarity
    EVENT_MOVE_FAILED,  // Added for clarity (although not used directly in the modified section)
    // Include other event types potentially dispatched by handlers if needed for context,
    // like EVENT_ENTITY_UNLOCKED, EVENT_APPLY_HEAL_REQUESTED etc.
    // These are the events whose handlers *should* now provide outcome feedback.
} from "../types/eventTypes.js";

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../types/eventTypes.js').UIMessageDisplayPayload} UIMessageDisplayPayload */ // Added for clarity
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.EffectObject} EffectObjectData */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */ // Explicit import
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationResult} ConditionEvaluationResult */

/** @typedef {import('../services/itemTargetResolver.js').ResolveItemTargetResult} ResolveItemTargetResult */

/**
 * ECS System responsible for handling the logic of using items.
 * Orchestrates calls to ConditionEvaluationService, ItemTargetResolverService.
 * Listens for EVENT_ITEM_USE_ATTEMPTED to trigger logic.
 * Dispatches specific effect request events based on item's Usable.effects definition.
 * Dispatches EVENT_ITEM_CONSUME_REQUESTED for consumption.
 * **Crucially, this system NO LONGER dispatches final UI success messages detailing effect outcomes.**
 * Failure messages related to usability/targeting or detected by dependencies are expected
 * to be dispatched by the service/system detecting the failure or via specific event handlers.
 */
class ItemUsageSystem {
    #eventBus;
    #entityManager;
    #dataManager;
    #conditionEvaluationService;
    #itemTargetResolverService;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     * @param {ConditionEvaluationService} options.conditionEvaluationService
     * @param {ItemTargetResolverService} options.itemTargetResolverService - Service for resolving item usage targets.
     */
    constructor({
                    eventBus,
                    entityManager,
                    dataManager,
                    conditionEvaluationService,
                    itemTargetResolverService,
                }) {
        // Dependency checks (unchanged)
        if (!eventBus) throw new Error("ItemUsageSystem requires options.eventBus.");
        if (!entityManager) throw new Error("ItemUsageSystem requires options.entityManager.");
        if (!dataManager) throw new Error("ItemUsageSystem requires options.dataManager.");
        if (!conditionEvaluationService) throw new Error("ItemUsageSystem requires options.conditionEvaluationService.");
        if (!itemTargetResolverService) throw new Error("ItemUsageSystem requires options.itemTargetResolverService.");

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
        this.#conditionEvaluationService = conditionEvaluationService;
        this.#itemTargetResolverService = itemTargetResolverService;

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
     * Dispatches events defined in the item's Usable component effects.
     * Relies on services/event handlers to perform detailed logic and dispatch specific failure messages.
     * Dispatches consumption requests.
     * **NO LONGER dispatches final success UI messages.**
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

        let overallActionSuccess = false; // Represents success of the *orchestration attempt* in this system
        let validatedTarget = null;
        let targetType = 'none';
        let effectsProcessed = false; // Still useful for internal logging/debugging

        try {
            // --- 1. Setup & Basic Validation ---
            // (Code unchanged)
            const userEntity = this.#entityManager.getEntityInstance(userEntityId);
            const itemInstance = this.#entityManager.getEntityInstance(itemInstanceId); // Keep check, item might not exist
            const itemDefinition = this.#dataManager.getEntityDefinition(itemDefinitionId);

            if (!userEntity || !itemDefinition) {
                // Error handling unchanged, uses eventBus for UI feedback
                if (!itemDefinition) {
                    this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                        text: "Error: Item definition is missing.",
                        type: 'error'
                    });
                    log(`Item definition ${itemDefinitionId} not found.`, 'error');
                }
                if (!userEntity) {
                    this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: "Error: User entity not found.", type: 'error'});
                    log(`User entity ${userEntityId} not found.`, 'error');
                }
                // Check for itemInstance AFTER definition check, as we need definition for name fallback
                if (!itemInstance) {
                    // Item might have been removed between action request and processing
                    this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                        text: "Error: The item seems to have disappeared.",
                        type: 'error'
                    });
                    log(`Item instance ${itemInstanceId} not found for user ${userEntityId}.`, 'error');
                }
                return; // Exit if critical entities are missing
            }
            const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";

            /** @type {UsableComponentData | undefined} */
            const usableComponentData = itemDefinition.components?.Usable;
            if (!usableComponentData) {
                this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: `You cannot use ${itemName}.`, type: 'info'});
                log(`Item "${itemName}" (${itemDefinitionId}) has no Usable component.`, 'info');
                return;
            }

            // --- 2. Usability Check ---
            // (Code unchanged - relies on ConditionEvaluationService which may dispatch failure messages via its own events/logic if configured, or returns message here)
            // Construct context without dataAccess; Service injects it internally
            const usabilityBaseContext = {
                userEntity: userEntity,
                targetEntityContext: null,
                targetConnectionContext: null
            };
            const usabilityOptions = {
                itemName: itemName,
                checkType: 'Usability',
                fallbackMessages: {
                    usability: usableComponentData.failure_message_default || TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                    default: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName)
                }
            };
            // Note: The subject for usability check is the userEntity
            const usabilityCheckResult = this.#conditionEvaluationService.evaluateConditions(
                userEntity, // Subject is the user
                usabilityBaseContext, // Base context for evaluation
                usableComponentData.usability_conditions,
                usabilityOptions
            );
            internalMessages.push(...usabilityCheckResult.messages);

            if (!usabilityCheckResult.success) {
                if (usabilityCheckResult.failureMessage) {
                    // Dispatch a generic failure event, or directly dispatch UI message
                    // Let's stick to direct UI message for simplicity here, matching original intent
                    this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                        text: usabilityCheckResult.failureMessage,
                        type: 'warning' // Or 'info' depending on severity
                    });
                    // Optionally dispatch a specific event if other systems need to react to usability failure
                    // this.#eventBus.dispatch('item:use_usability_failed', { actorId: userEntityId, failureMessage: usabilityCheckResult.failureMessage });
                } else {
                    log("Usability check failed, but no specific UI failure message provided by ConditionEvaluationService.", "debug");
                    // Dispatch a generic failure message if none was provided
                    this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                        text: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                        type: 'warning'
                    });
                }
                return; // Stop processing if usability conditions fail
            }


            // --- 3. Target Resolution & Validation ---
            // (Code unchanged - relies on ItemTargetResolverService which dispatches its own failure UI messages via eventBus)
            const targetResult = await this.#itemTargetResolverService.resolveItemTarget({
                userEntity,
                usableComponentData,
                explicitTargetEntityId,
                explicitTargetConnectionEntityId,
                itemName
            });

            internalMessages.push(...targetResult.messages);

            // If target is required AND resolution failed, the service should have already sent a UI message.
            if (!targetResult.success && usableComponentData.target_required) {
                log(`Target resolution failed (and target was required) for item "${itemName}". UI message expected from ItemTargetResolverService.`, 'info');
                return; // Stop processing if required target resolution fails
            }
            // If target not required, or resolution succeeded, proceed.
            validatedTarget = targetResult.target;
            targetType = targetResult.targetType;
            const targetNameForLog = validatedTarget
                ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction || 'Unnamed Connection')
                : 'None';
            log(`Target resolved/validated: Type='${targetType}', Name='${targetNameForLog}', ID='${validatedTarget?.id ?? 'N/A'}'`, 'debug');


            // --- 4. Effect Dispatch via EventBus ---
            // (Code largely unchanged - focuses on dispatching events, not handling outcomes)
            if (usableComponentData.effects && Array.isArray(usableComponentData.effects) && usableComponentData.effects.length > 0) {
                log(`Processing ${usableComponentData.effects.length} effects for item "${itemName}"...`, 'debug');

                for (const effectData of usableComponentData.effects) {
                    // Check for the specific 'trigger_event' type which is the pattern moving forward
                    if (effectData.type === 'trigger_event') {
                        const eventName = effectData.parameters?.eventName;
                        const customPayload = effectData.parameters?.payload ?? {};

                        if (!eventName || typeof eventName !== 'string' || eventName.trim() === '') {
                            console.warn(`ItemUsageSystem: Skipping trigger_event effect for item "${itemName}" (${itemDefinitionId}) due to missing or invalid eventName. Effect data:`, effectData);
                            log(`Skipping effect due to missing/invalid eventName for item "${itemName}"`, 'warning', effectData);
                            continue;
                        }

                        const standardContext = {
                            userId: userEntityId,
                            itemInstanceId: itemInstanceId,
                            itemDefinitionId: itemDefinitionId,
                            sourceItemName: itemName,
                            validatedTargetId: validatedTarget?.id ?? null,
                            validatedTargetType: targetType
                        };

                        const fullEventPayload = {...standardContext, ...customPayload};

                        console.debug(`ItemUsageSystem: Dispatching event "${eventName}" for item "${itemName}" with payload:`, fullEventPayload);
                        log(`Dispatching event: ${eventName}`, 'debug', fullEventPayload);

                        try {
                            this.#eventBus.dispatch(eventName, fullEventPayload);
                            effectsProcessed = true; // Mark that at least one valid event dispatch was attempted/successful
                        } catch (dispatchError) {
                            console.error(`ItemUsageSystem: Error dispatching event "${eventName}" for item "${itemName}":`, dispatchError);
                            log(`ERROR dispatching event ${eventName}: ${dispatchError.message}`, 'error');
                            // Decide if a dispatch error should halt the entire action?
                            // For now, log and continue, but don't mark action as fully successful if critical.
                            // Setting overallActionSuccess = false here might be too harsh if only one effect fails.
                            // Let's assume for now that individual handlers manage their errors.
                        }

                    } else {
                        // Handle legacy or incorrect effect types if necessary, or just log a warning.
                        // This section previously handled direct effect execution. Now it only warns.
                        console.warn(`ItemUsageSystem: Effect type "${effectData.type}" on item "${itemName}" (${itemDefinitionId}) is not 'trigger_event' and was not executed by this system. Ensure handlers exist for relevant events.`);
                        log(`Non-'trigger_event' effect type "${effectData.type}" found on item "${itemName}". Skipped by ItemUsageSystem.`, 'warning');
                    }
                } // End of for...of loop over effects

            } else {
                log(`Item "${itemName}" (${itemDefinitionId}) has no effects defined in Usable component.`, 'debug');
            }

            // --- Set Overall Action Success ---
            // If we reached here without returning early due to *initial* validation/usability/targeting failures,
            // the *attempt* initiated by the user and orchestrated by this system is considered successful.
            // The success of the *effects* is determined by the event handlers.
            overallActionSuccess = true;


            // --- 5. Item Consumption ---
            // (Code unchanged - consumption depends on successful orchestration attempt and item config)
            if (overallActionSuccess && usableComponentData.consume_on_use) {
                const currentItemInstance = this.#entityManager.getEntityInstance(itemInstanceId); // Re-check existence
                if (currentItemInstance) {
                    log(`Requesting consumption for item: ${itemInstanceId} ("${itemName}")`, 'debug');
                    this.#eventBus.dispatch(EVENT_ITEM_CONSUME_REQUESTED, {
                        userId: userEntityId,
                        itemInstanceId: itemInstanceId
                    });
                } else {
                    log(`Item instance ${itemInstanceId} ("${itemName}") was removed (likely by an event handler) before consumption could be requested.`, 'debug');
                    // Don't treat this as an error necessarily, maybe an effect intentionally removed the item.
                }
            }

            // --- 6. Final Outcome Reporting ---
            // ***********************************************************************
            // * IMPLEMENTATION OF TICKET 1.3 (STRATEGY A - REMOVE ALL SUCCESS MESSAGES)
            // * The entire 'if (overallActionSuccess)' block related to constructing
            // * and dispatching success UI_MESSAGE_DISPLAY events is REMOVED below.
            // * Responsibility for outcome feedback shifts to event listeners.
            // ***********************************************************************


            // Log completion of the orchestration attempt
            if (overallActionSuccess) {
                log(`Item use orchestration completed successfully for "${itemName}". Effects processed: ${effectsProcessed}. Consumption requested: ${!!usableComponentData.consume_on_use}. No outcome UI message dispatched by this system.`, 'debug');
            } else {
                // This path should ideally not be reached if errors caused returns earlier,
                // but log defensively.
                log(`Item use orchestration attempt for "${itemName}" concluded with overallActionSuccess=false.`, 'warning');
            }

        } catch (error) {
            console.error("ItemUsageSystem: CRITICAL UNHANDLED ERROR during _handleItemUseAttempt orchestration:", error);
            log(`CRITICAL ERROR: ${error.message}`, 'error', {stack: error.stack});
            // Dispatch a generic internal error message to the UI
            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            // Ensure overallActionSuccess remains false if an error occurs here
            overallActionSuccess = false;
        } finally {
            // Log all collected internal messages for debugging, regardless of success/failure (unchanged)
            if (internalMessages.length > 0) {
                console.debug(`ItemUsageSystem internal log for item use attempt (User: ${userEntityId}, ItemDef: ${itemDefinitionId}, ItemInstance: ${itemInstanceId}, Success: ${overallActionSuccess}):`, internalMessages);
            }
        }
    } // End of _handleItemUseAttempt
}

export default ItemUsageSystem;