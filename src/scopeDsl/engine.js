/**
 * @file Scope-DSL Engine
 * @description AST walker/query engine that resolves Scope-DSL expressions to sets of entity IDs
 */

import ScopeDepthError from '../errors/scopeDepthError.js';
import ScopeCycleError from '../errors/scopeCycleError.js';
import { IScopeEngine } from '../interfaces/IScopeEngine.js';

/**
 * @typedef {object} RuntimeContext
 * @property {import('../interfaces/IEntityManager.js').IEntityManager} entityManager
 * @property {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} spatialIndexManager
 * @property {import('../logic/jsonLogicEvaluationService.js').default} jsonLogicEval
 * @property {import('../interfaces/coreServices.js').ILogger} logger
 */

/**
 * @typedef {object} AST
 * @property {string} type - Node type
 * @property {object} [parent] - Parent node
 * @property {string} [field] - Field name for Step nodes
 * @property {boolean} [isArray] - Whether this is an array iteration
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
   * @returns {Set<string>} Set of entity IDs
   * @throws {ScopeDepthError} When expression depth exceeds maxDepth
   * @throws {ScopeCycleError} When a cycle is detected
   */
  resolve(ast, actorEntity, runtimeCtx) {
    return this.resolveNode(ast, actorEntity, runtimeCtx, 0, []);
  }

  /**
   * Recursively resolves a node in the AST
   *
   * @param {AST} node - The AST node to resolve
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth level
   * @param {Array<string>} path - Path of visited node/edge keys
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  resolveNode(node, actorEntity, runtimeCtx, depth, path) {
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
        return this.resolveSource(node, actorEntity, runtimeCtx);
      case 'Step':
        return this.resolveStep(node, actorEntity, runtimeCtx, depth, nextPath);
      case 'Filter':
        return this.resolveFilter(
          node,
          actorEntity,
          runtimeCtx,
          depth,
          nextPath
        );
      case 'Union':
        return this.resolveUnion(
          node,
          actorEntity,
          runtimeCtx,
          depth,
          nextPath
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
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  resolveSource(node, actorEntity, runtimeCtx) {
    switch (node.kind) {
      case 'actor':
        return new Set([actorEntity.id]);

      case 'location':
        // Use the current location from runtime context
        if (runtimeCtx.location && runtimeCtx.location.id) {
          return new Set([runtimeCtx.location.id]);
        }
        return new Set();

      case 'entities':
        const componentId = node.param;
        if (!componentId) {
          runtimeCtx.logger.error(
            'entities() source node missing component ID'
          );
          return new Set();
        }

        if (componentId.startsWith('!')) {
          // Optimized negative component query - single-pass approach
          const componentName = componentId.slice(1);
          const results = new Set();
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
              results.add(entity.id);
            }
          }
          return results;
        } else {
          // Positive component query - entities WITH the component
          const entities =
            runtimeCtx.entityManager.getEntitiesWithComponent(componentId);
          return new Set(
            entities.map((e) => e.id).filter((id) => typeof id === 'string')
          );
        }

      default:
        runtimeCtx.logger.error(`Unknown source kind: ${node.kind}`);
        return new Set();
    }
  }

  /**
   * Resolves a Step node (field access or array iteration)
   *
   * @param {AST} node - Step node
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @param {number} depth - Current depth
   * @param {Array<string>} path - Path of visited node/edge keys
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  resolveStep(node, actorEntity, runtimeCtx, depth, path) {
    const nextDepth = depth + 1;
    const parentResult = this.resolveNode(
      node.parent,
      actorEntity,
      runtimeCtx,
      nextDepth,
      path
    );

    if (parentResult.size === 0) return new Set();

    // Handle the special case for entities()[] pattern
    if (this._isPassThroughArrayIteration(node)) {
      return parentResult;
    }

    // Process field access or array iteration
    return this._processFieldAccess(node, parentResult, runtimeCtx);
  }

  /**
   * Checks if this is a pass-through array iteration (entities()[] case)
   *
   * @param {AST} node - Step node
   * @returns {boolean} True if this is a pass-through case
   * @private
   */
  _isPassThroughArrayIteration(node) {
    return node.isArray && node.field === null;
  }

  /**
   * Processes field access for each item in the parent result set
   *
   * @param {AST} node - Step node
   * @param {Set} parentResult - Parent result set
   * @param {RuntimeContext} runtimeCtx - Runtime context
   * @returns {Set<string>} Set of resolved values
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

      if (node.isArray) {
        this._addArrayItems(current, result);
      } else {
        result.add(current);
      }
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
      // Parent value is an entity ID, get component data
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
   * @returns {Set<string>} Set of entity IDs or objects
   * @private
   */
  resolveFilter(node, actorEntity, runtimeCtx, depth, path) {
    const parentResult = this.resolveNode(
      node.parent,
      actorEntity,
      runtimeCtx,
      depth + 1,
      path
    );
    if (parentResult.size === 0) return new Set();

    const result = new Set();
    for (const item of parentResult) {
      // If the item is an array, iterate over its elements for filtering
      if (Array.isArray(item)) {
        for (const arrayElement of item) {
          if (
            this._filterSingleItem(
              arrayElement,
              node.logic,
              actorEntity,
              runtimeCtx
            )
          ) {
            result.add(arrayElement);
          }
        }
      } else {
        // Handle single items (entity IDs or objects)
        if (this._filterSingleItem(item, node.logic, actorEntity, runtimeCtx)) {
          result.add(item);
        }
      }
    }
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
      entity = entity || { id: item };
    } else if (item && typeof item === 'object') {
      // Item is already an object (e.g., exit object from component data)
      entity = item;
    } else {
      // Skip invalid items
      return false;
    }

    const context = {
      entity: entity,
      actor: actorEntity, // Use the full actor entity
      location: runtimeCtx.location || { id: 'unknown' },
    };

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
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  resolveUnion(node, actorEntity, runtimeCtx, depth, path) {
    const leftResult = this.resolveNode(
      node.left,
      actorEntity,
      runtimeCtx,
      depth,
      path
    );
    const rightResult = this.resolveNode(
      node.right,
      actorEntity,
      runtimeCtx,
      depth,
      path
    );
    return new Set([...leftResult, ...rightResult]);
  }
}

export default ScopeEngine;
