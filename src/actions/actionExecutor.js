// src/actions/actionExecutor.js

// +++ Add imports for JSDoc type definitions +++
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */

/**
 * Manages and executes registered action handlers.
 * Receives ActionContext from GameLoop and passes it to the appropriate handler.
 */
class ActionExecutor {
    constructor() {
        /** @type {Map<string, (context: ActionContext) => ActionResult>} */
        this.handlers = new Map();
        console.log("ActionExecutor initialized.");
    }

    /**
     * Registers an action handler function for a specific action ID.
     * @param {string} actionId - The unique ID of the action (e.g., 'core:action_move').
     * @param {(context: import('./actionTypes.js').ActionContext) => import('./actionTypes.js').ActionResult} handlerFunction - The function that executes the action.
     */
    registerHandler(actionId, handlerFunction) {
        if (typeof actionId !== 'string' || !actionId) {
            console.error("ActionExecutor: Invalid actionId provided for registration.");
            return;
        }
        if (typeof handlerFunction !== 'function') {
            console.error(`ActionExecutor: Invalid handlerFunction provided for actionId "${actionId}". Expected a function.`);
            return;
        }
        if (this.handlers.has(actionId)) {
            console.warn(`ActionExecutor: Overwriting existing handler for actionId "${actionId}".`);
        }
        this.handlers.set(actionId, handlerFunction);
        console.log(`ActionExecutor: Registered handler for "${actionId}".`);
    }

    /**
     * Executes the registered handler for the given action ID.
     * @param {string} actionId - The ID of the action to execute.
     * @param {ActionContext} context - The context object for the action handler.
     * @returns {ActionResult} The result from the handler, or a default error result if no handler is found or an error occurs.
     */
    executeAction(actionId, context) {
        const handler = this.handlers.get(actionId);

        if (handler) {
            try {
                // Execute the registered handler function
                /** @type {ActionResult} */ // Hint the expected return type
                const result = handler(context);

                // Basic validation of the returned result
                if (typeof result !== 'object' || result === null || typeof result.success !== 'boolean' || !Array.isArray(result.messages)) {
                    console.error(`ActionExecutor: Handler for "${actionId}" returned an invalid ActionResult structure.`, result);
                    // Return a valid ActionResult structure for the error
                    return {
                        success: false,
                        messages: [{ text: `Internal Error: Action handler for '${actionId}' returned invalid data.`, type: 'error' }],
                        newState: undefined // Explicitly undefined
                    };
                }
                // Ensure newState is either absent or an object if present
                if (result.newState !== undefined && (typeof result.newState !== 'object' || result.newState === null)) {
                    console.error(`ActionExecutor: Handler for "${actionId}" returned an invalid 'newState' structure (must be object or undefined).`, result.newState);
                    return {
                        success: false,
                        messages: [{ text: `Internal Error: Action handler for '${actionId}' returned invalid state update data.`, type: 'error' }],
                        newState: undefined
                    };
                }

                return result; // Return the validated result from the handler

            } catch (error) {
                console.error(`ActionExecutor: Error executing handler for actionId "${actionId}":`, error);
                return {
                    success: false,
                    messages: [{ text: `An internal error occurred while processing the command.`, type: 'error' }], // Simplified user message
                    newState: undefined
                };
            }
        } else {
            console.error(`ActionExecutor: No handler registered for actionId "${actionId}".`);
            return {
                success: false,
                messages: [{ text: `Internal Error: The action '${actionId.split(':').pop()}' is not configured.`, type: 'error' }], // Slightly better user message
                newState: undefined
            };
        }
    }
}

export default ActionExecutor;