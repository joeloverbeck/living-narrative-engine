// src/logic/operationInterpreter.js
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
// Assume ExecutionContext is defined elsewhere (e.g., in defs.js or via SUB-OPREG-01)
/** @typedef {import('./defs.js').ExecutionContext} ExecutionContext */ // Placeholder
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./operationRegistry.js').default} OperationRegistry */ // Added Import

// --- NEW: Import the placeholder resolver ---
import {resolvePlaceholders} from './contextUtils.js'; // Adjust path as needed

/**
 * @class OperationInterpreter
 * Responsible for executing individual Operation objects defined within a SystemRule's actions array.
 * It delegates the execution to registered operationHandlers via an OperationRegistry.
 * The special 'IF' operation type is expected to be handled by the caller (e.g., SystemLogicInterpreter)
 * before invoking this interpreter.
 */
class OperationInterpreter {
    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger;

    /**
     * Registry to look up operation operationHandlers.
     * @private
     * @readonly
     * @type {OperationRegistry}
     */
    #registry;

    /**
     * Creates an instance of OperationInterpreter.
     * @param {object} dependencies - The required services.
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {OperationRegistry} dependencies.operationRegistry - Service holding operation operationHandlers. // Added registry dependency
     * @throws {Error} If logger or registry dependency is missing or invalid.
     */
    constructor({logger, operationRegistry}) {
        if (!logger || typeof logger.error !== 'function') { // Basic check
            throw new Error('OperationInterpreter requires a valid ILogger instance.');
        }
        // --- AC: Validate and store registry ---
        if (!operationRegistry || typeof operationRegistry.getHandler !== 'function') {
            throw new Error('OperationInterpreter requires a valid OperationRegistry instance.');
        }
        this.#logger = logger;
        this.#registry = operationRegistry;
        // --- End AC ---
        this.#logger.info('OperationInterpreter Initialized (using OperationRegistry).');
    }

    /**
     * Executes a single Operation by looking up its handler in the registry.
     * Resolves placeholders in parameters before invoking the handler.
     * Logs errors if the handler is not found, if placeholder resolution fails.
     * **Re-throws errors** if the handler itself throws an error, allowing the caller
     * (e.g., SystemLogicInterpreter) to handle sequence interruption.
     * Does NOT handle 'IF' operations; expects the caller to manage them.
     *
     * @param {Operation} operation - The Operation object to execute. Must be a valid object with a 'type' string property.
     * @param {ExecutionContext} executionContext - The context object available during execution (containing event, actor, target, services etc.).
     * @returns {void}
     * @throws {Error} Rethrows any error caught during handler execution.
     * @public
     */
    execute(operation, executionContext) {
        // Basic validation of the operation object itself
        if (!operation || typeof operation.type !== 'string' || !operation.type.trim()) {
            this.#logger.error('OperationInterpreter received invalid operation object (missing or invalid type). Skipping execution.', {operation});
            return;
        }

        const opType = operation.type.trim();
        this.#logger.debug(`OperationInterpreter: Attempting to get handler for type: '${opType}'`); // Added Log
        const handler = this.#registry.getHandler(opType);
        this.#logger.debug(`OperationInterpreter: Handler found for '${opType}': ${!!handler}`); // Added Log

        if (handler) {
            // --- NEW: Resolve placeholders before calling handler ---
            let resolvedParameters;
            try {
                // Pass the raw parameters, the context, and the logger to the resolver
                resolvedParameters = resolvePlaceholders(operation.parameters, executionContext, this.#logger);
                this.#logger.debug(`Resolved parameters for operation type "${opType}".`);
                // You might want to log the resolved parameters here for deep debugging if needed:
                // this.#logger.debug('Resolved Parameters:', JSON.stringify(resolvedParameters));
            } catch (interpolationError) {
                this.#logger.error(`Error resolving placeholders for operation type "${opType}". Skipping handler invocation.`, interpolationError);
                // Decide if placeholder errors should halt the sequence - if so, re-throw here too.
                // For now, matching previous behavior of just logging and returning.
                return;
            }
            // --- END NEW ---

            // --- AC: Handler Invocation & Error Handling ---
            try {
                this.#logger.debug(`Executing handler for operation type "${opType}"...`);
                // --- MODIFIED: Pass RESOLVED parameters ---
                handler(resolvedParameters, executionContext);
                // --- END MODIFIED ---
                this.#logger.debug(`Handler execution finished successfully for type "${opType}".`);
            } catch (handlerError) {
                // --- FIX: Re-throw the error ---
                // Log that an error occurred here (optional, could be noisy)
                this.#logger.debug(`Handler for operation type "${opType}" threw an error. Rethrowing...`);
                // Re-throw the error so the caller (SystemLogicInterpreter) can catch it
                // and implement its sequence halting logic.
                throw handlerError;
                // --- END FIX ---
            }
        } else {
            // --- AC: Unknown Type Handling ---
            // Make the existing error log more prominent temporarily if needed
            this.#logger.error(`---> HANDLER NOT FOUND for operation type: "${opType}". Skipping execution.`); // Emphasized Log
            // Do not throw an error; execution continues.
        }
    }
}

export default OperationInterpreter;