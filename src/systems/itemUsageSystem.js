// src/systems/itemUsageSystem.js

// T-6 Step 1: Import DefinitionRefComponent
import DefinitionRefComponent from '../components/definitionRefComponent.js';
import {ItemTargetResolverService} from '../services/itemTargetResolver.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc (Unchanged)
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.EffectObject} EffectObjectData */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationResult} ConditionEvaluationResult */

/** @typedef {import('../services/itemTargetResolver.js').ResolveItemTargetResult} ResolveItemTargetResult */

/**
 * ECS System responsible for handling the logic of using items.
 * Orchestrates calls to ConditionEvaluationService, ItemTargetResolverService.
 * Listens for "event:item_use_attempted" to trigger logic.
 * Dispatches specific effect request events based on item's Usable.effects definition.
 * Dispatches "event:item_consume_requested" for consumption.
 * **Crucially, this system NO LONGER dispatches final UI success messages detailing effect outcomes.**
 * Failure messages related to usability/targeting or detected by dependencies are expected
 * to be dispatched by the service/system detecting the failure or via specific event handlers.
 * **Refactored (T-6): Retrieves itemDefinitionId from item instance's DefinitionRefComponent.**
 */
class ItemUsageSystem {
    #eventBus;
    #entityManager;
    #repository; // Renamed
    #conditionEvaluationService;
    #itemTargetResolverService;

    constructor({eventBus, entityManager, gameDataRepository, conditionEvaluationService, itemTargetResolverService}) { // Updated param name
        if (!eventBus) throw new Error("ItemUsageSystem requires options.eventBus.");
        if (!entityManager) throw new Error("ItemUsageSystem requires options.entityManager.");
        if (!gameDataRepository) throw new Error("ItemUsageSystem requires options.gameDataRepository."); // Updated check
        if (!conditionEvaluationService) throw new Error("ItemUsageSystem requires options.conditionEvaluationService.");
        if (!itemTargetResolverService) throw new Error("ItemUsageSystem requires options.itemTargetResolverService.");

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#repository = gameDataRepository; // Updated assignment
        this.#conditionEvaluationService = conditionEvaluationService;
        this.#itemTargetResolverService = itemTargetResolverService;
    }

    /**
     * Subscribes the system to relevant lock/unlock events.
     */
    initialize() {
        this.#eventBus.subscribe("event:item_use_attempted", this._handleItemUseAttempt.bind(this));

        console.log("ItemUsageSystem: Initialized and ready.");
    }

    // ========================================================================
    // == ORCHESTRATION HANDLER ===============================================
    // ========================================================================

    /**
     * Handles the "event:item_use_attempted" event. Orchestrates the item usage flow.
     * **Refactored (T-6): Gets itemDefinitionId from DefinitionRefComponent.**
     * Relies on services/event handlers for detailed logic and feedback.
     * Dispatches effect events and consumption requests.
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
            // T-6 Step 5: itemDefinitionId from payload is now ignored.
            // itemDefinitionId,
            explicitTargetEntityId,
            explicitTargetConnectionEntityId
        } = payload;

        console.log('ItemUsageSystem: will process payload userEntityId (' + userEntityId + '), itemInstanceId (' + itemInstanceId + '), explicitTargetEntityId (' + explicitTargetEntityId + '), explicitTargetConnectionEntityId (' + explicitTargetConnectionEntityId + ')');

        let overallActionSuccess = false; // Represents success of the *orchestration attempt* in this system
        let validatedTarget = null;
        let targetType = 'none';
        let effectsProcessed = false; // Still useful for internal logging/debugging
        let itemDefinitionId = null; // T-6: Will be populated from component

        try {
            // --- 1. Setup & Basic Validation ---
            // T-6 Step 2: Retrieve user and item *instance* first.
            const userEntity = this.#entityManager.getEntityInstance(userEntityId);
            const itemInstance = this.#entityManager.getEntityInstance(itemInstanceId);

            // Check user entity first
            if (!userEntity) {
                this.#eventBus.dispatch("event:display_message", {
                    text: "Error: User entity not found.",
                    type: 'error'
                });
                log(`User entity ${userEntityId} not found.`, 'error');
                return; // Exit if user is missing
            }

            // Check item instance existence
            if (!itemInstance) {
                // Item might have been removed between action request and processing
                this.#eventBus.dispatch("event:display_message", {
                    text: "Error: The item seems to have disappeared.",
                    type: 'error'
                });
                log(`Item instance ${itemInstanceId} not found for user ${userEntityId}.`, 'error');
                return; // Exit if item instance is missing
            }

            console.log('ItemUsageSystem: confirmed item instance: ' + itemInstanceId);

            // T-6 Step 2: Get DefinitionRefComponent and its ID from the item instance
            const definitionRef = itemInstance.getComponent(DefinitionRefComponent);
            itemDefinitionId = definitionRef?.id; // Assign to scope variable

            // T-6 Step 2: Add check for missing component or ID
            if (!itemDefinitionId) {
                const errorMsg = `Item instance ${itemInstanceId} is missing DefinitionRefComponent or its ID. Cannot proceed with use action.`;
                console.error(`ItemUsageSystem: ${errorMsg}`);
                log(errorMsg, 'error');
                // Provide generic feedback to user, as this is an internal data setup issue
                this.#eventBus.dispatch("event:display_message", {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                return; // Exit if definition reference is missing
            }

            // T-6 Step 2: Load item definition using the component-derived ID
            const itemDefinition = this.#repository.getEntityDefinition(itemDefinitionId);

            // T-6 Step 2 & 4: Check if definition exists, update log message source
            if (!itemDefinition) {
                const errorMsg = `Item definition '${itemDefinitionId}' (referenced by item instance ${itemInstanceId}) not found in GameDataRepository.`;
                console.error(`ItemUsageSystem: ${errorMsg}`);
                log(errorMsg, 'error');
                this.#eventBus.dispatch("event:display_message", {
                    text: "Error: Item definition is missing.",
                    type: 'error'
                });
                return; // Exit if definition data is missing
            }

            // --- Proceed with validated item instance and definition ---
            const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";

            /** @type {UsableComponentData | undefined} */
            const usableComponentData = itemDefinition.components?.Usable;
            if (!usableComponentData) {
                this.#eventBus.dispatch("event:display_message", {text: `You cannot use ${itemName}.`, type: 'info'});
                log(`Item "${itemName}" (Def: ${itemDefinitionId}, Inst: ${itemInstanceId}) has no Usable component.`, 'info');
                return;
            }

            // --- 2. Usability Check ---
            // (Code unchanged - relies on ConditionEvaluationService)
            const usabilityBaseContext = {
                userEntity: userEntity,
                targetEntityContext: null,
                targetConnectionContext: null
            };
            const usabilityOptions = {
                itemName: itemName, checkType: 'Usability',
                fallbackMessages: {
                    usability: usableComponentData.failure_message_default || TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                    default: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName)
                }
            };
            const usabilityCheckResult = this.#conditionEvaluationService.evaluateConditions(
                userEntity, usabilityBaseContext, usableComponentData.usability_conditions, usabilityOptions
            );
            internalMessages.push(...usabilityCheckResult.messages);

            if (!usabilityCheckResult.success) {
                if (usabilityCheckResult.failureMessage) {
                    this.#eventBus.dispatch("event:display_message", {
                        text: usabilityCheckResult.failureMessage,
                        type: 'warning'
                    });
                } else {
                    log("Usability check failed, no specific UI message provided.", "debug");
                    this.#eventBus.dispatch("event:display_message", {
                        text: TARGET_MESSAGES.USE_CONDITION_FAILED(itemName),
                        type: 'warning'
                    });
                }
                return; // Stop processing if usability conditions fail
            }

            // --- 3. Target Resolution & Validation ---
            // (Code unchanged - relies on ItemTargetResolverService)
            const targetResult = await this.#itemTargetResolverService.resolveItemTarget({
                userEntity, usableComponentData, explicitTargetEntityId, explicitTargetConnectionEntityId, itemName
            });
            internalMessages.push(...targetResult.messages);

            if (!targetResult.success && usableComponentData.target_required) {
                log(`Target resolution failed (required) for item "${itemName}". UI message expected from ItemTargetResolverService.`, 'info');
                return; // Stop processing if required target resolution fails
            }
            validatedTarget = targetResult.target;
            targetType = targetResult.targetType;
            const targetNameForLog = validatedTarget ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction || 'Unnamed Connection') : 'None';
            log(`Target resolved/validated: Type='${targetType}', Name='${targetNameForLog}', ID='${validatedTarget?.id ?? 'N/A'}'`, 'debug');

            // --- 4. Effect Dispatch via EventBus ---
            // (Code largely unchanged - focuses on dispatching events)
            if (usableComponentData.effects && Array.isArray(usableComponentData.effects) && usableComponentData.effects.length > 0) {
                log(`Processing ${usableComponentData.effects.length} effects for item "${itemName}" (Def: ${itemDefinitionId}, Inst: ${itemInstanceId})...`, 'debug'); // T-6 Step 4: Added IDs to log

                for (const effectData of usableComponentData.effects) {
                    if (effectData.type === 'trigger_event') {
                        const eventName = effectData.parameters?.eventName;
                        const customPayload = effectData.parameters?.payload ?? {};

                        if (!eventName || typeof eventName !== 'string' || eventName.trim() === '') {
                            console.warn(`ItemUsageSystem: Skipping trigger_event for item "${itemName}" (Def: ${itemDefinitionId}) due to missing/invalid eventName.`, effectData);
                            log(`Skipping effect due to missing/invalid eventName for item "${itemName}" (Def: ${itemDefinitionId})`, 'warning', effectData); // T-6 Step 4: Added Def ID
                            continue;
                        }

                        // T-6 Step 3: Ensure itemDefinitionId in context uses the component-derived value
                        const standardContext = {
                            userId: userEntityId,
                            itemInstanceId: itemInstanceId,
                            itemDefinitionId: itemDefinitionId, // This now correctly uses the ID from DefinitionRefComponent
                            sourceItemName: itemName,
                            validatedTargetId: validatedTarget?.id ?? null,
                            validatedTargetType: targetType
                        };

                        const fullEventPayload = {...standardContext, ...customPayload};

                        console.debug(`ItemUsageSystem: Dispatching event "${eventName}" for item "${itemName}" (Def: ${itemDefinitionId}) with payload:`, fullEventPayload); // T-6 Step 4: Added Def ID
                        log(`Dispatching event: ${eventName}`, 'debug', fullEventPayload);

                        try {
                            this.#eventBus.dispatch(eventName, fullEventPayload);
                            effectsProcessed = true;
                        } catch (dispatchError) {
                            console.error(`ItemUsageSystem: Error dispatching event "${eventName}" for item "${itemName}" (Def: ${itemDefinitionId}):`, dispatchError); // T-6 Step 4: Added Def ID
                            log(`ERROR dispatching event ${eventName}: ${dispatchError.message}`, 'error');
                        }

                    } else {
                        console.warn(`ItemUsageSystem: Effect type "${effectData.type}" on item "${itemName}" (Def: ${itemDefinitionId}) is not 'trigger_event'. Ensure handlers exist.`, effectData); // T-6 Step 4: Added Def ID
                        log(`Non-'trigger_event' effect type "${effectData.type}" on item "${itemName}" (Def: ${itemDefinitionId}). Skipped.`, 'warning'); // T-6 Step 4: Added Def ID
                    }
                }

            } else {
                log(`Item "${itemName}" (Def: ${itemDefinitionId}, Inst: ${itemInstanceId}) has no effects defined.`, 'debug'); // T-6 Step 4: Added IDs
            }

            // --- Set Overall Action Success ---
            overallActionSuccess = true; // Reached end of main logic without early return

            // --- 5. Item Consumption ---
            // (Code unchanged - consumption depends on success and config)
            if (overallActionSuccess && usableComponentData.consume_on_use) {
                // Re-check existence in case an effect removed it
                const currentItemInstance = this.#entityManager.getEntityInstance(itemInstanceId);
                if (currentItemInstance) {
                    log(`Requesting consumption for item: ${itemInstanceId} ("${itemName}")`, 'debug');
                    this.#eventBus.dispatch("event:item_consume_requested", {
                        userId: userEntityId,
                        itemInstanceId: itemInstanceId
                    });
                } else {
                    log(`Item instance ${itemInstanceId} ("${itemName}") removed before consumption request.`, 'debug');
                }
            }

            // --- 6. Final Outcome Reporting ---
            // REMOVED - Responsibility shifted to event handlers.

            if (overallActionSuccess) {
                log(`Item use orchestration completed successfully for "${itemName}" (Def: ${itemDefinitionId}). Effects processed: ${effectsProcessed}. Consumption requested: ${!!usableComponentData.consume_on_use}. No outcome UI message dispatched by this system.`, 'debug'); // T-6 Step 4: Added Def ID
            } else {
                log(`Item use orchestration attempt for "${itemName}" (Def: ${itemDefinitionId}) concluded with overallActionSuccess=false.`, 'warning'); // T-6 Step 4: Added Def ID
            }

        } catch (error) {
            console.error("ItemUsageSystem: CRITICAL UNHANDLED ERROR during _handleItemUseAttempt:", error);
            log(`CRITICAL ERROR: ${error.message}`, 'error', {stack: error.stack});
            this.#eventBus.dispatch("event:display_message", {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            overallActionSuccess = false; // Ensure failure on critical error
        } finally {
            // T-6 Step 4: Ensure final log uses correct itemDefinitionId if applicable
            if (internalMessages.length > 0) {
                // itemDefinitionId in the log string below is now the component-derived one
                console.debug(`ItemUsageSystem internal log for item use attempt (User: ${userEntityId}, ItemDef: ${itemDefinitionId}, ItemInstance: ${itemInstanceId}, Success: ${overallActionSuccess}):`, internalMessages);
            }
        }
    } // End of _handleItemUseAttempt
}

export default ItemUsageSystem;