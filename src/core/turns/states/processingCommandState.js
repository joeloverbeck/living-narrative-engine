// src/core/turns/states/processingCommandState.js

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js';
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../constants/eventIds.js';

export class ProcessingCommandState extends AbstractTurnState {
    _commandString;
    _isProcessing = false;

    constructor(handler, commandString, turnAction = null) {
        super(handler);
        this._commandString = commandString;
        this._isProcessing = false;
    }

    async enterState(handler, previousState) {
        this._isProcessing = true;
        const turnCtx = this._getTurnContext();

        if (!turnCtx) {
            const logger = handler?.getLogger() ?? this._handler?.getLogger() ?? console;
            logger.error(`${this.getStateName()}: Turn context is null on enter. Attempting to reset and idle.`);
            const resetHandler = (handler && typeof handler._resetTurnStateAndResources === 'function' && typeof handler._transitionToState === 'function')
                ? handler : this._handler;
            if (resetHandler && typeof resetHandler._resetTurnStateAndResources === 'function' && typeof resetHandler._transitionToState === 'function') {
                resetHandler._resetTurnStateAndResources(`null-context-${this.getStateName()}`);
                await resetHandler._transitionToState(new TurnIdleState(resetHandler));
            }
            this._isProcessing = false;
            return;
        }

        await super.enterState(handler, previousState);
        const actor = turnCtx.getActor();
        if (!actor) {
            const noActorError = new Error('No actor present at the start of command processing.');
            this._isProcessing = false;
            await this.#handleProcessingException(turnCtx, noActorError, 'NoActorOnEnter');
            return;
        }

        const logger = turnCtx.getLogger();
        logger.debug(`${this.getStateName()}: Entering with command: "${this._commandString}" for actor: ${actor.getId()}`);

        (async () => {
            try {
                await this._processCommandInternal(turnCtx, actor, this._commandString);
            } catch (error) {
                const currentTurnCtx = this._getTurnContext();
                const errorLogger = currentTurnCtx?.getLogger() ?? logger;
                errorLogger.error(`${this.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`, error);
                await this.#handleProcessingException(currentTurnCtx ?? turnCtx, error, actor?.getId());
            } finally {
                this._isProcessing = false;
            }
        })();
    }

    async exitState(handler, nextState) {
        this._isProcessing = false;
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? handler?.getLogger() ?? this._handler?.getLogger() ?? console;
        const actorId = turnCtx?.getActor()?.getId() ?? 'N/A_on_exit';
        logger.debug(`${this.getStateName()}: Exiting for actor: ${actorId}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);
        await super.exitState(handler, nextState);
    }

    async destroy(handler) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? handler?.getLogger() ?? this._handler?.getLogger() ?? console;
        const actorId = turnCtx?.getActor()?.getId() ?? 'N/A_at_destroy';
        logger.debug(`${this.getStateName()}: Destroying for actor: ${actorId}. Current _isProcessing: ${this._isProcessing}`);
        if (this._isProcessing && turnCtx && typeof turnCtx.endTurn === 'function' && turnCtx.getActor()) {
            logger.warn(`${this.getStateName()}: Destroyed during active processing for actor ${actorId}. Ending turn.`);
            this._isProcessing = false;
            await turnCtx.endTurn(new Error(`Command processing for ${actorId} was destroyed mid-operation.`));
        }
        this._isProcessing = false;
        await super.destroy(handler);
        logger.debug(`${this.getStateName()}: Destroy handling for ${actorId} complete.`);
    }

    getStateName() {
        return "ProcessingCommandState";
    }

    async _processCommandInternal(turnCtx, actor, commandString) {
        const logger = turnCtx.getLogger();
        logger.info(`${this.getStateName()}: Processing command "${commandString}" for actor ${actor.getId()}`);
        try {
            let currentTurnCtx = this._getTurnContext();
            let ctxActor = currentTurnCtx?.getActor();
            if (!currentTurnCtx || !ctxActor || ctxActor.getId() !== actor.getId()) {
                logger.warn(`${this.getStateName()}: Turn context invalidated or actor changed mid-processing for ${actor.getId()}. Original turn (if context still valid) will be ended.`);
                const originalActorInOriginalCtx = turnCtx?.getActor();
                if (turnCtx && typeof turnCtx.endTurn === 'function' && originalActorInOriginalCtx?.getId() === actor.getId()) {
                    this._isProcessing = false;
                    await turnCtx.endTurn(new Error(`Actor context became invalid during command processing for ${actor.getId()}.`));
                }
                return;
            }
            const commandProcessor = turnCtx.getCommandProcessor();
            const processingResult = await commandProcessor.process(turnCtx, actor, commandString);
            currentTurnCtx = this._getTurnContext();
            ctxActor = currentTurnCtx?.getActor();
            if (!currentTurnCtx || !ctxActor || ctxActor.getId() !== actor.getId()) {
                logger.warn(`${this.getStateName()}: Turn context invalidated or actor changed post-command-processing for ${actor.getId()}. Original turn ending.`);
                const originalActorInOriginalCtx = turnCtx?.getActor();
                if (turnCtx && typeof turnCtx.endTurn === 'function' && originalActorInOriginalCtx?.getId() === actor.getId()) {
                    this._isProcessing = false;
                    await turnCtx.endTurn(new Error(`Actor context became invalid after command processing for ${actor.getId()}.`));
                }
                return;
            }
            const activeCtx = currentTurnCtx;
            const outcomeInterpreter = activeCtx.getCommandOutcomeInterpreter();
            const directiveType = outcomeInterpreter.interpret(processingResult);
            logger.debug(`${this.getStateName()}: Command processing for "${commandString}" (actor ${actor.getId()}) resulted in directive: ${directiveType}`);
            const strategy = TurnDirectiveStrategyResolver.resolveStrategy(directiveType);
            if (!strategy) {
                throw new Error(`${this.getStateName()}: No ITurnDirectiveStrategy found for directive: ${directiveType} (actor ${actor.getId()})`);
            }
            if (processingResult.success) {
                await this._handleProcessorSuccess(activeCtx, actor, directiveType, strategy, processingResult);
            } else {
                await this._handleProcessorFailure(activeCtx, actor, directiveType, strategy, processingResult);
            }
        } catch (error) {
            const errorHandlingCtx = this._getTurnContext() || turnCtx;
            await this.#handleProcessingException(errorHandlingCtx, error, actor?.getId());
        }
    }

    async _handleProcessorSuccess(turnCtx, actor, directiveType, strategy, cmdProcResult) {
        const logger = turnCtx.getLogger();
        logger.debug(`${this.getStateName()}: Handling successful command processing for actor ${actor.getId()}. Strategy: ${strategy.constructor.name}, Directive: ${directiveType}`);
        await strategy.execute(turnCtx, actor, directiveType, cmdProcResult);
    }

    async _handleProcessorFailure(turnCtx, actor, directiveType, strategy, cmdProcResult) {
        const logger = turnCtx.getLogger();
        logger.warn(`${this.getStateName()}: Handling failed command processing for actor ${actor.getId()}. Strategy: ${strategy.constructor.name}, Directive: ${directiveType}, Error: ${cmdProcResult.error}`);
        await strategy.execute(turnCtx, actor, directiveType, cmdProcResult);
    }

    async #handleProcessingException(turnCtx, error, actorIdFromCaller = 'UnknownActor') {
        const resolvedActorIdFromCaller = actorIdFromCaller || 'UnknownActor';
        if (!turnCtx || typeof turnCtx.getLogger !== 'function' || typeof turnCtx.getSafeEventDispatcher !== 'function' || typeof turnCtx.endTurn !== 'function') {
            console.error(`${this.getStateName()}: Critical error - Invalid turn context during exception handling for actor ${resolvedActorIdFromCaller}. Cannot dispatch event or end turn properly. Error:`, error);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                this._handler._resetTurnStateAndResources(`critical-exception-no-context-${this.getStateName()}`);
                await this._handler._transitionToState(new TurnIdleState(this._handler));
            }
            return;
        }

        const logger = turnCtx.getLogger();
        // Get actor ID from context if possible for the main log, otherwise use the (resolved) passed one.
        // This initial fetch is primarily for logging the error source.
        const initialActorForLog = turnCtx.getActor();
        const currentActorIdForLog = initialActorForLog?.getId() ?? resolvedActorIdFromCaller;
        logger.error(`${this.getStateName()}: Error during command processing for actor ${currentActorIdForLog}: ${error.message}`, error);

        const eventDispatcher = turnCtx.getSafeEventDispatcher();
        if (!eventDispatcher) {
            logger.warn(`${this.getStateName()}: ISafeEventDispatcher not available from ITurnContext for actor ${currentActorIdForLog}. Cannot dispatch SYSTEM_ERROR_OCCURRED_ID.`);
        } else {
            try {
                await eventDispatcher.dispatchSafely(SYSTEM_ERROR_OCCURRED_ID, {
                    error: error,
                    message: `System error during command processing for actor ${currentActorIdForLog}: ${error.message}`,
                    actorId: currentActorIdForLog,
                    turnState: this.getStateName(),
                });
            } catch (dispatchError) {
                logger.error(`${this.getStateName()}: Failed to dispatch system error event for actor ${currentActorIdForLog}: ${dispatchError.message}`, dispatchError);
            }
        }

        // Re-fetch actor from context *immediately before* deciding to call endTurn or fallback.
        // This ensures we use the most current state of the actor in the context.
        const actorForEndTurnCheck = turnCtx.getActor();
        if (actorForEndTurnCheck) {
            await turnCtx.endTurn(error);
        } else {
            // Use currentActorIdForLog which reflects the actor associated with the error, even if now absent from context
            logger.warn(`${this.getStateName()}: Turn context actor became invalid before explicit turn end in exception handler for intended actor ${currentActorIdForLog}. Attempting handler reset if possible.`);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                this._handler._resetTurnStateAndResources(`exception-invalid-actor-context-${this.getStateName()}`);
                await this._handler._transitionToState(new TurnIdleState(this._handler));
            }
        }
    }
}