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
            const res = this.#domRenderer.mutate(trimmedSelector, trimmedProperty, value);

            // ****** CORRECTION: Use res.failures and res.modifiedCount ******
            const failureCount = res.failures ? res.failures.length : 0; // Safely get failure count
            const modifiedCount = res.modifiedCount ?? 0; // Safely get modified count

            if (failureCount > 0) {
                // Log error if there were failures
                logger.error(
                    `MODIFY_DOM_ELEMENT: Failed to modify property "${trimmedProperty}" on ${failureCount} element(s) matching selector "${trimmedSelector}".`,
                    res.failures // Log the failure details array
                );
            }

            // Log success only if elements were actually modified AND there were no failures reported above
            // (Or adjust logic if partial success + failure logging is desired differently)
            if (modifiedCount > 0) {
                logger.debug(
                    `MODIFY_DOM_ELEMENT: Modified property "${trimmedProperty}" on ${modifiedCount} element(s) matching selector "${trimmedSelector}" with value:`,
                    value
                );
            } else if (failureCount === 0) { // Only warn if no elements found AND no failures occurred
                logger.warn(`MODIFY_DOM_ELEMENT: No elements found or modified for selector "${trimmedSelector}".`);
            }

        } catch (error) {
            logger.error(`MODIFY_DOM_ELEMENT: Error during DOM mutation via DomRenderer for selector "${trimmedSelector}":`, error);
        }
    }
}

export default ModifyDomElementHandler;