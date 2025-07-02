// src/logic/operationHandlers/modifyComponentHandler.js

// -----------------------------------------------------------------------------
//  MODIFY_COMPONENT Handler — simplified to support ONLY “set” field updates.
//  Adds no arithmetic; for numeric adjustments use a preceding MATH+SET_VARIABLE
//  pair, then call MODIFY_COMPONENT with mode "set".
// ---------------------------------------------------------

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

import ComponentOperationHandler from './componentOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';
import { setByPath } from '../../utils/objectPathUtils.js';

/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId
 */

/**
 * @typedef {object} ModifyComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref
 * @property {string}  component_type
 * @property {string}  field                       Dot-separated path
 * @property {'set'}   mode                        Must be "set" (the only mode)
 * @property {*}       value                       New value to assign
 */

// ── helper ────────────────────────────────────────────────────────────────────
/**
 *
 * @param root
 * @param path
 * @param value
 */

// ── handler ───────────────────────────────────────────────────────────────────
/**
 * @implements {OperationHandler}
 */
class ModifyComponentHandler extends ComponentOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * @param {EntityOperationDeps} deps - Dependencies object
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('ModifyComponentHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Executes a MODIFY_COMPONENT operation (mode = "set" only).
   *
   * @param {ModifyComponentOperationParams|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    // ── validate base params ───────────────────────────────────────
    if (!assertParamsObject(params, logger, 'MODIFY_COMPONENT')) {
      return;
    }
    const { entity_ref, component_type, field, mode = 'set', value } = params;

    // ── validate entity and component type together ─────────────────
    const validated = this.validateEntityAndType(
      entity_ref,
      component_type,
      logger,
      'MODIFY_COMPONENT',
      executionContext
    );
    if (!validated) {
      return;
    }
    const { entityId, type: componentType } = validated;
    if (mode !== 'set') {
      logger.warn(
        `MODIFY_COMPONENT: Unsupported mode "${mode}". Only "set" is allowed now.`
      );
      return;
    }
    if (
      field === null ||
      field === undefined ||
      typeof field !== 'string' ||
      !field.trim()
    ) {
      logger.warn('MODIFY_COMPONENT: "field" must be a non-empty string.');
      return;
    }

    // ── fetch & clone component data ───────────────────────────────
    // componentType was validated earlier
    const current = this.#entityManager.getComponentData(
      entityId,
      componentType
    );

    if (current === undefined) {
      logger.warn(
        `MODIFY_COMPONENT: Component "${componentType}" not found on entity "${entityId}".`
      );
      return;
    }
    if (typeof current !== 'object' || current === null) {
      logger.warn(
        `MODIFY_COMPONENT: Component "${componentType}" on entity "${entityId}" is not an object.`
      );
      return;
    }

    const updatedComponent = deepClone(current);

    // ── apply “set” mutation ───────────────────────────────────────
    const ok = setByPath(updatedComponent, field.trim(), value);
    if (!ok) {
      logger.warn(
        `MODIFY_COMPONENT: Failed to set path "${field}" on component "${componentType}".`
      );
      return;
    }

    // ── commit via EntityManager ───────────────────────────────────
    try {
      const success = this.#entityManager.addComponent(
        entityId,
        componentType,
        updatedComponent
      );
      if (success) {
        logger.debug(
          `MODIFY_COMPONENT: Updated "${componentType}" on "${entityId}" (field "${field}" set).`
        );
      } else {
        logger.warn(
          `MODIFY_COMPONENT: EntityManager.addComponent reported an unexpected failure for component "${componentType}" on entity "${entityId}".`
        );
      }
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        'MODIFY_COMPONENT: Error during EntityManager.addComponent.',
        {
          error: e.message,
          stack: e.stack,
          entityId,
          componentType: componentType,
        }
      );
    }
  }
}

export default ModifyComponentHandler;
