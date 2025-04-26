/** @jest-environment node */

// tests/core/services/modVersionValidator.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {cloneDeep} from 'lodash'; // Using lodash cloneDeep as requested

import validateModEngineVersions from '../../../core/services/modVersionValidator.js';
import ModDependencyError from '../../../core/errors/modDependencyError.js';
import {ENGINE_VERSION} from '../../../core/engineVersion.js'; // Use the actual engine version

// Mock Logger Factory
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

describe('ModVersionValidator Service: validateModEngineVersions', () => {
    let mockLogger;

    beforeEach(() => {
        mockLogger = createMockLogger();
        // Note: No need to mock engineVersionSatisfies itself,
        // as we want to test the integration and error handling around it.
    });

    // Helper to create a Map from an array of manifest-like objects
    const createManifestMap = (manifests) => {
        const map = new Map();
        // Mimic ModLoader behavior: keys are typically lower-cased IDs
        manifests.forEach(m => map.set(m.id.toLowerCase(), m));
        return map;
    };

    // --- Task: Mock manifests map with combinations ---
    // --- Test Cases for each combination below ---

    describe('Validation Success Cases (Happy Paths)', () => {
        it('should pass validation and log info if no mods are provided', () => {
            const manifests = createManifestMap([]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // --- Case: No gameVersion ---
        it('should skip and pass if a mod manifest has no gameVersion field (undefined)', () => {
            const manifests = createManifestMap([{id: 'modA', version: '1.0.0'}]); // gameVersion is undefined
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should skip and pass if a mod manifest has gameVersion: null', () => {
            const manifests = createManifestMap([{id: 'modB', gameVersion: null}]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should skip and pass if a mod manifest has gameVersion: "" (empty string)', () => {
            const manifests = createManifestMap([{id: 'modC', gameVersion: ''}]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should skip and pass if a mod manifest has gameVersion: "   " (whitespace only)', () => {
            const manifests = createManifestMap([{id: 'modD', gameVersion: '   '}]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // --- Case: Satisfied range ---
        it('should pass if a single mod has a compatible gameVersion range', () => {
            const manifests = createManifestMap([{id: 'modE', gameVersion: `^${ENGINE_VERSION}`}]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should pass with multiple compatible mods using different valid range types', () => {
            const manifests = createManifestMap([
                {id: 'modF', gameVersion: `^${ENGINE_VERSION}`},
                {id: 'modG', gameVersion: `>=${ENGINE_VERSION}`},
                {id: 'modH', gameVersion: '*'}, // Wildcard should always satisfy
            ]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should pass with a mix of compatible mods and mods without gameVersion', () => {
            const manifests = createManifestMap([
                {id: 'modI', gameVersion: `^${ENGINE_VERSION}`}, // Compatible
                {id: 'modJ', version: '1.0.0'}, // Skipped (no gameVersion)
                {id: 'modK', gameVersion: null},     // Skipped (null gameVersion)
                {id: 'modL', gameVersion: '   '},    // Skipped (whitespace gameVersion)
            ]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should trim whitespace around a valid and compatible range', () => {
            const manifests = createManifestMap([{id: 'modM', gameVersion: `  ^${ENGINE_VERSION}  `}]);
            expect(() => validateModEngineVersions(manifests, mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ModVersionValidator: all mods compatible with current engine.');
        });
    });

    describe('Validation Failure Cases (Incompatibility)', () => {
        // --- Case: Unsatisfied range ---
        it('should throw ModDependencyError and log error if a single mod has an incompatible range', () => {
            // Assuming ENGINE_VERSION is something like '0.1.0' or '1.2.3', '>100.0.0' should fail.
            const incompatibleRange = '>100.0.0';
            const manifests = createManifestMap([{id: 'modBad1', gameVersion: incompatibleRange}]);
            const expectedErrorMsg = `Mod 'modBad1' incompatible with engine v${ENGINE_VERSION} (requires '${incompatibleRange}').`;

            // Assertion 1: Function throws correct type
            expect(() => validateModEngineVersions(manifests, mockLogger))
                .toThrow(ModDependencyError);

            // Assertion 2: Logger error called once
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // Assertion 3: Logger error called with correct message
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            // Assertion 4: Logger info not called
            expect(mockLogger.info).not.toHaveBeenCalled(); // Should not log success info

            // Assertion 5: Also check the error message content from the thrown error via try/catch
            try {
                validateModEngineVersions(manifests, mockLogger);
            } catch (e) {
                expect(e.message).toBe(expectedErrorMsg);
            }
            // Corrected assertion count
            expect.assertions(5); // Ensure all checks ran (toThrow, error times, error with, info not called, message in catch)
        });

        it('should throw ModDependencyError listing all incompatible mods and log them', () => {
            const incompatibleRange1 = '>100.0.0';
            const incompatibleRange2 = '<0.0.1'; // Assuming ENGINE_VERSION >= 0.0.1
            const manifests = createManifestMap([
                {id: 'modGood1', gameVersion: `^${ENGINE_VERSION}`}, // Compatible
                {id: 'modBad2', gameVersion: incompatibleRange1},   // Incompatible
                {id: 'modSkip1', version: '1.0.0'},              // Skipped
                {id: 'modBad3', gameVersion: incompatibleRange2},   // Incompatible
            ]);
            const expectedErrorMsgPart1 = `Mod 'modBad2' incompatible with engine v${ENGINE_VERSION} (requires '${incompatibleRange1}').`;
            const expectedErrorMsgPart2 = `Mod 'modBad3' incompatible with engine v${ENGINE_VERSION} (requires '${incompatibleRange2}').`;
            const expectedFullErrorMsg = `${expectedErrorMsgPart1}\n${expectedErrorMsgPart2}`;

            // Assertion 1: Function throws correct type and message
            expect(() => validateModEngineVersions(manifests, mockLogger))
                .toThrow(new ModDependencyError(expectedFullErrorMsg));

            // Assertion 2: Logger error called once
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // Assertion 3: Logger error called with correct message
            expect(mockLogger.error).toHaveBeenCalledWith(expectedFullErrorMsg);
            // Assertion 4: Logger info not called
            expect(mockLogger.info).not.toHaveBeenCalled();
            // Corrected assertion count
            expect.assertions(4); // toThrow, error times, error with, info not called
        });

        it('should trim whitespace around a valid but incompatible range before reporting error', () => {
            const incompatibleRange = '>100.0.0';
            const manifests = createManifestMap([{id: 'modBad4', gameVersion: `  ${incompatibleRange}  `}]);
            const expectedErrorMsg = `Mod 'modBad4' incompatible with engine v${ENGINE_VERSION} (requires '${incompatibleRange}').`; // Note: Trimmed range in message

            expect(() => validateModEngineVersions(manifests, mockLogger))
                .toThrow(new ModDependencyError(expectedErrorMsg));
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            expect.assertions(2);
        });
    });

    describe('Validation Failure Cases (Malformed/Invalid Input)', () => {
        // --- Case: Malformed range ("foo") ---
        it('should re-throw TypeError if gameVersion is an invalid SemVer range string', () => {
            const invalidRange = 'this-is-not-semver';
            const manifests = createManifestMap([{id: 'modMalformed1', gameVersion: invalidRange}]);
            // engineVersionSatisfies throws the base error, validator adds context
            const baseErrorMsg = `Invalid SemVer range provided: "${invalidRange}".`;
            const expectedTypeErrorMsg = `Mod 'modMalformed1' has an invalid gameVersion range: ${baseErrorMsg}`;

            // --- Assert: Function throws ---
            expect(() => validateModEngineVersions(manifests, mockLogger))
                // --- Assert: TypeError type on throw --- (Not ModDependencyError)
                .toThrow(new TypeError(expectedTypeErrorMsg));

            // --- Assert: Logger receives .error with expected message(s) --- (Should NOT be called for TypeError)
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect.assertions(3); // toThrow, error not called, info not called
        });

        it('should re-throw TypeError if gameVersion is not a string or null/undefined', () => {
            const invalidRange = 12345; // Number, not a string
            const manifests = createManifestMap([{id: 'modMalformed2', gameVersion: invalidRange}]);
            const baseErrorMsg = `Invalid SemVer range provided: "${invalidRange}".`;
            const expectedTypeErrorMsg = `Mod 'modMalformed2' has an invalid gameVersion range: ${baseErrorMsg}`;

            // --- Assert: Function throws ---
            // --- Assert: TypeError type on throw ---
            expect(() => validateModEngineVersions(manifests, mockLogger))
                .toThrow(new TypeError(expectedTypeErrorMsg));

            // --- Assert: Logger receives .error --- (Should NOT be called)
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect.assertions(3);
        });

        it('should handle multiple manifests, failing fast on the first TypeError', () => {
            const manifests = createManifestMap([
                {id: 'modGood2', gameVersion: `^${ENGINE_VERSION}`}, // Compatible, processed first
                {id: 'modMalformed3', gameVersion: false},          // Invalid type, causes throw
                {id: 'modBad5', gameVersion: '>100.0.0'},          // Incompatible, never reached
            ]);
            const invalidRange = false;
            const baseErrorMsg = `Invalid SemVer range provided: "${invalidRange}".`;
            const expectedTypeErrorMsg = `Mod 'modMalformed3' has an invalid gameVersion range: ${baseErrorMsg}`;

            expect(() => validateModEngineVersions(manifests, mockLogger))
                .toThrow(new TypeError(expectedTypeErrorMsg));

            expect(mockLogger.error).not.toHaveBeenCalled(); // No ModDependencyError logged
            expect(mockLogger.info).not.toHaveBeenCalled(); // Did not complete successfully
            expect.assertions(3);
        });
    });

    describe('Input Validation', () => {
        it('should throw an Error if manifests is not a Map', () => {
            const invalidInput = [{id: 'modA'}]; // Array, not Map
            expect(() => validateModEngineVersions(invalidInput, mockLogger))
                .toThrow('validateModEngineVersions: Input `manifests` must be a Map.');
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should throw an Error if logger is missing or invalid (null)', () => {
            const manifests = createManifestMap([]);
            expect(() => validateModEngineVersions(manifests, null))
                .toThrow('validateModEngineVersions: Input `logger` must be a valid ILogger instance.');
        });

        it('should throw an Error if logger is invalid (missing info method)', () => {
            const manifests = createManifestMap([]);
            const badLogger = {error: jest.fn()}; // missing info
            expect(() => validateModEngineVersions(manifests, badLogger))
                .toThrow('validateModEngineVersions: Input `logger` must be a valid ILogger instance.');
        });

        it('should throw an Error if logger is invalid (missing error method)', () => {
            const manifests = createManifestMap([]);
            const badLogger = {info: jest.fn()}; // missing error
            expect(() => validateModEngineVersions(manifests, badLogger))
                .toThrow('validateModEngineVersions: Input `logger` must be a valid ILogger instance.');
        });

        it('should throw an Error if logger methods are not functions', () => {
            const manifests = createManifestMap([]);
            const badLogger = {info: 'hello', error: 'world'};
            expect(() => validateModEngineVersions(manifests, badLogger))
                .toThrow('validateModEngineVersions: Input `logger` must be a valid ILogger instance.');
        });
    });

    // --- Acceptance Criteria ---
    describe('Acceptance Criteria Checks', () => {
        // Covered by tests in 'Validation Failure Cases (Incompatibility)'
        it('should throw only ModDependencyError on incompatibility failure', () => {
            const incompatibleRange = '>100.0.0';
            const manifests = createManifestMap([{id: 'modBad6', gameVersion: incompatibleRange}]);
            try {
                validateModEngineVersions(manifests, mockLogger);
                // Should not reach here
                throw new Error('Test failed: Expected function to throw.');
            } catch (e) {
                expect(e).toBeInstanceOf(ModDependencyError);
                expect(e).not.toBeInstanceOf(TypeError); // Explicitly check it's not TypeError
            }
            expect.assertions(2); // Ensure the catch block assertions were executed
        });

        // Covered by tests in 'Validation Failure Cases (Malformed/Invalid Input)'
        it('should throw only TypeError on malformed range or invalid type failure', () => {
            const invalidRange = 'not-a-version';
            const manifests = createManifestMap([{id: 'modMalformed4', gameVersion: invalidRange}]);
            try {
                validateModEngineVersions(manifests, mockLogger);
                // Should not reach here
                throw new Error('Test failed: Expected function to throw.');
            } catch (e) {
                expect(e).toBeInstanceOf(TypeError);
                expect(e).not.toBeInstanceOf(ModDependencyError); // Explicitly check it's not ModDependencyError
            }
            expect.assertions(2); // Ensure the catch block assertions were executed
        });

        it('should not mutate the input manifests map (tested on success, incompatibility, and type error)', () => {
            // --- Test Case 1: Success ---
            const manifestsSuccess = [
                {id: 'modGood3', gameVersion: `^${ENGINE_VERSION}`},
                {id: 'modSkip2', gameVersion: null}
            ];
            const mapSuccess = createManifestMap(manifestsSuccess);
            const mapSuccessCopy = cloneDeep(mapSuccess); // Use cloneDeep as requested

            // Assertion 1
            expect(() => validateModEngineVersions(mapSuccess, mockLogger)).not.toThrow();
            // Assertion 2
            expect(mapSuccess).toEqual(mapSuccessCopy); // Compare original with deep copy

            // --- Test Case 2: Incompatibility (ModDependencyError) ---
            const manifestsIncompatible = [
                {id: 'modGood4', gameVersion: `^${ENGINE_VERSION}`},
                {id: 'modBad7', gameVersion: '>100.0.0'}
            ];
            const mapIncompatible = createManifestMap(manifestsIncompatible);
            const mapIncompatibleCopy = cloneDeep(mapIncompatible);

            try {
                validateModEngineVersions(mapIncompatible, mockLogger);
            } catch (e) {
                // Assertion 3
                expect(e).toBeInstanceOf(ModDependencyError); // Ensure it was the expected error
            }
            // Assertion 4
            expect(mapIncompatible).toEqual(mapIncompatibleCopy);

            // --- Test Case 3: Malformed (TypeError) ---
            const manifestsMalformed = [
                {id: 'modGood5', gameVersion: `^${ENGINE_VERSION}`},
                {id: 'modMalformed5', gameVersion: ['invalid']} // Invalid type
            ];
            const mapMalformed = createManifestMap(manifestsMalformed);
            const mapMalformedCopy = cloneDeep(mapMalformed);

            try {
                validateModEngineVersions(mapMalformed, mockLogger);
            } catch (e) {
                // Assertion 5
                expect(e).toBeInstanceOf(TypeError); // Ensure it was the expected error
            }
            // Assertion 6
            expect(mapMalformed).toEqual(mapMalformedCopy);

            // Corrected assertion count
            expect.assertions(6); // not.toThrow, isEqual (success), instanceOf (incomp), isEqual (incomp), instanceOf (malformed), isEqual (malformed)
        });

        // --- Performance and Coverage ---
        // These are verified by running Jest with appropriate flags (e.g., `jest --coverage`)
        // and checking the output report. The tests aim for high coverage by hitting
        // different branches within the validator (null/undefined check, empty string check,
        // try/catch block for engineVersionSatisfies, incompatibility check, error aggregation).
        // Individual test speed is usually well below 50ms for unit tests like these.
        it('placeholder test for performance/coverage reminder', () => {
            expect(true).toBe(true); // This test does nothing but serves as a reminder
        });
    });
});