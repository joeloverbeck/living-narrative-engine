// src/core/commandProcessor.js
// --- FILE START (Entire file content as corrected) ---

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('./interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('./interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/./IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

// --- Type Definitions ---

/**
 * @typedef {object} CommandResult
 * @description The structure returned by the processCommand method, indicating the outcome
 * of processing a single command input. Focuses on internal flow control.
 * @property {boolean} success - Indicates whether the command parsing and action *initiation* were successful.
 * Does NOT necessarily mean the action itself achieved its goal (check actionResult for that).
 * False indicates parsing errors, validation errors before execution, or critical exceptions.
 * @property {boolean} turnEnded - Indicates whether this command processing should conclude the actor's turn.
 * This is often determined by the action executed (e.g., moving usually ends a turn).
 * @property {ActionResult | null} [actionResult] - Optional. If an action was executed, this holds the detailed
 * result returned by the IActionExecutor.executeAction method. Null otherwise.
 * @property {string} [error] - Optional. A user-facing error message for failures *before* action execution (e.g., parsing) or critical internal errors.
 * @property {string} [internalError] - Optional. An internal-facing error message for logging failures.
 */

// --- Define the options object structure ---
/**
 * @typedef {object} CommandProcessorOptions
 * @property {ICommandParser} commandParser
 * @property {IActionExecutor} actionExecutor
 * @property {ILogger} logger
 * @property {IValidatedEventDispatcher} validatedEventDispatcher
 * @property {IWorldContext} worldContext
 * @property {EntityManager} entityManager
 * @property {GameDataRepository} gameDataRepository
 */

/**
 * Processes raw command strings: parses, validates, coordinates action execution,
 * and dispatches semantic events about the outcomes (e.g., `core:command_parse_failed`,
 * `core:action_executed`, `core:action_failed`, `core:system_error_occurred`).
 * Does NOT dispatch UI-specific events.
 *
 * @implements {ICommandProcessor}
 */
class CommandProcessor {
    /** @type {ICommandParser} */ #commandParser;
    /** @type {IActionExecutor} */ #actionExecutor;
    /** @type {ILogger} */ #logger;
    /** @type {IValidatedEventDispatcher} */ #validatedEventDispatcher;
    /** @type {IWorldContext} */ #worldContext;
    /** @type {EntityManager} */ #entityManager;
    /** @type {GameDataRepository} */ #gameDataRepository;

    /**
     * Constructor for CommandProcessor. Injects and validates required dependencies.
     * @param {CommandProcessorOptions} options - Configuration object containing all dependencies.
     */
    constructor(options) {
        const {
            commandParser,
            actionExecutor,
            logger,
            validatedEventDispatcher,
            worldContext,
            entityManager,
            gameDataRepository
        } = options || {};

        // --- Validate and Assign Logger FIRST ---
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function') {
            throw new Error('CommandProcessor requires a valid ILogger instance (with info, error, debug, warn methods).');
        }
        this.#logger = logger;

        // --- Validate Other Dependencies ---
        if (!commandParser || typeof commandParser.parse !== 'function') {
            this.#logger.error('CommandProcessor Constructor: Invalid or missing commandParser.');
            throw new Error('CommandProcessor requires a valid ICommandParser instance (with parse method).');
        }
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            this.#logger.error('CommandProcessor Constructor: Invalid or missing actionExecutor.');
            throw new Error('CommandProcessor requires a valid IActionExecutor instance (with executeAction method).');
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            this.#logger.error('CommandProcessor Constructor: Invalid or missing validatedEventDispatcher.');
            throw new Error('CommandProcessor requires a valid IValidatedEventDispatcher instance (with dispatchValidated method).');
        }
        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error('CommandProcessor Constructor: Invalid or missing worldContext.');
            throw new Error('CommandProcessor requires a valid IWorldContext instance (with getLocationOfEntity method).');
        }
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function' || typeof entityManager.addComponent !== 'function') {
            this.#logger.error('CommandProcessor Constructor: Invalid or missing entityManager.');
            throw new Error('CommandProcessor requires a valid EntityManager instance (with relevant methods like getEntityInstance, addComponent).');
        }
        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') {
            this.#logger.error('CommandProcessor Constructor: Invalid or missing gameDataRepository.');
            throw new Error('CommandProcessor requires a valid GameDataRepository instance (with getActionDefinition, etc.).');
        }

        // --- Assign Dependencies ---
        this.#commandParser = commandParser;
        this.#actionExecutor = actionExecutor;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#worldContext = worldContext;
        this.#entityManager = entityManager;
        this.#gameDataRepository = gameDataRepository;

        this.#logger.info("CommandProcessor: Instance created and dependencies validated.");
    }

    /**
     * Processes a command string. Parses, validates context, executes the action, and dispatches
     * semantic events reflecting the outcome.
     *
     * @param {Entity | null | undefined} actor - The entity submitting the command. Must have a string `id`.
     * @param {string | null | undefined} command - The raw command string.
     * @returns {Promise<CommandResult>} A promise resolving with the internal processing result.
     * @async
     */
    async processCommand(actor, command) {
        // --- 1. Input Validation ---
        if (!actor || typeof actor.id !== 'string') {
            this.#logger.error('CommandProcessor.processCommand: Invalid or missing actor entity provided.');
            return {
                success: false,
                turnEnded: false,
                internalError: 'Invalid actor provided to processCommand.',
                error: 'Internal error: Cannot process command without a valid actor.',
                actionResult: undefined
            };
        }
        const actorId = actor.id;

        const commandString = command ? String(command).trim() : '';
        if (!commandString) {
            this.#logger.warn(`CommandProcessor.processCommand: Empty or invalid command string provided by actor ${actorId}.`);
            return {
                success: false, turnEnded: false,
                error: undefined, internalError: undefined, actionResult: undefined
            };
        }

        this.#logger.info(`CommandProcessor: Processing command "${commandString}" for actor ${actorId}`);

        /** @type {ParsedCommand | null} */
        let parsedCommand = null;
        /** @type {ActionResult | undefined} */
        let actionResult = undefined;

        try {
            // --- 2. Parse Command ---
            this.#logger.debug(`CommandProcessor: Attempting to parse command: "${commandString}"`);
            parsedCommand = this.#commandParser.parse(commandString);
            this.#logger.debug(`CommandProcessor: Parsing complete. Result: ${JSON.stringify(parsedCommand)}`);

            if (parsedCommand.error) {
                const parsingError = parsedCommand.error;
                this.#logger.warn(`CommandProcessor: Parsing failed for command "${commandString}" by actor ${actorId}. Error: ${parsingError}`);
                await this.#dispatchWithErrorHandling('core:command_parse_failed', {
                    actorId: actorId, commandString: commandString, error: parsingError
                }, 'core:command_parse_failed');
                return {
                    success: false, turnEnded: false,
                    error: parsingError, internalError: `Parsing Error: ${parsingError}`, actionResult: undefined
                };
            }

            const actionId = parsedCommand.actionId;
            this.#logger.debug(`CommandProcessor: Parsing successful for command "${commandString}", action ID: ${actionId}. Proceeding to build context...`);

            // --- 3. Build Action Context ---
            let currentLocation = null;
            try {
                currentLocation = this.#worldContext.getLocationOfEntity(actorId);
                if (!currentLocation) {
                    const internalMsg = `getLocationOfEntity returned null for actor ${actorId}.`;
                    this.#logger.error(`CommandProcessor: Could not find current location entity for actor ${actorId}. WorldContext.getLocationOfEntity returned null.`);
                    const userMsg = 'Internal error: Your current location is unknown.';
                    await this.#dispatchSystemError(userMsg, internalMsg);
                    return {
                        success: false,
                        turnEnded: false,
                        error: userMsg,
                        internalError: internalMsg,
                        actionResult: undefined
                    };
                }
                this.#logger.debug(`CommandProcessor: Successfully fetched current location ${currentLocation.id} for actor ${actorId}.`);
            } catch (locationError) {
                const internalMsg = `Failed to get current location for actor ${actorId} using getLocationOfEntity: ${locationError.message}`;
                this.#logger.error(`CommandProcessor: Error fetching current location for actor ${actorId} using getLocationOfEntity. Error: ${locationError.message}`, locationError);
                const userMsg = 'Internal error: Could not determine your current location.';
                await this.#dispatchSystemError(userMsg, internalMsg, locationError);
                return {
                    success: false,
                    turnEnded: false,
                    error: userMsg,
                    internalError: internalMsg,
                    actionResult: undefined
                };
            }

            /** -----------------------------------------------------------
             *  Build the ActionContext that is passed to ActionExecutor
             *  -----------------------------------------------------------
             *  - playerEntity   – what TargetResolutionService expects
             *  - eventBus       – shim that forwards to ValidatedEventDispatcher
             *  - validatedEventDispatcher kept for other services
             */
            /** @type {ActionContext} */
            const actionContext = {
                actingEntity: actor,
                currentLocation: currentLocation,
                parsedCommand: parsedCommand,
                gameDataRepository: this.#gameDataRepository,
                entityManager: this.#entityManager,

                // TargetResolutionService still calls  eventBus.dispatch(...)
                eventBus: {
                    dispatch: (eventName, payload) =>
                        this.#validatedEventDispatcher.dispatchValidated(eventName, payload)
                },

                // keep direct access in case other code wants it
                validatedEventDispatcher: this.#validatedEventDispatcher,

                logger: this.#logger,
                worldContext: this.#worldContext
            };

            this.#logger.debug(
                `CommandProcessor: ActionContext built successfully for actor ${actorId}: `
                + JSON.stringify({
                    playerEntityId: actor.id,
                    currentLocationId: currentLocation.id,
                    actionId: parsedCommand.actionId
                })
            );

            // --- 4. Execute Action ---
            let executionSuccessful = false; // Track if action execution completed without exception
            let dispatchSuccessful = true; // Track if VED dispatch succeeds
            try {
                this.#logger.debug(`CommandProcessor: Attempting to execute action ${actionId} for actor ${actorId}.`);
                actionResult = await this.#actionExecutor.executeAction(actionId, actionContext);
                executionSuccessful = true; // Reached here means no exception from executeAction

                if (!actionResult || typeof actionResult.success !== 'boolean') {
                    const internalMsg = `ActionExecutor returned an invalid result structure for action ${actionId}. Result: ${JSON.stringify(actionResult)}`;
                    this.#logger.error(`CommandProcessor: ${internalMsg}`);
                    const userMsg = `An internal error occurred while performing the action.`;
                    await this.#dispatchWithErrorHandling('core:action_failed', {
                        actorId: actorId, actionId: actionId, commandString: commandString,
                        error: userMsg, isExecutionError: true, details: internalMsg
                    }, 'core:action_failed');
                    return {
                        success: false,
                        turnEnded: false,
                        error: userMsg,
                        internalError: internalMsg,
                        actionResult: undefined
                    };
                }

                this.#logger.debug(`CommandProcessor: Action executor returned result for action ${actionId}: ${JSON.stringify(actionResult)}`);

                // --- 5. Process ActionResult & Dispatch Events ---
                const turnEnded = actionResult.endsTurn === false ? false : true; // Default to true if undefined
                if (actionResult.success) {
                    // ** FIX: Capture dispatch result **
                    dispatchSuccessful = await this.#dispatchWithErrorHandling('core:action_executed', {
                        actorId: actorId, actionId: actionId, commandString: commandString, result: actionResult
                    }, 'core:action_executed');

                    // Log the outcome based on action result first
                    this.#logger.info(`CommandProcessor: Action ${actionId} processed for actor ${actorId}. CommandResult: { success: true, turnEnded: ${turnEnded} }`);

                    return {
                        success: dispatchSuccessful, // ** FIX: Overall success depends on successful dispatch **
                        turnEnded: turnEnded,
                        error: dispatchSuccessful ? null : 'Internal error: Failed to finalize action success.',
                        internalError: dispatchSuccessful ? null : `Error dispatching core:action_executed: VED failed (see logs).`, // Adjusted internal message
                        actionResult: actionResult
                    };

                } else { // actionResult.success is false (Logical failure reported by the action)
                    const failureMsg = actionResult.messages?.find(m => m.type === 'error')?.text || actionResult.messages?.[0]?.text || `Action '${actionId}' failed.`;

                    // ** FIX: Capture dispatch result **
                    dispatchSuccessful = await this.#dispatchWithErrorHandling('core:action_failed', {
                        actorId: actorId, actionId: actionId, commandString: commandString,
                        error: failureMsg, isExecutionError: false, actionResult: actionResult
                    }, 'core:action_failed');

                    this.#logger.info(`CommandProcessor: Action ${actionId} processed for actor ${actorId}. CommandResult: { success: false, turnEnded: ${turnEnded} } (Logical failure)`);
                    return {
                        success: false, // Logical failures are not considered overall success, regardless of dispatch status
                        turnEnded: turnEnded,
                        error: null,
                        internalError: `Action ${actionId} failed. See actionResult for details.` + (!dispatchSuccessful ? ' Additionally, VED dispatch failed.' : ''),
                        actionResult: actionResult
                    };
                }

            } catch (executionError) {
                // This catch block handles exceptions *during* executeAction or *during* the internal context.dispatch call
                if (executionSuccessful) {
                    // Error must have occurred during result processing or dispatch (already logged by dispatch helper)
                    // This path shouldn't normally be hit due to the structure, but as a safeguard:
                    this.#logger.error(`CommandProcessor: Unexpected error after successful execution but before returning for action ${actionId}. Error: ${executionError.message}`, executionError);
                    return {
                        success: false,
                        turnEnded: actionResult?.endsTurn ?? false,
                        error: 'Internal processing error after action.',
                        internalError: `Post-execution error: ${executionError.message}`,
                        actionResult: actionResult
                    };
                } else {
                    // Exception came directly from actionExecutor.executeAction or context.dispatch
                    const actionIdContext = parsedCommand?.actionId ?? 'unknown action';
                    // Distinguish between direct execution error and internal dispatch error
                    const isInternalDispatchError = executionError.message.includes('internal event dispatch');
                    const internalMsgPrefix = isInternalDispatchError
                        ? `Exception during action execution (${actionIdContext}): ` // Keep prefix indicating origin
                        : `Exception during action execution (${actionIdContext}): `;
                    const internalMsg = `${internalMsgPrefix}${executionError.message}. Stack: ${executionError.stack}`;

                    this.#logger.error(`CommandProcessor: Exception occurred during execution of action ${actionIdContext} for actor ${actorId}. Error: ${executionError.message}`, executionError);
                    const userFacingError = `An internal error occurred while performing the action.`;
                    await this.#dispatchWithErrorHandling('core:action_failed', {
                        actorId: actorId, actionId: actionIdContext, commandString: commandString,
                        error: userFacingError, isExecutionError: true, details: internalMsg
                    }, 'core:action_failed');
                    return {
                        success: false, turnEnded: false, // Turn doesn't end on execution exception
                        error: userFacingError, internalError: internalMsg, actionResult: undefined
                    };
                }
            }

        } catch (error) {
            // Catch errors from parsing, context building (outside specific location lookup)
            const internalMsg = `Critical error during command processing: ${error.message}. Stack: ${error.stack}`;
            this.#logger.error(`CommandProcessor: CRITICAL error processing command "${commandString}" for actor ${actorId}. Error: ${error.message}`, error);
            const criticalErrorMsg = "An unexpected internal error occurred while processing your command.";
            await this.#dispatchSystemError(criticalErrorMsg, internalMsg, error);
            return {
                success: false, turnEnded: false,
                error: criticalErrorMsg, internalError: internalMsg, actionResult: undefined
            };
        }
    }

    /**
     * Helper to dispatch an event and log errors if dispatch fails.
     * @param {string} eventName - The name of the event to dispatch.
     * @param {object} payload - The event payload.
     * @param {string} contextName - Name for logging purposes (e.g., the event name again).
     * @returns {Promise<boolean>} True if dispatch succeeded, false otherwise.
     * @private
     */
    async #dispatchWithErrorHandling(eventName, payload, contextName) {
        try {
            await this.#validatedEventDispatcher.dispatchValidated(eventName, payload);
            this.#logger.debug(`Dispatched ${contextName} event successfully.`);
            return true; // Indicate success
        } catch (dispatchError) {
            // ** FIX: Use the consistent logging format seen in test failures **
            this.#logger.error(`Failed to dispatch ${contextName} event: ${dispatchError.message}`, dispatchError);
            return false; // Indicate failure
        }
    }

    /**
     * Helper to dispatch a system error event and log details.
     * @param {string} userMessage - The user-facing error message.
     * @param {string} internalDetails - The internal error details for logging.
     * @param {Error} [originalError] - The original error object, if available.
     * @returns {Promise<void>}
     * @private
     */
    async #dispatchSystemError(userMessage, internalDetails, originalError = null) {
        const payload = {
            message: userMessage, type: 'error', details: internalDetails
        };
        // Log the context of the system error first
        if (originalError) {
            this.#logger.error(`System Error Context: ${internalDetails}`, originalError);
        } else {
            this.#logger.error(`System Error Context: ${internalDetails}`);
        }
        // Attempt to dispatch the system error event
        const dispatchSuccess = await this.#dispatchWithErrorHandling('core:system_error_occurred', payload, 'core:system_error_occurred');

        // ** FIX: Add specific log if the *system error dispatch itself* fails **
        if (!dispatchSuccess) {
            // Extract dispatch error message if possible (it's caught inside #dispatchWithErrorHandling)
            const dispatchErrorMsg = "VED dispatch failed (see previous log)"; // Generic reference
            this.#logger.error(`CommandProcessor: CRITICAL - Failed to dispatch system error event via VED. Original Error: ${originalError?.message ?? internalDetails}. Dispatch Error: ${dispatchErrorMsg}`);
        }
    }
}

export default CommandProcessor;
// --- FILE END ---