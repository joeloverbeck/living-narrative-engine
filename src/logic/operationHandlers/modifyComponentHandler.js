// src/logic/operationHandlers/modifyComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId - The specific entity ID.
 */

/**
 * @typedef {object} ModifyComponentOperationParams
 * @property {'actor' | 'target' | string | EntityRefObject} entity_ref - Reference to the target entity.
 * @property {string} component_type - The namespaced ID of the component type.
 * @property {'add' | 'remove' | 'update'} operation - The modification action.
 * @property {object} [data] - Component data, required for 'add' and 'update'.
 */

/**
 * @class ModifyComponentHandler
 * Implements the OperationHandler interface for the "MODIFY_COMPONENT" operation type.
 * Uses the EntityManager to add, remove, or update component data on a specified entity.
 *
 * @implements {OperationHandler}
 */
class ModifyComponentHandler {
    /**
     * @private
     * @readonly
     * @type {EntityManager}
     */
    #entityManager;

    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of ModifyComponentHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {EntityManager} dependencies.entityManager - The entity management service.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @throws {Error} If entityManager or logger are missing or invalid.
     */
    constructor({ entityManager, logger }) {
        if (!entityManager || typeof entityManager.addComponent !== 'function' || typeof entityManager.removeComponent !== 'function' /* || typeof entityManager.updateComponent !== 'function' */ ) {
            // TODO: Add check for updateComponent if/when it exists in EntityManager
            throw new Error('ModifyComponentHandler requires a valid EntityManager instance with at least addComponent and removeComponent methods.');
        }
        if (!logger || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function') {
            throw new Error('ModifyComponentHandler requires a valid ILogger instance.');
        }
        this.#entityManager = entityManager;
        this.#logger = logger; // Use injected logger primarily
    }

    /**
     * Resolves the target entity ID based on the entity_ref parameter and execution context.
     * @private
     * @param {ModifyComponentOperationParams['entity_ref']} entityRef - The entity reference from parameters.
     * @param {ExecutionContext} executionContext - The execution context containing actor, target etc.
     * @returns {string | null} The resolved entity ID or null if resolution fails.
     */
    #resolveEntityId(entityRef, executionContext) {
        const evalContext = executionContext?.evaluationContext;

        if (typeof entityRef === 'string') {
            if (entityRef === 'actor') {
                const actorId = evalContext?.actor?.id;
                if (!actorId) {
                    this.#logger.error("ModifyComponentHandler: Cannot resolve 'actor' entity ID. Actor missing or has no ID in evaluation context.", { context: evalContext });
                    return null;
                }
                return actorId;
            } else if (entityRef === 'target') {
                const targetId = evalContext?.target?.id;
                if (!targetId) {
                    this.#logger.error("ModifyComponentHandler: Cannot resolve 'target' entity ID. Target missing or has no ID in evaluation context.", { context: evalContext });
                    return null;
                }
                return targetId;
            } else {
                // Assume it might be a direct ID or a path to be resolved later if a resolver service is used
                // For now, treat other strings as direct IDs if they are non-empty
                if (entityRef.trim()) {
                    this.#logger.debug(`ModifyComponentHandler: Interpreting entity_ref string "${entityRef}" as a direct entity ID.`);
                    return entityRef.trim();
                } else {
                    this.#logger.error(`ModifyComponentHandler: Invalid empty string provided for entity_ref.`, { entityRef });
                    return null;
                }
                // TODO: Integrate PayloadValueResolverService if complex paths like 'event.payload.entityId' are needed for entity_ref
            }
        } else if (typeof entityRef === 'object' && entityRef !== null && typeof entityRef.entityId === 'string' && entityRef.entityId.trim()) {
            return entityRef.entityId.trim();
        } else {
            this.#logger.error('ModifyComponentHandler: Invalid entity_ref parameter. Must be "actor", "target", a non-empty entity ID string, or an object like { entityId: "..." }.', { entityRef });
            return null;
        }
    }

    /**
     * Executes the MODIFY_COMPONENT operation.
     * Validates parameters, resolves the target entity ID, and calls the appropriate
     * EntityManager method (addComponent, removeComponent).
     * Handles potential errors during the process.
     *
     * @param {OperationParams | ModifyComponentOperationParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The context of the execution.
     * @returns {void}
     */
    execute(params, executionContext) {
        // Use logger from context if available, otherwise fallback to injected one
        // This allows rules to potentially override logging behavior per execution if needed
        const logger = executionContext?.logger ?? this.#logger;

        // --- 1. Basic Parameter Validation ---
        if (!params || typeof params !== 'object') {
            logger.error('ModifyComponentHandler: Missing or invalid parameters object.', { params });
            return;
        }

        const { entity_ref, component_type, operation, data } = params;

        if (!entity_ref) {
            logger.error('ModifyComponentHandler: Missing required "entity_ref" parameter.', { params });
            return;
        }
        if (typeof component_type !== 'string' || !component_type.trim()) {
            logger.error('ModifyComponentHandler: Missing or invalid required "component_type" parameter (must be non-empty string).', { params });
            return;
        }
        const trimmedComponentType = component_type.trim();

        const validOperations = ['add', 'remove', 'update'];
        if (typeof operation !== 'string' || !validOperations.includes(operation)) {
            logger.error(`ModifyComponentHandler: Missing or invalid required "operation" parameter (must be one of: ${validOperations.join(', ')}).`, { params });
            return;
        }

        // --- 2. Conditional Data Validation ---
        if ((operation === 'add' || operation === 'update') && (typeof data !== 'object' || data === null)) {
            logger.error(`ModifyComponentHandler: Missing or invalid "data" parameter (must be an object) for operation "${operation}".`, { params });
            return;
        }
        if (operation === 'remove' && data !== undefined) {
            logger.warn(`ModifyComponentHandler: "data" parameter provided for operation "remove" will be ignored.`, { params });
            // Proceed, but warn the user.
        }


        // --- 3. Resolve Entity ID ---
        const entityId = this.#resolveEntityId(entity_ref, executionContext);
        if (!entityId) {
            // Error already logged by #resolveEntityId
            return;
        }

        // --- 4. Call EntityManager ---
        logger.debug(`ModifyComponentHandler: Attempting operation "${operation}" for component "${trimmedComponentType}" on entity "${entityId}".`, { data: operation !== 'remove' ? data : undefined });

        try {
            let success = false;
            switch (operation) {
                case 'add':
                case 'update':
                    // Current EntityManager has addComponent which validates and adds/updates.
                    // If distinct 'add' vs 'update' behavior is strictly needed (e.g., error if adding existing, error if updating non-existing),
                    // the EntityManager would need separate methods or flags.
                    // Assuming addComponent handles both add and potentially overwrite/update.
                    // The ticket implies modification, so using addComponent seems the closest fit with the current EM.
                    // EntityManager's addComponent now throws on validation failure or if entity not found.
                    // Note: addComponent expects the data as the third argument.
                    success = this.#entityManager.addComponent(entityId, trimmedComponentType, data);
                    // addComponent currently returns boolean/throws, adapt if needed
                    if (success) { // Check return value if it indicates success besides not throwing
                        logger.debug(`ModifyComponentHandler: EntityManager.${operation === 'add' ? 'addComponent' : 'updateComponent (via addComponent)'} succeeded for "${trimmedComponentType}" on entity "${entityId}".`);
                    } else {
                        // This path might not be reachable if addComponent always throws on failure.
                        logger.warn(`ModifyComponentHandler: EntityManager.addComponent call returned false (or non-truthy) for "${trimmedComponentType}" on entity "${entityId}", indicating potential issue not caught by exception.`);
                    }
                    break;

                case 'remove':
                    // removeComponent returns true if removed, false if not found. Doesn't throw for not found.
                    success = this.#entityManager.removeComponent(entityId, trimmedComponentType);
                    if (success) {
                        logger.debug(`ModifyComponentHandler: EntityManager.removeComponent succeeded for "${trimmedComponentType}" on entity "${entityId}".`);
                    } else {
                        logger.warn(`ModifyComponentHandler: EntityManager.removeComponent returned false for "${trimmedComponentType}" on entity "${entityId}" (component likely wasn't present).`);
                    }
                    break;

                // default case already handled by initial validation
            }

        } catch (error) {
            // Catch errors thrown by EntityManager (e.g., entity not found, validation failure in addComponent)
            logger.error(`ModifyComponentHandler: Error during EntityManager operation "${operation}" for component "${trimmedComponentType}" on entity "${entityId}".`, {
                error: error.message, // Log message for clarity
                // stack: error.stack, // Optionally log stack
                params: params,
                resolvedEntityId: entityId
            });
            // Do not re-throw, allow execution to continue with next operation in the sequence.
        }
    }
}

export default ModifyComponentHandler;