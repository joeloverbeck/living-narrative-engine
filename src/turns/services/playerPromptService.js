// src/turns/services/playerPromptService.js
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
// UPDATED/ADDED Imports for EntityManager
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
// /** @typedef {import('../../entities/entityManager.js').default} EntityManager */ // Original, to be replaced by IEntityManager for the dependency
// /** @typedef {import('../../services/gameDataRepository.js').default} GameDataRepository */ // Replaced by IGameDataRepository for dependency typing
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
        if (this.#currentPromptContext) {
            const oldActorId = this.#currentPromptContext.actorId;
            this.#logger.warn(`PlayerPromptService: Clearing active prompt for actor ${oldActorId}.`);

            if (this.#currentPromptContext.isResolvedOrRejected) {
                this.#logger.debug(`PlayerPromptService: Prompt for actor ${oldActorId} already settled. No further rejection needed.`);
                if (this.#currentPromptContext.unsubscribe) {
                    try {
                        this.#currentPromptContext.unsubscribe();
                    } catch (e) { /* ignore */
                    }
                }
                if (this.#currentPromptContext.abortListenerCleanup) {
                    try {
                        this.#currentPromptContext.abortListenerCleanup();
                    } catch (e) { /* ignore */
                    }
                }
                this.#currentPromptContext = null;
                return;
            }

            this.#currentPromptContext.isResolvedOrRejected = true; // Mark as settled

            if (this.#currentPromptContext.unsubscribe) {
                try {
                    this.#currentPromptContext.unsubscribe();
                    this.#logger.debug(`PlayerPromptService: Successfully unsubscribed event listener for previous prompt (actor ${oldActorId}).`);
                } catch (unsubError) {
                    this.#logger.error(`PlayerPromptService: Error unsubscribing listener for previous prompt (actor ${oldActorId}).`, unsubError);
                }
            }

            if (this.#currentPromptContext.abortListenerCleanup) {
                try {
                    this.#currentPromptContext.abortListenerCleanup();
                    this.#logger.debug(`PlayerPromptService: Cleaned up abort listener for actor ${oldActorId}.`);
                } catch (cleanupError) {
                    this.#logger.error(`PlayerPromptService: Error cleaning up abort listener for actor ${oldActorId}.`, cleanupError);
                }
            }

            let errorToRejectWith;
            if (rejectionError) {
                errorToRejectWith = rejectionError;
            } else if (this.#currentPromptContext.cancellationSignal?.aborted) {
                errorToRejectWith = new DOMException('Prompt aborted by signal before being superseded.', 'AbortError');
            } else {
                errorToRejectWith = new PromptError(`Prompt for actor ${oldActorId} was superseded by a new prompt.`, null, "PROMPT_SUPERSEDED");
            }

            this.#currentPromptContext.reject(errorToRejectWith);
            this.#currentPromptContext = null;
        }
    }

    /**
     * @private
     * Validates the actor, checks for initial cancellation, and clears any existing prompt.
     * This method is intended to be called at the beginning of the `prompt` orchestrator.
     * @param {Entity} actor - The actor entity to prompt.
     * @param {AbortSignal | undefined} cancellationSignal - An AbortSignal to cancel the prompt.
     * @returns {Promise<string>} The validated actor ID.
     * @throws {PromptError} If actor validation fails.
     * @throws {DOMException} If the prompt is aborted by the signal before starting.
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
     * @param {Entity} actor - The actor entity for whom to discover actions.
     * @param {string} actorId - The validated ID of the actor.
     * @param {AbortSignal | undefined} cancellationSignal - An AbortSignal for potential cancellation.
     * @returns {Promise<{currentLocation: Entity, discoveredActions: DiscoveredActionInfo[], actionContext: ActionContext}>}
     * An object containing the actor's current location, the list of discovered actions, and the ActionContext used for discovery.
     * @throws {PromptError} If location fetching fails or action discovery fails.
     * @throws {DOMException} If the operation is aborted by the signal.
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
     * @param {string} actorId - The ID of the actor being prompted.
     * @param {DiscoveredActionInfo[] | null} discoveredActions - An array of discovered actions. Can be null if sending an error message.
     * @param {AbortSignal | undefined} cancellationSignal - An AbortSignal for potential cancellation during the dispatch.
     * @param {Error | null} [errorToShow=null] - If provided, its message will be sent as the prompt content instead of actions.
     * @returns {Promise<void>} Resolves when the prompt has been successfully sent.
     * @throws {PromptError} If dispatching via the output port fails.
     * @throws {DOMException} If the operation is aborted by the signal.
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
     * Handles the PLAYER_TURN_SUBMITTED_ID event, validating it and resolving/rejecting the prompt.
     * This method is designed to be called as the handler for the event subscription.
     * @param {CorePlayerTurnSubmittedEvent} eventObject - The event object received from the dispatcher.
     * @param {CurrentPromptContext} localPromptContext - The context of the currently active prompt for which this event might be relevant.
     * @param {(resolution: PlayerPromptResolution) => void} resolve - The resolve function of the active prompt's promise (from `localPromptContext.resolve`).
     * @param {(reason?: any) => void} reject - The reject function of the active prompt's promise (from `localPromptContext.reject`).
     */
    _handlePlayerTurnSubmittedEvent(eventObject, localPromptContext, resolve, reject) {
        if (localPromptContext.isResolvedOrRejected) {
            this.#logger.debug(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Listener for ${localPromptContext.actorId} (event ${eventObject?.type}) received event but prompt already settled. Ignoring.`);
            return;
        }

        // This check confirms the event is for the globally current prompt context,
        // which should be the localPromptContext that this handler is associated with.
        if (this.#currentPromptContext !== localPromptContext) {
            this.#logger.warn(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Stale listener for actor ${localPromptContext.actorId} (event ${eventObject?.type}) received ${PLAYER_TURN_SUBMITTED_ID}, but current global prompt is for ${this.#currentPromptContext?.actorId}. This specific prompt instance will ignore.`);
            return;
        }

        // Actor ID validation
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

        // Event structure validation
        if (!eventObject || eventObject.type !== PLAYER_TURN_SUBMITTED_ID || !eventObject.payload || typeof eventObject.payload !== 'object') {
            this.#logger.error(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid event object structure for prompt (actor ${localPromptContext.actorId}). Received:`, eventObject);
            reject(new PromptError(`Malformed event object for ${PLAYER_TURN_SUBMITTED_ID} for actor ${localPromptContext.actorId}.`, null, "INVALID_EVENT_STRUCTURE"));
            return;
        }

        const actualPayload = eventObject.payload;

        // Payload content validation (actualPayload.actionId)
        if (typeof actualPayload.actionId !== 'string' || actualPayload.actionId.trim() === '') {
            this.#logger.error(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid or missing actionId in payload for prompt (actor ${localPromptContext.actorId}). Payload:`, actualPayload);
            reject(new PromptError(`Invalid actionId in payload for ${PLAYER_TURN_SUBMITTED_ID} for actor ${localPromptContext.actorId}.`, null, "INVALID_PAYLOAD_CONTENT"));
            return;
        }

        const {actionId: submittedActionId, speech} = actualPayload;
        const actionsForThisPrompt = localPromptContext.discoveredActions;

        // Finding selectedAction from localPromptContext.discoveredActions
        const selectedAction = actionsForThisPrompt.find(da => {
            if (!da || typeof da.id !== 'string') {
                this.#logger.warn(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${localPromptContext.actorId}). Item:`, da);
                return false;
            }
            return da.id === submittedActionId;
        });

        // Validating selectedAction and resolving/rejecting
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
     * @param {Entity} actor - The actor entity to prompt.
     * @param {object} [options={}] - Optional parameters.
     * @param {AbortSignal} [options.cancellationSignal] - An AbortSignal to cancel the prompt.
     * @returns {Promise<PlayerPromptResolution>} A promise that resolves with the player's chosen action and speech.
     * @throws {PromptError|DOMException} If prompting fails, is superseded, or is aborted.
     */
    async prompt(actor, {cancellationSignal} = {}) {
        this.#logger.debug(`PlayerPromptService.prompt: Initiating prompt for actor ${actor?.id ?? 'INVALID'}. Signal provided: ${!!cancellationSignal}`);

        const actorId = await this._preparePromptSession(actor, cancellationSignal);

        let discoveredActions;
        try {
            this.#logger.debug(`PlayerPromptService.prompt: Calling _fetchContextAndDiscoverActions for actor ${actorId}.`);
            const contextData = await this._fetchContextAndDiscoverActions(actor, actorId, cancellationSignal);
            discoveredActions = contextData.discoveredActions;
            this.#logger.debug(`PlayerPromptService.prompt: Successfully fetched context and discovered ${discoveredActions.length} actions for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService.prompt: Error during _fetchContextAndDiscoverActions for actor ${actorId}. Propagating error.`, error);
            throw error;
        }

        if (cancellationSignal?.aborted) {
            this.#logger.warn(`PlayerPromptService.prompt: Prompt for actor ${actorId} aborted by signal after successful context/action fetch, before output port call.`);
            throw new DOMException('Prompt aborted by signal after context/action fetch.', 'AbortError');
        }

        try {
            this.#logger.debug(`PlayerPromptService.prompt: Calling _dispatchPromptToOutputPort for actor ${actorId} with ${discoveredActions?.length || 0} actions.`);
            await this._dispatchPromptToOutputPort(actorId, discoveredActions, cancellationSignal, null);
        } catch (error) {
            this.#logger.error(`PlayerPromptService.prompt: Error during prompt dispatch for actor ${actorId} (via _dispatchPromptToOutputPort). Propagating error.`, error);
            throw error;
        }

        return new Promise((resolve, reject) => {
            let unsubscribeFromEvent = null;
            let abortListenerCleanup = null;

            const localPromptContext = {
                actorId: actorId,
                resolve: resolve, // Original promise resolve
                reject: reject,   // Original promise reject
                unsubscribe: null, // Will be set after successful subscription
                discoveredActions: discoveredActions,
                cancellationSignal: cancellationSignal,
                abortListenerCleanup: null, // Will be set if signal is provided
                isResolvedOrRejected: false,
            };

            this.#currentPromptContext = localPromptContext; // Set as current globally

            const cleanupAndReject = (error) => {
                if (localPromptContext.isResolvedOrRejected) return;
                localPromptContext.isResolvedOrRejected = true;

                if (unsubscribeFromEvent) {
                    try {
                        unsubscribeFromEvent();
                    } catch (e) {
                        this.#logger.warn('PlayerPromptService.prompt: Error unsubscribing event on cleanupAndReject', e);
                    }
                }
                if (abortListenerCleanup) {
                    try {
                        abortListenerCleanup();
                    } catch (e) {
                        this.#logger.warn('PlayerPromptService.prompt: Error cleaning abort listener on cleanupAndReject', e);
                    }
                }
                // Use the original reject from the Promise constructor
                localPromptContext.reject(error);
                if (this.#currentPromptContext === localPromptContext) {
                    this.#currentPromptContext = null;
                }
            };

            const cleanupAndResolve = (value) => {
                if (localPromptContext.isResolvedOrRejected) return;
                localPromptContext.isResolvedOrRejected = true;

                if (unsubscribeFromEvent) {
                    try {
                        unsubscribeFromEvent();
                    } catch (e) {
                        this.#logger.warn('PlayerPromptService.prompt: Error unsubscribing event on cleanupAndResolve', e);
                    }
                }
                if (abortListenerCleanup) {
                    try {
                        abortListenerCleanup();
                    } catch (e) {
                        this.#logger.warn('PlayerPromptService.prompt: Error cleaning abort listener on cleanupAndResolve', e);
                    }
                }
                // Use the original resolve from the Promise constructor
                localPromptContext.resolve(value);
                if (this.#currentPromptContext === localPromptContext) {
                    this.#currentPromptContext = null;
                }
            };

            if (cancellationSignal) {
                const handleAbort = () => {
                    this.#logger.info(`PlayerPromptService.prompt: Prompt for actor ${actorId} explicitly aborted by signal (Promise listener).`);
                    cleanupAndReject(new DOMException('Prompt aborted by signal.', 'AbortError'));
                };
                cancellationSignal.addEventListener('abort', handleAbort, {once: true});
                abortListenerCleanup = () => {
                    cancellationSignal.removeEventListener('abort', handleAbort);
                };
                localPromptContext.abortListenerCleanup = abortListenerCleanup;
            }

            if (cancellationSignal?.aborted) { // Check again after setting up listener, just in case
                this.#logger.warn(`PlayerPromptService.prompt: Prompt for actor ${actorId} aborted by signal just before event subscription.`);
                cleanupAndReject(new DOMException('Prompt aborted by signal before subscription.', 'AbortError'));
                return; // Exit Promise executor
            }

            this.#logger.debug(`PlayerPromptService.prompt: Setting up listener for ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}.`);

            const handlePlayerTurnSubmitted = (eventObject) => {
                // Delegate all logic to the new private method
                this._handlePlayerTurnSubmittedEvent(eventObject, localPromptContext, cleanupAndResolve, cleanupAndReject);
            };

            try {
                unsubscribeFromEvent = this.#validatedEventDispatcher.subscribe(PLAYER_TURN_SUBMITTED_ID, handlePlayerTurnSubmitted);
                if (typeof unsubscribeFromEvent !== 'function') {
                    this.#logger.error(`PlayerPromptService.prompt: Subscription for actor ${actorId} did not return unsubscribe function.`);
                    cleanupAndReject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}: No unsubscribe function returned.`, null, "SUBSCRIPTION_FAILED"));
                    return; // Exit Promise executor
                }
                localPromptContext.unsubscribe = unsubscribeFromEvent; // Store for cleanup
                this.#logger.debug(`PlayerPromptService.prompt: Successfully subscribed and set current prompt context for actor ${actorId}.`);

            } catch (error) {
                this.#logger.error(`PlayerPromptService.prompt: Error subscribing for actor ${actorId}.`, error);
                cleanupAndReject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}.`, error, "SUBSCRIPTION_ERROR"));
            }
        });
    }

    /**
     * Public method to reset or cancel any ongoing prompt externally.
     * Useful for game state changes like loading a new game or stopping the current one.
     * If a cancellationSignal was associated with the current prompt, this method
     * effectively does what that signal's abort() would do for this service's perspective,
     * but it uses a generic "PROMPT_CANCELLED" reason if not already aborted by its own signal.
     */
    cancelCurrentPrompt() {
        this.#logger.info("PlayerPromptService: cancelCurrentPrompt called.");
        if (this.#currentPromptContext) {
            if (this.#currentPromptContext.cancellationSignal?.aborted) {
                this.#logger.debug("PlayerPromptService: Current prompt's signal already aborted or prompt may have self-cleaned.");
                // Use the same error #clearCurrentPrompt would use if it found an aborted signal
                // and no other error was provided.
                this.#clearCurrentPrompt(new DOMException("Prompt already aborted by its signal, cancelCurrentPrompt called.", "AbortError"));
            } else {
                this.#clearCurrentPrompt(new PromptError("Current player prompt was explicitly cancelled by external request.", null, "PROMPT_CANCELLED"));
            }
        } else {
            this.#logger.debug("PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.");
        }
    }
}

export default PlayerPromptService;
// --- FILE END ---