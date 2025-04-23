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
 * against a specific data context, returning a boolean result.
 * It relies on an injected ILogger for diagnostics.
 */
class JsonLogicEvaluationService {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    // Note: EntityManager is removed as it's not directly needed for standard evaluation.
    // It would only be required if injecting custom operations that need it.

    /**
     * Creates an instance of JsonLogicEvaluationService.
     * @param {object} dependencies - The required services.
     * @param {ILogger} dependencies.logger - Logging service.
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({ logger }) {
        // AC.2: Uses injected ILogger
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error("JsonLogicEvaluationService requires a valid ILogger instance.");
        }
        // Removed EntityManager check as it's no longer a direct dependency here

        this.#logger = logger;
        this.#logger.info("JsonLogicEvaluationService initialized.");
    }

    /**
     * Evaluates a JSON Logic rule against a given data context using json-logic-js.
     *
     * @param {JSONLogicRule} rule - The JSON Logic rule object to evaluate (structure defined by json-logic.schema.json).
     * @param {JsonLogicEvaluationContext} context - The data context against which the rule is evaluated.
     * @returns {boolean} - The boolean result of the rule evaluation. Returns false on error or if the library returns a non-boolean result.
     * @implements {AC.3}
     */
    evaluate(rule, context) {
        const ruleSummary = JSON.stringify(rule).substring(0, 150) + (JSON.stringify(rule).length > 150 ? '...' : '');
        this.#logger.debug(`Evaluating rule: ${ruleSummary}`);
        console.log("Context for evaluation:"); // Use console.log/dir for better inspection
        console.dir(context, { depth: 5 }); // Inspect context structure

        // Task 2: Implement try...catch around the library call
        // AC.3.d: Catch potential exceptions
        try {
            // Task 2: Call the library's apply function
            // AC.3.c: Calls jsonLogic.apply(rule, context)
            const result = jsonLogic.apply(rule, context);

            // Task 2 / AC.3.f: Validate return type
            if (typeof result !== 'boolean') {
                this.#logger.error(`JSON Logic evaluation returned non-boolean type (${typeof result}) for rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}. Returning false.`);
                return false; // Treat non-boolean results as failure
            }

            this.#logger.debug(`Rule evaluation result: ${result}`);
            // Task 2 / AC.3.g: Return final boolean result
            return result;

        } catch (error) {
            // Task 2 / AC.3.e: Log errors via ILogger and return false
            this.#logger.error(`Error evaluating JSON Logic rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`, error);
            // Return false to prevent actions from running when condition evaluation fails critically
            return false;
        }
    }

    /**
     * Allows adding custom operations to the underlying json-logic-js instance.
     * This might be needed for future tickets extending logic capabilities.
     * @param {string} name - The name of the custom operator (e.g., "hasComponent").
     * @param {Function} func - The function implementing the operator logic.
     */
    addOperation(name, func) {
        try {
            jsonLogic.add_operation(name, func);
            this.#logger.info(`Custom JSON Logic operation "${name}" added successfully.`);
        } catch (error) {
            this.#logger.error(`Failed to add custom JSON Logic operation "${name}":`, error);
            // Depending on severity, might re-throw or just log
        }
    }
}

export default JsonLogicEvaluationService;