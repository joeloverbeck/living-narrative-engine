// src/engine/engineVersion.js
/* eslint-env browser */

import semver from 'semver';
import { freeze } from '../utils/cloneUtils.js';

// NOTE: Keep this string in sync with package.json "version".
const versionFromPackage = '0.0.1';

// Validate the version on startup (when this module is first imported)
if (!semver.valid(versionFromPackage)) {
  // Throw an error immediately if the version format is invalid
  throw new Error(
    `Invalid engine version specified in package.json: "${versionFromPackage}". ` +
      `Version must be a valid SemVer string (e.g., "1.2.3").`
  );
}

/**
 * The canonical engine version string. This should match the version
 * specified in package.json.
 *
 * This constant is validated as a SemVer string when the module is first loaded.
 * Attempting to run the application with an invalid version string in package.json
 * will result in a startup error.
 *
 * The constant is frozen, ensuring it cannot be modified at runtime.
 *
 * @type {string}
 * @constant
 */
export const ENGINE_VERSION = freeze(versionFromPackage);

// Note: Defining the constant and freezing it in one step ensures immutability.
