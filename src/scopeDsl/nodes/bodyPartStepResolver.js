/**
 * @file Specialized resolver for body-part-related step operations
 * @description Handles body part field access like body_parts, all_body_parts
 * enabling syntax: actor.body_parts[] for iterating over body part entities
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Creates a body part step resolver for handling body-part-specific field access
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @param {object} [dependencies.errorHandler] - Optional centralized error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createBodyPartStepResolver({
  entitiesGateway,
  errorHandler = null,
}) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  /**
   * Mapping of recognized body part field names to their modes
   * @type {Object<string, string>}
   */
  const BODY_PART_FIELDS = {
    body_parts: 'all',
    all_body_parts: 'all',
  };

  /**
   * Checks if this resolver can handle the given node
   *
   * @param {object} node - The node to check
   * @returns {boolean} True if node is a Step node with a body part field
   */
  function canResolve(node) {
    if (!node || node.type !== 'Step' || !node.field) {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(BODY_PART_FIELDS, node.field);
  }

  /**
   * Resolves a body part field for an entity
   *
   * @param {string} entityId - The entity ID to resolve body parts for
   * @param {string} field - The body part field to resolve
   * @returns {object|null} A body part access object for ArrayIterationResolver, or null on error
   */
  function resolveBodyPartField(entityId, field) {
    // Validate inputs
    if (!entityId || typeof entityId !== 'string') {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid entity ID provided to BodyPartStepResolver',
          { entityId, field },
          'BodyPartStepResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      }
      return null;
    }

    if (!field || typeof field !== 'string' || !BODY_PART_FIELDS[field]) {
      if (errorHandler) {
        errorHandler.handleError(
          `Invalid body part reference: ${field}`,
          { field, entityId, validFields: Object.keys(BODY_PART_FIELDS) },
          'BodyPartStepResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      }
      return null;
    }

    let bodyComponent;
    try {
      bodyComponent = entitiesGateway.getComponentData(
        entityId,
        'anatomy:body'
      );
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(
          `Failed to retrieve body component for entity ${entityId}: ${error.message}`,
          { entityId, field, originalError: error.message },
          'BodyPartStepResolver',
          ErrorCodes.COMPONENT_RESOLUTION_FAILED
        );
      }
      return null;
    }

    // If entity has no anatomy:body component, return null (not an error - entity just has no body)
    if (!bodyComponent) {
      return null;
    }

    const mode = BODY_PART_FIELDS[field];

    // Return a body part access object that will be processed by ArrayIterationResolver
    return {
      __isBodyPartAccessObject: true,
      __bodyPartAccess: true,
      entityId: entityId,
      mode: mode,
      type: 'body_part_access',
      bodyComponent: bodyComponent,
    };
  }

  /**
   * Resolves a Step node for body part field access
   *
   * @param {object} node - The Step node to resolve
   * @param {object} ctx - Resolution context
   * @returns {Set} Set of resolved values (body part access objects)
   */
  function resolve(node, ctx) {
    // Validate inputs
    if (!node || !node.field) {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid node provided to BodyPartStepResolver',
          { node },
          'BodyPartStepResolver',
          ErrorCodes.INVALID_NODE_STRUCTURE
        );
      }
      return new Set();
    }

    if (!ctx || !ctx.dispatcher) {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid context or missing dispatcher',
          { hasContext: !!ctx, hasDispatcher: !!ctx?.dispatcher },
          'BodyPartStepResolver',
          ErrorCodes.MISSING_DISPATCHER
        );
      }
      return new Set();
    }

    const { field, parent } = node;
    let parentResults;

    try {
      parentResults = ctx.dispatcher.resolve(parent, ctx);
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(
          `Failed to resolve parent node: ${error.message}`,
          { field, parentNode: parent, originalError: error.message },
          'BodyPartStepResolver',
          ErrorCodes.STEP_RESOLUTION_FAILED
        );
      }
      return new Set();
    }

    const resultSet = new Set();

    // Process each parent entity
    for (const entityId of parentResults) {
      if (typeof entityId !== 'string') {
        continue; // Skip non-entity results
      }

      const bodyPartData = resolveBodyPartField(entityId, field);

      if (bodyPartData) {
        // Add the body part access object to the result set
        // It will be processed by ArrayIterationResolver
        resultSet.add(bodyPartData);
      }
    }

    return resultSet;
  }

  return {
    canResolve,
    resolve,
  };
}
