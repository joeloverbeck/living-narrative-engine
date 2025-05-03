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
        if (!logger || typeof logger.info !== 'function') {
            throw new Error('ModifyDomElementHandler requires a valid ILogger instance.');
        }
        if (!domRenderer || typeof domRenderer.mutate !== 'function') {
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
        logger.debug('MODIFY_DOM_ELEMENT: Handler executing with params:', JSON.stringify(params)); // Log received params

        if (!params || typeof params.selector !== 'string' || !params.selector.trim() ||
            typeof params.property !== 'string' || !params.property.trim() ||
            params.value === undefined) { // Value can be null/false/0, so just check for undefined
            logger.error('MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.', {params});
            return;
        }

        const {selector, property, value} = params;
        const trimmedSelector = selector.trim();
        const trimmedProperty = property.trim();

        // Delegate modification to DomRenderer
        try { // Added try...catch around the mutate call for safety
            const res = this.#domRenderer.mutate(trimmedSelector, trimmedProperty, value);
            if (res.failed > 0) {
                // Log specifics about failures if needed, using res.errors or similar if available from mutate
                logger.error(`MODIFY_DOM_ELEMENT: Failed to modify property "${trimmedProperty}" for ${res.failed} element(s) matching selector "${trimmedSelector}".`);
            } else if (res.modified > 0) { // Check if any were actually modified
                logger.debug(`MODIFY_DOM_ELEMENT: Modified property "${trimmedProperty}" on ${res.modified} element(s) matching selector "${trimmedSelector}" with value:`, value);
            } else {
                logger.warn(`MODIFY_DOM_ELEMENT: No elements found or modified for selector "${trimmedSelector}".`);
            }
        } catch (error) {
            logger.error(`MODIFY_DOM_ELEMENT: Error during DOM mutation via DomRenderer for selector "${trimmedSelector}":`, error);
        }
    }
}

export default ModifyDomElementHandler;