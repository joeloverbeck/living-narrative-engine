// src/core/services/playerPromptService.js
// --- FILE START ---

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../actions/actionTypes.js').ActionContext} ActionContext */

// --- Import Custom Error ---
// Assuming PromptError is defined in a shared errors location
import { PromptError } from '../../errors/promptError.js';
import { IPlayerPromptService } from '../interfaces/IPlayerPromptService.js'; // Adjusted path and added .js extension

/**
 * @typedef {object} PlayerPromptServiceDependencies
 * @property {ILogger} logger - The logging service.
 * @property {IActionDiscoverySystem} actionDiscoverySystem - Service to discover available actions.
 * @property {IPromptOutputPort} promptOutputPort - Port for sending prompts to the player.
 * @property {IWorldContext} worldContext - Service to access current world state (like entity locations).
 * @property {EntityManager} entityManager - Service to manage entity instances.
 * @property {GameDataRepository} gameDataRepository - Service to access game definition data.
 */

/**
 * @class PlayerPromptService
 * @extends IPlayerPromptService
 * @description Service responsible for determining available player actions and triggering the prompt
 * mechanism via the appropriate output port. Includes error handling.
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

    /**
     * Creates an instance of PlayerPromptService.
     * Validates and injects all required dependencies.
     *
     * @param {PlayerPromptServiceDependencies} dependencies - The dependencies required by the service.
     * @throws {Error} If any required dependency is missing or invalid (lacks essential methods).
     */
    constructor({
                    logger,
                    actionDiscoverySystem,
                    promptOutputPort,
                    worldContext,
                    entityManager,
                    gameDataRepository,
                }) {
        super(); // Call to super is important when extending
        // Validate logger first, as it's used for logging other validation errors.
        if (!logger || typeof logger.error !== 'function' || typeof logger.info !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function') {
            console.error('PlayerPromptService Constructor: Invalid or missing ILogger dependency.');
            // Note: Cannot use PromptError here as logger itself might be invalid
            throw new Error('PlayerPromptService: Invalid or missing ILogger dependency.');
        }
        this.#logger = logger;

        // Validate ActionDiscoverySystem
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IActionDiscoverySystem dependency (requires getValidActions).');
            throw new Error('PlayerPromptService: Invalid or missing IActionDiscoverySystem dependency.');
        }
        this.#actionDiscoverySystem = actionDiscoverySystem;

        // Validate PromptOutputPort
        if (!promptOutputPort || typeof promptOutputPort.prompt !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IPromptOutputPort dependency (requires prompt).');
            throw new Error('PlayerPromptService: Invalid or missing IPromptOutputPort dependency.');
        }
        this.#promptOutputPort = promptOutputPort;

        // Validate WorldContext
        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing IWorldContext dependency (requires getLocationOfEntity).');
            throw new Error('PlayerPromptService: Invalid or missing IWorldContext dependency.');
        }
        this.#worldContext = worldContext;

        // Validate EntityManager
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') { // Check a core method
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing EntityManager dependency (requires getEntityInstance).');
            throw new Error('PlayerPromptService: Invalid or missing EntityManager dependency.');
        }
        this.#entityManager = entityManager;

        // Validate GameDataRepository
        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') { // Check a core method
            this.#logger.error('PlayerPromptService Constructor: Invalid or missing GameDataRepository dependency (requires getActionDefinition).');
            throw new Error('PlayerPromptService: Invalid or missing GameDataRepository dependency.');
        }
        this.#gameDataRepository = gameDataRepository;

        this.#logger.info('PlayerPromptService initialized successfully.');
    }

    /**
     * Fetches the actor's location, discovers available actions, and sends them via the output port.
     * Includes error handling for various stages.
     *
     * @async
     * @param {Entity} actor - The entity (player) to prompt for actions.
     * @returns {Promise<void>} A promise that resolves when the prompt has been sent successfully.
     * @throws {PromptError} If the actor is invalid, location cannot be determined, action discovery fails,
     * or sending the prompt via the output port fails. The error includes details
     * about the failure point and may wrap the original error.
     */
    async prompt(actor) {
        this.#logger.debug(`PlayerPromptService: Initiating prompt for actor ${actor?.id ?? 'INVALID'}.`);

        // 1. Input Validation
        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
            this.#logger.error('PlayerPromptService.prompt: Invalid actor provided.', { actor });
            // No original error to wrap here
            throw new PromptError(`Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(actor)}`);
        }
        const actorId = actor.id;

        // 2. Location Fetch (with Error Handling)
        let currentLocation;
        try {
            this.#logger.debug(`PlayerPromptService: Fetching location for actor ${actorId}...`);
            currentLocation = await this.#worldContext.getLocationOfEntity(actorId);
            // Check for Null/Undefined Location
            if (!currentLocation) {
                this.#logger.error(`PlayerPromptService.prompt: Failed to get location for actor ${actorId} (getLocationOfEntity resolved null/undefined).`);
                // No original error to wrap here
                throw new PromptError(`Failed to determine actor location for ${actorId}: Location not found or undefined.`);
            }
            this.#logger.debug(`PlayerPromptService: Found location ${currentLocation.id} for actor ${actorId}.`);
        } catch (error) {
            // Wrapped Location Fetch Error
            this.#logger.error(`PlayerPromptService.prompt: Error fetching location for actor ${actorId}.`, error);
            // Re-throw specific error even if it was already a PromptError from the null check
            if (error instanceof PromptError) {
                throw error; // Preserve the specific message from the null check
            } else {
                // --- CORRECTED: Pass error directly as second argument ---
                throw new PromptError(`Failed to determine actor location for ${actorId}`, error);
            }
        }

        // 3. Context Creation (Only if location fetch succeeded)
        /** @type {ActionContext} */
        const context = {
            actor: actor,
            currentLocation: currentLocation, // Known to be valid here
            entityManager: this.#entityManager,
            gameDataRepository: this.#gameDataRepository,
            logger: this.#logger,
            worldContext: this.#worldContext,
            // parsedCommand will be undefined during prompt generation
        };
        this.#logger.debug(`PlayerPromptService: Created ActionContext for actor ${actorId}.`);


        // 4 & 5. Action Discovery and Port Call (Wrapped Together)
        let discoveredActions = null; // Flag to check where error occurred
        try {
            // 4. Action Discovery
            this.#logger.debug(`PlayerPromptService: Discovering valid actions for actor ${actorId}...`);
            discoveredActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
            this.#logger.debug(`PlayerPromptService: Discovered ${discoveredActions.length} actions for actor ${actorId}.`);

            // 5. Port Call (Happy Path)
            this.#logger.debug(`PlayerPromptService: Calling promptOutputPort.prompt for actor ${actorId}...`);
            await this.#promptOutputPort.prompt(actorId, discoveredActions); // No error message needed on happy path

            this.#logger.info(`PlayerPromptService: Successfully sent prompt for actor ${actorId}.`);

        } catch (error) {
            // Wrapped Discovery & Port Call Errors
            if (discoveredActions === null) {
                // Error most likely occurred during getValidActions
                this.#logger.error(`PlayerPromptService: Action discovery failed for actor ${actorId}.`, error);

                // Attempt to notify the player via the port about the error
                try {
                    this.#logger.debug(`PlayerPromptService: Attempting to send error prompt via output port for actor ${actorId} after discovery failure.`);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown discovery error';
                    await this.#promptOutputPort.prompt(actorId, [], errorMessage);
                } catch (portError) {
                    // Log the secondary failure but proceed to throw the original discovery error
                    this.#logger.error(`PlayerPromptService: Failed to send error prompt via output port for actor ${actorId} AFTER discovery failure. Original discovery error will be thrown. Port error:`, portError);
                }

                // Re-throw the original discovery error, wrapped
                // --- CORRECTED: Pass error directly as second argument ---
                throw new PromptError(`Action discovery failed for actor ${actorId}`, error);

            } else {
                // Error most likely occurred during the happy-path promptOutputPort.prompt call
                this.#logger.error(`PlayerPromptService: Failed to dispatch prompt via output port for actor ${actorId}.`, error);
                // --- CORRECTED: Pass error directly as second argument ---
                throw new PromptError(`Failed to dispatch prompt via output port for actor ${actorId}`, error);
            }
        }
        // 6. Implicit successful resolution (return undefined) if no errors thrown
    }
}

export default PlayerPromptService;
// --- FILE END ---