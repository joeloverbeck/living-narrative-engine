// src/core/turns/interfaces/ITurnContext.js
// ──────────────────────────────────────────────────────────────────────────────
//  ITurnContext Interface Definition
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @description Represents an entity in the game, such as a player or NPC.
 */
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @description Defines the interface for a logging service.
 */
/**
 * @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService
 * @description Defines the interface for a service that handles player prompts.
 */

/**
 * @typedef {import('../../game/GameWorld.js').GameWorld} GameWorld
 * @description Represents the game world or a minimal interface to it.
 * // Note: Replace '../../game/GameWorld.js' with the actual path to your GameWorld definition.
 * // If GameWorld is not yet defined, this typedef serves as a placeholder.
 */

/**
 * @interface ITurnContext
 * @description
 * Defines the contract for turn-specific data and services. This interface's
 * primary role is to decouple turn logic (like states and strategies) from
 * concrete handler implementations (e.g. PlayerTurnHandler, AITurnHandler).
 *
 * By interacting with ITurnContext, turn states and actor strategies can
 * access essential information (current actor, game state) and functionalities
 * (logging, player prompts) related to the current turn in a uniform way,
 * regardless of whether the turn is being handled for a human player, an AI,
 * or another entity. This promotes reusability and testability of turn logic components.
 *
 * @example
 * // A turn state using the ITurnContext to get the current actor and log a message.
 * class MyTurnState {
 * async execute(context) {
 * const actor = context.getActor();
 * const logger = context.getLogger();
 * logger.info(`Processing turn for actor: ${actor.name}`);
 * // ... further logic
 * }
 * }
 */
export class ITurnContext {
    /**
     * Retrieves the current actor (e.g., player, NPC) whose turn is being processed.
     * This allows turn logic to identify and interact with the active entity.
     * @returns {Entity | null} The current actor entity, or null if no actor is active for the turn.
     * @example
     * // Get the current actor
     * const currentActor = context.getActor();
     * if (currentActor) {
     * console.log(`It's ${currentActor.name}'s turn.`);
     * }
     */
    getActor() {
        // Implementation would be in the concrete class that implements this interface.
        throw new Error("Method 'getActor()' must be implemented.");
    }

    /**
     * Retrieves a logger instance for logging turn-specific information.
     * This allows for consistent and contextual logging throughout turn processing.
     * @returns {ILogger} The logger instance.
     * @example
     * // Get the logger and log a debug message
     * const logger = context.getLogger();
     * logger.debug('Starting action processing for the current turn.');
     */
    getLogger() {
        // Implementation would be in the concrete class that implements this interface.
        throw new Error("Method 'getLogger()' must be implemented.");
    }

    /**
     * Retrieves the player prompt service for interacting with the player.
     * This is used to request input or display choices to a human player.
     * @returns {IPlayerPromptService} The player prompt service instance.
     * @example
     * // Get the prompt service and ask the player a question
     * const prompter = context.getPlayerPromptService();
     * const response = await prompter.ask("What do you want to do?");
     */
    getPlayerPromptService() {
        // Implementation would be in the concrete class that implements this interface.
        throw new Error("Method 'getPlayerPromptService()' must be implemented.");
    }

    /**
     * Retrieves a reference to the game world or a minimal interface to it.
     * This provides access to game state, entities, and game-specific logic
     * necessary for processing the turn.
     * @returns {GameWorld} The game world instance or a relevant game controller.
     * @example
     * // Get the game world and find an entity
     * const game = context.getGame();
     * const targetEntity = game.findEntityById('goblin-1');
     */
    getGame() {
        // Implementation would be in the concrete class that implements this interface.
        throw new Error("Method 'getGame()' must be implemented.");
    }

    /**
     * Signals that the current turn has completed. This method can optionally
     * accept an error object if the turn ended abnormally (e.g., due to an
     * unexpected exception or a forced termination).
     * @param {Error | null} [errorOrNull] - An optional error object if the turn
     * ended abnormally. Pass null or omit if the turn ended normally.
     * @returns {void}
     * @example
     * // End the turn normally
     * context.endTurn();
     *
     * // End the turn with an error
     * try {
     * // some risky operation
     * performRiskyAction();
     * context.endTurn();
     * } catch (e) {
     * context.endTurn(e);
     * }
     */
    endTurn(errorOrNull) {
        // Implementation would be in the concrete class that implements this interface.
        throw new Error("Method 'endTurn()' must be implemented.");
    }

    /**
     * Checks if the turn is currently awaiting an external event to conclude.
     * This is useful for scenarios where the turn's progression depends on
     * something outside the immediate turn logic, such as a player responding to a
     * prompt, an animation finishing, or an external system (e.g., an AI service)
     * signaling completion.
     * @returns {boolean} True if the turn is awaiting an external event, false otherwise.
     * @example
     * // Check if waiting for player input
     * if (context.isAwaitingExternalEvent()) {
     * console.log('Waiting for player to make a move...');
     * } else {
     * // Proceed with next phase of the turn
     * }
     */
    isAwaitingExternalEvent() {
        // Implementation would be in the concrete class that implements this interface.
        throw new Error("Method 'isAwaitingExternalEvent()' must be implemented.");
    }
}