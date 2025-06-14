// src/logic/operationHandlers/removeComponentHandler.js

// -----------------------------------------------------------------------------
//  REMOVE_COMPONENT Handler — Adapted from AddComponentHandler
//  Removes an existing component from an entity.
// -----------------------------------------------------------------------------

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */ // Reuse definition
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';

/**
 * Parameters accepted by {@link RemoveComponentHandler#execute}.
 *
 * @typedef {object} RemoveComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref     - Required. Reference to the entity to remove the component from.
 * @property {string}  component_type - Required. The namespaced type ID of the component to remove.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------
class RemoveComponentHandler {
  /** @type {ILogger}        */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * Creates an instance of RemoveComponentHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {EntityManager} dependencies.entityManager - The entity management service.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @param dependencies.safeEventDispatcher
   * @throws {Error} If entityManager or logger are missing or invalid.
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    // Validate logger FIRST
    if (
      !logger ||
      ['info', 'warn', 'error', 'debug'].some(
        (m) => typeof logger[m] !== 'function'
      )
    ) {
      throw new Error(
        'RemoveComponentHandler requires a valid ILogger instance.'
      );
    }
    // Validate EntityManager dependency - needs removeComponent
    if (!entityManager || typeof entityManager.removeComponent !== 'function') {
      throw new Error(
        'RemoveComponentHandler requires a valid EntityManager instance with a removeComponent method.'
      );
    }
    if (!safeEventDispatcher?.dispatch) {
      throw new Error(
        'RemoveComponentHandler requires a valid ISafeEventDispatcher instance.'
      );
    }
    this.#dispatcher = safeEventDispatcher;
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Resolves entity_ref -> entityId or null.
   * (Copied directly from ModifyComponentHandler/AddComponentHandler as the logic is identical)
   *
   * @private
   * @param {RemoveComponentOperationParams['entity_ref']} ref - The entity reference from parameters.
   * @param {ExecutionContext} ctx - The execution context.
   * @returns {string | null} The resolved entity ID or null.
   */

  /**
   * Executes the REMOVE_COMPONENT operation.
   * Removes a component instance from the specified entity.
   *
   * @param {RemoveComponentOperationParams | null | undefined} params - The parameters for the operation.
   * @param {ExecutionContext} executionContext - The execution context.
   * @returns {void}
   * @implements {OperationHandler}
   */
  execute(params, executionContext) {
    const log = executionContext?.logger ?? this.#logger;

    // 1. Validate Parameters
    if (!params || typeof params !== 'object') {
      log.warn('REMOVE_COMPONENT: params missing or invalid.', { params });
      return;
    }

    // Extract required parameters (value is not needed for remove)
    const { entity_ref, component_type } = params;

    if (!entity_ref) {
      log.warn('REMOVE_COMPONENT: "entity_ref" parameter is required.');
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      log.warn(
        'REMOVE_COMPONENT: Invalid or missing "component_type" parameter (must be non-empty string).'
      );
      return;
    }

    const trimmedComponentType = component_type.trim();

    // 2. Resolve Entity ID
    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      log.warn(
        `REMOVE_COMPONENT: Could not resolve entity id from entity_ref.`,
        { entity_ref }
      );
      return;
    }

    // 3. Execute Remove Component
    try {
      // EntityManager.removeComponent handles removing the component.
      // Behavior if component doesn't exist might depend on EntityManager implementation
      // (e.g., it might return false or just do nothing silently). We assume it
      // doesn't throw an error for non-existent components, but might for invalid entityId.
      const removed = this.#entityManager.removeComponent(
        entityId,
        trimmedComponentType
      );

      // Log based on success/failure (assuming removeComponent might return boolean, or just log success if no error)
      // Adjust logging based on actual EntityManager behavior if needed
      if (removed !== false) {
        // Example check, adjust if removeComponent returns void on success
        log.debug(
          `REMOVE_COMPONENT: Successfully removed component "${trimmedComponentType}" from entity "${entityId}" (or component did not exist).`
        );
      } else {
        // This branch might be reached if EntityManager explicitly returns false for some reason
        log.warn(
          `REMOVE_COMPONENT: Attempted to remove component "${trimmedComponentType}" from entity "${entityId}", but operation reported failure.`
        );
      }
    } catch (e) {
      // Catch potential errors from removeComponent (e.g., entity not found by EntityManager)
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: `REMOVE_COMPONENT: Failed to remove component "${trimmedComponentType}" from entity "${entityId}". Error: ${e.message}`,
        details: {
          error: e.message,
          stack: e.stack,
          entityId,
          componentType: trimmedComponentType,
        },
      });
    }
  }
}

export default RemoveComponentHandler;
