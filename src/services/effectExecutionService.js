// src/services/effectExecutionService.js

// Import Handler Functions
import {handleHealEffect} from '../effects/handlers/handleHealEffect.js';
import {handleTriggerEventEffect} from '../effects/handlers/handleTriggerEventEffect.js';
import {
    handleApplyStatusEffectStub,
    handleDamageEffectStub,
    handleRemoveStatusEffectStub,
    handleSpawnEntityEffectStub
} from '../effects/handlers/stubHandlers.js';

// Type Imports for JSDoc
/** @typedef {import('../systems/itemUsageSystem.js').EffectContext} EffectContext */
/** @typedef {import('../systems/itemUsageSystem.js').EffectResult} EffectResult */
/** @typedef {(params: object | undefined, context: EffectContext) => EffectResult | Promise<EffectResult>} EffectHandlerFunction */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.EffectObject} EffectObjectData */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */

/**
 * @typedef {object} EffectExecutionResult
 * @property {boolean} success - True if all executed effects succeeded without a 'stopPropagation' failure.
 * @property {ActionMessage[]} messages - Aggregated internal/debugging messages from all executed handlers.
 * @property {boolean} stopPropagation - True if any effect handler returned stopPropagation: true, causing the loop to exit early.
 */

/**
 * Service responsible for managing and executing item effects.
 */
class EffectExecutionService {
    /** @type {Map<string, EffectHandlerFunction>} */
    #handlers = new Map();

    /**
     * Creates an instance of EffectExecutionService and registers known handlers.
     * Initially takes no constructor dependencies, as handlers rely on the EffectContext.
     */
    constructor() {
        this.#registerEffectHandlers();
        console.log("EffectExecutionService: Instance created and handlers registered.");
    }

    /**
     * Registers handlers for known effect types by mapping type strings to handler functions.
     * @private
     */
    #registerEffectHandlers() {
        // Register REAL handlers
        this.#handlers.set('heal', handleHealEffect);
        this.#handlers.set('trigger_event', handleTriggerEventEffect);

        // Register STUB handlers
        this.#handlers.set('apply_status_effect', handleApplyStatusEffectStub);
        this.#handlers.set('damage', handleDamageEffectStub);
        this.#handlers.set('spawn_entity', handleSpawnEntityEffectStub);
        this.#handlers.set('remove_status_effect', handleRemoveStatusEffectStub);
        // Add other handlers here as needed, matching the 'type' enum in the schema
        // this.#handlers.set('modify_stat', handleModifyStatStub);
        // this.#handlers.set('teleport', handleTeleportStub);
        // this.#handlers.set('change_state', handleChangeStateStub);
        // this.#handlers.set('execute_script', handleExecuteScriptStub);


        console.log(`EffectExecutionService: Registered ${this.#handlers.size} effect handlers.`);
    }

    /**
     * Executes a list of effects sequentially based on their definition data.
     * Calls the appropriate registered handler for each effect type.
     * Stops execution if a handler returns `stopPropagation: true`.
     * Aggregates results and messages.
     *
     * @param {EffectObjectData[]} effects - The array of effect data objects to execute.
     * @param {EffectContext} context - The context object providing necessary dependencies (user, target, services).
     * @returns {Promise<EffectExecutionResult>} - A promise resolving to the overall result of the effect sequence.
     */
    async executeEffects(effects, context) {
        /** @type {ActionMessage[]} */
        const aggregatedMessages = [];
        let overallSuccess = true;
        let stoppedPropagation = false;

        aggregatedMessages.push({
            text: `Executing ${effects.length} effects for item ${context.itemName}...`,
            type: 'internal'
        });

        for (const effectData of effects) {
            const handler = this.#handlers.get(effectData.type);

            if (handler) {
                aggregatedMessages.push({text: `Executing effect: ${effectData.type}`, type: 'internal'});
                try {
                    // Await in case handlers become async in the future
                    // Pass effectData.parameters, not the whole effectData object (unless handlers expect the type too)
                    // The schema defines 'parameters' as the object holding specific data for the effect.
                    const result = await handler(effectData.parameters, context);

                    // Aggregate messages from the handler
                    if (result.messages) {
                        aggregatedMessages.push(...result.messages);
                    }

                    // Handle handler result
                    if (!result.success) {
                        aggregatedMessages.push({
                            text: `Effect ${effectData.type} reported failure. StopPropagation: ${!!result.stopPropagation}`,
                            type: 'internal'
                        });
                        overallSuccess = false; // Mark overall as failed if any effect fails

                        // Check if the handler wants to stop subsequent effects
                        if (result.stopPropagation) {
                            stoppedPropagation = true;
                            aggregatedMessages.push({
                                text: 'Stopping further effect processing due to stopPropagation.',
                                type: 'internal'
                            });
                            break; // Exit the loop
                        }
                        // If stopPropagation is false, we continue processing other effects, but overallSuccess remains false.
                    } else {
                        aggregatedMessages.push({
                            text: `Effect ${effectData.type} reported success.`,
                            type: 'internal'
                        });
                    }
                } catch (error) {
                    console.error(`EffectExecutionService: Error executing effect handler '${effectData.type}' for ${context.itemName}:`, error);
                    aggregatedMessages.push({
                        text: `CRITICAL ERROR executing effect ${effectData.type}. ${error.message}`,
                        type: 'error'
                    });
                    overallSuccess = false;
                    stoppedPropagation = true; // Treat critical errors as stopping propagation
                    // Optionally dispatch a generic error message via context's eventBus
                    if (context.eventBus) {
                        context.eventBus.dispatch('ui:message_display', {
                            text: `An error occurred while processing an effect from ${context.itemName}.`,
                            type: 'error'
                        });
                    }
                    break; // Stop processing on critical error
                }
            } else {
                console.warn(`EffectExecutionService: No registered effect handler found for type: ${effectData.type} in item ${context.itemName}. Skipping effect.`);
                aggregatedMessages.push({
                    text: `Unknown effect type '${effectData.type}'. Skipping.`,
                    type: 'warning'
                });
                // Optionally consider unknown effects as failure: overallSuccess = false;
            }
        }

        aggregatedMessages.push({
            text: `Effect execution finished. Overall Success: ${overallSuccess}, Stopped Propagation: ${stoppedPropagation}`,
            type: 'internal'
        });

        return {
            success: overallSuccess,
            messages: aggregatedMessages,
            stopPropagation: stoppedPropagation
        };
    }
}

export default EffectExecutionService;