// src/services/actionValidationService.js

/**
 * @typedef {'entity' | 'direction' | 'none'} ActionTargetType
 * Represents the possible types of targets an action can have.
 */

/**
 * Represents the context of an action's target.
 * Provides a unified way to handle different target types (or lack thereof).
 */
export class ActionTargetContext {
    /** @type {ActionTargetType} The type of the target ('entity', 'direction', 'none'). */
    type;
    /** @type {string | null} The ID of the target entity, if type is 'entity'. */
    entityId;
    /** @type {string | null} The direction string (e.g., 'north'), if type is 'direction'. */
    direction;

    /**
     * Creates an instance of ActionTargetContext.
     * @param {ActionTargetType} type - The type of the target.
     * @param {object} [options={}] - Additional options based on type.
     * @param {string} [options.entityId] - Required if type is 'entity'. Must be a non-empty string.
     * @param {string} [options.direction] - Required if type is 'direction'. Must be a non-empty string.
     * @throws {Error} If required options for the given type are missing or invalid.
     */
    constructor(type, {entityId = null, direction = null} = {}) {
        if (!['entity', 'direction', 'none'].includes(type)) {
            throw new Error(`ActionTargetContext: Invalid type specified: ${type}`);
        }
        this.type = type;
        this.entityId = entityId;
        this.direction = direction;

        if (type === 'entity' && (typeof entityId !== 'string' || !entityId.trim())) {
            throw new Error("ActionTargetContext: entityId (non-empty string) is required for type 'entity'.");
        }
        if (type === 'direction' && (typeof direction !== 'string' || !direction.trim())) {
            throw new Error("ActionTargetContext: direction (non-empty string) is required for type 'direction'.");
        }
        // Ensure properties are null if not applicable to the type
        if (type !== 'entity') this.entityId = null;
        if (type !== 'direction') this.direction = null;
    }

    /** Static factory for creating a context with no target. */
    static noTarget() {
        return new ActionTargetContext('none');
    }

    /** Static factory for creating a context targeting an entity. */
    static forEntity(entityId) {
        // Validation is handled by the constructor
        return new ActionTargetContext('entity', {entityId});
    }

    /** Static factory for creating a context targeting a direction. */
    static forDirection(direction) {
        // Validation is handled by the constructor
        return new ActionTargetContext('direction', {direction});
    }
}


// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').ConditionObject} ConditionObject */
/** @typedef {import('../types/common.js').NamespacedId} NamespacedId */
// Note: ActionTargetContext is defined above, no need for JSDoc import here
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */ // Assuming ConsoleLogger fits ILogger interface

/**
 * Service responsible for validating if a specific action is currently valid
 * for a given actor and target context, based on the game state and action definitions.
 * It checks component requirements, domain compatibility, and prerequisites.
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
     * @param {EntityManager} dependencies.entityManager - Service to access entity instances and component data.
     * @param {GameDataRepository} dependencies.gameDataRepository - Service to access game data definitions (like actions).
     * @param {ILogger} dependencies.logger - Logger service instance.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({entityManager, gameDataRepository, logger}) {
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error("ActionValidationService requires a valid EntityManager instance.");
        }
        if (!gameDataRepository || typeof gameDataRepository.getAction !== 'function') { // Check a representative method
            throw new Error("ActionValidationService requires a valid GameDataRepository instance.");
        }
        if (!logger || typeof logger.debug !== 'function' || typeof logger.error !== 'function') { // Check required log levels
            throw new Error("ActionValidationService requires a valid ILogger instance.");
        }
        this.#entityManager = entityManager;
        this.#gameDataRepository = gameDataRepository;
        this.#logger = logger;
        this.#logger.info("ActionValidationService initialized.");
    }

    /**
     * Checks component requirements (required and forbidden) for a given entity.
     * Uses the component type ID strings directly with entity.hasComponent.
     * @private
     * @param {Entity} entity - The entity instance to check. Must be a valid Entity object.
     * @param {string[] | undefined} requiredComponentIds - Array of component type ID strings that MUST be present.
     * @param {string[] | undefined} forbiddenComponentIds - Array of component type ID strings that MUST NOT be present.
     * @param {string} actionDefinitionId - The ID of the action being validated (for logging context).
     * @param {'actor' | 'target'} entityRole - The role of the entity ('actor' or 'target') (for logging context).
     * @returns {boolean} True if component requirements are met, false otherwise. Logs failures at debug level.
     */
    _checkEntityComponentRequirements(entity, requiredComponentIds, forbiddenComponentIds, actionDefinitionId, entityRole) {
        // Defensive check: Ensure entity is valid before accessing its properties/methods
        if (!entity || typeof entity.id !== 'string' || typeof entity.hasComponent !== 'function') {
            this.#logger.error(`_checkEntityComponentRequirements called with invalid entity object for role ${entityRole}, action ${actionDefinitionId}.`);
            return false; // Cannot proceed with an invalid entity object
        }

        const entityId = entity.id;
        const roleCapitalized = entityRole.charAt(0).toUpperCase() + entityRole.slice(1);

        // Ensure arrays are iterable, default to empty if null/undefined
        requiredComponentIds = requiredComponentIds || [];
        forbiddenComponentIds = forbiddenComponentIds || [];

        // --- Check Required Components ---
        for (const componentId of requiredComponentIds) {
            // Validate the component ID itself before using it
            if (typeof componentId !== 'string' || !componentId.trim()) {
                this.#logger.warn(`Action Validation Warning: Invalid component ID found in required list for ${entityRole} (entity ${entityId}) in action '${actionDefinitionId}'. Skipping check for this ID: "${componentId}"`);
                continue; // Skip this invalid ID and check the next one
            }
            // Check if the entity has the component data associated with this ID
            if (!entity.hasComponent(componentId)) {
                this.#logger.debug(`Action Validation Failed: ${roleCapitalized} ${entityId} is missing required component '${componentId}' for action '${actionDefinitionId}'.`);
                return false; // Requirement failed
            }
        }

        // --- Check Forbidden Components ---
        for (const componentId of forbiddenComponentIds) {
            // Validate the component ID itself before using it
            if (typeof componentId !== 'string' || !componentId.trim()) {
                this.#logger.warn(`Action Validation Warning: Invalid component ID found in forbidden list for ${entityRole} (entity ${entityId}) in action '${actionDefinitionId}'. Skipping check for this ID: "${componentId}"`);
                continue; // Skip this invalid ID and check the next one
            }
            // Check if the entity has the component data associated with this ID
            if (entity.hasComponent(componentId)) {
                this.#logger.debug(`Action Validation Failed: ${roleCapitalized} ${entityId} has forbidden component '${componentId}' for action '${actionDefinitionId}'.`);
                return false; // Forbidden component found
            }
        }

        // If all checks passed (meaning no required components were missing and no forbidden components were found)
        return true;
    }

    /**
     * Evaluates a single prerequisite condition defined within an action.
     * Currently supports placeholder logic; intended for extension.
     * @private
     * @param {ConditionObject} prerequisite - The prerequisite definition object.
     * @param {ActionDefinition} actionDefinition - The overall action definition (for context/logging).
     * @param {Entity} actorEntity - The acting entity.
     * @param {ActionTargetContext} targetContext - The target context of the action.
     * @param {Entity | null} targetEntity - The resolved target entity instance (null if context is not 'entity' or entity not found).
     * @returns {boolean} True if the prerequisite passes (or is a placeholder returning true), false otherwise. Logs results/failures at debug level.
     */
    _checkSinglePrerequisite(prerequisite, actionDefinition, actorEntity, targetContext, targetEntity) {
        // Basic validation of the prerequisite object structure
        if (!prerequisite || typeof prerequisite.condition_type !== 'string') {
            this.#logger.warn(`Action Validation Warning: Invalid prerequisite structure in action '${actionDefinition.id}'. Skipping.`, {prerequisite});
            return true; // Or false, depending on desired strictness. Let's assume skip = pass for now.
        }

        const actionId = actionDefinition.id;
        const conditionType = prerequisite.condition_type;
        const negate = prerequisite.negate || false; // Default negate to false

        // Log the check with relevant details (excluding potentially large 'details' object if needed)
        const logDetails = {...prerequisite};
        delete logDetails.details; // Avoid logging large nested objects unless necessary
        this.#logger.debug(`Checking prerequisite: type='${conditionType}', negate=${negate}, details=${JSON.stringify(logDetails)} for action '${actionId}'`);

        let conditionResult = false; // Default to failure before evaluation

        // --- Extensible Dispatch Structure ---
        // This switch statement is where specific condition types would be handled.
        switch (conditionType) {
            // Example future handlers:
            // case 'actor_has_component':
            //     conditionResult = this._handleActorHasComponent(prerequisite, actorEntity);
            //     break;
            // case 'target_has_component':
            //     conditionResult = this._handleTargetHasComponent(prerequisite, targetEntity); // Pass resolved entity
            //     break;
            // case 'actor_stat_check':
            //     conditionResult = this._handleActorStatCheck(prerequisite, actorEntity);
            //     break;
            // case 'target_in_location': // Example check
            //     if (targetEntity && actorEntity) {
            //         const actorLoc = actorEntity.getComponentData('component:position')?.locationId;
            //         const targetLoc = targetEntity.getComponentData('component:position')?.locationId;
            //         conditionResult = actorLoc && targetLoc && actorLoc === targetLoc;
            //     } else {
            //         conditionResult = false; // Cannot check if entities are missing
            //     }
            //     break;
            // ... add cases for other specific condition types defined in schemas ...

            // --- Placeholder Logic (as implemented before) ---
            case 'placeholder':
            case 'placeholder_fail': // Specific type for testing forced failure
            default: // Treat any unrecognized type as a placeholder for now
                this.#logger.debug(`  -> Prerequisite type '${conditionType}' using default/placeholder logic for action '${actionId}'.`);
                // Default placeholder logic: pass unless specifically marked to fail
                conditionResult = !(prerequisite.force_fail === true || conditionType === 'placeholder_fail');
                if (!conditionResult) {
                    this.#logger.debug(`  -> Placeholder prerequisite FORCED FAIL for action '${actionId}'.`);
                } else {
                    this.#logger.debug(`  -> Placeholder prerequisite PASSED for action '${actionId}'.`);
                }
                break;
        }

        // Apply negation if the 'negate' flag is true
        const finalResult = negate ? !conditionResult : conditionResult;

        // Log the final outcome of the prerequisite check
        if (!finalResult) {
            // Log specific failure message if provided, otherwise generic failure log
            const failureMsg = prerequisite.failure_message ? `. Reason: ${prerequisite.failure_message}` : '.';
            this.#logger.debug(`Action Validation Failed: Prerequisite type '${conditionType}' (negated: ${negate}) check resulted in FAILURE for action '${actionId}'${failureMsg}`);
        } else {
            this.#logger.debug(` -> Prerequisite type '${conditionType}' (negated: ${negate}) check PASSED for action '${actionId}'.`);
        }

        return finalResult;
    }

    /**
     * Checks if a given action is valid for the specified actor and target context
     * based on the current game state and the action's definition.
     * Performs checks in order: Actor components, Domain/Context compatibility,
     * Target entity resolution & components (if applicable), Prerequisites.
     *
     * @param {ActionDefinition} actionDefinition - The definition object of the action to validate. Must be valid.
     * @param {Entity} actorEntity - The entity instance performing the action. Must be valid.
     * @param {ActionTargetContext} targetContext - The context object describing the action's target. Must be valid.
     * @returns {boolean} True if the action is deemed valid according to all checks, false otherwise.
     * @throws {Error} If critical input parameters (actionDefinition, actorEntity, targetContext) are missing or structurally invalid.
     */
    isValid(actionDefinition, actorEntity, targetContext) {
        // --- Critical Input Validation ---
        if (!actionDefinition || typeof actionDefinition.id !== 'string' || !actionDefinition.id.trim()) {
            const errorMsg = "ActionValidationService.isValid: Missing or invalid actionDefinition (must have non-empty string 'id').";
            this.#logger.error(errorMsg, {actionDefinition});
            throw new Error(errorMsg);
        }
        if (!actorEntity || typeof actorEntity.id !== 'string' || !actorEntity.id.trim() || typeof actorEntity.hasComponent !== 'function') {
            const errorMsg = `ActionValidationService.isValid: Missing or invalid actorEntity object for action '${actionDefinition.id}'.`;
            this.#logger.error(errorMsg, {actorEntity});
            throw new Error(errorMsg);
        }
        if (!targetContext || typeof targetContext.type !== 'string') {
            const errorMsg = `ActionValidationService.isValid: Missing or invalid targetContext object for action '${actionDefinition.id}' actor '${actorEntity.id}'.`;
            this.#logger.error(errorMsg, {targetContext});
            throw new Error(errorMsg);
        }
        // --- End Input Validation ---

        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;
        let targetEntity = null; // Will hold resolved target entity if context type is 'entity'

        // Detailed log at the start of validation for better tracing
        this.#logger.debug(`Validating action '${actionId}' for actor ${actorId} with target context: type='${targetContext.type}', entityId='${targetContext.entityId ?? 'N/A'}', direction='${targetContext.direction ?? 'N/A'}'`);

        try {
            // --- STEP 1: Actor Component Requirement Checks ---
            if (!this._checkEntityComponentRequirements(
                actorEntity,
                actionDefinition.actor_required_components,
                actionDefinition.actor_forbidden_components,
                actionId,
                'actor'
            )) {
                // Failure reason logged within _checkEntityComponentRequirements
                return false; // Actor doesn't meet requirements
            }
            this.#logger.debug(` -> Step 1 PASSED: Actor ${actorId} meets component requirements for ${actionId}.`);


            // --- STEP 2: Target Domain / Context Type Compatibility Checks ---
            // Ensure the type of target provided matches the type expected by the action's domain.
            const expectedDomain = actionDefinition.target_domain || 'none'; // Default domain to 'none' if undefined
            const contextType = targetContext.type;

            // These checks are relevant only if the context specifies a target (not 'none')
            if (contextType !== 'none') {
                // Define which domains imply an entity target vs. other types
                const entityDomains = ['self', 'inventory', 'equipment', 'environment', 'location', 'location_items', 'location_non_items', 'nearby', 'nearby_including_blockers']; // Add any other domains that target entities
                const directionDomains = ['direction'];
                const noTargetDomains = ['none'];

                // Check for mismatches:
                if (noTargetDomains.includes(expectedDomain) /* Action expects no target */) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain '${expectedDomain}') is incompatible with provided context type '${contextType}'.`);
                    return false;
                }
                if (directionDomains.includes(expectedDomain) && contextType !== 'direction' /* Action expects direction, got something else */) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain '${expectedDomain}') requires 'direction' context, but got '${contextType}'.`);
                    return false;
                }
                if (entityDomains.includes(expectedDomain) && contextType !== 'entity' /* Action expects entity, got something else */) {
                    // This catches cases like passing a 'direction' context to an action needing 'environment'
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain '${expectedDomain}') requires 'entity' context, but got '${contextType}'.`);
                    return false;
                }
                // Specific check for 'self' domain (which is an entity domain)
                if (expectedDomain === 'self' && contextType === 'entity' && targetContext.entityId !== actorId) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain 'self') requires target to be actor ${actorId}, but context targets entity ${targetContext.entityId}.`);
                    return false;
                }
            }
            this.#logger.debug(` -> Step 2 PASSED: Domain ('${expectedDomain}') and Context Type ('${contextType}') are compatible for ${actionId}.`);


            // --- STEP 3: Target Entity Resolution and Component Checks (Conditional) ---
            // Only perform if the context type indicates an entity target.
            if (contextType === 'entity') {
                const targetEntityId = targetContext.entityId;
                // Although context constructor validates, belt-and-suspenders check here
                if (!targetEntityId) {
                    this.#logger.error(`Action Validation Internal Error (Step 3): Context type is 'entity' but entityId is missing for action '${actionId}'. Should have been caught by ActionTargetContext constructor.`);
                    return false; // Invalid state
                }

                // Attempt to retrieve the target entity instance from the EntityManager
                targetEntity = this.#entityManager.getEntityInstance(targetEntityId);

                if (!targetEntity) {
                    // This is a common and valid reason for failure: the target doesn't exist in the current game state.
                    this.#logger.debug(`Action Validation Failed (Step 3): Target entity ID '${targetEntityId}' (specified in context for action '${actionId}') was not found or is not currently active.`);
                    return false;
                }
                this.#logger.debug(` -> Step 3a PASSED: Resolved target entity ${targetEntityId} for ${actionId}.`);

                // If target entity resolved, check *its* component requirements
                if (!this._checkEntityComponentRequirements(
                    targetEntity,
                    actionDefinition.target_required_components,
                    actionDefinition.target_forbidden_components,
                    actionId,
                    'target'
                )) {
                    // Failure reason logged within _checkEntityComponentRequirements
                    return false; // Target entity doesn't meet requirements
                }
                this.#logger.debug(` -> Step 3b PASSED: Target ${targetEntityId} meets component requirements for ${actionId}.`);

            } else {
                // Log if no entity resolution was needed for clarity
                this.#logger.debug(` -> Step 3 SKIPPED: No target entity resolution/component checks needed for context type '${contextType}' in action ${actionId}.`);
            }

            // --- STEP 4: Prerequisite Checks ---
            // Evaluate any custom conditions defined in the action's prerequisites array.
            const prerequisites = actionDefinition.prerequisites || [];
            if (prerequisites.length > 0) {
                this.#logger.debug(` -> Step 4: Checking ${prerequisites.length} prerequisite(s) for ${actionId}...`);
                // Iterate through each prerequisite condition
                for (const prerequisite of prerequisites) {
                    // Pass the resolved targetEntity (which might be null if contextType isn't 'entity')
                    if (!this._checkSinglePrerequisite(prerequisite, actionDefinition, actorEntity, targetContext, targetEntity)) {
                        // Failure reason logged within _checkSinglePrerequisite
                        return false; // A prerequisite failed, so the action is invalid
                    }
                }
                // If the loop completed without returning false, all prerequisites passed.
                this.#logger.debug(` -> Step 4 PASSED: All ${prerequisites.length} prerequisite(s) met for ${actionId}.`);
            } else {
                // Log that there were no prerequisites to check
                this.#logger.debug(` -> Step 4 PASSED: No prerequisites defined for ${actionId}.`);
            }
            // --- End Prerequisite Checks ---


            // --- STEP 5: Placeholder for Additional Domain-Specific Validation ---
            // Future checks could go here, e.g., verifying visibility, reachability,
            // or specific state conditions not covered by basic components/prerequisites.
            // Example: For 'environment' domain, maybe check if targetEntity.locationId === actorEntity.locationId?
            // This depends on the desired level of validation rigor.
            this.#logger.debug(` -> Step 5 PASSED: Placeholder for additional domain-specific checks for ${actionId}.`);


            // If execution reaches this point, all checks have passed.
            this.#logger.debug(`Validation FINAL RESULT: PASSED for action '${actionId}' (actor ${actorId}, contextType '${targetContext.type}', targetId/Dir '${targetContext.entityId ?? targetContext.direction ?? 'N/A'}').`);
            return true; // Action is valid

        } catch (error) {
            // Catch unexpected errors during the validation process
            this.#logger.error(`Unexpected error during action validation process for action '${actionId}' (actor '${actorId}'):`, error);
            return false; // Treat any unexpected error as a validation failure
        }
    }
}

// Choose your preferred export method:
// export default ActionValidationService;
// or
// export { ActionValidationService };