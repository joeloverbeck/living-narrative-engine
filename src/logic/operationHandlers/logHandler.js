// src/logic/operationHandlers/logHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */ // Use the more descriptive name for the 2nd arg
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * @typedef {object} LogOperationParams
 * @property {string} message - The message template to log. Can contain placeholders like {variable.path}.
 * @property {'info'|'warn'|'error'|'debug'} [level='info'] - The logging level. Defaults to 'info'.
 */

const VALID_LOG_LEVELS = ['info', 'warn', 'error', 'debug'];
const DEFAULT_LOG_LEVEL = 'info';
export const INTERPOLATION_FALLBACK = 'N/A';

/**
 * Safely retrieves a value from a nested object using a dot-notation path.
 * @param {Record<string, any> | null | undefined} obj - The object to search within.
 * @param {string} path - The dot-notation path (e.g., "actor.stats.hp").
 * @param {any} [fallback=INTERPOLATION_FALLBACK] - The value to return if the path is invalid or the value is not found.
 * @returns {any} The value found at the path, or the fallback value.
 */
function getValueFromPath(obj, path, fallback = INTERPOLATION_FALLBACK) {
    // Check for invalid inputs early
    if (!obj || typeof path !== 'string' || !path) {
        return fallback;
    }

    const segments = path.split('.');
    let current = obj;

    for (const segment of segments) {
        // Check if current is null/undefined or not an object before accessing property
        // Allow arrays as valid intermediate objects
        if (current === null || current === undefined || (typeof current !== 'object' && !Array.isArray(current))) {
            return fallback;
        }
        // Check if the property exists on the current object/array
        if (!Object.prototype.hasOwnProperty.call(current, segment)) {
            // Handle array index access if segment is a number
            if (Array.isArray(current) && !isNaN(parseInt(segment, 10)) && parseInt(segment, 10) < current.length) {
                current = current[parseInt(segment, 10)];
                continue; // Move to next segment
            }
            return fallback;
        }
        current = current[segment];
    }

    // If the final value is null or undefined, return the specific string representation used in interpolation logic below
    // Or let the interpolation logic handle it
    return current; // Return the actual value, let interpolation handle null/undefined rendering
}

class LogHandler /* implements OperationHandler */ { // Assuming it implements an interface
    /** @private @readonly @type {ILogger} */
    #logger;

    /**
     * Creates an instance of LogHandler.
     * @param {object} dependencies - The dependencies for the handler.
     * @param {ILogger} dependencies.logger - The logger instance.
     * @throws {Error} If the logger is invalid or missing required methods.
     */
    constructor({logger}) {
        if (
            !logger ||
            typeof logger.info !== 'function' ||
            typeof logger.warn !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function'
        ) {
            throw new Error('LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.');
        }
        this.#logger = logger;
    }

    /**
     * Executes the LOG operation: validates parameters, interpolates the message using
     * the execution context, and logs the final message using the injected logger.
     * Interpolation uses `context.evaluationContext` if present, else `context`.
     * @param {OperationParams | LogOperationParams | null | undefined} params - Parameters: { message: string, level?: string }.
     * @param {ExecutionContext} context - The execution context.
     * @returns {void}
     */
    execute(params, context) {
        // 1. Validate Parameters
        if (!params || typeof params.message !== 'string' || !params.message) {
            this.#logger.error('LogHandler: Invalid or missing "message" parameter in LOG operation.', {params});
            return;
        }

        const messageTemplate = params.message;
        const requestedLevel = typeof params.level === 'string' ? params.level.toLowerCase() : DEFAULT_LOG_LEVEL;

        // 2. Determine Log Level & Warn on Invalid
        const level = VALID_LOG_LEVELS.includes(requestedLevel) ? requestedLevel : DEFAULT_LOG_LEVEL;
        // Warn only if an invalid level was *actually provided* (not just missing)
        if (level !== requestedLevel && typeof params.level === 'string') {
            this.#logger.warn(`LogHandler: Invalid log level "${params.level}" provided. Defaulting to "${DEFAULT_LOG_LEVEL}".`, {requestedLevel: params.level}); // Use original case in warning message
        }

        // 3. Interpolate Message
        let finalMessage = messageTemplate;
        try {
            const interpolationSource = context?.evaluationContext ?? context ?? {}; // Default to empty object if context is null/undefined

            finalMessage = messageTemplate.replace(/\{([^}]+)\}/g, (match, variablePath) => {
                const trimmedPath = variablePath.trim();
                if (!trimmedPath) return match;

                const value = getValueFromPath(interpolationSource, trimmedPath, INTERPOLATION_FALLBACK); // Pass fallback here

                // Check explicit return from getValueFromPath for fallback case *or* if value is actually the fallback string
                if (value === INTERPOLATION_FALLBACK) return INTERPOLATION_FALLBACK;
                // Handle null/undefined explicitly
                if (value === null) return 'null';
                if (value === undefined) return 'undefined'; // Represent undefined after path resolution
                // Stringify objects
                if (typeof value === 'object') return JSON.stringify(value);
                // Convert others to string
                return String(value);
            });
        } catch (interpolationError) {
            this.#logger.error('LogHandler: Error during message interpolation. Logging original template.', {
                template: messageTemplate,
                context: context,
                error: interpolationError instanceof Error ? interpolationError.message : String(interpolationError),
                stack: interpolationError instanceof Error ? interpolationError.stack : undefined,
            });
            // Keep finalMessage as the original template
        }

        // 4. Call Logger Method
        try {
            const logFunction = this.#logger[level];
            logFunction(finalMessage);

        } catch (logError) {
            // Fallback to console if the injected logger fails
            const errorMsg = `LogHandler: Failed to write log message via ILogger instance (Level: ${level}). Check logger implementation.`;
            // --- MODIFIED: Pass the original error object ---
            console.error(errorMsg, {
                message: finalMessage,
                originalError: logError // Pass the actual error object
            });
            // Attempt to log the original message to console as a last resort
            console.log(`[${level.toUpperCase()}] ${finalMessage}`);
        }
    }
}

export default LogHandler;