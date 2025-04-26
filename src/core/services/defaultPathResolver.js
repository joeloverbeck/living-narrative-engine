// src/core/services/defaultPathResolver.js

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */

/**
 * Default implementation of IPathResolver.
 * Resolves paths by combining base paths from IConfiguration with specific filenames.
 * Uses standard URL/path joining logic (adjust if running in Node.js vs Browser).
 * @implements {IPathResolver}
 */
class DefaultPathResolver {
    /** @private @type {IConfiguration} */
    #config;

    /**
     * Creates a new DefaultPathResolver.
     * @param {IConfiguration} configuration - The configuration service instance.
     * @throws {Error} If configuration is missing or invalid.
     */
    constructor(configuration) {
        const serviceName = 'DefaultPathResolver';
        const configInterface = 'IConfiguration';

        if (!configuration) {
            throw new Error(`${serviceName} requires an ${configInterface} instance.`);
        }

        // --- BEGIN MODIFIED VALIDATION (MODLOADER-003) ---
        // Define the methods this class *requires* from the configuration service
        const requiredMethods = [
            'getBaseDataPath',       // Used by all resolve methods
            'getSchemaBasePath',     // Used by resolveSchemaPath
            'getWorldBasePath',      // Used by resolveManifestPath
            'getContentBasePath',    // Used by resolveContentPath
            'getGameConfigFilename', // Used by resolveGameConfigPath
            'getModsBasePath',       // Needed for future mod path resolution (MODLOADER-003)
            'getModManifestFilename' // Needed for future mod path resolution (MODLOADER-003)
            // 'getRuleBasePath'    // Uncomment if resolveRulePath is actively used and required
        ];

        for (const methodName of requiredMethods) {
            if (typeof configuration[methodName] !== 'function') {
                // Throw a specific error indicating which method is missing or invalid
                throw new Error(`${serviceName} requires a valid ${configInterface} service instance with a \`${methodName}\` method.`);
            }
        }
        // --- END MODIFIED VALIDATION ---

        this.#config = configuration;
    }

    /**
     * Simple path joining function. Handles basic cases.
     * In a real app, consider using a library like 'path-browserify' for robustness.
     * @private
     * @param {...string} segments - Path segments to join.
     * @returns {string} The joined path.
     */
    #join(...segments) {
        // Filter out empty segments and join with '/'
        const relevantSegments = segments.filter(s => s !== null && s !== undefined && s !== '');
        // Basic normalization: remove trailing slashes from segments before joining, except for the last one
        let path = relevantSegments.map((segment, index) => {
            // Ensure segment is treated as a string before calling replace
            const segStr = String(segment);
            return (index < relevantSegments.length - 1) ? segStr.replace(/\/+$/, '') : segStr;
        }).join('/');

        // Ensure it doesn't end with multiple slashes if the last segment was just '/'
        path = path.replace(/\/+$/, '/');
        // If the original path started with './' or '/', preserve that intention
        if (relevantSegments[0] === '.' || String(relevantSegments[0])?.startsWith('./')) {
            if (!path.startsWith('./') && !path.startsWith('/')) {
                path = './' + path;
            }
        } else if (String(relevantSegments[0])?.startsWith('/')) {
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
        }
        // Handle potential double slashes from joining segments like "data/" and "/schemas"
        path = path.replace(/\/{2,}/g, '/');

        return path;
    }


    /**
     * Takes a schema filename and returns the full path needed to fetch it.
     * @param {string} filename - E.g., 'common.schema.json'.
     * @returns {string} Full path, e.g., './data/schemas/common.schema.json'.
     * @throws {Error} If filename is invalid.
     */
    resolveSchemaPath(filename) {
        // Add input validation for filename (as seen in other methods' tests)
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('Invalid or empty filename provided to resolveSchemaPath.');
        }
        const basePath = this.#config.getBaseDataPath();
        const schemaDir = this.#config.getSchemaBasePath();
        return this.#join(basePath, schemaDir, filename);
    }

    /**
     * Takes a world name and returns the full path needed to fetch its manifest file.
     * Assumes manifest filenames follow the pattern `{worldName}.world.json`.
     * @param {string} worldName - E.g., 'demo'.
     * @returns {string} Full path, e.g., './data/worlds/demo.world.json'.
     * @throws {Error} If worldName is invalid.
     */
    resolveManifestPath(worldName) {
        // Add input validation for worldName
        if (typeof worldName !== 'string' || worldName.trim() === '') {
            throw new Error('Invalid or empty worldName provided to resolveManifestPath.');
        }
        const basePath = this.#config.getBaseDataPath();
        const worldDir = this.#config.getWorldBasePath();
        const manifestFilename = `${worldName}.world.json`;
        return this.#join(basePath, worldDir, manifestFilename);
    }

    /**
     * Takes a content type and a filename and returns the full path needed to fetch it.
     * @param {string} typeName - E.g., 'items'.
     * @param {string} filename - E.g., 'potion.json'.
     * @returns {string} Full path, e.g., './data/items/potion.json'.
     * @throws {Error} If typeName or filename is invalid.
     */
    resolveContentPath(typeName, filename) {
        // Add input validation
        if (typeof typeName !== 'string' || typeName.trim() === '') {
            throw new Error('Invalid or empty typeName provided to resolveContentPath.');
        }
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('Invalid or empty filename provided to resolveContentPath.');
        }
        const basePath = this.#config.getBaseDataPath();
        const contentDir = this.#config.getContentBasePath(typeName);
        return this.#join(basePath, contentDir, filename);
    }

    /**
     * Takes a rule filename and returns the full path needed to fetch it.
     * @param {string} filename - E.g., 'movement_rules.json'.
     * @returns {string} Full path, e.g., './data/system/rules/movement_rules.json'.
     * @throws {Error} If filename is invalid or getRuleBasePath is not configured/implemented.
     */
    resolveRulePath(filename) {
        // Add input validation
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('Invalid or empty filename provided to resolveRulePath.');
        }
        // Check if the method exists before calling it, in case it's optional
        if (typeof this.#config.getRuleBasePath !== 'function') {
            throw new Error('Configuration service does not provide a getRuleBasePath method, required by resolveRulePath.');
        }
        const basePath = this.#config.getBaseDataPath();
        const ruleDir = this.#config.getRuleBasePath(); // Assumes this method exists now
        return this.#join(basePath, ruleDir, filename);
    }

    /**
     * Returns the full path needed to fetch the main game configuration file.
     * Assumes the config file is at the root of the base data path or as specified by configuration.
     * @returns {string} Full path, e.g., './data/game.json'.
     */
    resolveGameConfigPath() { // <<< IMPLEMENTED for GameConfigLoader
        const basePath = this.#config.getBaseDataPath();
        const configFilename = this.#config.getGameConfigFilename();
        // Join the base path and the filename directly
        return this.#join(basePath, configFilename);
    }

    // --- Methods using new IConfiguration functions (Future Use) ---
    // These are not explicitly required by the ticket but demonstrate how the
    // new config methods might be used in a path resolver.

    /**
     * Takes a mod ID and returns the full path needed to fetch its manifest file.
     * @param {string} modId - The unique ID of the mod (e.g., 'CoreComponents').
     * @returns {string} Full path, e.g., './data/mods/CoreComponents/mod.manifest.json'.
     * @throws {Error} If modId is invalid.
     */
    resolveModManifestPath(modId) {
        if (typeof modId !== 'string' || modId.trim() === '') {
            throw new Error('Invalid or empty modId provided to resolveModManifestPath.');
        }
        const basePath = this.#config.getBaseDataPath();
        const modsDir = this.#config.getModsBasePath();
        const manifestFilename = this.#config.getModManifestFilename();
        return this.#join(basePath, modsDir, modId, manifestFilename);
    }

    /**
     * Takes a mod ID, content type, and filename, returning the full path within that mod.
     * @param {string} modId - The ID of the mod.
     * @param {string} typeName - The content type (e.g., 'items').
     * @param {string} filename - The filename relative to the mod's type directory (e.g., 'potion.json').
     * @returns {string} Full path, e.g., './data/mods/MyMod/items/potion.json'.
     * @throws {Error} If modId, typeName, or filename is invalid.
     */
    resolveModContentPath(modId, typeName, filename) {
        if (typeof modId !== 'string' || modId.trim() === '') {
            throw new Error('Invalid or empty modId provided to resolveModContentPath.');
        }
        if (typeof typeName !== 'string' || typeName.trim() === '') {
            throw new Error('Invalid or empty typeName provided to resolveModContentPath.');
        }
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new Error('Invalid or empty filename provided to resolveModContentPath.');
        }
        // Assuming mod content follows a structure like: mods/<modId>/<typeName>/<filename>
        const basePath = this.#config.getBaseDataPath();
        const modsDir = this.#config.getModsBasePath();
        // Note: We don't use getContentBasePath here as that's for the *root* content.
        // Mod content is usually relative to the mod's own directory.
        return this.#join(basePath, modsDir, modId, typeName, filename);
    }
}

export default DefaultPathResolver;