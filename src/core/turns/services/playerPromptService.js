// src/core/services/playerPromptService.js
// --- FILE START ---

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */ // Expected to be {id: string, command: string}
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../actions/availableAction.js').default} AvailableAction */ // Typically {id: string, command: string, ...}

// --- Import Custom Error ---
import {PromptError} from '../../errors/promptError.js'; // Adjusted path if necessary
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
 * DiscoveredActionInfo from ActionDiscoverySystem is structurally compatible with AvailableAction for id/command.
 * @typedef {object} PlayerPromptResolution
 * @property {DiscoveredActionInfo} action - The selected available action object (contains id, command, etc.).
 * @property {string | null} speech - The speech input from the player, or null.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEvent
 * @property {string} type - The event type, e.g., PLAYER_TURN_SUBMITTED_ID.
 * @property {CorePlayerTurnSubmittedEventPayload} payload - The nested payload of the event.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEventPayload
 * @property {string} actionId - The ID of the action submitted by the player.
 * @property {string|null} speech - The speech associated with the action.
 */


/**
 * @class PlayerPromptService
 * @extends IPlayerPromptService
 * @description Service responsible for prompting the player for actions and awaiting their response asynchronously.
 * Implements the IPlayerPromptService interface.
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

    /** @type {number} Timeout for player prompt in milliseconds. */
    static #PROMPT_TIMEOUT_MS = 60000; // 60 seconds

    /**
     * Creates an instance of PlayerPromptService.
     * Validates and injects all required dependencies.
     *
     * @param {PlayerPromptServiceDependencies} dependencies - The dependencies required by the service.
     * @throws {Error} If any required dependency is missing or invalid.
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
     * Prompts the actor for an action. It first discovers available actions and sends them to the UI.
     * Then, it returns a Promise that resolves with the player's chosen action and speech
     * once the PLAYER_TURN_SUBMITTED_ID event is received, or rejects on timeout or error.
     *
     * @async
     * @param {Entity} actor - The entity (player) to prompt for actions.
     * @returns {Promise<PlayerPromptResolution>} A promise that resolves with an object containing the
     * selected action (type DiscoveredActionInfo, structurally {id, command}) and speech, or rejects with a PromptError.
     * @throws {PromptError} If initial setup (actor validation, location fetching, action discovery,
     * or sending prompt to UI) fails. The Promise itself can also reject with a PromptError
     * for reasons like timeout, invalid action ID, or subscription issues.
     */
    async prompt(actor) {
        this.#logger.debug(`PlayerPromptService: Initiating prompt for actor ${actor?.id ?? 'INVALID'}.`);

        // 1. Input Validation
        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
            this.#logger.error('PlayerPromptService.prompt: Invalid actor provided.', {actor});
            throw new PromptError(`Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(actor)}`);
        }
        const actorId = actor.id;

        // 2. Location Fetch
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

        // 3. Context Creation
        /** @type {ActionContext} */
        const context = {
            actor: actor,
            currentLocation: currentLocation,
            entityManager: this.#entityManager,
            gameDataRepository: this.#gameDataRepository,
            logger: this.#logger,
            worldContext: this.#worldContext,
        };
        this.#logger.debug(`PlayerPromptService: Created ActionContext for actor ${actorId}.`);

        // 4. Action Discovery
        /** @type {DiscoveredActionInfo[]} */ // This is an array of {id: string, command: string}
        let discoveredActions;
        try {
            this.#logger.debug(`PlayerPromptService: Discovering valid actions for actor ${actorId}...`);
            discoveredActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
            this.#logger.debug(`PlayerPromptService: Discovered ${discoveredActions.length} actions for actor ${actorId}.`);
            // this.#logger.debug(`PlayerPromptService: Discovered actions raw content for actor ${actorId}:`, JSON.stringify(discoveredActions, null, 2));
        } catch (error) {
            this.#logger.error(`PlayerPromptService: Action discovery failed for actor ${actorId}.`, error);
            try {
                await this.#promptOutputPort.prompt(actorId, [], error instanceof Error ? error.message : 'Action discovery error');
            } catch (portError) {
                this.#logger.error(`PlayerPromptService: Failed to send error prompt via output port for actor ${actorId} after discovery failure. Port error:`, portError);
            }
            throw new PromptError(`Action discovery failed for actor ${actorId}`, error);
        }

        // 5. Send Actions to UI
        try {
            this.#logger.debug(`PlayerPromptService: Calling promptOutputPort.prompt for actor ${actorId}...`);
            // Assuming promptOutputPort.prompt can handle DiscoveredActionInfo[] which is {id, command}[]
            await this.#promptOutputPort.prompt(actorId, discoveredActions);
            this.#logger.info(`PlayerPromptService: Successfully sent prompt for actor ${actorId}.`);
        } catch (error) {
            this.#logger.error(`PlayerPromptService: Failed to dispatch prompt via output port for actor ${actorId}.`, error);
            throw new PromptError(`Failed to dispatch prompt via output port for actor ${actorId}`, error);
        }

        // 6. Return Promise to await player input
        return new Promise((resolve, reject) => {
            let timeoutId = null;
            /** @type {(() => void) | null} */
            let unsubscribeFromEvent = null;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (unsubscribeFromEvent) {
                    try {
                        unsubscribeFromEvent();
                        this.#logger.debug(`PlayerPromptService: Successfully unsubscribed from PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`);
                    } catch (unsubError) {
                        this.#logger.warn(`PlayerPromptService: Error during unsubscription from PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`, unsubError);
                    }
                    unsubscribeFromEvent = null;
                }
            };

            this.#logger.debug(`PlayerPromptService: Setting up listener for PLAYER_TURN_SUBMITTED_ID and timeout for actor ${actorId}. Timeout: ${PlayerPromptService.#PROMPT_TIMEOUT_MS}ms.`);

            timeoutId = setTimeout(() => {
                this.#logger.warn(`PlayerPromptService: Prompt timed out for actor ${actorId} after ${PlayerPromptService.#PROMPT_TIMEOUT_MS}ms.`);
                cleanup();
                reject(new PromptError(`Player prompt timed out for actor ${actorId}.`, null, "PROMPT_TIMEOUT"));
            }, PlayerPromptService.#PROMPT_TIMEOUT_MS);

            /**
             * Handles the PLAYER_TURN_SUBMITTED_ID event.
             * @param {CorePlayerTurnSubmittedEvent} eventObject - The full event object from EventBus.
             */
            const handlePlayerTurnSubmitted = (eventObject) => {
                this.#logger.debug(`PlayerPromptService: Received PLAYER_TURN_SUBMITTED_ID event object for actor ${actorId}. Full Event:`, eventObject);

                if (!eventObject ||
                    typeof eventObject.type !== 'string' ||
                    eventObject.type !== PLAYER_TURN_SUBMITTED_ID ||
                    !eventObject.payload ||
                    typeof eventObject.payload !== 'object') {

                    this.#logger.error(`PlayerPromptService: Invalid event object structure received for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}. Expected {type: PLAYER_TURN_SUBMITTED_ID, payload: {...}}. Received:`, eventObject);
                    cleanup();
                    reject(new PromptError(`Malformed event object for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`, null, "INVALID_EVENT_STRUCTURE"));
                    return;
                }

                /** @type {CorePlayerTurnSubmittedEventPayload} */
                const actualPayload = eventObject.payload;

                if (typeof actualPayload.actionId !== 'string' || actualPayload.actionId.trim() === '') {
                    this.#logger.error(`PlayerPromptService: Invalid or missing actionId in payload for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}. Payload:`, actualPayload);
                    cleanup();
                    reject(new PromptError(`Invalid actionId in payload for PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`, null, "INVALID_PAYLOAD_CONTENT"));
                    return;
                }

                cleanup();

                const {actionId, speech} = actualPayload;

                // --- MODIFICATION START ---
                // Find the DiscoveredActionInfo object (which is {id, command}) based on the actionId.
                // `discoveredActions` is an array of `DiscoveredActionInfo` objects.
                const selectedAction = discoveredActions.find(da => {
                    if (!da) {
                        this.#logger.warn(`PlayerPromptService: Encountered a null or undefined item in discoveredActions array while searching for actionId: ${actionId}. Skipping this item.`);
                        return false;
                    }
                    // `da` is expected to be {id: string, command: string}
                    // No longer checking for da.action, as `da` *is* the action info.
                    if (typeof da.id !== 'string') {
                        this.#logger.warn(`PlayerPromptService: Item in discoveredActions is missing 'id' property, or 'id' is not a string. Item: ${JSON.stringify(da)}. This item will be skipped in search for actionId: ${actionId}.`);
                        return false;
                    }
                    return da.id === actionId;
                });

                if (!selectedAction) {
                    this.#logger.error(`PlayerPromptService: Invalid actionId '${actionId}' received for actor ${actorId}. Not found in discovered actions. This could be due to the action not being available, or a malformed item in the originally discovered actions list.`, {
                        discoveredActionsPreview: discoveredActions.map(item => {
                            if (!item) return {error: "Null/undefined item in discoveredActions"};
                            // Item is {id, command}
                            if (typeof item.id !== 'string') return {
                                error: "'id' is not a string",
                                itemDetails: item // Log the problematic item
                            };
                            return {actionId: item.id, command: item.command};
                        }),
                        receivedActionId: actionId
                    });
                    reject(new PromptError(`Invalid actionId '${actionId}' submitted by actor ${actorId}. Action not available.`, null, "INVALID_ACTION_ID"));
                } else {
                    this.#logger.info(`PlayerPromptService: Valid actionId '${actionId}' received for actor ${actorId}. Resolving prompt.`);
                    resolve({
                        action: selectedAction, // `selectedAction` is the DiscoveredActionInfo {id, command}
                        speech: speech || null
                    });
                }
                // --- MODIFICATION END ---
            };

            try {
                unsubscribeFromEvent = this.#validatedEventDispatcher.subscribe(PLAYER_TURN_SUBMITTED_ID, handlePlayerTurnSubmitted);
                if (typeof unsubscribeFromEvent !== 'function') {
                    this.#logger.error(`PlayerPromptService: Subscription to PLAYER_TURN_SUBMITTED_ID for actor ${actorId} did not return an unsubscribe function.`);
                    cleanup();
                    reject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}: No unsubscribe function returned.`, null, "SUBSCRIPTION_FAILED"));
                    return;
                }
                this.#logger.debug(`PlayerPromptService: Successfully subscribed to PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`);
            } catch (error) {
                this.#logger.error(`PlayerPromptService: Error subscribing to PLAYER_TURN_SUBMITTED_ID for actor ${actorId}.`, error);
                cleanup();
                reject(new PromptError(`Failed to subscribe to player input event for actor ${actorId}.`, error, "SUBSCRIPTION_ERROR"));
            }
        });
    }
}

export default PlayerPromptService;
// --- FILE END ---