/**
 * @file Adapts a function to conform to the IModLoadOrderResolver interface,
 * which expects a `.resolve()` method.
 */

/** @typedef {import('../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest */

/**
 * Adapter class that exposes a `resolve` method using a provided function.
 *
 * @class
 */
export default class FnLoadOrderResolverAdapter {
  /**
   * Create a resolver adapter around a load-order function.
   *
   * @param {(ids: string[], manifests: Map<string, ModManifest>) => string[]} fn Function implementing load order resolution.
   */
  constructor(fn) {
    if (typeof fn !== 'function') {
      throw new Error('FnLoadOrderResolverAdapter requires a function.');
    }
    /**
     * @private
     * @type {(ids: string[], manifests: Map<string, ModManifest>) => string[]}
     */
    this.fn = fn;
  }

  /**
   * Resolves the load order using the wrapped function.
   *
   * @param {string[]} ids The mod IDs to order.
   * @param {Map<string, ModManifest>} manifests Map of mod manifests keyed by ID.
   * @returns {string[]} Ordered list of mod IDs.
   */
  resolve(ids, manifests) {
    return this.fn(ids, manifests);
  }
}
