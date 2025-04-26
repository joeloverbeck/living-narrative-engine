// src/core/engineVersion.js


import pkg from '../../package.json';
import semver from 'semver';

const versionFromPackage = pkg.version;

// Validate the version on startup (when this module is first imported)
if (!semver.valid(versionFromPackage)) {
    // Throw an error immediately if the version format is invalid
    throw new Error(
        `Invalid engine version specified in package.json: "${versionFromPackage}". ` +
        `Version must be a valid SemVer string (e.g., "1.2.3").`
    );
}

/**
 * The canonical engine version string, sourced directly from package.json.
 *
 * This constant is validated as a SemVer string when the module is first loaded.
 * Attempting to run the application with an invalid version string in package.json
 * will result in a startup error.
 *
 * The constant is frozen, ensuring it cannot be modified at runtime.
 *
 * @type {string}
 * @constant
 * @example
 * import { ENGINE_VERSION } from 'src/core/ENGINE_VERSION.js';
 * console.log(`Running engine version: ${ENGINE_VERSION}`);
 */
export const ENGINE_VERSION = Object.freeze(versionFromPackage);

// Note: Defining the constant and freezing it in one step ensures immutability.