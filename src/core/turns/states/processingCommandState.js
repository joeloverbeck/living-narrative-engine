// ===========================================================================
//  src/core/turnStates/processingCommandState.js
// ===========================================================================
/* eslint-disable max-lines */

/**
 *  ProcessingCommandState – PTH-STATE-006  (REFactored for PTH-COMPLEX-001)
 *  Handles execution of a submitted command and dispatches a TurnDirective
 *  strategy.  Error-handling has been centralised to reduce repetition and
 *  make the main algorithm easier to read.
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {AwaitingPlayerInputState} from './awaitingPlayerInputState.js';
import {AwaitingExternalTurnEndState} from './awaitingExternalTurnEndState.js';
import {TurnEndingState} from './turnEndingState.js';
import {TurnIdleState} from './turnIdleState.js';

// Constants & strategy resolver -------------------------------------------
import TurnDirectiveStrategyResolver from '../../turns/strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../constants/eventIds.js';

export class ProcessingCommandState extends AbstractTurnState {
    /** @type {string} */ #commandString;

    /**
     * @param {import('../handlers/playerTurnHandler.js').default} context
     * @param {string}                                              commandString
     */
    constructor(context, commandString) {
        super(context);
        if (typeof commandString !== 'string' || commandString.trim() === '') {
            const msg = `${this.constructor.name}: commandString must be a non-empty string.`;
            context.logger.error(msg);
            throw new Error(msg);
        }
        this.#commandString = commandString;
    }

    /** @returns {string} */
    getStateName() {
        return 'ProcessingCommandState';
    }

    // ────────────────────────────────────────────────────────────────────
    //  State life-cycle – enter
    // ────────────────────────────────────────────────────────────────────
    async enterState(context, previousState) {
        const actor = context.getCurrentActor();
        const actorId = actor?.id ?? 'UNKNOWN_ACTOR';
        const prevStateName = previousState?.getStateName() ?? 'None';

        context.logger.info(`${this.getStateName()}: Entered for actor ${actorId}. Command: "${this.#commandString}". Prev: ${prevStateName}.`);

        if (!actor) {
            context.logger.error(`${this.getStateName()}: No current actor. Transitioning to TurnIdleState.`);
            await context._transitionToState(new TurnIdleState(context));
            return;
        }

        // Defensive – ensure we are not dangling on an old TURN_ENDED wait.
        context._clearTurnEndWaitingMechanisms?.();

        // Kick off the async pipeline *without* awaiting it – any error is
        // funnelled through #handleProcessingException.
        this._processCommandInternal(context)
            .catch(err => this.#handleProcessingException(context, actorId, err, 'pipeline'));
    }

    // ────────────────────────────────────────────────────────────────────
    //  Centralised error helper
    // ────────────────────────────────────────────────────────────────────
    /** @private */
    async #handleProcessingException(context, actorId, error, origin = '') {
        const originTxt = origin ? ` (${origin})` : '';
        context.logger.error(`${this.getStateName()}: Error${originTxt} – ${error.message}`, error);

        // Best-effort broadcast for external monitoring.
        try {
            await context.safeEventDispatcher.dispatchSafely(SYSTEM_ERROR_OCCURRED_ID, {
                message: error.message,
                error
            });
        } catch (dispatchErr) {
            context.logger.warn(`${this.getStateName()}: Failed dispatching SYSTEM_ERROR_OCCURRED – ${dispatchErr.message}`, dispatchErr);
        }

        // Delegate to the canonical turn-end path.
        await context._handleTurnEnd(actorId, error);
    }

    // ────────────────────────────────────────────────────────────────────
    //  Main orchestration
    // ────────────────────────────────────────────────────────────────────
    /** @private */
    async _processCommandInternal(context) {
        const actor = context.getCurrentActor();
        if (!actor) {
            await context._transitionToState(new TurnIdleState(context));
            return;
        }
        const actorId = actor.id;

        // ---------------- Process command -----------------------------
        let cmdProcResult;
        try {
            cmdProcResult = await context.commandProcessor.processCommand(actor, this.#commandString);
        } catch (procErr) {
            await this.#handleProcessingException(context, actorId, procErr, 'processCommand');
            return;
        }

        // ---------------- Guard: actor/context mismatch ---------------
        if (!context.getCurrentActor() || context.getCurrentActor().id !== actorId) {
            await this.#handleProcessingException(context, actorId, new Error('Turn invalidated during processing.'), 'actorMismatch');
            return;
        }

        // ---------------- Route by success flag -----------------------
        const handler = cmdProcResult.success ? this._handleProcessorSuccess : this._handleProcessorFailure;
        try {
            await handler.call(this, context, actor, cmdProcResult, this.#commandString);
        } catch (err) {
            // Any uncaught exception below propagates up to here – one place to handle.
            await this.#handleProcessingException(context, actorId, err, 'postProcess');
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Success path – strategy driven
    // ────────────────────────────────────────────────────────────────────
    /** @private */
    async _handleProcessorSuccess(context, actor, cmdProcResult, commandString) {
        // Let any error bubble straight up – centralized handler will catch it.
        const directive = await context.commandOutcomeInterpreter.interpret(actor, cmdProcResult, commandString);
        const dirType = (directive && typeof directive === 'object') ? directive.type : directive;
        const strategy = TurnDirectiveStrategyResolver.resolveStrategy(dirType);
        await strategy.execute(context, actor, dirType, cmdProcResult);
        context.logger.debug(`${this.getStateName()}: ${strategy.constructor.name} executed for actor ${actor.id}.`);
    }

    // ────────────────────────────────────────────────────────────────────
    //  Failure path – mirrors success logic
    // ────────────────────────────────────────────────────────────────────
    /** @private */
    async _handleProcessorFailure(context, actor, cmdProcResult, commandString) {
        // Early-exit: processor decided turn already over (legacy behaviour)
        if (cmdProcResult.turnEnded === true) {
            const err = cmdProcResult.error instanceof Error
                ? cmdProcResult.error
                : new Error(cmdProcResult.message || 'Command failed.');
            throw err; // propagate – will be caught by wrapper
        }

        const directive = await context.commandOutcomeInterpreter.interpret(actor, cmdProcResult, commandString);
        const dirType = (directive && typeof directive === 'object') ? directive.type : directive;
        const strategy = TurnDirectiveStrategyResolver.resolveStrategy(dirType);
        await strategy.execute(context, actor, dirType, cmdProcResult);
        context.logger.debug(`${this.getStateName()}: ${strategy.constructor.name} executed for actor ${actor.id}.`);
    }

    // ────────────────────────────────────────────────────────────────────
    //  State life-cycle – exit & destroy (unchanged)
    // ────────────────────────────────────────────────────────────────────
    async exitState(context, nextState) {
        context.logger.info(`${this.getStateName()}: Exiting for ${context.getCurrentActor()?.id ?? 'N/A'} → ${nextState?.getStateName() ?? 'None'}.`);
    }

    async destroy(context) {
        const actorId = context.getCurrentActor()?.id ?? 'N/A_destroy';
        context.logger.warn(`${this.getStateName()}: PTH destroyed while processing command "${this.#commandString}" for ${actorId}.`);
        if (context.getCurrentActor()) {
            await context._handleTurnEnd(actorId, new Error('Handler destroyed during processing.'));
        }
    }

    // Disallowed external calls ------------------------------------------------
    async startTurn(context, actor) {
        return super.startTurn(context, actor);
    }

    async handleSubmittedCommand(context, cmd) {
        return super.handleSubmittedCommand(context, cmd);
    }

    async handleTurnEndedEvent(context, payload) {
        return super.handleTurnEndedEvent(context, payload);
    }

    async processCommandResult(...args) {
        return super.processCommandResult(...args);
    }

    async handleDirective(...args) {
        return super.handleDirective(...args);
    }
}

/* eslint-enable max-lines */