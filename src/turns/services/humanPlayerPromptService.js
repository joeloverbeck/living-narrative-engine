// src/turns/services/humanPlayerPromptService.js
// ─────────────────────────────────────────────────────────────────────────────

// ──────────── Interface / Type imports ────────────
/** @typedef {import('../../interfaces/coreServices.js').ILogger}                           ILogger */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id                    - The unique ID of the action.
 * @property {string} name                  - A human-readable title for the action.
 * @property {object} params                - Parameters for the action (e.g. `{ targetId?: string }`).
 * @property {string} [description]         - Optional description shown in the UI.
 */
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort}                    IPromptOutputPort */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext}                     IWorldContext */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager}                     IEntityManager */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository}           IGameDataRepository */
/** @typedef {import('../../entities/entity.js').default}                                   Entity */
/** @typedef {import('../../actions/actionTypes.js').ActionContext}                         ActionContext */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

import { PromptError } from '../../errors/promptError.js';
import { IHumanPlayerPromptService } from '../interfaces/IHumanPlayerPromptService.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../constants/eventIds.js';

/**
 * @typedef {object} PlayerPromptServiceDependencies
 * @property {ILogger}                   logger
 * @property {IActionDiscoveryService}   actionDiscoverySystem
 * @property {IPromptOutputPort}         promptOutputPort
 * @property {IWorldContext}             worldContext
 * @property {IEntityManager}            entityManager
 * @property {IGameDataRepository}       gameDataRepository
 * @property {IValidatedEventDispatcher} validatedEventDispatcher
 */

/**
 * @typedef {object} PlayerPromptResolution
 * @property {DiscoveredActionInfo} action  - The action the player selected.
 * @property {string|null}          speech  - Optional free-text speech.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEventPayload
 * @property {string} [submittedByActorId]
 * @property {string} actionId
 * @property {string|null} speech
 *
 * @typedef {object} CorePlayerTurnSubmittedEvent
 * @property {string}  type
 * @property {CorePlayerTurnSubmittedEventPayload} payload
 */

/**
 * @typedef {object} CurrentPromptContext
 * @property {string}                           actorId
 * @property {(v: PlayerPromptResolution)=>void} resolve
 * @property {(e: Error)=>void}                 reject
 * @property {(() => void)|null}                unsubscribe
 * @property {DiscoveredActionInfo[]}           discoveredActions
 * @property {AbortSignal|undefined}            [cancellationSignal]
 * @property {(() => void)|null}                [abortListenerCleanup]
 * @property {boolean}                          isResolvedOrRejected
 */

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Human-facing implementation of the player-prompt flow:
 *   • Discovers valid actions (via ActionDiscoveryService)
 *   • Sends them to the UI adapter (promptOutputPort)
 *   • Waits for a PLAYER_TURN_SUBMITTED_ID event
 *   • Resolves with the chosen action + optional speech
 *
 * This version is **params-first**: it ignores any legacy `command`
 * strings that ActionDiscoveryService might still attach.
 */
class HumanPlayerPromptService extends IHumanPlayerPromptService {
  /** @type {ILogger}                   */ #logger;
  /** @type {IActionDiscoveryService}   */ #actionDiscoverySystem;
  /** @type {IPromptOutputPort}         */ #promptOutputPort;
  /** @type {IWorldContext}             */ #worldContext;
  /** @type {IEntityManager}            */ #entityManager;
  /** @type {IGameDataRepository}       */ #gameDataRepository;
  /** @type {IValidatedEventDispatcher} */ #validatedEventDispatcher;

  /** @type {CurrentPromptContext|null} */ #currentPromptContext = null;

  // ──────────────── helpers ────────────────
  /**
   * Simple runtime-dependency guard used during construction.
   * @private
   * @param {*} dep
   * @param {string} name
   * @param {string[]} [methods]
   */
  _validateDependency(dep, name, methods = []) {
    if (!dep)
      throw new Error(`PlayerPromptService: Missing ${name} dependency.`);
    for (const m of methods) {
      if (typeof dep[m] !== 'function')
        throw new Error(`PlayerPromptService: ${name} lacks method ${m}().`);
    }
  }

  // ──────────────── ctor ────────────────
  /**
   * @param {PlayerPromptServiceDependencies} deps
   */
  constructor({
    logger,
    actionDiscoverySystem,
    promptOutputPort,
    worldContext,
    entityManager,
    gameDataRepository,
    validatedEventDispatcher,
  }) {
    super();

    this._validateDependency(logger, 'ILogger', [
      'error',
      'warn',
      'info',
      'debug',
    ]);
    this._validateDependency(actionDiscoverySystem, 'IActionDiscoveryService', [
      'getValidActions',
    ]);
    this._validateDependency(promptOutputPort, 'IPromptOutputPort', ['prompt']);
    this._validateDependency(worldContext, 'IWorldContext', [
      'getLocationOfEntity',
    ]);
    this._validateDependency(entityManager, 'IEntityManager', [
      'getEntityInstance',
    ]);
    this._validateDependency(gameDataRepository, 'IGameDataRepository', [
      'getActionDefinition',
    ]);
    this._validateDependency(
      validatedEventDispatcher,
      'IValidatedEventDispatcher',
      ['subscribe', 'unsubscribe']
    );

    this.#logger = logger;
    this.#actionDiscoverySystem = actionDiscoverySystem;
    this.#promptOutputPort = promptOutputPort;
    this.#worldContext = worldContext;
    this.#entityManager = entityManager;
    this.#gameDataRepository = gameDataRepository;
    this.#validatedEventDispatcher = validatedEventDispatcher;

    this.#logger.debug(
      'HumanPlayerPromptService initialised (params-first contract).'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  INTERNAL CLEANUP UTILS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reject and clean up an outstanding prompt (if any).
   * @private
   * @param {PromptError|DOMException|null} [reason]
   */
  #clearCurrentPrompt(reason = null) {
    if (!this.#currentPromptContext) return;

    const ctx = this.#currentPromptContext;
    if (ctx.isResolvedOrRejected) {
      this.#currentPromptContext = null;
      return;
    }

    const err =
      reason ??
      /* default */ new PromptError(
        `Prompt for actor ${ctx.actorId} was superseded/cancelled.`,
        null,
        'PROMPT_SYSTEM_CLEARED'
      );

    ctx.reject(err); // ctx.reject does its own cleanup
  }

  /**
   * Remove event-subscription & abort-listener for a prompt.
   * @private
   * @param {CurrentPromptContext} ctx
   */
  _performPromptResourceCleanup(ctx) {
    if (!ctx) return;

    // unsubscribe
    if (typeof ctx.unsubscribe === 'function') {
      try {
        ctx.unsubscribe();
      } catch (e) {
        this.#logger.error('Error during unsubscribe:', e);
      }
      ctx.unsubscribe = null;
    }
    // abort listener
    if (typeof ctx.abortListenerCleanup === 'function') {
      try {
        ctx.abortListenerCleanup();
      } catch (e) {
        this.#logger.error('Error cleaning abort listener:', e);
      }
      ctx.abortListenerCleanup = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PRE-PROMPT PHASE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Ensure signal not aborted, actor valid, and supersede older prompt if any.
   * @private
   * @param {Entity} actor
   * @param {AbortSignal|undefined} signal
   * @returns {Promise<string>} actorId
   */
  async _preparePromptSession(actor, signal) {
    if (signal?.aborted)
      throw new DOMException('Prompt aborted before start', 'AbortError');

    if (!actor || typeof actor.id !== 'string' || !actor.id.trim())
      throw new PromptError('Invalid actor', null, 'INVALID_ACTOR');

    const actorId = actor.id;

    if (this.#currentPromptContext)
      this.#clearCurrentPrompt(
        new PromptError(
          `New prompt for ${actorId} superseded existing prompt for ${this.#currentPromptContext.actorId}.`,
          null,
          'PROMPT_SUPERSEDED_BY_NEW_REQUEST'
        )
      );

    return actorId;
  }

  /**
   * Compute location, build ActionContext, and discover actions.
   * @private
   * @param {Entity} actor
   * @param {string} actorId
   * @param {AbortSignal|undefined} signal
   */
  async _fetchContextAndDiscoverActions(actor, actorId, signal) {
    const currentLocation =
      await this.#worldContext.getLocationOfEntity(actorId);
    if (!currentLocation)
      throw new PromptError('Location not found', null, 'LOCATION_NOT_FOUND');

    // align with ActionContext contract (actingEntity, not actor)
    const actionContext = {
      actingEntity: actor,
      currentLocation,
      entityManager: this.#entityManager,
      gameDataRepository: this.#gameDataRepository,
      logger: this.#logger,
      worldContext: this.#worldContext,
    };

    const discoveredActions = await this.#actionDiscoverySystem.getValidActions(
      actor,
      actionContext
    );

    if (signal?.aborted)
      throw new DOMException('Prompt aborted after discovery', 'AbortError');

    return discoveredActions;
  }

  /**
   * Deliver prompt (actions or error) to the UI adapter.
   * @private
   */
  async _dispatchPromptToOutputPort(
    actorId,
    actions,
    signal,
    errorMessage = null
  ) {
    if (errorMessage) {
      await this.#promptOutputPort.prompt(actorId, [], errorMessage);
    } else {
      await this.#promptOutputPort.prompt(actorId, actions ?? []);
    }

    if (signal?.aborted)
      throw new DOMException('Prompt aborted after dispatch', 'AbortError');
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  EVENT HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle PLAYER_TURN_SUBMITTED_ID events.
   * @private
   * @param {CorePlayerTurnSubmittedEvent} evt
   * @param {CurrentPromptContext}         ctx
   * @param {(v:PlayerPromptResolution)=>void} resolve
   * @param {(e:Error)=>void}                 reject
   */
  _handlePlayerTurnSubmittedEvent(evt, ctx, resolve, reject) {
    // stale listener?
    if (this.#currentPromptContext !== ctx || ctx.isResolvedOrRejected) return;

    // envelope check
    if (!evt || evt.type !== PLAYER_TURN_SUBMITTED_ID || !evt.payload) {
      return reject(new PromptError('Malformed event', null, 'INVALID_EVENT'));
    }

    const { actionId, speech = null, submittedByActorId } = evt.payload;
    if (submittedByActorId && submittedByActorId !== ctx.actorId) return;

    const selected = ctx.discoveredActions.find((a) => a?.id === actionId);
    if (!selected) {
      return reject(
        new PromptError(
          `Unknown actionId '${actionId}'`,
          null,
          'INVALID_ACTION_ID'
        )
      );
    }

    resolve({ action: selected, speech });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PUBLIC prompt()  – main entry-point
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Prompt the human player controlling `actor` for their next action.
   * @param {Entity}  actor
   * @param {{ cancellationSignal?: AbortSignal }} [opt]
   * @returns {Promise<PlayerPromptResolution>}
   */
  async prompt(actor, { cancellationSignal } = {}) {
    this.#logger.debug(`Prompting actor ${actor?.id ?? 'UNKNOWN'}`);

    let actorId, discoveredActions;
    try {
      actorId = await this._preparePromptSession(actor, cancellationSignal);
      discoveredActions = await this._fetchContextAndDiscoverActions(
        actor,
        actorId,
        cancellationSignal
      );
      await this._dispatchPromptToOutputPort(
        actorId,
        discoveredActions,
        cancellationSignal
      );
    } catch (err) {
      // if discovery exploded, try to surface message through the UI
      if (
        err instanceof PromptError &&
        err.code === 'ACTION_DISCOVERY_FAILED'
      ) {
        try {
          await this._dispatchPromptToOutputPort(
            actorId ?? actor?.id ?? 'UNKNOWN',
            null,
            cancellationSignal,
            err
          );
        } catch (_) {
          /* ignore nested failure */
        }
      }
      throw err;
    }

    // Create and store prompt context
    return new Promise((outerResolve, outerReject) => {
      /** @type {CurrentPromptContext} */
      const ctx = {
        actorId,
        discoveredActions,
        unsubscribe: null,
        cancellationSignal,
        abortListenerCleanup: null,
        isResolvedOrRejected: false,
        resolve: (val) => {
          if (ctx.isResolvedOrRejected) return;
          ctx.isResolvedOrRejected = true;
          this._performPromptResourceCleanup(ctx);
          if (this.#currentPromptContext === ctx)
            this.#currentPromptContext = null;
          outerResolve(val);
        },
        reject: (err) => {
          if (ctx.isResolvedOrRejected) return;
          ctx.isResolvedOrRejected = true;
          this._performPromptResourceCleanup(ctx);
          if (this.#currentPromptContext === ctx)
            this.#currentPromptContext = null;
          outerReject(err);
        },
      };

      this.#currentPromptContext = ctx;

      // abort listener
      if (cancellationSignal) {
        const onAbort = () =>
          ctx.reject(new DOMException('Prompt aborted', 'AbortError'));
        cancellationSignal.addEventListener('abort', onAbort, { once: true });
        ctx.abortListenerCleanup = () =>
          cancellationSignal.removeEventListener('abort', onAbort);
        if (cancellationSignal.aborted) {
          ctx.reject(new DOMException('Prompt aborted', 'AbortError'));
          return;
        }
      }

      // subscribe to event
      try {
        const unsub = this.#validatedEventDispatcher.subscribe(
          PLAYER_TURN_SUBMITTED_ID,
          (ev) =>
            this._handlePlayerTurnSubmittedEvent(
              ev,
              ctx,
              ctx.resolve,
              ctx.reject
            )
        );
        if (typeof unsub !== 'function')
          throw new Error('subscribe did not return an unsubscribe fn');
        ctx.unsubscribe = unsub;
      } catch (e) {
        ctx.reject(
          new PromptError(
            `Failed to subscribe for player input: ${e.message}`,
            e,
            'SUBSCRIPTION_ERROR'
          )
        );
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PUBLIC: explicit external cancellation
  // ─────────────────────────────────────────────────────────────────────────
  cancelCurrentPrompt() {
    if (this.#currentPromptContext)
      this.#clearCurrentPrompt(
        new PromptError('Prompt cancelled externally', null, 'PROMPT_CANCELLED')
      );
  }
}

export default HumanPlayerPromptService;
// ─────────────────────────────────────────────────────────────────────────────
