// src/scopeDsl/engine.js

/**
 * @file Scope-DSL Engine
 * @description AST walker/query engine that resolves Scope-DSL expressions to sets of entity IDs
 */

import ScopeDepthError from '../errors/scopeDepthError.js';
import ScopeCycleError from '../errors/scopeCycleError.js';
import { IScopeEngine } from '../interfaces/IScopeEngine.js';

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEval
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../actions/tracing/traceContext.js').TraceContext} TraceContext
 */

/**
 * @typedef {object} RuntimeContext
 * @property {IEntityManager} entityManager
 * @property {ISpatialIndexManager} spatialIndexManager
 * @property {JsonLogicEval} jsonLogicEval
 * @property {ILogger} logger
 */

/**
 * @typedef {object} AST
 * @property {string} type - Node type
 * @property {object} [parent] - Parent node
 * @property {string} [field] - Field name for Step nodes
 * @property {object} [logic] - JSON Logic object for Filter nodes
 * @property {object} [left] - Left expression for Union nodes
 * @property {object} [right] - Right expression for Union nodes
 * @property {string} [kind] - Source kind for Source nodes
 * @property {string} [param] - Parameter for Source nodes
 */

/**
 * Scope-DSL Engine that resolves AST expressions to sets of entity IDs
 *
 * @implements {IScopeEngine}
 */
class ScopeEngine extends IScopeEngine {
  constructor() {
    super(); // Call parent constructor
    this.maxDepth = 4;
  }

  setMaxDepth(n) {
    this.maxDepth = n;
  }

  /**
   * Resolves a Scope-DSL AST to a set of entity IDs
   *
   * @param {AST} ast - The parsed AST
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context with services
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<string>} Set of entity IDs
   * @throws {ScopeDepthError} When expression depth exceeds maxDepth
   * @throws {ScopeCycleError} When a cycle is detected
   */
  resolve(ast, actorEntity, runtimeCtx, trace = null) {
    const source = 'ScopeEngine';
    trace?.addLog('step', 'Starting scope resolution.', source, { ast });

    const result = this.resolveNode(ast, actorEntity, runtimeCtx, 0, [], trace);

    const finalTargets = Array.from(result);
    trace?.addLog(
      'success',
      `Scope resolution finished. Found ${result.size} target(s).`,
      source,
      { targets: finalTargets }
    );
    return result;
  }

  /**
   * Recursively resolves a node in the AST
   *
   * @param {AST} node - The AST node to resolve
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth level
   * @param {Array<string>} path - Path of visited node/edge keys
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<any>} Set of entity IDs or resolved objects
   * @private
   */
  resolveNode(node, actorEntity, runtimeCtx, depth, path, trace = null) {
    if (depth > this.maxDepth) {
      throw new ScopeDepthError(
        `Expression depth limit exceeded (max ${this.maxDepth})`,
        depth,
        this.maxDepth
      );
    }
    // Cycle detection: use node type, field, and param as key
    const nodeKey = `${node.type}:${node.field || ''}:${node.param || ''}`;
    if (path.includes(nodeKey)) {
      const cyclePath = [...path, nodeKey];
      throw new ScopeCycleError(
        `Scope cycle detected: ${cyclePath.join(' -> ')}`,
        cyclePath
      );
    }
    const nextPath = [...path, nodeKey];
    switch (node.type) {
      case 'Source':
        return this.resolveSource(node, actorEntity, runtimeCtx, trace);
      case 'Step':
        return this.resolveStep(
          node,
          actorEntity,
          runtimeCtx,
          depth,
          nextPath,
          trace
        );
      case 'Filter':
        return this.resolveFilter(
          node,
          actorEntity,
          runtimeCtx,
          depth,
          nextPath,
          trace
        );
      case 'Union':
        return this.resolveUnion(
          node,
          actorEntity,
          runtimeCtx,
          depth,
          nextPath,
          trace
        );
      case 'ArrayIterationStep':
        return this.resolveArrayIterationStep(
          node,
          actorEntity,
          runtimeCtx,
          depth,
          nextPath,
          trace
        );
      default:
        runtimeCtx.logger.error(`Unknown AST node type: ${node.type}`);
        return new Set();
    }
  }

  /**
   * Resolves a Source node
   *
   * @param {AST} node - Source node
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  resolveSource(node, actorEntity, runtimeCtx, trace = null) {
    let result = new Set();
    switch (node.kind) {
      case 'actor':
        result = new Set([actorEntity.id]);
        break;

      case 'location':
        // Use the current location from runtime context
        if (runtimeCtx.location && runtimeCtx.location.id) {
          result = new Set([runtimeCtx.location.id]);
        }
        break;

      case 'entities':
        const componentId = node.param;
        if (!componentId) {
          runtimeCtx.logger.error(
            'entities() source node missing component ID'
          );
          result = new Set();
          break;
        }

        if (componentId.startsWith('!')) {
          // Optimized negative component query - single-pass approach
          const componentName = componentId.slice(1);
          const resultSet = new Set();
          // Assumes entityManager can provide all entities efficiently
          const allEntities = runtimeCtx.entityManager.getEntities
            ? runtimeCtx.entityManager.getEntities()
            : Array.from(runtimeCtx.entityManager.entities.values());

          for (const entity of allEntities) {
            // Check if entity has the component using hasComponent method if available,
            // otherwise fall back to checking the components property
            const hasComponent = runtimeCtx.entityManager.hasComponent
              ? runtimeCtx.entityManager.hasComponent(entity.id, componentName)
              : entity.components && entity.components[componentName];

            if (!hasComponent) {
              resultSet.add(entity.id);
            }
          }
          result = resultSet;
        } else {
          // Positive component query - entities WITH the component
          const entities =
            runtimeCtx.entityManager.getEntitiesWithComponent(componentId);
          result = new Set(
            entities.map((e) => e.id).filter((id) => typeof id === 'string')
          );

          // Enhanced debugging for component queries
          runtimeCtx.logger.debug(
            `entities(${componentId}) source found ${entities.length} entities: [${entities.map((e) => e.id).join(', ')}]`
          );
          runtimeCtx.logger.debug(
            `entities(${componentId}) result set: [${Array.from(result).join(', ')}]`
          );
        }
        break;

      default:
        runtimeCtx.logger.error(`Unknown source kind: ${node.kind}`);
        result = new Set();
    }

    const source = 'ScopeEngine.resolveSource';
    trace?.addLog(
      'info',
      `Resolved source '${node.kind}'. Found ${result.size} item(s).`,
      source,
      {
        kind: node.kind,
        param: node.param,
        result: Array.from(result),
      }
    );
    return result;
  }

  /**
   * Resolves a Step node (field access or array iteration)
   *
   * @param {AST} node - Step node
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth
   * @param {Array<string>} path - Path of visited node/edge keys
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<any>} Set of entity IDs or resolved objects
   * @private
   */
  resolveStep(node, actorEntity, runtimeCtx, depth, path, trace = null) {
    const nextDepth = depth + 1;
    const parentResult = this.resolveNode(
      node.parent,
      actorEntity,
      runtimeCtx,
      nextDepth,
      path,
      trace // Pass trace down
    );

    if (parentResult.size === 0) return new Set();

    // Process field access or array iteration
    return this._processFieldAccess(node, parentResult, runtimeCtx);
  }

  /**
   * Resolves an ArrayIterationStep node
   *
   * @param {AST} node - ArrayIterationStep node
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth
   * @param {Array<string>} path - Path of visited node/edge keys
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<any>} Set of entity IDs or objects
   * @private
   */
  resolveArrayIterationStep(
    node,
    actorEntity,
    runtimeCtx,
    depth,
    path,
    trace = null
  ) {
    const parentResult = this.resolveNode(
      node.parent,
      actorEntity,
      runtimeCtx,
      depth,
      path,
      trace
    );

    const result = new Set();

    // Flatten arrays from parent result
    for (const parentValue of parentResult) {
      if (Array.isArray(parentValue)) {
        for (const item of parentValue) {
          if (item !== null && item !== undefined) {
            result.add(item);
          }
        }
      } else if (node.parent.type === 'Source') {
        // Pass through for entities()[] case where Source returns entity IDs
        if (parentValue !== null && parentValue !== undefined) {
          result.add(parentValue);
        }
      }
      // For other cases (like Step nodes), non-arrays result in empty set
    }

    return result;
  }

  /**
   * Processes field access for each item in the parent result set
   *
   * @param {AST} node - Step node
   * @param {Set} parentResult - Parent result set
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @returns {Set<any>} Set of resolved values
   * @private
   */
  _processFieldAccess(node, parentResult, runtimeCtx) {
    const result = new Set();

    for (const parentValue of parentResult) {
      const current = this._extractFieldValue(
        parentValue,
        node.field,
        runtimeCtx
      );

      if (current === null || current === undefined) {
        continue;
      }

      result.add(current);
    }

    return result;
  }

  /**
   * Extracts field value from a parent value (entity ID or object)
   *
   * @param {string|object} parentValue - Parent value to extract from
   * @param {string} fieldName - Field name to extract
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @returns {*} Extracted field value
   * @private
   */
  _extractFieldValue(parentValue, fieldName, runtimeCtx) {
    if (typeof parentValue === 'string') {
      // Parent value is an entity ID

      // Special handling for 'components' field to build components object
      if (fieldName === 'components') {
        // Try to get the entity instance
        const entity = runtimeCtx.entityManager.getEntity
          ? runtimeCtx.entityManager.getEntity(parentValue)
          : runtimeCtx.entityManager.getEntityInstance(parentValue);

        if (!entity) return null;

        // Check if this is a test entity (SimpleEntityManager) with plain components object
        if (
          entity.components &&
          typeof entity.components === 'object' &&
          !entity.componentTypeIds &&
          !entity.getComponentData
        ) {
          return entity.components;
        }

        // For production Entity objects, always build the components object
        // This is necessary because the Entity.components property might be a Proxy
        const components = {};

        // If entity has componentTypeIds, use that (production Entity)
        if (entity.componentTypeIds && Array.isArray(entity.componentTypeIds)) {
          for (const componentTypeId of entity.componentTypeIds) {
            const componentData = entity.getComponentData(componentTypeId);
            if (componentData) {
              components[componentTypeId] = componentData;
            }
          }
        }
        // Otherwise try to get all components through entityManager
        else {
          // Try to get component data through entity manager
          // This is a fallback for entities that don't expose componentTypeIds
          const commonComponentIds = [
            'core:name',
            'core:position',
            'core:actor',
            'core:movement',
            'intimacy:closeness',
            'core:perception_log',
            'core:short_term_memory',
          ];
          for (const componentId of commonComponentIds) {
            try {
              const data = runtimeCtx.entityManager.getComponentData(
                parentValue,
                componentId
              );
              if (data) {
                components[componentId] = data;
              }
            } catch (e) {
              // Ignore errors for missing components
            }
          }
        }

        return components;
      }

      // Normal component data access
      return runtimeCtx.entityManager.getComponentData(parentValue, fieldName);
    } else if (parentValue && typeof parentValue === 'object') {
      // Parent value is an object, access property directly
      return parentValue[fieldName];
    }
    return null;
  }

  /**
   * Adds array items to the result set
   *
   * @param {*} arrayValue - Value that should be an array
   * @param {Set} result - Result set to add items to
   * @private
   */
  _addArrayItems(arrayValue, result) {
    if (Array.isArray(arrayValue)) {
      for (const item of arrayValue) {
        if (item !== null && item !== undefined) {
          result.add(item);
        }
      }
    }
  }

  /**
   * Resolves a Filter node (JSON Logic evaluation)
   * Adopts fail-fast approach - exceptions propagate instead of being swallowed
   *
   * @param {AST} node - Filter node
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth
   * @param {Array<string>} path - Path of visited node/edge keys
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<any>} Set of entity IDs or objects
   * @private
   */
  resolveFilter(node, actorEntity, runtimeCtx, depth, path, trace = null) {
    const parentResult = this.resolveNode(
      node.parent,
      actorEntity,
      runtimeCtx,
      depth + 1,
      path,
      trace // Pass trace down
    );

    const source = 'ScopeEngine.resolveFilter';
    const initialSize = parentResult.size;
    trace?.addLog('info', `Applying filter to ${initialSize} items.`, source, {
      logic: node.logic,
    });

    if (initialSize === 0) return new Set();

    const result = new Set();
    for (const item of parentResult) {
      // If the item is an array, iterate over its elements for filtering
      if (Array.isArray(item)) {
        for (const arrayElement of item) {
          const passed = this._filterSingleItem(
            arrayElement,
            node.logic,
            actorEntity,
            runtimeCtx
          );
          runtimeCtx.logger.debug(
            `Filter test for array element ${arrayElement}: ${passed ? 'PASS' : 'FAIL'}`
          );
          if (passed) {
            result.add(arrayElement);
          }
        }
      } else {
        // Handle single items (entity IDs or objects)
        const passed = this._filterSingleItem(
          item,
          node.logic,
          actorEntity,
          runtimeCtx
        );
        runtimeCtx.logger.debug(
          `Filter test for item ${item}: ${passed ? 'PASS' : 'FAIL'}`
        );
        if (passed) {
          result.add(item);
        }
      }
    }
    trace?.addLog(
      'info',
      `Filter application complete. ${result.size} of ${initialSize} items passed.`,
      source
    );
    return result;
  }

  /**
   * Applies JSON Logic filter to a single item
   *
   * @param {*} item - Item to filter (entity ID, object, etc.)
   * @param {object} logic - JSON Logic expression
   * @param {object} actorEntity - The acting entity instance
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @returns {boolean} True if the item passes the filter
   * @private
   */
  _filterSingleItem(item, logic, actorEntity, runtimeCtx) {
    let entity;

    if (typeof item === 'string') {
      // Item is an entity ID, get the entity instance
      entity = runtimeCtx.entityManager.getEntityInstance(item);

      // Debug logging to see what the entity looks like
      runtimeCtx.logger.debug(`Retrieved entity instance for ${item}:`);
      runtimeCtx.logger.debug(`  - Entity exists: ${!!entity}`);
      runtimeCtx.logger.debug(`  - Entity ID: ${entity?.id}`);
      runtimeCtx.logger.debug(
        `  - Entity componentTypeIds: [${entity?.componentTypeIds?.join(', ') || 'none'}]`
      );

      entity = entity || { id: item };

      // Create components object for JsonLogic access if entity exists
      if (entity && entity.componentTypeIds) {
        const components = {};
        for (const componentTypeId of entity.componentTypeIds) {
          const componentData = entity.getComponentData(componentTypeId);
          if (componentData) {
            components[componentTypeId] = componentData;
          }
        }
        // Add components property to entity for JsonLogic access
        entity.components = components;
        runtimeCtx.logger.debug(
          `  - Components object created with keys: [${Object.keys(components).join(', ')}]`
        );
        runtimeCtx.logger.debug(
          `  - Position component: ${JSON.stringify(components['core:position'] || 'missing')}`
        );
      }
    } else if (item && typeof item === 'object') {
      // Item is already an object (e.g., exit object from component data)
      entity = item;
    } else {
      // Skip invalid items
      return false;
    }

    // Ensure actor also has components property for JsonLogic access
    if (
      actorEntity &&
      actorEntity.componentTypeIds &&
      !actorEntity.components
    ) {
      const actorComponents = {};
      for (const componentTypeId of actorEntity.componentTypeIds) {
        const componentData = actorEntity.getComponentData(componentTypeId);
        if (componentData) {
          actorComponents[componentTypeId] = componentData;
        }
      }
      actorEntity.components = actorComponents;
    }

    const context = {
      entity: entity,
      actor: actorEntity, // Use the full actor entity
      location: runtimeCtx.location || { id: 'unknown' },
    };

    // Debug logging for filter evaluation
    runtimeCtx.logger.debug(
      `Evaluating filter for entity ${entity.id}: logic=${JSON.stringify(logic)}`
    );
    runtimeCtx.logger.debug(
      `Filter context: entity.id=${entity.id}, actor.id=${actorEntity.id}, location.id=${context.location.id}`
    );

    // If this throws, it will now halt resolution, which is desired for fail-fast approach
    return runtimeCtx.jsonLogicEval.evaluate(logic, context);
  }

  /**
   * Resolves a Union node (A + B)
   *
   * @param {AST} node - Union node
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth
   * @param {Array<string>} path - Path of visited node/edge keys
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<any>} Set of entity IDs or resolved objects
   * @private
   */
  resolveUnion(node, actorEntity, runtimeCtx, depth, path, trace = null) {
    const leftResult = this.resolveNode(
      node.left,
      actorEntity,
      runtimeCtx,
      depth,
      path,
      trace // Pass trace down
    );
    const rightResult = this.resolveNode(
      node.right,
      actorEntity,
      runtimeCtx,
      depth,
      path,
      trace // Pass trace down
    );
    return new Set([...leftResult, ...rightResult]);
  }
}

export default ScopeEngine;
