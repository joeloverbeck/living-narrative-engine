// src/core/handlers/aiTurnHandler.js

// JSDoc type imports
/**
 * @typedef {import('../../entities/entity').Entity} Entity
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/ICommandProcessor').ICommandProcessor} ICommandProcessor
 * @typedef {import('../interfaces/IActionDiscoverySystem').IActionDiscoverySystem} IActionDiscoverySystem // Optional
 * @typedef {import('../interfaces/ITurnHandler').ITurnHandler} ITurnHandler
 */

/**
 * @implements {ITurnHandler}
 */
class AITurnHandler {
    #logger;
    #commandProcessor;
    #actionDiscoverySystem; // Optional

    /**
     * Creates an instance of AITurnHandler.
     * @param {object} options - The options object.
     * @param {ILogger} options.logger - The logger instance.
     * @param {ICommandProcessor} options.commandProcessor - The command processor instance.
     * @param {IActionDiscoverySystem} [options.actionDiscoverySystem] - (Optional) The action discovery system instance.
     * @throws {Error} If essential dependencies (logger, commandProcessor) are missing or invalid.
     */
    constructor({logger, commandProcessor, actionDiscoverySystem}) {
        if (!logger || typeof logger.info !== 'function') {
            throw new Error('AITurnHandler requires a valid logger instance.');
        }
        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            throw new Error('AITurnHandler requires a valid commandProcessor instance.');
        }

        this.#logger = logger;
        this.#commandProcessor = commandProcessor;
        this.#actionDiscoverySystem = actionDiscoverySystem; // Store optional dependency

        this.#logger.info('AITurnHandler initialized.');
    }

    /**
     * Handles the turn for an AI-controlled actor by selecting a placeholder action
     * and delegating it to the command processor.
     * @param {Entity} actor - The AI-controlled entity taking its turn.
     * @returns {Promise<void>} A promise that resolves when the turn handling is complete.
     */
    async handleTurn(actor) {
        this.#logger.info(`Starting AI turn for actor: ${actor.id}`);

        // TODO: Implement AI decision-making logic here (Ticket 3.2.4+).
        // 1. Analyze the current game state relevant to the actor.
        // 2. Use actionDiscoverySystem (if available) or other means to find possible actions.
        // 3. Select an action based on AI goals/heuristics.
        // 4. Format the selected action into a command string.
        // 5. Process the command using commandProcessor (done below).

        // Placeholder logic for Ticket 3.2.2
        const command = "wait";
        this.#logger.debug(`AI actor ${actor.id} chose command: ${command}`);

        // Delegate command to processor (Ticket 3.2.3)
        try {
            this.#logger.debug(`Attempting to process command '${command}' for actor ${actor.id}`);
            const result = await this.#commandProcessor.processCommand(actor, command);
            // Log the outcome of the command processing
            this.#logger.info(`AI command '${command}' processed for actor ${actor.id}. Result:`, result);
            // Example: Check result status if needed:
            // if (result.success) {
            //     this.#logger.debug(`Command '${command}' successful for actor ${actor.id}.`);
            // } else {
            //     this.#logger.warn(`Command '${command}' failed for actor ${actor.id}. Reason: ${result.message}`);
            // }
        } catch (error) {
            // Log errors during command processing
            this.#logger.error(`Error processing AI command '${command}' for actor ${actor.id}:`, error);
            // Decide on error handling: For now, log and let the turn end.
            // Optionally, rethrow if AI errors should halt the game: throw error;
        }
    }
}

export default AITurnHandler;