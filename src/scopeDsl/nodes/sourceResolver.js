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
      let result = new Set();

      switch (node.kind) {
        case 'actor':
          result = new Set([actorEntity.id]);
          break;

        case 'location': {
          const location = locationProvider.getLocation();
          if (location && location.id) {
            result = new Set([location.id]);
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
            const resultSet = new Set();
            const allEntities = entitiesGateway.getEntities();

            for (const entity of allEntities) {
              if (!entitiesGateway.hasComponent(entity.id, componentName)) {
                resultSet.add(entity.id);
              }
            }
            result = resultSet;
          } else {
            // Positive component - entities WITH the component
            const entities =
              entitiesGateway.getEntitiesWithComponent(componentId);
            result = new Set(
              (entities || []).map((e) => e.id).filter((id) => typeof id === 'string')
            );
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
