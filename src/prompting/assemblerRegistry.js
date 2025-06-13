/**
 * @module AssemblerRegistry
 * @description Central IoC registry mapping element keys to assembler instances.
 */
export class AssemblerRegistry {
  /** @type {Map<string, {assemble: Function}>} */
  #map = new Map();

  /**
   * Register an assembler under a unique string key.
   *
   * @param {string} key - Non-empty string identifier for the element.
   * @param {{assemble: Function}} assembler - An object implementing `assemble()`.
   * @throws {Error} If key is missing/invalid or assembler lacks `assemble()`.
   */
  register(key, assembler) {
    if (!key || typeof key !== 'string') {
      throw new Error('AssemblerRegistry.register: invalid key');
    }
    if (!assembler || typeof assembler.assemble !== 'function') {
      throw new Error(
        'AssemblerRegistry.register: assembler must implement assemble()'
      );
    }
    this.#map.set(key, assembler);
  }

  /**
   * Resolve an assembler by its key.
   *
   * @param {string} key
   * @returns {{assemble: Function}}
   * @throws {Error} If no assembler is registered for key.
   */
  resolve(key) {
    if (!this.#map.has(key)) {
      throw new Error(
        `AssemblerRegistry.resolve: No assembler registered for '${key}'`
      );
    }
    return this.#map.get(key);
  }
}
