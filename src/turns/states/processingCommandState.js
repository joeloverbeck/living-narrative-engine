// src/turns/states/processingCommandState.js
/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher // For type hint
 * @typedef {import('../interfaces/turnStateContextTypes.js').ProcessingCommandStateContext} ProcessingCommandStateContext
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ENTITY_SPOKE_ID } from '../../constants/eventIds.js';
import { CommandProcessingWorkflow } from './helpers/commandProcessingWorkflow.js';
import { ProcessingWorkflow } from './workflows/processingWorkflow.js';
import { ProcessingExceptionHandler } from './helpers/processingExceptionHandler.js';
import { buildSpeechPayload } from './helpers/buildSpeechPayload.js';
import { ProcessingGuard } from './helpers/processingGuard.js';
import { finishProcessing } from './helpers/processingErrorUtils.js';
import { getLogger } from './helpers/contextUtils.js';
import { dispatchSpeechEvent } from './helpers/dispatchSpeechEvent.js';
import turnDirectiveResolverAdapter from '../adapters/turnDirectiveResolverAdapter.js';
import { ITurnDirectiveResolver } from '../interfaces/ITurnDirectiveResolver.js';
import {
  validateTurnAction,
  validateCommandString,
  PROCESSING_CONTEXT_METHODS,
} from './helpers/validationUtils.js';

/**
 * @class ProcessingCommandState
 * @augments {AbstractTurnState}
 */
export class ProcessingCommandState extends AbstractTurnState {
  #isProcessing = false;
  _processingGuard;
  /** @type {ITurnDirectiveResolver} */
  _directiveResolver = turnDirectiveResolverAdapter;
  _exceptionHandler;
  #turnActionToProcess = null;
  #commandStringForLog = null;
  /** @type {ICommandProcessor} */
  #commandProcessor;
  _commandOutcomeInterpreter;
  _processingWorkflow;
  /**
   * Factory for creating ProcessingWorkflow instances.
   *
   * @type {(state: ProcessingCommandState, commandString: string|null, action: ITurnAction|null, setAction: (a: ITurnAction|null) => void, handler: ProcessingExceptionHandler) => ProcessingWorkflow}
   */
  _processingWorkflowFactory;

  /**
   * @description Updates the turn action to process.
   * @private
   * @param {ITurnAction|null} action - Action to process.
   * @returns {void}
   */
  _setTurnAction(action) {
    this.#turnActionToProcess = action;
  }

  /**
   * @description Internal setter used by ProcessingGuard.
   * @param {boolean} val - New processing state.
   * @returns {void}
   */
  _setProcessing(val) {
    this.#isProcessing = val;
  }

  /**
   * @description Indicates whether the state is currently processing.
   * @returns {boolean} True if processing.
   */
  get isProcessing() {
    return this.#isProcessing;
  }

  /**
   * @description Marks the start of command processing.
   * @returns {void}
   */
  startProcessing() {
    this._processingGuard.start();
  }

  /**
   * @description Marks the end of command processing.
   * @returns {void}
   */
  finishProcessing() {
    this._processingGuard.finish();
  }

  /**
   * @override
   * @param {string} reason - Explanation for context validation failure.
   * @returns {Promise<ProcessingCommandStateContext|null>} The current context
   *   cast to ProcessingCommandStateContext or null on failure.
   */
  async _ensureContext(reason) {
    const ctx = await this._ensureContextWithMethods(
      reason,
      PROCESSING_CONTEXT_METHODS,
      {
        endTurnOnFail: false,
      }
    );
    return /** @type {ProcessingCommandStateContext | null} */ (ctx);
  }

  /**
   * @private
   * @param {string} message - The error message.
   * @throws {Error}
   */
  _throwConstructionError(message) {
    const logger = getLogger(null, this._handler);
    const fullMessage = `${this.getStateName()} Constructor: ${message}`;
    logger.error(fullMessage);
    throw new Error(fullMessage);
  }

  /**
   * Validates constructor dependencies.
   *
   * @private
   * @param {object} deps - Constructor dependencies.
   * @param {ICommandProcessor} deps.commandProcessor - Service to dispatch commands.
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter - Service to interpret command results.
   * @param {string} deps.commandString - Raw command string.
   * @param {ITurnAction} deps.turnAction - Structured turn action.
   * @param {Function} deps.directiveResolver - Resolver for turn directives.
   * @returns {void}
   */
  _validateDependencies({
    commandProcessor,
    commandOutcomeInterpreter,
    commandString,
    turnAction,
    directiveResolver,
  }) {
    if (!commandProcessor) {
      this._throwConstructionError('commandProcessor is required');
    }
    if (!commandOutcomeInterpreter) {
      this._throwConstructionError('commandOutcomeInterpreter is required');
    }
    validateCommandString(commandString, (msg) =>
      this._throwConstructionError(msg)
    );
    validateTurnAction(turnAction, (msg) => this._throwConstructionError(msg));
    if (!directiveResolver) {
      this._throwConstructionError('directiveResolver is required');
    }
  }

  /**
   * Initializes state components after validation.
   *
   * @private
   * @param {object} deps - Constructor dependencies.
   * @param {ICommandProcessor} deps.commandProcessor - Service to dispatch commands.
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter - Service to interpret command results.
   * @param {string} deps.commandString - Raw command string.
   * @param {ITurnAction} deps.turnAction - Structured turn action.
   * @param {Function} deps.directiveResolver - Resolver for turn directives.
   * @param {(state: ProcessingCommandState, commandString: string|null, action: ITurnAction|null, setAction: (a: ITurnAction|null) => void, handler: ProcessingExceptionHandler) => ProcessingWorkflow} deps.processingWorkflowFactory - Factory for ProcessingWorkflow.
   * @returns {void}
   */
  _initializeComponents({
    commandProcessor,
    commandOutcomeInterpreter,
    commandString,
    turnAction,
    directiveResolver,
    processingWorkflowFactory,
  }) {
    this.#commandProcessor = commandProcessor;
    this._commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#commandStringForLog = commandString;
    this._setTurnAction(turnAction);
    this._directiveResolver = directiveResolver;

    this._processingGuard = new ProcessingGuard(this);
    this._exceptionHandler = new ProcessingExceptionHandler(this);
    finishProcessing(this);

    this._processingWorkflowFactory = processingWorkflowFactory;

    this._processingWorkflow = new CommandProcessingWorkflow({
      state: this,
      exceptionHandler: this._exceptionHandler,
      commandProcessor: this.#commandProcessor,
      commandOutcomeInterpreter: this._commandOutcomeInterpreter,
      directiveStrategyResolver: this._directiveResolver,
    });
  }

  /**
   * @param {object} deps Dependencies for the state.
   * @param {ITurnStateHost} deps.handler The turn state host (typically an ActorTurnHandler).
   * @param {ICommandProcessor} deps.commandProcessor Service to dispatch commands.
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter Service to interpret command results.
   * @param {string} deps.commandString The raw command string to process.
   * @param {ITurnAction} deps.turnAction The structured turn action.
   * @param {Function} deps.directiveResolver Resolver for turn directives.
   * @param {(state: ProcessingCommandState, commandString: string|null, action: ITurnAction|null, setAction: (a: ITurnAction|null) => void, handler: ProcessingExceptionHandler) => ProcessingWorkflow} [deps.processingWorkflowFactory] Factory for ProcessingWorkflow.
   */
  constructor({
    handler,
    commandProcessor,
    commandOutcomeInterpreter,
    commandString,
    turnAction,
    directiveResolver = turnDirectiveResolverAdapter,
    processingWorkflowFactory = (
      state,
      cmd,
      action,
      setAction,
      exceptionHandler
    ) =>
      new ProcessingWorkflow(state, cmd, action, setAction, exceptionHandler),
  }) {
    super(handler);
    const deps = {
      commandProcessor,
      commandOutcomeInterpreter,
      commandString,
      turnAction,
      directiveResolver,
      processingWorkflowFactory,
    };

    this._validateDependencies(deps);
    this._initializeComponents(deps);
    this._logConstruction();
  }

  /**
   * @private
   * @description Logs information about the state's construction.
   */
  _logConstruction() {
    const logger = getLogger(null, this._handler);
    // Use #commandStringForLog and #turnActionToProcess which are set in the constructor
    const commandStringForLog = this.#commandStringForLog;
    const turnActionIdForLog = this.#turnActionToProcess?.actionDefinitionId;

    logger.debug(
      `${this.getStateName()} constructed. Command: "${commandStringForLog || 'N/A'}". Action ID: "${turnActionIdForLog || 'N/A'}".`
    );
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {ITurnState_Interface} [previousState]
   */
  async enterState(handler, previousState) {
    const workflow = this._processingWorkflowFactory(
      this,
      this.#commandStringForLog,
      this.#turnActionToProcess,
      (a) => {
        this._setTurnAction(a);
      },
      this._exceptionHandler
    );
    await workflow.run(handler, previousState);
  }

  /**
   * @description Dispatches ENTITY_SPOKE_ID if decision metadata contains speech.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor speaking.
   * @param {object} decisionMeta - Metadata from the actor decision.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async _dispatchSpeech(turnCtx, actor, decisionMeta) {
    const logger = getLogger(turnCtx, this._handler);
    const actorId = actor.id;
    const payloadBase = buildSpeechPayload(decisionMeta);
    const speechRaw = decisionMeta?.speech;

    if (payloadBase) {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} spoke: "${payloadBase.speechContent}". Dispatching ${ENTITY_SPOKE_ID}.`
      );

      try {
        await dispatchSpeechEvent(turnCtx, this._handler, actorId, payloadBase);
        logger.debug(
          `${this.getStateName()}: Attempted dispatch of ${ENTITY_SPOKE_ID} for actor ${actorId} via TurnContext's SafeEventDispatcher.`,
          { payload: { entityId: actorId, ...payloadBase } }
        );
      } catch (eventDispatchError) {
        logger.error(
          `${this.getStateName()}: Unexpected error when trying to use dispatch for ${ENTITY_SPOKE_ID} for actor ${actorId}: ${eventDispatchError.message}`,
          eventDispatchError
        );
      }
    } else if (speechRaw !== null && speechRaw !== undefined) {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} had a non-string or empty speech field in decisionMeta. No ${ENTITY_SPOKE_ID} event dispatched. (Type: ${typeof speechRaw}, Value: "${String(speechRaw)}")`
      );
    } else {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} has no 'speech' field in decisionMeta. No ${ENTITY_SPOKE_ID} event dispatched.`
      );
    }
  }

  /**
   * @description Processes the resolved action and handles errors from the internal workflow.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor performing the action.
   * @param {ITurnAction} turnAction - Action to process.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  // _executeActionWorkflow logic moved to ProcessingWorkflow

  async _processCommandInternal(turnCtx, actor, turnAction) {
    // Use the member _processingWorkflow, which is already correctly configured.
    await this._processingWorkflow.processCommand(turnCtx, actor, turnAction);
  }

  async exitState(handler, nextState) {
    const wasProcessing = this.isProcessing;
    // Ensure processing flag is false on exit, regardless of how exit was triggered.
    finishProcessing(this);

    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, handler);
    const actorId = turnCtx?.getActor?.()?.id ?? 'N/A_on_exit';

    if (wasProcessing) {
      logger.debug(
        `${this.getStateName()}: Exiting for actor ${actorId} while processing was true (now false). Transitioning to ${nextState?.getStateName() ?? 'None'}.`
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
    const logger = getLogger(turnCtx, handler);
    const actorId = turnCtx?.getActor?.()?.id ?? 'N/A_at_destroy';

    logger.debug(
      `${this.getStateName()}: Destroying for actor: ${actorId}. Current isProcessing: ${this.isProcessing}`
    );

    if (this.isProcessing) {
      // This indicates an abnormal termination, like the handler itself being destroyed.
      logger.warn(
        `${this.getStateName()}: Destroyed during active processing for actor ${actorId}.`
      );
    }
    finishProcessing(this); // Ensure flag is cleared.

    await super.destroy(handler); // Call super.destroy which handles its own logging.
    logger.debug(
      `${this.getStateName()}: Destroy handling for actor ${actorId} complete.`
    );
  }
}
