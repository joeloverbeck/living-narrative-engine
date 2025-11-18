/**
 * Creates a Step node resolver for field access operations.
 * Resolves Step nodes by extracting field values from parent results.
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @param {object} [dependencies.errorHandler] - Optional centralized error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
import { getOrBuildComponents } from '../core/entityHelpers.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Creates a Step node resolver with injected dependencies
 *
 * @param {object} root0 - Dependencies object
 * @param {object} root0.entitiesGateway - Gateway for entity data access
 * @param {object} [root0.errorHandler] - Optional centralized error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createStepResolver({
  entitiesGateway,
  errorHandler = null,
}) {
  const safeConsoleDebug =
    typeof console !== 'undefined' && typeof console.debug === 'function'
      ? console.debug.bind(console)
      : null;

  /**
   * Logs diagnostic information at debug level when available.
   *
   * @param {import('../../types/runtimeContext.js').RuntimeContext['logger']} logger - Logger from runtime context.
   * @param {string} message - Message to log.
   * @param {object} payload - Structured log payload.
   */
  function logDiagnosticDebug(logger, message, payload) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(message, payload);
    } else if (safeConsoleDebug) {
      safeConsoleDebug(message, payload);
    }
  }

  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }
  /**
   * Retrieves a single component value from an entity.
   *
   * @description Returns the data for the specified component type.
   * @param {string} entityId - Target entity ID.
   * @param {string} field - Component type ID to fetch.
   * @returns {any} The component data or undefined.
   */
  function extractFieldFromEntity(entityId, field) {
    try {
      // First try to get it as a component
      const componentData = entitiesGateway.getComponentData(entityId, field);
      if (componentData !== undefined) {
        return componentData; // Return null or any other value, but not undefined
      }

      // If not found as a component, search within all component data for the field
      const entity = entitiesGateway.getEntityInstance(entityId);
      if (entity && entity.componentTypeIds) {
        for (const componentId of entity.componentTypeIds) {
          const compData = entitiesGateway.getComponentData(
            entityId,
            componentId
          );
          if (compData && typeof compData === 'object' && field in compData) {
            return compData[field];
          }
        }
      }

      return undefined;
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(
          new Error(
            `StepResolver: Failed to extract field '${field}' from entity '${entityId}': ${error.message}`
          ),
          { entityId, field, originalError: error.message },
          'StepResolver',
          ErrorCodes.COMPONENT_RESOLUTION_FAILED
        );
      }
      return undefined;
    }
  }

  /**
   * Extracts a property value from an object.
   *
   * @description Reads the given field directly from the object.
   * @param {object} obj - Source object.
   * @param {string} field - Property to read.
   * @returns {any} Property value or undefined.
   */
  function extractFieldFromObject(obj, field) {
    return obj[field];
  }

  /**
   * Resolves a value from a parent entity.
   *
   * @description Retrieves the requested component or components object.
   * @param {string} entityId - ID of the entity to inspect.
   * @param {string} field - Field name requested.
   * @param {object} [trace] - Optional trace logger.
   * @param logger
   * @returns {any} Extracted value or undefined.
   */
  function resolveEntityParentValue(entityId, field, trace, logger) {
    try {
      if (field === 'components') {
        // DIAGNOSTIC: Log when building components object
        const componentsObj = getOrBuildComponents(entityId, null, entitiesGateway, trace);
        logDiagnosticDebug(logger, '[DIAGNOSTIC] StepResolver - Building components for entity:', {
          entityId,
          field: 'components',
          componentKeys: componentsObj ? Object.keys(componentsObj) : null,
          hasCloseness: componentsObj ? ('positioning:closeness' in componentsObj) : false,
        });
        return componentsObj;
      }

      return extractFieldFromEntity(entityId, field);
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(
          new Error(
            `StepResolver: Failed to resolve entity parent value for field '${field}' on entity '${entityId}': ${error.message}`
          ),
          { entityId, field, originalError: error.message },
          'StepResolver',
          ErrorCodes.STEP_RESOLUTION_FAILED
        );
      }
      return undefined;
    }
  }

  /**
   * Resolves a value from a parent object.
   *
   * @description Reads the given property directly from the object.
   * @param {object} obj - Object containing the field.
   * @param {string} field - Field name to extract.
   * @param logger
   * @returns {any} Extracted value or undefined.
   */
  function resolveObjectParentValue(obj, field, logger) {
    const value = extractFieldFromObject(obj, field);

    // DIAGNOSTIC: Log field access from objects, especially for namespaced IDs
    if (field.includes(':') || field === 'partners') {
      logDiagnosticDebug(logger, '[DIAGNOSTIC] StepResolver - Accessing field from object:', {
        field,
        objectKeys: obj ? Object.keys(obj) : null,
        hasField: obj ? (field in obj) : false,
        valueType: value ? typeof value : 'undefined',
        valuePreview: Array.isArray(value)
          ? `Array(${value.length})`
          : value && typeof value === 'object'
            ? 'Object'
            : value,
      });
    }

    return value;
  }

  /**
   * Adds a trace log entry for step resolution.
   *
   * @description Writes an informational trace if tracing is enabled.
   * @param {object} trace - Trace logger.
   * @param {string} message - Message to log.
   * @param {object} data - Additional log data.
   */
  function logStepResolution(trace, message, data) {}

  return {
    /**
     * Checks if this resolver can handle the given node.
     *
     * @param {object} node - The node to check
     * @returns {boolean} True if node type is 'Step'
     */
    canResolve(node) {
      return node.type === 'Step';
    },

    /**
     * Resolves a Step node by extracting field values from parent results.
     *
     * @param {object} node - The Step node to resolve
     * @param {object} ctx - Resolution context with actorEntity, trace, etc.
     * @returns {Set} Set of field values (no flattening)
     */
    resolve(node, ctx) {
      const trace = ctx.trace;
      const runtimeLogger = ctx?.runtimeCtx?.logger || null;

      // Validate context has required properties
      if (!ctx.actorEntity) {
        const error = new Error(
          'StepResolver: actorEntity is missing from context'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            {
              ...ctx,
              nodeType: node?.type,
              field: node?.field,
              parentNodeType: node?.parent?.type,
            },
            'StepResolver',
            ErrorCodes.MISSING_ACTOR
          );
          return new Set(); // Return empty set when using error handler
        }
        throw error; // Throw error when no errorHandler (backward compatibility)
      }

      // Use dispatcher to resolve parent node - pass full context
      const parentResult = ctx.dispatcher.resolve(node.parent, ctx);

      logStepResolution(
        trace,
        `Resolving Step node with field '${node.field}'. Parent result size: ${parentResult.size}`,
        {
          field: node.field,
          parentSize: parentResult.size,
        }
      );

      // Return empty set if parent is empty
      if (parentResult.size === 0) {
        return new Set();
      }

      const result = new Set();

      for (const parentValue of parentResult) {
        if (typeof parentValue === 'string') {
          // Special case: location.entities(componentId)
          if (
            node.field === 'entities' &&
            node.param &&
            node.parent?.type === 'Source' &&
            node.parent?.kind === 'location'
          ) {
            // Get all entities with the specified component at this location
            const componentId = node.param;
            const locationId = parentValue;
            const entitiesWithComponent =
              entitiesGateway.getEntitiesWithComponent(componentId);

            if (entitiesWithComponent) {
              for (const entity of entitiesWithComponent) {
                // Check if entity is at this location
                const posData = entitiesGateway.getComponentData(
                  entity.id,
                  'core:position'
                );
                if (posData && posData.locationId === locationId) {
                  result.add(entity.id);
                }
              }
            }
          } else {
            const val = resolveEntityParentValue(
              parentValue,
              node.field,
              trace,
              runtimeLogger
            );
            if (node.field === 'components') {
              if (val) result.add(val);
            } else if (val !== undefined) {
              result.add(val);
            }
          }
        } else if (parentValue && typeof parentValue === 'object') {
          // Check if parentValue is a Set (result from filtering)
          if (parentValue instanceof Set) {
            // Handle Set of objects - extract field from each object in the Set
            for (const setItem of parentValue) {
              if (setItem && typeof setItem === 'object') {
                const val = resolveObjectParentValue(
                  setItem,
                  node.field,
                  runtimeLogger
                );
                if (val !== undefined) {
                  result.add(val);
                }
              }
            }
          } else {
            // Handle single object
            const val = resolveObjectParentValue(
              parentValue,
              node.field,
              runtimeLogger
            );
            if (val !== undefined) {
              result.add(val);
            }
          }
        }
      }

      logStepResolution(
        trace,
        `Step node resolved. Field: '${node.field}', Result size: ${result.size}`,
        {
          field: node.field,
          resultSize: result.size,
        }
      );

      return result;
    },
  };
}
