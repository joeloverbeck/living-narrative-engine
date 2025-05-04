// src/logic/operationInterpreter.js (WITH ADDED LOGS)
import {resolvePlaceholders} from './contextUtils.js'; // Adjust path as needed
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext} ExecutionContext */ // Placeholder
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./operationRegistry.js').default} OperationRegistry */

class OperationInterpreter {
    /** @private @readonly @type {ILogger} */
    #logger;
    /** @private @readonly @type {OperationRegistry} */
    #registry;

    constructor({logger, operationRegistry}) {
        if (!logger || typeof logger.error !== 'function') {
            throw new Error('OperationInterpreter requires a valid ILogger instance.');
        }
        if (!operationRegistry || typeof operationRegistry.getHandler !== 'function') {
            throw new Error('OperationInterpreter requires a valid OperationRegistry instance.');
        }
        this.#logger = logger;
        this.#registry = operationRegistry;
        this.#logger.info('OperationInterpreter Initialized (using OperationRegistry).');
    }

    execute(operation, executionContext) {
        // <<< --- ADDED LOG --- >>>
        this.#logger.info(`*** OperationInterpreter executing: ${operation?.type || 'INVALID_OP'} ***`);
        if (!operation || typeof operation.type !== 'string' || !operation.type.trim()) {
            this.#logger.error('OperationInterpreter received invalid operation object (missing or invalid type). Skipping execution.', {operation});
            // <<< --- ADDED LOG --- >>>
            this.#logger.error(`*** OperationInterpreter SKIPPING invalid operation: ${JSON.stringify(operation)} ***`);
            return;
        }

        const opType = operation.type.trim();
        const handler = this.#registry.getHandler(opType);

        if (handler) {
            let resolvedParameters;
            try {
                resolvedParameters = resolvePlaceholders(operation.parameters, executionContext, this.#logger);
                // --- ADD THIS LOG ---
                this.#logger.debug(`Resolved parameters for ${opType}:`, JSON.stringify(resolvedParameters));
                // --- END ADD THIS LOG ---
            } catch (interpolationError) {
                this.#logger.error(`Error resolving placeholders for operation type "${opType}". Skipping handler invocation.`, interpolationError);
                // <<< --- ADDED LOG --- >>>
                this.#logger.error(`*** OperationInterpreter placeholder ERROR for: ${opType}`, interpolationError);
                return; // Stop if placeholders fail
            }

            try {
                // <<< --- ADDED LOG --- >>>
                this.#logger.info(`*** OperationInterpreter calling handler for: ${opType} ***`);
                this.#logger.debug(`Executing handler for operation type "${opType}"...`);
                handler(resolvedParameters, executionContext); // Call the actual handler
                // <<< --- ADDED LOG --- >>>
                this.#logger.debug(`Handler execution finished successfully for type "${opType}".`);
            } catch (handlerError) {
                this.#logger.debug(`Handler for operation type "${opType}" threw an error. Rethrowing...`);
                // <<< --- ADDED LOG --- >>>
                this.#logger.error(`*** OperationInterpreter handler ERROR for: ${opType}`, handlerError);
                throw handlerError; // Rethrow
            }
        } else {
            this.#logger.error(`---> HANDLER NOT FOUND for operation type: "${opType}". Skipping execution.`);
            // <<< --- ADDED LOG --- >>>
            console.warn(`*** OperationInterpreter HANDLER NOT FOUND for: ${opType} ***`);
        }
        // <<< --- ADDED LOG --- >>>
        this.#logger.info(`*** OperationInterpreter finished execute for: ${opType} ***`);
    }
}

export default OperationInterpreter;