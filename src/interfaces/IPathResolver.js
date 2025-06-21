// src/interfaces/IPathResolver.js

/**
 * @interface IPathResolver
 * @description Interface for resolving paths to various types of content.
 */
export class IPathResolver {
  /**
   * @param filename
   * @returns {string}
   */
  resolveSchemaPath(filename) {
    throw new Error('Not implemented');
  }

  /**
   * Resolves the path to a content file.
   *
   * @param registryKey
   * @param filename
   * @returns {string}
   */
  resolveContentPath(registryKey, filename) {
    throw new Error('Method not implemented.');
  }

  /** @returns {string} */
  resolveGameConfigPath() {
    throw new Error('Not implemented');
  }

  /**
   * @param modId
   * @returns {string}
   */
  resolveModManifestPath(modId) {
    throw new Error('Not implemented');
  }

  /**
   * Resolves the path to a mod content file.
   *
   * @param modId
   * @param registryKey
   * @param filename
   * @returns {string}
   */
  resolveModContentPath(modId, registryKey, filename) {
    throw new Error('Method not implemented.');
  }
}
