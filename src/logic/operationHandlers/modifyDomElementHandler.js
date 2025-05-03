// src/logic/operationHandlers/modifyDomElementHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/coreServices.js').IDomRenderer} IDomRenderer */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */

/**
 * @typedef {object} ModifyDomElementParams
 * @property {string} selector - CSS selector for the target element(s).
 * @property {string} property - The DOM property path to modify (e.g., 'textContent', 'style.display').
 * @property {*} value - The value to set (after placeholder resolution).
 */

/**
 * @class ModifyDomElementHandler
 * Implements the OperationHandler interface for the "MODIFY_DOM_ELEMENT" operation type.
 * Delegates DOM element modification to the DomRenderer service.
 * @implements {OperationHandler}
 */
class ModifyDomElementHandler {
    /** @type {ILogger} */
    #logger;
    /** @type {IDomRenderer} */
    #domRenderer;

    /**
     * Creates an instance of ModifyDomElementHandler.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {IDomRenderer} dependencies.domRenderer - DOM rendering service.
     */
    constructor({logger, domRenderer}) {
        if (!logger || typeof logger.info !== 'function') { // Basic validation
            throw new Error('ModifyDomElementHandler requires a valid ILogger instance.');
        }
        if (!domRenderer || typeof domRenderer.mutate !== 'function') { // Basic validation
            throw new Error('ModifyDomElementHandler requires a valid IDomRenderer instance.');
        }
        this.#logger = logger;
        this.#domRenderer = domRenderer;
    }

    /**
     * Executes the MODIFY_DOM_ELEMENT operation.
     * Expects parameters: selector (string), property (string), value (*).
     * Placeholders in 'value' should be pre-resolved by OperationInterpreter.
     * Delegates the actual modification to the DomRenderer service.
     *
     * @param {ModifyDomElementParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The execution context (used primarily for logging here).
     * @returns {void}
     */
    execute(params, executionContext) {
        const logger = executionContext?.logger ?? this.#logger; // Prefer context logger
        // Log first, then validate
        logger.debug('MODIFY_DOM_ELEMENT: Handler executing with params:', params);

        if (!params || typeof params.selector !== 'string' || !params.selector.trim() ||
            typeof params.property !== 'string' || !params.property.trim() ||
            params.value === undefined) { // Value can be null/false/0, so just check for undefined
            logger.error('MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.', {params});
            return; // Stop execution if validation fails
        }

        const {selector, property, value} = params;
        const trimmedSelector = selector.trim();
        const trimmedProperty = property.trim();

        // Delegate modification to DomRenderer
        try {
            // Call mutate and get the result object
            const res = this.#domRenderer.mutate(trimmedSelector, trimmedProperty, value);

            // ****** CORRECTION: Use res.modified and res.failed from DomRenderer ******
            const modifiedCount = res.modified ?? 0; // Safely get modified count
            const failureCount = res.failed ?? 0;   // Safely get failed count
            const totalFound = res.count ?? 0; // Safely get total found count

            // Log details about the mutation attempt
            logger.debug(`MODIFY_DOM_ELEMENT: Mutation attempt result for selector "${trimmedSelector}": Found ${totalFound}, Modified ${modifiedCount}, Failed ${failureCount}.`);

            if (failureCount > 0) {
                // Log error if there were specific failures during modification
                logger.error(
                    `MODIFY_DOM_ELEMENT: Failed to modify property "${trimmedProperty}" on ${failureCount} out of ${totalFound} element(s) matching selector "${trimmedSelector}".`,
                    // Optional: Include specific failure details if mutate provided them
                );
            }

            // Log the SUCCESS message *expected by the test* if elements were successfully modified.
            if (modifiedCount > 0) {
                logger.debug(
                    `MODIFY_DOM_ELEMENT: Modified property "${trimmedProperty}" on ${modifiedCount} element(s) matching selector "${trimmedSelector}" with value:`,
                    value
                );
            }
                // Log a warning if elements were found but *none* were modified AND no failures occurred (e.g., property already had the value).
            // Also log a warning if NO elements were found at all.
            else if (totalFound === 0) {
                // This is the specific warning for TC7 where the element is missing.
                logger.warn(`MODIFY_DOM_ELEMENT: No elements found or modified for selector "${trimmedSelector}".`);
            } else if (totalFound > 0 && modifiedCount === 0 && failureCount === 0) {
                // Optional: Log if elements were found but none modified (e.g., value already set)
                logger.debug(`MODIFY_DOM_ELEMENT: Found ${totalFound} element(s) for selector "${trimmedSelector}", but none required modification for property "${trimmedProperty}".`);
            }


        } catch (error) {
            logger.error(`MODIFY_DOM_ELEMENT: Error during DOM mutation via DomRenderer for selector "${trimmedSelector}":`, error);
        }
    }
}

export default ModifyDomElementHandler;