// src/logic/operationInterpreter.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
// Assume ExecutionContext is defined elsewhere (e.g., in defs.js or via SUB-OPREG-01)
/** @typedef {import('./defs.js').ExecutionContext} ExecutionContext */ // Placeholder
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./operationRegistry.js').default} OperationRegistry */ // Added Import

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
     * @param {OperationRegistry} dependencies.registry - Service holding operation operationHandlers. // Added registry dependency
     * @throws {Error} If logger or registry dependency is missing or invalid.
     */
    constructor({ logger, registry }) {
        if (!logger || typeof logger.error !== 'function') { // Basic check
            throw new Error("OperationInterpreter requires a valid ILogger instance.");
        }
        // --- AC: Validate and store registry ---
        if (!registry || typeof registry.getHandler !== 'function') {
            throw new Error("OperationInterpreter requires a valid OperationRegistry instance.");
        }
        this.#logger = logger;
        this.#registry = registry;
        // --- End AC ---
        this.#logger.info("OperationInterpreter Initialized (using OperationRegistry).");
    }

    /**
     * Executes a single Operation by looking up its handler in the registry.
     * Logs errors if the handler is not found or if the handler itself throws an error.
     * Does NOT handle 'IF' operations; expects the caller to manage them.
     *
     * @param {Operation} operation - The Operation object to execute. Must be a valid object with a 'type' string property.
     * @param {ExecutionContext} executionContext - The context object available during execution (containing event, actor, target, services etc.).
     * @returns {void}
     * @public
     */
    execute(operation, executionContext) {
        // --- AC: execute method signature updated ---
        // Note: Assumes executionContext is the full ExecutionContext as per AC decision.

        // Basic validation of the operation object itself
        if (!operation || typeof operation.type !== 'string' || !operation.type.trim()) {
            this.#logger.error('OperationInterpreter received invalid operation object (missing or invalid type). Skipping execution.', { operation });
            return;
        }

        const opType = operation.type.trim(); // Trim for consistent lookup

        // --- AC: Remove Old Logic (LOG etc.) ---
        // The old 'if (opType === 'LOG')' block and others are removed.

        // --- AC: IF Handling (Preserved in Caller) ---
        // No 'if (opType === 'IF')' check here. The caller (SystemLogicInterpreter) handles IF.

        // --- AC: Registry Lookup ---
        const handler = this.#registry.getHandler(opType);

        if (handler) {
            // --- AC: Handler Invocation & Error Handling ---
            try {
                this.#logger.debug(`Executing handler for operation type "${opType}"...`);
                // Pass parameters and the full execution context
                handler(operation.parameters, executionContext);
                this.#logger.debug(`Handler execution finished successfully for type "${opType}".`);
            } catch (handlerError) {
                // Log error from the handler itself, but do not re-throw
                this.#logger.error(`Error executing handler for operation type "${opType}":`, handlerError);
                // Execution continues with the next operation in the calling sequence.
            }
        } else {
            // --- AC: Unknown Type Handling ---
            // Log an error if no handler was found for this operation type
            this.#logger.error(`Unknown operation type encountered: "${opType}". No handler registered. Skipping execution.`);
            // Do not throw an error; execution continues.
        }
    }
}

export default OperationInterpreter;