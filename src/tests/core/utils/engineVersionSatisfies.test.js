// tests/core/utils/engineVersionSatisfies.test.js
import {describe, it, expect} from '@jest/globals';

// Import the function under test
import engineVersionSatisfies from '../../../core/utils/engineVersionSatisfies.js';

// Import the actual engine version to test against
import {ENGINE_VERSION} from '../../../core/engineVersion.js'; // Currently '0.0.1' based on package.json

// Use the imported version for clarity in tests
const currentVersion = ENGINE_VERSION; // '0.0.1'

describe('engineVersionSatisfies Utility', () => {

    describe('Happy Paths (Returns true)', () => {
        it(`should return true for the exact version (${currentVersion})`, () => {
            expect(engineVersionSatisfies(currentVersion)).toBe(true);
        });

        it('should return true for a matching patch range (e.g., 0.0.x)', () => {
            expect(engineVersionSatisfies('0.0.x')).toBe(true);
        });

        // FIX: Split the original test for ^0.0.x ranges for clarity
        it('should return true for caret range ^0.0.1', () => {
            // ^0.0.1 means >=0.0.1 <0.0.2. This matches 0.0.1.
            expect(engineVersionSatisfies('^0.0.1')).toBe(true);
        });

        it('should return true for a basic caret range (^0.0)', () => {
            // For 0.x versions, ^0.0 is equivalent to ^0.0.0 which means >=0.0.0 <0.1.0
            // Correction: ^0.0 is treated like ^0.0.0 or >=0.0.0 <0.1.0. This SHOULD match 0.0.1. Let's re-verify.
            // semver.satisfies('0.0.1', '^0.0') -> true. The previous comment was slightly off. ^0.0 allows patch updates.
            expect(engineVersionSatisfies('^0.0')).toBe(true);
        });

        it('should return true for a matching tilde range (~0.0.0)', () => {
            // ~0.0.0 allows patch-level changes >=0.0.0 <0.1.0. Matches 0.0.1.
            expect(engineVersionSatisfies('~0.0.0')).toBe(true);
        });

        it('should return true for a matching tilde range (~0.0.1)', () => {
            // ~0.0.1 allows patch-level changes >=0.0.1 <0.1.0. Matches 0.0.1.
            expect(engineVersionSatisfies('~0.0.1')).toBe(true);
        });


        it('should return true for an inclusive greater/equal range (>=0.0.0)', () => {
            expect(engineVersionSatisfies('>=0.0.0')).toBe(true);
        });

        it('should return true for a less/equal range (<=0.0.1)', () => {
            expect(engineVersionSatisfies('<=0.0.1')).toBe(true);
        });

        it('should return true for the wildcard range (*)', () => {
            expect(engineVersionSatisfies('*')).toBe(true);
        });

        it('should return true for range including pre-release tags when version is stable', () => {
            // Our stable '0.0.1' should satisfy ranges that allow pre-releases below it
            expect(engineVersionSatisfies('>=0.0.1-alpha')).toBe(true);
            expect(engineVersionSatisfies('^0.0.1-beta.1')).toBe(true); // includePrerelease means stable satisfies range with prerelease
        });

        // Example tests if ENGINE_VERSION were '1.5.2' (as per ticket examples)
        // it('should return true for 1.5.x', () => expect(engineVersionSatisfies('1.5.x')).toBe(true));
        // it('should return true for ^1.4.0', () => expect(engineVersionSatisfies('^1.4.0')).toBe(true));
        // it('should return true for >=1.0.0', () => expect(engineVersionSatisfies('>=1.0.0')).toBe(true));
    });

    describe('Failure Paths (Returns false)', () => {
        it('should return false for a non-matching exact version (0.0.2)', () => {
            expect(engineVersionSatisfies('0.0.2')).toBe(false);
        });

        // FIX: Add test for ^0.0.0 which should fail for version 0.0.1
        it('should return false for caret range ^0.0.0', () => {
            // ^0.0.0 means >=0.0.0 <0.0.1. Does not match 0.0.1.
            expect(engineVersionSatisfies('^0.0.0')).toBe(false);
        });

        it('should return false for a future major version range (^1.0.0)', () => {
            expect(engineVersionSatisfies('^1.0.0')).toBe(false);
        });

        it('should return false for a future minor version range (^0.1.0)', () => {
            // Because current is 0.0.1, ^0.1.0 requires >=0.1.0 <0.2.0, which does not match
            expect(engineVersionSatisfies('^0.1.0')).toBe(false);
        });

        it('should return false for a future patch version range (^0.0.2)', () => {
            // Requires >=0.0.2 <0.0.3
            expect(engineVersionSatisfies('^0.0.2')).toBe(false);
        });

        it('should return false for an older version range (<0.0.1)', () => {
            expect(engineVersionSatisfies('<0.0.1')).toBe(false);
        });

        it('should return false for an exclusive greater range (>0.0.1)', () => {
            expect(engineVersionSatisfies('>0.0.1')).toBe(false);
        });

        it('should return false for a non-matching complex range (>=0.1.0 <0.2.0)', () => {
            expect(engineVersionSatisfies('>=0.1.0 <0.2.0')).toBe(false);
        });
    });

    describe('Input Validation Errors (Throws TypeError)', () => {
        it('should throw TypeError for null input', () => {
            expect(() => engineVersionSatisfies(null))
                .toThrow(new TypeError('Missing or empty version range provided.'));
        });

        it('should throw TypeError for undefined input', () => {
            expect(() => engineVersionSatisfies(undefined))
                .toThrow(new TypeError('Missing or empty version range provided.'));
        });

        it('should throw TypeError for empty string input', () => {
            expect(() => engineVersionSatisfies(''))
                .toThrow(new TypeError('Missing or empty version range provided.'));
        });

        it('should throw TypeError for a nonsense string input ("invalid-range")', () => {
            const invalidRange = 'invalid-range';
            expect(() => engineVersionSatisfies(invalidRange))
                .toThrow(new TypeError(`Invalid SemVer range provided: "${invalidRange}".`));
        });

        it('should throw TypeError for a partially valid but overall invalid range string ("^1.0 || >=")', () => {
            const invalidRange = '^1.0 || >=';
            expect(() => engineVersionSatisfies(invalidRange))
                .toThrow(new TypeError(`Invalid SemVer range provided: "${invalidRange}".`));
        });

        it('should throw TypeError for non-string input (number)', () => {
            expect(() => engineVersionSatisfies(123))
                .toThrow(new TypeError('Invalid SemVer range provided: "123".'));
        });

        it('should throw TypeError for non-string input (boolean)', () => {
            expect(() => engineVersionSatisfies(true))
                .toThrow(new TypeError('Invalid SemVer range provided: "true".'));
        });

        it('should throw TypeError for non-string input (object)', () => {
            const obj = {range: '^1.0.0'};
            // FIX: Use the exact expected TypeError message string, without regex escaping.
            const expectedMsg = `Invalid SemVer range provided: "${obj}".`; // Uses object.toString()
            expect(() => engineVersionSatisfies(obj))
                .toThrow(new TypeError(expectedMsg));
        });

        it('should throw TypeError for non-string input (array)', () => {
            const arr = ['^1.0.0'];
            // Array.toString() typically joins elements with a comma, but here it seems to just output the element
            const expectedMsg = `Invalid SemVer range provided: "${arr.toString()}".`;
            expect(() => engineVersionSatisfies(arr))
                .toThrow(new TypeError(expectedMsg));
        });
    });

    describe('Acceptance Criteria Checks', () => {
        it('should always return a boolean on valid input', () => {
            // Use ranges tested in happy/failure paths
            expect(typeof engineVersionSatisfies('^0.0.1')).toBe('boolean');
            expect(typeof engineVersionSatisfies('>1.0.0')).toBe('boolean');
        });

        // Note: Testing for "never logs" or "never mutates global state" is typically
        // done via code inspection for simple functions like this, as direct
        // testing in Jest is complex or impractical. The implementation adheres to these rules.
    });

    // Optional: Testing behavior if ENGINE_VERSION itself was a pre-release
    // This requires mocking ENGINE_VERSION, which can be complex with ES Modules in Jest.
    // Example pseudo-code (actual implementation depends on Jest config/version):
    // describe('Edge Case: Pre-release ENGINE_VERSION', () => {
    //   beforeAll(() => {
    //     jest.mock('../../../src/core/ENGINE_VERSION.js', () => ({
    //       ENGINE_VERSION: '0.0.2-beta.1'
    //     }));
    //     // Need to re-require or use dynamic import for the mocked version
    //     // engineVersionSatisfies = require('../../../src/core/util/engineVersionSatisfies.js').default;
    //   });
    //
    //   it('should satisfy matching exact pre-release range', () => {
    //      expect(engineVersionSatisfies('0.0.2-beta.1')).toBe(true);
    //   });
    //
    //   it('should satisfy inclusive range due to includePrerelease flag', () => {
    //      expect(engineVersionSatisfies('^0.0.1')).toBe(true); // Matches >=0.0.1 <0.1.0
    //      expect(engineVersionSatisfies('^0.0.2-alpha')).toBe(true); // Matches >=0.0.2-alpha <0.1.0
    //   });
    //
    //   it('should not satisfy range excluding pre-releases if base version matches but prerelease differs', () => {
    //      // This behavior depends strictly on semver logic with the flag
    //      expect(engineVersionSatisfies('0.0.2')).toBe(true); // includePrerelease allows this
    //   });
    //
    //   afterAll(() => {
    //     jest.unmock('../../../src/core/ENGINE_VERSION.js');
    //     // Restore original import if necessary
    //   });
    // });
});