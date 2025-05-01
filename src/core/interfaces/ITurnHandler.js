/** @typedef {import('../../entities/entity.js').default} Entity */

// --- ITurnHandler ---
/**
 * @interface ITurnHandler
 * @classdesc Defines the contract for handling the specific logic required during a single
 * entity's turn. Implementations will vary based on the type of entity (e.g., PlayerTurnHandler,
 * AITurnHandler). It receives the actor and is responsible for facilitating their action(s)
 * for that turn.
 */
export class ITurnHandler {
    /**
     * Executes the logic required for the specified actor's turn.
     * For a player, this might involve enabling input and waiting for a command.
     * For an AI, this might involve evaluating state and choosing an action.
     * The handler should signal completion once the actor's turn activities are finished.
     * @function handleTurn
     * @async
     * @param {Entity} actor - The entity whose turn is being handled.
     * @returns {Promise<void>} A promise that resolves when the actor's turn processing
     * (e.g., receiving and processing input, executing AI logic) is complete. The specific
     * result might be refined later if details about the turn outcome are needed here.
     * @throws {Error} Implementations might throw if a critical error occurs during
     * the turn handling process that prevents completion.
     */
    async handleTurn(actor) {
        throw new Error('ITurnHandler.handleTurn method not implemented.');
    }
}