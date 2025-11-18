/**
 * A resolver decides if it can handle a node and returns a Set of IDs.
 *
 * @typedef {{canResolve(node: object): boolean, resolve(node: object, ctx: object): Set}} NodeResolver
 */
