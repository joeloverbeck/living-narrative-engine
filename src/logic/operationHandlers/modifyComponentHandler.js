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
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import {
  initHandlerLogger,
  validateDeps,
  getExecLogger,
} from './handlerUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils.js';

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
function setByPath(root, path, value) {
  const parts = path.split('.').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      cur[key] = value;
      return true;
    }
    if (cur[key] === null || cur[key] === undefined) cur[key] = {};
    if (typeof cur[key] !== 'object') return false;
    cur = cur[key];
  }
  return false;
}

// ── handler ───────────────────────────────────────────────────────────────────
class ModifyComponentHandler {
  /** @type {ILogger}        */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  constructor({ entityManager, logger, safeEventDispatcher }) {
    this.#logger = initHandlerLogger('ModifyComponentHandler', logger);
    validateDeps('ModifyComponentHandler', this.#logger, {
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
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const log = getExecLogger(this.#logger, execCtx);

    // ── validate base params ───────────────────────────────────────
    if (!assertParamsObject(params, log, 'MODIFY_COMPONENT')) {
      return;
    }
    const { entity_ref, component_type, field, mode = 'set', value } = params;

    if (!entity_ref) {
      log.warn('MODIFY_COMPONENT: "entity_ref" required.');
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      log.warn('MODIFY_COMPONENT: invalid "component_type".');
      return;
    }
    if (mode !== 'set') {
      log.warn(
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
      log.warn('MODIFY_COMPONENT: "field" must be a non-empty string.');
      return;
    }

    // ── resolve entity ─────────────────────────────────────────────
    const entityId = resolveEntityId(entity_ref, execCtx);
    if (!entityId) {
      log.warn('MODIFY_COMPONENT: could not resolve entity id.', {
        entity_ref,
      });
      return;
    }

    // ── fetch & clone component data ───────────────────────────────
    const compType = component_type.trim();
    const current = this.#entityManager.getComponentData(entityId, compType);

    if (current === undefined) {
      log.warn(
        `MODIFY_COMPONENT: Component "${compType}" not found on entity "${entityId}".`
      );
      return;
    }
    if (typeof current !== 'object' || current === null) {
      log.warn(
        `MODIFY_COMPONENT: Component "${compType}" on entity "${entityId}" is not an object.`
      );
      return;
    }

    const next = JSON.parse(JSON.stringify(current)); // deep clone

    // ── apply “set” mutation ───────────────────────────────────────
    const ok = setByPath(next, field.trim(), value);
    if (!ok) {
      log.warn(
        `MODIFY_COMPONENT: Failed to set path "${field}" on component "${compType}".`
      );
      return;
    }

    // ── commit via EntityManager ───────────────────────────────────
    try {
      const success = this.#entityManager.addComponent(
        entityId,
        compType,
        next
      );
      if (success) {
        log.debug(
          `MODIFY_COMPONENT: Updated "${compType}" on "${entityId}" (field "${field}" set).`
        );
      } else {
        log.warn(
          `MODIFY_COMPONENT: EntityManager.addComponent reported an unexpected failure for component "${compType}" on entity "${entityId}".`
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
          componentType: compType,
        }
      );
    }
  }
}

export default ModifyComponentHandler;
