// src/logic/operationHandlers/regenerateDescriptionHandler.js

/**
 * @file Handler for REGENERATE_DESCRIPTION operation
 *
 * Regenerates entity descriptions using the BodyDescriptionComposer service, updating the
 * core:description component with freshly composed text based on current entity state.
 *
 * Operation flow:
 * 1. Validate parameters (entity_ref)
 * 2. Resolve entity reference and retrieve entity instance
 * 3. Compose new description via BodyDescriptionComposer service
 * 4. Update core:description component with generated text
 * 5. Log successful regeneration with description metrics
 *
 * Related files:
 * @see data/schemas/operations/regenerateDescription.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - RegenerateDescriptionHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends ComponentOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../anatomy/bodyDescriptionComposer.js').BodyDescriptionComposer} BodyDescriptionComposer */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import ComponentOperationHandler from './componentOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Parameters accepted by {@link RegenerateDescriptionHandler#execute}.
 *
 * @typedef {object} RegenerateDescriptionOperationParams
 * @property {'actor'|'target'|string|{entityId: string}} entity_ref - Required. Reference to the entity to regenerate description for.
 */

/**
 * Operation handler that regenerates entity descriptions by leveraging the BodyDescriptionComposer
 * service to create updated descriptions and storing them in the entity's core:description component.
 */
class RegenerateDescriptionHandler extends ComponentOperationHandler {
  /** @type {EntityManager} */ #entityManager;
  /** @type {BodyDescriptionComposer} */ #bodyDescriptionComposer;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * Creates an instance of RegenerateDescriptionHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {EntityManager} dependencies.entityManager - The entity management service.
   * @param {BodyDescriptionComposer} dependencies.bodyDescriptionComposer - Service for composing entity descriptions.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Dispatcher used to emit system error events.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({
    entityManager,
    bodyDescriptionComposer,
    logger,
    safeEventDispatcher,
  }) {
    super('RegenerateDescriptionHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      bodyDescriptionComposer: {
        value: bodyDescriptionComposer,
        requiredMethods: ['composeDescription'],
      },
    });

    this.#entityManager = entityManager;
    this.#bodyDescriptionComposer = bodyDescriptionComposer;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Executes the REGENERATE_DESCRIPTION operation to update an entity's description.
   *
   * @param {RegenerateDescriptionOperationParams} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    try {
      // 1. Parameter Validation
      if (!assertParamsObject(params, log, 'REGENERATE_DESCRIPTION')) {
        return;
      }

      const { entity_ref } = params;

      // 2. Entity Reference Resolution
      const entityId = this.validateEntityRef(
        entity_ref,
        log,
        'REGENERATE_DESCRIPTION',
        executionContext
      );

      if (!entityId) {
        return; // validateEntityRef handles logging
      }

      // 3. Entity Retrieval
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        log.warn('Entity not found for description regeneration', {
          entityId,
          operation: 'REGENERATE_DESCRIPTION',
        });
        return;
      }

      // 4. Description Generation
      const newDescription =
        await this.#bodyDescriptionComposer.composeDescription(entity);

      // 5. Component Update
      await this.#entityManager.addComponent(entityId, 'core:description', {
        text: newDescription,
      });

      log.info('Successfully regenerated entity description', {
        entityId,
        descriptionLength: newDescription?.length || 0,
      });
    } catch (error) {
      log.error('Failed to regenerate entity description', {
        params,
        error: error.message,
        stack: error.stack,
      });

      safeDispatchError(
        this.#dispatcher,
        'REGENERATE_DESCRIPTION operation failed',
        {
          params,
          error: error.message,
          stack: error.stack,
        },
        log
      );
    }
  }
}

export default RegenerateDescriptionHandler;
