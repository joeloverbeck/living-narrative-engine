// src/turns/strategies/ai/interfaces/IAIGameStateProvider.js
// --- FILE START ---

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */

/**
 * @interface IAIGameStateProvider
 * @description Defines the contract for a component that gathers and structures game state
 * information relevant to an AI actor's decision-making.
 * The concrete implementation of this interface will be responsible for interacting
 * with game systems (like EntityManager, ActionDiscoveryService, actor components)
 * and compiling the data into the AIGameStateDTO.
 */
export class IAIGameStateProvider {
  /**
   * Asynchronously builds the AIGameStateDTO for a given AI actor within the current turn context.
   * This method is responsible for querying various game systems and actor components
   * to assemble a comprehensive view of the AI's current situation.
   *
   * @async
   * @param {Entity} actor - The AI-controlled entity for whom the game state is being built.
   * @param {ITurnContext} turnContext - The context of the current turn, providing access to game services like EntityManager, ActionDiscoveryService, etc.
   * @param {ILogger} logger - An instance of the logger for recording information, warnings, or errors during the state gathering process.
   * @returns {Promise<AIGameStateDTO>} A promise that resolves to the AIGameStateDTO object,
   * containing all relevant information for the AI.
   * @throws {Error} May throw an error if a critical, unrecoverable failure occurs during game state assembly
   * (e.g., essential services are unavailable), though implementations should strive to be resilient
   * and return partial data with logged errors where possible.
   */
  async buildGameState(actor, turnContext, logger) {
    // This is an interface; concrete classes will implement this.
    // Enforce implementation by throwing an error.
    throw new Error(
      "Method 'buildGameState(actor, turnContext, logger)' must be implemented by concrete classes."
    );
  }
}

// --- FILE END ---
