/**
 * @file Adapts a function to conform to the IModLoadOrderResolver interface,
 * which expects a `.resolve()` method.
 */

/** @typedef {import('../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest */

export default class FnLoadOrderResolverAdapter {
  /**
   * @param {(ids: string[], manifests: Map<string, ModManifest>) => string[]} fn
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
   * @param {string[]} ids
   * @param {Map<string, ModManifest>} manifests
   * @returns {string[]}
   */
  resolve(ids, manifests) {
    return this.fn(ids, manifests);
  }
}
