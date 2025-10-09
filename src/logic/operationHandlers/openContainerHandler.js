/**
 * @file Operation handler for opening containers with key validation
 * @see src/logic/operationHandlers/openContainerHandler.js
 */

import { assertParamsObject, validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const CONTAINER_OPENED_EVENT = 'items:container_opened';
const OPENABLE_COMPONENT_ID = 'items:openable';
const CONTAINER_COMPONENT_ID = 'items:container';
const INVENTORY_COMPONENT_ID = 'items:inventory';

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
      if (params?.result_variable) {
        tryWriteContextVariable(
          params.result_variable,
          failureResult,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return failureResult;
    }

    const { actorEntity, containerEntity } = validated;

    try {
      // Check if container has openable component
      const openable = this.#entityManager.getComponentData(
        containerEntity,
        OPENABLE_COMPONENT_ID
      );

      if (!openable) {
        log.warn('Container is not openable', { containerEntity });
        const result = { success: false, error: 'container_not_openable' };
        if (params?.result_variable) {
          tryWriteContextVariable(
            params.result_variable,
            result,
            executionContext,
            this.#dispatcher,
            log
          );
        }
        return result;
      }

      if (openable.isOpen) {
        log.warn('Container is already open', { containerEntity });
        const result = { success: false, error: 'already_open' };
        if (params?.result_variable) {
          tryWriteContextVariable(
            params.result_variable,
            result,
            executionContext,
            this.#dispatcher,
            log
          );
        }
        return result;
      }

      // Check key requirement
      if (openable.requiresKey) {
        const inventory = this.#entityManager.getComponentData(
          actorEntity,
          INVENTORY_COMPONENT_ID
        );

        if (!inventory || !inventory.items.includes(openable.requiresKey)) {
          log.warn('Actor does not have required key', {
            actorEntity,
            requiredKey: openable.requiresKey,
          });
          const result = {
            success: false,
            error: 'missing_key',
          };
          if (params?.result_variable) {
            tryWriteContextVariable(
              params.result_variable,
              result,
              executionContext,
              this.#dispatcher,
              log
            );
          }
          return result;
        }
      }

      // Get container contents
      const container = this.#entityManager.getComponentData(
        containerEntity,
        CONTAINER_COMPONENT_ID
      );

      const contents = container?.items || [];

      if (!container) {
        log.warn('Container has no items component', { containerEntity });
      }

      // Open container by updating openable component
      await this.#entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: containerEntity,
            componentTypeId: OPENABLE_COMPONENT_ID,
            componentData: {
              ...openable,
              isOpen: true,
            },
          },
        ],
        true
      );

      this.#dispatcher.dispatch(CONTAINER_OPENED_EVENT, { actorEntity, containerEntity, contents });

      log.debug('Container opened successfully', {
        actorEntity,
        containerEntity,
        contentsCount: contents.length,
      });

      const result = { success: true, contents };
      if (params?.result_variable) {
        tryWriteContextVariable(
          params.result_variable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return result;
    } catch (error) {
      log.error('Failed to open container', error, {
        actorEntity,
        containerEntity,
      });
      const result = { success: false, error: error.message };
      if (params?.result_variable) {
        tryWriteContextVariable(
          params.result_variable,
          result,
          executionContext,
          this.#dispatcher,
          log
        );
      }
      return result;
    }
  }
}

export default OpenContainerHandler;
