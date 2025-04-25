// src/logic/operationHandlers/modifyComponentHandler.js

/* eslint-disable max-depth */
// -----------------------------------------------------------------------------
//  MODIFY_COMPONENT Handler — Ticket T-02
//  Adds unified logic for component mutation (set / inc).
// -----------------------------------------------------------------------------

// --- Imports -----------------------------------------------------------------
import resolvePath from '../../utils/resolvePath.js';

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId
 */

/**
 * @typedef {object} ModifyComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref
 * @property {string}  component_type
 * @property {string} [field]
 * @property {'set'|'inc'} mode
 * @property {*} value
 */

// -----------------------------------------------------------------------------
//  Helper utilities
// -----------------------------------------------------------------------------

/** Create missing chain and set value at leaf. */
function setByPath(root, path, value) {
    const parts = path.split('.').filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        if (i === parts.length - 1) {
            cur[key] = value;
            return true;
        }
        if (cur[key] == null) cur[key] = {};
        if (typeof cur[key] !== 'object') return false;
        cur = cur[key];
    }
    return false;
}

/** Increment numeric leaf value. */
function incByPath(root, path, delta) {
    const parentPath = path.split('.').slice(0, -1).join('.');
    const leaf = path.split('.').slice(-1)[0];
    const parentObj = parentPath ? resolvePath(root, parentPath) : root;
    if (!parentObj || typeof parentObj !== 'object') return false;
    if (typeof parentObj[leaf] !== 'number') return false;
    parentObj[leaf] += delta;
    return true;
}

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------
class ModifyComponentHandler {
    /** @type {ILogger}        */ #logger;
    /** @type {EntityManager} */ #entityManager;

    constructor({entityManager, logger}) {
        // Validate logger FIRST so tests expecting logger–error path pass.
        if (!logger || ['info', 'warn', 'error', 'debug'].some(m => typeof logger[m] !== 'function')) {
            throw new Error('ModifyComponentHandler requires a valid ILogger instance.');
        }
        if (!entityManager || typeof entityManager.addComponent !== 'function') {
            throw new Error('ModifyComponentHandler requires a valid EntityManager instance.');
        }
        this.#logger = logger;
        this.#entityManager = entityManager;
    }

    /** Resolve entity_ref → entityId or null. */
    #resolveEntityId(ref, ctx) {
        const ec = ctx?.evaluationContext ?? {};
        if (typeof ref === 'string') {
            const t = ref.trim();
            if (!t) return null;
            if (t === 'actor') return ec.actor?.id ?? null;
            if (t === 'target') return ec.target?.id ?? null;
            return t;
        }
        if (ref && typeof ref === 'object' && typeof ref.entityId === 'string' && ref.entityId.trim()) {
            return ref.entityId.trim();
        }
        return null;
    }

    /** @implements {OperationHandler} */
    execute(params, execCtx) {
        const log = execCtx?.logger ?? this.#logger;

        if (!params || typeof params !== 'object') {
            log.warn('MODIFY_COMPONENT: params missing or invalid.', {params});
            return;
        }

        const {entity_ref, component_type, field, mode, value} = /** @type {ModifyComponentOperationParams} */ (params);

        if (!entity_ref) {
            log.warn('MODIFY_COMPONENT: "entity_ref" required.');
            return;
        }
        if (typeof component_type !== 'string' || !component_type.trim()) {
            log.warn('MODIFY_COMPONENT: invalid "component_type"');
            return;
        }
        if (!['set', 'inc'].includes(mode)) {
            log.warn('MODIFY_COMPONENT: mode must be "set" or "inc".');
            return;
        }
        if (field != null && (typeof field !== 'string' || !field.trim())) {
            log.warn('MODIFY_COMPONENT: field, when given, must be non-empty string.');
            return;
        }
        if (mode === 'inc' && typeof value !== 'number') {
            log.warn('MODIFY_COMPONENT: inc mode requires numeric value.');
            return;
        }

        const entityId = this.#resolveEntityId(entity_ref, execCtx);
        if (!entityId) {
            log.warn('MODIFY_COMPONENT: could not resolve entity id.', {entity_ref});
            return;
        }

        // -------------------------------------------------------------------------
        //  Whole-component replacement
        // -------------------------------------------------------------------------
        if (field == null) {
            if (mode === 'inc') {
                log.warn('MODIFY_COMPONENT: inc mode invalid without field.');
                return;
            }
            if (typeof value !== 'object' || value === null) {
                log.warn('MODIFY_COMPONENT: set whole component requires object value.');
                return;
            }
            try {
                this.#entityManager.addComponent(entityId, component_type.trim(), value);
                log.debug(`MODIFY_COMPONENT: replaced component ${component_type} on ${entityId}`);
            } catch (e) {
                log.error(`MODIFY_COMPONENT: addComponent failed: ${e.message}`);
            }
            return;
        }

        // -------------------------------------------------------------------------
        //  Field-level mutation
        // -------------------------------------------------------------------------
        if (typeof this.#entityManager.getComponentData !== 'function') {
            log.warn('MODIFY_COMPONENT: EntityManager lacks getComponentData; cannot mutate field.');
            return;
        }
        const compData = this.#entityManager.getComponentData(entityId, component_type.trim());
        if (compData === undefined) {
            log.warn(`MODIFY_COMPONENT: component ${component_type} missing on ${entityId}`);
            return;
        }
        if (typeof compData !== 'object' || compData === null) {
            log.warn(`MODIFY_COMPONENT: component ${component_type} on ${entityId} not object.`);
            return;
        }

        const path = field.trim();
        if (mode === 'set') {
            if (!setByPath(compData, path, value)) log.warn(`MODIFY_COMPONENT: set failed at path ${path}.`);
            return;
        }
        // mode === inc
        if (!incByPath(compData, path, /** @type {number} */ (value))) log.warn(`MODIFY_COMPONENT: inc failed at path ${path}.`);
    }
}

export default ModifyComponentHandler;
