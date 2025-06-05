// src/systems/actionDiscoveryService.js
// --- FILE START ---

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('./validation/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('./validation/actionValidationService.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../entities/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */
/** @typedef {import('./actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').TargetDomain} TargetDomain */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */ // Assuming ConsoleLogger implementation

// --- Dependency Imports ---
import {ActionTargetContext} from '../models/actionTargetContext.js';
import {IActionDiscoveryService} from '../interfaces/IActionDiscoveryService.js';
import {validateDependency} from '../utils/validationUtils.js';
import {getAvailableExits} from '../utils/locationUtils.js';

/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action definition (e.g., "core:wait").
 * @property {string} name - The human-readable name of the action (e.g., "Wait").
 * @property {string} command - The formatted command string ready for display/parsing (e.g., "wait", "go north").
 * @property {string} [description] - Optional. A detailed description of the action.
 */

/**
 * System responsible for discovering all valid actions an actor can take
 * based on the current game state and loaded action definitions.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
    #gameDataRepository;
    #entityManager;
    #actionValidationService;
    #getEntityIdsForScopesFn;
    #formatActionCommandFn;
    #logger;

    /**
     * Creates an instance of ActionDiscoverySystem.
     *
     * @param {object} dependencies - The required dependencies injected by the container.
     * @param {GameDataRepository} dependencies.gameDataRepository - Repository for retrieving action definitions.
     * @param {EntityManager} dependencies.entityManager - Provides entity component access.
     * @param {ActionValidationService} dependencies.actionValidationService - Service to validate actions.
     * @param {ILogger} dependencies.logger - Logger instance used for diagnostic output.
     * @param {formatActionCommandFn} dependencies.formatActionCommandFn - Formats an action into a command string.
     * @param {getEntityIdsForScopesFn} dependencies.getEntityIdsForScopesFn - Returns entity IDs for a given scope list.
     */
    constructor({
                    gameDataRepository,
                    entityManager,
                    actionValidationService,
                    logger,
                    formatActionCommandFn,
                    getEntityIdsForScopesFn,
                }) {
        super();

        // 1. Validate logger dependency first
        try {
            validateDependency(logger, 'ActionDiscoverySystem: logger', console, {
                requiredMethods: ['info', 'debug', 'warn', 'error'],
            });
            this.#logger = logger;
        } catch (e) {
            const errorMsg = `ActionDiscoverySystem Constructor: CRITICAL - Invalid or missing ILogger instance. Error: ${e.message}`;
            // eslint-disable-next-line no-console
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // 2. Validate other dependencies using the validated logger
        try {
            validateDependency(
                gameDataRepository,
                'ActionDiscoverySystem: gameDataRepository',
                this.#logger,
                {
                    requiredMethods: ['getAllActionDefinitions'],
                }
            );
            validateDependency(
                entityManager,
                'ActionDiscoverySystem: entityManager',
                this.#logger,
                {
                    requiredMethods: ['getComponentData', 'getEntityInstance'],
                }
            );
            validateDependency(
                actionValidationService,
                'ActionDiscoverySystem: actionValidationService',
                this.#logger,
                {
                    requiredMethods: ['isValid'],
                }
            );
            validateDependency(
                formatActionCommandFn,
                'ActionDiscoverySystem: formatActionCommandFn',
                this.#logger,
                {
                    isFunction: true,
                }
            );
            validateDependency(
                getEntityIdsForScopesFn,
                'ActionDiscoverySystem: getEntityIdsForScopesFn',
                this.#logger,
                {
                    isFunction: true,
                }
            );
        } catch (e) {
            this.#logger.error(
                `ActionDiscoverySystem Constructor: Dependency validation failed. Error: ${e.message}`
            );
            throw e;
        }

        this.#gameDataRepository = gameDataRepository;
        this.#entityManager = entityManager;
        this.#actionValidationService = actionValidationService;
        // this.#logger is already set
        this.#formatActionCommandFn = formatActionCommandFn;
        this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn;

        this.#logger.info('ActionDiscoverySystem initialized.');
    }

    /**
     * Discovers all valid actions available to the actor, including their IDs, names, descriptions, and formatted command strings.
     *
     * @param {Entity} actorEntity - The entity for whom to discover actions.
     * @param {ActionContext} context - The broader ActionContext including currentLocation etc.
     * @returns {Promise<DiscoveredActionInfo[]>} A promise resolving to an array of objects, each containing the action ID, name, description and formatted command string.
     */
    async getValidActions(actorEntity, context) {
        this.#logger.debug(
            `Starting action discovery for actor: ${actorEntity.id}`
        );
        const allActionDefinitions =
            this.#gameDataRepository.getAllActionDefinitions();
        /** @type {DiscoveredActionInfo[]} */
        const validActions = [];

        for (const actionDef of allActionDefinitions) {
            this.#logger.debug(
                ` -> Processing action definition: ${actionDef.id} (Name: ${actionDef.name || 'N/A'})`
            );

            const initialActorContext = ActionTargetContext.noTarget();
            if (
                !this.#actionValidationService.isValid(
                    actionDef,
                    actorEntity,
                    initialActorContext
                )
            ) {
                this.#logger.debug(
                    `    - Action ${actionDef.id} skipped: Invalid for actor based on initial check.`
                );
                continue;
            }

            const domain = actionDef.target_domain;
            this.#logger.debug(
                ` -> Passed initial actor check for ${actionDef.id}. Proceeding with target domain: ${domain}`
            );

            try {
                if (domain === 'none' || domain === 'self') {
                    const targetContext =
                        domain === 'self'
                            ? ActionTargetContext.forEntity(actorEntity.id)
                            : ActionTargetContext.noTarget();

                    if (
                        this.#actionValidationService.isValid(
                            actionDef,
                            actorEntity,
                            targetContext
                        )
                    ) {
                        const command = this.#formatActionCommandFn(
                            actionDef,
                            targetContext,
                            this.#entityManager,
                            {logger: this.#logger, debug: true}
                        );
                        if (command !== null) {
                            validActions.push({
                                id: actionDef.id,
                                name: actionDef.name || actionDef.commandVerb, // Use name, fallback to commandVerb
                                command: command,
                                description: actionDef.description || '', // Provide empty string if undefined
                            });
                            this.#logger.debug(
                                `    * Found valid action (no target/self): '${actionDef.name || command}' (ID: ${actionDef.id})`
                            );
                        } else {
                            this.#logger.warn(
                                `    * Action ${actionDef.id} validated but formatter returned null.`
                            );
                        }
                    } else {
                        this.#logger.debug(
                            `    - Action ${actionDef.id} failed the final context-specific validation for '${domain}' domain.`
                        );
                    }
                } else if (domain === 'direction') {
                    const availableExits = getAvailableExits(
                        context.currentLocation,
                        this.#entityManager,
                        this.#logger
                    );

                    this.#logger.debug(
                        `Found ${availableExits.length} available exits for location: ${context.currentLocation?.id} via getAvailableExits.`
                    );

                    if (availableExits.length > 0) {
                        for (const exit of availableExits) {
                            const direction = exit.direction;
                            this.#logger.debug(
                                `    -> Processing available exit direction: ${direction}`
                            );
                            const targetContext = ActionTargetContext.forDirection(direction);

                            if (
                                this.#actionValidationService.isValid(
                                    actionDef,
                                    actorEntity,
                                    targetContext
                                )
                            ) {
                                this.#logger.debug(
                                    `      - isValid TRUE for direction ${direction}. Calling formatter.`
                                );
                                const command = this.#formatActionCommandFn(
                                    actionDef,
                                    targetContext,
                                    this.#entityManager,
                                    {logger: this.#logger, debug: true}
                                );
                                if (command !== null) {
                                    validActions.push({
                                        id: actionDef.id,
                                        name: actionDef.name || actionDef.commandVerb,
                                        command: command,
                                        description: actionDef.description || '',
                                    });
                                    this.#logger.debug(
                                        `    * Found valid action (direction: ${direction}): '${actionDef.name || command}' (ID: ${actionDef.id})`
                                    );
                                } else {
                                    this.#logger.warn(
                                        `    * Action ${actionDef.id} validated for direction ${direction} but formatter returned null.`
                                    );
                                }
                            } else {
                                this.#logger.debug(
                                    `      - isValid FALSE for direction ${direction}.`
                                );
                            }
                        }
                    } else {
                        this.#logger.debug(
                            `    - No available exits found on currentLocation ${context.currentLocation?.id} via getAvailableExits for action ${actionDef.id}.`
                        );
                    }
                } else {
                    // Entity Scopes (inventory, environment, etc.)
                    const potentialTargetIds = this.#getEntityIdsForScopesFn(
                        [domain],
                        context
                    );
                    if (potentialTargetIds.size === 0) {
                        this.#logger.debug(
                            `    - No potential targets found in domain '${domain}' for action ${actionDef.id}.`
                        );
                        continue;
                    }

                    this.#logger.debug(
                        `    - Found ${potentialTargetIds.size} potential targets in domain '${domain}'. Checking validation...`
                    );

                    for (const targetId of potentialTargetIds) {
                        const targetEntity =
                            this.#entityManager.getEntityInstance(targetId);
                        if (!targetEntity) {
                            this.#logger.warn(
                                `    - Could not get entity instance for potential target ID ${targetId} from domain ${domain}. Skipping validation.`
                            );
                            continue;
                        }

                        const targetContext = ActionTargetContext.forEntity(targetId);
                        if (
                            this.#actionValidationService.isValid(
                                actionDef,
                                actorEntity,
                                targetContext
                            )
                        ) {
                            const command = this.#formatActionCommandFn(
                                actionDef,
                                targetContext,
                                this.#entityManager,
                                {logger: this.#logger, debug: true}
                            );
                            if (command !== null) {
                                validActions.push({
                                    id: actionDef.id,
                                    name: actionDef.name || actionDef.commandVerb, // Use name, fallback to commandVerb
                                    command: command,
                                    description: actionDef.description || '', // Provide empty string if undefined
                                });
                                this.#logger.debug(
                                    `    * Found valid action (target ${targetId}): '${actionDef.name || command}' (ID: ${actionDef.id})`
                                );
                            } else {
                                this.#logger.warn(
                                    `    * Action ${actionDef.id} validated for target ${targetId} but formatter returned null.`
                                );
                            }
                        } else {
                            this.#logger.debug(
                                `    - Action ${actionDef.id} invalid for target: ${targetId}.`
                            );
                        }
                    }
                }
            } catch (error) {
                this.#logger.error(
                    `Error processing action definition ${actionDef.id} for actor ${actorEntity.id}:`,
                    error
                );
            }
        }

        this.#logger.debug(
            `Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} valid commands/actions.`
        );
        return validActions;
    }
}

// --- FILE END ---
