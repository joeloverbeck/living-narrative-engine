// src/modding/modVersionValidator.js

import engineVersionSatisfies from '../utils/engineVersionSatisfies.js';
import ModDependencyError from '../errors/modDependencyError.js';
import { ENGINE_VERSION } from '../engine/engineVersion.js'; // Import the actual engine version

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} ModManifestForVersionCheck - Represents the part of a mod manifest needed for version validation.
 * @property {string} id - The unique ID of the mod.
 * @property {string | any} [gameVersion] - The SemVer range string specifying compatible engine versions (or potentially other types if malformed).
 */

/**
 * Validates that all loaded mods are compatible with the current engine version.
 * Checks the `gameVersion` field in each manifest against the `ENGINE_VERSION`.
 *
 * @param {Map<string, ModManifestForVersionCheck>} manifests - A map of mod manifests, keyed by mod ID (case sensitivity depends on how the map was populated, typically lower-case).
 * @param {ILogger} logger - Logger instance for reporting results.
 * @returns {void} - Returns nothing upon successful validation.
 * @throws {ModDependencyError} If one or more mods have a `gameVersion` range incompatible with the current `ENGINE_VERSION`. The error message will contain details about all incompatible mods.
 * @throws {TypeError} If a mod's `gameVersion` field is not null/undefined and is either not a string or contains an invalid SemVer range string (propagated from `engineVersionSatisfies`).
 */
export default function validateModEngineVersions(manifests, logger) {
  const fatals = []; // Stores incompatibility messages

  if (!(manifests instanceof Map)) {
    // Basic type check for the input map
    throw new Error(
      'validateModEngineVersions: Input `manifests` must be a Map.'
    );
  }
  if (!logger || typeof logger.error !== 'function') {
    // Basic type check for the logger
    throw new Error(
      'validateModEngineVersions: Input `logger` must be a valid ILogger instance.'
    );
  }

  // --- Acceptance: Does not mutate the manifests map ---
  // The logic below only reads from the map and its contained objects.

  for (const manifest of manifests.values()) {
    const originalGameVersion = manifest.gameVersion;

    // --- Task: Unit tests (missing field) ---
    // Skip if gameVersion is missing (undefined) or explicitly null
    if (originalGameVersion === null || originalGameVersion === undefined) {
      continue;
    }

    // We need to handle strings vs non-strings before calling engineVersionSatisfies
    let rangeToCheck = originalGameVersion; // Keep original value for potential error reporting / type checking
    let isCompatible;

    try {
      // Trim only if it's actually a string
      if (typeof rangeToCheck === 'string') {
        const trimmedRange = rangeToCheck.trim();
        // --- Task: Unit tests (missing field - empty/whitespace string) ---
        if (!trimmedRange) {
          continue; // Skip empty or whitespace-only strings
        }
        rangeToCheck = trimmedRange; // Use the valid, trimmed string for the check
      }
      // If rangeToCheck is not a string here, engineVersionSatisfies *will* throw TypeError below

      // --- Task: Unit tests (malformed string handled by engineVersionSatisfies) ---
      // --- Task: Unit tests (happy, unhappy) ---
      // Let engineVersionSatisfies handle the validation (including type checks for non-strings)
      isCompatible = engineVersionSatisfies(rangeToCheck);
    } catch (err) {
      // Catch errors from engineVersionSatisfies (e.g., TypeError for invalid type or format)
      if (err instanceof TypeError) {
        // Add context to the error message before re-throwing
        err.message = `Mod '${manifest.id}' has an invalid gameVersion range: ${err.message}`;
        throw err; // Re-throw the augmented TypeError
      } else {
        // Re-throw unexpected errors
        throw err;
      }
    }

    // --- Task: Unit tests (unhappy) ---
    if (!isCompatible) {
      // If the range was valid but not satisfied by the current engine version.
      // Use the potentially trimmed 'rangeToCheck' for the error message.
      fatals.push(
        `Mod '${manifest.id}' incompatible with engine v${ENGINE_VERSION} (requires '${rangeToCheck}').`
      );
    }
  }

  // --- Acceptance: Throws only ModDependencyError on failure (for incompatibility) ---
  if (fatals.length) {
    const errorMessage = fatals.join('\n');
    logger.error(errorMessage); // Log the errors before throwing
    throw new ModDependencyError(errorMessage);
  }

  // If we reach here, all checked mods are compatible.
  logger.debug('ModVersionValidator: all mods compatible with current engine.');
}
