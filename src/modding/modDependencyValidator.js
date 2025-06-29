// src/modding/modDependencyValidator.js

import semver from 'semver'; // AC: Use semver@^7
import ModDependencyError from '../errors/modDependencyError.js'; // AC: Use custom Error type

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} ModManifest - Represents the structure of a mod manifest (simplified for validation).
 * @property {string} id - The unique, case-insensitive ID of the mod.
 * @property {string} version - The semantic version of the mod (e.g., "1.2.3").
 * @property {Array<{id: string, version: string, required?: boolean}>} [dependencies] - Mods this mod depends on.
 * @property {string[]} [conflicts] - Mod IDs this mod conflicts with.
 */

/**
 * Validates mod dependencies and conflicts based on a collection of loaded manifests.
 * Pure service, does not perform I/O or modify input. Throws on fatal errors.
 */
class ModDependencyValidator {
  /**
   * Validates dependencies and conflicts across a map of mod manifests.
   * Checks for missing required dependencies, version mismatches, and conflicts.
   * Logs warnings for issues with optional dependencies.
   *
   * @param {Map<string, ModManifest>} manifests - Map of mod manifests, keyed by **lower-cased** mod ID.
   * @param {ILogger} logger - Logger instance for warnings.
   * @param {object} [options] - Optional validation options.
   * @param {{valid: Function, satisfies: Function}} [options.semverLib=semver] - Library used for semver checks.
   * @returns {void} - Returns nothing, but throws ModDependencyError on fatal issues.
   * @throws {ModDependencyError} If fatal validation errors occur (missing required, version mismatch, conflict).
   */
  static validate(manifests, logger, { semverLib = semver } = {}) {
    const fatals = []; // AC: Collect fatal messages

    if (!(manifests instanceof Map)) {
      throw new Error(
        'ModDependencyValidator.validate: Input `manifests` must be a Map.'
      );
    }
    if (!logger || typeof logger.warn !== 'function') {
      throw new Error(
        'ModDependencyValidator.validate: Input `logger` must be a valid ILogger instance.'
      );
    }

    // Iterate through each mod that is loaded
    for (const [modIdLower, manifest] of manifests.entries()) {
      // --- 1. Check Dependencies ---
      if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
        for (const dep of manifest.dependencies) {
          // AC: Normalize dependency IDs to lower case for lookup
          const depIdLower = dep.id.toLowerCase();
          const required = dep.required !== false; // Default to true if 'required' is missing or not explicitly false
          const targetManifest = manifests.get(depIdLower);

          if (!targetManifest) {
            // Dependency mod is not in the loaded set
            if (required) {
              // AC: Fatal: Missing required dependency
              fatals.push(
                `Mod '${manifest.id}' requires missing dependency '${dep.id}'.`
              );
            } else {
              // AC: Non-fatal: Optional dependency absent
              logger.warn(
                `Mod '${manifest.id}' optional dependency '${dep.id}' is not loaded.`
              );
            }
          } else {
            // Dependency mod IS loaded, check version compatibility
            const targetVersion = targetManifest.version;
            const requiredVersionRange = dep.version;

            if (!semverLib.valid(targetVersion)) {
              const msg = `Mod '${manifest.id}' dependency '${dep.id}' has an invalid version format: '${targetVersion}'.`;
              if (required) {
                fatals.push(msg);
              } else {
                // Treat invalid version as unmet for optional deps too, but warn
                logger.warn(
                  `${msg} Cannot check optional version requirement.`
                );
              }
              continue; // Skip satisfaction check if version is invalid
            }

            // AC: Use semverLib.satisfies for version check
            if (!semverLib.satisfies(targetVersion, requiredVersionRange)) {
              const msg = `Mod '${manifest.id}' requires dependency '${dep.id}' version '${requiredVersionRange}', but found version '${targetVersion}'.`;
              if (required) {
                // AC: Fatal: Required version mismatch
                fatals.push(msg);
              } else {
                // AC: Non-fatal: Optional version mismatch
                // Opinion: No half-measures - warn and move on.
                logger.warn(`${msg} (Optional dependency mismatch)`);
              }
            }
            // If versions satisfy, no message needed for required or optional.
          }
        }
      }

      // --- 2. Check Conflicts ---
      if (manifest.conflicts && Array.isArray(manifest.conflicts)) {
        for (const conflictId of manifest.conflicts) {
          // AC: Normalize conflict IDs to lower case for lookup
          const conflictIdLower = conflictId.toLowerCase();
          if (manifests.has(conflictIdLower)) {
            // AC: Fatal: Conflict detected
            fatals.push(
              `Mod '${manifest.id}' conflicts with loaded mod '${conflictId}'.`
            );
          }
        }
      }
    } // End loop through manifests

    // AC: Throw collected fatal errors
    if (fatals.length > 0) {
      throw new ModDependencyError(fatals.join('\n'));
    }

    // If no fatals, validation passed successfully
    logger.debug(
      'ModDependencyValidator: All dependency and conflict checks passed.'
    );
  }
}

export default ModDependencyValidator;
