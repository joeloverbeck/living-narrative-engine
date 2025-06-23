/**
 * @file Scope-DSL Engine
 * @description AST walker/query engine that resolves Scope-DSL expressions to sets of entity IDs
 */

import ScopeDepthError from '../errors/scopeDepthError.js';
import ScopeCycleError from '../errors/scopeCycleError.js';

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
 */
class ScopeEngine {
  constructor() {
    this.maxDepth = 4;
  }

  setMaxDepth(n) {
    this.maxDepth = n;
  }

  /**
   * Resolves a Scope-DSL AST to a set of entity IDs
   * * @param {AST} ast - The parsed AST
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
   * * @param {AST} node - The AST node to resolve
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
   * * @param {AST} node - Source node
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
          // Negative component query - entities WITHOUT the component
          const componentName = componentId.slice(1);
          const entitiesWithComponent =
            runtimeCtx.entityManager.getEntitiesWithComponent(componentName);
          const allEntities = Array.from(
            runtimeCtx.entityManager.entities.values()
          );

          const entityIdsWithComponent = new Set(
            entitiesWithComponent.map((e) => e.id)
          );
          const entityIdsWithoutComponent = allEntities
            .filter((e) => !entityIdsWithComponent.has(e.id))
            .map((e) => e.id);

          return new Set(entityIdsWithoutComponent);
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
   * * @param {AST} node - Step node
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

    // FIX: This block handles the `entities(...)[]` case. The parser creates a step
    // with `field: null` which the original logic could not handle.
    if (node.isArray && node.field === null) {
      // The parentResult is already the set of items (entity IDs) to be returned.
      // We just pass it through.
      return parentResult;
    }

    const result = new Set();
    for (const parentValue of parentResult) {
      let current;
      if (typeof parentValue === 'string') {
        current = runtimeCtx.entityManager.getComponentData(
          parentValue,
          node.field
        );
      } else if (parentValue && typeof parentValue === 'object') {
        if (node.field in parentValue) {
          current = parentValue[node.field];
        } else {
          continue;
        }
      } else {
        continue;
      }

      if (node.isArray) {
        if (Array.isArray(current)) {
          for (const item of current) {
            if (item !== null && item !== undefined) result.add(item);
          }
        }
      } else {
        if (current !== null && current !== undefined) result.add(current);
      }
    }
    return result;
  }

  /**
   * Resolves a Filter node (JSON Logic evaluation)
   * * @param {AST} node - Filter node
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
      try {
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
          continue;
        }

        const context = {
          entity: entity,
          actor: actorEntity, // Use the full actor entity
          location: runtimeCtx.location || { id: 'unknown' },
        };

        const filterResult = runtimeCtx.jsonLogicEval.evaluate(
          node.logic,
          context
        );
        if (filterResult) {
          result.add(item); // Add the original item (ID or object)
        }
      } catch (error) {
        runtimeCtx.logger.error(
          `Error evaluating filter for entity/object ${typeof item === 'string' ? item : JSON.stringify(item)}:`,
          error
        );
      }
    }
    return result;
  }

  /**
   * Resolves a Union node (A + B)
   * * @param {AST} node - Union node
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
