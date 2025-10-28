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
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../data/gameDataRepository.js').default} IGameDataRepository */
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { applySchemaDefaults } from './helpers/applySchemaDefaults.js';

/**
 * Parameters accepted by {@link AddComponentHandler#execute}.
 *
 * @typedef {object} AddComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref     - Required. Reference to the entity to add the component to.
 * @property {string}  component_type - Required. The namespaced type ID of the component to add.
 * @property {object}  value          - Required. The data object for the new component instance. Must be a non-null object.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------
class AddComponentHandler extends ComponentOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {IGameDataRepository} */ #gameDataRepository;

  /**
   * Creates an instance of AddComponentHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {EntityManager} dependencies.entityManager - The entity management service.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Dispatcher used to emit system error events.
   * @param {IGameDataRepository} dependencies.gameDataRepository - Repository for accessing component definitions.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({
    entityManager,
    logger,
    safeEventDispatcher,
    gameDataRepository,
  }) {
    const dependencySpec = {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    };

    if (gameDataRepository) {
      dependencySpec.gameDataRepository = {
        value: gameDataRepository,
        requiredMethods: ['getComponentDefinition'],
      };
    }

    super('AddComponentHandler', dependencySpec);
    this.#dispatcher = safeEventDispatcher;
    this.#entityManager = entityManager;
    this.#gameDataRepository = gameDataRepository ?? null;
  }

  /**
   * Executes the ADD_COMPONENT operation.
   * Adds a new component instance (or replaces an existing one) on the specified entity.
   *
   * @param {AddComponentOperationParams | null | undefined} params - The parameters for the operation.
   * @param {ExecutionContext} executionContext - The execution context.
   * @returns {Promise<void>}
   * @implements {OperationHandler}
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Add verbose logging for debugging
    log.debug('ADD_COMPONENT: Starting execution with params:', params);
    log.debug(
      'ADD_COMPONENT: ExecutionContext evaluationContext:',
      executionContext?.evaluationContext
    );

    // 1. Validate Parameters
    if (!assertParamsObject(params, log, 'ADD_COMPONENT')) {
      log.warn(
        'ADD_COMPONENT: Parameter validation failed - params object is invalid'
      );
      return;
    }

    const { entity_ref, component_type, value } = params;
    log.debug(
      'ADD_COMPONENT: Extracted params - entity_ref:',
      entity_ref,
      'component_type:',
      component_type,
      'value:',
      value
    );

    // 2. Resolve and validate entity reference
    const validated = this.validateEntityAndType(
      entity_ref,
      component_type,
      log,
      'ADD_COMPONENT',
      executionContext
    );
    if (!validated) {
      log.warn(
        'ADD_COMPONENT: Entity/type validation failed - entity_ref:',
        entity_ref,
        'component_type:',
        component_type
      );
      return;
    }
    const { entityId, type: trimmedComponentType } = validated;
    log.debug(
      'ADD_COMPONENT: Validation successful - entityId:',
      entityId,
      'trimmedComponentType:',
      trimmedComponentType
    );

    // 4. Validate value object
    if (!this.#validateValueObject(value, log)) {
      log.warn('ADD_COMPONENT: Value validation failed - value:', value);
      return;
    }
    log.debug('ADD_COMPONENT: Value validation successful');

    // 4.5 Apply schema defaults to component value
    const componentDefinition = this.#gameDataRepository
      ? this.#gameDataRepository.getComponentDefinition(trimmedComponentType)
      : null;
    const valueWithDefaults = applySchemaDefaults(
      value,
      componentDefinition,
      log
    );

    log.debug('ADD_COMPONENT: Applied schema defaults', {
      original: value,
      withDefaults: valueWithDefaults,
    });

    // 5. Execute Add Component
    try {
      log.debug(
        'ADD_COMPONENT: About to call entityManager.addComponent with:',
        {
          entityId,
          trimmedComponentType,
          value: valueWithDefaults,
        }
      );

      // EntityManager.addComponent handles both adding new and replacing existing
      const result = await this.#entityManager.addComponent(
        entityId,
        trimmedComponentType,
        valueWithDefaults
      );

      log.debug('ADD_COMPONENT: entityManager.addComponent returned:', result);
      log.debug(
        `ADD_COMPONENT: Successfully added/replaced component "${trimmedComponentType}" on entity "${entityId}".`
      );
    } catch (e) {
      const msg = `ADD_COMPONENT: Failed to add component "${trimmedComponentType}" to entity "${entityId}". Error: ${e.message}`;
      log.error(msg, e);
      safeDispatchError(
        this.#dispatcher,
        msg,
        {
          raw: e.message,
          stack: e.stack,
          timestamp: new Date().toISOString(),
        },
        log
      );
    }
  }

  /**
   * Validate that the provided component value is a non-null object.
   *
   * @param {*} value - Raw component value parameter.
   * @param {ILogger} logger - Logger used for warning output.
   * @returns {boolean} `true` when valid, `false` otherwise.
   * @private
   */
  #validateValueObject(value, logger) {
    if (typeof value !== 'object' || value === null) {
      logger.warn(
        'ADD_COMPONENT: Invalid or missing "value" parameter (must be a non-null object).'
      );
      return false;
    }
    return true;
  }
}

export default AddComponentHandler;
