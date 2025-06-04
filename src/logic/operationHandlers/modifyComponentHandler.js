// src/logic/operationHandlers/modifyComponentHandler.js

 
// -----------------------------------------------------------------------------
//  MODIFY_COMPONENT Handler — Ticket T-02 / Refactored T-XX
//  Applies modifications ('set' or 'inc') to specific fields within an existing component.
//  NOTE: Adding/replacing whole components is now handled by AddComponentHandler.
// -----------------------------------------------------------------------------

// --- Imports -----------------------------------------------------------------
import resolvePath from '../../utils/resolvePath.js';

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId
 */

/**
 * Parameters accepted by {@link ModifyComponentHandler#execute}.
 * @typedef {object} ModifyComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref     - Required. Reference to the entity whose component field will be modified.
 * @property {string}  component_type - Required. The namespaced type ID of the component to modify.
 * @property {string}  field          - Required. Dot-separated path to the field within the component's data object.
 * @property {'set'|'inc'} mode       - Required. 'set' replaces the field's value; 'inc' numerically increments it.
 * @property {*} value              - Required. The value to set or the numeric amount to increment by. Type depends on 'mode'.
 */

// -----------------------------------------------------------------------------
//  Helper utilities (Unchanged)
// -----------------------------------------------------------------------------

/**
 * Create missing chain and set value at leaf.
 * @param root
 * @param path
 * @param value
 */
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
    if (typeof cur[key] !== 'object') return false; // Cannot traverse non-object
    cur = cur[key];
  }
  return false; // Should not happen if path is valid
}

/**
 * Increment numeric leaf value.
 * @param root
 * @param path
 * @param delta
 */
function incByPath(root, path, delta) {
  const parentPath = path.split('.').slice(0, -1).join('.');
  const leaf = path.split('.').slice(-1)[0];
  const parentObj = parentPath ? resolvePath(root, parentPath) : root;
  if (!parentObj || typeof parentObj !== 'object') return false; // Parent path invalid or not an object
  // Check if the leaf property exists and is a number
  if (typeof parentObj[leaf] !== 'number') return false; // Target field is not a number
  parentObj[leaf] += delta;
  return true;
}

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------
class ModifyComponentHandler {
  /** @type {ILogger}        */ #logger;
  /** @type {EntityManager} */ #entityManager;

  /**
   * Creates an instance of ModifyComponentHandler.
   * @param {object} dependencies - Dependencies object.
   * @param {EntityManager} dependencies.entityManager - The entity management service. Needs `getComponentData`.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If dependencies are invalid.
   */
  constructor({ entityManager, logger }) {
    // Validate logger FIRST so tests expecting logger–error path pass.
    if (
      !logger ||
      ['info', 'warn', 'error', 'debug'].some(
        (m) => typeof logger[m] !== 'function'
      )
    ) {
      throw new Error(
        'ModifyComponentHandler requires a valid ILogger instance.'
      );
    }
    // Now requires getComponentData, addComponent is no longer needed here.
    if (
      !entityManager ||
      typeof entityManager.getComponentData !== 'function'
    ) {
      throw new Error(
        'ModifyComponentHandler requires a valid EntityManager instance with getComponentData method.'
      );
    }
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Resolve entity_ref → entityId or null.
   * (Unchanged - Copied to AddComponentHandler as well)
   * @param ref
   * @param ctx
   * @private
   */
  #resolveEntityId(ref, ctx) {
    const ec = ctx?.evaluationContext ?? {};
    if (typeof ref === 'string') {
      const t = ref.trim();
      if (!t) return null;
      if (t === 'actor') return ec.actor?.id ?? null;
      if (t === 'target') return ec.target?.id ?? null;
      return t;
    }
    if (
      ref &&
      typeof ref === 'object' &&
      typeof ref.entityId === 'string' &&
      ref.entityId.trim()
    ) {
      return ref.entityId.trim();
    }
    return null;
  }

  /**
   * Executes the MODIFY_COMPONENT operation for field-level mutations.
   * It now prepares the modified component data and uses EntityManager.addComponent
   * to apply the changes, ensuring side effects like spatial index updates are triggered.
   * @param {ModifyComponentOperationParams|null|undefined} params - The parameters for the operation.
   * @param {ExecutionContext} execCtx - The execution context.
   * @implements {OperationHandler}
   */
  execute(params, execCtx) {
    const log = execCtx?.logger ?? this.#logger;

    // 1. Validate Base Parameters (as before)
    if (!params || typeof params !== 'object') {
      log.warn('MODIFY_COMPONENT: params missing or invalid.', { params });
      return;
    }
    const { entity_ref, component_type, field, mode, value } = params;
    // ... (all previous parameter validations for entity_ref, component_type, field, mode, value) ...
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
    if (field == null || typeof field !== 'string' || !field.trim()) {
      log.warn(
        'MODIFY_COMPONENT: "field" parameter (non-empty string) is required for modification.'
      );
      return;
    }
    if (mode === 'inc' && typeof value !== 'number') {
      log.warn('MODIFY_COMPONENT: inc mode requires a numeric value.');
      return;
    }

    // 2. Resolve Entity ID (as before)
    const entityId = this.#resolveEntityId(entity_ref, execCtx);
    if (!entityId) {
      log.warn('MODIFY_COMPONENT: could not resolve entity id.', {
        entity_ref,
      });
      return;
    }

    const trimmedComponentType = component_type.trim();
    const path = field.trim();

    // 3. Get current component data
    const currentCompData = this.#entityManager.getComponentData(
      entityId,
      trimmedComponentType
    );

    if (currentCompData === undefined) {
      log.warn(
        `MODIFY_COMPONENT: Component "${trimmedComponentType}" not found on entity "${entityId}". Cannot modify field "${path}".`
      );
      return;
    }
    if (typeof currentCompData !== 'object' || currentCompData === null) {
      log.warn(
        `MODIFY_COMPONENT: Component "${trimmedComponentType}" on entity "${entityId}" is not an object. Cannot modify field "${path}".`
      );
      return;
    }

    // 4. Clone the current data and perform field-level mutation on the clone
    // This ensures we are passing a complete, modified component state to addComponent
    const modifiedCompData = JSON.parse(JSON.stringify(currentCompData)); // Deep clone

    log.debug(
      `MODIFY_COMPONENT: Attempting mode "${mode}" on field "${path}" of component "${trimmedComponentType}" for entity "${entityId}".`
    );

    let mutationSuccess = false;
    if (mode === 'set') {
      mutationSuccess = setByPath(modifiedCompData, path, value);
    } else {
      // mode === 'inc'
      mutationSuccess = incByPath(
        modifiedCompData,
        path,
        /** @type {number} */ (value)
      );
    }

    if (!mutationSuccess) {
      log.warn(
        `MODIFY_COMPONENT: Local mutation (mode "${mode}") failed for field "${path}" on component "${trimmedComponentType}" for entity "${entityId}". Check path or if 'inc' target is a number.`
      );
      return; // Abort if the local mutation on the clone failed
    }

    // 5. "Commit" the entire modified component data back through EntityManager.addComponent
    // This allows EntityManager to handle its full update logic, including validation and side effects.
    try {
      // EntityManager.addComponent will:
      // - Validate the 'modifiedCompData' against the schema.
      // - Retrieve the *actual* oldLocationId from the entity *before* replacing the component.
      // - Replace the component data on the entity.
      // - Retrieve the newLocationId from the *newly set* component data.
      // - Call spatialIndexManager.updateEntityLocation(entityId, actualOldLocationId, newLocationId).
      const updatePersisted = this.#entityManager.addComponent(
        entityId,
        trimmedComponentType,
        modifiedCompData
      );

      if (updatePersisted) {
        // addComponent should return true on success or throw
        log.debug(
          `MODIFY_COMPONENT: Successfully updated component "${trimmedComponentType}" on entity "${entityId}" via EntityManager, triggering side effects.`
        );
      } else {
        // This path might not be hit if addComponent throws on failure per its contract.
        log.warn(
          `MODIFY_COMPONENT: EntityManager.addComponent reported an unexpected failure (returned false without throwing) for component "${trimmedComponentType}" on entity "${entityId}".`
        );
      }
    } catch (error) {
      log.error(
        `MODIFY_COMPONENT: Error during EntityManager.addComponent for component "${trimmedComponentType}" on entity "${entityId}" after field modification: ${error.message}`,
        { error }
      );
      // Depending on desired behavior, you might want to re-throw or just log.
      // If addComponent throws, the operation has failed.
    }
  }
}

export default ModifyComponentHandler;
