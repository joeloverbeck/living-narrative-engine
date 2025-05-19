// src/systems/actionDiscoverySystem.js
// --- FILE START ---

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
// Note: Duplicate getEntityIdsForScopesFn typedef removed as it's already defined above.

// --- Dependency Imports ---
import {ActionTargetContext} from '../models/actionTargetContext.js';
import {IActionDiscoverySystem} from "../core/interfaces/IActionDiscoverySystem.js";
// --- BEGIN FIX for using core:exits ---
import {EXITS_COMPONENT_ID} from '../constants/componentIds.js'; // Adjust path if necessary
// --- END FIX for using core:exits ---


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

        if (!gameDataRepository || !entityManager || !actionValidationService || !logger || !formatActionCommandFn) {
            throw new Error('ActionDiscoverySystem requires GameDataRepository, EntityManager, ActionValidationService, ILogger, and formatActionCommandFn instances.');
        }
        if (!getEntityIdsForScopesFn || typeof getEntityIdsForScopesFn !== 'function') {
            throw new Error('ActionDiscoverySystem requires a valid getEntityIdsForScopesFn function.');
        }

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
        const validActions = [];

        for (const actionDef of allActionDefinitions) {
            this.#logger.debug(` -> Processing action definition: ${actionDef.id}`);

            const initialActorContext = ActionTargetContext.noTarget();
            if (!this.#actionValidationService.isValid(actionDef, actorEntity, initialActorContext)) {
                this.#logger.debug(`    - Action ${actionDef.id} skipped: Invalid for actor based on initial check.`);
                continue;
            }

            const domain = actionDef.target_domain;
            this.#logger.debug(` -> Passed initial actor check for ${actionDef.id}. Proceeding with target domain: ${domain}`);

            try {
                if (domain === 'none' || domain === 'self') {
                    const targetContext = (domain === 'self') ? ActionTargetContext.forEntity(actorEntity.id)
                        : ActionTargetContext.noTarget();

                    if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                        const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager, {});
                        if (command !== null) {
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
                    // --- BEGIN MODIFICATION: Use core:exits (EXITS_COMPONENT_ID) ---
                    const exitsData = this.#entityManager.getComponentData(context.currentLocation?.id, EXITS_COMPONENT_ID);
                    this.#logger.debug(`Checking exits data (component ${EXITS_COMPONENT_ID}) for location: ${context.currentLocation?.id}`, exitsData);

                    if (Array.isArray(exitsData) && exitsData.length > 0) {
                        this.#logger.debug(`    - Found ${exitsData.length} potential exits from ${EXITS_COMPONENT_ID}. Checking validation...`);

                        for (const exit of exitsData) {
                            // Ensure the exit object and its direction property are valid
                            if (exit && typeof exit.direction === 'string' && exit.direction.trim() !== '') {
                                const direction = exit.direction;
                                this.#logger.debug(`    -> Processing exit direction: ${direction}`);
                                const targetContext = ActionTargetContext.forDirection(direction);

                                if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                                    this.#logger.debug(`      - isValid TRUE for ${direction}. Calling formatter.`);
                                    const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager, {});
                                    if (command !== null) {
                                        validActions.push({id: actionDef.id, command: command});
                                        this.#logger.debug(`    * Found valid action (direction: ${direction}): ${command} (ID: ${actionDef.id})`);
                                    } else {
                                        this.#logger.warn(`    * Action ${actionDef.id} validated for direction ${direction} but formatter returned null.`);
                                    }
                                } else {
                                    this.#logger.debug(`      - isValid FALSE for ${direction}.`);
                                }
                            } else {
                                this.#logger.warn(`    - Skipping invalid exit object in ${EXITS_COMPONENT_ID} data for location ${context.currentLocation?.id}:`, exit);
                            }
                        }
                    } else {
                        this.#logger.debug(`    - No ${EXITS_COMPONENT_ID} data found, or it's empty/invalid, on currentLocation ${context.currentLocation?.id}. No potential direction targets for action ${actionDef.id}.`);
                    }
                    // --- END MODIFICATION ---
                }
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
        return validActions;
    }
}

// --- FILE END ---