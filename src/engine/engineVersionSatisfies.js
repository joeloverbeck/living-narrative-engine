// src/utils/engineVersionSatisfies.js
import semver from 'semver';
import { ENGINE_VERSION } from './engineVersion.js';

/**
 * Checks if the current engine version (ENGINE_VERSION) satisfies a given SemVer range.
 * This utility centralizes the version comparison logic.
 *
 * @param {string} range - The SemVer range string to check against (e.g., "^1.2.0", ">=2.0.0 <3.0.0").
 * @returns {boolean} True if the engine version satisfies the range, false otherwise.
 * @throws {TypeError} If the provided range is missing (null/undefined), an empty string,
 * or not a syntactically valid SemVer range string.
 */
export default function engineVersionSatisfies(range) {
  // 1. Input Validation: Check for missing or empty range
  if (range === null || range === undefined || range === '') {
    throw new TypeError('Missing or empty version range provided.');
  }

  // 2. Input Validation: Check for non-string types and illegal SemVer range syntax
  // semver.validRange returns null if the range string is invalid.
  if (typeof range !== 'string' || semver.validRange(range) === null) {
    // Include the problematic range value in the error for easier debugging.
    throw new TypeError(`Invalid SemVer range provided: "${range}".`);
  }

  // 3. Core Logic: Perform the satisfaction check using semver.satisfies
  // The { includePrerelease: true } option ensures that:
  // - If ENGINE_VERSION is a pre-release (e.g., "1.0.0-beta.1"), it can satisfy
  //   ranges like "^1.0.0" or ">=1.0.0". Without this flag, pre-releases
  //   only satisfy ranges that explicitly include a pre-release identifier part.
  // - Comparisons involving ranges with pre-release identifiers work as expected.
  return semver.satisfies(ENGINE_VERSION, range, { includePrerelease: true });
}
