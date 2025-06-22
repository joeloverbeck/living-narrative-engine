/**
 * @fileoverview Scope-DSL Engine
 * @description AST walker/query engine that resolves Scope-DSL expressions to sets of entity IDs
 */

import ScopeDepthError from '../errors/scopeDepthError.js';

/**
 * @typedef {Object} RuntimeContext
 * @property {import('../interfaces/IEntityManager.js').IEntityManager} entityManager
 * @property {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} spatialIndexManager
 * @property {import('../logic/jsonLogicEvaluationService.js').default} jsonLogicEval
 * @property {import('../interfaces/coreServices.js').ILogger} logger
 */

/**
 * @typedef {Object} AST
 * @property {string} type - Node type
 * @property {Object} [parent] - Parent node
 * @property {string} [field] - Field name for Step nodes
 * @property {boolean} [isArray] - Whether this is an array iteration
 * @property {Object} [logic] - JSON Logic object for Filter nodes
 * @property {Object} [left] - Left expression for Union nodes
 * @property {Object} [right] - Right expression for Union nodes
 * @property {string} [kind] - Source kind for Source nodes
 * @property {string} [param] - Parameter for Source nodes
 */

/**
 * Scope-DSL Engine that resolves AST expressions to sets of entity IDs
 */
class ScopeEngine {
    /**
     * Resolves a Scope-DSL AST to a set of entity IDs
     * 
     * @param {AST} ast - The parsed AST
     * @param {string} actorId - The ID of the acting entity
     * @param {RuntimeContext} runtimeCtx - Runtime context with services
     * @returns {Set<string>} Set of entity IDs
     * @throws {ScopeDepthError} When expression depth exceeds 4
     */
    resolve(ast, actorId, runtimeCtx) {
        return this.resolveNode(ast, actorId, runtimeCtx, 0);
    }

    /**
     * Recursively resolves a node in the AST
     * 
     * @param {AST} node - The AST node to resolve
     * @param {string} actorId - The ID of the acting entity
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @param {number} depth - Current depth level
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveNode(node, actorId, runtimeCtx, depth) {
        if (depth > 4) {
            throw new ScopeDepthError(
                'Expression depth limit exceeded (max 4)',
                depth,
                4
            );
        }

        switch (node.type) {
            case 'Source': return this.resolveSource(node, actorId, runtimeCtx);
            case 'Step': return this.resolveStep(node, actorId, runtimeCtx, depth);
            case 'Filter': return this.resolveFilter(node, actorId, runtimeCtx, depth);
            case 'Union': return this.resolveUnion(node, actorId, runtimeCtx, depth);
            default:
                runtimeCtx.logger.error(`Unknown AST node type: ${node.type}`);
                return new Set();
        }
    }

    /**
     * Resolves a Source node
     * 
     * @param {AST} node - Source node
     * @param {string} actorId - Actor ID
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveSource(node, actorId, runtimeCtx) {
        switch (node.kind) {
            case 'actor':
                return new Set([actorId]);

            case 'location':
                const targetId = node.param || actorId;
                const locationData = runtimeCtx.entityManager.getComponentData(targetId, 'core:location');

                if (!locationData || !locationData.locationId) {
                    return new Set();
                }

                return runtimeCtx.entityManager.getEntitiesInLocation(locationData.locationId);

            case 'entities':
                const componentId = node.param;
                if (!componentId) {
                    runtimeCtx.logger.error('entities() source node missing component ID');
                    return new Set();
                }

                if (componentId.startsWith('!')) {
                    // Negative component query - entities WITHOUT the component
                    const componentName = componentId.slice(1);
                    const entitiesWithComponent = runtimeCtx.entityManager.getEntitiesWithComponent(componentName);
                    const allEntities = Array.from(runtimeCtx.entityManager.entities);

                    const entityIdsWithComponent = new Set(entitiesWithComponent.map(e => e.id));
                    const entityIdsWithoutComponent = allEntities
                        .filter(e => !entityIdsWithComponent.has(e.id))
                        .map(e => e.id);

                    return new Set(entityIdsWithoutComponent);
                } else {
                    // Positive component query - entities WITH the component
                    const entities = runtimeCtx.entityManager.getEntitiesWithComponent(componentId);
                    return new Set(entities.map(e => e.id));
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
     * @param {string} actorId - Actor ID
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @param {number} depth - Current depth
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveStep(node, actorId, runtimeCtx, depth) {
        // depth accounting: +1 for the step itself, +1 more if it is an array-iteration ([]) 
        const nextDepth = depth + 1 + (node.isArray ? 1 : 0);
        const parentResult = this.resolveNode(node.parent, actorId, runtimeCtx, nextDepth);

        if (parentResult.size === 0) return new Set();

        // Special case: array iteration after entities() or entities(!...)
        if (node.field === null && node.isArray === true && node.parent && node.parent.type === 'Source' && node.parent.kind === 'entities') {
            // parentResult is already the set of entity IDs
            return new Set(parentResult);
        }

        /* Special case: `.entities(componentId)` filter-step  */
        if (node.field === 'entities' && node.param) {
            const negate = node.param.startsWith('!');
            const compName = negate ? node.param.slice(1) : node.param;
            const filtered = new Set();

            for (const entId of parentResult) {
                const hasComp = runtimeCtx.entityManager.getComponentData(entId, compName) != null;
                if ((hasComp && !negate) || (!hasComp && negate)) {
                    filtered.add(entId);
                }
            }
            return filtered;
        }

        /* ───── default field / array handling (unchanged logic) ───── */

        const result = new Set();

        for (const entityId of parentResult) {
            let current;

            if (node.field) {
                /* component / property lookup (existing logic) */
                const componentData = runtimeCtx.entityManager.getComponentData(entityId, `core:${node.field}`);
                if (componentData && typeof componentData === 'object' && !Array.isArray(componentData)) {
                    current = componentData;
                } else {
                    const inventoryData = runtimeCtx.entityManager.getComponentData(entityId, 'core:inventory');
                    if (inventoryData && node.field === 'items' && inventoryData.items) {
                        current = inventoryData.items;
                    } else {
                        continue;
                    }
                }
            } else {
                current = entityId; // bare [] case
            }

            if (node.isArray) {
                if (Array.isArray(current)) {
                    for (const item of current) if (typeof item === 'string') result.add(item);
                }
            } else {
                if (typeof current === 'string') result.add(current);
                else result.add(entityId);
            }
        }

        return result;
    }


    /**
     * Resolves a Filter node (JSON Logic evaluation)
     * 
     * @param {AST} node - Filter node
     * @param {string} actorId - Actor ID
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @param {number} depth - Current depth
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveFilter(node, actorId, runtimeCtx, depth) {
        const parentResult = this.resolveNode(node.parent, actorId, runtimeCtx, depth + 1);
        if (parentResult.size === 0) {
            return new Set();
        }
        const result = new Set();
        for (const entityId of parentResult) {
            try {
                const entity = runtimeCtx.entityManager.getEntityInstance(entityId);
                const context = {
                    entity: entity || { id: entityId },
                    actor: { id: actorId }
                };
                const filterResult = runtimeCtx.jsonLogicEval.evaluate(node.logic, context);
                if (filterResult) {
                    result.add(entityId);
                }
            } catch (error) {
                if (runtimeCtx && runtimeCtx.logger && typeof runtimeCtx.logger.error === 'function') {
                    runtimeCtx.logger.error(`Error evaluating filter for entity ${entityId}:`, error);
                }
            }
        }
        return result;
    }

    /**
     * Resolves a Union node (A + B)
     * 
     * @param {AST} node - Union node
     * @param {string} actorId - Actor ID
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @param {number} depth - Current depth
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveUnion(node, actorId, runtimeCtx, depth) {
        const leftResult = this.resolveNode(node.left, actorId, runtimeCtx, depth);
        const rightResult = this.resolveNode(node.right, actorId, runtimeCtx, depth);

        return new Set([...leftResult, ...rightResult]);
    }

    /**
     * Gets component data for a field path
     * 
     * @param {string} entityId - Entity ID
     * @param {string} fieldPath - Field path (e.g., "inventory.items")
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @returns {any} Component data
     * @private
     */
    getComponentDataForField(entityId, fieldPath, runtimeCtx) {
        if (!fieldPath) {
            return null;
        }

        const parts = fieldPath.split('.');
        const componentName = parts[0];
        const componentData = runtimeCtx.entityManager.getComponentData(entityId, `core:${componentName}`);

        if (!componentData) {
            return null;
        }

        // Navigate through nested fields
        let current = componentData;
        for (let i = 1; i < parts.length; i++) {
            if (current && typeof current === 'object' && parts[i] in current) {
                current = current[parts[i]];
            } else {
                return null;
            }
        }

        return current;
    }
}

export default ScopeEngine; 