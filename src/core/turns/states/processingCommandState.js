// ===========================================================================
//  src/core/turnStates/processingCommandState.js
// ===========================================================================
/* eslint-disable max-lines */

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../commandProcessor.js').CommandResult} CommandResult
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js';
// States for transitions are imported but not directly used for ITurnContext here
// import {AwaitingPlayerInputState} from './awaitingPlayerInputState.js';
// import {AwaitingExternalTurnEndState} from './awaitingExternalTurnEndState.js';
// import {TurnEndingState} from './turnEndingState.js';


// Constants & strategy resolver
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../constants/eventIds.js';

export class ProcessingCommandState extends AbstractTurnState {
    /** @type {string} */ #commandString;

    /**
     * @param {BaseTurnHandler} handler
     * @param {string} commandString
     */
    constructor(handler, commandString) {
        super(handler); // AbstractTurnState constructor expects BaseTurnHandler
        const turnCtx = this._getTurnContext(); // For logger access during construction if needed
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (typeof commandString !== 'string' || commandString.trim() === '') {
            const msg = `${this.constructor.name}: commandString must be a non-empty string.`;
            logger.error(msg);
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
    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [previousState]
     */
    async enterState(handler, previousState) {
        await super.enterState(handler, previousState); // Logs entry using this._getTurnContext()

        const turnCtx = this._getTurnContext(); // Must exist
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (!turnCtx) {
            logger.error(`${this.getStateName()}: Critical - ITurnContext not available on entry. Transitioning to Idle.`);
            handler._resetTurnStateAndResources(`critical-entry-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const actor = turnCtx.getActor();
        const actorId = actor?.id ?? 'UNKNOWN_ACTOR';

        if (!actor) {
            logger.error(`${this.getStateName()}: No current actor in ITurnContext. Transitioning to TurnIdleState.`);
            // No actorId to pass to _handleTurnEnd, so endTurn on context is not ideal here.
            // Reset resources and transition to Idle directly.
            handler._resetTurnStateAndResources(`no-actor-in-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        // Defensive: Ensure not dangling on an old TURN_ENDED wait.
        // The original code called context._clearTurnEndWaitingMechanisms?.();
        // This was PlayerTurnHandler specific. If this state needs to ensure such flags are
        // cleared, that mechanism would need to be on ITurnContext or BaseTurnHandler.
        // For now, assuming ITurnContext.isAwaitingExternalEvent() and ITurnContext.endTurn() manage this.
        if (turnCtx.isAwaitingExternalEvent()) {
            logger.warn(`${this.getStateName()}: Entered while ITurnContext is still awaiting an external event for actor ${actorId}. This might be unexpected. Proceeding with command processing.`);
            // Consider if turnCtx.endTurn() should be called to clear the previous wait state implicitly.
            // For now, let's assume the new command processing supersedes.
        }

        // Kick off async pipeline
        this._processCommandInternal(handler, turnCtx) // Pass handler for transitions, turnCtx for ops
            .catch(err => this.#handleProcessingException(handler, turnCtx, actorId, err, 'pipeline'));
    }

    // ────────────────────────────────────────────────────────────────────
    //  Centralised error helper
    // ────────────────────────────────────────────────────────────────────
    /**
     * @private
     * @param {BaseTurnHandler} handler
     * @param {ITurnContext | null} turnCtxForErrorLogging - Can be null if error happens before context is fully stable
     * @param {string} actorId
     * @param {Error} error
     * @param {string} [origin='']
     */
    async #handleProcessingException(handler, turnCtxForErrorLogging, actorId, error, origin = '') {
        const logger = turnCtxForErrorLogging ? turnCtxForErrorLogging.getLogger() : handler.getLogger();
        const originTxt = origin ? ` (${origin})` : '';
        logger.error(`${this.getStateName()}: Error for actor ${actorId}${originTxt} – ${error.message}`, error);

        try {
            // Use safeEventDispatcher from turnCtx if available, else from handler (if it has one, unlikely for Base)
            const eventDispatcher = turnCtxForErrorLogging?.getSafeEventDispatcher();
            if (eventDispatcher) {
                await eventDispatcher.dispatchSafely(SYSTEM_ERROR_OCCURRED_ID, {
                    message: error.message,
                    error,
                    actorId: actorId, // Add actorId to event
                });
            } else {
                logger.warn(`${this.getStateName()}: SafeEventDispatcher not available via ITurnContext to dispatch SYSTEM_ERROR_OCCURRED.`);
            }
        } catch (dispatchErr) {
            logger.warn(`${this.getStateName()}: Failed dispatching SYSTEM_ERROR_OCCURRED – ${dispatchErr.message}`, dispatchErr);
        }

        // End the turn via ITurnContext if available, otherwise via handler's _handleTurnEnd
        if (turnCtxForErrorLogging) {
            turnCtxForErrorLogging.endTurn(error);
        } else {
            // This is a fallback if context was lost or not established
            await handler._handleTurnEnd(actorId, error);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Main orchestration
    // ────────────────────────────────────────────────────────────────────
    /**
     * @private
     * @param {BaseTurnHandler} handler
     * @param {ITurnContext} turnCtx - Assumed to be valid and passed in.
     */
    async _processCommandInternal(handler, turnCtx) {
        const actor = turnCtx.getActor(); // Actor from ITurnContext
        // Actor should be guaranteed by enterState checks. If not, it's a critical flow error.
        if (!actor) {
            // This case should ideally not be reached if enterState is robust.
            const errMsg = "Critical: _processCommandInternal called without a valid actor in ITurnContext.";
            turnCtx.getLogger().error(errMsg);
            await this.#handleProcessingException(handler, turnCtx, 'UNKNOWN_ACTOR_PROCESS_INTERNAL', new Error(errMsg), 'actorValidation');
            return;
        }
        const actorId = actor.id;

        let cmdProcResult;
        try {
            const commandProcessor = turnCtx.getCommandProcessor(); // From ITurnContext
            cmdProcResult = await commandProcessor.processCommand(actor, this.#commandString);
        } catch (procErr) {
            await this.#handleProcessingException(handler, turnCtx, actorId, procErr, 'processCommand');
            return;
        }

        // Guard: actor/context mismatch (e.g. if turn ended asynchronously during processing)
        // Re-fetch current context from handler, as it might have changed due to an async operation or error.
        const freshTurnCtx = handler.getTurnContext();
        if (!freshTurnCtx || freshTurnCtx.getActor()?.id !== actorId) {
            const freshActorId = freshTurnCtx?.getActor()?.id ?? 'NONE';
            const mismatchError = new Error(`Turn invalidated during processing. Original actor: ${actorId}, current context actor: ${freshActorId}.`);
            // Log with original context's logger if available, else new context's or handler's.
            const loggerForMismatch = turnCtx.getLogger() || freshTurnCtx?.getLogger() || handler.getLogger();
            loggerForMismatch.warn(mismatchError.message);
            // End the turn for the actorId we started with, using the original turnCtx if it seems most relevant,
            // or freshTurnCtx if it's the only one. This is tricky.
            // Safest is to use the handler's direct _handleTurnEnd
            await handler._handleTurnEnd(actorId, mismatchError);
            return;
        }
        // From here, use freshTurnCtx as it's the most current.
        const currentTurnCtx = freshTurnCtx;

        const handlerFn = cmdProcResult.success ? this._handleProcessorSuccess : this._handleProcessorFailure;
        try {
            // Pass handler for transitions, currentTurnCtx for operations
            await handlerFn.call(this, handler, currentTurnCtx, currentTurnCtx.getActor(), cmdProcResult, this.#commandString);
        } catch (err) {
            await this.#handleProcessingException(handler, currentTurnCtx, actorId, err, 'postProcess');
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Success path – strategy driven
    // ────────────────────────────────────────────────────────────────────
    /**
     * @private
     * @param {BaseTurnHandler} handler
     * @param {ITurnContext} turnCtx
     * @param {Entity} actor
     * @param {CommandResult} cmdProcResult
     * @param {string} commandString
     */
    async _handleProcessorSuccess(handler, turnCtx, actor, cmdProcResult, commandString) {
        const outcomeInterpreter = turnCtx.getCommandOutcomeInterpreter(); // From ITurnContext
        const directive = await outcomeInterpreter.interpret(actor, cmdProcResult, commandString);

        // TurnDirectiveStrategyResolver is static, doesn't need context.
        // Strategy's execute method will need ITurnContext.
        const dirType = (directive && typeof directive === 'object') ? directive.type : directive;
        const strategy = TurnDirectiveStrategyResolver.resolveStrategy(dirType);

        // Execute strategy: pass ITurnContext
        await strategy.execute(turnCtx, actor, dirType, cmdProcResult);
        turnCtx.getLogger().debug(`${this.getStateName()}: ${strategy.constructor.name} executed for actor ${actor.id} using ITurnContext.`);
    }

    // ────────────────────────────────────────────────────────────────────
    //  Failure path – mirrors success logic
    // ────────────────────────────────────────────────────────────────────
    /**
     * @private
     * @param {BaseTurnHandler} handler
     * @param {ITurnContext} turnCtx
     * @param {Entity} actor
     * @param {CommandResult} cmdProcResult
     * @param {string} commandString
     */
    async _handleProcessorFailure(handler, turnCtx, actor, cmdProcResult, commandString) {
        if (cmdProcResult.turnEnded === true) { // Legacy behavior check
            const err = cmdProcResult.error instanceof Error
                ? cmdProcResult.error
                : new Error(cmdProcResult.message || `Command failed for ${actor.id}.`);
            turnCtx.getLogger().warn(`${this.getStateName()}: CommandProcessor indicated turn ended for ${actor.id}. Ending turn via context.`);
            turnCtx.endTurn(err); // End turn via ITurnContext
            return; // Strategy execution is skipped
        }

        const outcomeInterpreter = turnCtx.getCommandOutcomeInterpreter(); // From ITurnContext
        const directive = await outcomeInterpreter.interpret(actor, cmdProcResult, commandString);

        const dirType = (directive && typeof directive === 'object') ? directive.type : directive;
        const strategy = TurnDirectiveStrategyResolver.resolveStrategy(dirType);

        // Execute strategy: pass ITurnContext
        await strategy.execute(turnCtx, actor, dirType, cmdProcResult);
        turnCtx.getLogger().debug(`${this.getStateName()}: ${strategy.constructor.name} executed for actor ${actor.id} (failure path) using ITurnContext.`);
    }

    // ────────────────────────────────────────────────────────────────────
    //  State life-cycle – exit & destroy
    // ────────────────────────────────────────────────────────────────────
    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        // AbstractTurnState.exitState uses this._getTurnContext() for actorId in log.
        await super.exitState(handler, nextState);
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     */
    async destroy(handler) {
        const turnCtx = this._getTurnContext(); // Get context before it might be cleared
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_destroy';

        logger.warn(`${this.getStateName()}: Handler destroyed while processing command "${this.#commandString}" for ${actorId}.`);

        if (turnCtx && turnCtx.getActor()) { // Check if a turn was actively being processed
            logger.debug(`${this.getStateName()}: Notifying turn end for ${actorId} due to destruction via ITurnContext.`);
            turnCtx.endTurn(new Error(`Handler destroyed during command processing for ${actorId}.`));
        } else {
            logger.warn(`${this.getStateName()}: Handler destroyed, but no active ITurnContext/actor. No specific turn to end.`);
        }
        await super.destroy(handler); // Logs from AbstractTurnState
        logger.debug(`${this.getStateName()}: Destroy handling for ${actorId} complete.`);
    }

    // Disallowed external calls (rely on AbstractTurnState defaults)
    // async startTurn(handler, actorEntity) { return super.startTurn(handler, actorEntity); }
    // async handleSubmittedCommand(handler, cmdString, actorEntity) { return super.handleSubmittedCommand(handler, cmdString, actorEntity); }
    // async handleTurnEndedEvent(handler, payload) { return super.handleTurnEndedEvent(handler, payload); }
    // async processCommandResult(handler, actor, cmdProcResult, commandString) { /* This state's purpose */ }
    // async handleDirective(handler, actor, directive, cmdProcResult) { /* This state's purpose */ }
}

/* eslint-enable max-lines */