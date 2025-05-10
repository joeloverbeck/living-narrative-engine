/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('./ITurnHandler.js').ITurnHandler} ITurnHandler */

// --- ITurnManager ---
/**
 * @interface ITurnManager
 * @classdesc Manages the overall turn lifecycle within the game loop. It is responsible
 * for determining which entity acts next, initiating turns, and handling the transition
 * between turns or rounds.
 */
export class ITurnManager {
    /**
     * Starts the turn management process, potentially initializing the first round or turn.
     * @function start
     * @async
     * @returns {Promise<void>} A promise that resolves when the manager has successfully started
     * and the first turn (if applicable) is ready to begin.
     * @throws {Error} Implementations might throw if the manager is already running or
     * encounters an error during initialization (e.g., no actors found).
     */
    async start() {
        throw new Error('ITurnManager.start method not implemented.');
    }

    /**
     * Stops the turn management process, halting the progression of turns.
     * @function stop
     * @async
     * @returns {Promise<void>} A promise that resolves when the manager has successfully stopped.
     * @throws {Error} Implementations might throw if the manager is already stopped or
     * encounters an error during shutdown.
     */
    async stop() {
        throw new Error('ITurnManager.stop method not implemented.');
    }

    /**
     * Retrieves the entity instance whose turn it is currently.
     * @function getCurrentActor
     * @returns {Entity | null} The entity currently taking its turn, or `null` if no
     * turn is active (e.g., between rounds, before starting, or after stopping).
     */
    getCurrentActor() {
        throw new Error('ITurnManager.getCurrentActor method not implemented.');
    }

    /**
     * Retrieves the turn handler instance that is currently managing the active turn.
     * @function getActiveTurnHandler
     * @returns {ITurnHandler | null} The currently active turn handler, or `null` if no
     * turn is active or no handler is currently assigned.
     */
    getActiveTurnHandler() {
        throw new Error('ITurnManager.getActiveTurnHandler method not implemented.');
    }

    /**
     * Advances the game state to the next entity's turn. This is typically called
     * after the current actor has completed their action or decided to wait.
     * @function advanceTurn
     * @async
     * @returns {Promise<void>} A promise that resolves when the transition to the next
     * turn (or the start of a new round, or the end of turns) is complete.
     * @throws {Error} Implementations might throw if called when inappropriate (e.g.,
     * no turn active) or if an error occurs determining the next actor.
     */
    async advanceTurn() {
        throw new Error('ITurnManager.advanceTurn method not implemented.');
    }
}