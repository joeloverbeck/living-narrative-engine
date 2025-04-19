// src/actions/actionExecutor.js

// +++ Add imports for JSDoc type definitions +++
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../services/targetResolutionService.js').ResolutionStatus} ResolutionStatus */
/** @typedef {import('../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../services/actionValidationService.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */


// Import necessary modules/classes used
import {ResolutionStatus} from '../services/targetResolutionService.js'; // Import ResolutionStatus enum
import {ActionTargetContext} from '../services/actionValidationService.js'; // Import ActionTargetContext

/**
 * Manages and executes game actions based on definitions.
 * Receives ActionContext from GameLoop and orchestrates the execution flow.
 * Relies on injected services for data access, target resolution, validation,
 * payload building, and event dispatching.
 *
 * Implements a generic action execution flow involving definition fetching,
 * target resolution, validation, and event dispatching via private helper methods.
 */
class ActionExecutor {
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {TargetResolutionService} */
    #targetResolutionService;
    /** @private @type {ActionValidationService} */
    #actionValidationService;
    /** @private @type {PayloadValueResolverService} */
    #payloadValueResolverService;
    /** @private @type {EventBus} */
    #eventBus;
    /** @private @type {ILogger | undefined} */
    #logger;

    // --- Removed #handlers map ---
    // The deprecated #handlers = new Map() has been removed.

    /**
     * Creates an instance of ActionExecutor.
     * @param {object} dependencies - The required services.
     * @param {GameDataRepository} dependencies.gameDataRepository - Repository for game data definitions.
     * @param {TargetResolutionService} dependencies.targetResolutionService - Service for resolving action targets.
     * @param {ActionValidationService} dependencies.actionValidationService - Service for validating actions.
     * @param {PayloadValueResolverService} dependencies.payloadValueResolverService - Service for resolving event payload values.
     * @param {EventBus} dependencies.eventBus - The application's event bus.
     * @param {ILogger} [dependencies.logger] - Optional logger instance.
     */
    constructor({
                    gameDataRepository,
                    targetResolutionService,
                    actionValidationService,
                    payloadValueResolverService,
                    eventBus,
                    logger
                }) {
        // --- Dependency Validation ---
        if (!gameDataRepository) {
            throw new Error("ActionExecutor: Missing required dependency 'gameDataRepository'.");
        }
        if (!targetResolutionService) {
            throw new Error("ActionExecutor: Missing required dependency 'targetResolutionService'.");
        }
        if (!actionValidationService) {
            throw new Error("ActionExecutor: Missing required dependency 'actionValidationService'.");
        }
        if (!payloadValueResolverService) {
            throw new Error("ActionExecutor: Missing required dependency 'payloadValueResolverService'.");
        }
        if (!eventBus) {
            throw new Error("ActionExecutor: Missing required dependency 'eventBus'.");
        }

        // --- Store Dependencies ---
        this.#gameDataRepository = gameDataRepository;
        this.#targetResolutionService = targetResolutionService;
        this.#actionValidationService = actionValidationService;
        this.#payloadValueResolverService = payloadValueResolverService;
        this.#eventBus = eventBus;
        this.#logger = logger;

        this.#logger?.info("ActionExecutor initialized with dependencies.");
    }

    // --- Removed registerHandler method ---
    // The deprecated registerHandler(actionId, handlerFunction) method has been removed.

    // ======================================================================= //
    // == START: Main Action Execution Orchestration                       == //
    // ======================================================================= //

    /**
     * Executes a game action using a generic flow orchestrated by helper methods:
     * 1. Fetch action definition.
     * 2. Resolve action target.
     * 3. Build validation context.
     * 4. Validate action.
     * 5. Prepare and dispatch event (if applicable).
     *
     * @param {string} actionId - The ID of the action to execute.
     * @param {ActionContext} context - The context object containing player, location, parsed command, etc.
     * @returns {Promise<ActionResult>} A Promise resolving to the result of the action execution attempt.
     */
    async executeAction(actionId, context) {
        this.#logger?.debug(`Executing action '${actionId}'...`, context.parsedCommand);

        try {
            // Step 1: Fetch Definition
            const actionDefinition = this.#fetchActionDefinition(actionId);
            if (!actionDefinition) {
                // Error logged within helper
                return {
                    success: false,
                    messages: [{text: `Internal Error: Action '${actionId}' is not defined.`, type: 'error'}],
                };
            }

            // Step 2: Resolve Target
            const resolutionResult = await this.#resolveActionTarget(actionDefinition, context);

            // Step 3: Check Target Resolution Status
            if (resolutionResult.status !== ResolutionStatus.FOUND_UNIQUE) {
                this.#logger?.warn(`ActionExecutor: Target resolution failed for action '${actionId}' with status: ${resolutionResult.status}. Action aborted.`);
                // User-facing messages often handled by TargetResolutionService via events.
                return {
                    success: false,
                    messages: [{text: "Action failed: Could not determine target.", type: 'info'}],
                    _internalDetails: {
                        resolutionStatus: resolutionResult.status,
                        resolutionError: resolutionResult.error
                    }
                };
            }

            // Step 4: Build Validation Target Context (Throws on internal error)
            const targetContext = this.#buildValidationTargetContext(resolutionResult, context, actionId);

            // Step 5: Validate Action
            const isValid = this.#validateAction(actionDefinition, context.playerEntity, targetContext);
            if (!isValid) {
                // Warning logged within helper
                // Specific feedback usually handled by validation service or prerequisites.
                return {
                    success: false,
                    messages: [{text: "You cannot do that right now.", type: 'info'}], // Generic failure message
                };
            }

            // Step 6: Prepare and Dispatch Event (if defined)
            if (actionDefinition.dispatch_event) {
                // This helper handles payload building, dispatching, and returns the final ActionResult
                return await this.#prepareAndDispatchEvent(actionDefinition, context, resolutionResult, targetContext);
            } else {
                // Action is valid but dispatches no event. Considered successful.
                this.#logger?.debug(`ActionExecutor: Action '${actionId}' is valid but has no 'dispatch_event' defined. Action flow complete.`);
                return {
                    success: true,
                    messages: [],
                };
            }

        } catch (error) {
            // Catch unexpected errors from helpers (e.g., buildValidationTargetContext) or other issues
            this.#logger?.error(`ActionExecutor: Unexpected error executing action '${actionId}':`, error);
            return {
                success: false,
                messages: [{text: `An internal error occurred while processing the command.`, type: 'error'}],
            };
        }
    } // End executeAction

    // ======================================================================= //
    // == END: Main Action Execution Orchestration                         == //
    // ======================================================================= //


    // ======================================================================= //
    // == START: Private Helper Methods for Execution Steps                == //
    // ======================================================================= //

    /**
     * Fetches the ActionDefinition for the given action ID.
     * Logs an error if the definition is not found.
     * @private
     * @param {string} actionId - The ID of the action.
     * @returns {ActionDefinition | undefined} The found action definition, or undefined if not found.
     */
    #fetchActionDefinition(actionId) {
        this.#logger?.debug(`Helper #fetchActionDefinition: Attempting to find definition for '${actionId}'...`);
        const actionDefinition = this.#gameDataRepository.getAction(actionId);

        if (!actionDefinition) {
            this.#logger?.error(`Helper #fetchActionDefinition: Action definition not found for ID: ${actionId}`);
            return undefined;
        }
        this.#logger?.debug(`Helper #fetchActionDefinition: Found definition for action '${actionId}'. Target Domain: ${actionDefinition.target_domain}`);
        return actionDefinition;
    }

    /**
     * Resolves the target for the given action definition and context.
     * Logs the resolution result.
     * @private
     * @param {ActionDefinition} actionDefinition - The action definition.
     * @param {ActionContext} context - The action context.
     * @returns {Promise<TargetResolutionResult>} The result of the target resolution.
     */
    async #resolveActionTarget(actionDefinition, context) {
        this.#logger?.debug(`Helper #resolveActionTarget: Resolving target for action '${actionDefinition.id}'...`);
        const resolutionResult = await this.#targetResolutionService.resolveActionTarget(actionDefinition, context);
        this.#logger?.debug(`Helper #resolveActionTarget: Target resolution result for '${actionDefinition.id}': Status=${resolutionResult.status}, Type=${resolutionResult.targetType}, ID=${resolutionResult.targetId}`);
        return resolutionResult;
    }

    /**
     * Builds the ActionTargetContext required for validation based on the resolution result.
     * Logs the constructed context. Throws an error if context construction fails internally.
     * @private
     * @param {TargetResolutionResult} resolutionResult - The result from target resolution.
     * @param {ActionContext} context - The action context.
     * @param {string} actionId - The ID of the action being executed (for logging).
     * @returns {ActionTargetContext} The constructed target context.
     * @throws {Error} If context construction fails due to missing data or unhandled types.
     */
    #buildValidationTargetContext(resolutionResult, context, actionId) {
        this.#logger?.debug(`Helper #buildValidationTargetContext: Constructing validation context for action '${actionId}'...`);
        const {targetType, targetId} = resolutionResult;
        const {playerEntity, parsedCommand} = context;
        /** @type {ActionTargetContext} */
        let targetContext;

        try {
            switch (targetType) {
                case 'entity':
                    if (!targetId) throw new Error("Target type is 'entity' but targetId is missing in resolutionResult.");
                    targetContext = ActionTargetContext.forEntity(targetId);
                    break;
                case 'direction':
                    const directionName = parsedCommand?.directObjectPhrase;
                    if (!directionName) throw new Error("Target type is 'direction' but direction name missing from parsed command.");
                    targetContext = ActionTargetContext.forDirection(directionName);
                    break;
                case 'self':
                    targetContext = ActionTargetContext.forEntity(playerEntity.id);
                    break;
                case 'none':
                    targetContext = ActionTargetContext.noTarget();
                    break;
                default:
                    // This case should ideally be caught earlier or indicate a programming error
                    throw new Error(`Unhandled target type '${targetType}' from resolution result.`);
            }
            this.#logger?.debug(`Helper #buildValidationTargetContext: Constructed ActionTargetContext: Type=${targetContext.type}, EntityId=${targetContext.entityId}, Direction=${targetContext.direction}`);
            return targetContext;

        } catch (contextError) {
            // Log the specific error here before re-throwing
            this.#logger?.error(`Helper #buildValidationTargetContext: Error constructing ActionTargetContext for action '${actionId}':`, contextError);
            // Re-throw to be caught by the main executeAction catch block
            throw new Error(`Internal error processing action target for ${actionId}: ${contextError.message}`);
        }
    }

    /**
     * Validates the action using the ActionValidationService.
     * Logs the validation result.
     * @private
     * @param {ActionDefinition} actionDefinition - The action definition.
     * @param {Entity} actorEntity - The entity performing the action.
     * @param {ActionTargetContext} targetContext - The resolved and constructed target context.
     * @returns {boolean} True if the action is valid, false otherwise.
     */
    #validateAction(actionDefinition, actorEntity, targetContext) {
        this.#logger?.debug(`Helper #validateAction: Validating action '${actionDefinition.id}'...`);
        const isValid = this.#actionValidationService.isValid(actionDefinition, actorEntity, targetContext);
        this.#logger?.debug(`Helper #validateAction: Action validation result for '${actionDefinition.id}': ${isValid}`);

        if (!isValid) {
            this.#logger?.warn(`Helper #validateAction: Action '${actionDefinition.id}' failed validation.`);
        }
        return isValid;
    }

    /**
     * Prepares the event payload using PayloadValueResolverService and dispatches the event via EventBus.
     * Handles errors during payload resolution and event dispatch.
     * @private
     * @param {ActionDefinition} actionDefinition - The action definition containing event details.
     * @param {ActionContext} context - The action context.
     * @param {TargetResolutionResult} resolutionResult - The target resolution result.
     * @param {ActionTargetContext} targetContext - The validation target context (potentially useful for payload, though usually context/resolutionResult are primary).
     * @returns {Promise<ActionResult>} An ActionResult indicating the success or failure of the event dispatch stage.
     */
    async #prepareAndDispatchEvent(actionDefinition, context, resolutionResult, targetContext) {
        const actionId = actionDefinition.id;
        const eventConfig = actionDefinition.dispatch_event; // Known to exist due to check in executeAction

        this.#logger?.debug(`Helper #prepareAndDispatchEvent: Action '${actionId}' is valid. Preparing to dispatch event '${eventConfig.eventName}'.`);

        const eventName = eventConfig.eventName;
        const payloadDefinition = eventConfig.payload || {};
        const eventPayload = {};

        // Build Payload
        this.#logger?.debug(`Helper #prepareAndDispatchEvent: Building payload for event '${eventName}'...`);
        for (const [payloadKey, sourceString] of Object.entries(payloadDefinition)) {
            const value = this.#payloadValueResolverService.resolveValue(sourceString, context, resolutionResult, actionDefinition);

            // Strategy: Include null, omit undefined.
            if (value !== undefined) {
                eventPayload[payloadKey] = value;
                this.#logger?.debug(`  - Payload key '${payloadKey}' resolved to:`, value);
            } else {
                this.#logger?.debug(`  - Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`);
            }
        }

        // Dispatch Event
        try {
            this.#logger?.debug(`Helper #prepareAndDispatchEvent: Dispatching event '${eventName}' with payload:`, eventPayload);
            await this.#eventBus.dispatch(eventName, eventPayload);

            this.#logger?.debug(`Helper #prepareAndDispatchEvent: Event '${eventName}' dispatch successful for action '${actionId}'.`);
            // Return success if dispatch succeeds
            return {
                success: true,
                messages: [], // Event handlers are responsible for user feedback
            };
        } catch (dispatchError) {
            this.#logger?.error(`Helper #prepareAndDispatchEvent: Error dispatching event '${eventName}' for action '${actionId}':`, dispatchError);
            // Return failure specific to the dispatch step
            return {
                success: false,
                messages: [{
                    text: `Internal error dispatching event '${eventName}' for action '${actionId}'.`,
                    type: 'error'
                }],
                _internalDetails: {
                    dispatchError: dispatchError.message,
                    eventName: eventName
                }
            };
        }
    }

    // ======================================================================= //
    // == END: Private Helper Methods for Execution Steps                  == //
    // ======================================================================= //

}

export default ActionExecutor;