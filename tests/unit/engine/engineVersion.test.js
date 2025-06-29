// tests/engine/engineVersion.test.js
import { describe, it, expect } from '@jest/globals';
import semver from 'semver';

// Import the constant under test
// The import itself will trigger the validation logic within ENGINE_VERSION.js
import { ENGINE_VERSION } from '../../../src/engine/engineVersion.js';

// Import package.json directly to compare against its version
// Ensure your Jest setup can handle JSON imports with import assertions.
// If not, you might need to use require() or fs.readFileSync + JSON.parse.
import pkg from '../../../package.json' assert { type: 'json' };

describe('ENGINE_VERSION constant', () => {
  it('should strictly equal the version specified in package.json', () => {
    // Verifies that the exported constant matches the source value
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it('should be a valid SemVer string', () => {
    // The validation logic in ENGINE_VERSION.js should prevent execution
    // if the version is invalid. This test confirms the value is valid SemVer.
    expect(semver.valid(ENGINE_VERSION)).toBe(ENGINE_VERSION); // semver.valid returns the normalized version string if valid, null otherwise
    expect(semver.valid(ENGINE_VERSION)).not.toBeNull();

    // As a sanity check, also validate the source directly
    expect(semver.valid(pkg.version)).not.toBeNull();
  });

  it('should be frozen and immutable', () => {
    // In ES modules (which usually run in strict mode),
    // attempting to reassign a constant imported from another module
    // should throw a TypeError.
    expect(() => {
      /* eslint-disable no-import-assign */
      // @ts-ignore - Deliberately attempting to violate immutability for testing
      ENGINE_VERSION = '9.9.9';
      /* eslint-enable no-import-assign */
    }).toThrow(Error);

    // Double-check that the value wasn't altered (it shouldn't be possible)
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
});
