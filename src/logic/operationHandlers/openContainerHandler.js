/**
 * @file Handler for OPEN_CONTAINER operation
 *
 * Opens a container entity, handling locked containers with key validation.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, containerEntity)
 * 2. Checks container has openable and container components
 * 3. Validates container is not already open
 * 4. If locked, verifies actor has required key in inventory
 * 5. Updates openable component to mark as open and dispatches event
 *
 * Related files:
 * @see data/schemas/operations/openContainer.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - OpenContainerHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import {
  assertParamsObject,
  validateStringParam,
} from '../../utils/handlerUtils/paramsUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';
import {
  OPENABLE_COMPONENT_ID,
  CONTAINER_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { CONTAINER_OPENED_EVENT_ID } from '../../constants/eventIds.js';

/**
 * @typedef {object} OpenContainerParams
 * @property {string} actorEntity - Actor opening the container
 * @property {string} containerEntity - Container to open
 * @property {string} [result_variable] - Variable name to store operation result
 */

/**
 * Opens a container, checking for key requirements
 *
 * @augments BaseOperationHandler
 */
class OpenContainerHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('OpenContainerHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'batchAddComponentsOptimized'],
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
   * Validates and normalizes operation parameters
   *
   * @param {object} params - Raw parameters
   * @param {object} log - Logger instance
   * @returns {object|null} Validated parameters or null
   * @private
   */
  #validateParams(params, log) {
    if (!assertParamsObject(params, this.#dispatcher, 'OPEN_CONTAINER')) {
      return null;
    }

    const { actorEntity, containerEntity } = params;

    const validatedActor = validateStringParam(
      actorEntity,
      'actorEntity',
      log,
      this.#dispatcher
    );
    const validatedContainer = validateStringParam(
      containerEntity,
      'containerEntity',
      log,
      this.#dispatcher
    );

    if (!validatedActor || !validatedContainer) {
      return null;
    }

    return {
      actorEntity: validatedActor,
      containerEntity: validatedContainer,
    };
  }

  /**
   * Writes a value into the provided result variable when the execution context exposes a valid evaluation context.
   *
   * @description Writes a value into the provided result variable when the execution context exposes a valid evaluation context.
   * @param {string|null|undefined} resultVariable - Optional result variable identifier supplied by the operation.
   * @param {unknown} value - Value to persist into the evaluation context.
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context supplied to the handler.
   * @param {import('../../interfaces/coreServices.js').ILogger} log - Logger for debug diagnostics.
   * @returns {void}
   * @private
   */
  #writeResultVariable(resultVariable, value, executionContext, log) {
    if (!resultVariable) {
      return;
    }

    const context = executionContext?.evaluationContext?.context;
    if (!context || typeof context !== 'object') {
      if (log?.debug) {
        log.debug(
          'OpenContainerHandler: Skipping result variable write due to missing evaluation context',
          {
            resultVariable,
          }
        );
      }
      return;
    }

    tryWriteContextVariable(
      resultVariable,
      value,
      executionContext,
      this.#dispatcher,
      log
    );
  }

  /**
   * Execute the open container operation
   *
   * @param {OpenContainerParams} params - Open parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string, contents?: string[], keyItemId?: string}>} Operation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    const validated = this.#validateParams(params, log);
    if (!validated) {
      const failureResult = { success: false, error: 'invalid_parameters' };
      this.#writeResultVariable(
        params?.result_variable,
        failureResult,
        executionContext,
        log
      );
      return failureResult;
    }

    const { actorEntity, containerEntity } = validated;

    try {
      // Check if container has openable component (marker)
      const openable = this.#entityManager.getComponentData(
        containerEntity,
        OPENABLE_COMPONENT_ID
      );

      if (!openable) {
        log.warn('Container is not openable', {
          containerEntity,
        });
        const result = { success: false, error: 'container_not_openable' };
        this.#writeResultVariable(
          params?.result_variable,
          result,
          executionContext,
          log
        );
        return result;
      }

      const container = this.#entityManager.getComponentData(
        containerEntity,
        CONTAINER_COMPONENT_ID
      );

      if (!container) {
        log.warn('Container has no container component', {
          containerEntity,
        });
        const result = { success: false, error: 'container_missing_component' };
        this.#writeResultVariable(
          params?.result_variable,
          result,
          executionContext,
          log
        );
        return result;
      }

      if (container.isOpen) {
        log.warn('Container is already open', {
          containerEntity,
        });
        const result = { success: false, error: 'already_open' };
        this.#writeResultVariable(
          params?.result_variable,
          result,
          executionContext,
          log
        );
        return result;
      }

      // Check key requirement
      const resolvedKeyValue =
        typeof container.keyItemId === 'string'
          ? container.keyItemId.trim()
          : container.keyItemId;

      const requiresKey =
        Boolean(container.requiresKey) || Boolean(resolvedKeyValue);

      if (requiresKey) {
        const inventory = this.#entityManager.getComponentData(
          actorEntity,
          INVENTORY_COMPONENT_ID
        );

        const inventoryItems = Array.isArray(inventory?.items)
          ? inventory.items
          : [];

        if (
          !inventory ||
          !resolvedKeyValue ||
          !inventoryItems.includes(resolvedKeyValue)
        ) {
          log.warn('Actor does not have required key', {
            actorEntity,
            requiredKey: resolvedKeyValue,
          });
          const result = {
            success: false,
            error: 'missing_key',
          };
          this.#writeResultVariable(
            params?.result_variable,
            result,
            executionContext,
            log
          );
          return result;
        }
      }

      let contents = [];
      if (Array.isArray(container.contents)) {
        contents = container.contents;
      }

      await this.#entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: containerEntity,
            componentTypeId: CONTAINER_COMPONENT_ID,
            componentData: {
              ...container,
              isOpen: true,
            },
          },
        ],
        true
      );

      this.#dispatcher.dispatch(CONTAINER_OPENED_EVENT_ID, {
        actorEntity,
        containerEntity,
        contents,
      });

      log.debug('Container opened successfully', {
        actorEntity,
        containerEntity,
        contentsCount: contents.length,
      });

      const result = { success: true, contents };
      this.#writeResultVariable(
        params?.result_variable,
        result,
        executionContext,
        log
      );
      return result;
    } catch (error) {
      log.error('Failed to open container', error, {
        actorEntity,
        containerEntity,
      });
      const result = { success: false, error: error.message };
      this.#writeResultVariable(
        params?.result_variable,
        result,
        executionContext,
        log
      );
      return result;
    }
  }
}

export default OpenContainerHandler;
