import errorFactory from '../core/errorFactory.js';

/**
 * Creates a dispatcher that routes AST nodes to appropriate resolvers
 *
 * @param {Array<NodeResolver>} resolvers - Array of node resolvers
 * @returns {{resolve: Function}} Dispatcher object with resolve method
 */
export default function createDispatcher(resolvers) {
  return {
    resolve(node, ctx) {
      const r = resolvers.find((x) => x.canResolve(node));
      if (!r) throw errorFactory.unknown(node.type, node);
      return r.resolve(node, ctx);
    },
  };
}
