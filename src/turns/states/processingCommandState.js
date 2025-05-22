// src/core/turns/states/processingCommandState.js

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../commands/commandProcessor.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher // For type hint
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js'; // For error recovery
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID, ENTITY_SPOKE_ID} from '../../constants/eventIds.js';

/**
 * @class ProcessingCommandState
 * @extends {AbstractTurnState}
 */
export class ProcessingCommandState extends AbstractTurnState {
    /** @private @type {boolean} */
    _isProcessing = false;
    /** @private @type {ITurnAction | null} */
    #turnActionToProcess = null;
    /** @private @type {string | null} */
    #commandStringForLog = null;

    /**
     * Creates an instance of ProcessingCommandState.
     * @param {BaseTurnHandler} handler - The turn handler managing this state.
     * @param {string} [commandString]
     * @param {ITurnAction} [turnAction=null]
     */
    constructor(handler, commandString, turnAction = null) {
        super(handler);
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
            logger.error(`${this.getStateName()}: Turn context is null on enter. Attempting to reset and idle.`);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                await this._handler._resetTurnStateAndResources(`critical-no-context-${this.getStateName()}`);
                await this._handler._transitionToState(new TurnIdleState(this._handler));
            }
            this._isProcessing = false;
            return;
        }

        const actor = turnCtx.getActor();
        if (!actor) {
            const noActorError = new Error('No actor present at the start of command processing.');
            await this.#handleProcessingException(turnCtx, noActorError, 'NoActorOnEnter');
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
            const errorMsg = `${this.getStateName()}: No ITurnAction available for actor ${actorId}. Cannot process command.`;
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

        // --- MODIFICATION START: Dispatch ENTITY_SPOKE_ID event ---
        if (turnAction.resolvedParameters &&
            typeof turnAction.resolvedParameters.speech === 'string' &&
            turnAction.resolvedParameters.speech.trim() !== '') {
            const speechContent = turnAction.resolvedParameters.speech.trim();
            logger.debug(`${this.getStateName()}: Actor ${actorId} spoke: "${speechContent}". Dispatching ${ENTITY_SPOKE_ID}.`);

            try {
                /** @type {ISafeEventDispatcher | undefined} */
                const eventDispatcher = turnCtx.getSafeEventDispatcher();
                if (eventDispatcher) {
                    // ISafeEventDispatcher guarantees dispatchSafely method and non-throwing behavior
                    await eventDispatcher.dispatchSafely(ENTITY_SPOKE_ID, {
                        entityId: actorId,
                        speechContent: speechContent
                    });
                    // dispatchSafely handles its own internal logging for success/failure.
                    logger.debug(`${this.getStateName()}: Attempted dispatch of ${ENTITY_SPOKE_ID} for actor ${actorId} via TurnContext's SafeEventDispatcher.`);
                } else {
                    logger.warn(`${this.getStateName()}: Could not get SafeEventDispatcher from TurnContext. ${ENTITY_SPOKE_ID} event not dispatched for actor ${actorId}.`);
                }
            } catch (eventDispatchError) {
                // This catch should ideally not be hit if dispatchSafely adheres to its non-throwing contract.
                logger.error(`${this.getStateName()}: Unexpected error when trying to use dispatchSafely for ${ENTITY_SPOKE_ID} for actor ${actorId}: ${eventDispatchError.message}`, eventDispatchError);
            }
        }
        // --- MODIFICATION END ---

        await (async () => {
            try {
                await this._processCommandInternal(turnCtx, actor, this.#turnActionToProcess);
            } catch (error) {
                const currentTurnCtxForCatch = this._getTurnContext() ?? turnCtx;
                const errorLogger = currentTurnCtxForCatch?.getLogger?.() ?? logger;
                errorLogger.error(
                    `${this.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
                    error
                );
                const actorIdForHandler = currentTurnCtxForCatch?.getActor?.()?.id ?? actorId;
                await this.#handleProcessingException(currentTurnCtxForCatch || turnCtx, error, actorIdForHandler);
            }
        })();
    }

    async _processCommandInternal(turnCtx, actor, turnAction) {
        const logger = turnCtx.getLogger();
        const actorId = actor.id;

        try {
            const commandProcessor = await this._getServiceFromContext(turnCtx, 'getCommandProcessor', 'ICommandProcessor', actorId);
            if (!commandProcessor) {
                return;
            }

            if (turnAction && typeof turnAction.actionDefinitionId === 'string') {
                const commandStringToProcess = turnAction.commandString || turnAction.actionDefinitionId;

                if (!commandStringToProcess) {
                    logger.error(`${this.getStateName()}: No valid command string found in ITurnAction for actor ${actorId}.`);
                    await this.#handleProcessingException(turnCtx, new Error("No command string available in ITurnAction to process."), actorId);
                    return;
                }

                logger.debug(`${this.getStateName()}: Invoking commandProcessor.processCommand() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}, using commandString: "${commandStringToProcess}"`);
                const commandResult = await commandProcessor.processCommand(actor, commandStringToProcess);

                if (!this._isProcessing) {
                    logger.warn(`${this.getStateName()}: Processing flag became false after commandProcessor.processCommand() for ${actorId}. Aborting further processing.`);
                    return;
                }

                const activeTurnCtx = this._getTurnContext();
                if (!activeTurnCtx || typeof activeTurnCtx.getActor !== 'function' || activeTurnCtx.getActor()?.id !== actorId) {
                    logger.warn(`${this.getStateName()}: Context is invalid, has changed, or actor mismatch after commandProcessor.processCommand() for ${actorId}. Current context actor: ${activeTurnCtx?.getActor?.()?.id ?? 'N/A'}. Aborting further processing.`);
                    const contextForException = activeTurnCtx && typeof activeTurnCtx.getActor === 'function' ? activeTurnCtx : turnCtx;
                    await this.#handleProcessingException(contextForException, new Error("Context invalid/changed after command processing."), actorId, false);
                    return;
                }

                logger.debug(`${this.getStateName()}: Command processing completed for actor ${actorId}. Result success: ${commandResult?.success}.`);

                const outcomeInterpreter = await this._getServiceFromContext(activeTurnCtx, 'getCommandOutcomeInterpreter', 'ICommandOutcomeInterpreter', actorId);
                if (!outcomeInterpreter) {
                    return;
                }

                const directiveType = await outcomeInterpreter.interpret(commandResult, activeTurnCtx);
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

                if (this._isProcessing && this._handler._currentState === this) {
                    logger.debug(`${this.getStateName()}: Directive strategy executed for ${actorId}, state remains ${this.getStateName()}. Processing complete.`);
                    this._isProcessing = false;
                }

            } else {
                logger.warn(`${this.getStateName()}: Cannot invoke commandProcessor.processCommand() due to invalid turnAction object.`);
                await this.#handleProcessingException(turnCtx, new Error("Invalid ITurnAction object for command processing."), actorId);
                return;
            }

        } catch (error) {
            const errorHandlingCtx = this._getTurnContext() ?? turnCtx;
            const actorIdForHandler = errorHandlingCtx?.getActor?.()?.id ?? actorId;
            const processingError = error instanceof Error ? error : new Error(String(error.message || error));
            if (!(error instanceof Error) && error.stack) {
                processingError.stack = error.stack;
            }
            await this.#handleProcessingException(errorHandlingCtx || turnCtx, processingError, actorIdForHandler);
        } finally {
            if (this._isProcessing) {
                const finalLogger = this._getTurnContext()?.getLogger() ?? turnCtx.getLogger();
                finalLogger.warn(`${this.getStateName()}: _isProcessing was still true at the end of _processCommandInternal for ${actorId}. Forcing false.`);
                this._isProcessing = false;
            }
        }
    }

    async _getServiceFromContext(turnCtx, methodName, serviceNameForLog, actorIdForLog) {
        if (!turnCtx || typeof turnCtx.getLogger !== 'function') {
            console.error(`${this.getStateName()}: Invalid turnCtx in _getServiceFromContext for ${serviceNameForLog}, actor ${actorIdForLog}.`);
            this._isProcessing = false;
            return null;
        }
        const logger = turnCtx.getLogger();
        try {
            if (typeof turnCtx[methodName] !== 'function') {
                throw new Error(`Method turnCtx.${methodName}() does not exist or is not a function.`);
            }
            const service = turnCtx[methodName]();
            if (!service) {
                throw new Error(`Method turnCtx.${methodName}() returned null or undefined.`);
            }
            return service;
        } catch (error) {
            const errorMsg = `${this.getStateName()}: Failed to retrieve ${serviceNameForLog} for actor ${actorIdForLog}. Error: ${error.message}`;
            logger.error(errorMsg, error);
            await this.#handleProcessingException(turnCtx, error, actorIdForLog);
            return null;
        }
    }

    async #handleProcessingException(turnCtx, error, actorIdContext = 'UnknownActor', shouldEndTurn = true) {
        const wasProcessing = this._isProcessing;
        this._isProcessing = false;

        let logger = console;
        if (turnCtx && typeof turnCtx.getLogger === 'function') {
            logger = turnCtx.getLogger();
        } else {
            console.error(`${this.getStateName()}: Critical error - turnCtx is invalid in #handleProcessingException. Using console for logging.`);
        }

        const actorIdForLog = turnCtx?.getActor?.()?.id ?? actorIdContext ?? 'UnknownActor';

        logger.error(
            `${this.getStateName()}: Error during command processing for actor ${actorIdForLog} (wasProcessing: ${wasProcessing}): ${error.message}`,
            error
        );

        // Attempt to dispatch system error
        /** @type {ISafeEventDispatcher | undefined} */
        let systemErrorDispatcher;
        if (turnCtx && typeof turnCtx.getSafeEventDispatcher === 'function') { // Prefer TurnContext
            systemErrorDispatcher = turnCtx.getSafeEventDispatcher();
        } else if (this._handler && typeof this._handler.safeEventDispatcher === 'object' && this._handler.safeEventDispatcher !== null && typeof this._handler.safeEventDispatcher.dispatchSafely === 'function') {
            // Fallback: Check if the handler itself has a 'safeEventDispatcher' public property/getter
            // This is based on PlayerTurnHandler's public `get safeEventDispatcher()`
            logger.warn(`${this.getStateName()}: SafeEventDispatcher not found on TurnContext. Attempting to use this._handler.safeEventDispatcher for system error reporting.`);
            systemErrorDispatcher = this._handler.safeEventDispatcher;
        }


        if (systemErrorDispatcher) {
            try {
                await systemErrorDispatcher.dispatchSafely(SYSTEM_ERROR_OCCURRED_ID, {
                    message: `System error in ${this.getStateName()} for actor ${actorIdForLog}: ${error.message}`,
                    type: 'error',
                    details: `OriginalError: ${error.name} - ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`,
                    actorId: actorIdForLog,
                    turnState: this.getStateName(),
                });
            } catch (dispatchError) { // Should not happen with dispatchSafely
                logger.error(`${this.getStateName()}: Error dispatching SYSTEM_ERROR_OCCURRED_ID event via SafeEventDispatcher for actor ${actorIdForLog}: ${dispatchError.message}`, dispatchError);
            }
        } else {
            logger.warn(`${this.getStateName()}: SafeEventDispatcher not available (neither from TurnContext nor handler). Cannot dispatch system error event for ${actorIdForLog}.`);
        }

        if (shouldEndTurn) {
            if (turnCtx && typeof turnCtx.endTurn === 'function') {
                const actorToEndTurnFor = turnCtx.getActor?.();
                if (actorToEndTurnFor && actorToEndTurnFor.id) {
                    logger.info(`${this.getStateName()}: Ending turn for actor ${actorToEndTurnFor.id} due to processing exception.`);
                    try {
                        await turnCtx.endTurn(error);
                    } catch (endTurnError) {
                        logger.error(`${this.getStateName()}: Error calling turnCtx.endTurn() for ${actorToEndTurnFor.id}: ${endTurnError.message}`, endTurnError);
                        if (this._handler?._resetTurnStateAndResources && this._handler?._transitionToState) {
                            logger.warn(`${this.getStateName()}: Resetting handler due to error in turnCtx.endTurn().`);
                            await this._handler._resetTurnStateAndResources(`exception-endTurn-failed-${this.getStateName()}`);
                            await this._handler._transitionToState(new TurnIdleState(this._handler));
                        }
                    }
                } else {
                    logger.warn(`${this.getStateName()}: Cannot end turn via ITurnContext: endTurn available but no valid actor in context. Attempting handler reset.`);
                    if (this._handler?._resetTurnStateAndResources && this._handler?._transitionToState) {
                        await this._handler._resetTurnStateAndResources(`exception-no-actor-to-end-${this.getStateName()}`);
                        await this._handler._transitionToState(new TurnIdleState(this._handler));
                    }
                }
            } else {
                logger.warn(`${this.getStateName()}: Cannot end turn for actor ${actorIdForLog}: ITurnContext or endTurn method unavailable. Attempting handler reset.`);
                if (this._handler?._resetTurnStateAndResources && this._handler?._transitionToState) {
                    await this._handler._resetTurnStateAndResources(`exception-no-context-end-${this.getStateName()}`);
                    await this._handler._transitionToState(new TurnIdleState(this._handler));
                } else {
                    logger.error(`${this.getStateName()}: CRITICAL - Cannot end turn OR reset handler for ${actorIdForLog}. System may be unstable.`);
                }
            }
        } else {
            logger.debug(`${this.getStateName()}: #handleProcessingException called with shouldEndTurn=false for actor ${actorIdForLog}.`);
        }
    }

    async exitState(handler, nextState) {
        const wasProcessing = this._isProcessing;
        this._isProcessing = false;
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? handler?.getLogger() ?? this._handler?.getLogger() ?? console;
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_on_exit';

        if (wasProcessing) {
            logger.info(`${this.getStateName()}: Exiting for actor ${actorId} while _isProcessing was true. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);
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
            logger.warn(`${this.getStateName()}: Destroyed during active processing for actor ${actorId}.`);
        }
        this._isProcessing = false;

        await super.destroy(handler);
        logger.debug(`${this.getStateName()}: Destroy handling for actor ${actorId} complete.`);
    }
}