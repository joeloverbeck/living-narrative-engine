// src/logic/operationHandlers/addComponentHandler.js

// -----------------------------------------------------------------------------
//  ADD_COMPONENT Handler — Extracted from ModifyComponentHandler
//  Adds a new component to an entity or replaces an existing one.
// -----------------------------------------------------------------------------

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */ // Reuse definition

/**
 * Parameters accepted by {@link AddComponentHandler#execute}.
 * @typedef {object} AddComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref     - Required. Reference to the entity to add the component to.
 * @property {string}  component_type - Required. The namespaced type ID of the component to add.
 * @property {object}  value          - Required. The data object for the new component instance. Must be a non-null object.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------
class AddComponentHandler {
    /** @type {ILogger}        */ #logger;
    /** @type {EntityManager} */ #entityManager;

    /**
     * Creates an instance of AddComponentHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {EntityManager} dependencies.entityManager - The entity management service.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @throws {Error} If entityManager or logger are missing or invalid.
     */
    constructor({entityManager, logger}) {
        // Validate logger FIRST (consistent with ModifyComponentHandler)
        if (!logger || ['info', 'warn', 'error', 'debug'].some(m => typeof logger[m] !== 'function')) {
            throw new Error('AddComponentHandler requires a valid ILogger instance.');
        }
        if (!entityManager || typeof entityManager.addComponent !== 'function') {
            throw new Error('AddComponentHandler requires a valid EntityManager instance with an addComponent method.');
        }
        this.#logger = logger;
        this.#entityManager = entityManager;
    }

    /**
     * Resolves entity_ref -> entityId or null.
     * (Copied directly from ModifyComponentHandler as the logic is identical)
     * @private
     * @param {AddComponentOperationParams['entity_ref']} ref - The entity reference from parameters.
     * @param {ExecutionContext} ctx - The execution context.
     * @returns {string | null} The resolved entity ID or null.
     */
    #resolveEntityId(ref, ctx) {
        const ec = ctx?.evaluationContext ?? {};
        if (typeof ref === 'string') {
            const t = ref.trim();
            if (!t) return null;
            if (t === 'actor') return ec.actor?.id ?? null;
            if (t === 'target') return ec.target?.id ?? null;
            return t; // Assume direct ID
        }
        if (ref && typeof ref === 'object' && typeof ref.entityId === 'string' && ref.entityId.trim()) {
            return ref.entityId.trim();
        }
        return null;
    }

    /**
     * Executes the ADD_COMPONENT operation.
     * Adds a new component instance (or replaces an existing one) on the specified entity.
     *
     * @param {AddComponentOperationParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The execution context.
     * @returns {void}
     * @implements {OperationHandler}
     */
    execute(params, executionContext) {
        const log = executionContext?.logger ?? this.#logger;

        // 1. Validate Parameters
        if (!params || typeof params !== 'object') {
            log.warn('ADD_COMPONENT: params missing or invalid.', {params});
            return;
        }

        const {entity_ref, component_type, value} = params;

        if (!entity_ref) {
            log.warn('ADD_COMPONENT: "entity_ref" parameter is required.');
            return;
        }
        if (typeof component_type !== 'string' || !component_type.trim()) {
            log.warn('ADD_COMPONENT: Invalid or missing "component_type" parameter (must be non-empty string).');
            return;
        }
        // Crucially, 'value' must be an object for addComponent
        if (typeof value !== 'object' || value === null) {
            log.warn('ADD_COMPONENT: Invalid or missing "value" parameter (must be a non-null object).');
            return;
        }

        const trimmedComponentType = component_type.trim();

        // 2. Resolve Entity ID
        const entityId = this.#resolveEntityId(entity_ref, executionContext);
        if (!entityId) {
            log.warn(`ADD_COMPONENT: Could not resolve entity id from entity_ref.`, {entity_ref});
            return;
        }

        // 3. Execute Add Component
        try {
            // EntityManager.addComponent handles both adding new and replacing existing
            this.#entityManager.addComponent(entityId, trimmedComponentType, value);
            log.debug(`ADD_COMPONENT: Successfully added/replaced component "${trimmedComponentType}" on entity "${entityId}".`);
        } catch (e) {
            // Catch potential errors from addComponent (e.g., entity not found by EntityManager, validation errors)
            log.error(`ADD_COMPONENT: Failed to add component "${trimmedComponentType}" to entity "${entityId}". Error: ${e.message}`, {error: e});
            // Optionally include stack trace in debug/verbose mode: e.stack
        }
    }
}

export default AddComponentHandler;