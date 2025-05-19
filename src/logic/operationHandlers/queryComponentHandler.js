// src/logic/operationHandlers/queryComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject
 */

/**
 * @typedef {object} QueryComponentOperationParams
 * @property {'actor' | 'target' | string | EntityRefObject} entity_ref - Reference to the target entity.
 * @property {string} component_type - The namespaced ID of the component type.
 * @property {string} result_variable - Variable name in `executionContext.evaluationContext.context`.
 */

class QueryComponentHandler {
    #entityManager;
    #logger;

    constructor({entityManager, logger}) {
        if (!entityManager || typeof entityManager.getComponentData !== 'function') {
            throw new Error('QueryComponentHandler requires a valid EntityManager instance with a getComponentData method.');
        }
        if (!logger || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function') {
            throw new Error('QueryComponentHandler requires a valid ILogger instance.');
        }
        this.#entityManager = entityManager;
        this.#logger = logger;
    }

    #resolveEntityId(entityRef, executionContext, logger) {
        // --- CORRECTED: Resolve actor/target from executionContext.evaluationContext ---
        const actorId = executionContext?.evaluationContext?.actor?.id;
        const targetId = executionContext?.evaluationContext?.target?.id;
        // --- END CORRECTION ---

        if (typeof entityRef === 'string') {
            const trimmedRef = entityRef.trim();
            if (!trimmedRef) {
                logger.error('QueryComponentHandler: Invalid empty string provided for entity_ref.', {entityRef});
                return null;
            }

            if (trimmedRef === 'actor') {
                if (!actorId) {
                    logger.error("QueryComponentHandler: Cannot resolve 'actor' entity ID. Actor missing or has no ID in evaluationContext.actor.", {evalContextActor: executionContext?.evaluationContext?.actor});
                    return null;
                }
                return actorId;
            } else if (trimmedRef === 'target') {
                if (!targetId) {
                    logger.error("QueryComponentHandler: Cannot resolve 'target' entity ID. Target missing or has no ID in evaluationContext.target.", {evalContextTarget: executionContext?.evaluationContext?.target});
                    return null;
                }
                return targetId;
            } else {
                logger.debug(`QueryComponentHandler: Interpreting entity_ref string "${trimmedRef}" as a direct entity ID.`);
                return trimmedRef;
            }
        } else if (typeof entityRef === 'object' && entityRef !== null && typeof entityRef.entityId === 'string') {
            const trimmedId = entityRef.entityId.trim();
            if (!trimmedId) {
                logger.error('QueryComponentHandler: Invalid entity_ref object: entityId property is empty or whitespace.', {entityRef});
                return null;
            }
            return trimmedId;
        } else {
            logger.error('QueryComponentHandler: Invalid entity_ref parameter. Must be "actor", "target", a non-empty entity ID string, or an object like { entityId: "..." }.', {entityRef});
            return null;
        }
    }

    execute(params, executionContext) {
        const logger = executionContext?.logger ?? this.#logger;

        if (!params || typeof params !== 'object') {
            logger.error('QueryComponentHandler: Missing or invalid parameters object.', {params});
            return;
        }

        // This check correctly targets the nested context for variable storage, aligning with test structure.
        if (!executionContext?.evaluationContext?.context || typeof executionContext.evaluationContext.context !== 'object') {
            logger.error('QueryComponentHandler: executionContext.evaluationContext.context is missing or invalid. Cannot store result.', {executionContext});
            return;
        }

        const {entity_ref, component_type, result_variable} = params;

        if (!entity_ref) {
            logger.error('QueryComponentHandler: Missing required "entity_ref" parameter.', {params});
            return;
        }
        if (typeof component_type !== 'string' || !component_type.trim()) {
            logger.error('QueryComponentHandler: Missing or invalid required "component_type" parameter (must be non-empty string).', {params});
            return;
        }
        const trimmedComponentType = component_type.trim();

        if (typeof result_variable !== 'string' || !result_variable.trim()) {
            logger.error('QueryComponentHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).', {params});
            return;
        }
        const trimmedResultVariable = result_variable.trim();

        const entityId = this.#resolveEntityId(entity_ref, executionContext, logger);
        if (!entityId) {
            // Error already logged by #resolveEntityId
            return;
        }

        logger.debug(`QueryComponentHandler: Attempting to query component "${trimmedComponentType}" from entity "${entityId}". Storing result in context variable "${trimmedResultVariable}".`);

        let result = undefined;
        try {
            result = this.#entityManager.getComponentData(entityId, trimmedComponentType);

            // Store result in the nested context, aligning with test structure and the check above.
            executionContext.evaluationContext.context[trimmedResultVariable] = result;

            if (result !== undefined) {
                const resultString = result === null ? 'null' : (typeof result === 'object' ? JSON.stringify(result) : result);
                logger.debug(`QueryComponentHandler: Successfully queried component "${trimmedComponentType}" from entity "${entityId}". Result stored in "${trimmedResultVariable}": ${resultString}`);
            } else {
                logger.debug(`QueryComponentHandler: Component "${trimmedComponentType}" not found on entity "${entityId}". Stored 'undefined' in "${trimmedResultVariable}".`);
            }

        } catch (error) {
            logger.error(`QueryComponentHandler: Error during EntityManager.getComponentData for component "${trimmedComponentType}" on entity "${entityId}".`, {
                error: error.message,
                stack: error.stack,
                params: params,
                resolvedEntityId: entityId
            });
            try {
                executionContext.evaluationContext.context[trimmedResultVariable] = undefined;
                logger.warn(`QueryComponentHandler: Stored 'undefined' in "${trimmedResultVariable}" due to EntityManager error.`);
            } catch (contextError) {
                logger.error('QueryComponentHandler: Failed to store \'undefined\' in context after EntityManager error.', {contextError: contextError.message});
            }
        }
    }
}

export default QueryComponentHandler;