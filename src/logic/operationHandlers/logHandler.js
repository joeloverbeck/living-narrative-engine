// src/logic/operationHandlers/logHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * @typedef {object} LogOperationParams
 * @property {string} message - The message template to log. Can contain placeholders like {actor.id}.
 * @property {'info' | 'warn' | 'error' | 'debug'} [level='info'] - The logging level. Defaults to 'info'.
 */

const VALID_LOG_LEVELS = ['info', 'warn', 'error', 'debug'];
const DEFAULT_LOG_LEVEL = 'info';
export const INTERPOLATION_FALLBACK = 'N/A'; // Value used when context variable interpolation fails

/**
 * Safely retrieves a nested value from an object using a dot-separated path string.
 * @param {object | null | undefined} obj - The object to search within.
 * @param {string} path - The dot-separated path (e.g., "actor.id", "data.value").
 * @param {any} [fallback=INTERPOLATION_FALLBACK] - The value to return if the path is not found or invalid.
 * @returns {any} The retrieved value or the fallback.
 */
function getValueFromPath(obj, path, fallback = INTERPOLATION_FALLBACK) {
    if (!obj || typeof path !== 'string' || !path) {
        return fallback;
    }
    const segments = path.split('.');
    let current = obj;
    for (const segment of segments) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return fallback;
        }
        if (!Object.prototype.hasOwnProperty.call(current, segment)) {
            // Check prototype chain as well? For now, only own properties.
            // Alternative: segment in current - checks prototype chain but might not be desired.
            return fallback;
        }
        current = current[segment];
    }

    // If the final value is null or undefined, still return the fallback
    return current ?? fallback;
}


/**
 * @class LogHandler
 * Implements the OperationHandler interface for the "LOG" operation type.
 * Writes messages to the game log using the provided ILogger service.
 * Supports basic string interpolation using ExecutionContext data.
 *
 * @implements {OperationHandler}
 */
class LogHandler {
    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of LogHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @throws {Error} If logger is not a valid ILogger instance.
     */
    constructor({ logger }) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error('LogHandler requires a valid ILogger instance.');
        }
        this.#logger = logger;
    }

    /**
     * Executes the LOG operation.
     * Retrieves message and level from parameters, performs optional interpolation,
     * and calls the appropriate method on the injected logger.
     *
     * @param {OperationParams | LogOperationParams | null | undefined} params - The parameters for the LOG operation. Expected properties: `message` (string), `level` (string, optional).
     * @param {ExecutionContext} executionContext - The context of the execution, containing event, actor, target, etc., used for interpolation.
     * @returns {void}
     */
    execute(params, executionContext) {
        // 1. Validate Parameters
        if (!params || typeof params.message !== 'string' || !params.message) {
            // Use the logger from context if available, otherwise fallback to internal (which might be the same)
            const contextLogger = executionContext?.logger ?? this.#logger;
            contextLogger.error('LogHandler: Invalid or missing "message" parameter.', { params });
            return; // Stop execution if message is invalid
        }

        const messageTemplate = params.message;
        const requestedLevel = typeof params.level === 'string' ? params.level.toLowerCase() : DEFAULT_LOG_LEVEL;

        // 2. Determine Log Level
        const level = VALID_LOG_LEVELS.includes(requestedLevel) ? requestedLevel : DEFAULT_LOG_LEVEL;

        // 3. (Optional) Interpolate Message
        let finalMessage = messageTemplate;
        try {
            // Regex to find {variable.path} placeholders
            finalMessage = messageTemplate.replace(/\{([^}]+)\}/g, (match, variablePath) => {
                // Trim whitespace from the path inside braces
                const trimmedPath = variablePath.trim();
                if (!trimmedPath) return match; // Keep empty braces like {} as is or return fallback? Return match for now.

                // Retrieve value from executionContext.evaluationContext (or top-level context if needed)
                // Assuming the primary source for interpolation is evaluationContext
                const contextObject = executionContext?.evaluationContext ?? executionContext ?? {}; // Fallback to top-level context if evaluationContext isn't present
                const value = getValueFromPath(contextObject, trimmedPath, INTERPOLATION_FALLBACK);

                // Convert value to string for logging, handle objects potentially
                if (value === null || value === undefined) return INTERPOLATION_FALLBACK;
                if (typeof value === 'object') return JSON.stringify(value); // Basic object stringification
                return String(value);
            });
        } catch (interpolationError) {
            // Log an error during interpolation but proceed with the original template
            this.#logger.error('LogHandler: Error during message interpolation. Using original template.', {
                template: messageTemplate,
                context: executionContext,
                error: interpolationError
            });
            finalMessage = messageTemplate; // Ensure we fall back to original template
        }


        // 4. Call Logger Method
        try {
            // Use bracket notation to call the appropriate logger method
            const logFunction = this.#logger[level];
            if (typeof logFunction === 'function') {
                logFunction(finalMessage);
            } else {
                // This case should technically not happen due to constructor validation and level defaulting
                this.#logger.error(`LogHandler: Invalid log level "${level}" somehow bypassed validation. Logging as error.`, { message: finalMessage });
                this.#logger.error(finalMessage); // Log as error if level function not found
            }
        } catch (logError) {
            // Fallback if the logger itself throws an error
            console.error(`LogHandler: Failed to write log message via ILogger instance (Level: ${level}).`, {
                message: finalMessage,
                originalError: logError
            });
            // Attempt to log to console as a last resort
            console.log(`[${level.toUpperCase()}] ${finalMessage}`);
        }
    }
}

export default LogHandler;