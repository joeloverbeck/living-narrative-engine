// Filename: test/integration/worldLoader.dependencyError.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../core/services/worldLoader.js';

// --- Dependencies to Mock/Import ---
import ModDependencyError from '../../core/errors/modDependencyError.js';
import { ENGINE_VERSION } from '../../core/engineVersion.js'; // Import for checking messages

// Mock static/imported functions BEFORE importing WorldLoader
import * as ModDependencyValidatorModule from '../../core/services/modDependencyValidator.js';
jest.mock('../../core/services/modDependencyValidator.js', () => ({
    validate: jest.fn(), // Mock the static validate method
}));

import * as ModVersionValidatorModule from '../../core/services/modVersionValidator.js';
jest.mock('../../core/services/modVersionValidator.js', () => jest.fn()); // Mock the default export function

import * as ModLoadOrderResolverModule from '../../core/services/modLoadOrderResolver.js';
jest.mock('../../core/services/modLoadOrderResolver.js', () => ({
    resolveOrder: jest.fn(), // Mock the exported resolveOrder function
}));

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../core/services/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../core/services/eventLoader.js').default} EventLoader */
/** @typedef {import('../../core/services/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../core/services/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../core/services/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../core/services/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../core/services/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../core/services/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../core/interfaces/manifestItems.js').ModManifest} ModManifest */


describe('WorldLoader Integration Test Suite - Error Handling: Dependency and Version Errors (TEST-LOADER-7.5)', () => {
    /** @type {WorldLoader} */
    let worldLoader;

    // --- Mock Instances ---
    /** @type {jest.Mocked<IDataRegistry>} */
    let mockRegistry;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<SchemaLoader>} */
    let mockSchemaLoader;
    /** @type {jest.Mocked<ComponentLoader>} */
    let mockComponentLoader;
    /** @type {jest.Mocked<RuleLoader>} */
    let mockRuleLoader;
    /** @type {jest.Mocked<ActionLoader>} */
    let mockActionLoader;
    /** @type {jest.Mocked<EventLoader>} */
    let mockEventLoader;
    /** @type {jest.Mocked<EntityLoader>} */
    let mockEntityLoader;
    /** @type {jest.Mocked<ISchemaValidator>} */
    let mockValidator;
    /** @type {jest.Mocked<IConfiguration>} */
    let mockConfiguration;
    /** @type {jest.Mocked<GameConfigLoader>} */
    let mockGameConfigLoader;
    /** @type {jest.Mocked<ModManifestLoader>} */
    let mockModManifestLoader;

    // --- Mock Data ---
    /** @type {ModManifest} */
    let coreManifest;
    /** @type {ModManifest} */
    let modAManifest;
    /** @type {ModManifest} */
    let modBManifest;
    /** @type {Map<string, ModManifest>} */
    let mockManifestMap;
    const coreModId = 'core';
    const modAId = 'modA';
    const modBId = 'modB';
    const worldName = 'testWorldDependencyError';

    // --- Mocked Functions (from imports) ---
    // Use descriptive names for the mocked functions
    const mockDependencyValidate = ModDependencyValidatorModule.validate;
    const mockEngineVersionValidate = ModVersionValidatorModule.default; // Assuming it's the default export
    const mockResolveOrder = ModLoadOrderResolverModule.resolveOrder;

    beforeEach(() => {
        jest.clearAllMocks(); // Reset mocks between tests

        // --- 1. Create Mocks ---
        mockRegistry = {
            store: jest.fn(),
            get: jest.fn(),
            getAll: jest.fn(() => []),
            clear: jest.fn(), // Spy on clear
            // Basic mocks for other methods
            getAllSystemRules: jest.fn(() => []),
            getManifest: jest.fn(() => null),
            setManifest: jest.fn(),
            getEntityDefinition: jest.fn(),
            getItemDefinition: jest.fn(),
            getLocationDefinition: jest.fn(),
            getConnectionDefinition: jest.fn(),
            getBlockerDefinition: jest.fn(),
            getActionDefinition: jest.fn(),
            getEventDefinition: jest.fn(),
            getComponentDefinition: jest.fn(),
            getAllEntityDefinitions: jest.fn(() => []),
            getAllItemDefinitions: jest.fn(() => []),
            getAllLocationDefinitions: jest.fn(() => []),
            getAllConnectionDefinitions: jest.fn(() => []),
            getAllBlockerDefinitions: jest.fn(() => []),
            getAllActionDefinitions: jest.fn(() => []),
            getAllEventDefinitions: jest.fn(() => []),
            getAllComponentDefinitions: jest.fn(() => []),
            getStartingPlayerId: jest.fn(() => null),
            getStartingLocationId: jest.fn(() => null),
        };
        mockLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(), // Spy on error
        };
        mockSchemaLoader = {
            loadAndCompileAllSchemas: jest.fn(),
        };
        mockValidator = {
            isSchemaLoaded: jest.fn(),
            addSchema: jest.fn(), removeSchema: jest.fn(), getValidator: jest.fn(), validate: jest.fn(),
        };
        mockConfiguration = {
            getContentTypeSchemaId: jest.fn(),
            getBaseDataPath: jest.fn(() => './data'), getSchemaFiles: jest.fn(() => []),
            getSchemaBasePath: jest.fn(() => 'schemas'), getContentBasePath: jest.fn(() => 'content'),
            getWorldBasePath: jest.fn(() => 'worlds'), getGameConfigFilename: jest.fn(() => 'game.json'),
            getModsBasePath: jest.fn(() => 'mods'), getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
        };
        mockGameConfigLoader = { loadConfig: jest.fn() };
        mockModManifestLoader = { loadRequestedManifests: jest.fn() };

        // Mock individual content loaders (needed for constructor validation)
        mockActionLoader = { loadItemsForMod: jest.fn() };
        mockComponentLoader = { loadItemsForMod: jest.fn() };
        mockEventLoader = { loadItemsForMod: jest.fn() };
        mockRuleLoader = { loadItemsForMod: jest.fn() };
        mockEntityLoader = { loadItemsForMod: jest.fn() };

        // --- 2. Define Base Mock Data (can be overridden in tests) ---
        coreManifest = { id: coreModId, version: '1.0.0', name: 'Core', gameVersion: `^${ENGINE_VERSION}`, content: {} }; // Use actual ENGINE_VERSION
        modAManifest = { id: modAId, version: '1.0.0', name: 'Mod A', gameVersion: `^${ENGINE_VERSION}`, content: {} }; // Use actual ENGINE_VERSION
        modBManifest = { id: modBId, version: '1.0.0', name: 'Mod B', gameVersion: `^${ENGINE_VERSION}`, content: {} }; // Use actual ENGINE_VERSION
        mockManifestMap = new Map();


        // --- 3. Configure Mocks (Default Success Paths for steps BEFORE validation) ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

        // Configure IConfiguration for essential schemas
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => `schema:${typeName}`);
        // Configure ISchemaValidator for essential schemas
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            return ['schema:game', 'schema:components', 'schema:mod-manifest', 'schema:entities'].includes(schemaId);
        });

        // Default mocks for validator/resolver - these will be specifically configured to throw in tests
        mockDependencyValidate.mockImplementation(() => { /* Does nothing by default */ });
        mockEngineVersionValidate.mockImplementation(() => { /* Does nothing by default */ });
        mockResolveOrder.mockReturnValue([]); // Default empty array

        // --- 4. Instantiate SUT ---
        worldLoader = new WorldLoader(
            mockRegistry, mockLogger, mockSchemaLoader,
            mockComponentLoader, mockRuleLoader, mockActionLoader,
            mockEventLoader, mockEntityLoader, mockValidator,
            mockConfiguration, mockGameConfigLoader, mockModManifestLoader
        );
    });

    // ── Test Case: Missing Dependency ─────────────────────────────────────
    it('should throw ModDependencyError if a required dependency is missing', async () => {
        // Setup: modA requires modB, but loadRequestedManifests only returns modA.
        modAManifest.dependencies = { [modBId]: '^1.0.0' };
        mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]); // Only request modA
        // Create map with lowercase keys as WorldLoader does for validation
        const validationMap = new Map();
        validationMap.set(modAId.toLowerCase(), modAManifest);
        mockManifestMap.set(modAId, modAManifest); // Loader returns original case key map
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);


        // Configure ModDependencyValidator to throw
        const expectedErrorMessage = `Mod '${modAId}' requires missing dependency '${modBId}'.`;
        const expectedError = new ModDependencyError(expectedErrorMessage);
        // Ensure the mock throws when called with the map WorldLoader provides (lowercase keys)
        mockDependencyValidate.mockImplementationOnce((manifests, logger) => {
            // Quick check if the map structure is as expected
            if (manifests.has(modAId.toLowerCase())) {
                throw expectedError;
            } else {
                // Throw a different error if the mock setup seems wrong, to help debug
                throw new Error("mockDependencyValidate called with unexpected map structure");
            }
        });

        let thrownError = null;
        try {
            // Action: Call loadWorld ONCE
            await worldLoader.loadWorld(worldName);
            // If it reaches here, the test should fail because it didn't throw
            throw new Error('worldLoader.loadWorld should have rejected');
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(ModDependencyError);
        expect(thrownError.message).toContain(expectedErrorMessage); // Or .toBe(expectedErrorMessage)

        // Verify registry cleared twice (start + catch)
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged the critical failure
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL load failure'),
            // Use the actual caught error for comparison
            expect.objectContaining({ error: thrownError })
        );
        // Check the validator was actually called with the correct lowercase map
        expect(mockDependencyValidate).toHaveBeenCalledWith(validationMap, mockLogger);
    });

    // ── Test Case: Conflicting Mods ───────────────────────────────────────
    it('should throw ModDependencyError if conflicting mods are loaded', async () => {
        // Setup: modA conflicts with modB. loadRequestedManifests returns both.
        modAManifest.conflicts = { [modBId]: '*' }; // modA conflicts with any version of modB
        mockGameConfigLoader.loadConfig.mockResolvedValue([modAId, modBId]); // Request both
        mockManifestMap.set(modAId, modAManifest);
        mockManifestMap.set(modBId, modBManifest);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        // Validation map uses lower-case keys
        const validationMap = new Map();
        validationMap.set(modAId.toLowerCase(), modAManifest);
        validationMap.set(modBId.toLowerCase(), modBManifest);

        // Configure ModDependencyValidator to throw
        const expectedErrorMessage = `Mod '${modAId}' conflicts with loaded mod '${modBId}'.`;
        const expectedError = new ModDependencyError(expectedErrorMessage);
        mockDependencyValidate.mockImplementationOnce((manifests, logger) => { throw expectedError; });

        let thrownError = null;
        try {
            // Action: Call loadWorld ONCE
            await worldLoader.loadWorld(worldName);
            throw new Error('worldLoader.loadWorld should have rejected');
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(ModDependencyError);
        expect(thrownError.message).toContain(expectedErrorMessage);

        // Verify registry cleared twice
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL load failure'),
            expect.objectContaining({ error: thrownError })
        );
        // Check validator call
        expect(mockDependencyValidate).toHaveBeenCalledWith(validationMap, mockLogger);
    });

    // ── Test Case: Incompatible Game Version ──────────────────────────────
    it('should throw ModDependencyError if a mod requires an incompatible gameVersion', async () => {
        // Setup: modA has gameVersion incompatible with ENGINE_VERSION.
        const incompatibleVersion = '999.0.0';
        modAManifest.gameVersion = incompatibleVersion;
        mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);
        mockManifestMap.set(modAId, modAManifest);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        // Validation map uses lower-case keys
        const validationMap = new Map();
        validationMap.set(modAId.toLowerCase(), modAManifest);

        // Configure validateModEngineVersions to throw
        const expectedErrorMessage = `Mod '${modAId}' version '${incompatibleVersion}' is incompatible with engine v${ENGINE_VERSION}`;
        const expectedError = new ModDependencyError(expectedErrorMessage);
        mockEngineVersionValidate.mockImplementationOnce((manifests, logger) => { throw expectedError; });

        let thrownError = null;
        try {
            // Action: Call loadWorld ONCE
            await worldLoader.loadWorld(worldName);
            throw new Error('worldLoader.loadWorld should have rejected');
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(ModDependencyError);
        // Use regex for flexibility with version string or check containment
        expect(thrownError.message).toContain(`incompatible with engine v${ENGINE_VERSION}`);
        expect(thrownError.message).toContain(`Mod '${modAId}' version '${incompatibleVersion}'`);


        // Verify registry cleared twice
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL load failure'),
            expect.objectContaining({ error: thrownError })
        );
        // Check validator call
        expect(mockEngineVersionValidate).toHaveBeenCalledWith(validationMap, mockLogger);

    });

    // ── Test Case: Unsatisfiable Dependency Version Range ─────────────────
    it('should throw ModDependencyError if a dependency has an unsatisfiable version range', async () => {
        // Setup: modA requires core version ^2.0.0. core manifest has version 1.0.0.
        const coreActualVersion = '1.0.0';
        const modARequiredCoreVersion = '^2.0.0';
        coreManifest.version = coreActualVersion;
        modAManifest.dependencies = { [coreModId]: modARequiredCoreVersion };
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, modAId]); // Request both
        mockManifestMap.set(coreModId, coreManifest);
        mockManifestMap.set(modAId, modAManifest);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        // Validation map uses lower-case keys
        const validationMap = new Map();
        validationMap.set(coreModId.toLowerCase(), coreManifest);
        validationMap.set(modAId.toLowerCase(), modAManifest);


        // Configure ModDependencyValidator to throw (it handles version checks)
        const expectedErrorMessage = `Mod '${modAId}' requires dependency '${coreModId}' version '${modARequiredCoreVersion}', but found version '${coreActualVersion}'.`;
        const expectedError = new ModDependencyError(expectedErrorMessage);
        mockDependencyValidate.mockImplementationOnce((manifests, logger) => { throw expectedError; });

        let thrownError = null;
        try {
            // Action: Call loadWorld ONCE
            await worldLoader.loadWorld(worldName);
            throw new Error('worldLoader.loadWorld should have rejected');
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(ModDependencyError);
        expect(thrownError.message).toBe(expectedErrorMessage); // Exact match

        // Verify registry cleared twice
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL load failure'),
            expect.objectContaining({ error: thrownError })
        );
        // Check validator call
        expect(mockDependencyValidate).toHaveBeenCalledWith(validationMap, mockLogger);
    });

    // ── Test Case: Ensure Content Loaders Not Called on Pre-Loop Error ────
    it('should not call any content loaders if an error occurs before the loading loop', async () => {
        // Use the missing dependency setup again
        modAManifest.dependencies = { [modBId]: '^1.0.0' };
        mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);
        mockManifestMap.set(modAId, modAManifest);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        const expectedError = new ModDependencyError(`Mod '${modAId}' requires missing dependency '${modBId}'.`);
        mockDependencyValidate.mockImplementationOnce((manifests, logger) => { throw expectedError; });

        let thrownError = null;
        try {
            // Action: Call loadWorld ONCE
            await worldLoader.loadWorld(worldName);
            throw new Error('worldLoader.loadWorld should have rejected');
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(ModDependencyError); // Verify error was thrown

        // Verify none of the content loaders' loadItemsForMod methods were called
        expect(mockActionLoader.loadItemsForMod).not.toHaveBeenCalled();
        expect(mockComponentLoader.loadItemsForMod).not.toHaveBeenCalled();
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
        expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
        expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalled();

        // Verify registry.clear and logger.error were still called
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });
});