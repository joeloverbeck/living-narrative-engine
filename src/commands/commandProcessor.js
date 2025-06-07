// src/commands/commandProcessor.js

// --- Static Imports ---
import ResolutionStatus from '../types/resolutionStatus.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor_Interface */
/** @typedef {import('./interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/targeting/targetResolutionService.js').default} TargetResolutionService_Default */
/** @typedef {import('../actions/targeting/targetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../actions/targeting/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */

// --- Type Definitions ---
/**
 * @typedef {object} CommandResult
 * @description The structure returned by the processCommand method.
 * @property {boolean} success - True if core:attempt_action was dispatched successfully. False for pipeline errors.
 * @property {boolean} turnEnded - For successes, this will be false (rules dictate turn end).
 * For failures within CommandProcessor, this will now be true.
 * @property {string} [originalInput] - The original trimmed command string.
 * @property {object} [actionResult] - Additional results, primarily the specific actionId.
 * @property {string} [actionResult.actionId] - The canonical actionId that was processed.
 * @property {string} [error] - User-facing error message for failures.
 * @property {string} [internalError] - Internal error message for logging.
 * @property {Array<{text: string, type?: string}>} [actionResult.messages] - Messages from the action.
 * @property {string} [message] - General message from CommandProcessor.
 */

/** @typedef {import('./commandProcessor.js').CommandProcessorOptions} CommandProcessorOptions */
/** @typedef {import('./commandProcessor.js').ValidateInputResult} ValidateInputResult */
/** @typedef {import('./commandProcessor.js').ParseCommandResult} ParseCommandResult */
/** @typedef {import('./commandProcessor.js').FetchActionDefinitionResult} FetchActionDefinitionResult */
/** @typedef {import('./commandProcessor.js').FetchLocationContextResult} FetchLocationContextResult */
/** @typedef {import('./commandProcessor.js').TargetOutcome} TargetOutcome */

/** @typedef {import('./commandProcessor.js').DispatchAttemptOutcome} DispatchAttemptOutcome */

/**
 * @description Processes raw command strings from actors.
 * @implements {ICommandProcessor_Interface}
 */
class CommandProcessor {
  /** @type {ICommandParser} */ #commandParser;
  /** @type {ITargetResolutionService} */ #targetResolutionService;
  /** @type {ILogger} */ #logger;
  /** @type {IValidatedEventDispatcher} */ #validatedEventDispatcher;
  /** @type {ISafeEventDispatcher} */ #safeEventDispatcher;
  /** @type {IWorldContext} */ #worldContext;
  /** @type {IEntityManager} */ #entityManager;
  /** @type {IGameDataRepository} */ #gameDataRepository;

  #_validateDependency(dependency, dependencyName, requiredMethods = []) {
    if (!dependency) {
      const errorMsg = `CommandProcessor Constructor: Missing required dependency: ${dependencyName}.`;
      if (this.#logger && this.#logger !== dependency) {
        this.#logger.error(errorMsg);
      } else if (this.#logger !== dependency) {
        console.error(errorMsg);
      }
      throw new Error(errorMsg);
    }
    for (const method of requiredMethods) {
      if (typeof dependency[method] !== 'function') {
        const errorMsg = `CommandProcessor Constructor: Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
        if (this.#logger && this.#logger !== dependency) {
          this.#logger.error(errorMsg);
        } else if (this.#logger !== dependency) {
          console.error(errorMsg);
        }
        throw new Error(errorMsg);
      }
    }
  }

  constructor(options) {
    const {
      commandParser,
      targetResolutionService,
      logger,
      validatedEventDispatcher,
      safeEventDispatcher,
      worldContext,
      entityManager,
      gameDataRepository,
    } = options || {};

    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function'
    ) {
      const errorMsg =
        'CommandProcessor Constructor: CRITICAL - Invalid or missing ILogger instance.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#logger = logger;

    try {
      this.#_validateDependency(commandParser, 'commandParser', ['parse']);
      this.#_validateDependency(
        targetResolutionService,
        'targetResolutionService',
        ['resolveActionTarget']
      );
      this.#_validateDependency(
        validatedEventDispatcher,
        'validatedEventDispatcher',
        ['dispatch']
      ); // Used by ActionContext shim
      this.#_validateDependency(safeEventDispatcher, 'safeEventDispatcher', [
        'dispatch',
      ]);
      this.#_validateDependency(worldContext, 'worldContext', [
        'getLocationOfEntity',
      ]);
      this.#_validateDependency(entityManager, 'entityManager', [
        'getEntityInstance',
      ]);
      this.#_validateDependency(gameDataRepository, 'gameDataRepository', [
        'getActionDefinition',
      ]);
    } catch (error) {
      this.#logger.error(
        `CommandProcessor Constructor: Dependency validation failed. ${error.message}`
      );
      throw error;
    }

    this.#commandParser = commandParser;
    this.#targetResolutionService = targetResolutionService;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#worldContext = worldContext;
    this.#entityManager = entityManager;
    this.#gameDataRepository = gameDataRepository;

    this.#logger.info(
      'CommandProcessor: Instance created and dependencies validated.'
    );
  }

  #_createFailureResult(userError, internalError, turnEnded = true) {
    const result = {
      success: false,
      turnEnded: turnEnded,
      internalError: internalError,
      originalInput: undefined,
      actionResult: undefined,
    };
    if (userError !== undefined) {
      result.error = userError;
    }
    return result;
  }

  #_validateInput(actor, command) {
    if (!actor || typeof actor.id !== 'string') {
      this.#logger.error(
        'CommandProcessor.#_validateInput: Invalid or missing actor.'
      );
      return {
        isValid: false,
        actorId: null,
        trimmedCommand: null,
        errorResult: this.#_createFailureResult(
          'Internal error: Invalid actor.',
          'Invalid or missing actor provided.'
        ),
      };
    }
    const actorId = actor.id;
    const trimmedCommand = command ? String(command).trim() : '';

    if (!trimmedCommand) {
      this.#logger.warn(
        `CommandProcessor.#_validateInput: Empty command by ${actorId}.`
      );
      const failureResult = this.#_createFailureResult(
        undefined,
        'Empty command string.'
      );
      failureResult.originalInput = '';
      return {
        isValid: false,
        actorId: actorId,
        trimmedCommand: null,
        errorResult: failureResult,
      };
    }
    return {
      isValid: true,
      actorId: actorId,
      trimmedCommand: trimmedCommand,
      errorResult: null,
    };
  }

  async #_parseCommand(actorId, commandString) {
    this.#logger.debug(
      `CommandProcessor.#_parseCommand: Parsing: "${commandString}" for ${actorId}`
    );
    const parsedCommand = this.#commandParser.parse(commandString);
    this.#logger.debug(
      `CommandProcessor.#_parseCommand: Parsed: ${JSON.stringify(parsedCommand)}`
    );

    if (parsedCommand.error) {
      const parsingError = parsedCommand.error;
      this.#logger.warn(
        `CommandProcessor.#_parseCommand: Parse fail for "${commandString}" by ${actorId}. Error: ${parsingError}`
      );
      // Dispatching core:command_parse_failed if desired
      // await this.#dispatchWithErrorHandling('core:command_parse_failed', { actorId, commandString, error: parsingError }, 'core:command_parse_failed');
      const failureResult = this.#_createFailureResult(
        parsingError,
        `Parsing Error: ${parsingError}`
      );
      failureResult.originalInput = commandString;
      return { parsedCommand: null, errorResult: failureResult };
    }

    if (!parsedCommand.actionId) {
      const internalMsg = `No actionId from parse of "${commandString}" by ${actorId}. Output: ${JSON.stringify(parsedCommand)}`;
      const userMsg = 'Could not understand the command.';
      this.#logger.warn(`CommandProcessor.#_parseCommand: ${internalMsg}`);
      // await this.#dispatchWithErrorHandling('core:command_parse_failed', { actorId, commandString, error: userMsg }, 'core:command_parse_failed');
      const failureResult = this.#_createFailureResult(userMsg, internalMsg);
      failureResult.originalInput = commandString;
      return { parsedCommand: null, errorResult: failureResult };
    }
    this.#logger.debug(
      `CommandProcessor.#_parseCommand: Parse OK for "${commandString}", actionId: ${parsedCommand.actionId}.`
    );
    return { parsedCommand: parsedCommand, errorResult: null };
  }

  async #_fetchActionDefinition(actionId, actorId, originalInput) {
    this.#logger.debug(
      `CommandProcessor.#_fetchActionDefinition: Fetching ActionDef for '${actionId}'.`
    );
    const actionDefinition =
      this.#gameDataRepository.getActionDefinition(actionId);

    if (!actionDefinition) {
      const internalMsg = `ActionDefinition not found for '${actionId}' (actor: ${actorId}).`;
      const userMsg = 'Internal error: Action definition missing.';
      this.#logger.error(
        `CommandProcessor.#_fetchActionDefinition: ${internalMsg}`
      );
      await this.#dispatchSystemError(userMsg, internalMsg);
      const failureResult = this.#_createFailureResult(userMsg, internalMsg);
      failureResult.originalInput = originalInput;
      if (actionId) failureResult.actionResult = { actionId: actionId };
      return { actionDefinition: null, errorResult: failureResult };
    }
    this.#logger.debug(
      `CommandProcessor.#_fetchActionDefinition: Found ActionDef for '${actionId}'.`
    );
    return { actionDefinition: actionDefinition, errorResult: null };
  }

  async #_fetchLocationContext(actorId, actionDefinition, originalInput) {
    let currentLocation = null;
    try {
      currentLocation = this.#worldContext.getLocationOfEntity(actorId);
      if (
        !currentLocation &&
        actionDefinition.target_domain !== 'none' &&
        actionDefinition.target_domain !== 'self'
      ) {
        const internalMsg = `Actor ${actorId} has no location, but action '${actionDefinition.id}' needs it.`;
        const userMsg = 'Your location is unknown for this action.';
        this.#logger.error(
          `CommandProcessor.#_fetchLocationContext: ${internalMsg}`
        );
        await this.#dispatchSystemError(userMsg, internalMsg);
        const failureResult = this.#_createFailureResult(userMsg, internalMsg);
        failureResult.originalInput = originalInput;
        failureResult.actionResult = { actionId: actionDefinition.id };
        return { currentLocation: null, errorResult: failureResult };
      }
      this.#logger.debug(
        `CommandProcessor.#_fetchLocationContext: Location for ${actorId}: ${currentLocation?.id ?? 'None'}. Action '${actionDefinition.id}' domain: '${actionDefinition.target_domain}'.`
      );
      return { currentLocation: currentLocation, errorResult: null };
    } catch (error) {
      const internalMsg = `Error fetching location for ${actorId}: ${error.message}`;
      const userMsg = 'Internal error determining location.';
      this.#logger.error(
        `CommandProcessor.#_fetchLocationContext: ${internalMsg}`,
        error
      );
      await this.#dispatchSystemError(userMsg, internalMsg, error);
      const failureResult = this.#_createFailureResult(userMsg, internalMsg);
      failureResult.originalInput = originalInput;
      failureResult.actionResult = { actionId: actionDefinition.id };
      return { currentLocation: null, errorResult: failureResult };
    }
  }

  #_buildActionContext(actorEntity, currentLocation, parsedCommand) {
    this.#logger.debug(
      `CommandProcessor.#_buildActionContext: Actor: ${actorEntity.id}, Location: ${currentLocation?.id ?? 'null'}, Command: ${parsedCommand.actionId}`
    );
    const actionContext = {
      actingEntity: actorEntity,
      currentLocation: currentLocation,
      parsedCommand: parsedCommand,
      gameDataRepository: this.#gameDataRepository,
      entityManager: this.#entityManager,
      eventBus: {
        dispatch: async (eventName, payload) => {
          if (eventName === 'textUI:display_message') {
            this.#logger.debug(
              `CommandProcessor (Shim): Dispatching '${eventName}' via VED.`
            );
            // The VED expects eventName as first param, payload as second.
            // If the shim's payload contains eventName, it might conflict if VED also expects it separately.
            // Assuming payload here is the actual data for textUI:display_message.
            return this.#validatedEventDispatcher.dispatch(eventName, payload);
          } else {
            this.#logger.warn(
              `CommandProcessor (Shim): Unsupported event '${eventName}'. Ignoring.`
            );
            return false;
          }
        },
      },
      validatedEventDispatcher: this.#validatedEventDispatcher,
      logger: this.#logger,
      worldContext: this.#worldContext,
    };
    this.#logger.debug(
      `CommandProcessor.#_buildActionContext: ActionContext built.`
    );
    return actionContext;
  }

  async #_resolveTarget(actionDefinition, actionContext, originalInput) {
    this.#logger.debug(
      `CommandProcessor.#_resolveTarget: Resolving target for action '${actionDefinition.id}'...`
    );
    const resolutionResult =
      await this.#targetResolutionService.resolveActionTarget(
        actionDefinition,
        actionContext
      );
    const {
      status,
      targetType,
      targetId,
      error: resolverErrorMsg,
    } = resolutionResult;
    this.#logger.debug(
      `CommandProcessor.#_resolveTarget: Resolution done. Status: ${status}, Type: ${targetType}, TargetID: ${targetId}`
    );

    const isSuccessfulResolution =
      status === ResolutionStatus.FOUND_UNIQUE ||
      status === ResolutionStatus.SELF ||
      (status === ResolutionStatus.NONE &&
        actionDefinition.target_domain === 'none');

    if (!isSuccessfulResolution) {
      const internalMsg = `Target resolution fail for '${actionDefinition.id}' by ${actionContext.actingEntity.id}. Status: ${status}. Resolver Error: ${resolverErrorMsg || 'None'}`;
      const userError = resolverErrorMsg
        ? `Target error: ${resolverErrorMsg}`
        : `Target unclear or invalid (Status: ${status}).`;
      this.#logger.warn(`CommandProcessor.#_resolveTarget: ${internalMsg}`);
      const failureResult = this.#_createFailureResult(userError, internalMsg);
      failureResult.originalInput = originalInput;
      failureResult.actionResult = { actionId: actionDefinition.id };
      return { resolutionResult: resolutionResult, errorResult: failureResult };
    }
    this.#logger.debug(
      `CommandProcessor.#_resolveTarget: Target resolution successful.`
    );
    return { resolutionResult: resolutionResult, errorResult: null };
  }

  async #_dispatchActionAttempt(
    actorId,
    actionIdFromDefinition,
    resolutionResult,
    originalCommandString
  ) {
    // CORRECTED: Ensure payload includes eventName as per schema for core:attempt_action
    const payload = {
      eventName: 'core:attempt_action', // Required by schema
      actorId: actorId,
      actionId: actionIdFromDefinition,
      targetId:
        resolutionResult.targetType === 'entity' ||
        resolutionResult.targetType === 'self'
          ? resolutionResult.targetId
          : null,
      direction:
        resolutionResult.targetType === 'direction'
          ? resolutionResult.targetId
          : null,
      originalInput: originalCommandString,
    };

    this.#logger.info(
      `CommandProcessor.#_dispatchActionAttempt: Dispatching core:attempt_action for "${originalCommandString}".`
    );
    this.#logger.debug(
      `CommandProcessor.#_dispatchActionAttempt: core:attempt_action payload: ${JSON.stringify(payload)}`
    );

    // Pass the eventName and the constructed payload separately to dispatchWithErrorHandling
    const dispatchSuccess = await this.#dispatchWithErrorHandling(
      'core:attempt_action',
      payload,
      'core:attempt_action dispatch'
    );

    if (dispatchSuccess) {
      this.#logger.info(
        `CommandProcessor.#_dispatchActionAttempt: Dispatched core:attempt_action successfully for "${originalCommandString}" by ${actorId}.`
      );
      return { success: true, errorResult: null };
    } else {
      const internalMsg = `CRITICAL: Failed to dispatch core:attempt_action for ${actorId}, cmd "${originalCommandString}". Dispatcher reported failure.`;
      const userMsg = 'Internal error: Failed to initiate action.';
      this.#logger.error(
        `CommandProcessor.#_dispatchActionAttempt: ${internalMsg}`
      );
      // #dispatchSystemError is already called by #dispatchWithErrorHandling if dispatch fails and logs
      // So, we might not need to call it again here, but ensure the errorResult is correct.
      // However, #dispatchWithErrorHandling doesn't call #dispatchSystemError for a 'false' return from dispatch, only for exceptions *during* dispatch.
      // So, if dispatch returns false (VED failure), we should dispatch a system error.
      await this.#dispatchSystemError(
        userMsg,
        `Failed to dispatch core:attempt_action (VED validation likely). Payload: ${JSON.stringify(payload)}`
      );
      const failureResult = this.#_createFailureResult(userMsg, internalMsg);
      failureResult.originalInput = originalCommandString;
      failureResult.actionResult = { actionId: actionIdFromDefinition };
      return { success: false, errorResult: failureResult };
    }
  }

  async processCommand(actor, command) {
    const validation = this.#_validateInput(actor, command);
    if (!validation.isValid)
      return /** @type {CommandResult} */ (validation.errorResult);

    const actorId = /** @type {string} */ (validation.actorId);
    const trimmedCommand = /** @type {string} */ (validation.trimmedCommand);
    const validActor = /** @type {Entity} */ (actor);

    this.#logger.info(
      `CommandProcessor: Processing command "${trimmedCommand}" for actor ${actorId}`
    );

    try {
      const parsingOutcome = await this.#_parseCommand(actorId, trimmedCommand);
      if (parsingOutcome.errorResult) return parsingOutcome.errorResult;
      const parsedCommand = /** @type {ParsedCommand} */ (
        parsingOutcome.parsedCommand
      );

      const definitionOutcome = await this.#_fetchActionDefinition(
        parsedCommand.actionId,
        actorId,
        trimmedCommand
      );
      if (definitionOutcome.errorResult) return definitionOutcome.errorResult;
      const actionDefinition = /** @type {ActionDefinition} */ (
        definitionOutcome.actionDefinition
      );

      const locationOutcome = await this.#_fetchLocationContext(
        actorId,
        actionDefinition,
        trimmedCommand
      );
      if (locationOutcome.errorResult) return locationOutcome.errorResult;
      const currentLocation = locationOutcome.currentLocation;

      const actionContext = this.#_buildActionContext(
        validActor,
        currentLocation,
        parsedCommand
      );

      const targetOutcome = await this.#_resolveTarget(
        actionDefinition,
        actionContext,
        trimmedCommand
      );
      if (targetOutcome.errorResult) return targetOutcome.errorResult;
      const resolutionResult = /** @type {TargetResolutionResult} */ (
        targetOutcome.resolutionResult
      );

      const dispatchOutcome = await this.#_dispatchActionAttempt(
        actorId,
        actionDefinition.id, // Use canonical ID from definition
        resolutionResult,
        trimmedCommand
      );

      if (dispatchOutcome.success) {
        this.#logger.info(
          `CommandProcessor: Successfully processed and dispatched action for "${trimmedCommand}" by ${actorId}.`
        );
        return {
          success: true,
          turnEnded: false,
          originalInput: trimmedCommand,
          actionResult: { actionId: actionDefinition.id },
        };
      } else {
        // errorResult from dispatchOutcome should already have turnEnded: true
        // and other relevant fields like originalInput and actionId.
        return /** @type {CommandResult} */ (dispatchOutcome.errorResult);
      }
    } catch (error) {
      const internalMsg = `Critical unexpected error during command processing for "${trimmedCommand}" by ${actorId}: ${error.message}.`;
      this.#logger.error(
        `CommandProcessor: CRITICAL UNEXPECTED ERROR. ${internalMsg}`,
        error
      );
      const criticalUserErrorMsg = 'An unexpected internal error occurred.';
      await this.#dispatchSystemError(criticalUserErrorMsg, internalMsg, error);
      const failureResult = this.#_createFailureResult(
        criticalUserErrorMsg,
        internalMsg,
        true
      );
      failureResult.originalInput = trimmedCommand;
      failureResult.actionResult = {
        actionId: 'core:unknown_action_due_to_critical_error',
      };
      return failureResult;
    }
  }

  async #dispatchWithErrorHandling(eventName, payload, loggingContextName) {
    this.#logger.debug(
      `CommandProcessor.#dispatchWithErrorHandling: Attempting dispatch: ${loggingContextName} ('${eventName}')`
    );
    try {
      // The SafeEventDispatcher.dispatch expects (eventName, payload)
      // The payload here should NOT contain 'eventName' if the schema for 'eventName'
      // (e.g. core:attempt_action) requires 'eventName' within its payload.
      // If the schema for event 'eventName' *requires* an 'eventName' field inside its payload,
      // then 'payload' variable must already contain it.
      // The VED error "must have required property 'eventName'" means the payload passed to VED
      // was missing it.
      // The 'payload' constructed in #_dispatchActionAttempt *does* include eventName.

      const success = await this.#safeEventDispatcher.dispatch(
        eventName,
        payload
      );

      if (success) {
        this.#logger.debug(
          `CommandProcessor.#dispatchWithErrorHandling: Dispatch successful for ${loggingContextName}.`
        );
      } else {
        // This 'else' means dispatch returned false, likely because VED returned false.
        this.#logger.warn(
          `CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${loggingContextName} (likely VED validation failure). Payload: ${JSON.stringify(payload)}`
        );
      }
      return success;
    } catch (dispatchError) {
      this.#logger.error(
        `CommandProcessor.#dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${loggingContextName}. Error: ${dispatchError.message}`,
        dispatchError
      );
      // If dispatch itself throws, it's a more fundamental issue.
      await this.#dispatchSystemError(
        'System error during event dispatch.',
        `Exception in dispatch for ${eventName}`,
        dispatchError
      );
      return false;
    }
  }

  async #dispatchSystemError(
    userMessage,
    internalDetails,
    originalError = null
  ) {
    // Payload for core:system_error_occurred does NOT include eventName within it.
    const payload = {
      message: userMessage,
      details: {
        raw: internalDetails,
        timestamp: new Date().toISOString(),
      },
    };
    if (originalError?.stack) {
      payload.details.stack = originalError.stack;
    }

    if (originalError) {
      this.#logger.error(
        `CommandProcessor System Error: ${internalDetails}. Original Error: ${originalError.message}`,
        originalError
      );
    } else {
      this.#logger.error(`CommandProcessor System Error: ${internalDetails}`);
    }

    const dispatchSuccess = await this.#safeEventDispatcher.dispatch(
      SYSTEM_ERROR_OCCURRED_ID,
      payload
    );

    if (!dispatchSuccess) {
      this.#logger.error(
        `CommandProcessor: CRITICAL FAILURE - Failed to dispatch SYSTEM_ERROR_OCCURRED_ID event itself. Context: UserMessage='${userMessage}', InternalDetails='${internalDetails}'.`
      );
    }
  }
}

export default CommandProcessor;
