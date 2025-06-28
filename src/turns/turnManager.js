import {
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
} from '../constants/componentIds.js';
import {
  TURN_ENDED_ID,
  TURN_STARTED_ID,
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../constants/eventIds.js';
import { ITurnManager } from './interfaces/ITurnManager.js';
import RoundManager from './roundManager.js';
import TurnCycle from './turnCycle.js';
import TurnEventSubscription from './turnEventSubscription.js';
import { RealScheduler } from '../scheduling/index.js';
import { safeDispatch } from '../utils/eventHelpers.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { logStart, logEnd, logError } from '../utils/logHelpers.js';
import { TMState } from './TMState.js';

/**
 * @class TurnManager
 * @description Finite state machine controlling turn progression.
 * @implements {ITurnManager}
 */
export default class TurnManager extends ITurnManager {
  #logger;
  #dispatcher;
  #resolver;
  #roundMgr;
  #cycle;
  #eventSub;
  #scheduler;
  #state = TMState.Idle;
  #currentActor = null;
  #currentHandler = null;
  #error = null;

  /**
   * @param {object} opts - Constructor options.
   * @param {import('./interfaces/ITurnOrderService.js').ITurnOrderService} opts.turnOrderService - Service for actor ordering.
   * @param {import('../entities/entityManager.js').default} opts.entityManager - Entity manager.
   * @param {import('../interfaces/coreServices.js').ILogger} opts.logger - Logger instance.
   * @param {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} opts.dispatcher - Event bus.
   * @param {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} opts.turnHandlerResolver - Resolves handlers.
   * @param {RoundManager} [opts.roundManager] - Optional round manager.
   * @param {TurnCycle} [opts.turnCycle] - Optional turn cycle wrapper.
   * @param {TurnEventSubscription} [opts.eventSub] - Optional event subscription helper.
   * @param {import('../scheduling').IScheduler} [opts.scheduler] - Scheduler to use.
   */
  constructor(opts = {}) {
    super();
    const {
      turnOrderService,
      entityManager,
      logger,
      dispatcher,
      turnHandlerResolver,
      roundManager,
      turnCycle,
      eventSub,
      scheduler = new RealScheduler(),
    } = opts;
    if (!turnOrderService?.clearCurrentRound) throw new Error('TurnManager requires ITurnOrderService');
    if (!entityManager?.getEntityInstance) throw new Error('TurnManager requires EntityManager');
    if (!logger?.debug) throw new Error('TurnManager requires ILogger');
    if (!dispatcher?.dispatch || !dispatcher.subscribe) throw new Error('TurnManager requires IValidatedEventDispatcher');
    if (!turnHandlerResolver?.resolveHandler) throw new Error('TurnManager requires ITurnHandlerResolver');

    this.#logger = logger;
    this.#dispatcher = dispatcher;
    this.#resolver = turnHandlerResolver;
    this.#roundMgr = roundManager || new RoundManager(turnOrderService, entityManager, logger);
    this.#cycle = turnCycle || new TurnCycle(turnOrderService, logger);
    this.#scheduler = scheduler;
    this.#eventSub = eventSub || new TurnEventSubscription(dispatcher, logger, scheduler);
  }

  /**
   * Retrieves the id of the current actor.
   *
   * @returns {string|null} Actor id or null.
   */
  getCurrentActorId() {
    return this.#currentActor?.id ?? null;
  }

  /**
   * Retrieves the active handler's constructor name.
   *
   * @returns {string|null} Handler name.
   */
  getActiveHandlerName() {
    return this.#currentHandler?.constructor?.name ?? null;
  }

  /**
   * Returns the last error recorded by the manager.
   *
   * @returns {Error|null} Last error instance or null.
   */
  getLastError() {
    return this.#error;
  }

  // Deprecated
  getCurrentActor() {
    return this.#currentActor;
  }

  // Deprecated
  getActiveTurnHandler() {
    return this.#currentHandler;
  }

  /**
   * Deprecated direct turn advancement method.
   *
   * @returns {Promise<void>}
   */
  async advanceTurn() {
    await this.#tick();
  }

  /** @returns {Promise<void>} */
  async start() {
    if (this.#state !== TMState.Idle && this.#state !== TMState.Stopped) {
      this.#logger.warn('TurnManager.start() called but already running.');
      return;
    }
    this.#eventSub.subscribe((ev) => this.#onTurnEnded(ev));
    this.#state = TMState.AwaitingActor;
    logStart(this.#logger, 'Turn Manager started');
    await this.advanceTurn();
  }

  /** @returns {Promise<void>} */
  async stop() {
    if (this.#state === TMState.Stopped || this.#state === TMState.Idle) return;
    this.#state = TMState.Stopped;
    this.#eventSub.unsubscribe();
    const handler = this.#currentHandler;
    this.#currentActor = null;
    this.#currentHandler = null;
    try {
      await this.#cycle.clear();
    } catch (e) {
      safeDispatchError(this.#dispatcher, 'Error clearing turn order service during stop', { error: e.message });
    }
    if (handler?.destroy) {
      try {
        await handler.destroy();
      } catch (e) {
        logError(this.#logger, 'Error destroying handler during stop', e);
      }
    }
    logEnd(this.#logger, 'Turn Manager stopped.');
  }

  async #tick() {
    if (this.#state !== TMState.AwaitingActor) return;
    let actor = await this.#cycle.nextActor();
    if (!actor) {
      try {
        await this.#roundMgr.startRound();
      } catch (e) {
        await this.#dispatchSystemError('System Error: No active actors found to start a round. Stopping game.', e);
        await this.stop();
        return;
      }
      actor = await this.#cycle.nextActor();
      if (!actor) {
        await this.stop();
        return;
      }
    }
    this.#currentActor = actor;
    const actorId = actor.id;
    const entityType = actor.hasComponent(PLAYER_TYPE_COMPONENT_ID)
      ? actor.getComponentData(PLAYER_TYPE_COMPONENT_ID)?.type === 'human'
        ? 'player'
        : 'ai'
      : actor.hasComponent(PLAYER_COMPONENT_ID)
      ? 'player'
      : 'ai';
    await safeDispatch(this.#dispatcher, TURN_STARTED_ID, { entityId: actorId, entityType, entity: actor }, this.#logger);
    await safeDispatch(this.#dispatcher, TURN_PROCESSING_STARTED, { entityId: actorId, actorType: entityType }, this.#logger);
    let handler;
    try {
      handler = await this.#resolver.resolveHandler(actor);
    } catch (e) {
      await this.#dispatchSystemError('System Error during turn advancement. Stopping game.', e);
      await this.stop();
      return;
    }
    this.#currentHandler = handler;
    if (!handler) {
      this.#onTurnEnded({ type: TURN_ENDED_ID, payload: { entityId: actorId, success: false } });
      return;
    }
    const name = handler.constructor?.name || 'handler';
    try {
      await handler.startTurn(actor);
    } catch (e) {
      safeDispatchError(this.#dispatcher, `Error initiating turn for ${actorId}`, { error: e.message, handlerName: name });
      await this.#dispatchSystemError(`Error initiating turn for ${actorId}.`, e);
      this.#onTurnEnded({ type: TURN_ENDED_ID, payload: { entityId: actorId, success: false, error: e } });
      return;
    }
    this.#state = TMState.AwaitingTurnEnd;
    this.#logger.debug(`Turn initiation for ${actorId} started via ${name}. TurnManager now WAITING for '${TURN_ENDED_ID}' event.`);
  }

  #onTurnEnded(event) {
    if (this.#state !== TMState.AwaitingTurnEnd) return;
    const { entityId, success } = event?.payload || {};
    if (!entityId || entityId !== this.#currentActor?.id) {
      this.#logger.warn(`Received '${TURN_ENDED_ID}' for ${entityId} but current actor is ${this.#currentActor?.id ?? 'none'}`);
      return;
    }
    if (success) this.#roundMgr.endTurn(true);
    const actor = this.#currentActor;
    const handler = this.#currentHandler;
    this.#currentActor = null;
    this.#currentHandler = null;
    const actorType = actor.hasComponent(PLAYER_COMPONENT_ID) ? 'player' : 'ai';
    this.#dispatcher.dispatch(TURN_PROCESSING_ENDED, { entityId, actorType }).catch((e) => safeDispatchError(this.#dispatcher, `Failed to dispatch ${TURN_PROCESSING_ENDED} for ${entityId}`, { error: e.message }));
    if (handler) {
      if (handler.signalNormalApparentTermination) handler.signalNormalApparentTermination();
      if (handler.destroy) handler.destroy().catch((e) => logError(this.#logger, `Error destroying handler for ${entityId}`, e));
    }
    this.#state = TMState.AwaitingActor;
    this.#scheduler.setTimeout(() => {
      this.#tick().catch((e) => {
        safeDispatchError(this.#dispatcher, 'Error during scheduled turn advancement', { error: e.message, entityId });
        this.#dispatchSystemError('Critical error during scheduled turn advancement.', e).catch(() => {});
        this.stop().catch(() => {});
      });
    }, 0);
  }

  async #dispatchSystemError(message, details) {
    await safeDispatch(
      this.#dispatcher,
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message,
        details: {
          raw: details instanceof Error ? details.message : String(details),
          stack: details instanceof Error ? details.stack : new Error().stack,
          timestamp: new Date().toISOString(),
        },
      },
      this.#logger
    );
    this.#error = details instanceof Error ? details : new Error(String(details));
  }
}
