// src/core/services/defaultPathResolver.js

/**
 * @fileoverview Implements the IPathResolver interface using an IConfiguration service
 * to resolve abstract identifiers (like filenames, world names) into full,
 * fetchable paths based on configured base directories.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 */

/**
 * Resolves abstract identifiers into concrete file paths using configuration settings.
 * This implementation relies on an injected configuration service to provide the
 * necessary base paths for schemas, world manifests, and content definition files.
 *
 * @implements {IPathResolver}
 */
class DefaultPathResolver {
    /**
     * The configuration service instance used to retrieve base paths.
     * @private
     * @type {IConfiguration}
     */
    #config;

    /**
     * Creates an instance of DefaultPathResolver.
     * Requires a service instance that conforms to the IConfiguration interface
     * to provide the necessary base path information.
     *
     * @param {IConfiguration} configurationService - An object conforming to the IConfiguration interface.
     * @throws {Error} If a valid configuration service is not provided.
     */
    constructor(configurationService) {
        // Basic validation to ensure a seemingly valid configuration object is passed.
        // Checks for the presence of expected methods defined in the IConfiguration interface.
        // AC: Constructor accepts an IConfiguration service instance.
        if (!configurationService ||
            typeof configurationService.getSchemaBasePath !== 'function' ||
            typeof configurationService.getWorldBasePath !== 'function' ||
            typeof configurationService.getContentBasePath !== 'function') {
            // AC: Constructor throws an error if the configuration service is invalid.
            throw new Error('DefaultPathResolver: Constructor requires a valid IConfiguration service instance providing getSchemaBasePath, getWorldBasePath, and getContentBasePath methods.');
        }
        // AC: Constructor stores the configuration service instance internally.
        this.#config = configurationService;
    }

    /**
     * Resolves a schema filename into a full fetchable path by prepending the
     * configured schema base path.
     * Example: 'common.schema.json' -> './data/schemas/common.schema.json'
     *
     * @override
     * @param {string} filename - The base name of the schema file (e.g., 'common.schema.json').
     * @returns {string} The full, potentially relative, path to the schema file.
     * @throws {Error} If the filename is not a valid non-empty string.
     */
    resolveSchemaPath(filename) {
        // AC: resolveSchemaPath throws an error for invalid input.
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('DefaultPathResolver.resolveSchemaPath: Invalid or empty filename provided.');
        }
        // AC: resolveSchemaPath calls config.getSchemaBasePath().
        const basePath = this.#config.getSchemaBasePath();
        // Simple concatenation. Assumes base path does not end with '/' and filename does not start with '/'.
        // Handling potential double slashes could be added if basePath format is uncertain.
        // AC: resolveSchemaPath returns the combined path correctly.
        return `${basePath}/${filename}`;
    }

    /**
     * Resolves a world name into the full fetchable path for its manifest file.
     * It constructs the standard manifest filename (e.g., 'demo.world.json') and
     * prepends the configured world base path.
     * Example: 'demo' -> './data/worlds/demo.world.json'
     *
     * @override
     * @param {string} worldName - The name of the world (e.g., 'demo').
     * @returns {string} The full, potentially relative, path to the world's manifest file.
     * @throws {Error} If the worldName is not a valid non-empty string.
     */
    resolveManifestPath(worldName) {
        // AC: resolveManifestPath throws an error for invalid input.
        if (typeof worldName !== 'string' || worldName.trim() === '') {
            throw new Error('DefaultPathResolver.resolveManifestPath: Invalid or empty worldName provided.');
        }
        // AC: resolveManifestPath calls config.getWorldBasePath().
        const basePath = this.#config.getWorldBasePath();
        const manifestFilename = `${worldName}.world.json`;
        // AC: resolveManifestPath constructs the correct manifest filename.
        // AC: resolveManifestPath returns the combined path correctly.
        return `${basePath}/${manifestFilename}`;
    }

    /**
     * Resolves a content type and filename into the full fetchable path for that
     * specific content definition file. It retrieves the base path specific to the
     * content type from the configuration and appends the filename.
     * Example: ('items', 'potion.json') -> './data/items/potion.json'
     *
     * @override
     * @param {string} typeName - The type of content (e.g., 'items', 'actions', 'locations').
     * @param {string} filename - The base name of the content file (e.g., 'potion.json').
     * @returns {string} The full, potentially relative, path to the content file.
     * @throws {Error} If typeName or filename are not valid non-empty strings.
     */
    resolveContentPath(typeName, filename) {
        // AC: resolveContentPath throws an error for invalid typeName.
        if (typeof typeName !== 'string' || typeName.trim() === '') {
            throw new Error('DefaultPathResolver.resolveContentPath: Invalid or empty typeName provided.');
        }
        // AC: resolveContentPath throws an error for invalid filename.
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('DefaultPathResolver.resolveContentPath: Invalid or empty filename provided.');
        }

        // AC: resolveContentPath calls config.getContentBasePath(typeName).
        const basePath = this.#config.getContentBasePath(typeName);
        // Assumes getContentBasePath returns a valid path string for the given typeName.
        // Error handling for invalid typeName could be added here or expected within the config service.
        // AC: resolveContentPath returns the combined path correctly.
        return `${basePath}/${filename}`;
    }
}

// AC: defaultPathResolver.js exists and exports the DefaultPathResolver class.
// Export the class as the default export for this module, making it available for import.
export default DefaultPathResolver;