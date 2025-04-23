// src/validation/componentRequirementChecker.js

/**
 * @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../entities/entity.js').default} Entity
 */

/**
 * Service responsible for checking if an entity meets specific component requirements
 * (having required components and not having forbidden components).
 * Designed for reusability within validation logic.
 */
export class ComponentRequirementChecker {
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ComponentRequirementChecker.
     * @param {object} dependencies - The required dependencies.
     * @param {ILogger} dependencies.logger - Logger service instance.
     * @throws {Error} If the logger dependency is missing or invalid.
     */
    constructor({ logger }) {
        // Dependency Injection & Validation
        if (!logger || typeof logger.debug !== 'function' || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.info !== 'function') {
            // Throw error if logger is missing or doesn't conform to the expected ILogger interface
            throw new Error("ComponentRequirementChecker requires a valid ILogger instance.");
        }
        this.#logger = logger;
        this.#logger.info("ComponentRequirementChecker initialized.");
    }

    /**
     * Checks component requirements (required and forbidden) for a given entity within a specific context.
     * Uses the component type ID strings directly with entity.hasComponent.
     *
     * @param {Entity} entity - The entity instance to check. Must be a valid Entity object.
     * @param {string[] | undefined | null} requiredComponentIds - Array of component type ID strings that MUST be present.
     * @param {string[] | undefined | null} forbiddenComponentIds - Array of component type ID strings that MUST NOT be present.
     * @param {'actor' | 'target' | string} entityRole - The role of the entity (e.g., 'actor', 'target', 'item') for logging context.
     * @param {string} contextDescription - A description of the context where the check is performed (e.g., "action 'core:attack'", "item usage 'potion_heal'").
     * @returns {boolean} True if component requirements are met, false otherwise. Logs failures at debug level.
     */
    check(entity, requiredComponentIds, forbiddenComponentIds, entityRole, contextDescription) {
        // Defensive check: Ensure entity is valid before accessing its properties/methods
        if (!entity || typeof entity.id !== 'string' || typeof entity.hasComponent !== 'function') {
            this.#logger.error(`ComponentRequirementChecker.check: Called with invalid entity object for role '${entityRole}' in context '${contextDescription}'.`);
            return false; // Cannot proceed with an invalid entity object
        }

        const entityId = entity.id;
        // Capitalize role for logs, handle potentially longer roles gracefully
        const roleCapitalized = entityRole ? entityRole.charAt(0).toUpperCase() + entityRole.slice(1) : 'Entity';

        // Ensure arrays are iterable, default to empty if null/undefined
        const reqIds = requiredComponentIds || [];
        const fobIds = forbiddenComponentIds || [];

        // --- Check Required Components ---
        for (const componentId of reqIds) {
            // Validate the component ID itself before using it
            if (typeof componentId !== 'string' || !componentId.trim()) {
                this.#logger.warn(`ComponentRequirementChecker Warning: Invalid component ID found in required list for ${entityRole} (entity ${entityId}) in context '${contextDescription}'. Skipping check for this ID: "${componentId}"`);
                continue; // Skip this invalid ID and check the next one
            }
            // Check if the entity has the component data associated with this ID
            if (!entity.hasComponent(componentId)) {
                this.#logger.debug(`Requirement Check Failed: ${roleCapitalized} ${entityId} is missing required component '${componentId}' for context '${contextDescription}'.`);
                return false; // Requirement failed
            }
        }

        // --- Check Forbidden Components ---
        for (const componentId of fobIds) {
            // Validate the component ID itself before using it
            if (typeof componentId !== 'string' || !componentId.trim()) {
                this.#logger.warn(`ComponentRequirementChecker Warning: Invalid component ID found in forbidden list for ${entityRole} (entity ${entityId}) in context '${contextDescription}'. Skipping check for this ID: "${componentId}"`);
                continue; // Skip this invalid ID and check the next one
            }
            // Check if the entity has the component data associated with this ID
            if (entity.hasComponent(componentId)) {
                this.#logger.debug(`Requirement Check Failed: ${roleCapitalized} ${entityId} has forbidden component '${componentId}' for context '${contextDescription}'.`);
                return false; // Forbidden component found
            }
        }

        // If all checks passed (meaning no required components were missing and no forbidden components were found)
        this.#logger.debug(`Requirement Check Passed: ${roleCapitalized} ${entityId} meets component requirements for context '${contextDescription}'.`);
        return true;
    }
}