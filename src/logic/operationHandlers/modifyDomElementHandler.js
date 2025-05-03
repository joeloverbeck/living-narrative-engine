// src/logic/operationHandlers/modifyDomElementHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/ILogger').ILogger} ILogger */
// *** CHANGE: Depend on the new service interface ***
/** @typedef {import('../../domUI/IDomMutationService').IDomMutationService} IDomMutationService */
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
 * Delegates DOM element modification to the DomMutationService.
 * @implements {OperationHandler}
 */
class ModifyDomElementHandler {
    /** @type {ILogger} */
    #logger;
    // *** CHANGE: Use the new service type and name ***
    /** @type {IDomMutationService} */
    #domMutationService;

    /**
     * Creates an instance of ModifyDomElementHandler.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {IDomMutationService} dependencies.domMutationService - DOM mutation service. // *** CHANGE: Updated dependency ***
     */
    constructor({logger, domMutationService}) { // *** CHANGE: Updated parameter name ***
        if (!logger || typeof logger.info !== 'function') { // Basic validation
            throw new Error('ModifyDomElementHandler requires a valid ILogger instance.');
        }
        // *** CHANGE: Validate the new service dependency ***
        if (!domMutationService || typeof domMutationService.mutate !== 'function') { // Basic validation
            throw new Error('ModifyDomElementHandler requires a valid IDomMutationService instance.');
        }
        this.#logger = logger;
        // *** CHANGE: Store the new service instance ***
        this.#domMutationService = domMutationService;
    }

    /**
     * Executes the MODIFY_DOM_ELEMENT operation.
     * Expects parameters: selector (string), property (string), value (*).
     * Placeholders in 'value' should be pre-resolved by OperationInterpreter.
     * Delegates the actual modification to the DomMutationService.
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

        // Delegate modification to DomMutationService
        try {
            // *** CHANGE: Call mutate on the new service ***
            const res = this.#domMutationService.mutate(trimmedSelector, trimmedProperty, value);

            // Use res.modified and res.failed from DomMutationService
            const modifiedCount = res.modified ?? 0; // Safely get modified count
            const failureCount = res.failed ?? 0;   // Safely get failed count (includes unchanged)
            const totalFound = res.count ?? 0; // Safely get total found count

            // Log details about the mutation attempt
            logger.debug(`MODIFY_DOM_ELEMENT: Mutation attempt result for selector "${trimmedSelector}": Found ${totalFound}, Modified ${modifiedCount}, Failed/Unchanged ${failureCount}.`);

            if (failureCount > 0 && modifiedCount > 0) { // Log error only if *some* specifically failed (we assume failure if count > modified + failed) - Adjusted logic for clarity
                // Log error if there were specific failures during modification
                logger.error(
                    `MODIFY_DOM_ELEMENT: Failed/Unchanged property "${trimmedProperty}" on ${failureCount} out of ${totalFound} element(s) matching selector "${trimmedSelector}". ${modifiedCount} succeeded.`
                    // Optional: Include specific failure details if mutate provided them
                );
            } else if (failureCount > 0 && modifiedCount === 0 && totalFound > 0) {
                logger.error( // If none were modified, but elements were found, log as error/warning
                    `MODIFY_DOM_ELEMENT: Failed to modify or value unchanged for property "${trimmedProperty}" on all ${totalFound} element(s) matching selector "${trimmedSelector}".`
                );
            }


            // Log the SUCCESS message *expected by the test* if elements were successfully modified.
            if (modifiedCount > 0) {
                logger.debug(
                    `MODIFY_DOM_ELEMENT: Modified property "${trimmedProperty}" on ${modifiedCount} element(s) matching selector "${trimmedSelector}" with value:`,
                    value
                );
            }
            // Log a warning if NO elements were found at all.
            else if (totalFound === 0) {
                // This is the specific warning for TC7 where the element is missing.
                logger.warn(`MODIFY_DOM_ELEMENT: No elements found or modified for selector "${trimmedSelector}".`);
            }
            // Removed the specific 'found but none required modification' log as it's covered by failureCount > 0 && modifiedCount === 0 case now


        } catch (error) {
            // *** CHANGE: Update error log source reference ***
            logger.error(`MODIFY_DOM_ELEMENT: Error during DOM mutation via DomMutationService for selector "${trimmedSelector}":`, error);
        }
    }
}

export default ModifyDomElementHandler;