// src/core/services/playerPromptService.js
// --- FILE START ---

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action.
 * @property {string} name - The human-readable name of the action.
 * @property {string} command - The command string for the action.
 * @property {string} [description] - Optional. The detailed description of the action.
 */
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

// --- Import Custom Error ---
import {PromptError} from '../../errors/promptError.js';
import {IPlayerPromptService} from '../interfaces/IPlayerPromptService.js';
import {PLAYER_TURN_SUBMITTED_ID} from "../../constants/eventIds.js";

/**
 * @typedef {object} PlayerPromptServiceDependencies
 * @property {ILogger} logger - The logging service.
 * @property {IActionDiscoverySystem} actionDiscoverySystem - Service to discover available actions.
 * @property {IPromptOutputPort} promptOutputPort - Port for sending prompts to the player.
 * @property {IWorldContext} worldContext - Service to access current world state (like entity locations).
 * @property {IEntityManager} entityManager - Service to manage entity instances.
 * @property {IGameDataRepository} gameDataRepository - Service to access game definition data.
 * @property {IValidatedEventDispatcher} validatedEventDispatcher - Dispatcher for subscribing to validated events.
 */

/**
 * Represents the object resolved by the prompt() method's promise.
 * @typedef {object} PlayerPromptResolution
 * @property {DiscoveredActionInfo} action - The selected available action object.
 * @property {string | null} speech - The speech input from the player, or null.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEvent
 * @property {string} type - The event type, e.g., PLAYER_TURN_SUBMITTED_ID.
 * @property {CorePlayerTurnSubmittedEventPayload} payload - The nested payload of the event.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEventPayload
 * @property {string} [submittedByActorId] - Optional, but recommended. The ID of the actor who submitted.
 * @property {string} actionId - The ID of the action submitted by the player.
 * @property {string|null} speech - The speech associated with the action.
 */

/**
 * @typedef {object} CurrentPromptContext
 * @property {string} actorId - The ID of the actor being prompted.
 * @property {Function} resolve - The resolve function of the current prompt's promise.
 * @property {Function} reject - The reject function of the current prompt's promise.
 * @property {(() => void) | null} unsubscribe - The unsubscribe function for the event listener.
 * @property {DiscoveredActionInfo[]} discoveredActions - The actions discovered for the current prompt.
 * @property {AbortSignal | undefined} [cancellationSignal] - The AbortSignal for this prompt.
 * @property {(() => void) | null} [abortListenerCleanup] - Function to remove the abort listener.
 * @property {boolean} isResolvedOrRejected - Flag to track if the promise has been settled.
 */

/**
 * @class PlayerPromptService
 * @extends IPlayerPromptService
 * @description Service responsible for prompting the player for actions and awaiting their response asynchronously.
 * Implements the IPlayerPromptService interface. Ensures only one prompt is active globally at any time.
 */
class PlayerPromptService extends IPlayerPromptService {
    /** @type {ILogger} */
    #logger;
    /** @type {IActionDiscoverySystem} */
    #actionDiscoverySystem;
    /** @type {IPromptOutputPort} */
    #promptOutputPort;
    /** @type {IWorldContext} */
    #worldContext;
    /** @type {IEntityManager} */
    #entityManager;
    /** @type {IGameDataRepository} */
    #gameDataRepository;
    /** @type {IValidatedEventDispatcher} */
    #validatedEventDispatcher;

    /**
     * @private
     * @type {CurrentPromptContext | null}
     */
    #currentPromptContext = null;

    /**
     * @private
     * Validates a constructor dependency, checking for its presence and required methods.
     * Uses console.error for logging as this runs before the class logger is fully confirmed.
     * @param {any} dependency - The dependency instance to validate.
     * @param {string} dependencyName - The name of the dependency (e.g., "ILogger", "IActionDiscoverySystem") for error messages.
     * @param {string[]} [requiredMethods=[]] - An array of method names that must exist on the dependency.
     * @throws {Error} If the dependency is null/undefined or a required method is missing.
     */
    _validateDependency(dependency, dependencyName, requiredMethods = []) {
        if (!dependency) {
            console.error(`PlayerPromptService Constructor: Missing ${dependencyName} dependency.`);
            throw new Error(`PlayerPromptService: Missing ${dependencyName} dependency.`);
        }
        for (const methodName of requiredMethods) {
            if (typeof dependency[methodName] !== 'function') {
                console.error(`PlayerPromptService Constructor: Invalid ${dependencyName} dependency. Missing method: ${methodName}(). Provided:`, dependency);
                throw new Error(`PlayerPromptService: Invalid ${dependencyName} dependency. Missing method: ${methodName}().`);
            }
        }
    }

    /**
     * Constructor for PlayerPromptService.
     * @param {PlayerPromptServiceDependencies} dependencies - The dependencies for the service.
     */
    constructor({
                    logger,
                    actionDiscoverySystem,
                    promptOutputPort,
                    worldContext,
                    entityManager,
                    gameDataRepository,
                    validatedEventDispatcher,
                }) {
        super();

        this._validateDependency(logger, 'ILogger', ['error', 'info', 'debug', 'warn']);
        this.#logger = logger;

        this._validateDependency(actionDiscoverySystem, 'IActionDiscoverySystem', ['getValidActions']);
        this.#actionDiscoverySystem = actionDiscoverySystem;

        this._validateDependency(promptOutputPort, 'IPromptOutputPort', ['prompt']);
        this.#promptOutputPort = promptOutputPort;

        this._validateDependency(worldContext, 'IWorldContext', ['getLocationOfEntity']);
        this.#worldContext = worldContext;

        this._validateDependency(entityManager, 'IEntityManager', ['getEntityInstance']);
        this.#entityManager = entityManager;

        this._validateDependency(gameDataRepository, 'IGameDataRepository', ['getActionDefinition']);
        this.#gameDataRepository = gameDataRepository;

        this._validateDependency(validatedEventDispatcher, 'IValidatedEventDispatcher', ['subscribe', 'unsubscribe']);
        this.#validatedEventDispatcher = validatedEventDispatcher;

        this.#logger.info('PlayerPromptService initialized successfully.');
    }

    /**
     * @private
     * Clears the currently active prompt, unsubscribing its listener and rejecting its promise.
     * @param {PromptError | DOMException | null} [rejectionError=null] - The error to reject the current prompt's promise with.
     * If null, a default "superseded" error is used.
     */
    #clearCurrentPrompt(rejectionError = null) {
        if (!this.#currentPromptContext) {
            this.#logger.debug("PlayerPromptService.#clearCurrentPrompt: No current prompt context to clear or already cleared by its own resolution/rejection.");
            return;
        }

        const contextToClear = this.#currentPromptContext;
        this.#currentPromptContext = null; // Clear global reference immediately

        const oldActorId = contextToClear.actorId;
        this.#logger.warn(`PlayerPromptService.#clearCurrentPrompt: Clearing active prompt for actor ${oldActorId}.`);

        // If the context was already settled, its own resolve/reject should have handled cleanup.
        if (contextToClear.isResolvedOrRejected) {
            this.#logger.debug(`PlayerPromptService.#clearCurrentPrompt: Prompt for actor ${oldActorId} was already settled. Associated cleanup should have occurred via its resolve/reject.`);
            contextToClear.unsubscribe = null;
            contextToClear.abortListenerCleanup = null;
            return;
        }

        this.#logger.debug(`PlayerPromptService.#clearCurrentPrompt: Prompt for actor ${oldActorId} is being explicitly cleared and rejected.`);

        if (typeof contextToClear.unsubscribe === 'function') {
            try {
                contextToClear.unsubscribe();
                this.#logger.debug(`PlayerPromptService.#clearCurrentPrompt: Successfully unsubscribed event listener for previous prompt (actor ${oldActorId}).`);
            } catch (unsubError) {
                this.#logger.error(`PlayerPromptService: Error unsubscribing listener for previous prompt (actor ${oldActorId}).`, unsubError);
            }
            contextToClear.unsubscribe = null;
        }

        if (typeof contextToClear.abortListenerCleanup === 'function') {
            try {
                contextToClear.abortListenerCleanup();
                this.#logger.debug(`PlayerPromptService.#clearCurrentPrompt: Cleaned up abort listener for actor ${oldActorId}.`);
            } catch (cleanupError) {
                this.#logger.error(`PlayerPromptService: Error cleaning up abort listener for actor ${oldActorId}.`, cleanupError);
            }
            contextToClear.abortListenerCleanup = null;
        }

        let errorToRejectWith = rejectionError;
        if (!errorToRejectWith) {
            if (contextToClear.cancellationSignal?.aborted) {
                errorToRejectWith = new DOMException('Prompt aborted by signal before being superseded by external clear.', 'AbortError');
            } else {
                if (!rejectionError) {
                    errorToRejectWith = new PromptError(`Prompt for actor ${oldActorId} was superseded by an unspecified reason.`, null, "PROMPT_SUPERSEDED");
                }
            }
        }

        contextToClear.reject(errorToRejectWith);
    }

    /**
     * @private
     * Validates the actor, checks for initial cancellation, and clears any existing prompt.
     */
    async _preparePromptSession(actor, cancellationSignal) {
        if (cancellationSignal?.aborted) {
            this.#logger.warn(`PlayerPromptService._preparePromptSession: Prompt initiation for actor ${actor?.id || 'UNKNOWN'} aborted as signal was already aborted.`);
            throw new DOMException('Prompt aborted by signal before initiation.', 'AbortError');
        }

        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
            const errorMsg = `Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(actor)}`;
            this.#logger.error('PlayerPromptService._preparePromptSession: Invalid actor provided.', {actor});
            throw new PromptError(errorMsg, null, "INVALID_ACTOR");
        }
        const actorId = actor.id;

        if (this.#currentPromptContext) {
            const oldPromptActorId = this.#currentPromptContext.actorId;
            this.#logger.warn(`PlayerPromptService._preparePromptSession: New prompt for ${actorId} is superseding an existing prompt for ${oldPromptActorId}.`);

            let rejectionMsg = `New prompt initiated for actor ${actorId}, superseding previous prompt for ${oldPromptActorId}.`;
            if (actorId === oldPromptActorId) {
                rejectionMsg = `New prompt re-initiated for actor ${actorId}, superseding existing prompt.`;
            }
            this.#clearCurrentPrompt(new PromptError(rejectionMsg, null, "PROMPT_SUPERSEDED_BY_NEW_REQUEST"));
        }
        return actorId;
    }

    /**
     * @private
     * Fetches the actor's current location, creates the ActionContext, and discovers valid actions.
     */
    async _fetchContextAndDiscoverActions(actor, actorId, cancellationSignal) {
        let currentLocation;
        try {
            this.#logger.debug(`PlayerPromptService._fetchContextAndDiscoverActions: Fetching location for actor ${actorId}...`);
            currentLocation = await this.#worldContext.getLocationOfEntity(actorId);
            if (!currentLocation) {
                this.#logger.error(`PlayerPromptService._fetchContextAndDiscoverActions: Failed to get location for actor ${actorId}. Location not found or undefined.`);
                throw new PromptError(`Failed to determine actor location for ${actorId}: Location not found or undefined.`, null, "LOCATION_NOT_FOUND");
            }
            this.#logger.debug(`PlayerPromptService._fetchContextAndDiscoverActions: Found location ${currentLocation.id} for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService._fetchContextAndDiscoverActions: Error fetching location for actor ${actorId}.`, error);
            if (error instanceof PromptError || error.name === 'AbortError') throw error;
            throw new PromptError(`Failed to determine actor location for ${actorId}. Details: ${error.message}`, error, "LOCATION_FETCH_FAILED");
        }

        if (cancellationSignal?.aborted) {
            this.#logger.warn(`PlayerPromptService._fetchContextAndDiscoverActions: Aborted by signal after location fetch for actor ${actorId}.`);
            throw new DOMException('Prompt aborted by signal during location fetch.', 'AbortError');
        }

        const actionContext = {
            actor: actor,
            currentLocation: currentLocation,
            entityManager: this.#entityManager,
            gameDataRepository: this.#gameDataRepository,
            logger: this.#logger,
            worldContext: this.#worldContext,
        };
        this.#logger.debug(`PlayerPromptService._fetchContextAndDiscoverActions: Created ActionContext for actor ${actorId}.`);

        let discoveredActions;
        try {
            this.#logger.debug(`PlayerPromptService._fetchContextAndDiscoverActions: Discovering valid actions for actor ${actorId}...`);
            discoveredActions = await this.#actionDiscoverySystem.getValidActions(actor, actionContext);
            this.#logger.debug(`PlayerPromptService._fetchContextAndDiscoverActions: Discovered ${discoveredActions.length} actions for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService._fetchContextAndDiscoverActions: Action discovery failed for actor ${actorId}.`, error);
            if (error instanceof PromptError || error.name === 'AbortError') throw error;
            throw new PromptError(`Action discovery failed for actor ${actorId}. Details: ${error.message}`, error, "ACTION_DISCOVERY_FAILED");
        }

        if (cancellationSignal?.aborted) {
            this.#logger.warn(`PlayerPromptService._fetchContextAndDiscoverActions: Aborted by signal after action discovery for actor ${actorId}.`);
            throw new DOMException('Prompt aborted by signal after action discovery.', 'AbortError');
        }

        return {currentLocation, discoveredActions, actionContext};
    }

    /**
     * @private
     * Sends the prompt data (discovered actions or an error message) to the player via the output port.
     */
    async _dispatchPromptToOutputPort(actorId, discoveredActions, cancellationSignal, errorToShow = null) {
        try {
            if (errorToShow) {
                const errorMessage = (errorToShow instanceof Error) ? errorToShow.message : String(errorToShow);
                this.#logger.debug(`PlayerPromptService._dispatchPromptToOutputPort: Sending error prompt for actor ${actorId}. Error: "${errorMessage}"`);
                await this.#promptOutputPort.prompt(actorId, [], errorMessage);
            } else {
                this.#logger.debug(`PlayerPromptService._dispatchPromptToOutputPort: Sending ${discoveredActions?.length || 0} discovered actions to actor ${actorId} via output port...`);
                await this.#promptOutputPort.prompt(actorId, discoveredActions || []);
            }
            this.#logger.info(`PlayerPromptService._dispatchPromptToOutputPort: Successfully sent prompt data for actor ${actorId} via output port.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService._dispatchPromptToOutputPort: Failed to dispatch prompt via output port for actor ${actorId}.`, error);
            if (error instanceof PromptError || error.name === 'AbortError') throw error;
            throw new PromptError(`Failed to dispatch prompt via output port for actor ${actorId}. Details: ${error.message}`, error, "OUTPUT_PORT_DISPATCH_FAILED");
        }

        if (cancellationSignal?.aborted) {
            this.#logger.warn(`PlayerPromptService._dispatchPromptToOutputPort: Aborted by signal after attempting to send prompt for actor ${actorId}.`);
            throw new DOMException('Prompt dispatch aborted by signal after send attempt.', 'AbortError');
        }
    }

    /**
     * @private
     * Handles the PLAYER_TURN_SUBMITTED_ID event.
     */
    _handlePlayerTurnSubmittedEvent(eventObject, localPromptContext, resolve, reject) {
        if (this.#currentPromptContext !== null && this.#currentPromptContext !== localPromptContext) {
            this.#logger.warn(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Stale listener for actor ${localPromptContext.actorId} (event ${eventObject?.type}) received ${PLAYER_TURN_SUBMITTED_ID}, but current global prompt is for ${this.#currentPromptContext?.actorId}. This specific prompt instance will ignore.`);
            return;
        }
        if (localPromptContext.isResolvedOrRejected) {
            // Corrected log to match test expectation
            this.#logger.debug(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Listener for ${localPromptContext.actorId} (event ${eventObject?.type}) received event but prompt already settled. Ignoring.`);
            return;
        }

        if (eventObject && eventObject.payload && typeof eventObject.payload.submittedByActorId === 'string') {
            const submittedByActorId = eventObject.payload.submittedByActorId;
            if (submittedByActorId !== localPromptContext.actorId) {
                this.#logger.debug(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Received ${PLAYER_TURN_SUBMITTED_ID} for actor ${submittedByActorId}, but this prompt is for ${localPromptContext.actorId}. Ignoring.`);
                return;
            }
        } else {
            this.#logger.debug(`PlayerPromptService._handlePlayerTurnSubmittedEvent: ${PLAYER_TURN_SUBMITTED_ID} event did not contain 'submittedByActorId'. Proceeding based on this prompt's actor: ${localPromptContext.actorId}.`);
        }

        this.#logger.debug(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Active listener for actor ${localPromptContext.actorId} received ${PLAYER_TURN_SUBMITTED_ID}. Full Event:`, eventObject);

        if (!eventObject || eventObject.type !== PLAYER_TURN_SUBMITTED_ID || !eventObject.payload || typeof eventObject.payload !== 'object') {
            this.#logger.error(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid event object structure for prompt (actor ${localPromptContext.actorId}). Received:`, eventObject);
            reject(new PromptError(`Malformed event object for ${PLAYER_TURN_SUBMITTED_ID} for actor ${localPromptContext.actorId}.`, null, "INVALID_EVENT_STRUCTURE"));
            return;
        }

        const actualPayload = eventObject.payload;

        if (typeof actualPayload.actionId !== 'string' || actualPayload.actionId.trim() === '') {
            this.#logger.error(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid or missing actionId in payload for prompt (actor ${localPromptContext.actorId}). Payload:`, actualPayload);
            reject(new PromptError(`Invalid actionId in payload for ${PLAYER_TURN_SUBMITTED_ID} for actor ${localPromptContext.actorId}.`, null, "INVALID_PAYLOAD_CONTENT"));
            return;
        }

        const {actionId: submittedActionId, speech} = actualPayload;
        const actionsForThisPrompt = localPromptContext.discoveredActions;

        const selectedAction = actionsForThisPrompt.find(da => {
            if (!da || typeof da.id !== 'string') {
                this.#logger.warn(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${localPromptContext.actorId}). Item:`, da);
                return false;
            }
            return da.id === submittedActionId;
        });

        if (!selectedAction) {
            this.#logger.error(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid actionId '${submittedActionId}' for prompt (actor ${localPromptContext.actorId}). Not found.`, {
                discoveredActionsPreview: actionsForThisPrompt.map(item => item ? {
                    id: item.id,
                    name: item.name,
                    command: item.command
                } : {error: "Null/undefined item"}),
                receivedActionId: submittedActionId
            });
            reject(new PromptError(`Invalid actionId '${submittedActionId}' submitted by actor ${localPromptContext.actorId}. Action not available.`, null, "INVALID_ACTION_ID"));
        } else {
            if (typeof selectedAction.name !== 'string' || selectedAction.name.trim() === '') {
                this.#logger.warn(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Action '${submittedActionId}' found for prompt (actor ${localPromptContext.actorId}), but missing 'name'. Action:`, selectedAction);
            }
            this.#logger.info(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Valid actionId '${submittedActionId}' (Name: '${selectedAction.name || "N/A"}') for prompt (actor ${localPromptContext.actorId}). Resolving.`);
            resolve({action: selectedAction, speech: speech || null});
        }
    }

    /**
     * Prompts the specified actor for an action.
     */
    async prompt(actor, {cancellationSignal} = {}) {
        this.#logger.debug(`PlayerPromptService.prompt: Initiating prompt for actor ${actor?.id ?? 'INVALID'}. Signal provided: ${!!cancellationSignal}`);

        let actorId;
        let discoveredActions;

        try {
            actorId = await this._preparePromptSession(actor, cancellationSignal);
            this.#logger.debug(`PlayerPromptService.prompt: Session prepared for actor ${actorId}.`);

            const contextAndActions = await this._fetchContextAndDiscoverActions(actor, actorId, cancellationSignal);
            discoveredActions = contextAndActions.discoveredActions;
            this.#logger.debug(`PlayerPromptService.prompt: Context fetched and ${discoveredActions.length} actions discovered for actor ${actorId}.`);

            await this._dispatchPromptToOutputPort(actorId, discoveredActions, cancellationSignal, null);
            this.#logger.debug(`PlayerPromptService.prompt: Prompt dispatched to output port for actor ${actorId}.`);

        } catch (error) {
            this.#logger.error(`PlayerPromptService.prompt: Error during prompt setup for actor ${actor?.id ?? (actorId || 'UNKNOWN')}.`, error);
            if (error instanceof PromptError && error.code === "ACTION_DISCOVERY_FAILED") {
                const idForError = actorId || actor?.id || 'UNKNOWN_ACTOR';
                try {
                    this.#logger.warn(`PlayerPromptService.prompt: Attempting to send action discovery failure to output port for actor ${idForError}.`);
                    await this._dispatchPromptToOutputPort(idForError, null, cancellationSignal, error);
                } catch (dispatchError) {
                    this.#logger.error(`PlayerPromptService.prompt: Failed to dispatch action discovery error to output port for actor ${idForError}. Initial error: ${error.message}`, dispatchError);
                }
            }
            throw error;
        }

        return new Promise((originalPromiseResolve, originalPromiseReject) => {
            const logger = this.#logger;

            const localPromptContext = {
                actorId: actorId,
                discoveredActions: discoveredActions,
                cancellationSignal: cancellationSignal,
                isResolvedOrRejected: false,
                unsubscribe: null,
                abortListenerCleanup: null,

                resolve: (value) => {
                    if (localPromptContext.isResolvedOrRejected) {
                        logger.warn(`PlayerPromptService.prompt.localPromptContext.resolve for actor ${localPromptContext.actorId} called, but prompt already settled.`);
                        return;
                    }
                    localPromptContext.isResolvedOrRejected = true;
                    logger.debug(`PlayerPromptService.prompt.localPromptContext.resolve for actor ${localPromptContext.actorId} - resolving.`);

                    if (typeof localPromptContext.unsubscribe === 'function') {
                        try {
                            localPromptContext.unsubscribe();
                        } catch (e) {
                            logger.error(`Error during unsubscribe in resolve for ${localPromptContext.actorId}`, e);
                        }
                        localPromptContext.unsubscribe = null;
                    }
                    if (typeof localPromptContext.abortListenerCleanup === 'function') {
                        try {
                            localPromptContext.abortListenerCleanup();
                        } catch (e) {
                            logger.error(`Error during abortListenerCleanup in resolve for ${localPromptContext.actorId}`, e);
                        }
                        localPromptContext.abortListenerCleanup = null;
                    }

                    if (this.#currentPromptContext === localPromptContext) {
                        this.#currentPromptContext = null;
                    }
                    originalPromiseResolve(value);
                },
                reject: (err) => {
                    if (localPromptContext.isResolvedOrRejected) {
                        logger.warn(`PlayerPromptService.prompt.localPromptContext.reject for actor ${localPromptContext.actorId} called, but prompt already settled. Error: ${err?.message}`);
                        return;
                    }
                    localPromptContext.isResolvedOrRejected = true;
                    logger.debug(`PlayerPromptService.prompt.localPromptContext.reject for actor ${localPromptContext.actorId} - rejecting. Error: ${err?.message}`);

                    if (typeof localPromptContext.unsubscribe === 'function') {
                        try {
                            localPromptContext.unsubscribe();
                        } catch (e) {
                            logger.error(`Error during unsubscribe in reject for ${localPromptContext.actorId}`, e);
                        }
                        localPromptContext.unsubscribe = null;
                    }
                    if (typeof localPromptContext.abortListenerCleanup === 'function') {
                        try {
                            localPromptContext.abortListenerCleanup();
                        } catch (e) {
                            logger.error(`Error during abortListenerCleanup in reject for ${localPromptContext.actorId}`, e);
                        }
                        localPromptContext.abortListenerCleanup = null;
                    }

                    if (this.#currentPromptContext === localPromptContext) {
                        this.#currentPromptContext = null;
                    }
                    originalPromiseReject(err);
                },
            };

            this.#currentPromptContext = localPromptContext;
            logger.debug(`PlayerPromptService.prompt: Current prompt context set for actor ${actorId}.`);

            if (cancellationSignal) {
                const handleAbort = () => {
                    logger.info(`PlayerPromptService.prompt: Abort signal received for actor ${localPromptContext.actorId}.`);
                    localPromptContext.reject(new DOMException('Prompt aborted by signal.', 'AbortError'));
                };
                cancellationSignal.addEventListener('abort', handleAbort, {once: true});
                localPromptContext.abortListenerCleanup = () => {
                    cancellationSignal.removeEventListener('abort', handleAbort);
                };
                logger.debug(`PlayerPromptService.prompt: Abort signal listener set up for actor ${actorId}.`);

                if (cancellationSignal.aborted && !localPromptContext.isResolvedOrRejected) {
                    logger.warn(`PlayerPromptService.prompt: Actor ${actorId}'s prompt was already aborted by signal before subscription attempt.`);
                    localPromptContext.reject(new DOMException('Prompt aborted by signal before event subscription.', 'AbortError'));
                    return;
                }
            }

            try {
                logger.debug(`PlayerPromptService.prompt: Subscribing to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}.`);
                const unsubscribeFunc = this.#validatedEventDispatcher.subscribe(
                    PLAYER_TURN_SUBMITTED_ID,
                    (eventData) => {
                        this._handlePlayerTurnSubmittedEvent(
                            eventData,
                            localPromptContext,
                            localPromptContext.resolve,
                            localPromptContext.reject
                        );
                    }
                );

                if (typeof unsubscribeFunc !== 'function') {
                    logger.error(`PlayerPromptService.prompt: Subscription to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId} did not return an unsubscribe function.`);
                    localPromptContext.reject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}: No unsubscribe function returned.`, null, "SUBSCRIPTION_FAILED"));
                    return;
                }
                localPromptContext.unsubscribe = unsubscribeFunc;
                logger.debug(`PlayerPromptService.prompt: Successfully subscribed to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}. Waiting for input.`);

            } catch (error) {
                logger.error(`PlayerPromptService.prompt: Error subscribing to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}.`, error);
                localPromptContext.reject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}. Details: ${error.message}`, error, "SUBSCRIPTION_ERROR"));
            }
        });
    }

    /**
     * Public method to reset or cancel any ongoing prompt externally.
     */
    cancelCurrentPrompt() {
        this.#logger.info("PlayerPromptService: cancelCurrentPrompt called.");
        if (this.#currentPromptContext) {
            const contextToCancel = this.#currentPromptContext;
            this.#logger.debug(`PlayerPromptService: Attempting to cancel prompt for actor ${contextToCancel.actorId}.`);

            let cancellationError;
            if (contextToCancel.cancellationSignal?.aborted) {
                cancellationError = new DOMException("Prompt already aborted by its signal, then cancelCurrentPrompt called.", "AbortError");
            } else {
                cancellationError = new PromptError("Current player prompt was explicitly cancelled by external request.", null, "PROMPT_CANCELLED");
            }
            this.#clearCurrentPrompt(cancellationError);
        } else {
            // Corrected log to match test expectation
            this.#logger.debug("PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.");
        }
    }
}

export default PlayerPromptService;
// --- FILE END ---