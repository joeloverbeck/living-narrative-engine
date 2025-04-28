// src/logic/operationHandlers/modifyDomElementHandler.js (New File)

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */

/**
 * @typedef {object} ModifyDomElementParams
 * @property {string} selector - CSS selector for the target element(s).
 * @property {string} property - The DOM property path to modify (e.g., 'textContent', 'style.display').
 * @property {*} value - The value to set (after placeholder resolution).
 */

/**
 * Safely sets a potentially nested property on an object using a dot-separated path.
 * @param {object} obj - The target object.
 * @param {string} path - The dot-separated path (e.g., "style.color", "dataset.userId").
 * @param {*} value - The value to set.
 * @returns {boolean} True if the value was set successfully, false otherwise.
 */
function setPropertyByPath(obj, path, value) {
    if (!obj || typeof path !== 'string') return false;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (current === null || current === undefined || typeof current !== 'object') {
            // Cannot traverse further down a non-object or null/undefined
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(current, key) || current[key] == null) {
            // If part of the path doesn't exist or is null/undefined, cannot set nested property safely
            // Could alternatively create missing objects: current[key] = {}; but safer not to by default.
            return false;
        }
        current = current[key];
    }

    const finalKey = parts[parts.length - 1];
    if (current === null || current === undefined || typeof current !== 'object') {
        // Cannot set property on final non-object
        return false;
    }

    try {
        current[finalKey] = value;
        return true;
    } catch (e) {
        // Handle potential errors during assignment (e.g., readonly properties)
        console.error(`Error setting property '${finalKey}' on path '${path}':`, e);
        return false;
    }
}


/**
 * @class ModifyDomElementHandler
 * Implements the OperationHandler interface for the "MODIFY_DOM_ELEMENT" operation type.
 * Finds DOM element(s) using a CSS selector and modifies a specified property.
 * @implements {OperationHandler}
 */
class ModifyDomElementHandler {
    /** @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ModifyDomElementHandler.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     */
    constructor({logger}) {
        if (!logger || typeof logger.info !== 'function') {
            throw new Error('ModifyDomElementHandler requires a valid ILogger instance.');
        }
        this.#logger = logger;
    }

    /**
     * Executes the MODIFY_DOM_ELEMENT operation.
     * Expects parameters: selector (string), property (string), value (*).
     * Placeholders in 'value' should be pre-resolved by OperationInterpreter.
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

        logger.debug(`MODIFY_DOM_ELEMENT: Attempting to modify property "${trimmedProperty}" with value "${JSON.stringify(value)}" on element(s) matching selector "${trimmedSelector}"...`);

        try {
            // Use querySelectorAll to handle potential multiple matches,
            // though for things like a title ID, we usually expect one.
            const elements = document.querySelectorAll(trimmedSelector);

            logger.debug(`MODIFY_DOM_ELEMENT: Found ${elements.length} elements for selector "${trimmedSelector}"`); // Log element count
            if (elements.length === 0) {
                logger.warn(`MODIFY_DOM_ELEMENT: No DOM elements found matching selector "${trimmedSelector}".`);
                return;
            }

            elements.forEach((element, index) => {
                // Set the property using the helper function for potentially nested properties
                const success = setPropertyByPath(element, trimmedProperty, value);

                if (success) {
                    logger.debug(`MODIFY_DOM_ELEMENT: Successfully set property "${trimmedProperty}" on element ${index + 1}/${elements.length} (selector: "${trimmedSelector}")`);
                } else {
                    logger.error(`MODIFY_DOM_ELEMENT: Failed to set property "${trimmedProperty}" on element ${index + 1}/${elements.length} (selector: "${trimmedSelector}"). Check path validity and element structure.`);
                }

                // --- Original direct assignment (kept for reference, less flexible) ---
                // try {
                //     // Direct assignment might not work for nested props like 'style.color'
                //     // element[trimmedProperty] = value; // Less Robust
                //     if (trimmedProperty === 'textContent') {
                //          element.textContent = value; // Specific handling if needed
                //     } else if (trimmedProperty === 'innerHTML') {
                //          element.innerHTML = value; // Specific handling if needed
                //     } else if (trimmedProperty.startsWith('style.')) {
                //          const styleProp = trimmedProperty.substring(6); // e.g., 'color'
                //          element.style[styleProp] = value;
                //     } else if (trimmedProperty.startsWith('dataset.')) {
                //         const datasetProp = trimmedProperty.substring(8); // e.g., 'userId'
                //         element.dataset[datasetProp] = value;
                //     }
                //     else {
                //          // Generic attempt - might fail for complex cases
                //          element[trimmedProperty] = value;
                //      }
                //     logger.debug(`MODIFY_DOM_ELEMENT: Successfully set property "${trimmedProperty}" on element ${index + 1}/${elements.length} (selector: "${trimmedSelector}")`);
                // } catch (propError) {
                //     logger.error(`MODIFY_DOM_ELEMENT: Error setting property "${trimmedProperty}" on element ${index + 1}/${elements.length} (selector: "${trimmedSelector}"):`, propError);
                // }
                // --- End Original ---
            });

        } catch (error) {
            // Catch errors during querySelectorAll or general processing
            logger.error(`MODIFY_DOM_ELEMENT: Error processing operation for selector "${trimmedSelector}":`, error);
        }
    }
}

export default ModifyDomElementHandler;