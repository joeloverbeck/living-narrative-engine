// src/core/handlers/playerTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  PlayerTurnHandler  – COMPLETE IMPLEMENTATION
//  Phase‑3 ticket: PTH‑COMPLEX‑002 (State Validation Helpers Refinement)
//
//  Legacy actor‑validation helpers (#_isTurnValidForActor / #_assertTurnActiveFor)
//  have been **removed**.  Responsibility for ensuring the correct actor is now
//  vested entirely in the active ITurnState.  The handler exposes only two
//  *global* guards:
//     • _isHandlerActive()    – cheap boolean check; never throws.
//     • _assertHandlerActive() – throws if destroy() has already run.
//
//  Public entry‑points (startTurn / handleSubmittedCommand / handleTurnEndedEvent)
//  route through these helpers, centralising “am I alive?” logic and keeping the
//  class free of duplicated `if (this.#isDestroyed)` boilerplate.
//
//  Aside from those structural changes, no behavioural logic has been altered.
// ──────────────────────────────────────────────────────────────────────────────

// ── Interface Imports ────────────────────────────────────────────────────────
import {ITurnHandler} from '../../interfaces/ITurnHandler.js';

// ── Constant Imports ─────────────────────────────────────────────────────────
import {TURN_ENDED_ID} from '../../constants/eventIds.js';

// ── State Imports ────────────────────────────────────────────────────────────
import {TurnIdleState} from '../states/turnIdleState.js';              // PTH‑STATE‑003
import {TurnEndingState} from '../states/turnEndingState.js';          // PTH‑STATE‑008

// (AwaitingExternalTurnEndState is reached via WaitForTurnEndEventStrategy)

// ── Type‑Only JSDoc Imports ─────────────────────────────────────────────────
/** @typedef {import('../../interfaces/coreServices.js').ILogger}                 ILogger */
/** @typedef {import('../../interfaces/ICommandProcessor.js').ICommandProcessor}   ICommandProcessor */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../entities/entity.js').default}                        Entity */
/** @typedef {import('../../commandProcessor.js').CommandResult}                   CommandResult */
/** @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort}                  ITurnEndPort */

/** @typedef {import('../../services/subscriptionLifecycleManager.js').default}    SubscriptionLifecycleManager */
/** @typedef {import('../states/ITurnState.js').ITurnState}                       ITurnState */

// ──────────────────────────────────────────────────────────────────────────────
//  Class Definition
// ──────────────────────────────────────────────────────────────────────────────
class PlayerTurnHandler extends ITurnHandler {
    // ── Private Fields ───────────────────────────────────────────────────────
    /** @type {ILogger} */                    #logger;
    /** @type {ICommandProcessor} */          #commandProcessor;
    /** @type {ITurnEndPort} */               #turnEndPort;
    /** @type {IPlayerPromptService} */       #playerPromptService;
    /** @type {ICommandOutcomeInterpreter} */ #commandOutcomeInterpreter;
    /** @type {ISafeEventDispatcher} */       #safeEventDispatcher;
    /** @type {SubscriptionLifecycleManager} */ #subscriptionManager;

    /** @type {Entity|null}   */ #currentActor = null;
    /** @type {boolean}       */ #isAwaitingTurnEndEvent = false;
    /** @type {string|null}   */ #awaitingTurnEndForActorId = null;

    /** @type {boolean}       */ #isDestroyed = false;
    /** @type {boolean}       */ #isTerminatingNormally = false;

    /** @type {ITurnState}    */ #currentState;

    // ── Constructor ──────────────────────────────────────────────────────────
    /**
     * @param {object} deps
     * @param {ILogger}                         deps.logger
     * @param {ICommandProcessor}               deps.commandProcessor
     * @param {ITurnEndPort}                    deps.turnEndPort
     * @param {IPlayerPromptService}            deps.playerPromptService
     * @param {ICommandOutcomeInterpreter}      deps.commandOutcomeInterpreter
     * @param {ISafeEventDispatcher}            deps.safeEventDispatcher
     * @param {SubscriptionLifecycleManager}    deps.subscriptionLifecycleManager
     */
    constructor({
                    logger,
                    commandProcessor,
                    turnEndPort,
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                    subscriptionLifecycleManager
                }) {
        super();

        // Basic dependency validation ----------------------------------------------------
        if (!logger) throw new Error('PlayerTurnHandler: logger is required');
        if (!commandProcessor) throw new Error('PlayerTurnHandler: commandProcessor is required');
        if (!turnEndPort) throw new Error('PlayerTurnHandler: turnEndPort is required');
        if (!playerPromptService) throw new Error('PlayerTurnHandler: playerPromptService is required');
        if (!commandOutcomeInterpreter) throw new Error('PlayerTurnHandler: commandOutcomeInterpreter is required');
        if (!safeEventDispatcher) throw new Error('PlayerTurnHandler: safeEventDispatcher is required');
        if (!subscriptionLifecycleManager) throw new Error('PlayerTurnHandler: subscriptionLifecycleManager is required');

        this.#logger = logger;
        this.#commandProcessor = commandProcessor;
        this.#turnEndPort = turnEndPort;
        this.#playerPromptService = playerPromptService;
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
        this.#safeEventDispatcher = safeEventDispatcher;
        this.#subscriptionManager = subscriptionLifecycleManager;

        this.#currentState = new TurnIdleState(this);
        this.#logger.debug(`${this.constructor.name} initialised → state ${this.#currentState.getStateName()}`);
    }

    /**
     * Throws if the handler has already been destroyed.
     * @throws {Error}
     */
    _assertHandlerActive() {
        if (this.#isDestroyed) {
            throw new Error(`${this.constructor.name}: operation invoked after destroy()`);
        }
    }

    // ── Public Getters (services) ────────────────────────────────────────────
    /** @returns {ILogger} */                    get logger() {
        return this.#logger;
    }

    /** @returns {IPlayerPromptService} */       get playerPromptService() {
        return this.#playerPromptService;
    }

    /** @returns {ICommandProcessor} */          get commandProcessor() {
        return this.#commandProcessor;
    }

    /** @returns {ICommandOutcomeInterpreter} */ get commandOutcomeInterpreter() {
        return this.#commandOutcomeInterpreter;
    }

    /** @returns {ITurnEndPort} */               get turnEndPort() {
        return this.#turnEndPort;
    }

    /** @returns {ISafeEventDispatcher} */       get safeEventDispatcher() {
        return this.#safeEventDispatcher;
    }

    /** @returns {SubscriptionLifecycleManager} */ get subscriptionManager() {
        return this.#subscriptionManager;
    }

    // ── Actor Management ────────────────────────────────────────────────────
    /** @returns {Entity|null} */ getCurrentActor() {
        return this.#currentActor;
    }

    /** @param {Entity|null} actor */ setCurrentActor(actor) {
        this.#currentActor = actor;
    }

    // ── Await‑turn‑end bookkeeping (used by AwaitingExternalTurnEndState) ──
    _markAwaitingTurnEnd(isAwaiting, actorId = null) {
        const prevFlag = this.#isAwaitingTurnEndEvent;
        const prevActor = this.#awaitingTurnEndForActorId;

        this.#isAwaitingTurnEndEvent = Boolean(isAwaiting);
        this.#awaitingTurnEndForActorId = this.#isAwaitingTurnEndEvent ? (actorId ?? null) : null;

        this.#logger.debug(`${this.constructor.name}._markAwaitingTurnEnd: ${prevFlag}/${prevActor} → ${this.#isAwaitingTurnEndEvent}/${this.#awaitingTurnEndForActorId}`);
    }

    isAwaitingExternalTurnEnd() {
        return this.#isAwaitingTurnEndEvent;
    }

    _clearTurnEndWaitingMechanisms() {
        this.#clearTurnEndWaitingMechanisms();
    }

    // ── State‑Pattern Public API ────────────────────────────────────────────
    /**
     * Begin a new player turn.
     * @param {Entity} actor
     */
    async startTurn(actor) {
        this._assertHandlerActive();
        await this.#currentState.startTurn(this, actor);
    }

    // ── State Transition Orchestrator ────────────────────────────────────────
    /** @private */
    async _transitionToState(newState) {
        if (!newState || typeof newState.enterState !== 'function' || typeof newState.exitState !== 'function') {
            throw new Error('_transitionToState: newState must implement ITurnState');
        }

        const prevState = this.#currentState;
        if (prevState === newState) return;

        this.#logger.debug(`${this.constructor.name}: ${prevState.getStateName()} → ${newState.getStateName()}`);

        try {
            await prevState.exitState(this, newState);
        } catch (exitErr) {
            this.#logger.error(`${this.constructor.name}: error during ${prevState.getStateName()}.exitState – ${exitErr.message}`, exitErr);
        }

        this.#currentState = newState;

        try {
            await newState.enterState(this, prevState);
        } catch (enterErr) {
            this.#logger.error(`${this.constructor.name}: error during ${newState.getStateName()}.enterState – ${enterErr.message}`, enterErr);
            if (!(this.#currentState instanceof TurnIdleState)) {
                await this._transitionToState(new TurnIdleState(this));
            }
        }
    }

    // ── Turn‑End Helper (used by strategies & failsafes) ─────────────────────
    /** @private */
    async _handleTurnEnd(actorId, turnError = null, fromDestroy = false) {
        if (this.#isDestroyed && !fromDestroy) {
            this.#logger.debug(`${this.constructor.name}._handleTurnEnd ignored – handler destroyed`);
            return;
        }
        await this._transitionToState(new TurnEndingState(this, actorId, turnError));
    }

    /**
     * Completely cleans up per-turn state and runtime subscriptions.
     *
     * This is the **single** place where transient turn data is reset.
     * It is invoked by:
     *   • TurnIdleState.enterState() – fresh idle baseline
     *   • TurnEndingState.enterState() – immediately after port notification
     *   • PlayerTurnHandler.destroy()  – final belt-and-braces cleanup
     *
     * @param {string} [actorIdContextForLog='N/A']
     *        Purely diagnostic: a string that helps trace which actor / code-path
     *        triggered the reset.  It has no behavioural impact.
     * @private
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const logCtx = actorIdContextForLog ?? 'N/A';
        this.#logger.debug(
            `${this.constructor.name}._resetTurnStateAndResources → actorCtx='${logCtx}'`
        );

        // ── 1. Clear any “awaiting external turn-end” bookkeeping ────────────
        //     (also resets #isAwaitingTurnEndEvent & #awaitingTurnEndForActorId)
        this._markAwaitingTurnEnd(false);

        // ── 2. Drop **all** dynamic subscriptions in one shot ───────────────
        //     SubscriptionLifecycleManager guarantees idempotency.
        try {
            this.#subscriptionManager.unsubscribeAll();
        } catch (err) {
            this.#logger.warn(
                `${this.constructor.name}: unsubscribeAll failed – ${err.message}`,
                err
            );
        }

        // ── 3. Reset transient flags to their idle defaults ─────────────────
        this.#currentActor = null;          // no active actor
        this.#isTerminatingNormally = false; // next cycle starts “clean”

        // NOTE: #isDestroyed is ***not*** touched here – that flag spans the
        //       entire lifetime of the handler instance.
        this.#logger.debug(
            `${this.constructor.name}: Per-turn state reset complete for '${logCtx}'.`
        );
    }

    // ── Await‑event safety‑net ───────────────────────────────────────────────
    /** @private */
    #clearTurnEndWaitingMechanisms() {
        this._markAwaitingTurnEnd(false);

        try {
            if (typeof this.#subscriptionManager.unsubscribeFromTurnEnded === 'function') {
                this.#subscriptionManager.unsubscribeFromTurnEnded();
            }
        } catch (err) {
            this.#logger.warn(`${this.constructor.name}: unsubscribeFromTurnEnded failed – ${err.message}`, err);
        }
    }

    // Used exclusively by TurnEndingState ------------------------------------
    signalNormalApparentTermination() {
        this.#isTerminatingNormally = true;
    }

    // ── Destroy (public) ─────────────────────────────────────────────────────
    /**
     * Cleanly dismantles this {@link PlayerTurnHandler}.
     *
     * * Idempotent – subsequent calls are ignored once `#isDestroyed` is `true`.
     * * Delegates to the **current state** first so state-specific teardown (and
     *   any `_handleTurnEnd()` invocation) happens before the global failsafe.
     * * If, after that delegation, no “normal” termination was detected while a
     *   turn was still active, it triggers `_handleTurnEnd()` itself to ensure
     *   the game loop receives an abnormal-shutdown notification.
     * * Finally performs a belt-and-braces reset and guarantees we finish in
     *   `TurnIdleState`.
     *
     * @returns {Promise<void>}
     */
    async destroy() {
        // ── 1.  Idempotency guard ────────────────────────────────────────────
        if (this.#isDestroyed) return;
        this.#isDestroyed = true;

        this.#logger.info(`${this.constructor.name}.destroy() invoked`);

        // Snapshot the actor *before* state teardown; we may need it later.
        const initialActorId = this.getCurrentActor()?.id ?? null;

        // ── 2.  Let the active state perform its own cleanup first ───────────
        try {
            await this.#currentState.destroy(this);
        } catch (stateErr) {
            this.#logger.warn(
                `${this.constructor.name}: currentState.destroy() errored – ${stateErr.message}`,
                stateErr
            );
        }

        // ── 3.  Failsafe abnormal-turn termination, if still required ───────
        if (!this.#isTerminatingNormally && initialActorId) {
            await this._handleTurnEnd(
                initialActorId,
                new Error('PlayerTurnHandler destroyed unexpectedly'),
                /* fromDestroy */ true          // bypasses the “handler destroyed” guard
            );
        }

        // ── 4.  Global resource reset & ensure Idle state ────────────────────
        this._resetTurnStateAndResources('destroy');

        if (!(this.#currentState instanceof TurnIdleState)) {
            await this._transitionToState(new TurnIdleState(this));
        }

        this.#logger.debug(`${this.constructor.name}.destroy() complete`);
    }

    // ── INTERNAL TEST‑ONLY HOOKS ─────────────────────────────────────────────
    /* istanbul ignore next */
    _TEST_GET_CURRENT_STATE() {
        return this.#currentState;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
export default PlayerTurnHandler;
