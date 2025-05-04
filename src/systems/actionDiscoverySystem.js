// src/systems/actionDiscoverySystem.js
// --- FILE START (Entire file content as requested) ---

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../services/actionValidationService.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../services/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */
/** @typedef {import('../services/actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').TargetDomain} TargetDomain */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */ // Assuming ConsoleLogger implementation
/** @typedef {import('../services/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */

// --- Dependency Imports ---
import {ActionTargetContext} from '../models/actionTargetContext.js';
// formatActionCommand is often imported where used, or injected like others
// import {formatActionCommand} from '../services/actionFormatter.js';
import {IActionDiscoverySystem} from "../core/interfaces/IActionDiscoverySystem.js";


/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action definition (e.g., "core:wait").
 * @property {string} command - The formatted command string ready for display/parsing (e.g., "wait", "go north").
 */

/**
 * System responsible for discovering all valid actions an actor can take
 * based on the current game state and loaded action definitions.
 */
export class ActionDiscoverySystem extends IActionDiscoverySystem {
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {ActionValidationService} */
    #actionValidationService;
    /** @private @type {getEntityIdsForScopesFn} */
    #getEntityIdsForScopesFn;
    /** @private @type {formatActionCommandFn} */
    #formatActionCommandFn;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ActionDiscoverySystem.
     * @param {object} dependencies - The required dependencies injected by the container.
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {EntityManager} dependencies.entityManager
     * @param {ActionValidationService} dependencies.actionValidationService
     * @param {ILogger} dependencies.logger
     * @param {formatActionCommandFn} dependencies.formatActionCommandFn
     * @param {getEntityIdsForScopesFn} dependencies.getEntityIdsForScopesFn
     */
    constructor({
                    gameDataRepository,
                    entityManager,
                    actionValidationService,
                    logger,
                    formatActionCommandFn,
                    getEntityIdsForScopesFn
                }) {
        super();


        // --- Existing validation checks ---
        if (!gameDataRepository || !entityManager || !actionValidationService || !logger || !formatActionCommandFn) {
            throw new Error('ActionDiscoverySystem requires GameDataRepository, EntityManager, ActionValidationService, ILogger, and formatActionCommandFn instances.');
        }
        if (!getEntityIdsForScopesFn || typeof getEntityIdsForScopesFn !== 'function') {
            throw new Error('ActionDiscoverySystem requires a valid getEntityIdsForScopesFn function.');
        }
        // --- End validation checks ---

        this.#gameDataRepository = gameDataRepository;
        this.#entityManager = entityManager;
        this.#actionValidationService = actionValidationService;
        this.#logger = logger;
        this.#formatActionCommandFn = formatActionCommandFn;
        this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn;

        this.#logger.info('ActionDiscoverySystem initialized.');
    }

    /**
     * Discovers all valid actions available to the actor, including their IDs and formatted command strings.
     * @param {Entity} actorEntity - The entity for whom to discover actions.
     * @param {ActionContext} context - The broader ActionContext including currentLocation etc.
     * @returns {Promise<DiscoveredActionInfo[]>} A promise resolving to an array of objects, each containing the action ID and formatted command string.
     */
    async getValidActions(actorEntity, context) {
        this.#logger.debug(`Starting action discovery for actor: ${actorEntity.id}`);
        const allActionDefinitions = this.#gameDataRepository.getAllActionDefinitions();
        /** @type {DiscoveredActionInfo[]} */
        const validActions = []; // Store results as objects

        // --- 1. Iterate through all Action Definitions ---
        for (const actionDef of allActionDefinitions) {
            this.#logger.debug(` -> Processing action definition: ${actionDef.id}`);

            // --- Initial Actor Validation Check ---
            const initialActorContext = ActionTargetContext.noTarget();
            if (!this.#actionValidationService.isValid(actionDef, actorEntity, initialActorContext)) {
                this.#logger.debug(`    - Action ${actionDef.id} skipped: Invalid for actor based on initial check.`);
                continue;
            }

            const domain = actionDef.target_domain;
            this.#logger.debug(` -> Passed initial actor check for ${actionDef.id}. Proceeding with target domain: ${domain}`);

            // --- 2. Handle based on Target Domain ---
            try {
                // --- Domain: 'none' or 'self' ---
                if (domain === 'none' || domain === 'self') {
                    const targetContext = (domain === 'self') ? ActionTargetContext.forEntity(actorEntity.id)
                        : ActionTargetContext.noTarget();

                    if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                        const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager, {});
                        if (command !== null) {
                            // --- Store ID and Command ---
                            validActions.push({id: actionDef.id, command: command});
                            this.#logger.debug(`    * Found valid action (no target/self): ${command} (ID: ${actionDef.id})`);
                        } else {
                            this.#logger.warn(`    * Action ${actionDef.id} validated but formatter returned null.`);
                        }
                    } else {
                        this.#logger.debug(`    - Action ${actionDef.id} failed the final context-specific validation for '${domain}' domain.`);
                    }
                }
                // --- Domain: 'direction' ---
                else if (domain === 'direction') {
                    const connectionsData = this.#entityManager.getComponentData(context.currentLocation?.id, 'Connections');
                    this.#logger.debug(`Checking connections data for location: ${context.currentLocation?.id}`, connectionsData);

                    let potentialDirections = [];
                    if (connectionsData && connectionsData.connections && typeof connectionsData.connections === 'object') {
                        potentialDirections = Object.keys(connectionsData.connections);
                        this.#logger.debug(`Extracted potentialDirections: ${potentialDirections.join(', ')}`);
                    } else {
                        this.#logger.debug(`Connections data not found or invalid structure on currentLocation ${context.currentLocation?.id}.`);
                    }

                    if (potentialDirections.length === 0) {
                        this.#logger.debug(`    - No potential direction targets found for action ${actionDef.id}.`);
                    } else {
                        this.#logger.debug(`    - Found ${potentialDirections.length} potential direction targets. Checking validation...`);
                    }

                    for (const direction of potentialDirections) {
                        this.#logger.debug(`    -> Processing direction: ${direction}`);
                        const targetContext = ActionTargetContext.forDirection(direction);
                        if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                            this.#logger.debug(`      - isValid TRUE for ${direction}. Calling formatter.`);
                            const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager, {});
                            if (command !== null) {
                                // --- Store ID and Command ---
                                validActions.push({id: actionDef.id, command: command});
                                this.#logger.debug(`    * Found valid action (direction: ${direction}): ${command} (ID: ${actionDef.id})`);
                            } else {
                                this.#logger.warn(`    * Action ${actionDef.id} validated for direction ${direction} but formatter returned null.`);
                            }
                        } else {
                            this.#logger.debug(`      - isValid FALSE for ${direction}.`);
                        }
                    }
                } // End domain === 'direction'
                // --- Domain: Entity Scopes (inventory, environment, etc.) ---
                else {
                    const potentialTargetIds = this.#getEntityIdsForScopesFn([domain], context);
                    if (potentialTargetIds.size === 0) {
                        this.#logger.debug(`    - No potential targets found in domain '${domain}' for action ${actionDef.id}.`);
                        continue;
                    }

                    this.#logger.debug(`    - Found ${potentialTargetIds.size} potential targets in domain '${domain}'. Checking validation...`);

                    for (const targetId of potentialTargetIds) {
                        const targetEntity = this.#entityManager.getEntityInstance(targetId);
                        if (!targetEntity) {
                            this.#logger.warn(`    - Could not get entity instance for potential target ID ${targetId} from domain ${domain}. Skipping validation.`);
                            continue;
                        }

                        const targetContext = ActionTargetContext.forEntity(targetId);
                        if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                            const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager, {});
                            if (command !== null) {
                                // --- Store ID and Command ---
                                validActions.push({id: actionDef.id, command: command});
                                this.#logger.debug(`    * Found valid action (target ${targetId}): ${command} (ID: ${actionDef.id})`);
                            } else {
                                this.#logger.warn(`    * Action ${actionDef.id} validated for target ${targetId} but formatter returned null.`);
                            }
                        } else {
                            this.#logger.debug(`    - Action ${actionDef.id} invalid for target: ${targetId}.`);
                        }
                    }
                }
            } catch (error) {
                this.#logger.error(`Error processing action definition ${actionDef.id} for actor ${actorEntity.id}:`, error);
                // Continue to the next action definition despite the error
            }
        } // End loop through action definitions

        this.#logger.debug(`Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} valid commands/actions.`);
        return validActions; // Return the array of {id, command} objects
    }
}
