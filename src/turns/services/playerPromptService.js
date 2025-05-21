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
     * @param {PromptError | null} [rejectionError=null] - The error to reject the current prompt's promise with.
     * If null, a default "superseded" error is used.
     */
    #clearCurrentPrompt(rejectionError = null) {
        if (this.#currentPromptContext) {
            this.#logger.warn(`PlayerPromptService: Clearing active prompt for actor ${this.#currentPromptContext.actorId}.`);
            if (this.#currentPromptContext.unsubscribe) {
                try {
                    this.#currentPromptContext.unsubscribe();
                    this.#logger.debug(`PlayerPromptService: Successfully unsubscribed event listener for previous prompt (actor ${this.#currentPromptContext.actorId}).`);
                } catch (unsubError) {
                    this.#logger.error(`PlayerPromptService: Error unsubscribing listener for previous prompt (actor ${this.#currentPromptContext.actorId}).`, unsubError);
                }
            }
            const errorToRejectWith = rejectionError || new PromptError(`Prompt for actor ${this.#currentPromptContext.actorId} was superseded by a new prompt.`, null, "PROMPT_SUPERSEDED");
            this.#currentPromptContext.reject(errorToRejectWith);
            this.#currentPromptContext = null;
        }
    }

    async prompt(actor) {
        this.#logger.debug(`PlayerPromptService: Initiating prompt for actor ${actor?.id ?? 'INVALID'}.`);

        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
            this.#logger.error('PlayerPromptService.prompt: Invalid actor provided.', {actor});
            throw new PromptError(`Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(actor)}`);
        }
        const actorId = actor.id;

        // --- MODIFICATION: Clear any existing prompt ---
        this.#clearCurrentPrompt(new PromptError(`New prompt initiated for actor ${actorId}, superseding previous prompt for ${this.#currentPromptContext?.actorId}.`, null, "PROMPT_SUPERSEDED_BY_SAME_ACTOR_REQUEST"));
        // Note: If actorId is the same as this.#currentPromptContext.actorId, this message might be slightly redundant,
        // but the behavior of clearing the old one is correct.

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
            if (error instanceof PromptError) throw error;
            throw new PromptError(`Failed to determine actor location for ${actorId}`, error);
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
            try {
                await this.#promptOutputPort.prompt(actorId, [], error instanceof Error ? error.message : 'Action discovery error');
            } catch (portError) {
                this.#logger.error(`PlayerPromptService: Failed to send error prompt via output port for actor ${actorId} after discovery failure. Port error:`, portError);
            }
            throw new PromptError(`Action discovery failed for actor ${actorId}`, error);
        }

        try {
            this.#logger.debug(`PlayerPromptService: Calling promptOutputPort.prompt for actor ${actorId}...`);
            await this.#promptOutputPort.prompt(actorId, discoveredActions);
            this.#logger.info(`PlayerPromptService: Successfully sent prompt for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService: Failed to dispatch prompt via output port for actor ${actorId}.`, error);
            throw new PromptError(`Failed to dispatch prompt via output port for actor ${actorId}`, error);
        }

        return new Promise((resolve, reject) => {
            let unsubscribeFromEvent = null;

            const cleanupAndClearCurrentContext = (isError = false, errorDetails = null) => {
                if (this.#currentPromptContext && this.#currentPromptContext.actorId === actorId) {
                    if (this.#currentPromptContext.unsubscribe) { // Should be same as unsubscribeFromEvent
                        try {
                            this.#currentPromptContext.unsubscribe();
                            this.#logger.debug(`PlayerPromptService: Successfully unsubscribed from PLAYER_TURN_SUBMITTED_ID for current prompt (actor ${actorId}).`);
                        } catch (unsubError) {
                            this.#logger.warn(`PlayerPromptService: Error during unsubscription from PLAYER_TURN_SUBMITTED_ID for current prompt (actor ${actorId}).`, unsubError);
                        }
                    }
                    if (isError && !this.#currentPromptContext.isResolved) { // Prevent double rejection
                        this.#currentPromptContext.reject(errorDetails || new PromptError("Prompt cleaned up due to error.", null, "CLEANUP_ERROR"));
                    }
                    this.#currentPromptContext = null; // Clear the global context
                } else if (unsubscribeFromEvent) { // Fallback if context was somehow cleared but listener still exists
                    try {
                        unsubscribeFromEvent();
                    } catch (e) {
                        this.#logger.warn("Error in fallback unsubscribe", e);
                    }
                }
                unsubscribeFromEvent = null; // Ensure local var is also cleared
            };


            this.#logger.debug(`PlayerPromptService: Setting up listener for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`);

            const handlePlayerTurnSubmitted = (eventObject) => {
                // This handler is now only active if it's part of the #currentPromptContext

                if (!this.#currentPromptContext || this.#currentPromptContext.actorId !== actorId) {
                    // This should ideally not happen if unsubscribe for previous prompt worked correctly.
                    // This specific listener instance might be stale if a new prompt was created very rapidly
                    // before this one could be unsubscribed by #clearCurrentPrompt.
                    this.#logger.warn(`PlayerPromptService: Stale listener for actor ${actorId} received PLAYER_TURN_SUBMITTED_ID, but current prompt is for ${this.#currentPromptContext?.actorId}. Ignoring.`);
                    // Ensure this stale listener also cleans itself up if it can.
                    if (unsubscribeFromEvent) {
                        try {
                            unsubscribeFromEvent();
                        } catch (e) {/*ignore*/
                        }
                        unsubscribeFromEvent = null;
                    }
                    return;
                }

                // --- Recommended: Check for submittedByActorId if you modify the event payload ---
                // (This part assumes your event payload will include 'submittedByActorId')
                if (eventObject && eventObject.payload && typeof eventObject.payload.submittedByActorId === 'string') {
                    const submittedByActorId = eventObject.payload.submittedByActorId;
                    if (submittedByActorId !== this.#currentPromptContext.actorId) {
                        this.#logger.debug(`PlayerPromptService: Received PLAYER_TURN_SUBMITTED_ID for actor ${submittedByActorId}, but current prompt is for ${this.#currentPromptContext.actorId}. Ignoring.`);
                        return;
                    }
                } else {
                    this.#logger.debug(`PlayerPromptService: PLAYER_TURN_SUBMITTED_ID event did not contain 'submittedByActorId'. Proceeding based on current prompt context actor: ${this.#currentPromptContext.actorId}.`);
                }
                // --- End Recommended Check ---

                this.#logger.debug(`PlayerPromptService: Active listener for actor ${this.#currentPromptContext.actorId} received PLAYER_TURN_SUBMITTED_ID. Full Event:`, eventObject);

                if (!eventObject || eventObject.type !== PLAYER_TURN_SUBMITTED_ID || !eventObject.payload || typeof eventObject.payload !== 'object') {
                    this.#logger.error(`PlayerPromptService: Invalid event object structure for current prompt (actor ${this.#currentPromptContext.actorId}). Received:`, eventObject);
                    const err = new PromptError(`Malformed event object for PLAYER_TURN_SUBMITTED_ID for actor ${this.#currentPromptContext.actorId}.`, null, "INVALID_EVENT_STRUCTURE");
                    // Reject via the stored reject function and cleanup
                    this.#currentPromptContext.reject(err); // This will be caught by the promise user
                    cleanupAndClearCurrentContext(true, err); // Pass true for isError
                    return;
                }

                const actualPayload = eventObject.payload;

                if (typeof actualPayload.actionId !== 'string' || actualPayload.actionId.trim() === '') {
                    this.#logger.error(`PlayerPromptService: Invalid or missing actionId in payload for current prompt (actor ${this.#currentPromptContext.actorId}). Payload:`, actualPayload);
                    const err = new PromptError(`Invalid actionId in payload for PLAYER_TURN_SUBMITTED_ID for actor ${this.#currentPromptContext.actorId}.`, null, "INVALID_PAYLOAD_CONTENT");
                    this.#currentPromptContext.reject(err);
                    cleanupAndClearCurrentContext(true, err);
                    return;
                }

                const {actionId, speech} = actualPayload;
                const actionsForThisPrompt = this.#currentPromptContext.discoveredActions;

                const selectedAction = actionsForThisPrompt.find(da => {
                    if (!da || typeof da.id !== 'string') {
                        this.#logger.warn(`PlayerPromptService: Malformed item in discoveredActions for current prompt (actor ${this.#currentPromptContext.actorId}). Item:`, da);
                        return false;
                    }
                    return da.id === actionId;
                });

                if (!selectedAction) {
                    this.#logger.error(`PlayerPromptService: Invalid actionId '${actionId}' for current prompt (actor ${this.#currentPromptContext.actorId}). Not found.`, {
                        // Discovered actions for this prompt were stored in #currentPromptContext
                        discoveredActionsPreview: actionsForThisPrompt.map(item => item ? {
                            id: item.id,
                            name: item.name,
                            command: item.command
                        } : {error: "Null/undefined item"}),
                        receivedActionId: actionId
                    });
                    const err = new PromptError(`Invalid actionId '${actionId}' submitted by actor ${this.#currentPromptContext.actorId}. Action not available.`, null, "INVALID_ACTION_ID");
                    this.#currentPromptContext.reject(err);
                    cleanupAndClearCurrentContext(true, err);
                } else {
                    if (typeof selectedAction.name !== 'string' || selectedAction.name.trim() === '') {
                        this.#logger.warn(`PlayerPromptService: Action '${actionId}' found for current prompt (actor ${this.#currentPromptContext.actorId}), but missing 'name'. Action:`, selectedAction);
                    }
                    this.#logger.info(`PlayerPromptService: Valid actionId '${actionId}' (Name: '${selectedAction.name || "N/A"}') for current prompt (actor ${this.#currentPromptContext.actorId}). Resolving.`);

                    // Mark as resolved BEFORE calling resolve to prevent re-entry issues if resolve is synchronous
                    // and somehow triggers another event or prompt immediately.
                    const storedResolve = this.#currentPromptContext.resolve;
                    this.#currentPromptContext.isResolved = true; // Add a flag to the context

                    cleanupAndClearCurrentContext(false); // Call cleanup before resolving
                    storedResolve({action: selectedAction, speech: speech || null});
                }
            };

            try {
                unsubscribeFromEvent = this.#validatedEventDispatcher.subscribe(PLAYER_TURN_SUBMITTED_ID, handlePlayerTurnSubmitted);
                if (typeof unsubscribeFromEvent !== 'function') {
                    this.#logger.error(`PlayerPromptService: Subscription for actor ${actorId} did not return unsubscribe function.`);
                    // No #currentPromptContext to clear yet, just reject the current promise.
                    reject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}: No unsubscribe function returned.`, null, "SUBSCRIPTION_FAILED"));
                    return;
                }

                // --- MODIFICATION: Store the new prompt context ---
                this.#currentPromptContext = {
                    actorId: actorId,
                    resolve: resolve,
                    reject: reject,
                    unsubscribe: unsubscribeFromEvent,
                    discoveredActions: discoveredActions, // Store the actions relevant to this prompt
                    isResolved: false // Flag to prevent multiple resolutions/rejections
                };
                this.#logger.debug(`PlayerPromptService: Successfully subscribed and set current prompt context for actor ${actorId}.`);

            } catch (error) {
                this.#logger.error(`PlayerPromptService: Error subscribing for actor ${actorId}.`, error);
                // No #currentPromptContext to clear yet.
                reject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}.`, error, "SUBSCRIPTION_ERROR"));
            }
        });
    }

    /**
     * Public method to reset or cancel any ongoing prompt.
     * Useful for game state changes like loading a new game or stopping the current one.
     */
    cancelCurrentPrompt() {
        this.#logger.info("PlayerPromptService: cancelCurrentPrompt called.");
        this.#clearCurrentPrompt(new PromptError("Current player prompt was explicitly cancelled.", null, "PROMPT_CANCELLED"));
    }
}

export default PlayerPromptService;
// --- FILE END ---