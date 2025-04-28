// src/actions/actionExecutor.js

// +++ Add imports for JSDoc type definitions +++
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../services/targetResolutionService.js').ResolutionStatus} ResolutionStatus */
/** @typedef {import('../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../services/actionValidationService.js').ActionValidationService} ActionValidationService */
// --- UPDATED JSDoc import path ---
/** @typedef {import('../models/ActionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */
// --- Refactoring: Import new service ---
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */


// Import necessary modules/classes used
import {ResolutionStatus} from '../services/targetResolutionService.js';
// --- UPDATED ES Module import path ---
import {ActionTargetContext} from '../models/actionTargetContext.js';

/**
 * Manages and executes game actions based on definitions.
 * Relies on injected services for data access, target resolution, validation,
 * payload building, and uses ValidatedEventDispatcher for event dispatching.
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
    /** @private @type {EventBus} */ // Still needed if other parts use it directly, otherwise maybe remove
    #eventBus;
    /** @private @type {ValidatedEventDispatcher} */ // Refactoring: Added
    #validatedEventDispatcher;
    /** @private @type {ILogger | undefined} */
    #logger;
    // --- Refactoring: Removed direct dependency ---
    // /** @private @type {ISchemaValidator} */
    // #schemaValidator;

    /**
     * Creates an instance of ActionExecutor.
     * @param {object} dependencies - The required services.
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {TargetResolutionService} dependencies.targetResolutionService
     * @param {ActionValidationService} dependencies.actionValidationService
     * @param {PayloadValueResolverService} dependencies.payloadValueResolverService
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher // Refactoring: Added
     * @param {EventBus} dependencies.eventBus
     * @param {ILogger} [dependencies.logger]
     */
    constructor({
                    gameDataRepository,
                    targetResolutionService,
                    actionValidationService,
                    payloadValueResolverService,
                    validatedEventDispatcher,
                    eventBus,
                    logger
                }) {
        if (!gameDataRepository) throw new Error("ActionExecutor: Missing required dependency 'gameDataRepository'.");
        if (!targetResolutionService) throw new Error("ActionExecutor: Missing required dependency 'targetResolutionService'.");
        if (!actionValidationService) throw new Error("ActionExecutor: Missing required dependency 'actionValidationService'.");
        if (!payloadValueResolverService) throw new Error("ActionExecutor: Missing required dependency 'payloadValueResolverService'.");
        if (!validatedEventDispatcher) throw new Error("ActionExecutor: Missing required dependency 'validatedEventDispatcher'.");
        if (!eventBus) throw new Error("ActionExecutor: Missing required dependency 'eventBus'.");


        // --- Store Dependencies ---
        this.#gameDataRepository = gameDataRepository;
        this.#targetResolutionService = targetResolutionService;
        this.#actionValidationService = actionValidationService;
        this.#payloadValueResolverService = payloadValueResolverService;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#eventBus = eventBus;
        this.#logger = logger;

        // Refactoring: Updated log message
        this.#logger?.info('ActionExecutor initialized with dependencies (including ValidatedEventDispatcher).');
    }


    // ======================================================================= //
    // == START: Main Action Execution Orchestration                       == //
    // ======================================================================= //

    /**
     * Executes a game action using a generic flow: definition fetch, target resolution,
     * validation, payload building, and event dispatch (via ValidatedEventDispatcher).
     *
     * @param {string} actionId - The ID of the action to execute.
     * @param {ActionContext} context - The context object.
     * @returns {Promise<ActionResult>} Result of the action execution attempt.
     */
    async executeAction(actionId, context) {
        this.#logger?.debug(`Executing action '${actionId}'...`, context.parsedCommand);

        try {
            // Step 1: Fetch Definition
            const actionDefinition = this.#fetchActionDefinition(actionId);
            if (!actionDefinition) {
                return {
                    success: false,
                    messages: [{text: `Internal Error: Action '${actionId}' not defined.`, type: 'error'}],
                };
            }

            // Step 2: Resolve Target
            const resolutionResult = await this.#resolveActionTarget(actionDefinition, context);

            // Step 3: Check Target Resolution Status
            if (resolutionResult.status !== ResolutionStatus.FOUND_UNIQUE) {
                this.#logger?.warn(`ActionExecutor: Target resolution failed for '${actionId}' with status: ${resolutionResult.status}. Action aborted.`);
                return {
                    success: false,
                    messages: [{text: 'Action failed: Could not determine target.', type: 'info'}],
                    _internalDetails: {
                        resolutionStatus: resolutionResult.status,
                        resolutionError: resolutionResult.error
                    }
                };
            }

            // Step 4: Build Validation Target Context
            // Use the imported ActionTargetContext from the new location
            const targetContext = this.#buildValidationTargetContext(resolutionResult, context, actionId);

            // Step 5: Validate Action
            const isValid = this.#validateAction(actionDefinition, context.playerEntity, targetContext);
            if (!isValid) {
                return {success: false, messages: [{text: 'You cannot do that right now.', type: 'info'}],};
            }

            // Step 6: Prepare and Dispatch Event (if defined)
            if (actionDefinition.dispatch_event) {
                // This helper now focuses on payload building and calling the dispatcher
                return await this.#prepareAndDispatchEvent(actionDefinition, context, resolutionResult, targetContext);
            } else {
                this.#logger?.debug(`ActionExecutor: Action '${actionId}' valid but no 'dispatch_event'. Action flow complete.`);
                return {success: true, messages: [],};
            }

        } catch (error) {
            this.#logger?.error(`ActionExecutor: Unexpected error executing action '${actionId}':`, error);
            return {
                success: false,
                messages: [{text: 'An internal error occurred while processing the command.', type: 'error'}],
            };
        }
    } // End executeAction

    // ======================================================================= //
    // == END: Main Action Execution Orchestration                         == //
    // ======================================================================= //


    // ======================================================================= //
    // == START: Private Helper Methods for Execution Steps                == //
    // ======================================================================= //

    /** @private Fetches ActionDefinition. Logs error if not found. */
    #fetchActionDefinition(actionId) {
        this.#logger?.debug(`Helper #fetchActionDefinition: Finding definition for '${actionId}'...`);
        const actionDefinition = this.#gameDataRepository.getAction(actionId); // Still needs GameDataRepository
        if (!actionDefinition) {
            this.#logger?.error(`Helper #fetchActionDefinition: Action definition not found for ID: ${actionId}`);
            return undefined;
        }
        this.#logger?.debug(`Helper #fetchActionDefinition: Found definition for '${actionId}'.`);
        return actionDefinition;
    }

    /** @private Resolves action target using TargetResolutionService. */
    async #resolveActionTarget(actionDefinition, context) {
        this.#logger?.debug(`Helper #resolveActionTarget: Resolving target for '${actionDefinition.id}'...`);
        const resolutionResult = await this.#targetResolutionService.resolveActionTarget(actionDefinition, context);
        this.#logger?.debug(`Helper #resolveActionTarget: Result for '${actionDefinition.id}': Status=${resolutionResult.status}`);
        return resolutionResult;
    }

    /** @private Builds ActionTargetContext. Throws on internal error. */
    #buildValidationTargetContext(resolutionResult, context, actionId) {
        this.#logger?.debug(`Helper #buildValidationTargetContext: Constructing for '${actionId}'...`);
        const {targetType, targetId} = resolutionResult;
        const {playerEntity, parsedCommand} = context;
        let targetContext;
        try {
            // Uses ActionTargetContext imported from '../models/ActionTargetContext.js'
            switch (targetType) {
                case 'entity':
                    if (!targetId) throw new Error("Target type 'entity' but targetId missing.");
                    targetContext = ActionTargetContext.forEntity(targetId);
                    break;
                case 'direction':
                    const dir = parsedCommand?.directObjectPhrase;
                    if (!dir) throw new Error("Target type 'direction' but name missing.");
                    targetContext = ActionTargetContext.forDirection(dir);
                    break;
                case 'self':
                    targetContext = ActionTargetContext.forEntity(playerEntity.id);
                    break;
                case 'none':
                    targetContext = ActionTargetContext.noTarget();
                    break;
                default:
                    throw new Error(`Unhandled target type '${targetType}'.`);
            }
            this.#logger?.debug(`Helper #buildValidationTargetContext: Constructed: Type=${targetContext.type}, EntityId=${targetContext.entityId}, Dir=${targetContext.direction}`);
            return targetContext;
        } catch (contextError) {
            this.#logger?.error(`Helper #buildValidationTargetContext: Error for '${actionId}':`, contextError);
            throw new Error(`Internal error processing target for ${actionId}: ${contextError.message}`);
        }
    }

    /** @private Validates action using ActionValidationService. */
    #validateAction(actionDefinition, actorEntity, targetContext) {
        this.#logger?.debug(`Helper #validateAction: Validating '${actionDefinition.id}'...`);
        const isValid = this.#actionValidationService.isValid(actionDefinition, actorEntity, targetContext);
        this.#logger?.debug(`Helper #validateAction: Result for '${actionDefinition.id}': ${isValid}`);
        if (!isValid) {
            this.#logger?.warn(`Helper #validateAction: Action '${actionDefinition.id}' failed validation.`);
        }
        return isValid;
    }

    /**
     * Builds the event payload using PayloadValueResolverService and then attempts
     * to dispatch the event using the ValidatedEventDispatcher service.
     *
     * @private
     * @param {ActionDefinition} actionDefinition - The action definition.
     * @param {ActionContext} context - The action context.
     * @param {TargetResolutionResult} resolutionResult - Target resolution result.
     * @param {ActionTargetContext} targetContext - Validation target context.
     * @returns {Promise<ActionResult>} Result indicating success/failure of payload building and dispatch attempt.
     */
    async #prepareAndDispatchEvent(actionDefinition, context, resolutionResult, targetContext) {
        const actionId = actionDefinition.id;
        const eventConfig = actionDefinition.dispatch_event;
        const eventName = eventConfig.eventName;
        const payloadDefinition = eventConfig.payload || {};
        const eventPayload = {};

        this.#logger?.debug(`Helper #prepareAndDispatchEvent: Action '${actionId}' valid. Preparing payload for event '${eventName}'.`);

        // --- Build Payload ---
        this.#logger?.debug(`Helper #prepareAndDispatchEvent: Building payload for '${eventName}'...`);
        for (const [payloadKey, sourceString] of Object.entries(payloadDefinition)) {
            try {
                const value = this.#payloadValueResolverService.resolveValue(sourceString, context, resolutionResult, actionDefinition);
                if (value !== undefined) {
                    eventPayload[payloadKey] = value;
                    this.#logger?.debug(`  - Payload key '${payloadKey}' resolved to:`, value);
                } else {
                    this.#logger?.debug(`  - Payload key '${payloadKey}' resolved undefined from '${sourceString}'. Omitting.`);
                }
            } catch (resolveError) {
                this.#logger?.error(`Helper #prepareAndDispatchEvent: Error resolving payload key '${payloadKey}' for event '${eventName}' (Action: '${actionId}') from '${sourceString}':`, resolveError);
                return {
                    success: false,
                    messages: [{
                        text: `Internal Error: Failed payload build for event '${eventName}'. Action '${actionId}' aborted.`,
                        type: 'error'
                    }],
                    _internalDetails: {payloadKey, sourceString, error: resolveError.message}
                };
            }
        }

        // --- Refactoring: Dispatch Event using ValidatedEventDispatcher ---
        try {
            this.#logger.debug(`Helper #prepareAndDispatchEvent: Attempting dispatch for event '${eventName}' via ValidatedEventDispatcher...`);
            // Call the new service - it handles validation internally
            const dispatchOccurred = await this.#validatedEventDispatcher.dispatchValidated(eventName, eventPayload);

            if (dispatchOccurred) {
                this.#logger.debug(`Helper #prepareAndDispatchEvent: Event '${eventName}' dispatch successful for action '${actionId}'.`);
                // Event dispatched successfully (passed validation or validation not required/failed gracefully)
                return {
                    success: true, messages: [], // Success! Handlers provide feedback.
                };
            } else {
                // Dispatch did not happen. Reason logged by ValidatedEventDispatcher (e.g., validation failed).
                this.#logger.warn(`Helper #prepareAndDispatchEvent: Event '${eventName}' dispatch skipped or failed for action '${actionId}'. Check dispatcher logs.`);
                // Return a failure ActionResult, indicating the action effectively failed at the dispatch step.
                return {
                    success: false,
                    messages: [{
                        text: `Action '${actionId}' aborted; failed to dispatch event '${eventName}'.`,
                        type: 'error'
                    }],
                    _internalDetails: {
                        eventName: eventName,
                        reason: 'Dispatch prevented by ValidatedEventDispatcher (check logs)'
                    }
                };
            }
        } catch (dispatcherError) {
            // Catch unexpected errors *from the dispatcher call itself* (should be rare if dispatcher handles internally)
            this.#logger?.error(`Helper #prepareAndDispatchEvent: Unexpected error calling ValidatedEventDispatcher for event '${eventName}' (Action: '${actionId}'):`, dispatcherError);
            return {
                success: false,
                messages: [{
                    text: `Internal error processing event '${eventName}' for action '${actionId}'.`,
                    type: 'error'
                }],
                _internalDetails: {dispatcherError: dispatcherError.message, eventName: eventName}
            };
        }
    } // End #prepareAndDispatchEvent


    // ======================================================================= //
    // == END: Private Helper Methods for Execution Steps                  == //
    // ======================================================================= //

}

export default ActionExecutor;