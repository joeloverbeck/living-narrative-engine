// src/logic/jsonLogicEvaluationService.js
import jsonLogic from 'json-logic-js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
// Assuming JSONLogicRule is structurally compatible with the schema
// We avoid a direct schema import in runtime code for cleaner separation
/** @typedef {object} JSONLogicRule */

/**
 * @class JsonLogicEvaluationService
 * Encapsulates the evaluation of JSON Logic rules using the 'json-logic-js' library.
 * This service provides a dedicated method to evaluate a given rule (typically a SystemRule condition)
 * against a specific data context, returning a boolean result based on the truthiness
 * of the JSON Logic output.
 * It relies on an injected ILogger for diagnostics.
 */
class JsonLogicEvaluationService {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of JsonLogicEvaluationService.
     * @param {object} dependencies - The required services.
     * @param {ILogger} dependencies.logger - Logging service.
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({logger}) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error("JsonLogicEvaluationService requires a valid ILogger instance.");
        }
        this.#logger = logger;
        this.#logger.info("JsonLogicEvaluationService initialized.");
    }

    /**
     * Evaluates a JSON Logic rule against a given data context using json-logic-js,
     * returning a strict boolean based on the truthiness of the result.
     *
     * @param {JSONLogicRule} rule - The JSON Logic rule object to evaluate.
     * @param {JsonLogicEvaluationContext} context - The data context against which the rule is evaluated.
     * @returns {boolean} - The boolean result derived from the rule evaluation's truthiness. Returns false on error.
     * @implements {AC.3}
     */
    evaluate(rule, context) {
        const ruleSummary = JSON.stringify(rule).substring(0, 150) + (JSON.stringify(rule).length > 150 ? '...' : '');
        this.#logger.debug(`Evaluating rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`);
        // console.log("Context for evaluation:"); // Uncomment for deep debugging if needed
        // console.dir(context, {depth: 5}); // Uncomment for deep debugging if needed

        try {
            const rawResult = jsonLogic.apply(rule, context);

            // --- DEBUG LOGGING ---
            // console.log(`[DEBUG] Rule: ${JSON.stringify(rule)}`);
            // console.log(`[DEBUG] Raw jsonLogic.apply result:`, rawResult);
            // console.log(`[DEBUG] typeof result: ${typeof rawResult}`);
            // --- END DEBUG LOGGING ---

            // Convert the raw result (which might not be boolean) to its boolean equivalent
            // based on JavaScript's truthiness rules (0, "", null, undefined, false, [] are falsy).
            const finalBooleanResult = !!rawResult; // <-- FIX APPLIED HERE

            this.#logger.debug(`Rule evaluation raw result: ${JSON.stringify(rawResult)}, Final boolean: ${finalBooleanResult}`);
            return finalBooleanResult;

        } catch (error) {
            // Log actual errors from the library execution
            this.#logger.error(`Error evaluating JSON Logic rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`, error);
            // Return false to prevent actions from running when condition evaluation fails critically
            return false;
        }
    }

    /**
     * Allows adding custom operations to the underlying json-logic-js instance.
     * @param {string} name - The name of the custom operator (e.g., "hasComponent").
     * @param {Function} func - The function implementing the operator logic.
     */
    addOperation(name, func) {
        try {
            jsonLogic.add_operation(name, func);
            this.#logger.info(`Custom JSON Logic operation "${name}" added successfully.`);
        } catch (error) {
            this.#logger.error(`Failed to add custom JSON Logic operation "${name}":`, error);
        }
    }
}

export default JsonLogicEvaluationService;