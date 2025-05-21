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
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../services/gameDataRepository.js').default} GameDataRepository */
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
 * @property {EntityManager} entityManager - Service to manage entity instances.
 * @property {GameDataRepository} gameDataRepository - Service to access game definition data.
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
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameDataRepository} */
    #gameDataRepository;
    /** @type {IValidatedEventDispatcher} */
    #validatedEventDispatcher;

    /**
     * @private
     * @type {CurrentPromptContext | null}
     */
    #currentPromptContext = null;

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

        if (!logger || typeof logger.error !== 'function' || typeof logger.info !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function') {
            console.error('PlayerPromptService Constructor: Invalid or missing ILogger dependency.');
            throw new Error('PlayerPromptService: Invalid or missing ILogger dependency.');
        }
        this.#logger = logger;

        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IActionDiscoverySystem dependency.');
            throw new Error('PlayerPromptService: Invalid or missing IActionDiscoverySystem dependency.');
        }
        this.#actionDiscoverySystem = actionDiscoverySystem;

        if (!promptOutputPort || typeof promptOutputPort.prompt !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IPromptOutputPort dependency.');
            throw new Error('PlayerPromptService: Invalid or missing IPromptOutputPort dependency.');
        }
        this.#promptOutputPort = promptOutputPort;

        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IWorldContext dependency.');
            throw new Error('PlayerPromptService: Invalid or missing IWorldContext dependency.');
        }
        this.#worldContext = worldContext;

        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing EntityManager dependency.');
            throw new Error('PlayerPromptService: Invalid or missing EntityManager dependency.');
        }
        this.#entityManager = entityManager;

        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing GameDataRepository dependency.');
            throw new Error('PlayerPromptService: Invalid or missing GameDataRepository dependency.');
        }
        this.#gameDataRepository = gameDataRepository;

        if (!validatedEventDispatcher || typeof validatedEventDispatcher.subscribe !== 'function' || typeof validatedEventDispatcher.unsubscribe !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IValidatedEventDispatcher dependency (requires subscribe and unsubscribe methods).');
            throw new Error('PlayerPromptService: Invalid or missing IValidatedEventDispatcher dependency.');
        }
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
                // Cleanup listeners if somehow still present, though they should be gone.
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

            // Determine the error to reject with
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
     * Prompts the specified actor for an action.
     * @param {Entity} actor - The actor entity to prompt.
     * @param {object} [options={}] - Optional parameters.
     * @param {AbortSignal} [options.cancellationSignal] - An AbortSignal to cancel the prompt.
     * @returns {Promise<PlayerPromptResolution>} A promise that resolves with the player's chosen action and speech.
     * @throws {PromptError|DOMException} If prompting fails, is superseded, or is aborted.
     */
    async prompt(actor, {cancellationSignal} = {}) {
        this.#logger.debug(`PlayerPromptService: Initiating prompt for actor ${actor?.id ?? 'INVALID'}. Signal provided: ${!!cancellationSignal}`);

        if (cancellationSignal?.aborted) {
            this.#logger.warn(`PlayerPromptService: Prompt initiation for actor ${actor?.id} aborted before starting as signal was already aborted.`);
            throw new DOMException('Prompt aborted by signal before initiation.', 'AbortError');
        }

        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
            this.#logger.error('PlayerPromptService.prompt: Invalid actor provided.', {actor});
            throw new PromptError(`Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(actor)}`);
        }
        const actorId = actor.id;

        // If there's an existing prompt, clear it.
        // The rejectionError here will be used if the signal hasn't already aborted the old prompt.
        if (this.#currentPromptContext) {
            const oldPromptActorId = this.#currentPromptContext.actorId;
            let rejectionMsg = `New prompt initiated for actor ${actorId}, superseding previous prompt for ${oldPromptActorId}.`;
            if (actorId === oldPromptActorId) {
                rejectionMsg = `New prompt re-initiated for actor ${actorId}, superseding existing prompt.`;
            }
            this.#clearCurrentPrompt(new PromptError(rejectionMsg, null, "PROMPT_SUPERSEDED_BY_NEW_REQUEST"));
        }

        let currentLocation;
        try {
            this.#logger.debug(`PlayerPromptService: Fetching location for actor ${actorId}...`);
            currentLocation = await this.#worldContext.getLocationOfEntity(actorId);
            if (!currentLocation) {
                this.#logger.error(`PlayerPromptService.prompt: Failed to get location for actor ${actorId}.`);
                throw new PromptError(`Failed to determine actor location for ${actorId}: Location not found or undefined.`);
            }
            this.#logger.debug(`PlayerPromptService: Found location ${currentLocation.id} for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService.prompt: Error fetching location for actor ${actorId}.`, error);
            if (error instanceof PromptError || error.name === 'AbortError') throw error;
            throw new PromptError(`Failed to determine actor location for ${actorId}`, error);
        }

        if (cancellationSignal?.aborted) { // Check again after async location fetch
            throw new DOMException('Prompt aborted by signal during setup.', 'AbortError');
        }

        const context = {
            actor: actor,
            currentLocation: currentLocation,
            entityManager: this.#entityManager,
            gameDataRepository: this.#gameDataRepository,
            logger: this.#logger,
            worldContext: this.#worldContext,
        };
        this.#logger.debug(`PlayerPromptService: Created ActionContext for actor ${actorId}.`);

        let discoveredActions;
        try {
            this.#logger.debug(`PlayerPromptService: Discovering valid actions for actor ${actorId}...`);
            discoveredActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
            this.#logger.debug(`PlayerPromptService: Discovered ${discoveredActions.length} actions for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService: Action discovery failed for actor ${actorId}.`, error);
            // Attempt to inform UI about the error before re-throwing
            try {
                await this.#promptOutputPort.prompt(actorId, [], error instanceof Error ? error.message : 'Action discovery error');
            } catch (portError) {
                this.#logger.error(`PlayerPromptService: Failed to send error prompt via output port for actor ${actorId} after discovery failure. Port error:`, portError);
            }
            if (error instanceof PromptError || error.name === 'AbortError') throw error;
            throw new PromptError(`Action discovery failed for actor ${actorId}`, error);
        }

        if (cancellationSignal?.aborted) { // Check again after async action discovery
            throw new DOMException('Prompt aborted by signal after action discovery.', 'AbortError');
        }

        try {
            this.#logger.debug(`PlayerPromptService: Calling promptOutputPort.prompt for actor ${actorId}...`);
            await this.#promptOutputPort.prompt(actorId, discoveredActions);
            this.#logger.info(`PlayerPromptService: Successfully sent prompt for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService: Failed to dispatch prompt via output port for actor ${actorId}.`, error);
            if (error instanceof PromptError || error.name === 'AbortError') throw error;
            throw new PromptError(`Failed to dispatch prompt via output port for actor ${actorId}`, error);
        }

        return new Promise((resolve, reject) => {
            let unsubscribeFromEvent = null;
            let abortListenerCleanup = null;

            // Local context for this specific prompt attempt
            const localPromptContext = {
                actorId: actorId,
                resolve: resolve,
                reject: reject,
                unsubscribe: null, // Will be set later
                discoveredActions: discoveredActions,
                cancellationSignal: cancellationSignal,
                abortListenerCleanup: null, // Will be set later
                isResolvedOrRejected: false,
            };

            // Set the global context
            this.#currentPromptContext = localPromptContext;

            const cleanupAndReject = (error) => {
                if (localPromptContext.isResolvedOrRejected) return;
                localPromptContext.isResolvedOrRejected = true;

                if (unsubscribeFromEvent) {
                    try {
                        unsubscribeFromEvent();
                    } catch (e) {
                        this.#logger.warn('Error unsubscribing event on cleanupAndReject', e);
                    }
                }
                if (abortListenerCleanup) {
                    try {
                        abortListenerCleanup();
                    } catch (e) {
                        this.#logger.warn('Error cleaning abort listener on cleanupAndReject', e);
                    }
                }

                reject(error);

                // If this specific prompt context is still the global one, clear it
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
                        this.#logger.warn('Error unsubscribing event on cleanupAndResolve', e);
                    }
                }
                if (abortListenerCleanup) {
                    try {
                        abortListenerCleanup();
                    } catch (e) {
                        this.#logger.warn('Error cleaning abort listener on cleanupAndResolve', e);
                    }
                }

                resolve(value);

                if (this.#currentPromptContext === localPromptContext) {
                    this.#currentPromptContext = null;
                }
            };

            if (cancellationSignal) {
                const handleAbort = () => {
                    this.#logger.info(`PlayerPromptService: Prompt for actor ${actorId} explicitly aborted by signal.`);
                    cleanupAndReject(new DOMException('Prompt aborted by signal.', 'AbortError'));
                };
                cancellationSignal.addEventListener('abort', handleAbort, {once: true});
                abortListenerCleanup = () => {
                    cancellationSignal.removeEventListener('abort', handleAbort);
                };
                localPromptContext.abortListenerCleanup = abortListenerCleanup; // Store for #clearCurrentPrompt
            }

            this.#logger.debug(`PlayerPromptService: Setting up listener for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`);

            const handlePlayerTurnSubmitted = (eventObject) => {
                if (localPromptContext.isResolvedOrRejected) { // Already handled (e.g., by abort)
                    this.#logger.debug(`PlayerPromptService: Listener for ${actorId} received event but prompt already settled. Ignoring.`);
                    return;
                }

                // Ensure this event is for the currently active prompt context.
                // This check is vital if multiple prompts are somehow interleaved,
                // though #clearCurrentPrompt should prevent most of this.
                if (this.#currentPromptContext !== localPromptContext) {
                    this.#logger.warn(`PlayerPromptService: Stale listener for actor ${actorId} received PLAYER_TURN_SUBMITTED_ID, but current global prompt is for ${this.#currentPromptContext?.actorId}. This specific prompt instance will ignore.`);
                    // This specific listener might self-unsubscribe if it can, but the main cleanup paths are in cleanupAndReject/Resolve
                    return;
                }


                if (eventObject && eventObject.payload && typeof eventObject.payload.submittedByActorId === 'string') {
                    const submittedByActorId = eventObject.payload.submittedByActorId;
                    if (submittedByActorId !== actorId) { // Check against this prompt's actorId
                        this.#logger.debug(`PlayerPromptService: Received PLAYER_TURN_SUBMITTED_ID for actor ${submittedByActorId}, but this prompt is for ${actorId}. Ignoring.`);
                        return;
                    }
                } else {
                    this.#logger.debug(`PlayerPromptService: PLAYER_TURN_SUBMITTED_ID event did not contain 'submittedByActorId'. Proceeding based on this prompt's actor: ${actorId}.`);
                }

                this.#logger.debug(`PlayerPromptService: Active listener for actor ${actorId} received PLAYER_TURN_SUBMITTED_ID. Full Event:`, eventObject);

                if (!eventObject || eventObject.type !== PLAYER_TURN_SUBMITTED_ID || !eventObject.payload || typeof eventObject.payload !== 'object') {
                    this.#logger.error(`PlayerPromptService: Invalid event object structure for current prompt (actor ${actorId}). Received:`, eventObject);
                    cleanupAndReject(new PromptError(`Malformed event object for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`, null, "INVALID_EVENT_STRUCTURE"));
                    return;
                }

                const actualPayload = eventObject.payload;

                if (typeof actualPayload.actionId !== 'string' || actualPayload.actionId.trim() === '') {
                    this.#logger.error(`PlayerPromptService: Invalid or missing actionId in payload for current prompt (actor ${actorId}). Payload:`, actualPayload);
                    cleanupAndReject(new PromptError(`Invalid actionId in payload for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`, null, "INVALID_PAYLOAD_CONTENT"));
                    return;
                }

                const {actionId: submittedActionId, speech} = actualPayload;
                const actionsForThisPrompt = localPromptContext.discoveredActions;

                const selectedAction = actionsForThisPrompt.find(da => {
                    if (!da || typeof da.id !== 'string') {
                        this.#logger.warn(`PlayerPromptService: Malformed item in discoveredActions for current prompt (actor ${actorId}). Item:`, da);
                        return false;
                    }
                    return da.id === submittedActionId;
                });

                if (!selectedAction) {
                    this.#logger.error(`PlayerPromptService: Invalid actionId '${submittedActionId}' for current prompt (actor ${actorId}). Not found.`, {
                        discoveredActionsPreview: actionsForThisPrompt.map(item => item ? {
                            id: item.id,
                            name: item.name,
                            command: item.command
                        } : {error: "Null/undefined item"}),
                        receivedActionId: submittedActionId
                    });
                    cleanupAndReject(new PromptError(`Invalid actionId '${submittedActionId}' submitted by actor ${actorId}. Action not available.`, null, "INVALID_ACTION_ID"));
                } else {
                    if (typeof selectedAction.name !== 'string' || selectedAction.name.trim() === '') {
                        this.#logger.warn(`PlayerPromptService: Action '${submittedActionId}' found for current prompt (actor ${actorId}), but missing 'name'. Action:`, selectedAction);
                    }
                    this.#logger.info(`PlayerPromptService: Valid actionId '${submittedActionId}' (Name: '${selectedAction.name || "N/A"}') for current prompt (actor ${actorId}). Resolving.`);
                    cleanupAndResolve({action: selectedAction, speech: speech || null});
                }
            };

            try {
                unsubscribeFromEvent = this.#validatedEventDispatcher.subscribe(PLAYER_TURN_SUBMITTED_ID, handlePlayerTurnSubmitted);
                if (typeof unsubscribeFromEvent !== 'function') {
                    this.#logger.error(`PlayerPromptService: Subscription for actor ${actorId} did not return unsubscribe function.`);
                    cleanupAndReject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}: No unsubscribe function returned.`, null, "SUBSCRIPTION_FAILED"));
                    return;
                }
                localPromptContext.unsubscribe = unsubscribeFromEvent; // Store for #clearCurrentPrompt
                this.#logger.debug(`PlayerPromptService: Successfully subscribed and set current prompt context for actor ${actorId}.`);

            } catch (error) {
                this.#logger.error(`PlayerPromptService: Error subscribing for actor ${actorId}.`, error);
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
                // If the signal is already aborted, #clearCurrentPrompt will use AbortError or the signal's reason.
                // Or, the abort listener might have already cleared it.
                this.#logger.debug("PlayerPromptService: Current prompt's signal already aborted or prompt may have self-cleaned.");
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