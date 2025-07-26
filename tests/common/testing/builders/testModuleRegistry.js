/**
 * @file testModuleRegistry.js
 * @description Central registry for test modules to break circular dependencies
 */

/**
 * @class TestModuleRegistry
 * @description Manages registration and retrieval of test module factories
 */
export class TestModuleRegistry {
  static #presets = new Map();
  static #moduleFactories = new Map();
  static #initialized = false;

  /**
   * Initialize the registry (called once at startup)
   */
  static initialize() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
  }

  /**
   * Register a module factory
   *
   * @param {string} name - Module name
   * @param {Function} factory - Factory function that returns a module instance
   */
  static registerModuleFactory(name, factory) {
    this.#moduleFactories.set(name, factory);
  }

  /**
   * Register a preset factory
   *
   * @param {string} name - Preset name
   * @param {Function} factory - Factory function that returns a configured module
   */
  static registerPreset(name, factory) {
    this.#presets.set(name, factory);
  }

  /**
   * Get a module factory
   *
   * @param {string} name - Module name
   * @returns {Function} Module factory function
   * @throws {Error} If module not found
   */
  static getModuleFactory(name) {
    const factory = this.#moduleFactories.get(name);
    if (!factory) {
      throw new Error(`Module factory '${name}' not registered`);
    }
    return factory;
  }

  /**
   * Get a preset factory
   *
   * @param {string} name - Preset name
   * @returns {Function} Preset factory function
   * @throws {Error} If preset not found
   */
  static getPreset(name) {
    const preset = this.#presets.get(name);
    if (!preset) {
      throw new Error(
        `Preset '${name}' not registered. Available presets: ${Array.from(this.#presets.keys()).join(', ')}`
      );
    }
    return preset;
  }

  /**
   * Get all registered preset names
   *
   * @returns {string[]} Array of preset names
   */
  static getPresetNames() {
    return Array.from(this.#presets.keys());
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  static clear() {
    this.#presets.clear();
    this.#moduleFactories.clear();
    this.#initialized = false;
  }
}

// Initialize on module load
TestModuleRegistry.initialize();
