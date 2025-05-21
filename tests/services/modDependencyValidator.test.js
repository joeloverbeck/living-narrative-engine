// tests/core/services/modDependencyValidator.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ModDependencyValidator from '../../src/modding/modDependencyValidator.js';
import ModDependencyError from '../../src/errors/modDependencyError.js';
// No need to explicitly import semver, the service uses it internally

/**
 * Creates a mock logger instance matching the ILogger interface.
 * @returns {import('../../../src/core/interfaces/coreServices.js').ILogger}
 */
const createMockLogger = () => ({
    info: jest.fn(), // No-op or basic mock
    warn: jest.fn(), // Important: mock for assertions
    error: jest.fn(), // No-op or basic mock
    debug: jest.fn(), // No-op or basic mock
});

/**
 * Helper to create the Map expected by the validator.
 * Keys are lower-cased mod IDs.
 * @param {Array<import('../../../src/core/services/modDependencyValidator.js').ModManifest>} manifestsArray
 * @returns {Map<string, import('../../../src/core/services/modDependencyValidator.js').ModManifest>}
 */
const createManifestMap = (manifestsArray) => {
    const map = new Map();
    for (const manifest of manifestsArray) {
        if (!manifest || !manifest.id) {
            throw new Error('Test setup error: Invalid manifest provided to createManifestMap');
        }
        map.set(manifest.id.toLowerCase(), manifest);
    }
    return map;
};

describe('ModDependencyValidator', () => {
    let mockLogger;

    beforeEach(() => {
        mockLogger = createMockLogger();
        jest.clearAllMocks(); // Clear mocks between tests
    });

    // --- Input Validation ---

    it('should throw if manifests is not a Map', () => {
        expect(() => ModDependencyValidator.validate([], mockLogger))
            .toThrow('ModDependencyValidator.validate: Input `manifests` must be a Map.');
    });

    it('should throw if logger is invalid (missing warn)', () => {
        const invalidLogger = {info: jest.fn(), error: jest.fn(), debug: jest.fn()}; // Missing warn
        const manifests = createManifestMap([]);
        // @ts-expect-error - Testing invalid logger type
        expect(() => ModDependencyValidator.validate(manifests, invalidLogger))
            .toThrow('ModDependencyValidator.validate: Input `logger` must be a valid ILogger instance.');
    });

    it('should throw if logger is null/undefined', () => {
        const manifests = createManifestMap([]);
        // @ts-expect-error - Testing invalid logger type
        expect(() => ModDependencyValidator.validate(manifests, null))
            .toThrow('ModDependencyValidator.validate: Input `logger` must be a valid ILogger instance.');
        // @ts-expect-error - Testing invalid logger type
        expect(() => ModDependencyValidator.validate(manifests, undefined))
            .toThrow('ModDependencyValidator.validate: Input `logger` must be a valid ILogger instance.');
    });


    // --- Coverage Targets ---

    it('1. Happy-path: 3 mods, valid chain', () => {
        const modC = {id: 'ModC', version: '2.0.1'};
        const modB = {id: 'ModB', version: '1.1.0', dependencies: [{id: 'ModC', version: '^2.0.0'}]};
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'ModB', version: '>=1.0.0'}]};
        const manifests = createManifestMap([modA, modB, modC]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('passed'));
    });

    it('2. Missing required dependency', () => {
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'MissingB', version: '1.0.0', required: true}]};
        const manifests = createManifestMap([modA]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(ModDependencyError);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(/Mod 'ModA' requires missing dependency 'MissingB'/);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('3. Version mismatch (use range >=2.0.0)', () => {
        const modB = {id: 'ModB', version: '1.5.0'}; // Does not satisfy >=2.0.0
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'ModB', version: '>=2.0.0', required: true}]};
        const manifests = createManifestMap([modA, modB]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(ModDependencyError);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(/Mod 'ModA' requires dependency 'ModB' version '>=2.0.0', but found version '1.5.0'/);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('4. Optional dependency missing (warn only)', () => {
        const modA = {
            id: 'ModA',
            version: '1.0.0',
            dependencies: [{id: 'MissingB', version: '1.0.0', required: false}]
        };
        const manifests = createManifestMap([modA]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Mod 'ModA' optional dependency 'MissingB' is not loaded.")
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('passed'));
    });

    it('5. Optional dependency bad version (warn only)', () => {
        const modB = {id: 'ModB', version: '1.5.0'}; // Does not satisfy >=2.0.0
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'ModB', version: '>=2.0.0', required: false}]};
        const manifests = createManifestMap([modA, modB]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Mod 'ModA' requires dependency 'ModB' version '>=2.0.0', but found version '1.5.0'. (Optional dependency mismatch)")
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('passed'));
    });

    it('5a. Optional dependency invalid version (warn only)', () => {
        const modB = {id: 'ModB', version: 'totally-invalid'};
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'ModB', version: '>=1.0.0', required: false}]};
        const manifests = createManifestMap([modA, modB]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/Mod 'ModA' dependency 'ModB' has an invalid version format: 'totally-invalid'\. Cannot check optional version requirement\./)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('passed'));
    });

    it('5b. Required dependency invalid version (throws)', () => {
        const modB = {id: 'ModB', version: 'totally-invalid'};
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'ModB', version: '>=1.0.0', required: true}]};
        const manifests = createManifestMap([modA, modB]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(ModDependencyError);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(/Mod 'ModA' dependency 'ModB' has an invalid version format: 'totally-invalid'/);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });


    it('6. Conflict declared by A only', () => {
        const modB = {id: 'ModB', version: '1.0.0'};
        const modA = {id: 'ModA', version: '1.0.0', conflicts: ['ModB']};
        const manifests = createManifestMap([modA, modB]);

        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(ModDependencyError);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(/Mod 'ModA' conflicts with loaded mod 'ModB'/);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('7. Conflict declared by both (double-entry)', () => {
        // This primarily checks that having the conflict listed in both mods doesn't
        // cause duplicate error messages or unexpected behavior.
        const modB = {id: 'ModB', version: '1.0.0', conflicts: ['ModA']};
        const modA = {id: 'ModA', version: '1.0.0', conflicts: ['ModB']};
        const manifests = createManifestMap([modA, modB]);

        let capturedError = null;
        try {
            ModDependencyValidator.validate(manifests, mockLogger);
        } catch (e) {
            capturedError = e;
        }

        expect(capturedError).toBeInstanceOf(ModDependencyError);
        // Expect *two* conflict messages, one from A's perspective, one from B's.
        expect(capturedError.message).toContain("Mod 'ModA' conflicts with loaded mod 'ModB'");
        expect(capturedError.message).toContain("Mod 'ModB' conflicts with loaded mod 'ModA'");
        expect(capturedError.message.split('\n').length).toBe(2); // Ensure only two lines
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('8. Case-insensitive id matching (dependencies and conflicts)', () => {
        const modB_Upper = {id: 'ModB', version: '1.0.0'};
        const modC_Lower = {id: 'modc', version: '1.0.0'};
        // ModA refers to deps/conflicts using different casing than their actual IDs
        const modA = {
            id: 'ModA',
            version: '1.0.0',
            dependencies: [{id: 'modb', version: '^1.0.0'}], // Requires 'ModB' via lowercase
            conflicts: ['ModC'] // Conflicts with 'modc' via uppercase
        };
        const manifests = createManifestMap([modA, modB_Upper, modC_Lower]);

        // Should NOT throw for dependency (modb finds ModB)
        // SHOULD throw for conflict (ModC finds modc)
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(ModDependencyError);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(/Mod 'ModA' conflicts with loaded mod 'ModC'/); // Conflict message uses the ID from ModA's manifest

        // Check that no dependency error occurred
        let capturedError = null;
        try {
            ModDependencyValidator.validate(manifests, mockLogger);
        } catch (e) {
            capturedError = e;
        }
        expect(capturedError.message).not.toContain('requires missing dependency');
        expect(capturedError.message).not.toContain('version mismatch');

        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('9. Multiple simultaneous failures aggregated into single throw', () => {
        const modA = {
            id: 'ModA',
            version: '1.0.0',
            dependencies: [{id: 'ModB', version: '>=2.0.0'}],
            conflicts: ['ModD']
        }; // ModB version mismatch, conflicts ModD
        const modB = {id: 'ModB', version: '1.5.0'}; // Present but wrong version for A
        const modC = {id: 'ModC', version: '1.0.0', dependencies: [{id: 'MissingE', version: '1.0.0'}]}; // Missing required MissingE
        const modD = {id: 'ModD', version: '1.0.0'}; // Present, conflicts with A
        // ModE is missing

        const manifests = createManifestMap([modA, modB, modC, modD]);

        let capturedError = null;
        try {
            ModDependencyValidator.validate(manifests, mockLogger);
        } catch (e) {
            capturedError = e;
        }

        expect(capturedError).toBeInstanceOf(ModDependencyError);
        const errorMessages = capturedError.message.split('\n');

        // Expect exactly 3 fatal errors aggregated
        expect(errorMessages.length).toBe(3);
        expect(errorMessages).toContain("Mod 'ModA' requires dependency 'ModB' version '>=2.0.0', but found version '1.5.0'."); // From ModA -> ModB check
        expect(errorMessages).toContain("Mod 'ModA' conflicts with loaded mod 'ModD'."); // From ModA -> ModD check
        expect(errorMessages).toContain("Mod 'ModC' requires missing dependency 'MissingE'."); // From ModC -> MissingE check

        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    // --- Additional Edge Cases ---

    it('should pass if dependencies array is present but empty', () => {
        const modA = {id: 'ModA', version: '1.0.0', dependencies: []};
        const manifests = createManifestMap([modA]);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should pass if conflicts array is present but empty', () => {
        const modA = {id: 'ModA', version: '1.0.0', conflicts: []};
        const manifests = createManifestMap([modA]);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should pass if dependencies or conflicts properties are missing', () => {
        const modA = {id: 'ModA', version: '1.0.0'}; // No deps, no conflicts props
        const manifests = createManifestMap([modA]);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger)).not.toThrow();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle dependency object missing required field (defaults to required=true)', () => {
        // Dependency object is just { id: 'MissingB', version: '1.0.0' }
        const modA = {id: 'ModA', version: '1.0.0', dependencies: [{id: 'MissingB', version: '1.0.0'}]};
        const manifests = createManifestMap([modA]);

        // Should behave like a missing *required* dependency
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(ModDependencyError);
        expect(() => ModDependencyValidator.validate(manifests, mockLogger))
            .toThrow(/Mod 'ModA' requires missing dependency 'MissingB'/);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

});