// src/core/commandProcessor.js

// --- Static Imports ---
import ResolutionStatus from '../types/resolutionStatus.js';

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('./interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('./interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('./interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../services/targetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
// Note: ResolutionStatus is now directly imported, so its JSDoc typedef here is for documentation clarity if still desired, but not for type functionality within this file.
// /** @typedef {import('../services/targetResolutionService.js').ResolutionStatus} ResolutionStatus */


// --- Type Definitions ---
/**
 * @typedef {object} CommandResult
 * @description The structure returned by the processCommand method, indicating the outcome
 * of processing a single command input. Focuses on internal flow control.
 * @property {boolean} success - Indicates whether the command parsing, target resolution, and action *attempt dispatch* were successful.
 * False indicates errors during parsing, resolution, dispatch, or critical exceptions.
 * @property {boolean} turnEnded - Indicates whether this command processing should conclude the actor's turn.
 * @property {string} [error] - Optional. A user-facing error message for failures *before* action attempt dispatch (e.g., parsing, target resolution) or critical internal errors.
 * @property {string} [internalError] - Optional. An internal-facing error message for logging failures.
 */

/**
 * @typedef {object} CommandProcessorOptions
 * @description Configuration object required by the CommandProcessor constructor.
 * @property {ICommandParser} commandParser - Service for parsing raw command strings.
 * @property {ITargetResolutionService} targetResolutionService - Service for resolving targets of actions.
 * @property {ILogger} logger - Service for logging messages.
 * @property {IValidatedEventDispatcher} validatedEventDispatcher - Service for dispatching events that require schema validation (used within ActionContext).
 * @property {ISafeEventDispatcher} safeEventDispatcher - Service for dispatching events with error handling.
 * @property {IWorldContext} worldContext - Service for accessing world state, like entity locations.
 * @property {IEntityManager} entityManager - Service for managing entity instances.
 * @property {IGameDataRepository} gameDataRepository - Service for accessing game data definitions (e.g., actions).
 */

/**
 * @typedef {object} ValidateInputResult
 * @description The result of the initial input validation.
 * @property {boolean} isValid - True if validation passes, false otherwise.
 * @property {string | null} actorId - Contains actor.id if valid and actor is provided.
 * @property {string | null} trimmedCommand - Contains the trimmed command string if valid.
 * @property {CommandResult | null} errorResult - Contains the CommandResult object if validation fails, otherwise null.
 */

/**
 * @typedef {object} ParseCommandResult
 * @description The result of a command parsing attempt.
 * @property {ParsedCommand | null} parsedCommand - The successfully parsed command, or null on error.
 * @property {CommandResult | null} errorResult - A CommandResult object if parsing failed, otherwise null.
 */

/**
 * @typedef {object} FetchActionDefinitionResult
 * @description The result of fetching an action definition.
 * @property {ActionDefinition | null} actionDefinition - The fetched action definition, or null on error.
 * @property {CommandResult | null} errorResult - A CommandResult object if fetching failed, otherwise null.
 */

/**
 * @typedef {object} FetchLocationContextResult
 * @description The result of fetching an actor's location context.
 * @property {Entity | null} currentLocation - The actor's current location, or null if not found or not applicable for the action.
 * @property {CommandResult | null} errorResult - A CommandResult object if an error occurred during fetching, otherwise null.
 */

/**
 * @typedef {object} TargetOutcome
 * @description The outcome of a target resolution attempt.
 * @property {TargetResolutionResult | null} resolutionResult - The result of the target resolution. Null if resolution itself produced an error handled by `errorResult`.
 * @property {CommandResult | null} errorResult - A CommandResult object if target resolution failed with an error that should halt processing, otherwise null.
 */

/**
 * @typedef {object} DispatchAttemptOutcome
 * @description The outcome of attempting to dispatch the `core:attempt_action` event.
 * @property {boolean} success - True if the `core:attempt_action` event was dispatched successfully via the safe event dispatcher.
 * @property {CommandResult | null} errorResult - If dispatch failed, this contains the CommandResult with error details. Null on successful dispatch.
 */

/**
 * @description Processes raw command strings from actors. It orchestrates parsing the command,
 * fetching relevant game data (like action definitions), resolving targets for actions,
 * and finally dispatching a `core:attempt_action` event. This class does NOT perform
 * synchronous action validation or execution itself; those are responsibilities of
 * downstream systems reacting to the dispatched event. It handles errors that occur
 * during its processing pipeline (e.g., parsing failures, target resolution issues)
 * and dispatches semantic failure events (e.g., `core:command_parse_failed`) or
 * system error events accordingly.
 * @implements {ICommandProcessor}
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

    /**
     * @description Validates a dependency instance, checking for its existence and required methods.
     * Logs an error and throws if validation fails. This method is intended for internal use
     * during constructor setup.
     * @param {any} dependency - The dependency instance to validate.
     * @param {string} dependencyName - The name of the dependency (for logging and error messages).
     * @param {string[]} [requiredMethods=[]] - An array of method names that must exist on the dependency.
     * @private
     * @throws {Error} If the dependency is missing or does not have all required methods.
     */
    #_validateDependency(dependency, dependencyName, requiredMethods = []) {
        if (!dependency) {
            const errorMsg = `CommandProcessor Constructor: Missing required dependency: ${dependencyName}.`;
            // this.#logger will be available here as it's validated first.
            // The 'this.#logger !== dependency' check is a safeguard, though this method
            // won't be called for the logger itself with the current constructor logic.
            if (this.#logger && this.#logger !== dependency) {
                this.#logger.error(errorMsg);
            }
            throw new Error(errorMsg);
        }
        for (const method of requiredMethods) {
            if (typeof dependency[method] !== 'function') {
                const errorMsg = `CommandProcessor Constructor: Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
                if (this.#logger && this.#logger !== dependency) {
                    this.#logger.error(errorMsg);
                }
                throw new Error(errorMsg);
            }
        }
    }

    /**
     * @description Constructor for CommandProcessor. It injects and validates all required dependencies.
     * The logger is validated first so it can be used for reporting issues with other dependencies.
     * @param {CommandProcessorOptions} options - Configuration object containing all necessary service dependencies.
     * @throws {Error} If the logger dependency is invalid or any other critical dependency is missing or malformed.
     */
    constructor(options) {
        const {
            commandParser,
            targetResolutionService,
            logger,
            validatedEventDispatcher,
            safeEventDispatcher,
            worldContext,
            entityManager,
            gameDataRepository
        } = options || {};

        // 1. Validate Logger separately and first, so it can be used by #_validateDependency
        if (!logger ||
            typeof logger.info !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function' ||
            typeof logger.warn !== 'function') {
            const errorMsg = 'CommandProcessor Constructor: CRITICAL - Invalid or missing ILogger instance. Requires methods: info, error, debug, warn.';
            // Cannot use this.#logger here yet as it's the dependency being validated
            console.error(errorMsg); // Use console.error as a fallback
            throw new Error(errorMsg);
        }
        this.#logger = logger; // Assign logger first, so it can be used below

        // 2. Validate other dependencies using the helper method
        try {
            this.#_validateDependency(commandParser, 'commandParser', ['parse']);
            this.#_validateDependency(targetResolutionService, 'targetResolutionService', ['resolveActionTarget']);
            this.#_validateDependency(validatedEventDispatcher, 'validatedEventDispatcher', ['dispatchValidated']);
            this.#_validateDependency(safeEventDispatcher, 'safeEventDispatcher', ['dispatchSafely']);
            this.#_validateDependency(worldContext, 'worldContext', ['getLocationOfEntity']);
            this.#_validateDependency(entityManager, 'entityManager', ['getEntityInstance']);
            this.#_validateDependency(gameDataRepository, 'gameDataRepository', ['getActionDefinition']);
        } catch (error) {
            // Log the detailed error from #_validateDependency if logger is available
            this.#logger.error(`CommandProcessor Constructor: Dependency validation failed. ${error.message}`);
            throw error; // Re-throw the original error to halt construction
        }

        // 3. Assign validated dependencies
        this.#commandParser = commandParser;
        this.#targetResolutionService = targetResolutionService;
        // this.#logger is already assigned
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#safeEventDispatcher = safeEventDispatcher;
        this.#worldContext = worldContext;
        this.#entityManager = entityManager;
        this.#gameDataRepository = gameDataRepository;

        this.#logger.info("CommandProcessor: Instance created and dependencies validated. ResolutionStatus is now statically imported.");
    }

    /**
     * @description Creates a standardized CommandResult object for failure scenarios.
     * @param {string | undefined} userError - The user-facing error message. If undefined, no 'error' property is included in the result.
     * @param {string} internalError - The internal-facing error message for logging.
     * @param {boolean} [turnEnded=false] - Whether this failure should conclude the actor's turn.
     * @returns {CommandResult} The structured failure result.
     * @private
     */
    #_createFailureResult(userError, internalError, turnEnded = false) {
        const result = {
            success: false,
            turnEnded: turnEnded,
            internalError: internalError,
        };
        if (userError !== undefined) {
            result.error = userError;
        }
        return result;
    }

    /**
     * @description Validates the actor entity and the raw command string.
     * Ensures the actor is valid and the command string is not empty.
     * @param {Entity | null | undefined} actor - The entity attempting to submit the command. Must have a string `id`.
     * @param {string | null | undefined} command - The raw command string.
     * @returns {ValidateInputResult} An object containing the validation status, actor ID, trimmed command,
     * and an errorResult if validation failed.
     * @private
     */
    #_validateInput(actor, command) {
        if (!actor || typeof actor.id !== 'string') {
            this.#logger.error('CommandProcessor.#_validateInput: Invalid or missing actor entity provided.');
            return {
                isValid: false,
                actorId: null,
                trimmedCommand: null,
                errorResult: this.#_createFailureResult('Internal error: Cannot process command without a valid actor.', 'Invalid or missing actor provided to processCommand.')
            };
        }
        const actorId = actor.id;

        const trimmedCommand = command ? String(command).trim() : '';
        if (!trimmedCommand) {
            this.#logger.warn(`CommandProcessor.#_validateInput: Empty or invalid command string provided by actor ${actorId}.`);
            // For an empty command, it's usually not a user-facing error, but an internal detail.
            return {
                isValid: false,
                actorId: actorId,
                trimmedCommand: null,
                errorResult: this.#_createFailureResult(undefined, 'Empty command string received.')
            };
        }

        return {isValid: true, actorId: actorId, trimmedCommand: trimmedCommand, errorResult: null};
    }

    /**
     * @description Parses the command string using the command parsing service and handles parsing-specific errors.
     * If parsing fails or the result is invalid (e.g., no actionId), it dispatches a `core:command_parse_failed` event.
     * @param {string} actorId - The ID of the actor submitting the command.
     * @param {string} commandString - The non-empty, trimmed command string to parse.
     * @returns {Promise<ParseCommandResult>} A promise resolving to the result of the parsing attempt,
     * including the parsed command or an errorResult.
     * @private
     * @async
     */
    async #_parseCommand(actorId, commandString) {
        this.#logger.debug(`CommandProcessor.#_parseCommand: Attempting to parse: "${commandString}" for actor ${actorId}`);
        const parsedCommand = this.#commandParser.parse(commandString);
        this.#logger.debug(`CommandProcessor.#_parseCommand: Parsing complete. Result: ${JSON.stringify(parsedCommand)}`);

        if (parsedCommand.error) {
            const parsingError = parsedCommand.error;
            this.#logger.warn(`CommandProcessor.#_parseCommand: Parsing failed for command "${commandString}" by actor ${actorId}. Error: ${parsingError}`);
            await this.#dispatchWithErrorHandling('core:command_parse_failed', {
                eventName: 'core:command_parse_failed',
                actorId,
                commandString,
                error: parsingError
            }, 'core:command_parse_failed');
            return {
                parsedCommand: null,
                errorResult: this.#_createFailureResult(parsingError, `Parsing Error: ${parsingError}`)
            };
        }

        if (!parsedCommand.actionId) {
            const internalMsg = `Parsing succeeded but no actionId found for command "${commandString}" by actor ${actorId}. Parser output: ${JSON.stringify(parsedCommand)}`;
            const userMsg = "Could not understand the command."; // Generic user message
            this.#logger.warn(`CommandProcessor.#_parseCommand: ${internalMsg}`);
            await this.#dispatchWithErrorHandling('core:command_parse_failed', {
                eventName: 'core:command_parse_failed',
                actorId,
                commandString,
                error: userMsg // Dispatch userMsg as the error to the event system
            }, 'core:command_parse_failed');
            return {
                parsedCommand: null,
                errorResult: this.#_createFailureResult(userMsg, internalMsg)
            };
        }

        this.#logger.debug(`CommandProcessor.#_parseCommand: Parsing successful for "${commandString}", action ID: ${parsedCommand.actionId}.`);
        return {parsedCommand: parsedCommand, errorResult: null};
    }

    /**
     * @description Fetches the ActionDefinition for a given actionId using the game data repository.
     * If the definition is not found, it logs an error, dispatches a `core:system_error_occurred` event,
     * and returns an error result.
     * @param {string} actionId - The ID of the action (from the parsed command) to fetch the definition for.
     * @param {string} actorId - The ID of the actor attempting the action (for logging and error context).
     * @returns {Promise<FetchActionDefinitionResult>} A promise resolving to an object containing the
     * actionDefinition or an errorResult.
     * @private
     * @async
     */
    async #_fetchActionDefinition(actionId, actorId) {
        this.#logger.debug(`CommandProcessor.#_fetchActionDefinition: Attempting to fetch ActionDefinition for actionId '${actionId}'.`);
        const actionDefinition = this.#gameDataRepository.getActionDefinition(actionId);

        if (!actionDefinition) {
            const internalMsg = `Internal inconsistency: ActionDefinition not found for parsed actionId '${actionId}' (actor: ${actorId}). This might indicate missing game data or a misconfiguration.`;
            const userMsg = 'Internal error: The definition for this action is missing.';
            this.#logger.error(`CommandProcessor.#_fetchActionDefinition: ${internalMsg}`);
            await this.#dispatchSystemError(userMsg, internalMsg);
            return {
                actionDefinition: null,
                errorResult: this.#_createFailureResult(userMsg, internalMsg)
            };
        }

        this.#logger.debug(`CommandProcessor.#_fetchActionDefinition: Found ActionDefinition for '${actionId}'.`);
        return {actionDefinition: actionDefinition, errorResult: null};
    }

    /**
     * @description Fetches the actor's current location using the world context.
     * It handles cases where the location is null, checking if the action definition permits this
     * (e.g., for actions with target_domain 'none' or 'self'). If a location is required but not found,
     * or if an error occurs during fetching, it dispatches a system error and returns an error result.
     * @param {string} actorId - The ID of the actor whose location is needed.
     * @param {ActionDefinition} actionDefinition - The definition of the action being attempted, used to check if a location is required.
     * @returns {Promise<FetchLocationContextResult>} A promise resolving to an object containing the
     * actor's current location (which can be null if permissible) or an errorResult.
     * @private
     * @async
     */
    async #_fetchLocationContext(actorId, actionDefinition) {
        let currentLocation = null;
        try {
            currentLocation = this.#worldContext.getLocationOfEntity(actorId);

            if (!currentLocation) {
                // Location is null, check if the action definition allows acting without a location context
                if (actionDefinition.target_domain !== 'none' && actionDefinition.target_domain !== 'self') {
                    const internalMsg = `Actor ${actorId} has no current location (getLocationOfEntity returned null), but action '${actionDefinition.id}' (domain: ${actionDefinition.target_domain}) requires a location context.`;
                    const userMsg = 'Your current location is unknown, and this action requires it.';
                    this.#logger.error(`CommandProcessor.#_fetchLocationContext: ${internalMsg}`);
                    // This is a significant issue if an action requiring location context is attempted by an unlocated entity.
                    await this.#dispatchSystemError(userMsg, internalMsg);
                    return {currentLocation: null, errorResult: this.#_createFailureResult(userMsg, internalMsg)};
                } else {
                    // Action does not require a location, or targets 'self' or 'none'.
                    this.#logger.debug(`CommandProcessor.#_fetchLocationContext: Actor ${actorId} has no current location, but action '${actionDefinition.id}' (domain: '${actionDefinition.target_domain}') allows this. Proceeding without location context.`);
                    return {currentLocation: null, errorResult: null}; // Legitimately null location for this action
                }
            } else {
                // Location successfully fetched
                this.#logger.debug(`CommandProcessor.#_fetchLocationContext: Successfully fetched current location ${currentLocation.id} for actor ${actorId}.`);
                return {currentLocation: currentLocation, errorResult: null};
            }
        } catch (error) {
            const internalMsg = `Failed to get current location for actor ${actorId} using worldContext.getLocationOfEntity: ${error.message}`;
            const userMsg = 'Internal error: Could not determine your current location.';
            this.#logger.error(`CommandProcessor.#_fetchLocationContext: ${internalMsg}`, error);
            await this.#dispatchSystemError(userMsg, internalMsg, error);
            return {currentLocation: null, errorResult: this.#_createFailureResult(userMsg, internalMsg)};
        }
    }

    /**
     * @description Assembles the ActionContext object required for target resolution and later for action execution.
     * This context bundles together all necessary information and services for an action.
     * @param {Entity} actorEntity - The full instance of the acting entity.
     * @param {Entity | null} currentLocation - The actor's current location (can be null if the action permits).
     * @param {ParsedCommand} parsedCommand - The object resulting from parsing the raw command string.
     * @returns {ActionContext} The fully populated ActionContext object.
     * @private
     */
    #_buildActionContext(actorEntity, currentLocation, parsedCommand) {
        this.#logger.debug(`CommandProcessor.#_buildActionContext: Building ActionContext. Actor: ${actorEntity.id}, Location: ${currentLocation ? currentLocation.id : 'null'}, Command: ${parsedCommand.actionId}`);

        /** @type {ActionContext} */
        const actionContext = {
            actingEntity: actorEntity,
            currentLocation: currentLocation,
            parsedCommand: parsedCommand,
            gameDataRepository: this.#gameDataRepository,
            entityManager: this.#entityManager,
            eventBus: { // Shim to control events dispatched from ActionContext/Actions
                dispatch: async (eventName, payload) => {
                    // 'this' in arrow functions refers to CommandProcessor instance
                    if (eventName === 'textUI:display_message') { // Example: Only allow specific events through this shim
                        this.#logger.debug(`CommandProcessor (eventBus Shim in #_buildActionContext): Dispatching '${eventName}' via ValidatedEventDispatcher.`);
                        // Ensure the payload includes eventName for schema validation if dispatchValidated relies on it
                        const validatedPayload = {...payload, eventName: eventName};
                        return this.#validatedEventDispatcher.dispatchValidated(eventName, validatedPayload);
                    } else {
                        this.#logger.warn(`CommandProcessor (eventBus Shim in #_buildActionContext): Received unsupported event dispatch attempt for '${eventName}'. Ignoring.`);
                        return false; // Indicate failure for unsupported events
                    }
                }
            },
            validatedEventDispatcher: this.#validatedEventDispatcher, // Provide full dispatcher for more complex needs if any action system requires it directly
            logger: this.#logger,
            worldContext: this.#worldContext
        };

        this.#logger.debug(`CommandProcessor.#_buildActionContext: ActionContext built successfully.`);
        return actionContext;
    }

    /**
     * @description Orchestrates the target resolution process for the given action using the target resolution service.
     * It handles various outcomes of resolution, including successful resolution, ambiguities, or failures.
     * @param {ActionDefinition} actionDefinition - The definition of the action being attempted.
     * @param {ActionContext} actionContext - The context for the action, containing actor, location, etc.
     * @returns {Promise<TargetOutcome>} A promise resolving to an object containing the resolutionResult
     * (even on some failures, for context) and an errorResult if resolution failed in a way that should halt processing.
     * @private
     * @async
     */
    /**
     * @description Orchestrates the target resolution process for the given action using the target resolution service.
     * It handles various outcomes of resolution, including successful resolution, ambiguities, or failures.
     * @param {ActionDefinition} actionDefinition - The definition of the action being attempted.
     * @param {ActionContext} actionContext - The context for the action, containing actor, location, etc.
     * @returns {Promise<TargetOutcome>} A promise resolving to an object containing the resolutionResult
     * (even on some failures, for context) and an errorResult if resolution failed in a way that should halt processing.
     * @private
     * @async
     */
    async #_resolveTarget(actionDefinition, actionContext) {
        this.#logger.debug(`CommandProcessor.#_resolveTarget: Attempting to resolve target for action '${actionDefinition.id}'...`);
        const resolutionResult = await this.#targetResolutionService.resolveActionTarget(actionDefinition, actionContext);
        const status = resolutionResult.status; // Cache status for readability
        this.#logger.debug(`CommandProcessor.#_resolveTarget: Target resolution complete. Status: ${status}, Type: ${resolutionResult.targetType}, TargetID: ${resolutionResult.targetId}`);

        let isSuccessfulResolution = false;

        if (status === ResolutionStatus.FOUND_UNIQUE || status === ResolutionStatus.SELF) {
            isSuccessfulResolution = true;
        } else if (status === ResolutionStatus.NONE && actionDefinition.target_domain === 'none') {
            // Consider ResolutionStatus.NONE as success if the action's target_domain is 'none',
            // indicating no specific target is expected or required for this type of action.
            isSuccessfulResolution = true;
        }
        // Other statuses (e.g., AMBIGUOUS, NOT_FOUND, INVALID_TARGET_TYPE, ERROR)
        // are implicitly considered failures if not caught by the conditions above.

        if (!isSuccessfulResolution) {
            // Handle statuses like AMBIGUOUS, NOT_FOUND, INVALID_TARGET_TYPE, ERROR
            const internalMsg = `Target resolution failed for action '${actionDefinition.id}' by actor ${actionContext.actingEntity.id}. Status: ${status}. Resolver Error: ${resolutionResult.error || 'None provided by resolver.'}`;
            // User-facing error should come from the resolutionResult if available, otherwise generate a generic one.
            const userError = resolutionResult.error
                ? `Could not resolve target: ${resolutionResult.error}`
                : `Could not complete action: target is unclear or invalid (Status: ${status}).`;

            this.#logger.warn(`CommandProcessor.#_resolveTarget: ${internalMsg}`);
            // It's important to return the resolutionResult itself for potential further inspection, even on failure.
            return {
                resolutionResult: resolutionResult,
                errorResult: this.#_createFailureResult(userError, internalMsg)
            };
        }

        this.#logger.debug(`CommandProcessor.#_resolveTarget: Target resolution successful (Status: ${status}, Type: ${resolutionResult.targetType}, TargetID: ${resolutionResult.targetId}).`);
        return {resolutionResult: resolutionResult, errorResult: null};
    }

    /**
     * @description Prepares the payload and dispatches the `core:attempt_action` event via the safe event dispatcher.
     * This event signals that an actor is attempting to perform a validated and resolved action.
     * If the dispatch itself fails, it logs an error and dispatches a `core:system_error_occurred` event.
     * @param {string} actorId - The ID of the actor attempting the action.
     * @param {string} actionIdFromDefinition - The ID of the action from its definition (ensures canonical ID).
     * @param {TargetResolutionResult} resolutionResult - The successful result of target resolution.
     * @param {string} originalCommandString - The original, trimmed command string (for logging and event payload).
     * @returns {Promise<DispatchAttemptOutcome>} A promise resolving to an object indicating dispatch success
     * and any resulting errorResult if dispatch failed.
     * @private
     * @async
     */
    async #_dispatchActionAttempt(actorId, actionIdFromDefinition, resolutionResult, originalCommandString) {
        const payload = {
            eventName: "core:attempt_action", // Standardized event name
            actorId: actorId,
            actionId: actionIdFromDefinition, // Use the canonical actionId from the definition
            targetId: (resolutionResult.targetType === 'entity' || resolutionResult.targetType === 'self') ? resolutionResult.targetId : null,
            direction: resolutionResult.targetType === 'direction' ? resolutionResult.targetId : null, // Assuming targetId holds direction string for 'direction' type
            originalInput: originalCommandString,
        };

        this.#logger.info(`CommandProcessor.#_dispatchActionAttempt: Command parse and target resolution successful for "${originalCommandString}". Dispatching core:attempt_action.`);
        this.#logger.debug(`CommandProcessor.#_dispatchActionAttempt: core:attempt_action payload: ${JSON.stringify(payload)}`);

        const dispatchSuccess = await this.#dispatchWithErrorHandling(
            'core:attempt_action',
            payload,
            'core:attempt_action' // Context name for logging
        );

        if (dispatchSuccess) {
            this.#logger.info(`CommandProcessor.#_dispatchActionAttempt: Dispatched core:attempt_action successfully for command "${originalCommandString}" by actor ${actorId}.`);
            return {success: true, errorResult: null};
        } else {
            // This implies an issue with the SafeEventDispatcher or the event schema/handler setup.
            const internalMsg = `CRITICAL: Failed to dispatch core:attempt_action event for actor ${actorId}, command "${originalCommandString}". SafeEventDispatcher reported failure. This may indicate a problem with event listeners or the event bus itself.`;
            const userMsg = 'Internal error: Failed to initiate your action due to a system issue.';
            this.#logger.error(`CommandProcessor.#_dispatchActionAttempt: ${internalMsg}`);
            // Dispatch a system error event to signal this critical failure.
            await this.#dispatchSystemError(userMsg, `Failed to dispatch core:attempt_action: SafeEventDispatcher reported failure. Payload: ${JSON.stringify(payload)}`);
            return {
                success: false,
                errorResult: this.#_createFailureResult(userMsg, internalMsg)
            };
        }
    }


    /**
     * @description Main public method to process a raw command string from an actor.
     * It orchestrates the entire pipeline: input validation, command parsing,
     * action definition fetching, location context fetching, action context building,
     * target resolution, and finally, dispatching the `core:attempt_action` event.
     * This method does not execute the action directly but prepares and signals the attempt.
     *
     * @param {Entity | null | undefined} actor - The entity instance submitting the command. Must have a string `id`.
     * @param {string | null | undefined} command - The raw command string input by the actor.
     * @returns {Promise<CommandResult>} A promise that resolves with a CommandResult object.
     * `success: true` indicates the `core:attempt_action` event was successfully dispatched.
     * `success: false` indicates a failure at some point in the pipeline, with `error` and `internalError` fields providing details.
     * `turnEnded` is typically false unless a specific error condition warrants ending the turn.
     * @async
     */
    async processCommand(actor, command) {
        // --- 1. Input Validation ---
        const validation = this.#_validateInput(actor, command);
        if (!validation.isValid) {
            // errorResult is guaranteed by #_validateInput's contract if isValid is false
            return /** @type {CommandResult} */ (validation.errorResult);
        }

        // actorId and trimmedCommand are guaranteed non-null if isValid is true
        const actorId = /** @type {string} */ (validation.actorId);
        const trimmedCommand = /** @type {string} */ (validation.trimmedCommand);
        // The 'actor' entity itself is also guaranteed non-null here due to the validation logic.
        const validActor = /** @type {Entity} */ (actor);


        this.#logger.info(`CommandProcessor: Processing command "${trimmedCommand}" for actor ${actorId}`);

        try {
            // --- 2. Parse Command ---
            const parsingOutcome = await this.#_parseCommand(actorId, trimmedCommand);
            if (parsingOutcome.errorResult) {
                return parsingOutcome.errorResult;
            }
            // parsedCommand is guaranteed non-null if errorResult is null
            const parsedCommand = /** @type {ParsedCommand} */ (parsingOutcome.parsedCommand);

            // --- 3. Fetch Action Definition ---
            const definitionOutcome = await this.#_fetchActionDefinition(parsedCommand.actionId, actorId);
            if (definitionOutcome.errorResult) {
                return definitionOutcome.errorResult;
            }
            // actionDefinition is guaranteed non-null if errorResult is null
            const actionDefinition = /** @type {ActionDefinition} */ (definitionOutcome.actionDefinition);

            // --- 4. Fetch Location Context ---
            const locationOutcome = await this.#_fetchLocationContext(actorId, actionDefinition);
            if (locationOutcome.errorResult) {
                return locationOutcome.errorResult;
            }
            const currentLocation = locationOutcome.currentLocation; // Can be null if action allows

            // --- 5. Build Action Context (for Target Resolution) ---
            // Pass the validated full 'actor' entity.
            const actionContext = this.#_buildActionContext(validActor, currentLocation, parsedCommand);

            // --- 6. Resolve Target ---
            const targetOutcome = await this.#_resolveTarget(actionDefinition, actionContext);
            if (targetOutcome.errorResult) {
                // targetOutcome.resolutionResult might still contain valuable context even on error
                // For example, AMBIGUOUS status includes details on ambiguities.
                // This context might be logged or used by an error event listener if we decide to dispatch one here.
                // For now, we just return the errorResult to stop processing.
                return targetOutcome.errorResult;
            }
            // resolutionResult is guaranteed non-null if errorResult is null
            const resolutionResult = /** @type {TargetResolutionResult} */ (targetOutcome.resolutionResult);

            // --- 7. Dispatch Action Attempt ---
            const dispatchOutcome = await this.#_dispatchActionAttempt(
                actorId,
                actionDefinition.id, // Use the canonical ID from the definition
                resolutionResult,
                trimmedCommand
            );

            // --- 8. Return Final Result Based on Dispatch Outcome ---
            if (dispatchOutcome.success) {
                this.#logger.info(`CommandProcessor: Successfully processed and dispatched action for command "${trimmedCommand}" by actor ${actorId}.`);
                // Successful dispatch means the command was valid up to this point.
                // error and internalError are null as per CommandResult for full success.
                return {success: true, turnEnded: false, error: null, internalError: null};
            } else {
                // errorResult is guaranteed by #_dispatchActionAttempt's contract if success is false
                this.#logger.warn(`CommandProcessor: Failed to dispatch action for command "${trimmedCommand}" (actor ${actorId}). Returning error result from dispatch attempt.`);
                return /** @type {CommandResult} */ (dispatchOutcome.errorResult);
            }

        } catch (error) {
            // This catch block handles unexpected errors in the try block's asynchronous operations
            // or synchronous errors not caught by individual helper method's error handling.
            const internalMsg = `Critical unexpected error during command processing pipeline for "${trimmedCommand}" by actor ${actorId}: ${error.message}. Stack: ${error.stack}`;
            this.#logger.error(`CommandProcessor: CRITICAL UNEXPECTED ERROR. ${internalMsg}`, error);
            const criticalUserErrorMsg = "An unexpected internal error occurred while processing your command. Please try again later.";
            await this.#dispatchSystemError(criticalUserErrorMsg, internalMsg, error);
            return this.#_createFailureResult(criticalUserErrorMsg, internalMsg);
        }
    }

    /**
     * @description Helper method to dispatch an event using the ISafeEventDispatcher.
     * It logs the attempt and the outcome (success or failure of the dispatch itself).
     * @param {string} eventName - The name of the event to dispatch.
     * @param {object} payload - The event payload. It should conform to the event's schema if one is defined.
     * @param {string} loggingContextName - A descriptive name for logging purposes (e.g., the event name or a more specific context).
     * @returns {Promise<boolean>} True if the event dispatch was accepted by the SafeEventDispatcher (i.e., no immediate error during dispatch), false otherwise.
     * @private
     * @async
     */
    async #dispatchWithErrorHandling(eventName, payload, loggingContextName) {
        this.#logger.debug(`CommandProcessor.#dispatchWithErrorHandling: Attempting to dispatch '${loggingContextName}' event ('${eventName}') via SafeEventDispatcher.`);
        try {
            const success = await this.#safeEventDispatcher.dispatchSafely(eventName, payload);

            if (success) {
                this.#logger.debug(`CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher successfully processed dispatch for '${loggingContextName}' event ('${eventName}').`);
            } else {
                // SafeEventDispatcher internally handles errors in listeners but returns false if the dispatch itself had issues it could detect
                // or if all listeners failed critically in a way it reports as overall dispatch failure.
                this.#logger.warn(`CommandProcessor.#dispatchWithErrorHandling: SafeEventDispatcher reported failure for '${loggingContextName}' event ('${eventName}'). This may indicate issues with event listeners or the bus. Payload: ${JSON.stringify(payload)}`);
            }
            return success;
        } catch (dispatchError) {
            // This catch block is for unexpected errors *from* dispatchSafely itself, which should be rare if it's robust.
            this.#logger.error(`CommandProcessor.#dispatchWithErrorHandling: CRITICAL - Error occurred *during* call to SafeEventDispatcher.dispatchSafely for '${loggingContextName}' ('${eventName}'). Error: ${dispatchError.message}`, dispatchError);
            return false; // Treat as dispatch failure
        }
    }

    /**
     * @description Helper method to dispatch a standardized `core:system_error_occurred` event.
     * This is used for reporting internal errors that are not specific to a user action's semantics
     * but rather indicate a problem within the system.
     * @param {string} userMessage - A user-friendly message describing the error, suitable for display.
     * @param {string} internalDetails - Detailed internal error information for logging and debugging.
     * @param {Error | null} [originalError=null] - The original Error object, if available, for richer logging.
     * @returns {Promise<void>} A promise that resolves once the dispatch attempt is complete.
     * @private
     * @async
     */
    async #dispatchSystemError(userMessage, internalDetails, originalError = null) {
        const payload = {
            eventName: 'core:system_error_occurred', // Standardized event name
            message: userMessage,                   // User-facing message
            type: 'error',                          // General error type
            details: internalDetails                // Internal technical details
        };

        // Log the error with full details before attempting to dispatch the event
        if (originalError) {
            this.#logger.error(`CommandProcessor System Error Context: ${internalDetails}. Original Error: ${originalError.message}`, originalError);
        } else {
            this.#logger.error(`CommandProcessor System Error Context: ${internalDetails}`);
        }

        const dispatchSuccess = await this.#dispatchWithErrorHandling(
            'core:system_error_occurred',
            payload,
            'core:system_error_occurred' // Logging context name
        );

        if (!dispatchSuccess) {
            // This is a critical situation: the system couldn't even report an error.
            // Log this with maximum severity.
            this.#logger.error(`CommandProcessor: CRITICAL FAILURE - Failed to dispatch the 'core:system_error_occurred' event itself via SafeEventDispatcher. Original Error Context that triggered this: UserMessage='${userMessage}', InternalDetails='${internalDetails}'. This indicates a severe problem with the event system.`);
        }
    }
}

export default CommandProcessor;