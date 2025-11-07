/**
 * @file Handler for HAS_BODY_PART_WITH_COMPONENT_VALUE operation
 *
 * Checks if an entity's body has any part with a specific component property value using
 * the BodyGraphService for graph traversal and value matching.
 *
 * Operation flow:
 * 1. Validate parameters (entityRef, componentId, propertyPath, expectedValue)
 * 2. Resolve entity reference from execution context
 * 3. Retrieve anatomy:body component from entity
 * 4. Query BodyGraphService to check if any part has matching component value
 * 5. Return boolean result (true if found, false otherwise)
 *
 * Related files:
 * @see src/dependencyInjection/tokens/tokens-core.js - HasBodyPartWithComponentValueHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

class HasBodyPartWithComponentValueHandler extends BaseOperationHandler {
  #entityManager;
  #bodyGraphService;
  #safeEventDispatcher;

  constructor({
    logger,
    entityManager,
    bodyGraphService,
    safeEventDispatcher,
  }) {
    super('HasBodyPartWithComponentValueHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance', 'getComponentData'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['hasPartWithComponentValue'],
      },
      safeEventDispatcher: { value: safeEventDispatcher },
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    // Validate execution context
    ensureEvaluationContext(executionContext);

    // Validate parameters
    if (!Array.isArray(params) || params.length !== 4) {
      const errorMessage =
        'hasBodyPartWithComponentValue requires exactly 4 parameters: [entityRef, componentId, propertyPath, expectedValue]';
      safeDispatchError(
        this.#safeEventDispatcher,
        errorMessage,
        executionContext.instanceId,
        logger
      );
      return false;
    }

    const [entityRef, componentId, propertyPath, expectedValue] = params;

    try {
      // Resolve entity from reference
      const entity = this.#resolveEntity(entityRef, executionContext);
      if (!entity) {
        logger.debug(
          `Entity not found for reference: ${JSON.stringify(entityRef)}`
        );
        return false;
      }

      // Get body component from entity
      const bodyComponent = entity.getComponentData('anatomy:body');
      if (!bodyComponent) {
        logger.debug(`Entity ${entity.id} has no anatomy:body component`);
        return false;
      }

      // Use bodyGraphService to check if any body part has the component value
      const result = this.#bodyGraphService.hasPartWithComponentValue(
        bodyComponent,
        componentId,
        propertyPath,
        expectedValue
      );

      logger.debug(
        `Checked body parts for component ${componentId}.${propertyPath}=${expectedValue}: ${result.found}`,
        { entityId: entity.id, result }
      );

      return result.found;
    } catch (error) {
      safeDispatchError(
        this.#safeEventDispatcher,
        error.message || 'An error occurred in hasBodyPartWithComponentValue',
        { error, instanceId: executionContext.instanceId },
        logger
      );
      return false;
    }
  }

  #resolveEntity(entityRef, executionContext) {
    // Check evaluationContext.variables first (for test compatibility)
    const variables =
      executionContext.evaluationContext?.variables ||
      executionContext.variables ||
      {};

    // If entityRef is a string, check if it's a context variable
    if (typeof entityRef === 'string' && variables[entityRef]) {
      const entityData = variables[entityRef];

      // Handle both direct entity ID and entity object
      if (typeof entityData === 'string') {
        return this.#entityManager.getEntityInstance(entityData);
      } else if (entityData?.id) {
        return this.#entityManager.getEntityInstance(entityData.id);
      }
    }

    // Try to get entity directly by ID
    if (typeof entityRef === 'string') {
      return this.#entityManager.getEntityInstance(entityRef);
    }

    // If entityRef is an object with an id property
    if (entityRef?.id) {
      return this.#entityManager.getEntityInstance(entityRef.id);
    }

    return null;
  }
}

export default HasBodyPartWithComponentValueHandler;
