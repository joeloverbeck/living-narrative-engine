/**
 * A resolver decides if it can handle a node and returns a Set of IDs.
 *
 * @typedef {{canResolve(node:Object):boolean, resolve(node:Object, ctx:Object):Set}} NodeResolver
 */