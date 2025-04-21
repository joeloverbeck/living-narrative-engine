// src/systems/itemUsageSystem.js

// 4.2.3 Task 2: Import Constants
import {DEFINITION_REF_COMPONENT_ID} from '../types/components.js';

import {ItemTargetResolverService} from '../services/itemTargetResolver.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc (Unchanged)
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationResult} ConditionEvaluationResult */

/** @typedef {import('../services/itemTargetResolver.js').ResolveItemTargetResult} ResolveItemTargetResult */

// JSDoc type for the expected structure of DefinitionRefComponent data
/**
 * @typedef {object} DefinitionRefComponentData
 * @property {string} id - The ID of the entity definition.
 */

/**
 * ECS System responsible for handling the logic of using items.
 * Orchestrates calls to ConditionEvaluationService, ItemTargetResolverService.
 * Listens for "event:item_use_attempted" to trigger logic.
 * Dispatches specific effect request events based on item's Usable.effects definition.
 * Dispatches "event:item_consume_requested" for consumption.
 * **Crucially, this system NO LONGER dispatches final UI success messages detailing effect outcomes.**
 * Failure messages related to usability/targeting or detected by dependencies are expected
 * to be dispatched by the service/system detecting the failure or via specific event handlers.
 * **Refactored (4.2.3): Retrieves itemDefinitionId from item instance's DefinitionRefComponent *data* via EntityManager.**
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
     * **Refactored (4.2.3): Gets itemDefinitionId from DefinitionRefComponent *data* via EntityManager.**
     * Relies on services/event handlers for detailed logic and feedback.
     * Dispatches effect events and consumption requests.
     * **NO LONGER dispatches final success UI messages.**
     *
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
            // itemDefinitionId from payload is ignored.
            explicitTargetEntityId,
            explicitTargetConnectionEntityId
        } = payload;

        console.log('ItemUsageSystem: will process payload userEntityId (' + userEntityId + '), itemInstanceId (' + itemInstanceId + '), explicitTargetEntityId (' + explicitTargetEntityId + '), explicitTargetConnectionEntityId (' + explicitTargetConnectionEntityId + ')');

        let overallActionSuccess = false; // Represents success of the *orchestration attempt* in this system
        let validatedTarget = null;
        let targetType = 'none';
        let effectsProcessed = false; // Still useful for internal logging/debugging
        let itemDefinitionId = null; // Will be populated from component data

        try {
            // --- 1. Setup & Basic Validation ---
            const userEntity = this.#entityManager.getEntityInstance(userEntityId);
            // Item Instance is needed for getting component data, but we only need its ID for the entityManager call.
            // We still fetch the instance for getDisplayName later, so keep this check.
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

            // Check item instance existence (needed for getDisplayName, potentially other future checks)
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

            // 4.2.3 Task 4: Get DefinitionRefComponent *data* and its ID from the item instance via EntityManager
            /** @type {DefinitionRefComponentData | undefined} */
                // Locate line: const definitionRef = itemInstance.getComponent(DefinitionRefComponent); << REMOVED
                // Replace it with:
            const definitionRefData = this.#entityManager.getComponentData(itemInstanceId, DEFINITION_REF_COMPONENT_ID);

            // Update the subsequent line to extract the ID from the data:
            itemDefinitionId = definitionRefData?.id; // Assign to scope variable (Verify expected structure {id: string})

            // Ensure the check correctly handles missing data or id property
            if (!itemDefinitionId) {
                // Update logging message
                const errorMsg = `Could not retrieve DefinitionRefComponent data or its 'id' property for item instance ${itemInstanceId} using component ID ${DEFINITION_REF_COMPONENT_ID}. Cannot proceed with use action.`;
                console.error(`ItemUsageSystem: ${errorMsg}`);
                log(errorMsg, 'error');
                // Provide generic feedback to user, as this is an internal data setup issue
                this.#eventBus.dispatch("event:display_message", {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                return; // Exit if definition reference is missing
            }

            // Verify that itemDefinition loading uses the extracted itemDefinitionId
            const itemDefinition = this.#repository.getEntityDefinition(itemDefinitionId);

            // Check if definition exists, log message source updated implicitly by previous steps
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
            // Verify getDisplayName call (assuming it works or is handled separately)
            const itemName = getDisplayName(itemInstance) ?? itemDefinition?.components?.Name?.value ?? "the item";

            // Verify that usableComponentData is accessed via itemDefinition.components?.Usable
            const usableComponentData = itemDefinition.components?.Usable; // This is correct, sourced from definition.
            if (!usableComponentData) {
                this.#eventBus.dispatch("event:display_message", {text: `You cannot use ${itemName}.`, type: 'info'});
                log(`Item "${itemName}" (Def: ${itemDefinitionId}, Inst: ${itemInstanceId}) has no Usable component data.`, 'info'); // Log refers to component data
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
            // Verify getDisplayName usage again here (assuming okay)
            const targetNameForLog = validatedTarget ? (targetType === 'entity' ? getDisplayName(/** @type {Entity} */(validatedTarget)) : (/** @type {Connection} */(validatedTarget)).name || (/** @type {Connection} */(validatedTarget)).direction || 'Unnamed Connection') : 'None';
            log(`Target resolved/validated: Type='${targetType}', Name='${targetNameForLog}', ID='${validatedTarget?.id ?? 'N/A'}'`, 'debug');

            // --- 4. Effect Dispatch via EventBus ---
            // (Code largely unchanged - focuses on dispatching events)
            if (usableComponentData.effects && Array.isArray(usableComponentData.effects) && usableComponentData.effects.length > 0) {
                log(`Processing ${usableComponentData.effects.length} effects for item "${itemName}" (Def: ${itemDefinitionId}, Inst: ${itemInstanceId})...`, 'debug'); // Logging uses correct IDs

                for (const effectData of usableComponentData.effects) {
                    if (effectData.type === 'trigger_event') {
                        const eventName = effectData.parameters?.eventName;
                        const customPayload = effectData.parameters?.payload ?? {};

                        if (!eventName || typeof eventName !== 'string' || eventName.trim() === '') {
                            console.warn(`ItemUsageSystem: Skipping trigger_event for item "${itemName}" (Def: ${itemDefinitionId}) due to missing/invalid eventName.`, effectData);
                            log(`Skipping effect due to missing/invalid eventName for item "${itemName}" (Def: ${itemDefinitionId})`, 'warning', effectData); // Logging uses correct ID
                            continue;
                        }

                        // Verify that standardContext uses the itemDefinitionId extracted from component data
                        const standardContext = {
                            userId: userEntityId,
                            itemInstanceId: itemInstanceId,
                            itemDefinitionId: itemDefinitionId, // This now correctly uses the ID from component data
                            sourceItemName: itemName,
                            validatedTargetId: validatedTarget?.id ?? null,
                            validatedTargetType: targetType
                        };

                        const fullEventPayload = {...standardContext, ...customPayload};

                        console.debug(`ItemUsageSystem: Dispatching event "${eventName}" for item "${itemName}" (Def: ${itemDefinitionId}) with payload:`, fullEventPayload); // Logging uses correct ID
                        log(`Dispatching event: ${eventName}`, 'debug', fullEventPayload);

                        try {
                            this.#eventBus.dispatch(eventName, fullEventPayload);
                            effectsProcessed = true;
                        } catch (dispatchError) {
                            console.error(`ItemUsageSystem: Error dispatching event "${eventName}" for item "${itemName}" (Def: ${itemDefinitionId}):`, dispatchError); // Logging uses correct ID
                            log(`ERROR dispatching event ${eventName}: ${dispatchError.message}`, 'error');
                        }

                    } else {
                        console.warn(`ItemUsageSystem: Effect type "${effectData.type}" on item "${itemName}" (Def: ${itemDefinitionId}) is not 'trigger_event'. Ensure handlers exist.`, effectData); // Logging uses correct ID
                        log(`Non-'trigger_event' effect type "${effectData.type}" on item "${itemName}" (Def: ${itemDefinitionId}). Skipped.`, 'warning'); // Logging uses correct ID
                    }
                }

            } else {
                log(`Item "${itemName}" (Def: ${itemDefinitionId}, Inst: ${itemInstanceId}) has no effects defined.`, 'debug'); // Logging uses correct IDs
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
                log(`Item use orchestration completed successfully for "${itemName}" (Def: ${itemDefinitionId}). Effects processed: ${effectsProcessed}. Consumption requested: ${!!usableComponentData.consume_on_use}. No outcome UI message dispatched by this system.`, 'debug'); // Logging uses correct ID
            } else {
                log(`Item use orchestration attempt for "${itemName}" (Def: ${itemDefinitionId}) concluded with overallActionSuccess=false.`, 'warning'); // Logging uses correct ID
            }

        } catch (error) {
            console.error("ItemUsageSystem: CRITICAL UNHANDLED ERROR during _handleItemUseAttempt:", error);
            log(`CRITICAL ERROR: ${error.message}`, 'error', {stack: error.stack});
            this.#eventBus.dispatch("event:display_message", {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            overallActionSuccess = false; // Ensure failure on critical error
        } finally {
            // Update final log message reference (implicit via itemDefinitionId variable scope)
            if (internalMessages.length > 0) {
                // itemDefinitionId in the log string below is now the component-derived one
                console.debug(`ItemUsageSystem internal log for item use attempt (User: ${userEntityId}, ItemDef: ${itemDefinitionId}, ItemInstance: ${itemInstanceId}, Success: ${overallActionSuccess}):`, internalMessages);
            }
        }
    } // End of _handleItemUseAttempt
}

export default ItemUsageSystem;