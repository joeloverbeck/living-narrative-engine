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
     * 
     * @param {AST} ast - The parsed AST
     * @param {string} actorId - The ID of the acting entity
     * @param {RuntimeContext} runtimeCtx - Runtime context with services
     * @returns {Set<string>} Set of entity IDs
     * @throws {ScopeDepthError} When expression depth exceeds maxDepth
     * @throws {ScopeCycleError} When a cycle is detected
     */
    resolve(ast, actorId, runtimeCtx) {
        return this.resolveNode(ast, actorId, runtimeCtx, 0, []);
    }

    /**
     * Recursively resolves a node in the AST
     * 
     * @param {AST} node - The AST node to resolve
     * @param {string} actorId - The ID of the acting entity
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @param {number} depth - Current depth level
     * @param {Array<string>} path - Path of visited node/edge keys
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveNode(node, actorId, runtimeCtx, depth, path) {
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
            case 'Source': return this.resolveSource(node, actorId, runtimeCtx);
            case 'Step': return this.resolveStep(node, actorId, runtimeCtx, depth, nextPath);
            case 'Filter': return this.resolveFilter(node, actorId, runtimeCtx, depth, nextPath);
            case 'Union': return this.resolveUnion(node, actorId, runtimeCtx, depth, nextPath);
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
                // Use the current location from runtime context
                if (runtimeCtx.location && runtimeCtx.location.id) {
                    return new Set([runtimeCtx.location.id]);
                }
                return new Set();

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
                    return new Set(entities.map(e => e.id).filter(id => typeof id === 'string'));
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
     * @param {Array<string>} path - Path of visited node/edge keys
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveStep(node, actorId, runtimeCtx, depth, path) {
        // depth accounting: +1 for the step itself, +1 more if it is an array-iteration ([]) 
        const nextDepth = depth + 1 + (node.isArray ? 1 : 0);
        const parentResult = this.resolveNode(node.parent, actorId, runtimeCtx, nextDepth, path);

        runtimeCtx.logger.debug('[ScopeEngine] resolveStep: current node field:', node.field, 'isArray:', node.isArray, 'node:', node);

        if (parentResult.size === 0) return new Set();

        // Special case: array iteration after entities() or entities(!...)
        if (node.field === null && node.isArray === true && node.parent && node.parent.type === 'Source' && node.parent.kind === 'entities') {
            // The entities source already returns a set of string IDs, so just return it as-is
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

        /* ───── default field / array handling (improved logic) ───── */

        const result = new Set();

        // Chain the parent result through each step
        for (const parentValue of parentResult) {
            runtimeCtx.logger.debug('[ScopeEngine] resolveStep: entityOrObj:', parentValue, 'type:', typeof parentValue);
            let current;

            // If parent is Source, treat as component lookup; otherwise, property access
            if (node.parent.type === 'Source') {
                // Component lookup
                const componentData = runtimeCtx.entityManager.getComponentData(parentValue, node.field);
                runtimeCtx.logger.debug('[ScopeEngine] resolveStep: componentData for field', node.field, ':', componentData);
                if (componentData && typeof componentData === 'object') {
                    current = componentData;
                } else {
                    // ... legacy inventory/items fallback ...
                    const inventoryData = runtimeCtx.entityManager.getComponentData(parentValue, 'core:inventory');
                    if (inventoryData && node.field === 'items' && inventoryData.items) {
                        current = inventoryData.items;
                    } else {
                        continue;
                    }
                }
            } else {
                // Property access on previous result
                if (parentValue && typeof parentValue === 'object' && node.field in parentValue) {
                    current = parentValue[node.field];
                    runtimeCtx.logger.debug('[ScopeEngine] resolveStep: property access', node.field, ':', current);
                } else {
                    runtimeCtx.logger.debug('[ScopeEngine] resolveStep: property', node.field, 'not found in', parentValue);
                    continue;
                }
            }

            if (node.isArray) {
                runtimeCtx.logger.debug('[ScopeEngine] resolveStep: isArray, current:', current, 'type:', typeof current);
                if (Array.isArray(current)) {
                    for (const item of current) {
                        runtimeCtx.logger.debug('[ScopeEngine] resolveStep: array item:', item, 'type:', typeof item);
                        if (typeof item === 'string') {
                            result.add(item);
                        }
                    }
                } else if (typeof current === 'object' && current !== null) {
                    // Handle object field access for array iteration
                    // This is for cases like actor.core:inventory.items[] where current is the inventory object
                    if (node.field && current[node.field] !== undefined) {
                        const fieldValue = current[node.field];
                        if (Array.isArray(fieldValue)) {
                            for (const item of fieldValue) {
                                runtimeCtx.logger.debug('[ScopeEngine] resolveStep: array item from object field:', item, 'type:', typeof item);
                                if (typeof item === 'string') {
                                    result.add(item);
                                }
                            }
                        }
                    }
                }
            } else {
                runtimeCtx.logger.debug('[ScopeEngine] resolveStep: not isArray, current:', current, 'type:', typeof current);
                if (typeof current === 'string') {
                    result.add(current);
                } else if (typeof current === 'object' && current !== null) {
                    // For objects, we need to handle field access
                    if (node.field && current[node.field] !== undefined) {
                        // Handle object field access (e.g., exit.target)
                        const fieldValue = current[node.field];
                        if (typeof fieldValue === 'string') {
                            result.add(fieldValue);
                        }
                    }
                    // Don't add objects to the result - the engine only works with strings
                }
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
     * @param {Array<string>} path - Path of visited node/edge keys
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveFilter(node, actorId, runtimeCtx, depth, path) {
        runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: starting with logic:', node.logic);
        const parentResult = this.resolveNode(node.parent, actorId, runtimeCtx, depth + 1, path);
        runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: parentResult:', parentResult);
        if (parentResult.size === 0) {
            runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: parentResult is empty, returning empty set');
            return new Set();
        }
        const result = new Set();
        for (const entityId of parentResult) {
            try {
                const entity = runtimeCtx.entityManager.getEntityInstance(entityId);
                runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: evaluating entity:', entityId, 'entity:', entity);
                const context = {
                    entity: entity || { id: entityId },
                    actor: { id: actorId },
                    location: runtimeCtx.location || { id: 'unknown' }
                };
                runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: context for evaluation:', context);
                const filterResult = runtimeCtx.jsonLogicEval.evaluate(node.logic, context);
                runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: filterResult for entity', entityId, ':', filterResult);
                if (filterResult) {
                    result.add(entityId);
                    runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: added entity', entityId, 'to result');
                }
            } catch (error) {
                runtimeCtx.logger.error(`Error evaluating filter for entity ${entityId}:`, error);
            }
        }
        runtimeCtx.logger.debug('[ScopeEngine] resolveFilter: final result:', result);
        return result;
    }

    /**
     * Resolves a Union node (A + B)
     * 
     * @param {AST} node - Union node
     * @param {string} actorId - Actor ID
     * @param {RuntimeContext} runtimeCtx - Runtime context
     * @param {number} depth - Current depth
     * @param {Array<string>} path - Path of visited node/edge keys
     * @returns {Set<string>} Set of entity IDs
     * @private
     */
    resolveUnion(node, actorId, runtimeCtx, depth, path) {
        const leftResult = this.resolveNode(node.left, actorId, runtimeCtx, depth, path);
        const rightResult = this.resolveNode(node.right, actorId, runtimeCtx, depth, path);

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