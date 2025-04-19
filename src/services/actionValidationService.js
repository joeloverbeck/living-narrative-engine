// src/services/actionValidationService.js

/**
 * @typedef {'entity' | 'direction' | 'none'} ActionTargetType
 */

/**
 * Represents the context of an action's target.
 * Provides a unified way to handle different target types (or lack thereof).
 */
export class ActionTargetContext {
    /** @type {ActionTargetType} */
    type;
    /** @type {string | null} */
    entityId; // ID of the target entity, if type is 'entity'
    /** @type {string | null} */
    direction; // Direction string (e.g., 'north'), if type is 'direction'

    /**
     * @param {ActionTargetType} type - The type of the target.
     * @param {object} [options={}] - Additional options based on type.
     * @param {string} [options.entityId] - Required if type is 'entity'.
     * @param {string} [options.direction] - Required if type is 'direction'.
     */
    constructor(type, {entityId = null, direction = null} = {}) {
        this.type = type;
        this.entityId = entityId;
        this.direction = direction;

        if (type === 'entity' && !entityId) {
            throw new Error("ActionTargetContext: entityId is required for type 'entity'.");
        }
        if (type === 'direction' && !direction) {
            throw new Error("ActionTargetContext: direction is required for type 'direction'.");
        }
    }

    /** Static factory for creating a context with no target. */
    static noTarget() {
        return new ActionTargetContext('none');
    }

    /** Static factory for creating a context targeting an entity. */
    static forEntity(entityId) {
        return new ActionTargetContext('entity', {entityId});
    }

    /** Static factory for creating a context targeting a direction. */
    static forDirection(direction) {
        return new ActionTargetContext('direction', {direction});
    }
}


// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').ConditionObject} ConditionObject */ // Import ConditionObject type
/** @typedef {import('../types/common.js').NamespacedId} NamespacedId */
/** @typedef {import('./actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */ // Placeholder

/**
 * Service responsible for validating if a specific action is currently valid
 * for a given actor and target context, based on the game state.
 */
export class ActionValidationService {
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ActionValidationService.
     * @param {object} dependencies - The required dependencies.
     * @param {EntityManager} dependencies.entityManager - Service to access entity instances and components.
     * @param {GameDataRepository} dependencies.gameDataRepository - Service to access game data definitions.
     * @param {ILogger} dependencies.logger - Logger service.
     */
    constructor({entityManager, gameDataRepository, logger}) {
        if (!entityManager || !gameDataRepository || !logger) {
            throw new Error("ActionValidationService requires EntityManager, GameDataRepository, and ILogger instances.");
        }
        this.#entityManager = entityManager;
        this.#gameDataRepository = gameDataRepository;
        this.#logger = logger;
        this.#logger.info("ActionValidationService initialized.");
    }

    /**
     * Checks component requirements for a given entity (actor or target).
     * @private
     */
    _checkEntityComponentRequirements(entity, requiredComponentIds, forbiddenComponentIds, actionDefinitionId, entityRole) {
        const entityId = entity.id;
        const roleCapitalized = entityRole.charAt(0).toUpperCase() + entityRole.slice(1);

        requiredComponentIds = requiredComponentIds || [];
        forbiddenComponentIds = forbiddenComponentIds || [];

        for (const componentId of requiredComponentIds) {
            const ComponentClass = this.#entityManager.componentRegistry.get(componentId);
            if (!ComponentClass) {
                this.#logger.error(`Action Validation Failed: ${roleCapitalized} component ID '${componentId}' required by action '${actionDefinitionId}' not found in componentRegistry.`);
                return false;
            }
            if (!entity.hasComponent(ComponentClass)) {
                this.#logger.debug(`Action Validation Failed: ${roleCapitalized} ${entityId} is missing required component '${componentId}' for action '${actionDefinitionId}'.`);
                return false;
            }
        }

        for (const componentId of forbiddenComponentIds) {
            const ComponentClass = this.#entityManager.componentRegistry.get(componentId);
            if (!ComponentClass) {
                this.#logger.error(`Action Validation Failed: ${roleCapitalized} component ID '${componentId}' forbidden by action '${actionDefinitionId}' not found in componentRegistry.`);
                return false;
            }
            if (entity.hasComponent(ComponentClass)) {
                this.#logger.debug(`Action Validation Failed: ${roleCapitalized} ${entityId} has forbidden component '${componentId}' for action '${actionDefinitionId}'.`);
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluates a single prerequisite condition.
     * Placeholder implementation for Ticket 2.3.
     * @private
     * @param {ConditionObject} prerequisite - The prerequisite definition.
     * @param {ActionDefinition} actionDefinition - The overall action definition (for context/logging).
     * @param {Entity} actorEntity - The acting entity.
     * @param {ActionTargetContext} targetContext - The target context.
     * @param {Entity | null} targetEntity - The resolved target entity (null if context is not 'entity' or entity not found).
     * @returns {boolean} True if the prerequisite passes (or is placeholder), false otherwise.
     */
    _checkSinglePrerequisite(prerequisite, actionDefinition, actorEntity, targetContext, targetEntity) {
        const actionId = actionDefinition.id;
        const conditionType = prerequisite.condition_type || 'unknown';
        const negate = prerequisite.negate || false;

        // --- Log the check ---
        // Attempt to provide more context in the log if available
        const details = JSON.stringify(prerequisite.details || {
            ...prerequisite,
            condition_type: undefined,
            negate: undefined,
            failure_message: undefined
        });
        this.#logger.debug(`Checking prerequisite: type='${conditionType}', details=${details} for action '${actionId}'`);

        let conditionResult = false; // Default to false before evaluation

        // --- Extensible Dispatch Structure ---
        switch (conditionType) {
            // --- Future Prerequisite Handlers ---
            // case 'actor_has_component':
            //     conditionResult = this._handleActorHasComponent(prerequisite, actorEntity);
            //     break;
            // case 'target_has_component':
            //     conditionResult = this._handleTargetHasComponent(prerequisite, targetEntity);
            //     break;
            // case 'actor_stat_check':
            //     conditionResult = this._handleActorStatCheck(prerequisite, actorEntity);
            //     break;
            // ... add cases for other specific condition types ...

            // --- Placeholder Logic ---
            case 'placeholder':
            case 'placeholder_fail': // Specific type for testing failure
            default: // Treat any unrecognized type as a placeholder for now
                this.#logger.debug(`  -> Prerequisite type '${conditionType}' handled by placeholder logic.`);
                // Default success, unless specifically marked to fail for testing
                conditionResult = !(prerequisite.force_fail === true || conditionType === 'placeholder_fail');
                if (!conditionResult) {
                    this.#logger.debug(`  -> Placeholder prerequisite FORCED FAIL for action '${actionId}'.`);
                } else {
                    this.#logger.debug(`  -> Placeholder prerequisite PASSED for action '${actionId}'.`);
                }
                break;
        }

        // Apply negation if specified
        const finalResult = negate ? !conditionResult : conditionResult;

        // Log failure reason if provided and applicable
        if (!finalResult && prerequisite.failure_message) {
            this.#logger.debug(`Action Validation Failed: Prerequisite failed for action '${actionId}'. Reason: ${prerequisite.failure_message}`);
        } else if (!finalResult) {
            this.#logger.debug(`Action Validation Failed: Prerequisite type '${conditionType}' failed for action '${actionId}'.`);
        }

        return finalResult;
    }

    /**
     * Checks if a given action is valid for the actor in the current game state.
     */
    isValid(actionDefinition, actorEntity, targetContext) {
        if (!actionDefinition || !actorEntity || !targetContext) {
            this.#logger.error("ActionValidationService.isValid: Missing required parameters (actionDefinition, actorEntity, targetContext).");
            throw new Error("ActionValidationService.isValid: Missing required parameters.");
        }

        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;
        let targetEntity = null; // To store the resolved target entity if applicable

        this.#logger.debug(`Validating action '${actionId}' for actor ${actorId} with target type ${targetContext.type}`);

        try {
            // --- 1. Actor Component Requirement Checks ---
            if (!this._checkEntityComponentRequirements(
                actorEntity,
                actionDefinition.actor_required_components,
                actionDefinition.actor_forbidden_components,
                actionId,
                'actor'
            )) {
                return false;
            }

            // --- 2. Target Domain / Context Type Compatibility Checks ---
            const expectedDomain = actionDefinition.target_domain || 'none';
            const contextType = targetContext.type;
            const entityDomains = ['self', 'inventory', 'equipment', 'environment'];

            if (expectedDomain === 'none' && contextType !== 'none') {
                this.#logger.debug(`Validation failed: Action '${actionId}' expects no target (domain 'none'), but context has type ${contextType}`);
                return false;
            }
            if (expectedDomain === 'direction' && contextType !== 'direction') {
                this.#logger.debug(`Validation failed: Action '${actionId}' expects direction target (domain 'direction'), but context has type ${contextType}`);
                return false;
            }
            if (entityDomains.includes(expectedDomain) && contextType !== 'entity') {
                this.#logger.debug(`Validation failed: Action '${actionId}' expects an entity target (domain '${expectedDomain}'), but context has type ${contextType}`);
                return false;
            }
            if (expectedDomain === 'self' && contextType === 'entity' && targetContext.entityId !== actorId) {
                this.#logger.debug(`Validation failed: Action '${actionId}' expects target 'self', but target context entity ID (${targetContext.entityId}) does not match actor ID (${actorId}).`);
                return false;
            }

            // --- 3. Target Entity Resolution and Component Checks (Conditional) ---
            if (contextType === 'entity') {
                const targetEntityId = targetContext.entityId;
                targetEntity = this.#entityManager.getEntityInstance(targetEntityId); // Store resolved entity
                if (!targetEntity) {
                    this.#logger.error(`Action Validation Failed: Target entity ID '${targetEntityId}' specified in context for action '${actionId}' by actor '${actorId}' could not be found.`);
                    return false;
                }

                if (!this._checkEntityComponentRequirements(
                    targetEntity,
                    actionDefinition.target_required_components,
                    actionDefinition.target_forbidden_components,
                    actionId,
                    'target'
                )) {
                    return false;
                }
            }

            // --- 4. Prerequisite Checks ---
            // Iterate through prerequisites AFTER basic actor/target checks pass.
            const prerequisites = actionDefinition.prerequisites || [];
            for (const prerequisite of prerequisites) {
                // Pass resolved targetEntity to the checker
                if (!this._checkSinglePrerequisite(prerequisite, actionDefinition, actorEntity, targetContext, targetEntity)) {
                    // Failure message logged within _checkSinglePrerequisite
                    return false; // Prerequisite failed, action is invalid
                }
            }
            // --- End Prerequisite Checks ---


            // --- 5. Placeholder for further specific domain/context validation ---
            // - More specific domain checks (e.g., is the entity *actually* in inventory if domain='inventory'?)
            // - Direction validity details (e.g., is 'north' a valid exit from this specific room?)
            // ... add more checks here in future tickets ...

            // If all checks passed so far:
            this.#logger.debug(`Validation PASSED for action '${actionId}' for actor ${actorId} with target type ${targetContext.type}.`);
            return true;

        } catch (error) {
            this.#logger.error(`Error during action validation for '${actionId}' for actor ${actorId}:`, error);
            return false;
        }
    }
}

// export default ActionValidationService;