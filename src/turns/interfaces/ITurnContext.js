/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/* ------------------------------------------------------------------ */
/* 🔻  LOCAL TYPE STUBS – break the cycle, still give editors hints  */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} ITurnAction
 * @property {string} actionDefinitionId
 * @property {object} [resolvedParameters]
 * @property {string} [commandString]
 * @property {string} [speech]
 */

/**
 * @typedef {object} IActorTurnStrategy
 * @property {(context: ITurnContext) => Promise<ITurnAction|import('./ITurnDecisionResult.js').ITurnDecisionResult>} decideAction
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @interface ITurnContext
 * @description
 * Defines the contract for turn-specific data and services. This interface's
 * primary role is to decouple turn logic (like states and strategies) from
 * concrete handler implementations (e.g. actor-specific turn handlers).
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
   * Retrieves the SafeEventDispatcher service.
   *
   * @returns {ISafeEventDispatcher} The safe event dispatcher instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getSafeEventDispatcher() {
    throw new Error("Method 'getSafeEventDispatcher()' must be implemented.");
  }

  /**
   * Retrieves the ITurnEndPort for signaling the end of a turn to external listeners.
   *
   * @returns {ITurnEndPort} The turn end port instance.
   * @throws {Error} If the service is not available in the current context.
   */
  getTurnEndPort() {
    throw new Error("Method 'getTurnEndPort()' must be implemented.");
  }

  /**
   * Signals that the current turn has completed. The handler will create and transition
   * to the Ending state, which handles cleanup.
   *
   * @param {Error | null} [errorOrNull] - An optional error if the turn ended abnormally.
   * @returns {Promise<void>}
   */
  async endTurn(errorOrNull) {
    throw new Error("Method 'endTurn()' must be implemented.");
  }

  /**
   * Checks if the turn is currently paused, awaiting an external event to resume.
   *
   * @returns {boolean} True if awaiting an external event, false otherwise.
   */
  isAwaitingExternalEvent() {
    throw new Error("Method 'isAwaitingExternalEvent()' must be implemented.");
  }

  /**
   * Sets the flag indicating the turn is paused awaiting an external event.
   *
   * @param {boolean} isAwaiting - True if the turn should pause, false otherwise.
   * @param {string} [actorId] - Actor ID associated with the await flag.
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
   *
   * @param {ITurnAction} action - The action chosen by the actor.
   * @returns {void}
   */
  setChosenAction(action) {
    throw new Error("Method 'setChosenAction(action)' must be implemented.");
  }

  /**
   * Retrieves the action that was chosen for the current turn.
   *
   * @returns {ITurnAction | null} The chosen action object, or `null`.
   */
  getChosenAction() {
    throw new Error("Method 'getChosenAction()' must be implemented.");
  }

  /**
   * Stores metadata extracted from a turn decision, such as speech, thoughts, or notes.
   *
   * @param {{ speech:string|null, thoughts:string|null, notes:string[]|null }|null} meta - The metadata object to store.
   * @returns {void}
   */
  setDecisionMeta(meta) {
    throw new Error("Method 'setDecisionMeta(meta)' must be implemented.");
  }

  /**
   * Retrieves the decision metadata that was stored for the current turn.
   *
   * @returns {{ speech:string|null, thoughts:string|null, notes:string[]|null }|null} The stored metadata object.
   */
  getDecisionMeta() {
    throw new Error("Method 'getDecisionMeta()' must be implemented.");
  }

  /**
   * Retrieves an AbortSignal that can be used to cancel long-running operations.
   *
   * @returns {AbortSignal} The AbortSignal.
   */
  getPromptSignal() {
    throw new Error("Method 'getPromptSignal()' must be implemented.");
  }

  /**
   * Signals that any active long-running operation should be cancelled.
   *
   * @returns {void}
   */
  cancelActivePrompt() {
    throw new Error("Method 'cancelActivePrompt()' must be implemented.");
  }

  // --- REFACTORED STATE TRANSITION METHODS ---

  /**
   * Requests the turn handler to transition to the Idle state.
   * This is typically called after a turn has fully ended and been cleaned up.
   * The concrete handler implements this by calling its internal method, which uses the factory.
   *
   * @returns {Promise<void>}
   */
  async requestIdleStateTransition() {
    throw new Error(
      "Method 'requestIdleStateTransition()' must be implemented."
    );
  }

  /**
   * Requests the turn handler to transition to the AwaitingInput state.
   * This is typically called at the start of a new turn after context has been established.
   *
   * @returns {Promise<void>}
   */
  async requestAwaitingInputStateTransition() {
    throw new Error(
      "Method 'requestAwaitingInputStateTransition()' must be implemented."
    );
  }

  /**
   * Requests the turn handler to transition to the ProcessingCommand state.
   *
   * @param {string} commandString - The command string for logging/processing.
   * @param {ITurnAction} turnAction - The action to be processed.
   * @returns {Promise<void>}
   */
  async requestProcessingCommandStateTransition(commandString, turnAction) {
    throw new Error(
      "Method 'requestProcessingCommandStateTransition()' must be implemented."
    );
  }

  /**
   * Requests the turn handler to transition to the AwaitingExternalTurnEnd state.
   * This is used when the turn progression pauses to wait for an external event,
   * such as a player confirming their turn is over through a UI button.
   *
   * @returns {Promise<void>}
   */
  async requestAwaitingExternalTurnEndStateTransition() {
    throw new Error(
      "Method 'requestAwaitingExternalTurnEndStateTransition()' must be implemented."
    );
  }
}
