// src/interfaces/IPathResolver.js

/**
 * @interface IPathResolver
 * Service that converts logical identifiers into concrete relative‐to‐project paths.
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
   * @param registryKey
   * @param filename
   * @returns {string}
   */
  resolveContentPath(registryKey, filename) {
    throw new Error('Not implemented');
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
   * @param modId
   * @param registryKey
   * @param filename
   * @returns {string}
   */
  resolveModContentPath(modId, registryKey, filename) {
    throw new Error('Not implemented');
  }
}
