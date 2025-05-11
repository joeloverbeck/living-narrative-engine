// src/core/turns/states/processingCommandState.js

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../commands/commandProcessor.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../states/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('../strategies/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js'; // For error recovery
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../constants/eventIds.js';

/**
 * @class ProcessingCommandState
 * @extends {AbstractTurnState}
 * @description
 * This state is responsible for retrieving an ITurnAction from the ITurnContext,
 * processing it using the ICommandProcessor, interpreting the outcome, and then
 * executing an appropriate ITurnDirectiveStrategy to guide the turn flow.
 * It is entered after AwaitingPlayerInputState successfully obtains an ITurnAction.
 */
export class ProcessingCommandState extends AbstractTurnState {
    /**
     * Flag to indicate if processing is currently active.
     * Helps prevent re-entrant calls or race conditions.
     * @private
     * @type {boolean}
     */
    _isProcessing = false;

    /**
     * The ITurnAction to be processed. This is now primarily retrieved from context,
     * but constructor parameter remains for flexibility if AwaitingPlayerInputState passes it directly
     * during transition. The context is the preferred source.
     * @private
     * @type {ITurnAction | null}
     */
    #turnActionToProcess = null;

    /**
     * Stores the original command string, primarily for logging or fallback if ITurnAction is minimal.
     * If an ITurnAction is provided and has a `commandString`, that should take precedence for logging.
     * @private
     * @type {string | null}
     */
    #commandStringForLog = null;


    /**
     * Creates an instance of ProcessingCommandState.
     * The `commandString` and `turnAction` parameters are largely legacy or for specific transition scenarios.
     * The state will primarily rely on `ITurnContext.getChosenAction()` to retrieve the `ITurnAction`.
     *
     * @param {BaseTurnHandler} handler - The turn handler managing this state.
     * @param {string} [commandString] - Optional: The raw command string (legacy, for logging, or if ITurnAction is not yet fully adopted).
     * If provided, it's mainly for logging if the ITurnAction itself doesn't contain it or is null.
     * @param {ITurnAction} [turnAction=null] - Optional: The ITurnAction passed directly, typically from AwaitingPlayerInputState.
     * If null, it will be fetched from ITurnContext.
     */
    constructor(handler, commandString, turnAction = null) {
        super(handler); // Calls AbstractTurnState constructor
        this._isProcessing = false;

        this.#turnActionToProcess = turnAction;
        this.#commandStringForLog = commandString || turnAction?.commandString || null;

        const logger = this._handler?.getLogger() ?? console;
        logger.debug(`${this.getStateName()} constructed. Command string (arg): "${this.#commandStringForLog}". TurnAction ID (arg): ${turnAction ? `"${turnAction.actionDefinitionId}"` : 'null'}`);
    }

    /** @override */
    getStateName() {
        return "ProcessingCommandState";
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [previousState]
     */
    async enterState(handler, previousState) {
        const turnCtx = this._getTurnContext();

        if (this._isProcessing) {
            const logger = turnCtx?.getLogger() ?? this._handler.getLogger();
            logger.warn(`${this.getStateName()}: enterState called while already processing. Actor: ${turnCtx?.getActor()?.id ?? 'N/A'}. Aborting re-entry.`);
            return;
        }
        this._isProcessing = true;

        await super.enterState(this._handler, previousState);
        const logger = turnCtx ? turnCtx.getLogger() : this._handler.getLogger();

        if (!turnCtx) {
            logger.error('ProcessingCommandState: Turn context is null on enter. Attempting to reset and idle.');
            this._handler._resetTurnStateAndResources(`critical-no-context-${this.getStateName()}`);
            await this._handler._transitionToState(new TurnIdleState(this._handler));
            this._isProcessing = false;
            return;
        }

        const actor = turnCtx.getActor();
        if (!actor) {
            const noActorError = new Error('No actor present at the start of command processing.');
            await this.#handleProcessingException(turnCtx, noActorError, 'NoActorOnEnter');
            // #handleProcessingException now sets _isProcessing = false
            return;
        }

        const actorId = actor.id;
        logger.info(`${this.getStateName()}: Entered for actor ${actorId}.`);
        logger.debug(`${this.getStateName()}: Entering with command: "${this.#commandStringForLog}" for actor: ${actorId}`);

        let turnAction = this.#turnActionToProcess;
        if (!turnAction) {
            logger.debug(`${this.getStateName()}: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actorId}.`);
            try {
                turnAction = turnCtx.getChosenAction();
            } catch (e) {
                const errorMsg = `${this.getStateName()}: Error retrieving ITurnAction from context for actor ${actorId}: ${e.message}`;
                logger.error(errorMsg, e);
                await this.#handleProcessingException(turnCtx, new Error(errorMsg, {cause: e}), actorId);
                return;
            }
        }

        if (!turnAction) {
            const errorMsg = `${this.getStateName()}: No ITurnAction available (neither from constructor nor context.getChosenAction()) for actor ${actorId}. Cannot process command.`;
            logger.error(errorMsg);
            await this.#handleProcessingException(turnCtx, new Error(errorMsg), actorId);
            return;
        }

        if (typeof turnAction.actionDefinitionId !== 'string' || !turnAction.actionDefinitionId) {
            const errorMsg = `${this.getStateName()}: ITurnAction for actor ${actorId} is invalid: missing or empty actionDefinitionId.`;
            logger.error(errorMsg, {receivedAction: turnAction});
            await this.#handleProcessingException(turnCtx, new Error(errorMsg), actorId);
            return;
        }

        const commandStringToLog = turnAction.commandString || this.#commandStringForLog || '(no command string available)';
        logger.info(
            `${this.getStateName()}: Actor ${actorId} processing action. ` +
            `ID: "${turnAction.actionDefinitionId}". ` +
            `Params: ${JSON.stringify(turnAction.resolvedParameters || {})}. ` +
            `CommandString: "${commandStringToLog}".`
        );

        this.#turnActionToProcess = turnAction;

        // SUT CHANGE: Removed await from IIFE
        (async () => {
            try {
                await this._processCommandInternal(turnCtx, actor, this.#turnActionToProcess);
            } catch (error) {
                const currentTurnCtxForCatch = this._getTurnContext() ?? turnCtx;
                const errorLogger = currentTurnCtxForCatch.getLogger?.() ?? logger;
                errorLogger.error(
                    `${this.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
                    error
                );
                // Pass the original actorId if context changed or actor is gone from context
                const actorIdForHandler = currentTurnCtxForCatch.getActor?.()?.id ?? actorId;
                await this.#handleProcessingException(currentTurnCtxForCatch, error, actorIdForHandler);
            }
        })();
    }

    async _processCommandInternal(turnCtx, actor, turnAction) {
        const logger = turnCtx.getLogger();
        const actorId = actor.id;

        try {
            // SUT CHANGE: Added await
            const commandProcessor = await this._getServiceFromContext(turnCtx, 'getCommandProcessor', 'ICommandProcessor', actorId);
            if (!commandProcessor) {
                // _getServiceFromContext already called #handleProcessingException which sets _isProcessing = false
                // and it also logs the error. So we just return here.
                return;
            }

            if (turnAction && typeof turnAction.actionDefinitionId !== 'undefined') {
                logger.debug(`${this.getStateName()}: Invoking commandProcessor.process() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}`);
            } else {
                // This scenario should ideally be caught earlier (e.g., in enterState),
                // but adding a warning here for robustness if an invalid turnAction somehow reaches this point.
                logger.warn(`${this.getStateName()}: Invoking commandProcessor.process() for actor ${actorId} with invalid or minimal turnAction object: ${JSON.stringify(turnAction)}.`);
                // Consider if this should be a hard error / call #handleProcessingException
            }
            const commandResult = await commandProcessor.process(turnCtx, actor, turnAction);

            const activeTurnCtx = this._getTurnContext();
            if (!activeTurnCtx || activeTurnCtx.getActor()?.id !== actorId) {
                logger.warn(`${this.getStateName()}: Context or actor changed/invalidated after commandProcessor.process() for ${actorId}. Aborting further processing for this turn.`);
                if (turnCtx.getActor()?.id === actorId && turnCtx.isValid?.()) { // Check if original context is still valid for this actor
                    await this.#handleProcessingException(turnCtx, new Error("Context changed or actor mismatch after command processing."), actorId, false);
                } else if (activeTurnCtx && activeTurnCtx.getActor()?.id) {
                    logger.warn(`${this.getStateName()}: A new turn seems active for ${activeTurnCtx.getActor().id}. The turn for ${actorId} will not be explicitly ended by this path.`);
                } else {
                    logger.warn(`${this.getStateName()}: No active context or actor mismatch after commandProcessor.process() for ${actorId}. Turn cannot be formally ended by this path.`);
                    // If the original context is no longer valid for the actor, or no handler available, we might be stuck
                    // This situation might require a more global reset if the handler itself is compromised.
                    // For now, ensure _isProcessing is false if we can't gracefully handle.
                }
                this._isProcessing = false; // Ensure processing stops
                return;
            }

            logger.debug(`${this.getStateName()}: Command processing completed for actor ${actorId}. Result success: ${commandResult?.success}.`);

            // SUT CHANGE: Added await
            const outcomeInterpreter = await this._getServiceFromContext(activeTurnCtx, 'getCommandOutcomeInterpreter', 'ICommandOutcomeInterpreter', actorId);
            if (!outcomeInterpreter) {
                // _getServiceFromContext already called #handleProcessingException which sets _isProcessing = false
                return;
            }

            const directiveType = outcomeInterpreter.interpret(commandResult);
            logger.info(`${this.getStateName()}: Actor ${actorId} - Command result interpreted to directive: ${directiveType}`);

            const directiveStrategy = TurnDirectiveStrategyResolver.resolveStrategy(directiveType);
            if (!directiveStrategy) {
                const errorMsg = `${this.getStateName()}: Could not resolve ITurnDirectiveStrategy for directive '${directiveType}' (actor ${actorId}).`;
                logger.error(errorMsg);
                await this.#handleProcessingException(activeTurnCtx, new Error(errorMsg), actorId);
                return;
            }
            logger.debug(`${this.getStateName()}: Actor ${actorId} - Resolved strategy ${directiveStrategy.constructor.name} for directive ${directiveType}.`);

            await directiveStrategy.execute(activeTurnCtx, directiveType, commandResult);
            logger.debug(`${this.getStateName()}: Actor ${actorId} - Directive strategy ${directiveStrategy.constructor.name} executed.`);

            // If the state is still this one and processing was ongoing, mark as no longer processing.
            // A directive strategy might have initiated a transition, in which case _handler._currentState would be different.
            if (this._isProcessing && this._handler._currentState === this) {
                logger.debug(`${this.getStateName()}: Directive strategy executed for ${actorId}, state remains ${this.getStateName()}. Processing complete for this command.`);
                this._isProcessing = false;
            }

        } catch (error) {
            // Ensure we use the most current context if available, otherwise fallback to the one passed initially.
            const errorHandlingCtx = this._getTurnContext() ?? turnCtx;
            // If actor is gone from context, use the original actorId.
            const actorIdForHandler = errorHandlingCtx.getActor?.()?.id ?? actorId;
            await this.#handleProcessingException(errorHandlingCtx, error, actorIdForHandler);
        } finally { // Add finally block to ensure _isProcessing is set to false
            if (this._isProcessing) {
                // This case means an error occurred, or processing completed without explicitly setting _isProcessing to false,
                // and it wasn't caught and handled by #handleProcessingException setting it.
                // Or a path in try didn't set it to false before exiting (e.g. early return after _getServiceFromContext failure).
                const finalLogger = this._getTurnContext()?.getLogger() ?? logger;
                finalLogger.warn(`${this.getStateName()}: _isProcessing was still true at the end of _processCommandInternal for ${actorId}. Forcing false.`);
                this._isProcessing = false;
            }
        }
    }

    async _getServiceFromContext(turnCtx, methodName, serviceNameForLog, actorIdForLog) {
        // Ensure turnCtx is valid and has getLogger before proceeding.
        if (!turnCtx || typeof turnCtx.getLogger !== 'function') {
            console.error(`${this.getStateName()}: Invalid turnCtx in _getServiceFromContext when trying to get ${serviceNameForLog} for actor ${actorIdForLog}. Cannot get logger or service.`);
            // Cannot call #handleProcessingException as we can't even get a logger reliably from turnCtx.
            // This is a critical failure. The calling method needs to handle the null return.
            // Setting _isProcessing to false here might be risky if not coordinated with caller.
            // Caller should check for null and then call #handleProcessingException with a last-known-good context or handler's context.
            return null;
        }
        const logger = turnCtx.getLogger();
        try {
            if (typeof turnCtx[methodName] !== 'function') {
                throw new Error(`Method turnCtx.${methodName}() does not exist or is not a function.`);
            }
            const service = turnCtx[methodName]();
            if (!service) {
                // Log this specific failure but let #handleProcessingException decide on broader turn implications
                throw new Error(`Method turnCtx.${methodName}() returned null or undefined.`);
            }
            return service;
        } catch (error) {
            const errorMsg = `${this.getStateName()}: Failed to retrieve ${serviceNameForLog} from ITurnContext for actor ${actorIdForLog}. Error: ${error.message}`;
            logger.error(errorMsg, error);
            // Use the provided turnCtx for handling this specific service retrieval failure
            await this.#handleProcessingException(turnCtx, new Error(errorMsg, {cause: error}), actorIdForLog);
            return null;
        }
    }

    async #handleProcessingException(turnCtx, error, actorIdContext = 'UnknownActor', shouldEndTurn = true) {
        if (!turnCtx || typeof turnCtx.getLogger !== 'function' || typeof turnCtx.getSafeEventDispatcher !== 'function' /* consider adding getActor, endTurn for more robustness */) {
            console.error(
                `${this.getStateName()}: Critical error - Invalid turn context during exception handling for actor ${actorIdContext}. Cannot dispatch event or end turn properly. Error:`,
                error
            );
            this._isProcessing = false; // Ensure processing stops
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                console.warn(`${this.getStateName()}: Attempting to reset handler due to critical context failure during exception handling for ${actorIdContext}.`);
                await this._handler._resetTurnStateAndResources(`critical-exception-handling-context-${this.getStateName()}`);
                await this._handler._transitionToState(new TurnIdleState(this._handler));
            } else {
                console.error(`${this.getStateName()}: CRITICAL - Handler is also unavailable or broken. Cannot reset or transition for ${actorIdContext}. System may be unstable.`);
            }
            return;
        }

        // If we've reached here, turnCtx is somewhat valid (has getLogger, getSafeEventDispatcher).
        // const isProcessingOriginalValue = this._isProcessing; // Not strictly needed here anymore
        this._isProcessing = false; // Always set to false when an exception is handled by this method.

        let logger = console; // Fallback
        let currentActorIdForLog = actorIdContext; // Use passed actorIdContext as default

        try {
            logger = turnCtx.getLogger(); // Should be safe due to check above
            const contextActor = turnCtx.getActor?.(); // getActor might be missing or return null
            if (contextActor && typeof contextActor.id === 'string' && contextActor.id) { // Ensure actor and ID are valid
                currentActorIdForLog = contextActor.id;
            } else if (actorIdContext === 'UnknownActor' || !actorIdContext) {
                // If contextActor is invalid and actorIdContext was also bad, log it.
                logger.warn(`${this.getStateName()} (#handleProcessingException): Actor ID is unknown or invalid from both context and argument.`);
                currentActorIdForLog = 'UnknownOrInvalidActor';
            }
            // else, currentActorIdForLog remains actorIdContext passed in
        } catch (e) {
            // This catch is if getLogger() or getActor() themselves throw an unexpected error
            // despite initial checks. Should be rare.
            console.error(`${this.getStateName()} (#handleProcessingException): Error obtaining logger/actor from turnCtx. Actor context: ${actorIdContext}. Error: ${e.message}`, e);
            logger = console; // Revert to console if logger acquisition failed
            // currentActorIdForLog will be actorIdContext or the default 'UnknownActor'
        }

        logger.error(
            `${this.getStateName()}: Error during command processing for actor ${currentActorIdForLog}: ${error.message}`,
            error
        );

        try {
            const eventDispatcher = turnCtx.getSafeEventDispatcher(); // Should be safe due to check above
            if (eventDispatcher && typeof eventDispatcher.dispatchSafely === 'function') {
                await eventDispatcher.dispatchSafely(SYSTEM_ERROR_OCCURRED_ID, {
                    error: error,
                    message: `System error during command processing for actor ${currentActorIdForLog}: ${error.message}`,
                    actorId: currentActorIdForLog,
                    turnState: this.getStateName(),
                });
            } else {
                // Log warning if dispatcher is missing or dispatchSafely is not a function
                logger.warn(
                    `${this.getStateName()}: SafeEventDispatcher service not available or invalid from ITurnContext for actor ${currentActorIdForLog}. Cannot dispatch system error event.`
                );
            }
        } catch (dispatchError) {
            // This catches errors from eventDispatcher.dispatchSafely() itself
            logger.error(`${this.getStateName()}: Failed to dispatch SYSTEM_ERROR_OCCURRED_ID event for actor ${currentActorIdForLog}: ${dispatchError.message}`, dispatchError);
        }

        if (shouldEndTurn) {
            const actorToEndTurnFor = turnCtx.getActor?.(); // Re-fetch actor from context for endTurn
            // Ensure actorToEndTurnFor is valid and its ID matches currentActorIdForLog if possible,
            // or at least that an actor is present to end the turn for.
            if (typeof turnCtx.endTurn === 'function' && actorToEndTurnFor && actorToEndTurnFor.id) {
                logger.info(`${this.getStateName()}: Ending turn for actor ${actorToEndTurnFor.id} due to processing exception.`);
                await turnCtx.endTurn(error);
            } else {
                logger.warn(
                    `${this.getStateName()}: Cannot end turn for actor ${currentActorIdForLog} via ITurnContext ` +
                    `(context invalid, endTurn unavailable, or no valid actor in context [current: ${actorToEndTurnFor?.id}] after error). ` +
                    `Attempting handler reset if handler is available.`
                );
                if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                    logger.info(`${this.getStateName()}: Resetting handler and transitioning to TurnIdleState due to unrecoverable error for actor ${currentActorIdForLog}.`);
                    this._handler._resetTurnStateAndResources(`exception-no-context-end-${this.getStateName()}`);
                    await this._handler._transitionToState(new TurnIdleState(this._handler));
                } else {
                    logger.error(`${this.getStateName()}: CRITICAL - Cannot end turn OR reset handler for actor ${currentActorIdForLog}. System may be unstable.`);
                }
            }
        } else {
            logger.debug(`${this.getStateName()}: #handleProcessingException called with shouldEndTurn=false for actor ${currentActorIdForLog}. Turn not ended by this function.`);
        }
    }

    async exitState(handler, nextState) {
        const wasProcessing = this._isProcessing;
        this._isProcessing = false; // Ensure processing is marked as false on exit
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? handler?.getLogger() ?? this._handler?.getLogger() ?? console;
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_on_exit';

        if (wasProcessing) {
            logger.warn(`${this.getStateName()}: Exiting for actor ${actorId} while _isProcessing was true. This might indicate an incomplete or aborted operation. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);
        } else {
            logger.debug(`${this.getStateName()}: Exiting for actor: ${actorId}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);
        }
        await super.exitState(handler, nextState);
    }

    async destroy(handler) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? handler?.getLogger() ?? this._handler?.getLogger() ?? console;
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_at_destroy';

        logger.debug(`${this.getStateName()}: Destroying for actor: ${actorId}. Current _isProcessing: ${this._isProcessing}`);

        if (this._isProcessing) {
            logger.warn(`${this.getStateName()}: Destroyed during active processing for actor ${actorId}. Attempting to end turn if context is valid.`);
            // Note: _isProcessing is set to false after this block or at the start of the finally block.
            const actorToDestroyFor = turnCtx?.getActor(); // Re-fetch actor for safety
            if (turnCtx && typeof turnCtx.endTurn === 'function' && actorToDestroyFor?.id && actorToDestroyFor.id === actorId) {
                await turnCtx.endTurn(new Error(`Command processing for ${actorId} was destroyed mid-operation.`));
            } else if (turnCtx && typeof turnCtx.endTurn === 'function' && actorToDestroyFor?.id) { // Actor in context, but different
                logger.warn(`${this.getStateName()}: Actor in context (${actorToDestroyFor.id}) differs from actor at destroy initiation (${actorId}). Ending turn for context actor: ${actorToDestroyFor.id}.`);
                await turnCtx.endTurn(new Error(`Command processing (for ${actorId}) was destroyed; current context actor ${actorToDestroyFor.id} turn ending.`));
            } else {
                logger.error(`${this.getStateName()}: Cannot end turn via context for actor ${actorId} during destroy (context invalid, endTurn missing, or actor mismatch/missing).`);
                // Attempt handler reset as a fallback if context-based endTurn fails
                if (this._handler?._resetTurnStateAndResources && this._handler?._transitionToState) {
                    logger.warn(`${this.getStateName()}: Attempting handler reset due to inability to end turn cleanly for ${actorId} during destroy.`);
                    this._handler._resetTurnStateAndResources(`destroy-no-context-end-${this.getStateName()}`);
                    await this._handler._transitionToState(new TurnIdleState(this._handler));
                } else {
                    logger.error(`${this.getStateName()}: CRITICAL - Cannot end turn OR reset handler for actor ${actorId} during destroy. System may be unstable.`);
                }
            }
        }
        this._isProcessing = false; // Explicitly set to false after handling or if not processing

        await super.destroy(handler); // Calls AbstractTurnState's destroy
        logger.debug(`${this.getStateName()}: Destroy handling for actor ${actorId} complete.`);
    }
}