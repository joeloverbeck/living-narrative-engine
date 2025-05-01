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
     * Handles the turn for an AI-controlled actor.
     * (Currently a stub)
     * @param {Entity} actor - The AI-controlled entity taking its turn.
     * @returns {Promise<void>}
     * @throws {Error} Not Implemented.
     */
    async handleTurn(actor) {
        // TODO: Implement AI decision-making logic here.
        // 1. Analyze the current game state relevant to the actor.
        // 2. Use actionDiscoverySystem (if available) or other means to find possible actions.
        // 3. Select an action based on AI goals/heuristics.
        // 4. Format the selected action into a command string.
        // 5. Process the command using commandProcessor.
        this.#logger.debug(`AI Turn for actor: ${actor.id}`);
        throw new Error(`handleTurn method not implemented for actor ${actor.id}.`);
    }
}

export default AITurnHandler;
