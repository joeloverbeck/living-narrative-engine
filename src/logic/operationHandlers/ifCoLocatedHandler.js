/**
 * @file Handler for IF_CO_LOCATED operation
 *
 * Conditional operation that executes different action sequences based on whether two entities
 * share the same location (co-located check using core:position component).
 *
 * Operation flow:
 * 1. Validate parameters (entity_ref_a, entity_ref_b, then_actions, else_actions)
 * 2. Resolve entity references to entity IDs
 * 3. Check if both entities have matching locationId in their position components
 * 4. Execute then_actions if co-located, else_actions if not
 * 5. Handle nested operation errors with safe error dispatcher
 *
 * Related files:
 * @see data/schemas/operations/ifCoLocated.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - IfCoLocatedHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

class IfCoLocatedHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {() => OperationInterpreter} */
  #opInterpreterResolver;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {() => OperationInterpreter} deps.operationInterpreter - Lazy resolver for interpreter
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    operationInterpreter,
    safeEventDispatcher,
  }) {
    super('IfCoLocatedHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      operationInterpreter: {
        value: operationInterpreter,
        validator: (val) => {
          const isFunction = typeof val === 'function';
          const isObject = typeof val === 'object' && typeof val.execute === 'function';
          return isFunction || isObject;
        },
        errorMessage: 'IfCoLocatedHandler requires operationInterpreter to be either a resolver function or an object with execute() method.',
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    // Normalize to always use a resolver function
    const isFunction = typeof operationInterpreter === 'function';
    this.#opInterpreterResolver = isFunction ? operationInterpreter : () => operationInterpreter;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @typedef {object} IfCoLocatedParams
   * @property {string|object} entity_ref_a
   * @property {string|object} entity_ref_b
   * @property {import('../../../data/schemas/operation.schema.json').Operation[]} [then_actions]
   * @property {import('../../../data/schemas/operation.schema.json').Operation[]} [else_actions]
   */

  /**
   * @param {IfCoLocatedParams} params
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, 'IF_CO_LOCATED')) {
      return;
    }

    const {
      entity_ref_a,
      entity_ref_b,
      then_actions = [],
      else_actions = [],
    } = params;

    if (!entity_ref_a || !entity_ref_b) {
      safeDispatchError(
        this.#dispatcher,
        'IF_CO_LOCATED: entity_ref_a and entity_ref_b are required'
      );
      return;
    }

    const idA = resolveEntityId(entity_ref_a, executionContext);
    const idB = resolveEntityId(entity_ref_b, executionContext);

    if (!idA || !idB) {
      log.debug(
        `IF_CO_LOCATED: failed to resolve entity IDs '${idA}' or '${idB}'`
      );
      return;
    }

    const same = this.#entitiesCoLocated(idA, idB, executionContext);

    const actions = same ? then_actions : else_actions;
    await this.#runActions(actions, executionContext);
  }

  /**
   * Determine if two entities share the same location.
   *
   * @private
   * @param {string} idA - First entity ID.
   * @param {string} idB - Second entity ID.
   * @param {ExecutionContext} _executionContext - Current execution context.
   * @returns {boolean} `true` if co-located, else `false`.
   */
  #entitiesCoLocated(idA, idB, _executionContext) {
    let same = false;
    try {
      const posA = this.#entityManager.getComponentData(
        idA,
        POSITION_COMPONENT_ID
      );
      const posB = this.#entityManager.getComponentData(
        idB,
        POSITION_COMPONENT_ID
      );
      same =
        posA?.locationId &&
        posB?.locationId &&
        posA.locationId === posB.locationId;
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        `IF_CO_LOCATED: error reading positions for '${idA}' or '${idB}'`,
        { error: e.message, stack: e.stack }
      );
      same = false;
    }
    return same;
  }

  /**
   * Execute a list of operations using the interpreter.
   *
   * @private
   * @param {import('../../../data/schemas/operation.schema.json').Operation[]|*} actions - Operations to execute.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @returns {void}
   */
  async #runActions(actions, executionContext) {
    if (!Array.isArray(actions)) return;
    // Resolve the operation interpreter when needed
    const opInterpreter = this.#opInterpreterResolver();
    for (const op of actions) {
      try {
        await opInterpreter.execute(op, executionContext);
      } catch (err) {
        safeDispatchError(
          this.#dispatcher,
          'IF_CO_LOCATED: nested operation threw',
          {
            error: err?.message,
            stack: err?.stack,
            op,
          }
        );
        break;
      }
    }
  }
}

export default IfCoLocatedHandler;
