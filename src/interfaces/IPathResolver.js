// src/interfaces/IPathResolver.js

/**
 * @interface IPathResolver
 * Service that converts logical identifiers into concrete relative‐to‐project paths.
 */
export class IPathResolver {
    /** @returns {string} */
    resolveSchemaPath(filename) {
        throw new Error('Not implemented');
    }

    /** @returns {string} */
    resolveManifestPath(worldName) {
        throw new Error('Not implemented');
    }

    /** @returns {string} */
    resolveContentPath(typeName, filename) {
        throw new Error('Not implemented');
    }

    /** @returns {string} */
    resolveGameConfigPath() {
        throw new Error('Not implemented');
    }

    /** @returns {string} */
    resolveModManifestPath(modId) {
        throw new Error('Not implemented');
    }

    /** @returns {string} */
    resolveModContentPath(modId, typeName, filename) {
        throw new Error('Not implemented');
    }
}