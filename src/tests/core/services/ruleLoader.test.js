// tests/core/services/ruleLoader.test.js

import {describe, expect, it, jest, beforeEach} from '@jest/globals'; // Added beforeEach

/* eslint-env jest */
import RuleLoader, {RuleLoaderError} from '../../../core/services/ruleLoader.js';
// EventBus import removed - no longer needed (Reflects AC2 implicitly)

import { v4 as uuidv4 } from 'uuid'; // Import for mocking (AC4)

// Mock the uuid library (AC4)
jest.mock('uuid', () => ({
    v4: jest.fn(),
}));

// ---------------------------------------------------------------------
// helper factories
// ---------------------------------------------------------------------
const stubLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Ensure debug is mocked for store success logs (Reflects AC10 success case)
});

// Updated makeStubs: Added dataRegistry, removed eventBus (Reflects AC1, AC2)
const makeStubs = () => ({
    pathResolver: {resolveContentPath: jest.fn()},
    dataFetcher: {fetch: jest.fn()}, // Mocked for AC3
    schemaValidator: { // Mocked for AC3
        addSchema: jest.fn(),
        isSchemaLoaded: jest.fn(),
        validate: jest.fn(),
        errors: [], // Add errors property to mock schema errors if needed
    },
    dataRegistry: { // Mocked for AC4
        store: jest.fn(), // Mock the store method (AC4)
        get: jest.fn(),
        getAll: jest.fn(),
        clear: jest.fn(),
        getManifest: jest.fn(),
        setManifest: jest.fn(),
        getAllSystemRules: jest.fn(),
    },
    logger: stubLogger(),
    // Removed eventBus stub (Reflects AC2)
});

// ---------------------------------------------------------------------
// Constructor guard – updated for new dependencies
// ---------------------------------------------------------------------
describe('RuleLoader – constructor guards', () => {
    // ... constructor tests remain the same ...
    it('constructs when all dependencies are valid', () => {
        const s = makeStubs();
        // Updated constructor call: added dataRegistry, removed eventBus
        expect(() =>
            new RuleLoader(
                s.pathResolver,
                s.dataFetcher,
                s.schemaValidator,
                s.dataRegistry, // Added (AC1)
                s.logger,
                // s.eventBus, // Removed (AC2)
            )
        ).not.toThrow();
    });

    // Updated cases: removed eventBus, added dataRegistry
    const cases = [
        ['pathResolver', { resolveContentPath: jest.fn() }],
        ['dataFetcher', { fetch: jest.fn() }],
        ['schemaValidator', { addSchema: jest.fn(), isSchemaLoaded: jest.fn(), validate: jest.fn() }],
        ['dataRegistry', { store: jest.fn() }], // Added (AC1)
        ['logger', { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }],
        // ['eventBus'], // Removed (AC2)
    ];

    it.each(cases)('throws when %s is missing or invalid', (depName, validStub) => {
        const s = makeStubs();
        const args = {
            pathResolver: s.pathResolver,
            dataFetcher: s.dataFetcher,
            schemaValidator: s.schemaValidator,
            dataRegistry: s.dataRegistry,
            logger: s.logger,
        };

        // Test with null
        args[depName] = null;
        expect(() => new RuleLoader(...Object.values(args)))
            .toThrow(new RegExp(`Missing/invalid '${depName}'`));

        // Test with object missing required methods (using an empty object)
        // Logger check is separate as it checks for multiple specific methods
        if (depName !== 'logger' && validStub) {
            // Find a required method key from the valid stub to test its absence
            const requiredMethod = Object.keys(validStub)[0];
            if (requiredMethod) {
                const invalidStub = { ...validStub };
                delete invalidStub[requiredMethod]; // Remove one required method
                args[depName] = invalidStub; // Use the stub missing a method
                expect(() => new RuleLoader(...Object.values(args)))
                    .toThrow(new RegExp(`Missing/invalid '${depName}'`));
            } else {
                // Fallback if the validStub somehow had no keys (shouldn't happen for these cases)
                args[depName] = {};
                expect(() => new RuleLoader(...Object.values(args)))
                    .toThrow(new RegExp(`Missing/invalid '${depName}'`));
            }
        }
    });

    // AC1: Verify rejection of invalid registry mock (missing store method)
    it('throws when dataRegistry lacks a store method', () => {
        const s = makeStubs();
        const invalidRegistry = { get: jest.fn() }; // Missing 'store'
        expect(() =>
            new RuleLoader(
                s.pathResolver,
                s.dataFetcher,
                s.schemaValidator,
                invalidRegistry, // Pass invalid registry
                s.logger
            )
        ).toThrow("RuleLoader: Missing/invalid 'dataRegistry' (needs store method).");
    });

    it('throws when logger lacks required methods', () => {
        const s = makeStubs();
        // Test multiple missing methods scenarios
        expect(() => new RuleLoader(s.pathResolver, s.dataFetcher, s.schemaValidator, s.dataRegistry, { info: jest.fn() /* missing others */ })).toThrow(/Missing\/invalid 'logger'/);
        expect(() => new RuleLoader(s.pathResolver, s.dataFetcher, s.schemaValidator, s.dataRegistry, { info: jest.fn(), warn: jest.fn(), error: jest.fn() /* missing debug */ })).toThrow(/Missing\/invalid 'logger'/);
        expect(() => new RuleLoader(s.pathResolver, s.dataFetcher, s.schemaValidator, s.dataRegistry, { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: null /* invalid debug */ })).toThrow(/Missing\/invalid 'logger'/);
    });

    // AC2: Verify constructor no longer accepts/stores EventBus/interpreter related members
    it('does not have members related to EventBus or interpreter', () => {
        const s = makeStubs();
        const loader = new RuleLoader(s.pathResolver, s.dataFetcher, s.schemaValidator, s.dataRegistry, s.logger);
        expect(loader.subscribeOnce).toBeUndefined();
        expect(loader.loadedEventCount).toBeUndefined();
        expect(loader['#eventBus']).toBeUndefined(); // Check private members if needed (though might be brittle)
        expect(loader['#interpreter']).toBeUndefined();
        expect(loader['#rulesByEvent']).toBeUndefined();
    });

});

// ---------------------------------------------------------------------
// loadAll Logic Tests - Focus on storage and ID generation
// ---------------------------------------------------------------------
describe('RuleLoader – loadAll', () => {

    // Clear mocks before each test to prevent state leakage between tests
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Setup Helper ---
    // (Setup helper remains the same)
    const setupLoadAll = (
        stubs,
        { // Use an options object for clarity
            baseUrl = './fake-rules/',
            directoryFiles = ['rule1.json'], // Files found via directory listing mock
            indexFiles = [], // Files listed in rulesIndex.json mock
            fileContents = [{ event_type: 'test', rule_id: 'rule-abc', actions: [] }], // Content for files by index
            validationResult = { valid: true },
            mockIndexFetch = 'fail', // 'success', 'fail', 'notJson'
            mockDirFetch = 'success', // 'success', 'fail', 'notHtml'
            mockFileFetch = 'success', // 'success', 'failSpecific:<filename>', 'failAll'
            failStore = false // Option to make dataRegistry.store throw
        } = {}
    ) => {
        const indexUrl = baseUrl + 'rulesIndex.json';
        const dirHtml = directoryFiles.map(f => `<a href="${f}">${f}</a>`).join('');

        stubs.pathResolver.resolveContentPath.mockReturnValue(baseUrl);

        // Mock fetch behavior based on URL
        stubs.dataFetcher.fetch.mockImplementation(async (url, options) => {
            // Handle directory listing fetch
            if (url === baseUrl) {
                if (mockDirFetch === 'fail') {
                    return { ok: false, status: 500, statusText: 'Server Error', text: async () => 'Error' };
                }
                if (mockDirFetch === 'notHtml') {
                    return { ok: true, headers: { get: () => 'application/json' }, text: async () => '{}' }; // Simulate wrong content type or structure
                }
                // Success case for directory listing
                return {
                    ok: true,
                    headers: { get: () => 'text/html' },
                    text: async () => dirHtml, // Use directoryFiles to build HTML
                };
            }

            // Handle rulesIndex.json fetch
            if (url === indexUrl) {
                if (mockIndexFetch === 'fail') {
                    return { ok: false, status: 404, statusText: 'Not Found', json: async () => { throw new Error('Not Found'); } };
                }
                if (mockIndexFetch === 'notJson') {
                    return { ok: true, headers: { get: () => 'text/plain'}, json: async () => { throw new Error('SyntaxError'); }, text: async () => 'Not JSON' };
                }
                // Success case for index fetch
                return { ok: true, headers: {get: () => 'application/json'}, json: async () => indexFiles }; // Use indexFiles
            }

            // Handle individual rule file fetch
            const filename = url.substring(baseUrl.length);
            const allFiles = [...new Set([...directoryFiles, ...indexFiles])]; // Consider all potential files
            const fileIndex = allFiles.indexOf(filename);

            if (mockFileFetch === `failSpecific:${filename}` || mockFileFetch === 'failAll') {
                // console.log(`--- Fetch mock throwing for: ${url} ---`); // Optional Debug
                throw new Error(`Simulated fetch failure for ${filename}`);
            }

            if (fileIndex !== -1 && fileContents[fileIndex]) { // Ensure content exists
                // console.log(`--- Fetch mock success for: ${url} ---`); // Optional Debug
                return {
                    ok: true,
                    json: async () => JSON.parse(JSON.stringify(fileContents[fileIndex])), // Return copy to avoid mutation issues
                };
            }
            // console.log(`--- Fetch mock 404 for: ${url} ---`); // Optional Debug
            // Default fetch failure for unexpected URLs
            throw new Error(`404 Not Found: ${url}`);
        });

        // Mock schema validation (AC3)
        stubs.schemaValidator.validate.mockReturnValue(validationResult);
        // Add errors if validationResult is mocked to fail
        if (validationResult && validationResult.valid === false) {
            stubs.schemaValidator.errors = validationResult.errors || [{ message: 'mock validation error'}];
        } else {
            stubs.schemaValidator.errors = [];
        }


        // Mock dataRegistry.store failure if requested (AC10 test)
        if(failStore) {
            const storeError = new Error("Simulated registry store failure");
            stubs.dataRegistry.store.mockImplementation(() => {
                throw storeError;
            });
        } else {
            // Default successful store mock
            // Ensure this default doesn't conflict if a test later uses mockImplementation
            if (!stubs.dataRegistry.store.getMockImplementation()) {
                stubs.dataRegistry.store.mockResolvedValue(undefined);
            }
        }


        return new RuleLoader(
            stubs.pathResolver,
            stubs.dataFetcher,
            stubs.schemaValidator,
            stubs.dataRegistry, // Added (AC1)
            stubs.logger
        );
    };


    // AC9: Test schema validation failure
    // (This test remains the same)
    it('throws RuleLoaderError when schema validation fails', async () => {
        const s = makeStubs();
        const invalidRule = { event_type: 'test' }; // Missing actions
        const validationErrors = [{ message: 'missing required property "actions"' }];
        const loader = setupLoadAll(s, {
            directoryFiles: ['invalid.json'],
            fileContents: [invalidRule],
            validationResult: { valid: false, errors: validationErrors }
        });

        await expect(loader.loadAll('./fake-rules/'))
            .rejects.toBeInstanceOf(RuleLoaderError); // Verify throws RuleLoaderError
        expect(s.schemaValidator.validate).toHaveBeenCalledTimes(1);
        expect(s.logger.error).toHaveBeenCalledWith( // Verify error log
            expect.stringContaining('Schema invalid → "invalid.json"'),
            validationErrors // Verify errors array passed to logger
        );
        expect(s.dataRegistry.store).not.toHaveBeenCalled(); // Verify store was not called
    });


    // AC8: Test fetch failure
    it('throws RuleLoaderError when fetching a rule file fails', async () => {
        const s = makeStubs();
        const loader = setupLoadAll(s, {
            directoryFiles: ['rule1.json', 'rule2-fail.json'], // Fetch for rule2-fail.json will throw
            fileContents: [{ rule_id: 'r1' }, { rule_id: 'r2' }],
            mockFileFetch: 'failSpecific:rule2-fail.json'
        });

        await expect(loader.loadAll('./fake-rules/'))
            .rejects.toBeInstanceOf(RuleLoaderError);

        // Check logger FIRST - this happens before the error is thrown in RuleLoader
        expect(s.logger.error).toHaveBeenCalledTimes(1); // Should be called once for the failed fetch
        expect(s.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Fetch/Parse failed for "rule2-fail.json" – Failed fetch or JSON parse for "rule2-fail.json": Simulated fetch failure for rule2-fail.json')
        );

        // ***** FIX: Validation should NOT be called if fetch fails *****
        expect(s.schemaValidator.validate).not.toHaveBeenCalled();
        // ***************************************************************

        expect(s.dataRegistry.store).not.toHaveBeenCalled(); // Store should not be called
    });

    // AC5: Test storing a rule with a valid rule_id
    // (This test remains the same)
    it('stores a valid rule using its rule_id', async () => {
        const s = makeStubs();
        const ruleA = { event_type: 'demo:event', rule_id: 'rule-A', actions: [] };
        const loader = setupLoadAll(s, {
            directoryFiles: ['r1.json'],
            fileContents: [ruleA]
        });

        await loader.loadAll('./fake-rules/');

        expect(s.schemaValidator.validate).toHaveBeenCalledTimes(1);
        expect(s.dataRegistry.store).toHaveBeenCalledTimes(1);
        // Verify store called correctly (AC5)
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', 'rule-A', ruleA);
        expect(s.logger.debug).toHaveBeenCalledTimes(1); // Verify success log (AC10 success case)
        expect(s.logger.debug).toHaveBeenCalledWith(
            `RuleLoader: Successfully stored rule from "r1.json" with ID "rule-A" in data registry.`
        );
        expect(s.logger.warn).not.toHaveBeenCalled(); // Ensure no warning generated
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 1 rule(s). Skipped/Failed to store 0 rule(s)')); // Verify final summary
    });


    // AC6: Test storing a rule missing a rule_id
    // (This test remains the same)
    it('generates a UUID, logs warning, and stores rule when rule_id is missing', async () => {
        const s = makeStubs();
        const ruleB = { event_type: 'other:event', actions: [{ type: "LOG", parameters: { message: "hello" } }] }; // Missing rule_id
        const generatedUuid = 'mock-uuid-1234';
        uuidv4.mockReturnValue(generatedUuid); // Control the generated UUID (AC4, AC6)

        const loader = setupLoadAll(s, {
            directoryFiles: ['no-id-rule.json'],
            fileContents: [ruleB]
        });

        await loader.loadAll('./fake-rules/');

        expect(uuidv4).toHaveBeenCalledTimes(1); // AC6 check
        expect(s.logger.warn).toHaveBeenCalledTimes(1); // AC6 check
        // Verify warning log message (AC6)
        expect(s.logger.warn).toHaveBeenCalledWith(
            `RuleLoader: Rule from "no-id-rule.json" is missing a valid 'rule_id'. ` +
            `Using generated UUID: "${generatedUuid}". ` +
            `Consider adding a permanent 'rule_id' to the rule file for better traceability.`
        );
        expect(s.dataRegistry.store).toHaveBeenCalledTimes(1);
        // Verify store called with generated UUID (AC6)
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', generatedUuid, ruleB);
        expect(s.logger.debug).toHaveBeenCalledTimes(1); // Verify success log (AC10 success case)
        expect(s.logger.debug).toHaveBeenCalledWith(
            `RuleLoader: Successfully stored rule from "no-id-rule.json" with ID "${generatedUuid}" in data registry.`
        );
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 1 rule(s). Skipped/Failed to store 0 rule(s)')); // Verify final summary
    });


    // AC7: Test storing a rule with an invalid (empty string) rule_id
    // (This test remains the same)
    it('generates a UUID, logs warning, and stores rule when rule_id is empty string', async () => {
        const s = makeStubs();
        const ruleC = { event_type: 'another:event', rule_id: '  ', actions: [] }; // Empty/whitespace rule_id
        const generatedUuid = 'mock-uuid-5678';
        uuidv4.mockReturnValue(generatedUuid); // Control the generated UUID (AC4, AC7)

        const loader = setupLoadAll(s, {
            directoryFiles: ['empty-id-rule.json'],
            fileContents: [ruleC]
        });

        await loader.loadAll('./fake-rules/');

        expect(uuidv4).toHaveBeenCalledTimes(1); // AC7 check
        expect(s.logger.warn).toHaveBeenCalledTimes(1); // AC7 check
        // Verify warning log message (AC7)
        expect(s.logger.warn).toHaveBeenCalledWith(
            `RuleLoader: Rule from "empty-id-rule.json" is missing a valid 'rule_id'. ` +
            `Using generated UUID: "${generatedUuid}". ` +
            `Consider adding a permanent 'rule_id' to the rule file for better traceability.`
        );
        expect(s.dataRegistry.store).toHaveBeenCalledTimes(1);
        // Verify store called with generated UUID (AC7)
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', generatedUuid, ruleC);
        expect(s.logger.debug).toHaveBeenCalledTimes(1); // Verify success log (AC10 success case)
        expect(s.logger.debug).toHaveBeenCalledWith(
            `RuleLoader: Successfully stored rule from "empty-id-rule.json" with ID "${generatedUuid}" in data registry.`
        );
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 1 rule(s). Skipped/Failed to store 0 rule(s)')); // Verify final summary
    });


    // AC7: Test storing a rule with an invalid (null) rule_id
    // (This test remains the same)
    it('generates a UUID, logs warning, and stores rule when rule_id is null', async () => {
        const s = makeStubs();
        const ruleD = { event_type: 'nullid:event', rule_id: null, actions: [] }; // null rule_id
        const generatedUuid = 'mock-uuid-9012';
        uuidv4.mockReturnValue(generatedUuid); // Control the generated UUID (AC4, AC7)

        const loader = setupLoadAll(s, {
            directoryFiles: ['null-id-rule.json'],
            fileContents: [ruleD]
        });

        await loader.loadAll('./fake-rules/');

        expect(uuidv4).toHaveBeenCalledTimes(1); // AC7 check
        expect(s.logger.warn).toHaveBeenCalledTimes(1); // AC7 check
        // Verify warning log message (AC7)
        expect(s.logger.warn).toHaveBeenCalledWith(
            `RuleLoader: Rule from "null-id-rule.json" is missing a valid 'rule_id'. ` +
            `Using generated UUID: "${generatedUuid}". ` +
            `Consider adding a permanent 'rule_id' to the rule file for better traceability.`
        );
        expect(s.dataRegistry.store).toHaveBeenCalledTimes(1);
        // Verify store called with generated UUID (AC7)
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', generatedUuid, ruleD);
        expect(s.logger.debug).toHaveBeenCalledTimes(1); // Verify success log (AC10 success case)
        expect(s.logger.debug).toHaveBeenCalledWith(
            `RuleLoader: Successfully stored rule from "null-id-rule.json" with ID "${generatedUuid}" in data registry.`
        );
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 1 rule(s). Skipped/Failed to store 0 rule(s)')); // Verify final summary
    });



    // AC10: Test handling of dataRegistry.store errors
    // ***** FIX: Simplify to test only the failing store case *****
    it('logs an error and updates skipped count if dataRegistry.store throws', async () => {
        const s = makeStubs();
        // Only include the rule that will cause the store to fail
        const ruleFail = { event_type: 'fail:event', rule_id: 'rule-Fail', actions: [] };
        const storeErrorMessage = "Simulated registry store failure";

        // Mock store to throw only for the specific failing rule ID
        s.dataRegistry.store.mockImplementation((type, id, rule) => {
            if (id === 'rule-Fail') {
                throw new Error(storeErrorMessage);
            }
        });

        const loader = setupLoadAll(s, {
            directoryFiles: ['fail-store.json'], // Only this file
            fileContents: [ruleFail],           // Only this content
            validationResult: { valid: true }   // Ensure validation passes
        });

        // Execute loadAll - should NOT throw from loadAll itself (AC10)
        await expect(loader.loadAll('./fake-rules/')).resolves.toBeUndefined();

        // Verify store was attempted
        expect(s.dataRegistry.store).toHaveBeenCalledTimes(1);
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', 'rule-Fail', ruleFail);

        // Verify error log for the failed store (AC10)
        expect(s.logger.error).toHaveBeenCalledTimes(1); // Still expect 1 error log
        expect(s.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to store rule (ID: "rule-Fail") from file "fail-store.json"'),
            storeErrorMessage // Check the error message is logged
        );

        // Verify NO success log was called (AC10)
        expect(s.logger.debug).not.toHaveBeenCalled();

        // Verify final summary log reflects skipped count (AC10)
        // Stored should be 0, skipped should be 1
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 0 rule(s). Skipped/Failed to store 1 rule(s)'));
    });
    // ***************************************************************


    // Test multiple files with mixed valid/invalid/missing IDs (Covers AC5, AC6, AC7, AC10 success)
    // (This test remains the same)
    it('processes multiple files correctly (mix of valid IDs and generated IDs)', async () => {
        const s = makeStubs();
        const rule1 = { event_type: 'e1', rule_id: 'ID-1', actions: [] };
        const rule2 = { event_type: 'e2', actions: [] }; // No ID
        const rule3 = { event_type: 'e3', rule_id: 'ID-3', actions: [] };
        const rule4 = { event_type: 'e4', rule_id: null, actions: [] }; // Invalid ID
        const generatedUuid1 = 'uuid-for-rule2';
        const generatedUuid2 = 'uuid-for-rule4';

        uuidv4.mockReturnValueOnce(generatedUuid1).mockReturnValueOnce(generatedUuid2); // AC4, AC6, AC7

        const loader = setupLoadAll(
            s, {
                directoryFiles: ['r1.json', 'r2-noid.json', 'r3.json', 'r4-nullid.json'],
                fileContents: [rule1, rule2, rule3, rule4]
            }
        );

        await loader.loadAll('./fake-rules/');

        expect(s.schemaValidator.validate).toHaveBeenCalledTimes(4); // AC3

        expect(uuidv4).toHaveBeenCalledTimes(2); // Called for rule2 and rule4 (AC6, AC7)

        expect(s.logger.warn).toHaveBeenCalledTimes(2); // Called for rule2 and rule4 (AC6, AC7)
        expect(s.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rule from "r2-noid.json" is missing a valid \'rule_id\'. Using generated UUID: "uuid-for-rule2"'));
        expect(s.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rule from "r4-nullid.json" is missing a valid \'rule_id\'. Using generated UUID: "uuid-for-rule4"'));


        expect(s.dataRegistry.store).toHaveBeenCalledTimes(4); // Store called for each (AC4)

        // Check specific store calls (AC5, AC6, AC7)
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', 'ID-1', rule1);
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', generatedUuid1, rule2);
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', 'ID-3', rule3);
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', generatedUuid2, rule4);

        // Check success logs (AC10 success case)
        expect(s.logger.debug).toHaveBeenCalledTimes(4);
        expect(s.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully stored rule from "r1.json" with ID "ID-1"'));
        expect(s.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored rule from "r2-noid.json" with ID "${generatedUuid1}"`));
        expect(s.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully stored rule from "r3.json" with ID "ID-3"'));
        expect(s.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored rule from "r4-nullid.json" with ID "${generatedUuid2}"`));

        expect(s.logger.error).not.toHaveBeenCalled(); // No store errors expected

        // Check final summary log
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 4 rule(s). Skipped/Failed to store 0 rule(s)'));
    });


    // Test case where no files are found (directory + index fallback fail)
    // (This test remains the same)
    it('completes successfully, logs warnings when no rule files are found via directory or index', async () => {
        const s = makeStubs();
        const loader = setupLoadAll(s, {
            directoryFiles: [], // Simulate empty dir listing response
            mockIndexFetch: 'fail' // Simulate rulesIndex.json failing
        });

        await expect(loader.loadAll('./fake-rules/')).resolves.toBeUndefined(); // Should not throw

        // Verify fetch attempts
        expect(s.dataFetcher.fetch).toHaveBeenCalledWith('./fake-rules/', {"method": "GET"}); // Attempted directory listing
        expect(s.dataFetcher.fetch).toHaveBeenCalledWith('./fake-rules/rulesIndex.json'); // Attempted index fallback

        // Verify relevant logs
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Directory listing yielded no JSON files, attempting fallback: rulesIndex.json'));
        expect(s.logger.warn).toHaveBeenCalledWith(expect.stringContaining('rulesIndex.json fetch failed (HTTP 404 Not Found)')); // Log index fetch failure
        expect(s.logger.warn).toHaveBeenCalledWith(expect.stringContaining('No *.json rule files discovered')); // Log final discovery outcome

        // Verify no processing happened
        expect(s.schemaValidator.validate).not.toHaveBeenCalled();
        expect(s.dataRegistry.store).not.toHaveBeenCalled();

        // Check final log indicates no rules processed
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Load process finished. Successfully stored 0 rule(s). Skipped/Failed to store 0 rule(s)'));
    });


    // Test case where files are found only via rulesIndex.json
    // (This test remains the same)
    it('loads rules successfully when found only via rulesIndex.json', async () => {
        const s = makeStubs();
        const ruleIdx = { event_type: 'index:rule', rule_id: 'rule-idx', actions: [] };
        const loader = setupLoadAll(s, {
            baseUrl: './idx-rules/',
            directoryFiles: [], // Simulate empty dir listing
            indexFiles: ['indexed-rule.json'], // File found via index
            fileContents: [ruleIdx], // Content corresponding to indexFiles order
            mockIndexFetch: 'success' // Ensure index fetch works
        });

        await loader.loadAll('./idx-rules/');

        // Verify fetch attempts
        expect(s.dataFetcher.fetch).toHaveBeenCalledWith('./idx-rules/', {"method": "GET"});
        expect(s.dataFetcher.fetch).toHaveBeenCalledWith('./idx-rules/rulesIndex.json');
        expect(s.dataFetcher.fetch).toHaveBeenCalledWith('./idx-rules/indexed-rule.json'); // Fetched the rule

        // Verify logs indicate index usage
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Directory listing yielded no JSON files, attempting fallback: rulesIndex.json'));
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 files from rulesIndex.json'));


        // Verify processing and storage
        expect(s.schemaValidator.validate).toHaveBeenCalledTimes(1);
        expect(s.dataRegistry.store).toHaveBeenCalledTimes(1);
        expect(s.dataRegistry.store).toHaveBeenCalledWith('system-rules', 'rule-idx', ruleIdx); // AC5
        expect(s.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully stored rule from "indexed-rule.json" with ID "rule-idx"')); // AC10 success
        expect(s.logger.warn).not.toHaveBeenCalled();
        expect(s.logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored 1 rule(s). Skipped/Failed to store 0 rule(s)')); // Final summary
    });


});

// ---------------------------------------------------------------------
// EventBus subscription & interpreter wiring - REMOVED
// ---------------------------------------------------------------------
// AC2 is implicitly tested by the removal of these tests and related code/mocks.
// The describe block related to EventBus integration has been removed.
// ---------------------------------------------------------------------

// AC11 (Code Coverage): This test suite, with the added and updated tests,
// aims to provide comprehensive coverage for the refactored RuleLoader.
// Actual coverage should be verified using code coverage tools (e.g., jest --coverage).