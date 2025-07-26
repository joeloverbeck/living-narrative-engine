/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 * @typedef {import('../core/gateways.js').EntityGateway} EntityGateway
 */
import { UnknownSourceError } from '../../errors/unknownSourceError.js';

/**
 * @typedef {object} LocationProvider
 * @property {() => {id: string} | null} getLocation - Function to get the current location
 */

/**
 * Factory function that creates a source resolver with injected dependencies
 *
 * @param {object} deps - Dependencies
 * @param {EntityGateway} deps.entitiesGateway - Gateway for entity operations
 * @param {LocationProvider} deps.locationProvider - Provider for current location
 * @returns {NodeResolver} Source node resolver
 */
export default function createSourceResolver({
  entitiesGateway,
  locationProvider,
}) {
  /**
   * Collects entity IDs lacking the specified component.
   *
   * @description Iterates all entities and filters out those with the component.
   * @param {string} componentName - Component identifier without '!'.
   * @returns {Set<string>} IDs of entities without the component.
   */
  function collectEntitiesWithoutComponent(componentName) {
    const resultSet = new Set();
    const allEntities = entitiesGateway.getEntities();
    for (const entity of allEntities) {
      if (!entitiesGateway.hasComponent(entity.id, componentName)) {
        resultSet.add(entity.id);
      }
    }
    return resultSet;
  }
  return {
    /**
     * Determines if this resolver can handle the given node
     *
     * @param {object} node - AST node
     * @returns {boolean} True if this is a Source node
     */
    canResolve(node) {
      return node.type === 'Source';
    },

    /**
     * Resolves a Source node to a set of entity IDs
     *
     * @param {object} node - Source node with kind and optional param
     * @param {object} ctx - Resolution context
     * @param {object} ctx.actorEntity - The acting entity
     * @param {object} [ctx.trace] - Optional trace context
     * @returns {Set<string>} Set of entity IDs
     */
    resolve(node, ctx) {
      const { actorEntity, trace } = ctx;

      // Validate context has required properties
      if (!actorEntity) {
        const error = new Error(
          'SourceResolver: actorEntity is missing from context'
        );
        console.error('[CRITICAL] SourceResolver missing actorEntity:', {
          hasCtx: !!ctx,
          ctxKeys: ctx ? Object.keys(ctx) : [],
          nodeType: node?.type,
          nodeKind: node?.kind,
          nodeParam: node?.param,
          depth: ctx?.depth,
          callStack: new Error().stack,
        });
        throw error;
      }

      if (!actorEntity.id || typeof actorEntity.id !== 'string') {
        const error = new Error(
          `SourceResolver: actorEntity has invalid ID: ${JSON.stringify(actorEntity.id)}`
        );
        console.error('[CRITICAL] SourceResolver actorEntity has invalid ID:', {
          actorId: actorEntity.id,
          actorIdType: typeof actorEntity.id,
          nodeKind: node?.kind,
          callStack: new Error().stack,
        });
        throw error;
      }

      let result = new Set();

      switch (node.kind) {
        case 'actor':
          result = new Set([actorEntity.id]);
          break;

        case 'location': {
          const location = locationProvider.getLocation();
          if (location) {
            // Handle both string and object locations
            if (typeof location === 'string') {
              result = new Set([location]);
            } else if (location.id) {
              result = new Set([location.id]);
            }
          }
          break;
        }

        case 'entities': {
          const componentId = node.param;
          if (!componentId) {
            // No component specified, return empty set
            result = new Set();
            break;
          }

          if (componentId.startsWith('!')) {
            // Negated component - entities WITHOUT the component
            const componentName = componentId.slice(1);
            result = collectEntitiesWithoutComponent(componentName);
          } else {
            // Positive component - entities WITH the component
            const entities =
              entitiesGateway.getEntitiesWithComponent(componentId);
            result = new Set(
              (entities || [])
                .map((e) => e.id)
                .filter((id) => typeof id === 'string')
            );
          }
          break;
        }

        case 'target': {
          // Return target entity ID if available in context
          if (ctx.runtimeCtx?.target) {
            result = new Set([ctx.runtimeCtx.target.id]);
          }
          break;
        }

        case 'targets': {
          // Return the targets object itself, not the IDs
          // This allows accessing targets.primary, targets.secondary, etc.
          if (ctx.runtimeCtx?.targets) {
            result = new Set([ctx.runtimeCtx.targets]);
          }
          break;
        }

        default:
          throw new UnknownSourceError(node.kind);
      }

      // Add trace logging if available
      if (trace) {
        const source = 'ScopeEngine.resolveSource';
        trace.addLog(
          'info',
          `Resolved source '${node.kind}'. Found ${result.size} item(s).`,
          source,
          {
            kind: node.kind,
            param: node.param,
            result: Array.from(result),
          }
        );
      }

      return result;
    },
  };
}
