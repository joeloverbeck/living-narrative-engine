// src/turns/states/processingCommandState.js
// --- FILE START ---

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

import { AbstractTurnState } from './abstractTurnState.js';
import { TurnIdleState } from './turnIdleState.js';
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  ENTITY_SPOKE_ID,
} from '../../constants/eventIds.js';

/**
 * @class ProcessingCommandState
 * @augments {AbstractTurnState}
 */
export class ProcessingCommandState extends AbstractTurnState {
  _isProcessing = false;
  #turnActionToProcess = null;
  #commandStringForLog = null;

  /**
   * Creates an instance of ProcessingCommandState.
   *
   * @param {BaseTurnHandler} handler - The turn handler managing this state.
   * @param {string} [commandString]
   * @param {ITurnAction} [turnAction]
   */
  constructor(handler, commandString, turnAction = null) {
    super(handler);
    this._isProcessing = false;
    this.#turnActionToProcess = turnAction;
    this.#commandStringForLog =
      commandString || turnAction?.commandString || null;

    const logger = this._handler?.getLogger() ?? console;
    logger.debug(
      `${this.getStateName()} constructed. Command string (arg): "${this.#commandStringForLog}". TurnAction ID (arg): ${turnAction ? `"${turnAction.actionDefinitionId}"` : 'null'}`
    );
  }

  /** @override */
  getStateName() {
    return 'ProcessingCommandState';
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
      logger.warn(
        `${this.getStateName()}: enterState called while already processing. Actor: ${turnCtx?.getActor()?.id ?? 'N/A'}. Aborting re-entry.`
      );
      return;
    }
    this._isProcessing = true;

    await super.enterState(this._handler, previousState);
    const logger = turnCtx ? turnCtx.getLogger() : this._handler.getLogger();

    if (!turnCtx) {
      logger.error(
        `${this.getStateName()}: Turn context is null on enter. Attempting to reset and idle.`
      );
      if (
        this._handler &&
        typeof this._handler._resetTurnStateAndResources === 'function' &&
        typeof this._handler._transitionToState === 'function'
      ) {
        await this._handler._resetTurnStateAndResources(
          `critical-no-context-${this.getStateName()}`
        );
        await this._handler._transitionToState(
          new TurnIdleState(this._handler)
        );
      }
      this._isProcessing = false;
      return;
    }

    const actor = turnCtx.getActor();
    if (!actor) {
      const noActorError = new Error(
        'No actor present at the start of command processing.'
      );
      await this.#handleProcessingException(
        turnCtx,
        noActorError,
        'NoActorOnEnter'
      );
      return;
    }

    const actorId = actor.id;
    logger.debug(`${this.getStateName()}: Entered for actor ${actorId}.`);
    logger.debug(
      `${this.getStateName()}: Entering with command: "${this.#commandStringForLog}" for actor: ${actorId}`
    );

    let turnAction = this.#turnActionToProcess;
    if (!turnAction) {
      logger.debug(
        `${this.getStateName()}: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actorId}.`
      );
      try {
        turnAction = turnCtx.getChosenAction();
      } catch (e) {
        const errorMsg = `${this.getStateName()}: Error retrieving ITurnAction from context for actor ${actorId}: ${e.message}`;
        logger.error(errorMsg, e);
        await this.#handleProcessingException(
          turnCtx,
          new Error(errorMsg, { cause: e }),
          actorId
        );
        return;
      }
    }

    if (!turnAction) {
      const errorMsg = `${this.getStateName()}: No ITurnAction available for actor ${actorId}. Cannot process command.`;
      logger.error(errorMsg);
      await this.#handleProcessingException(
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return;
    }

    if (
      typeof turnAction.actionDefinitionId !== 'string' ||
      !turnAction.actionDefinitionId
    ) {
      const errorMsg = `${this.getStateName()}: ITurnAction for actor ${actorId} is invalid: missing or empty actionDefinitionId.`;
      logger.error(errorMsg, { receivedAction: turnAction });
      await this.#handleProcessingException(
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return;
    }

    const commandStringToLog =
      turnAction.commandString ||
      this.#commandStringForLog ||
      '(no command string available)';
    // Logging `turnAction.resolvedParameters` here which is no longer expected from LLMResponseProcessor output.
    // This log will show `Params: {}` if turnAction.resolvedParameters is undefined.
    // The actual speech is in `turnAction.speech`.
    logger.debug(
      `${this.getStateName()}: Actor ${actorId} processing action. ` +
        `ID: "${turnAction.actionDefinitionId}". ` +
        `Params: ${JSON.stringify(turnAction.resolvedParameters || {})}. ` + // This line shows resolvedParameters which should be undefined
        `CommandString: "${commandStringToLog}".`
    );

    this.#turnActionToProcess = turnAction;

    // --- CORRECTED SECTION: Dispatch ENTITY_SPOKE_ID event ---
    // Check for speech directly on the turnAction object
    if (
      turnAction.speech &&
      typeof turnAction.speech === 'string' &&
      turnAction.speech.trim() !== ''
    ) {
      const speechContent = turnAction.speech.trim();
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} spoke: "${speechContent}". Dispatching ${ENTITY_SPOKE_ID}.`
      );

      try {
        /** @type {ISafeEventDispatcher | undefined} */
        const eventDispatcher = turnCtx.getSafeEventDispatcher();
        if (eventDispatcher) {
          await eventDispatcher.dispatch(ENTITY_SPOKE_ID, {
            entityId: actorId,
            speechContent: speechContent,
            // Consider adding these if the ENTITY_SPOKE_ID event schema/handlers expect them:
            // originalActionId: turnAction.actionDefinitionId,
            // originalCommandString: turnAction.commandString
          });
          logger.debug(
            `${this.getStateName()}: Attempted dispatch of ${ENTITY_SPOKE_ID} for actor ${actorId} via TurnContext's SafeEventDispatcher.`
          );
        } else {
          logger.warn(
            `${this.getStateName()}: Could not get SafeEventDispatcher from TurnContext. ${ENTITY_SPOKE_ID} event not dispatched for actor ${actorId}.`
          );
        }
      } catch (eventDispatchError) {
        // This catch should ideally not be hit if dispatch adheres to its non-throwing contract.
        logger.error(
          `${this.getStateName()}: Unexpected error when trying to use dispatch for ${ENTITY_SPOKE_ID} for actor ${actorId}: ${eventDispatchError.message}`,
          eventDispatchError
        );
      }
    } else {
      // Optional: More detailed logging for why speech event wasn't dispatched
      if (
        turnAction &&
        Object.prototype.hasOwnProperty.call(turnAction, 'speech')
      ) {
        if (typeof turnAction.speech !== 'string') {
          logger.debug(
            `${this.getStateName()}: Actor ${actorId} speech field present but not a string (Type: ${typeof turnAction.speech}, Value: "${String(turnAction.speech)}"). No ${ENTITY_SPOKE_ID} event dispatched.`
          );
        } else if (turnAction.speech.trim() === '') {
          logger.debug(
            `${this.getStateName()}: Actor ${actorId} speech field present but empty after trimming. No ${ENTITY_SPOKE_ID} event dispatched.`
          );
        }
      } else if (turnAction) {
        logger.debug(
          `${this.getStateName()}: Actor ${actorId} has no 'speech' field in turnAction. No ${ENTITY_SPOKE_ID} event dispatched.`
        );
      }
    }
    // --- END CORRECTED SECTION ---

    await (async () => {
      try {
        await this._processCommandInternal(
          turnCtx,
          actor,
          this.#turnActionToProcess
        );
      } catch (error) {
        const currentTurnCtxForCatch = this._getTurnContext() ?? turnCtx;
        const errorLogger = currentTurnCtxForCatch?.getLogger?.() ?? logger;
        errorLogger.error(
          `${this.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
          error
        );
        const actorIdForHandler =
          currentTurnCtxForCatch?.getActor?.()?.id ?? actorId;
        await this.#handleProcessingException(
          currentTurnCtxForCatch || turnCtx,
          error,
          actorIdForHandler
        );
      }
    })();
  }

  async _processCommandInternal(turnCtx, actor, turnAction) {
    const logger = turnCtx.getLogger();
    const actorId = actor.id;

    try {
      const commandProcessor = await this._getServiceFromContext(
        turnCtx,
        'getCommandProcessor',
        'ICommandProcessor',
        actorId
      );
      if (!commandProcessor) {
        return; // Error handled by _getServiceFromContext
      }

      // turnAction should be valid here due to checks in enterState
      const commandStringToProcess =
        turnAction.commandString || turnAction.actionDefinitionId;

      // Redundant check as actionDefinitionId is validated in enterState, and commandString fallback is to actionDefinitionId
      // if (!commandStringToProcess) {
      //     logger.error(`${this.getStateName()}: No valid command string derived from ITurnAction for actor ${actorId}.`);
      //     await this.#handleProcessingException(turnCtx, new Error("No command string available in ITurnAction to process."), actorId);
      //     return;
      // }

      logger.debug(
        `${this.getStateName()}: Invoking commandProcessor.processCommand() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}, using commandString: "${commandStringToProcess}"`
      );
      const commandResult = await commandProcessor.processCommand(
        actor,
        commandStringToProcess
      );

      if (!this._isProcessing) {
        logger.warn(
          `${this.getStateName()}: Processing flag became false after commandProcessor.processCommand() for ${actorId}. Aborting further processing.`
        );
        return;
      }

      const activeTurnCtx = this._getTurnContext();
      if (
        !activeTurnCtx ||
        typeof activeTurnCtx.getActor !== 'function' ||
        activeTurnCtx.getActor()?.id !== actorId
      ) {
        logger.warn(
          `${this.getStateName()}: Context is invalid, has changed, or actor mismatch after commandProcessor.processCommand() for ${actorId}. Current context actor: ${activeTurnCtx?.getActor?.()?.id ?? 'N/A'}. Aborting further processing.`
        );
        const contextForException =
          activeTurnCtx && typeof activeTurnCtx.getActor === 'function'
            ? activeTurnCtx
            : turnCtx;
        await this.#handleProcessingException(
          contextForException,
          new Error('Context invalid/changed after command processing.'),
          actorId,
          false
        );
        return;
      }

      logger.debug(
        `${this.getStateName()}: Command processing completed for actor ${actorId}. Result success: ${commandResult?.success}.`
      );

      const outcomeInterpreter = await this._getServiceFromContext(
        activeTurnCtx,
        'getCommandOutcomeInterpreter',
        'ICommandOutcomeInterpreter',
        actorId
      );
      if (!outcomeInterpreter) {
        return; // Error handled by _getServiceFromContext
      }

      const directiveType = await outcomeInterpreter.interpret(
        commandResult,
        activeTurnCtx
      );
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} - Command result interpreted to directive: ${directiveType}`
      );

      const directiveStrategy =
        TurnDirectiveStrategyResolver.resolveStrategy(directiveType);
      if (!directiveStrategy) {
        const errorMsg = `${this.getStateName()}: Could not resolve ITurnDirectiveStrategy for directive '${directiveType}' (actor ${actorId}).`;
        logger.error(errorMsg);
        await this.#handleProcessingException(
          activeTurnCtx,
          new Error(errorMsg),
          actorId
        );
        return;
      }
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} - Resolved strategy ${directiveStrategy.constructor.name} for directive ${directiveType}.`
      );

      await directiveStrategy.execute(
        activeTurnCtx,
        directiveType,
        commandResult
      );
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} - Directive strategy ${directiveStrategy.constructor.name} executed.`
      );

      // Check if state is still current before setting _isProcessing to false
      // This is important if the directiveStrategy.execute itself causes a state transition
      if (this._isProcessing && this._handler._currentState === this) {
        logger.debug(
          `${this.getStateName()}: Directive strategy executed for ${actorId}, state remains ${this.getStateName()}. Processing complete for this state instance.`
        );
        this._isProcessing = false; // Processing for *this instance* of the state is done.
      } else if (this._isProcessing) {
        logger.debug(
          `${this.getStateName()}: Directive strategy executed for ${actorId}, but state changed from ${this.getStateName()} to ${this._handler._currentState?.getStateName() ?? 'Unknown'}. Processing considered complete for previous state instance.`
        );
        this._isProcessing = false; // Ensure it's false even if state changed.
      }
    } catch (error) {
      const errorHandlingCtx = this._getTurnContext() ?? turnCtx;
      const actorIdForHandler = errorHandlingCtx?.getActor?.()?.id ?? actorId;
      const processingError =
        error instanceof Error
          ? error
          : new Error(String(error.message || error));
      if (!(error instanceof Error) && error.stack) {
        // Copy stack if it's a non-Error object with a stack
        processingError.stack = error.stack;
      }
      await this.#handleProcessingException(
        errorHandlingCtx || turnCtx,
        processingError,
        actorIdForHandler
      );
    } finally {
      // This finally block might run even if an error within the try block caused a state transition
      // and already set _isProcessing = false.
      if (this._isProcessing && this._handler._currentState === this) {
        // Check if still in this state and processing
        const finalLogger =
          this._getTurnContext()?.getLogger() ?? turnCtx.getLogger();
        finalLogger.warn(
          `${this.getStateName()}: _isProcessing was unexpectedly true at the end of _processCommandInternal for ${actorId}. Forcing to false.`
        );
        this._isProcessing = false;
      }
    }
  }

  async _getServiceFromContext(
    turnCtx,
    methodName,
    serviceNameForLog,
    actorIdForLog
  ) {
    if (!turnCtx || typeof turnCtx.getLogger !== 'function') {
      // This might happen if turnCtx becomes null due to an earlier error/reset
      console.error(
        `${this.getStateName()}: Invalid turnCtx in _getServiceFromContext for ${serviceNameForLog}, actor ${actorIdForLog}.`
      );
      if (this._isProcessing) {
        // Only set if still processing, to avoid unintended side-effects
        this._isProcessing = false;
      }
      return null;
    }
    const logger = turnCtx.getLogger();
    try {
      if (typeof turnCtx[methodName] !== 'function') {
        throw new Error(
          `Method turnCtx.${methodName}() does not exist or is not a function.`
        );
      }
      const service = turnCtx[methodName]();
      if (!service) {
        throw new Error(
          `Method turnCtx.${methodName}() returned null or undefined.`
        );
      }
      return service;
    } catch (error) {
      // Build a new Error that contains the “Failed to retrieve …” message, so tests pass
      const errorMsg = `${this.getStateName()}: Failed to retrieve ${serviceNameForLog} for actor ${actorIdForLog}. Error: ${error.message}`;
      logger.error(errorMsg, error);

      // Now pass a brand-new Error(errorMsg) into handleProcessingException
      const serviceError = new Error(errorMsg);
      await this.#handleProcessingException(
        turnCtx,
        serviceError,
        actorIdForLog
      );
      return null;
    }
  }

  async #handleProcessingException(
    turnCtx,
    error,
    actorIdContext = 'UnknownActor',
    shouldEndTurn = true
  ) {
    const wasProcessing = this._isProcessing;
    this._isProcessing = false; // Prevent re-entry or further processing loops

    let logger = console; // Fallback
    let currentActorIdForLog = actorIdContext;

    if (turnCtx && typeof turnCtx.getLogger === 'function') {
      logger = turnCtx.getLogger();
      currentActorIdForLog = turnCtx.getActor?.()?.id ?? actorIdContext;
    } else {
      // If turnCtx is invalid, log to console
      console.error(
        `${this.getStateName()}: Critical error - turnCtx is invalid in #handleProcessingException. Using console for logging. Actor context for this error: ${currentActorIdForLog}`
      );
    }

    logger.error(
      `${this.getStateName()}: Error during command processing for actor ${currentActorIdForLog} (wasProcessing: ${wasProcessing}): ${error.message}`,
      error
    );

    // Attempt to dispatch SYSTEM_ERROR_OCCURRED_ID
    /** @type {ISafeEventDispatcher | undefined} */
    let systemErrorDispatcher;
    if (turnCtx && typeof turnCtx.getSafeEventDispatcher === 'function') {
      systemErrorDispatcher = turnCtx.getSafeEventDispatcher();
    } else if (
      this._handler &&
      typeof this._handler.safeEventDispatcher === 'object' &&
      this._handler.safeEventDispatcher !== null &&
      typeof this._handler.safeEventDispatcher.dispatch === 'function'
    ) {
      logger.warn(
        `${this.getStateName()}: SafeEventDispatcher not found on TurnContext for actor ${currentActorIdForLog}. Attempting to use this._handler.safeEventDispatcher.`
      );
      systemErrorDispatcher = this._handler.safeEventDispatcher;
    }

    if (systemErrorDispatcher) {
      try {
        // dispatch should not throw
        await systemErrorDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `System error in ${this.getStateName()} for actor ${currentActorIdForLog}: ${error.message}`,
          details: {
            raw: `OriginalError: ${error.name} - ${error.message}`,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (dispatchError) {
        // Should not be reached
        logger.error(
          `${this.getStateName()}: Unexpected error dispatching SYSTEM_ERROR_OCCURRED_ID via SafeEventDispatcher for ${currentActorIdForLog}: ${dispatchError.message}`,
          dispatchError
        );
      }
    } else {
      logger.warn(
        `${this.getStateName()}: SafeEventDispatcher not available for actor ${currentActorIdForLog}. Cannot dispatch system error event.`
      );
    }

    if (shouldEndTurn) {
      // Always attempt to call turnCtx.endTurn(error), even if getActor() was null
      if (turnCtx && typeof turnCtx.endTurn === 'function') {
        logger.debug(
          `${this.getStateName()}: Ending turn (no valid actor or error state) due to processing exception.`
        );
        try {
          await turnCtx.endTurn(error);
        } catch (endTurnError) {
          // If endTurn fails, log and reset the handler
          logger.error(
            `${this.getStateName()}: Error calling turnCtx.endTurn(): ${endTurnError.message}`,
            endTurnError
          );
          if (
            this._handler?._resetTurnStateAndResources &&
            this._handler?._transitionToState
          ) {
            logger.warn(
              `${this.getStateName()}: Resetting handler due to failure in turnCtx.endTurn().`
            );
            await this._handler._resetTurnStateAndResources(
              `exception-endTurn-failed-${this.getStateName()}`
            );
            await this._handler._transitionToState(
              new TurnIdleState(this._handler)
            );
          }
        }
      } else {
        // If endTurn is not available, reset the handler immediately
        logger.warn(
          `${this.getStateName()}: Cannot call turnCtx.endTurn(); ITurnContext or its endTurn method is unavailable.`
        );
        if (
          this._handler?._resetTurnStateAndResources &&
          this._handler?._transitionToState
        ) {
          await this._handler._resetTurnStateAndResources(
            `exception-no-context-end-${this.getStateName()}`
          );
          await this._handler._transitionToState(
            new TurnIdleState(this._handler)
          );
        } else {
          logger.error(
            `${this.getStateName()}: CRITICAL - Cannot end turn OR reset handler. System may be unstable.`
          );
        }
      }
    } else {
      logger.debug(
        `${this.getStateName()}: #handleProcessingException called with shouldEndTurn=false for actor ${currentActorIdForLog}.`
      );
    }
  }

  async exitState(handler, nextState) {
    const wasProcessing = this._isProcessing;
    // Ensure processing flag is false on exit, regardless of how exit was triggered.
    this._isProcessing = false;

    const turnCtx = this._getTurnContext();
    const logger =
      turnCtx?.getLogger() ??
      handler?.getLogger() ??
      this._handler?.getLogger() ??
      console;
    const actorId = turnCtx?.getActor?.()?.id ?? 'N/A_on_exit';

    if (wasProcessing) {
      logger.debug(
        `${this.getStateName()}: Exiting for actor ${actorId} while _isProcessing was true (now false). Transitioning to ${nextState?.getStateName() ?? 'None'}.`
      );
    } else {
      logger.debug(
        `${this.getStateName()}: Exiting for actor: ${actorId}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`
      );
    }
    await super.exitState(handler, nextState);
  }

  async destroy(handler) {
    const turnCtx = this._getTurnContext(); // Get context before calling super, as super.destroy might clear it.
    const logger =
      turnCtx?.getLogger() ??
      handler?.getLogger() ??
      this._handler?.getLogger() ??
      console;
    const actorId = turnCtx?.getActor?.()?.id ?? 'N/A_at_destroy';

    logger.debug(
      `${this.getStateName()}: Destroying for actor: ${actorId}. Current _isProcessing: ${this._isProcessing}`
    );

    if (this._isProcessing) {
      // This indicates an abnormal termination, like the handler itself being destroyed.
      logger.warn(
        `${this.getStateName()}: Destroyed during active processing for actor ${actorId}.`
      );
    }
    this._isProcessing = false; // Ensure flag is cleared.

    await super.destroy(handler); // Call super.destroy which handles its own logging.
    logger.debug(
      `${this.getStateName()}: Destroy handling for actor ${actorId} complete.`
    );
  }
}

// --- FILE END ---
