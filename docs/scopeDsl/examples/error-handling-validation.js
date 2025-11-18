/**
 * @file Validation patterns for ScopeDSL error handling
 * @description Demonstrates comprehensive validation with proper error handling
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../../src/utils/dependencyUtils.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 * Example resolver with comprehensive validation patterns
 *
 * This resolver demonstrates various validation techniques with appropriate
 * error codes and messages for different validation failures.
 *
 * @param root0
 * @param root0.logger
 * @param root0.errorHandler
 * @param root0.entityManager
 * @param root0.componentRegistry
 */
export default function createValidationResolver({
  logger,
  errorHandler,
  entityManager,
  componentRegistry,
}) {
  // Validate all dependencies
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });

  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  validateDependency(entityManager, 'IEntityManager', logger, {
    requiredMethods: ['getEntity', 'hasEntity'],
  });

  validateDependency(componentRegistry, 'IComponentRegistry', logger, {
    requiredMethods: ['getComponent', 'hasComponent'],
  });

  /**
   * Validate entity exists and has required structure
   *
   * @param entityId
   * @param ctx
   */
  function validateEntity(entityId, ctx) {
    // Check entity ID format
    if (!entityId || typeof entityId !== 'string') {
      if (errorHandler) {
        errorHandler.handleError(
          `Invalid entity ID: ${entityId}`,
          ctx,
          'ValidationResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      } else {
        throw new Error(`Invalid entity ID: ${entityId}`);
      }
    }

    // Check entity exists
    if (!entityManager.hasEntity(entityId)) {
      if (errorHandler) {
        errorHandler.handleError(
          `Entity not found: ${entityId}`,
          ctx,
          'ValidationResolver',
          ErrorCodes.ENTITY_RESOLUTION_FAILED
        );
      } else {
        throw new Error(`Entity not found: ${entityId}`);
      }
    }

    return entityManager.getEntity(entityId);
  }

  /**
   * Validate component ID format and existence
   *
   * @param componentId
   * @param ctx
   */
  function validateComponentId(componentId, ctx) {
    // Check format (must be namespace:component)
    const componentPattern = /^[a-z_]+:[a-z_]+$/;
    if (!componentPattern.test(componentId)) {
      if (errorHandler) {
        errorHandler.handleError(
          `Invalid component ID format: ${componentId}. Expected format: 'namespace:component'`,
          ctx,
          'ValidationResolver',
          ErrorCodes.INVALID_COMPONENT_ID
        );
      } else {
        throw new Error(`Invalid component ID format: ${componentId}`);
      }
    }

    // Check component is registered
    if (!componentRegistry.hasComponent(componentId)) {
      if (errorHandler) {
        errorHandler.handleError(
          `Component not registered: ${componentId}`,
          ctx,
          'ValidationResolver',
          ErrorCodes.COMPONENT_RESOLUTION_FAILED
        );
      } else {
        throw new Error(`Component not registered: ${componentId}`);
      }
    }
  }

  /**
   * Validate node structure for resolution
   *
   * @param node
   * @param ctx
   */
  function validateNode(node, ctx) {
    // Node must exist
    if (!node) {
      if (errorHandler) {
        errorHandler.handleError(
          'Node is required for resolution',
          ctx,
          'ValidationResolver',
          ErrorCodes.INVALID_NODE_STRUCTURE
        );
      } else {
        throw new Error('Node is required for resolution');
      }
    }

    // Node must have type
    if (!node.type) {
      if (errorHandler) {
        errorHandler.handleError(
          'Node must have a type property',
          { node, ...ctx },
          'ValidationResolver',
          ErrorCodes.INVALID_NODE_TYPE
        );
      } else {
        throw new Error('Node must have a type property');
      }
    }

    // Validate specific node types
    switch (node.type) {
      case 'filter':
      case 'step':
        if (!node.parent) {
          if (errorHandler) {
            errorHandler.handleError(
              `${node.type} node requires parent reference`,
              { node, ...ctx },
              'ValidationResolver',
              ErrorCodes.MISSING_NODE_PARENT
            );
          } else {
            throw new Error(`${node.type} node requires parent reference`);
          }
        }
        break;

      case 'component':
        if (!node.componentId) {
          if (errorHandler) {
            errorHandler.handleError(
              'Component node requires componentId',
              { node, ...ctx },
              'ValidationResolver',
              ErrorCodes.INVALID_NODE_STRUCTURE
            );
          } else {
            throw new Error('Component node requires componentId');
          }
        }
        validateComponentId(node.componentId, ctx);
        break;

      case 'reference':
        if (!node.scopeId) {
          if (errorHandler) {
            errorHandler.handleError(
              'Reference node requires scopeId',
              { node, ...ctx },
              'ValidationResolver',
              ErrorCodes.INVALID_NODE_STRUCTURE
            );
          } else {
            throw new Error('Reference node requires scopeId');
          }
        }
        break;
    }
  }

  /**
   * Validate resolution context
   *
   * @param ctx
   */
  function validateContext(ctx) {
    // Must have context object
    if (!ctx || typeof ctx !== 'object') {
      if (errorHandler) {
        errorHandler.handleError(
          'Context must be an object',
          ctx,
          'ValidationResolver',
          ErrorCodes.MISSING_CONTEXT_GENERIC
        );
      } else {
        throw new Error('Context must be an object');
      }
    }

    // Required: actorEntity
    if (!ctx.actorEntity) {
      if (errorHandler) {
        errorHandler.handleError(
          'Context must include actorEntity',
          ctx,
          'ValidationResolver',
          ErrorCodes.MISSING_ACTOR
        );
      } else {
        throw new Error('Context must include actorEntity');
      }
    }

    // Required: dispatcher function
    if (!ctx.dispatcher || typeof ctx.dispatcher !== 'function') {
      if (errorHandler) {
        errorHandler.handleError(
          'Context must include dispatcher function',
          ctx,
          'ValidationResolver',
          ErrorCodes.MISSING_DISPATCHER
        );
      } else {
        throw new Error('Context must include dispatcher function');
      }
    }

    // Validate depth to prevent infinite recursion
    const depth = ctx.depth || 0;
    const MAX_DEPTH = 10;
    if (depth > MAX_DEPTH) {
      if (errorHandler) {
        errorHandler.handleError(
          `Resolution depth ${depth} exceeds maximum ${MAX_DEPTH}`,
          ctx,
          'ValidationResolver',
          ErrorCodes.MAX_DEPTH_EXCEEDED
        );
      } else {
        throw new Error(
          `Resolution depth ${depth} exceeds maximum ${MAX_DEPTH}`
        );
      }
    }

    // Check for circular references
    if (ctx.visited && ctx.visited.has(ctx.currentNodeId)) {
      if (errorHandler) {
        errorHandler.handleError(
          `Circular reference detected for node: ${ctx.currentNodeId}`,
          ctx,
          'ValidationResolver',
          ErrorCodes.CYCLE_DETECTED
        );
      } else {
        throw new Error(
          `Circular reference detected for node: ${ctx.currentNodeId}`
        );
      }
    }
  }

  /**
   * Validate data types and ranges
   *
   * @param data
   * @param schema
   * @param ctx
   */
  function validateData(data, schema, ctx) {
    // Basic type validation
    if (schema.type === 'number' && typeof data !== 'number') {
      if (errorHandler) {
        errorHandler.handleError(
          `Expected number, got ${typeof data}`,
          { data, schema, ...ctx },
          'ValidationResolver',
          ErrorCodes.DATA_TYPE_MISMATCH
        );
      } else {
        throw new Error(`Expected number, got ${typeof data}`);
      }
    }

    // Range validation for numbers
    if (schema.type === 'number') {
      if (schema.min !== undefined && data < schema.min) {
        if (errorHandler) {
          errorHandler.handleError(
            `Value ${data} is below minimum ${schema.min}`,
            { data, schema, ...ctx },
            'ValidationResolver',
            ErrorCodes.INVALID_DATA_GENERIC
          );
        } else {
          throw new Error(`Value ${data} is below minimum ${schema.min}`);
        }
      }

      if (schema.max !== undefined && data > schema.max) {
        if (errorHandler) {
          errorHandler.handleError(
            `Value ${data} exceeds maximum ${schema.max}`,
            { data, schema, ...ctx },
            'ValidationResolver',
            ErrorCodes.INVALID_DATA_GENERIC
          );
        } else {
          throw new Error(`Value ${data} exceeds maximum ${schema.max}`);
        }
      }
    }

    // String validation
    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        if (errorHandler) {
          errorHandler.handleError(
            `Expected string, got ${typeof data}`,
            { data, schema, ...ctx },
            'ValidationResolver',
            ErrorCodes.DATA_TYPE_MISMATCH
          );
        } else {
          throw new Error(`Expected string, got ${typeof data}`);
        }
      }

      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        if (errorHandler) {
          errorHandler.handleError(
            `String '${data}' does not match pattern ${schema.pattern}`,
            { data, schema, ...ctx },
            'ValidationResolver',
            ErrorCodes.INVALID_DATA_GENERIC
          );
        } else {
          throw new Error(
            `String '${data}' does not match pattern ${schema.pattern}`
          );
        }
      }
    }
  }

  return {
    canResolve(node) {
      return node.type === 'validation';
    },

    resolve(node, ctx) {
      // Perform all validations
      validateContext(ctx);
      validateNode(node, ctx);

      // Validate specific data if provided
      if (node.entityId) {
        validateEntity(node.entityId, ctx);
      }

      if (node.data && node.schema) {
        validateData(node.data, node.schema, ctx);
      }

      // If all validations pass, return success
      return {
        valid: true,
        resolver: 'ValidationResolver',
        validations: [
          'context',
          'node',
          node.entityId ? 'entity' : null,
          node.data ? 'data' : null,
        ].filter(Boolean),
      };
    },
  };
}

/**
 * Helper function to create validation chain
 *
 * @param {Array} validators - Array of validation functions
 * @param {object} errorHandler - Error handler instance
 * @returns {Function} Combined validator
 */
export function createValidationChain(validators, errorHandler) {
  return function validateChain(value, ctx) {
    for (const validator of validators) {
      try {
        validator(value, ctx);
      } catch (error) {
        if (errorHandler) {
          errorHandler.handleError(
            error,
            { value, ...ctx },
            'ValidationChain',
            ErrorCodes.INVALID_DATA_GENERIC
          );
        } else {
          throw error;
        }
      }
    }
    return true;
  };
}

/**
 * Create a validated property accessor
 *
 * @param {object} entity - Entity to access
 * @param {string} path - Property path (e.g., 'components.core:stats.health')
 * @param {object} errorHandler - Error handler instance
 * @param {object} ctx - Resolution context
 * @returns {*} Property value
 */
export function getValidatedProperty(entity, path, errorHandler, ctx) {
  const parts = path.split('.');
  let current = entity;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (current == null) {
      const partialPath = parts.slice(0, i).join('.');
      if (errorHandler) {
        errorHandler.handleError(
          `Cannot access '${part}' of null/undefined at path '${partialPath}'`,
          { entity, path, ...ctx },
          'PropertyAccessor',
          ErrorCodes.INVALID_DATA_GENERIC
        );
      } else {
        throw new Error(
          `Cannot access '${part}' of null/undefined at path '${partialPath}'`
        );
      }
    }

    current = current[part];
  }

  return current;
}
