// src/services/actionValidationContextBuilder.js

/* type-only imports */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */

/** @typedef {import('../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

/**
 * @class ActionValidationContextBuilder
 * @description Service dedicated to constructing the data context object used
 * for evaluating JsonLogic rules within the action validation process.
 * It fetches relevant data about the actor, target (entity or direction),
 * and action, assembling it into a structured object for the rules engine.
 * Separates context creation logic from the main validation service.
 */
export class ActionValidationContextBuilder {
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ActionValidationContextBuilder.
     * @param {{entityManager: EntityManager, logger: ILogger}} deps - The required services.
     * @throws {Error} If dependencies are missing or invalid (e.g., missing required methods).
     */
    constructor({entityManager, logger}) {
        // --- Constructor Guards ---
        if (!entityManager?.getEntityInstance) { // Check for a key method existence
            throw new Error('ActionValidationContextBuilder requires a valid EntityManager.');
        }
        if (!logger?.debug || !logger?.error || !logger.warn) { // Check for core logging methods
            throw new Error('ActionValidationContextBuilder requires a valid ILogger instance.');
        }

        this.#entityManager = entityManager;
        this.#logger = logger;
    }

    /**
     * Builds the evaluation context object for a given action attempt.
     * This context provides data accessible to JsonLogic rules during validation.
     * It fetches component data for the actor and, if the target is an entity,
     * attempts to fetch the target entity's component data using the EntityManager.
     * Logs a warning if a target entity is specified but not found.
     *
     * @param {ActionDefinition} actionDefinition - The definition of the action being attempted. Must have a valid `id` property.
     * @param {Entity} actor - The entity performing the action. Must have a valid `id` property.
     * @param {ActionTargetContext} targetContext - The context of the action's target (entity, direction, or none). Must have a valid `type` property.
     * @returns {JsonLogicEvaluationContext} The constructed context object, structured as: `{ actor: { id, components }, target: { type, id?, direction?, entity? }, action: { id } }`.
     * @throws {Error} If `actionDefinition` (missing `id`), `actor` (missing `id`), or `targetContext` (missing `type`) are considered invalid based on basic checks.
     */
    buildContext(actionDefinition, actor, targetContext) {
        // Basic sanity checks
        if (!actionDefinition?.id) {
            this.#logger.error("ActionValidationContextBuilder: Invalid actionDefinition provided (missing id).", {actionDefinition});
            throw new Error("ActionValidationContextBuilder requires a valid ActionDefinition.");
        }
        if (!actor?.id) {
            this.#logger.error("ActionValidationContextBuilder: Invalid actor entity provided (missing id).", {actor});
            throw new Error("ActionValidationContextBuilder requires a valid actor Entity.");
        }
        if (!targetContext?.type) { // Basic check for ActionTargetContext structure
            this.#logger.error("ActionValidationContextBuilder: Invalid targetContext provided (missing type).", {targetContext});
            throw new Error("ActionValidationContextBuilder requires a valid ActionTargetContext.");
        }

        this.#logger.debug(`ActionValidationContextBuilder: Building context for action '${actionDefinition.id}', actor '${actor.id}', target type '${targetContext.type}'.`);

        // Get target entity data if applicable
        let targetEntityData = null;
        if (targetContext.type === 'entity' && targetContext.entityId) {
            const targetEntityInstance = this.#entityManager.getEntityInstance(targetContext.entityId);
            if (targetEntityInstance) {
                // Include component data if available, otherwise fallback to basic info
                targetEntityData = typeof targetEntityInstance.getAllComponentsData === 'function'
                    ? targetEntityInstance.getAllComponentsData()
                    : {id: targetEntityInstance.id}; // Fallback if method doesn't exist
            } else {
                // Log warning if target entity ID was provided but not found
                this.#logger.warn(`ActionValidationContextBuilder: Target entity '${targetContext.entityId}' not found while building context for action '${actionDefinition.id}'. Context will have null target entity data.`);
                // targetEntityData remains null
            }
        }

        // Construct the context object
        const context /*: JsonLogicEvaluationContext */ = {
            actor: {
                id: actor.id,
                // Include component data if available, otherwise fallback to empty object
                components: typeof actor.getAllComponentsData === 'function'
                    ? actor.getAllComponentsData()
                    : {}, // Fallback if method doesn't exist
            },
            target: {
                type: targetContext.type,
                id: targetContext.entityId, // Null if type is not 'entity'
                direction: targetContext.direction, // Null if type is not 'direction'
                entity: targetEntityData // Null if type is not 'entity', or if entity not found/doesn't have data
            },
            action: {
                id: actionDefinition.id
                // Add other action definition properties here if needed by rules
            },
            // Add other global context properties here if needed
        };

        return context;
    }
}
