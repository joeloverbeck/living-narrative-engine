/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

/**
 * @interface IActionExecutor
 * @description Defines the contract for executing a parsed game action within a given context.
 */
export class IActionExecutor {
    /**
     * Executes the action specified by the actionId using the provided context.
     * This involves validating the action, potentially resolving targets,
     * performing the action's logic (often by dispatching events), and returning the outcome.
     * @function executeAction
     * @param {string} actionId - The unique identifier of the action to execute (e.g., 'core:move').
     * @param {ActionContext} context - The context in which the action is being performed,
     * containing references to the acting entity, location, game state, etc.
     * @returns {Promise<ActionResult>} A promise that resolves with the result of the action execution,
     * indicating success or failure and potentially messages.
     * @throws {Error} Implementations might throw errors for critical failures during execution.
     */
    async executeAction(actionId, context) {
        throw new Error('IActionExecutor.executeAction method not implemented.');
    }
}