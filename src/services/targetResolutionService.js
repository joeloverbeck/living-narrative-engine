// src/services/targetResolutionService.js

import {ITargetResolutionService} from "../core/interfaces/ITargetResolutionService.js";
import {ResolutionStatus} from "../types/resolutionStatus.js";
import {
    EQUIPMENT_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    INVENTORY_COMPONENT_ID,
    NAME_COMPONENT_ID
} from "../types/components.js";

/** @typedef {import('../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../core/interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../core/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../core/interfaces/ILogger.js').ILogger} ILogger */

/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionContext.js').ActionContext} ActionContext */
/** @typedef {import('../types/targetResolutionResult.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../entities/entity.js').default} Entity */ // Assuming Entity class import for type hinting actorEntity

/**
 * @description Represents a candidate item for name matching.
 * @typedef {object} NameMatchCandidate
 * @property {string} id - The unique identifier of the candidate.
 * @property {string} name - The name of the candidate to match against.
 */


/**
 * @description Options for constructing a TargetResolutionService.
 * @typedef {object} TargetResolutionServiceOptions
 * @property {IEntityManager} entityManager - The entity manager instance.
 * @property {IWorldContext} worldContext - The world context instance.
 * @property {IGameDataRepository} gameDataRepository - The game data repository instance.
 * @property {ILogger} logger - The logger instance.
 */

/**
 * @description Service responsible for resolving the target of an action based on player input,
 * action definitions, and the current game state.
 * @implements {ITargetResolutionService}
 */
class TargetResolutionService extends ITargetResolutionService {
    /** @type {IEntityManager} */ #entityManager;
    /** @type {IWorldContext} */ #worldContext;
    /** @type {IGameDataRepository} */ #gameDataRepository;
    /** @type {ILogger} */ #logger;

    /**
     * @description Validates a dependency instance, checking for its existence and required methods.
     * Logs an error and throws if validation fails. This method is intended for internal use
     * during constructor setup.
     * @param {any} dependency - The dependency instance to validate.
     * @param {string} dependencyName - The name of the dependency (for logging and error messages).
     * @param {string[]} [requiredMethods=[]] - An array of method names that must exist on the dependency.
     * @private
     * @throws {Error} If the dependency is missing or does not have all required methods.
     */
    #_validateDependency(dependency, dependencyName, requiredMethods = []) {
        if (!dependency) {
            const errorMsg = `TargetResolutionService Constructor: Missing required dependency: ${dependencyName}.`;
            if (this.#logger && this.#logger !== dependency) { // Ensure logger is not the dependency being checked if it's null
                this.#logger.error(errorMsg);
            } else {
                console.error(errorMsg); // Fallback if logger itself is the missing dependency
            }
            throw new Error(errorMsg);
        }
        for (const method of requiredMethods) {
            if (typeof dependency[method] !== 'function') {
                const errorMsg = `TargetResolutionService Constructor: Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
                if (this.#logger && this.#logger !== dependency) {
                    this.#logger.error(errorMsg);
                } else {
                    console.error(errorMsg);
                }
                throw new Error(errorMsg);
            }
        }
    }

    /**
     * @description Constructor for TargetResolutionService. It injects and validates all required dependencies.
     * The logger is validated first so it can be used for reporting issues with other dependencies.
     * @param {TargetResolutionServiceOptions} options - Configuration object containing all necessary service dependencies.
     * @throws {Error} If the logger dependency is invalid or any other critical dependency is missing or malformed.
     */
    constructor(options) {
        super();
        const {
            entityManager,
            worldContext,
            gameDataRepository,
            logger
        } = options || {};

        // 1. Validate Logger separately and first
        if (!logger ||
            typeof logger.info !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function' ||
            typeof logger.warn !== 'function') {
            const errorMsg = 'TargetResolutionService Constructor: CRITICAL - Invalid or missing ILogger instance. Requires methods: info, error, debug, warn.';
            console.error(errorMsg); // Use console.error as a fallback
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        // 2. Validate other dependencies
        try {
            this.#_validateDependency(entityManager, 'entityManager', ['getEntityInstance', 'getEntitiesInLocation']);
            this.#_validateDependency(worldContext, 'worldContext', ['getLocationOfEntity', 'getCurrentActor', 'getCurrentLocation']);
            this.#_validateDependency(gameDataRepository, 'gameDataRepository', ['getActionDefinition', 'getAllActionDefinitions']);
        } catch (error) {
            // Error is already logged by #_validateDependency if logger was available
            // If logger was the failing dependency, it would have thrown before this point.
            // Re-throwing to ensure constructor failure is clear.
            throw error;
        }

        // 3. Assign validated dependencies
        this.#entityManager = entityManager;
        this.#worldContext = worldContext;
        this.#gameDataRepository = gameDataRepository;

        this.#logger.info("TargetResolutionService: Instance created and dependencies validated.");
    }

    /**
     * @description Retrieves the display name of an entity.
     * It first checks for a `core:name` component and uses `component.text`.
     * If not found, it falls back to `entity.name` (if it exists).
     * @private
     * @param {Entity} entity - The entity whose name is to be retrieved.
     * @returns {string | undefined} The display name of the entity or undefined if no name is found.
     */
    #_getEntityName(entity) {
        if (!entity) return undefined;

        const nameComponent = entity.getComponentData(NAME_COMPONENT_ID);
        if (nameComponent && typeof nameComponent.text === 'string' && nameComponent.text.trim() !== '') {
            return nameComponent.text;
        }
        // Fallback to entity.name if it exists and is a string, as per previous implementation.
        // However, it's better practice to rely on components for such data.
        // This fallback can be removed if all named entities are guaranteed to have core:name.
        if (typeof entity.name === 'string' && entity.name.trim() !== '') {
            this.#logger.debug(`TargetResolutionService.#_getEntityName: Entity '${entity.id}' using fallback entity.name property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`);
            return entity.name;
        }
        this.#logger.warn(`TargetResolutionService.#_getEntityName: Entity '${entity.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`);
        return undefined;
    }

    /**
     * Resolves the target for a given action based on the action definition and context.
     * @param {ActionDefinition} actionDefinition - The definition of the action being performed.
     * @param {ActionContext} actionContext - The context in which the action is being performed.
     * @returns {Promise<TargetResolutionResult>} A promise that resolves to the target resolution result.
     * The promise will not reject on expected failures (e.g., target not found, ambiguity)
     * but will instead resolve with a TargetResolutionResult indicating an ERROR status.
     * @async
     * @override
     */
    async resolveActionTarget(actionDefinition, actionContext) {
        this.#logger.debug(`TargetResolutionService.resolveActionTarget called for action: '${actionDefinition?.id}', actor: '${actionContext?.actingEntity?.id}', noun: "${actionContext?.nounPhrase}"`);

        // Guard clause: Missing actionDefinition or actionContext
        if (!actionDefinition || !actionContext) {
            this.#logger.error("TargetResolutionService.resolveActionTarget: Missing actionDefinition or actionContext.");
            return { //This is an object literal, not a Promise.resolve, which is fine for async functions
                status: ResolutionStatus.ERROR,
                targetType: 'none',
                targetId: null,
                error: "Internal error: Invalid action setup."
            };
        }

        const {
            target_domain
        } = actionDefinition;
        const {
            nounPhrase,
            actingEntity
        } = actionContext; // actingEntity can be null

        // Guard clause: Missing actingEntity for domains that require it
        if (target_domain === 'self' || target_domain === 'inventory' || target_domain === 'equipment' || target_domain === 'environment') {
            if (!actingEntity) {
                this.#logger.error(`TargetResolutionService.resolveActionTarget: Missing actingEntity for target_domain '${target_domain}' which requires an actor. Action: '${actionDefinition.id}'.`);
                return {
                    status: ResolutionStatus.ERROR,
                    targetType: 'none', // Or the specific domain if that's more informative
                    targetId: null,
                    error: `Internal error: Action '${actionDefinition.id}' requires an actor but none was provided for domain '${target_domain}'.`
                };
            }
        }

        try {
            let result;
            switch (target_domain) {
                case 'none':
                    result = this.#_resolveNone(); // Delegate method
                    break;
                case 'self':
                    // actingEntity is guaranteed to be non-null here due to the guard clause above
                    result = this.#_resolveSelf(actingEntity); // Delegate method
                    break;
                case 'inventory':
                    // actingEntity is guaranteed to be non-null
                    result = this.#_resolveInventoryDomain(actingEntity, nounPhrase); // Delegate method
                    break;
                case 'equipment':
                    // actingEntity is guaranteed to be non-null
                    result = this.#_resolveEquipment(actingEntity, nounPhrase); // Delegate method
                    break;
                case 'environment':
                    // actingEntity is guaranteed to be non-null
                    result = this.#_resolveEnvironment(actingEntity, nounPhrase); // Delegate method
                    break;
                case 'direction':
                    // `actingEntity` might be null for 'direction', handled by _resolveDirection if needed.
                    result = this.#_resolveDirection(nounPhrase, actingEntity); // Delegate method
                    break;
                default:
                    this.#logger.warn(`TargetResolutionService.resolveActionTarget: Unknown target domain '${target_domain}' for action '${actionDefinition.id}'.`);
                    result = {
                        status: ResolutionStatus.NOT_FOUND, // Or ERROR, NOT_FOUND seems more appropriate for an unknown domain
                        targetType: 'none',
                        targetId: null,
                        error: `Action '${actionDefinition.id}' has an unsupported target domain: ${target_domain}.`
                    };
                    break;
            }
            // The delegate methods are currently synchronous and return the result directly.
            // If they were async, we would `await` them: `result = await this.#_resolveNone();`
            // For now, direct assignment is fine. The outer function is async, so it will wrap this result in a Promise.
            return result;

        } catch (err) {
            this.#logger.error(`TargetResolutionService.resolveActionTarget: Unexpected error during target resolution for action '${actionDefinition.id}', domain '${target_domain}'. Error: ${err.message}`, err);
            return {
                status: ResolutionStatus.ERROR,
                targetType: 'none',
                targetId: null,
                error: `An unexpected internal error occurred while trying to resolve the target for action '${actionDefinition.id}'. Please contact support.` // Player-facing generic error
            };
        }
    }

    // --- Domain Resolver Helpers ---

    /**
     * @description Resolves 'none' target domain.
     * @private
     * @returns {TargetResolutionResult} Result indicating no target is applicable.
     */
    #_resolveNone() {
        this.#logger.debug("TargetResolutionService.#_resolveNone called");
        return {
            status: ResolutionStatus.NONE,
            targetType: 'none',
            targetId: null
        };
    }

    /**
     * @description Resolves 'self' target domain. The target is the actor itself.
     * Validates that actorEntity is not null.
     * @private
     * @param {Entity} actorEntity - The entity performing the action. (Guaranteed non-null by caller)
     * @returns {TargetResolutionResult} Result indicating the actor is the target, or an error if actor is missing/invalid.
     */
    #_resolveSelf(actorEntity) {
        this.#logger.debug(`TargetResolutionService.#_resolveSelf called with actorEntity: ${actorEntity?.id}`);

        // actorEntity itself is guaranteed non-null by the caller (resolveActionTarget)
        // We only need to check if it has a valid ID, though this should typically be true for a valid Entity.
        if (!actorEntity.id) {
            this.#logger.error("TargetResolutionService.#_resolveSelf: actorEntity is missing a valid .id property.");
            return {
                status: ResolutionStatus.ERROR,
                targetType: 'self',
                targetId: null,
                error: "Internal error: Actor not available or invalid for 'self' target."
            };
        }

        this.#logger.debug(`TargetResolutionService.#_resolveSelf resolved to actor: ${actorEntity.id}`);
        return {
            status: ResolutionStatus.SELF,
            targetType: 'self',
            targetId: actorEntity.id
        };
    }

    /**
     * @description Resolves targets within an actor's inventory based on a noun phrase.
     * @private
     * @param {Entity} actorEntity - The entity whose inventory is being searched. (Guaranteed non-null by caller)
     * @param {string} nounPhrase - The noun phrase to match against item names.
     * @returns {TargetResolutionResult} The result of the inventory matching attempt.
     */
    #_resolveInventoryDomain(actorEntity, nounPhrase) {
        this.#logger.debug(`TargetResolutionService.#_resolveInventoryDomain called for actor: '${actorEntity.id}', nounPhrase: "${nounPhrase}"`);

        const inventoryComponent = actorEntity.getComponentData(INVENTORY_COMPONENT_ID);

        if (!inventoryComponent) {
            this.#logger.warn(`TargetResolutionService.#_resolveInventoryDomain: Actor '${actorEntity.id}' is missing '${TargetResolutionService.INVENTORY_COMPONENT_ID}' component.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity', // Domain implies entity targets
                targetId: null,
                error: "You are not carrying anything."
            };
        }

        const itemIds = inventoryComponent.itemIds;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveInventoryDomain: Actor '${actorEntity.id}' inventory component has no itemIds or is empty.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity',
                targetId: null,
                error: "Your inventory is empty."
            };
        }

        const candidates = [];
        for (const itemId of itemIds) {
            if (typeof itemId !== 'string' || !itemId) {
                this.#logger.warn(`TargetResolutionService.#_resolveInventoryDomain: Invalid itemId found in inventory for actor '${actorEntity.id}': ${JSON.stringify(itemId)}`);
                continue;
            }
            const itemEntity = this.#entityManager.getEntityInstance(itemId);
            if (itemEntity) {
                const name = this.#_getEntityName(itemEntity);
                if (name) { // #_getEntityName returns string or undefined
                    candidates.push({
                        id: itemEntity.id,
                        name: name
                    });
                } else {
                    this.#logger.warn(`TargetResolutionService.#_resolveInventoryDomain: Item entity '${itemId}' in actor '${actorEntity.id}' inventory has no valid name. Skipping.`);
                }
            } else {
                this.#logger.warn(`TargetResolutionService.#_resolveInventoryDomain: Item entity '${itemId}' from actor '${actorEntity.id}' inventory not found via entityManager. Skipping.`);
            }
        }

        if (candidates.length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveInventoryDomain: No valid item candidates with names found in actor '${actorEntity.id}' inventory for matching.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity',
                targetId: null,
                error: "You don't have anything like that in your inventory."
            };
        }

        const matchResult = this.#_matchByName(candidates, nounPhrase);
        // Set targetType based on domain, overriding #_matchByName's default if necessary
        matchResult.targetType = (matchResult.status === ResolutionStatus.FOUND_UNIQUE || matchResult.status === ResolutionStatus.AMBIGUOUS) ? 'entity' : 'none';


        if (matchResult.status === ResolutionStatus.NONE) { // Status from _matchByName if no phrase or no match
            if (nounPhrase && nounPhrase.trim() !== "") { // If there was a noun, but it didn't match
                matchResult.error = `You don't have "${nounPhrase}" in your inventory.`;
            } else { // If nounPhrase was empty
                matchResult.error = matchResult.error || "You need to specify what item from your inventory.";
            }
        } else if (matchResult.status === ResolutionStatus.NOT_FOUND) { // if phrase was given, but no match of any kind.
            matchResult.error = `You don't have "${nounPhrase}" in your inventory.`;
        }
        return matchResult;
    }


    /**
     * @description Resolves targets within an actor's equipped items based on a noun phrase.
     * It checks the `slots` map of the `core:equipment` component.
     * @private
     * @param {Entity} actorEntity - The entity whose equipment is being searched. (Guaranteed non-null by caller)
     * @param {string} nounPhrase - The noun phrase to match against equipped item names.
     * @returns {TargetResolutionResult} The result of the equipment matching attempt.
     */
    #_resolveEquipment(actorEntity, nounPhrase) {
        this.#logger.debug(`TargetResolutionService.#_resolveEquipment called for actor: ${actorEntity.id}, noun: "${nounPhrase}"`);

        const equipmentComponent = actorEntity.getComponentData(EQUIPMENT_COMPONENT_ID);

        if (!equipmentComponent) {
            this.#logger.warn(`TargetResolutionService.#_resolveEquipment: Actor '${actorEntity.id}' is missing '${EQUIPMENT_COMPONENT_ID}' component.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity', // Domain implies entity targets
                targetId: null,
                error: "You are not wearing or wielding anything."
            };
        }

        const slots = equipmentComponent.slots;

        if (!slots || typeof slots !== 'object' || Object.keys(slots).length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveEquipment: Actor '${actorEntity.id}' equipment component has no slots or slots map is empty.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity',
                targetId: null,
                error: "You have nothing equipped."
            };
        }

        const candidates = [];
        for (const slotName in slots) {
            // eslint-disable-next-line no-prototype-builtins
            if (slots.hasOwnProperty(slotName)) {
                const itemId = slots[slotName];
                if (typeof itemId !== 'string' || !itemId) {
                    this.#logger.warn(`TargetResolutionService.#_resolveEquipment: Invalid itemId found in slot '${slotName}' for actor '${actorEntity.id}': ${JSON.stringify(itemId)}`);
                    continue;
                }

                const itemEntity = this.#entityManager.getEntityInstance(itemId);
                if (itemEntity) {
                    const name = this.#_getEntityName(itemEntity);
                    if (name) {
                        candidates.push({
                            id: itemEntity.id,
                            name: name
                        });
                    } else {
                        this.#logger.warn(`TargetResolutionService.#_resolveEquipment: Equipped item entity '${itemId}' in slot '${slotName}' for actor '${actorEntity.id}' has no valid name. Skipping.`);
                    }
                } else {
                    this.#logger.warn(`TargetResolutionService.#_resolveEquipment: Equipped item entity '${itemId}' from slot '${slotName}' for actor '${actorEntity.id}' not found via entityManager. Skipping.`);
                }
            }
        }

        if (candidates.length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveEquipment: No valid equipped item candidates with names found for actor '${actorEntity.id}' for matching.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity',
                targetId: null,
                error: "You don't have anything like that equipped."
            };
        }

        const matchResult = this.#_matchByName(candidates, nounPhrase);
        matchResult.targetType = (matchResult.status === ResolutionStatus.FOUND_UNIQUE || matchResult.status === ResolutionStatus.AMBIGUOUS) ? 'entity' : 'none';


        if (matchResult.status === ResolutionStatus.NONE) {
            if (nounPhrase && nounPhrase.trim() !== "") {
                matchResult.error = `You don't have "${nounPhrase}" equipped.`;
            } else {
                matchResult.error = matchResult.error || "You need to specify which equipped item.";
            }
        } else if (matchResult.status === ResolutionStatus.NOT_FOUND) {
            matchResult.error = `You don't have "${nounPhrase}" equipped.`;
        }
        return matchResult;
    }

    /**
     * @description Resolves 'environment' target domain.
     * @private
     * @param {Entity} actorEntity - The acting entity. (Guaranteed non-null by caller)
     * @param {string} [nounPhrase] - The noun phrase to match.
     * @returns {TargetResolutionResult} The result of the environment matching attempt.
     */
    #_resolveEnvironment(actorEntity, nounPhrase) {
        this.#logger.debug(`TargetResolutionService.#_resolveEnvironment called for actor: ${actorEntity.id}, noun: "${nounPhrase}"`);

        const actorLocationEntity = this.#worldContext.getLocationOfEntity(actorEntity.id);

        if (!actorLocationEntity || !actorLocationEntity.id) {
            this.#logger.warn(`TargetResolutionService.#_resolveEnvironment: Actor '${actorEntity.id}' has no valid location according to worldContext.`);
            return {
                status: ResolutionStatus.ERROR,
                targetType: 'none', // Or 'entity' if it's contextually better
                targetId: null,
                error: "Internal error: Cannot determine your current location."
            };
        }
        this.#logger.debug(`TargetResolutionService.#_resolveEnvironment: Actor '${actorEntity.id}' is in location '${actorLocationEntity.id}'.`);

        const entityIdsInLocation = this.#entityManager.getEntitiesInLocation(actorLocationEntity.id);
        if (!entityIdsInLocation || entityIdsInLocation.size === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveEnvironment: No entities found in location '${actorLocationEntity.id}' via entityManager (this is unusual if actor is present).`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity',
                targetId: null,
                error: nounPhrase && nounPhrase.trim() !== "" ? `You don't see any "${nounPhrase}" here.` : "There is nothing here."
            };
        }

        const candidates = [];
        for (const entityId of entityIdsInLocation) {
            if (entityId === actorEntity.id) {
                this.#logger.debug(`TargetResolutionService.#_resolveEnvironment: Skipping actor entity '${entityId}' from candidates.`);
                continue;
            }

            const entityInstance = this.#entityManager.getEntityInstance(entityId);
            if (entityInstance) {
                const name = this.#_getEntityName(entityInstance);
                if (name) {
                    candidates.push({
                        id: entityInstance.id,
                        name: name
                    });
                } else {
                    this.#logger.warn(`TargetResolutionService.#_resolveEnvironment: Entity '${entityId}' in location '${actorLocationEntity.id}' has no valid name. Skipping.`);
                }
            } else {
                this.#logger.warn(`TargetResolutionService.#_resolveEnvironment: Entity '${entityId}' (from location '${actorLocationEntity.id}') not found via entityManager. Skipping.`);
            }
        }

        if (candidates.length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveEnvironment: No valid targetable candidates (excluding actor, with names) found in location '${actorLocationEntity.id}'.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'entity',
                targetId: null,
                error: nounPhrase && nounPhrase.trim() !== "" ? `You don't see any "${nounPhrase}" here.` : "There is nothing else of interest here."
            };
        }

        this.#logger.debug(`TargetResolutionService.#_resolveEnvironment: Found ${candidates.length} candidates in location '${actorLocationEntity.id}' for matching against "${nounPhrase}".`);
        const matchResult = this.#_matchByName(candidates, nounPhrase);
        matchResult.targetType = (matchResult.status === ResolutionStatus.FOUND_UNIQUE || matchResult.status === ResolutionStatus.AMBIGUOUS) ? 'entity' : 'none';


        if (matchResult.status === ResolutionStatus.NONE) { // From _matchByName (empty noun)
            if (nounPhrase && nounPhrase.trim() !== "") { // Should not happen if NONE due to empty noun
                matchResult.error = `You don't see "${nounPhrase}" here.`;
            } else {
                matchResult.error = matchResult.error || "What in your surroundings are you trying to target?";
            }
        } else if (matchResult.status === ResolutionStatus.NOT_FOUND) { // From _matchByName (noun given, no match)
            matchResult.error = `You don't see "${nounPhrase}" here.`;
        }
        return matchResult;
    }

    /**
     * @description Resolves 'direction' target domain based on exits in the current location.
     * @private
     * @param {string} [nounPhrase] - The phrase indicating direction (e.g., "north", "up").
     * @param {Entity | null | undefined} [actorEntity] - The acting entity. Used by `worldContext.getCurrentLocation()` if it requires an actor context, or can be null.
     * @returns {TargetResolutionResult} The result of the direction matching attempt.
     */
    #_resolveDirection(nounPhrase, actorEntity) {
        this.#logger.debug(`TargetResolutionService.#_resolveDirection called with noun: "${nounPhrase}", actorId: ${actorEntity?.id}`);

        const currentLocationEntity = this.#worldContext.getCurrentLocation(actorEntity); // actorEntity can be null

        if (!currentLocationEntity || !currentLocationEntity.id) {
            this.#logger.warn("TargetResolutionService.#_resolveDirection: Could not determine current location via worldContext.");
            return {
                status: ResolutionStatus.ERROR,
                targetType: 'direction',
                targetId: null,
                error: "Internal error: Your location is unknown."
            };
        }
        this.#logger.debug(`TargetResolutionService.#_resolveDirection: Current location is '${currentLocationEntity.id}'.`);

        const exitsComponentData = currentLocationEntity.getComponentData(EXITS_COMPONENT_ID);

        if (!Array.isArray(exitsComponentData) || exitsComponentData.length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveDirection: Location '${currentLocationEntity.id}' has no '${EXITS_COMPONENT_ID}' component, it's not an array, or it's empty.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'direction',
                targetId: null,
                error: "There are no obvious exits from here."
            };
        }

        const validExits = [];
        for (const exit of exitsComponentData) {
            if (exit && typeof exit === 'object' && typeof exit.direction === 'string' && exit.direction.trim() !== "") {
                validExits.push({
                    id: exit.direction,
                    name: exit.direction
                }); // Name and ID are the direction string
            } else {
                this.#logger.warn(`TargetResolutionService.#_resolveDirection: Location '${currentLocationEntity.id}' has an invalid exit object or missing/empty direction string: ${JSON.stringify(exit)}.`);
            }
        }

        if (validExits.length === 0) {
            this.#logger.debug(`TargetResolutionService.#_resolveDirection: Location '${currentLocationEntity.id}' has an exits component, but no valid direction strings found within its data.`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'direction',
                targetId: null,
                error: "There are no clearly marked exits here."
            };
        }

        if (!nounPhrase || typeof nounPhrase !== 'string' || nounPhrase.trim() === "") {
            this.#logger.debug("TargetResolutionService.#_resolveDirection: No nounPhrase (direction) provided.");
            return {
                status: ResolutionStatus.NONE,
                targetType: 'direction',
                targetId: null,
                error: "Which direction do you want to go?"
            };
        }

        const normalizedNounPhrase = nounPhrase.toLowerCase().trim();
        const matchedDirections = [];

        for (const exitCandidate of validExits) {
            if (exitCandidate.name.toLowerCase() === normalizedNounPhrase) {
                matchedDirections.push(exitCandidate.name); // Store original casing
            }
        }

        if (matchedDirections.length === 1) {
            this.#logger.debug(`TargetResolutionService.#_resolveDirection: Found unique direction: '${matchedDirections[0]}'`);
            return {
                status: ResolutionStatus.FOUND_UNIQUE,
                targetType: 'direction',
                targetId: matchedDirections[0]
            };
        } else if (matchedDirections.length > 1) {
            this.#logger.warn(`TargetResolutionService.#_resolveDirection: Ambiguous direction due to duplicate exit definitions for '${normalizedNounPhrase}'. Matched: ${matchedDirections.join(', ')}.`);
            return {
                status: ResolutionStatus.AMBIGUOUS,
                targetType: 'direction',
                targetId: null,
                candidates: matchedDirections,
                error: `The direction "${nounPhrase}" is ambiguously defined here.`
            };
        } else { // matchedDirections.length === 0
            this.#logger.debug(`TargetResolutionService.#_resolveDirection: No exit matches direction '${nounPhrase}'. Valid exits were: ${validExits.map(e => e.name).join(', ')}`);
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'direction',
                targetId: null,
                error: `You can't go "${nounPhrase}".`
            };
        }
    }

    // --- Candidate List & Matching Helpers ---

    /**
     * @description Matches a target by name from a list of candidates using a three-tier logic.
     * @private
     * @param {NameMatchCandidate[]} candidates - Array of candidates {id, name}.
     * @param {string} phrase - The noun phrase to match.
     * @returns {TargetResolutionResult} Result of the matching.
     */
    #_matchByName(candidates, phrase) {
        this.#logger.debug(`TargetResolutionService.#_matchByName called with phrase: "${phrase}", ${candidates?.length || 0} candidates.`);

        // Default targetType if a match is found; specific resolvers might override this.
        const resultTargetTypeIfFound = 'entity';

        if (!phrase || typeof phrase !== 'string' || phrase.trim() === "") {
            this.#logger.debug("TargetResolutionService.#_matchByName: Invalid or empty phrase provided.");
            return {
                status: ResolutionStatus.NONE,
                targetType: 'none', // No specific type if no phrase
                targetId: null,
                error: "No target name specified." // Generic, domain resolver should provide a better message
            };
        }

        if (!Array.isArray(candidates) || candidates.length === 0) {
            this.#logger.debug("TargetResolutionService.#_matchByName: No candidates provided.");
            return {
                status: ResolutionStatus.NOT_FOUND, // Phrase given, but nothing to match against
                targetType: 'none', // Or resultTargetTypeIfFound depending on desired strictness for "not found in empty list"
                targetId: null,
                error: `Nothing found to match "${phrase}".` // Generic, domain resolver should override
            };
        }

        const normalizedPhrase = phrase.toLowerCase().trim();
        const exactMatches = [];
        const startsWithMatches = [];
        const substringMatches = [];

        for (const candidate of candidates) {
            if (!candidate || typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || candidate.name.trim() === "") {
                this.#logger.warn(`TargetResolutionService.#_matchByName: Skipping invalid candidate: ${JSON.stringify(candidate)}`);
                continue;
            }
            const normalizedCandidateName = candidate.name.toLowerCase();

            if (normalizedCandidateName === normalizedPhrase) {
                exactMatches.push(candidate);
            } else if (normalizedCandidateName.startsWith(normalizedPhrase)) {
                startsWithMatches.push(candidate);
            } else if (normalizedCandidateName.includes(normalizedPhrase)) {
                substringMatches.push(candidate);
            }
        }

        this.#logger.debug(`TargetResolutionService.#_matchByName - Phrase: "${normalizedPhrase}" - Exact: ${exactMatches.length}, StartsWith: ${startsWithMatches.length}, Substring: ${substringMatches.length}`);

        let finalStatus = ResolutionStatus.NOT_FOUND;
        let finalTargetId = null;
        let finalCandidates = null;
        let finalError = `You don't see "${phrase}" here.`; // Default if no match by end of logic
        let finalTargetType = 'none'; // Default if no match

        if (exactMatches.length === 1) {
            finalStatus = ResolutionStatus.FOUND_UNIQUE;
            finalTargetId = exactMatches[0].id;
            finalTargetType = resultTargetTypeIfFound;
            finalError = undefined;
            this.#logger.debug(`TargetResolutionService.#_matchByName: Unique exact match: ${finalTargetId} ("${exactMatches[0].name}")`);
        } else if (exactMatches.length > 1) {
            finalStatus = ResolutionStatus.AMBIGUOUS;
            finalCandidates = exactMatches.map(c => c.id);
            finalTargetType = resultTargetTypeIfFound;
            const ambiguousNames = exactMatches.map(c => `"${c.name}"`).slice(0, 3).join(', ');
            finalError = `Which "${phrase}" did you mean? For example: ${ambiguousNames}${exactMatches.length > 3 ? ' or others...' : ''}.`;
            this.#logger.debug(`TargetResolutionService.#_matchByName: Ambiguous exact matches: ${finalCandidates.join(', ')}`);
        } else if (startsWithMatches.length === 1) {
            finalStatus = ResolutionStatus.FOUND_UNIQUE;
            finalTargetId = startsWithMatches[0].id;
            finalTargetType = resultTargetTypeIfFound;
            finalError = undefined;
            this.#logger.debug(`TargetResolutionService.#_matchByName: Unique startsWith match: ${finalTargetId} ("${startsWithMatches[0].name}")`);
        } else if (startsWithMatches.length > 1) {
            finalStatus = ResolutionStatus.AMBIGUOUS;
            finalCandidates = startsWithMatches.map(c => c.id);
            finalTargetType = resultTargetTypeIfFound;
            const ambiguousNames = startsWithMatches.map(c => `"${c.name}"`).slice(0, 3).join(', ');
            finalError = `Which item starting with "${phrase}" did you mean? For example: ${ambiguousNames}${startsWithMatches.length > 3 ? ' or others...' : ''}.`;
            this.#logger.debug(`TargetResolutionService.#_matchByName: Ambiguous startsWith matches: ${finalCandidates.join(', ')}`);
        } else if (substringMatches.length === 1) {
            finalStatus = ResolutionStatus.FOUND_UNIQUE;
            finalTargetId = substringMatches[0].id;
            finalTargetType = resultTargetTypeIfFound;
            finalError = undefined;
            this.#logger.debug(`TargetResolutionService.#_matchByName: Unique substring match: ${finalTargetId} ("${substringMatches[0].name}")`);
        } else if (substringMatches.length > 1) {
            finalStatus = ResolutionStatus.AMBIGUOUS;
            finalCandidates = substringMatches.map(c => c.id);
            finalTargetType = resultTargetTypeIfFound;
            const ambiguousNames = substringMatches.map(c => `"${c.name}"`).slice(0, 3).join(', ');
            finalError = `Which item containing "${phrase}" did you mean? For example: ${ambiguousNames}${substringMatches.length > 3 ? ' or others...' : ''}.`;
            this.#logger.debug(`TargetResolutionService.#_matchByName: Ambiguous substring matches: ${finalCandidates.join(', ')}`);
        }
        // If still NOT_FOUND, the initial finalError and finalTargetType will be used.

        const result = {
            status: finalStatus,
            targetId: finalTargetId,
            targetType: finalTargetType // This will be 'none' if no match, or 'entity' (or other type set by caller) if matched.
        };
        if (finalError) { // Only add error if it's defined (i.e., not FOUND_UNIQUE)
            result.error = finalError;
        }
        if (finalCandidates) { // Only add candidates if ambiguous
            result.candidates = finalCandidates;
        }
        return result;
    }
}

export {
    TargetResolutionService
};