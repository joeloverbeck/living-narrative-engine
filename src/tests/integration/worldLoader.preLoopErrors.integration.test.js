// Filename: test/integration/worldLoader.preLoopErrors.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../core/services/worldLoader.js';

// --- Dependencies to Mock/Import ---
import ModDependencyError from '../../core/errors/modDependencyError.js';

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


describe('WorldLoader Integration Test Suite - Error Handling: Manifest Schema, Cycles, Missing Essentials (TEST-LOADER-7.6)', () => {
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
    let mockManifestMap; // Note: Re-initialized per test if needed
    const coreModId = 'core';
    const modAId = 'modA';
    const modBId = 'modB';
    const worldName = 'testWorldPreLoopError';
    const gameSchemaId = 'schema:game';
    const componentSchemaId = 'schema:components';
    const manifestSchemaId = 'schema:mod-manifest';
    const entitySchemaId = 'schema:entities';


    // --- Mocked Functions (from imports) ---
    const mockDependencyValidate = ModDependencyValidatorModule.validate;
    const mockEngineVersionValidate = ModVersionValidatorModule.default;
    const mockResolveOrder = ModLoadOrderResolverModule.resolveOrder;

    beforeEach(() => {
        jest.clearAllMocks(); // Reset mocks between tests

        // --- 1. Create Mocks ---
        mockRegistry = {
            store: jest.fn(),
            get: jest.fn(),
            getAll: jest.fn(() => []),
            clear: jest.fn(), // Spy on clear
            getAllSystemRules: jest.fn(() => []), getManifest: jest.fn(() => null), setManifest: jest.fn(), getEntityDefinition: jest.fn(),
            getItemDefinition: jest.fn(), getLocationDefinition: jest.fn(), getConnectionDefinition: jest.fn(), getBlockerDefinition: jest.fn(),
            getActionDefinition: jest.fn(), getEventDefinition: jest.fn(), getComponentDefinition: jest.fn(), getAllEntityDefinitions: jest.fn(() => []),
            getAllItemDefinitions: jest.fn(() => []), getAllLocationDefinitions: jest.fn(() => []), getAllConnectionDefinitions: jest.fn(() => []),
            getAllBlockerDefinitions: jest.fn(() => []), getAllActionDefinitions: jest.fn(() => []), getAllEventDefinitions: jest.fn(() => []),
            getAllComponentDefinitions: jest.fn(() => []), getStartingPlayerId: jest.fn(() => null), getStartingLocationId: jest.fn(() => null),
        };
        mockLogger = {
            info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), // Spy on error
        };
        mockSchemaLoader = { loadAndCompileAllSchemas: jest.fn() };
        mockValidator = {
            isSchemaLoaded: jest.fn(),
            addSchema: jest.fn(), removeSchema: jest.fn(), getValidator: jest.fn(), validate: jest.fn(),
        };
        mockConfiguration = {
            getContentTypeSchemaId: jest.fn(),
            getBaseDataPath: jest.fn(() => './data'), getSchemaFiles: jest.fn(() => []), getSchemaBasePath: jest.fn(() => 'schemas'),
            getContentBasePath: jest.fn(() => 'content'), getWorldBasePath: jest.fn(() => 'worlds'), getGameConfigFilename: jest.fn(() => 'game.json'),
            getModsBasePath: jest.fn(() => 'mods'), getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
        };
        mockGameConfigLoader = { loadConfig: jest.fn() };
        mockModManifestLoader = { loadRequestedManifests: jest.fn() };

        // Mock individual content loaders (needed for constructor validation, though not called in these tests)
        mockActionLoader = { loadItemsForMod: jest.fn() };
        mockComponentLoader = { loadItemsForMod: jest.fn() };
        mockEventLoader = { loadItemsForMod: jest.fn() };
        mockRuleLoader = { loadItemsForMod: jest.fn() };
        mockEntityLoader = { loadItemsForMod: jest.fn() };

        // --- 2. Define Base Mock Data (can be overridden in tests) ---
        coreManifest = { id: coreModId, version: '1.0.0', name: 'Core', gameVersion: '1.0.0', content: {} };
        modAManifest = { id: modAId, version: '1.0.0', name: 'Mod A', gameVersion: '1.0.0', content: {} };
        modBManifest = { id: modBId, version: '1.0.0', name: 'Mod B', gameVersion: '1.0.0', content: {} };
        // mockManifestMap initialized later or in specific tests

        // --- 3. Configure Mocks (Default Success Paths for steps BEFORE error scenarios) ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

        // Configure IConfiguration for essential schemas
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
            switch (typeName) {
                case 'game': return gameSchemaId;
                case 'components': return componentSchemaId;
                case 'mod-manifest': return manifestSchemaId;
                case 'entities': return entitySchemaId;
                default: return `schema:${typeName}`;
            }
        });
        // Configure ISchemaValidator for essential schemas (default to loaded, overridden in specific tests)
        mockValidator.isSchemaLoaded.mockReturnValue(true);

        // Default mocks for validator/resolver/loaders - these will be specifically configured to throw/reject in tests
        mockDependencyValidate.mockImplementation(() => { /* Does nothing by default */ });
        mockEngineVersionValidate.mockImplementation(() => { /* Does nothing by default */ });
        mockResolveOrder.mockReturnValue([]); // Default empty array
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId]); // Default load 'core'
        // Default map with core - THIS WILL BE OVERRIDDEN in the cycle test
        const defaultMap = new Map();
        defaultMap.set(coreModId, coreManifest);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(defaultMap);

        // --- 4. Instantiate SUT ---
        worldLoader = new WorldLoader(
            mockRegistry, mockLogger, mockSchemaLoader,
            mockComponentLoader, mockRuleLoader, mockActionLoader,
            mockEventLoader, mockEntityLoader, mockValidator,
            mockConfiguration, mockGameConfigLoader, mockModManifestLoader
        );
    });

    // ── Test Case: Mod Manifest Schema Validation Failure ───────────────────
    it('should throw error if a mod manifest fails schema validation (simulated via loader)', async () => {
        // Setup: ModManifestLoader.loadRequestedManifests is mocked to throw an error
        const simulatedError = new Error('Simulated manifest schema validation failure in loader');
        mockModManifestLoader.loadRequestedManifests.mockRejectedValue(simulatedError);
        mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]); // Request a mod

        let thrownError = null;
        try {
            // Action
            await worldLoader.loadWorld(worldName);
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBe(simulatedError); // Should re-throw the original error

        // Verify registry cleared twice (start + catch)
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged the critical failure
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL load failure'),
            expect.objectContaining({ error: simulatedError })
        );
    });

    // ── Test Case: Dependency Cycle ─────────────────────────────────────────
    it('should throw ModDependencyError if a dependency cycle is detected', async () => {
        // Setup: modA requires modB, modB requires modA.
        modAManifest.dependencies = { [modBId]: '^1.0.0' };
        modBManifest.dependencies = { [modAId]: '^1.0.0' };
        mockGameConfigLoader.loadConfig.mockResolvedValue([modAId, modBId]); // Request both

        // *** FIX: Explicitly set the manifests returned for THIS test ***
        const cycleManifestMap = new Map();
        cycleManifestMap.set(modAId, modAManifest);
        cycleManifestMap.set(modBId, modBManifest);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(cycleManifestMap); // Override beforeEach default

        // Configure resolveOrder to throw ModDependencyError for a cycle
        const cycleErrorMessage = `Cyclic dependency detected involving mods: ${modAId}, ${modBId}`;
        const expectedError = new ModDependencyError(cycleErrorMessage);
        // *** FIX: Validation map should ONLY contain modA and modB (lowercase) ***
        const validationMap = new Map();
        validationMap.set(modAId.toLowerCase(), modAManifest);
        validationMap.set(modBId.toLowerCase(), modBManifest);

        mockResolveOrder.mockImplementation((requestedIds, manifests, logger) => {
            // Basic check if called with expected map structure
            // Check size and keys explicitly match the validationMap defined above
            if (manifests.size === validationMap.size &&
                manifests.has(modAId.toLowerCase()) &&
                manifests.has(modBId.toLowerCase()))
            {
                throw expectedError;
            }
            console.error("mockResolveOrder called with unexpected map:", manifests); // Debugging log
            throw new Error("mockResolveOrder called unexpectedly or with wrong map");
        });

        let thrownError = null;
        try {
            // Action
            await worldLoader.loadWorld(worldName);
        } catch (error) {
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(ModDependencyError);
        expect(thrownError.message).toContain('Cyclic dependency detected');

        // Verify registry cleared twice (start + catch)
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged the critical failure
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL load failure'),
            expect.objectContaining({ error: expectedError })
        );

        // Verify resolveOrder was called correctly
        expect(mockResolveOrder).toHaveBeenCalledTimes(1);
        expect(mockResolveOrder).toHaveBeenCalledWith([modAId, modBId], validationMap, mockLogger);
    });

    // ── Test Case: Missing Essential Schema (game) ──────────────────────────
    it('should throw Error if an essential schema (e.g., game) is missing', async () => {
        // Setup: SchemaLoader resolves, but ISchemaValidator.isSchemaLoaded returns false for 'game'.
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId]);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(new Map([[coreModId, coreManifest]]));

        // Configure validator: fails only for 'game' schema
        mockValidator.isSchemaLoaded.mockImplementation((id) => {
            if (id === gameSchemaId) {
                return false;
            }
            return true; // Assume others needed before this pass
        });

        let thrownError = null;
        const expectedOuterErrorMessage = `WorldLoader failed data load sequence (World Hint: '${worldName}'): Essential schemas missing – aborting world load.`;
        const expectedInnerLogMessage = `WorldLoader: Essential schema missing or not configured: ${gameSchemaId}`;
        let originalError = null; // To capture the error thrown inside the try block

        try {
            // Action
            await worldLoader.loadWorld(worldName);
        } catch (error) {
            // Capture the first error thrown if it's the one we expect
            if (error instanceof Error && error.message.includes(expectedInnerLogMessage)) {
                originalError = error;
            }
            thrownError = error; // This will be the final thrown error
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(Error);
        expect(thrownError.message).toBe(expectedOuterErrorMessage);

        // Verify registry cleared twice (start + catch)
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged the specific failure THEN the critical failure
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // Check 1: Specific log inside the check loop (should log the original error)
        expect(mockLogger.error).toHaveBeenCalledWith(
            'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
            expect.objectContaining({ // Check the context object passed to logger.error
                error: expect.objectContaining({ // Expect the *original* error object
                    message: expect.stringContaining(expectedInnerLogMessage)
                })
            })
        );

        // Check 2: Final CRITICAL log in the catch block (also logs the original error `err`)
        // This check is now redundant with Check 1 as both log the original error in this scenario.
        // Let's keep it for clarity that the critical log happens.
        expect(mockLogger.error).toHaveBeenCalledWith(
            'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
            expect.objectContaining({ error: originalError ?? expect.any(Error) }) // Expect original error
        );


        // Check 3: Log *before* throwing the final Error
        expect(mockLogger.error).toHaveBeenCalledWith(
            `WorldLoader: Essential schema missing: ${gameSchemaId}`
        );

        // Verify validator was checked for the game schema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId);
    });

    // ── Test Case: Missing Essential Schema (mod-manifest) ──────────────────
    it('should throw Error if an essential schema (e.g., mod-manifest) is missing', async () => {
        // Setup: Similar to above, but isSchemaLoaded returns false for mod-manifest
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId]);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(new Map([[coreModId, coreManifest]]));

        // Configure validator: fails only for 'mod-manifest' schema
        mockValidator.isSchemaLoaded.mockImplementation((id) => {
            if (id === manifestSchemaId) {
                return false;
            }
            // Assume game, components are checked first and pass
            return [gameSchemaId, componentSchemaId].includes(id);
        });

        let thrownError = null;
        const expectedOuterErrorMessage = `WorldLoader failed data load sequence (World Hint: '${worldName}'): Essential schemas missing – aborting world load.`;
        const expectedInnerLogMessage = `WorldLoader: Essential schema missing or not configured: ${manifestSchemaId}`;
        let originalError = null;

        try {
            // Action
            await worldLoader.loadWorld(worldName);
        } catch (error) {
            if (error instanceof Error && error.message.includes(expectedInnerLogMessage)) {
                originalError = error;
            }
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(Error);
        expect(thrownError.message).toBe(expectedOuterErrorMessage);

        // Verify registry cleared twice
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged the specific failure THEN the critical failure
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // Check 1 & 2: Critical log contains the original error
        expect(mockLogger.error).toHaveBeenCalledWith(
            'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
            expect.objectContaining({
                error: expect.objectContaining({
                    message: expect.stringContaining(expectedInnerLogMessage)
                })
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
            expect.objectContaining({ error: originalError ?? expect.any(Error) }) // Expect original error
        );


        // Check 3: Log *before* throwing the final Error
        expect(mockLogger.error).toHaveBeenCalledWith(
            `WorldLoader: Essential schema missing: ${manifestSchemaId}`
        );


        // Verify validator was checked for the mod-manifest schema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(manifestSchemaId);
        // Verify it was also checked for the ones before it
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentSchemaId);
    });

    // ── Test Case: Missing Essential Schema (entities) ──────────────────────
    it('should throw Error if an essential schema (e.g., entities) is missing', async () => {
        // Setup: Similar to above, but isSchemaLoaded returns false for entities
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId]);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(new Map([[coreModId, coreManifest]]));

        // Configure validator: fails only for 'entities' schema
        mockValidator.isSchemaLoaded.mockImplementation((id) => {
            if (id === entitySchemaId) {
                return false;
            }
            // Assume game, components, mod-manifest pass
            return [gameSchemaId, componentSchemaId, manifestSchemaId].includes(id);
        });

        let thrownError = null;
        const expectedOuterErrorMessage = `WorldLoader failed data load sequence (World Hint: '${worldName}'): Essential schemas missing – aborting world load.`;
        const expectedInnerLogMessage = `WorldLoader: Essential schema missing or not configured: ${entitySchemaId}`;
        let originalError = null;

        try {
            // Action
            await worldLoader.loadWorld(worldName);
        } catch (error) {
            if (error instanceof Error && error.message.includes(expectedInnerLogMessage)) {
                originalError = error;
            }
            thrownError = error;
        }

        // Assertions
        expect(thrownError).toBeInstanceOf(Error);
        expect(thrownError.message).toBe(expectedOuterErrorMessage);

        // Verify registry cleared twice
        expect(mockRegistry.clear).toHaveBeenCalledTimes(2);

        // Verify logger.error logged the specific failure THEN the critical failure
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // Check 1 & 2: Critical log contains the original error
        expect(mockLogger.error).toHaveBeenCalledWith(
            'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
            expect.objectContaining({
                error: expect.objectContaining({
                    message: expect.stringContaining(expectedInnerLogMessage)
                })
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
            expect.objectContaining({ error: originalError ?? expect.any(Error) }) // Expect original error
        );


        // Check 3: Log *before* throwing the final Error
        expect(mockLogger.error).toHaveBeenCalledWith(
            `WorldLoader: Essential schema missing: ${entitySchemaId}`
        );

        // Verify validator was checked for the entities schema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(entitySchemaId);
        // Verify it was also checked for the ones before it
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentSchemaId);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(manifestSchemaId);
    });
});