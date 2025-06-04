// src/core/turns/interfaces/ITurnContext.js
// ──────────────────────────────────────────────────────────────────────────────
//  ITurnContext Interface Definition
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @description Represents an entity in the game, such as a player or NPC.
 */
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @description Defines the interface for a logging service.
 */
/**
 * @typedef {import('./IHumanPlayerPromptService.js').IHumanPlayerPromptService} IPlayerPromptService
 * @description Defines the interface for a service that handles player prompts.
 * This might be generalized if AI or other entities need different input/output.
 */
/**
 * @typedef {import('../../game/GameWorld.js').GameWorld} GameWorld
 * @description Represents the game world or a minimal interface to it.
 */
/**
 * @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager
 * @description Manages subscriptions to events, like command input.
 */
/**
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @description Port for notifying when a turn has ended.
 */
/**
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 */
/**
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 */
/**
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState
 */

/**
 * @typedef {import('./IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 */

/**
 * @typedef {import('./IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

/**
 * @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem
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
 * (logging, player prompts, service access) related to the current turn in a uniform way.
 */
export class ITurnContext {
  /**
   * Retrieves the current actor (e.g., player, NPC) whose turn is being processed.
   *
   * @returns {Entity | null} The current actor entity, or null if no actor is active.
   */
  getActor() {
    throw new Error("Method 'getActor()' must be implemented.");
  }

  /**
   * Retrieves a logger instance for logging turn-specific information.
   *
   * @returns {ILogger} The logger instance.
   */
  getLogger() {
    throw new Error("Method 'getLogger()' must be implemented.");
  }

  /**
   * Retrieves the player prompt service for interacting with a human player.
   * Note: This might need generalization if non-player entities require analogous services.
   *
   * @returns {IPlayerPromptService} The player prompt service instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getPlayerPromptService() {
    throw new Error("Method 'getPlayerPromptService()' must be implemented.");
  }

  /**
   * Retrieves the CommandProcessor service.
   *
   * @returns {ICommandProcessor} The command processor instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getCommandProcessor() {
    throw new Error("Method 'getCommandProcessor()' must be implemented.");
  }

  /**
   * Retrieves the CommandOutcomeInterpreter service.
   *
   * @returns {ICommandOutcomeInterpreter} The command outcome interpreter instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getCommandOutcomeInterpreter() {
    throw new Error(
      "Method 'getCommandOutcomeInterpreter()' must be implemented."
    );
  }

  /**
   * Retrieves the SafeEventDispatcher service.
   *
   * @returns {ISafeEventDispatcher} The safe event dispatcher instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getSafeEventDispatcher() {
    throw new Error("Method 'getSafeEventDispatcher()' must be implemented.");
  }

  /**
   * Retrieves the SubscriptionLifecycleManager for managing event subscriptions scoped to the turn.
   *
   * @returns {SubscriptionLifecycleManager} The subscription manager instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getSubscriptionManager() {
    throw new Error("Method 'getSubscriptionManager()' must be implemented.");
  }

  /**
   * Retrieves the EntityManager service.
   *
   * @returns {IEntityManager} The entity manager instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getEntityManager() {
    // <<< ADD THIS METHOD
    throw new Error("Method 'getEntityManager()' must be implemented.");
  }

  /**
   * Retrieves the global Action-Discovery System so callers can ask
   * "what can this actor do **right now**".
   *
   * @returns {IActionDiscoverySystem}
   * @throws {Error} if it is missing from the context.
   */
  getActionDiscoverySystem() {
    //  <<< NEW
    throw new Error("Method 'getActionDiscoverySystem()' must be implemented.");
  }

  /**
   * Retrieves the ITurnEndPort for signaling the end of a turn to external listeners.
   *
   * @returns {ITurnEndPort} The turn end port instance.
   * @throws {Error} If the service is not available in the current context.
     }
     getTurnEndPort() {
     throw new Error("Method 'getTurnEndPort()' must be implemented.");
     }
   
     /**
   * Signals that the current turn has completed.
   * @param {Error | null} [errorOrNull] - An optional error if the turn ended abnormally.
   * @returns {void}
   */
  endTurn(errorOrNull) {
    throw new Error("Method 'endTurn()' must be implemented.");
  }

  /**
   * Checks if the turn is currently awaiting an external event to conclude.
   *
   * @returns {boolean} True if awaiting an external event, false otherwise.
   */
  isAwaitingExternalEvent() {
    throw new Error("Method 'isAwaitingExternalEvent()' must be implemented.");
  }

  /**
   * Requests the turn handler to transition to a new state.
   * This is how strategies or other components using ITurnContext can initiate state changes
   * without directly holding a reference to the concrete handler's transition method.
   * The actual transition logic resides in the BaseTurnHandler.
   *
   * @param {new (handler: import('../handlers/baseTurnHandler.js').BaseTurnHandler, ...args: any[]) => ITurnState} StateClass - The class of the state to transition to.
   * @param {any[]} [constructorArgs] - Optional arguments to pass to the state constructor (after the handler).
   * @returns {Promise<void>}
   * @throws {Error} If the transition cannot be performed.
   */
  async requestTransition(StateClass, constructorArgs = []) {
    throw new Error("Method 'requestTransition()' must be implemented.");
  }

  /**
   * Informs the underlying handler about the need to wait for an external event.
   * Primarily used by states like AwaitingExternalTurnEndState.
   *
   * @param {boolean} isAwaiting - True if the handler should mark itself as waiting.
   * @param {string} actorId - The ID of the actor for whom the wait is being set.
   * @returns {void}
   */
  setAwaitingExternalEvent(isAwaiting, actorId) {
    throw new Error("Method 'setAwaitingExternalEvent()' must be implemented.");
  }

  /**
   * Retrieves the current actor's turn strategy.
   * This strategy is responsible for deciding the actor's action for the turn.
   *
   * @returns {IActorTurnStrategy} The actor's turn strategy instance.
   * @throws {Error} If no strategy is available or provided during context construction.
   */
  getStrategy() {
    throw new Error("Method 'getStrategy()' must be implemented.");
  }

  /**
   * Sets the chosen action for the current turn.
   * This is typically called by `AwaitingPlayerInputState` (or a similar state) after the
   * actor's {@link IActorTurnStrategy#decideAction} method resolves with an {@link ITurnAction}.
   * The stored action can then be retrieved by states like `ProcessingCommandState`.
   *
   * @param {ITurnAction} action - The action chosen by the actor.
   * @returns {void}
   * @throws {Error} If the provided action is invalid or if it's called at an inappropriate time.
   */
  setChosenAction(action) {
    throw new Error("Method 'setChosenAction(action)' must be implemented.");
  }

  /**
   * Retrieves the action that was chosen for the current turn.
   * This is typically called by `ProcessingCommandState` (or a similar state) to get the
   * {@link ITurnAction} that was previously set by `setChosenAction`.
   *
   * @returns {ITurnAction | null} The chosen action object, or `null` if no action
   * has been set for the current turn yet.
   */
  getChosenAction() {
    throw new Error("Method 'getChosenAction()' must be implemented.");
  }

  // --- NEW METHODS FOR CANCELLATION ---
  /**
   * Retrieves an AbortSignal that can be used to cancel long-running operations
   * associated with this turn context, such as player prompts.
   *
   * @returns {AbortSignal} The AbortSignal.
   */
  getPromptSignal() {
    throw new Error("Method 'getPromptSignal()' must be implemented.");
  }

  /**
   * Signals that any active long-running operation (like a player prompt)
   * associated with this turn context should be cancelled.
   * This will trigger the 'abort' event on the signal obtained via `getPromptSignal()`.
   *
   * @returns {void}
   */
  cancelActivePrompt() {
    throw new Error("Method 'cancelActivePrompt()' must be implemented.");
  }

  // --- END NEW METHODS ---
}
