// src/turns/context/turnContext.js
// ─────────────────────────────────────────────────────────────────────────────
//  TurnContext – decoupled from concrete state classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger}            ILogger
 * @typedef {function(Error|null):void}                                    OnEndTurnCallback
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler}      BaseTurnHandler
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction}     ITurnAction
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort}               ITurnEndPort
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager}   IEntityManager
 */

/**
 * @typedef {object} TurnContextServices
 * @property {IPromptCoordinator}             [promptCoordinator]
 * @property {ICommandProcessor}              [commandProcessor]
 * @property {ICommandOutcomeInterpreter}     [commandOutcomeInterpreter]
 * @property {ISafeEventDispatcher}           [safeEventDispatcher]
 * @property {ITurnEndPort}                   [turnEndPort]
 * @property {IEntityManager}                 [entityManager]
 * @property {IActionDiscoveryService}        [actionDiscoverySystem]
 * // …extend as needed
 */

import { ITurnContext } from '../interfaces/ITurnContext.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds'; // ⬅ only import needed

/**
 * Concrete implementation of ITurnContext.
 * NO LONGER knows about *any* concrete state classes – it delegates
 * all transitions to its owning BaseTurnHandler instance.
 * This breaks the dependency-cruiser cycle:
 *   TurnContext → ProcessingCommandState → … → HumanTurnHandler → TurnContext
 */
export class TurnContext extends ITurnContext {
  /** @type {Entity}              */ #actor;
  /** @type {ILogger}             */ #logger;
  /** @type {TurnContextServices} */ #services;
  /** @type {IActorTurnStrategy}  */ #strategy;
  /** @type {OnEndTurnCallback}   */ #onEndTurnCallback;
  /** @type {BaseTurnHandler}     */ #handlerInstance;
  /** @type {boolean}             */ #isAwaitingExternalEvent = false;

  /** @type {ITurnAction|null}    */ #chosenAction = null;
  /** @type {AbortController}     */ #promptAbortController;
  /** @type {{speech:string|null, thoughts:string|null, notes:string[]|null}|null} */
  #decisionMeta = null;

  constructor({
    actor,
    logger,
    services,
    strategy,
    onEndTurnCallback,
    handlerInstance,
  }) {
    super();

    if (!actor) throw new Error('TurnContext: actor is required.');
    if (!logger) throw new Error('TurnContext: logger is required.');
    if (!services) throw new Error('TurnContext: services bag required.');
    if (!strategy || typeof strategy.decideAction !== 'function')
      throw new Error('TurnContext: valid IActorTurnStrategy required.');
    if (typeof onEndTurnCallback !== 'function')
      throw new Error('TurnContext: onEndTurnCallback function required.');
    if (!handlerInstance)
      throw new Error(
        'TurnContext: handlerInstance (BaseTurnHandler) required.'
      );

    this.#actor = actor;
    this.#logger = logger;
    this.#services = services;
    this.#strategy = strategy;
    this.#onEndTurnCallback = onEndTurnCallback;
    this.#handlerInstance = handlerInstance;

    this.#promptAbortController = new AbortController();

    // expose the EM so low-level helpers can touch it directly
    this.entityManager = services.entityManager ?? null;

    // expose aliases expected by low-level helpers -----------------
    this.actingEntity = actor;

    if (
      !this.currentLocation &&
      this.entityManager &&
      typeof this.entityManager.getComponentData === 'function'
    ) {
      const pos = this.entityManager.getComponentData(
        actor.id,
        POSITION_COMPONENT_ID
      );
      if (pos?.locationId) {
        this.currentLocation = this.entityManager.getEntityInstance(
          pos.locationId
        ) ?? { id: pos.locationId };
      }
    }
  }

  /* ───────────────────────────── BASIC GETTERS ────────────────────────── */

  getActor() {
    return this.#actor;
  }

  getLogger() {
    return this.#logger;
  }

  getPlayerPromptService() {
    return this.#require('promptCoordinator', 'PlayerPromptService');
  }

  getCommandProcessor() {
    return this.#require('commandProcessor', 'CommandProcessor');
  }

  getCommandOutcomeInterpreter() {
    return this.#require(
      'commandOutcomeInterpreter',
      'CommandOutcomeInterpreter'
    );
  }

  getSafeEventDispatcher() {
    return this.#require('safeEventDispatcher', 'SafeEventDispatcher');
  }

  getTurnEndPort() {
    return this.#require('turnEndPort', 'TurnEndPort');
  }

  /* ───────────────────────────── TURN ENDING ──────────────────────────── */

  endTurn(errorOrNull = null) {
    if (!this.#promptAbortController.signal.aborted) {
      this.#logger.debug(
        `TurnContext.endTurn: aborting prompt for actor ${this.#actor.id}.`
      );
      this.cancelActivePrompt();
    }

    // If handler already disposed, silently ignore.
    if (this.#handlerInstance?._isDestroyed === true) return;

    this.#decisionMeta = null;
    this.#onEndTurnCallback(errorOrNull);
  }

  /* ───────────────────── AWAITING-EVENT FLAG MANAGEMENT ────────────────── */

  isAwaitingExternalEvent() {
    return this.#isAwaitingExternalEvent;
  }

  setAwaitingExternalEvent(isAwaiting) {
    this.#isAwaitingExternalEvent = !!isAwaiting;
    this.#logger.debug(
      `TurnContext for ${this.#actor.id} awaitingExternalEvent → ${this.#isAwaitingExternalEvent}`
    );
  }

  /* ───────────────────────── ACTION + META STORAGE ────────────────────── */

  getStrategy() {
    return this.#strategy;
  }

  setChosenAction(action) {
    if (!action || !action.actionDefinitionId)
      throw new Error('TurnContext.setChosenAction: invalid ITurnAction.');
    this.#chosenAction = action;
    this.#logger.debug(
      `TurnContext: action chosen for ${this.#actor.id} – ${action.actionDefinitionId}`
    );
  }

  getChosenAction() {
    return this.#chosenAction;
  }

  setDecisionMeta(meta) {
    this.#decisionMeta = meta ?? null;
  }

  getDecisionMeta() {
    return this.#decisionMeta;
  }

  /* ────────────────────────── PROMPT CANCELLATION ─────────────────────── */

  getPromptSignal() {
    return this.#promptAbortController.signal;
  }

  cancelActivePrompt() {
    if (!this.#promptAbortController.signal.aborted)
      this.#promptAbortController.abort();
  }

  /* ───────────────────── STATE-TRANSITION CONVENIENCE ────────────────────
     IMPORTANT: the context **no longer** instantiates concrete states – it
     just asks its handler to do so.  This removes the direct dependency on
     ProcessingCommandState / AwaitingActorDecisionState / TurnIdleState.     */

  async requestIdleStateTransition() {
    await this.#handlerInstance.requestIdleStateTransition();
  }

  async requestAwaitingInputStateTransition() {
    await this.#handlerInstance.requestAwaitingInputStateTransition();
  }

  async requestProcessingCommandStateTransition(commandString, turnAction) {
    await this.#handlerInstance.requestProcessingCommandStateTransition(
      commandString,
      turnAction
    );
  }

  /* ─────────────────────────── INTERNAL HELPERS ───────────────────────── */

  /**
   * Ensures a service exists in the bag, otherwise throws with a helpful log.
   *
   * @param key
   * @param label
   * @private
   */
  #require(key, label) {
    const svc = this.#services[key];
    if (!svc) {
      const msg = `TurnContext: ${label} not available in services bag.`;
      this.#logger.error(msg);
      throw new Error(msg);
    }
    return svc;
  }

  /* ──────────────── (optional) UTILITY FOR LOGGING ONLY ───────────────── */

  getChosenActionId() {
    return this.#chosenAction?.actionDefinitionId ?? null;
  }

  /* ───────────────────────────── CLONE HELPER ─────────────────────────── */

  /**
   * @param newActor
   * @deprecated Prefer constructing a fresh TurnContext per actor.
   */
  cloneForActor(newActor) {
    this.#logger.warn(
      'TurnContext.cloneForActor is deprecated – create a fresh context per actor.'
    );
    return new TurnContext({
      actor: newActor,
      logger: this.#logger,
      services: this.#services,
      strategy: this.#strategy,
      onEndTurnCallback: this.#onEndTurnCallback,
      handlerInstance: this.#handlerInstance,
    });
  }
}
