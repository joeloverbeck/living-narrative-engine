// src/tests/core/services/componentDefinitionLoader.happyPath.core.test.js

import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js'; // The class under test
import {beforeEach, describe, expect, jest, test} from '@jest/globals'; // Import Jest utilities if needed, like jest.fn()

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 * @typedef {import('../interfaces/coreServices.js').ModManifest} ModManifest
 */

describe('ComponentDefinitionLoader (Sub-Ticket 6.2: Happy Path - Core Mod)', () => {
    // --- Declare variables for mocks and loader ---
    /** @type {IConfiguration} */
    let mockConfig;
    /** @type {IPathResolver} */
    let mockResolver;
    /** @type {IDataFetcher} */
    let mockFetcher;
    /** @type {ISchemaValidator} */
    let mockValidator;
    /** @type {IDataRegistry} */
    let mockRegistry;
    /** @type {ILogger} */
    let mockLogger;
    /** @type {ComponentDefinitionLoader} */
    let componentDefinitionLoader;

    // --- Define mock component data ---
    const coreHealthFilename = 'core_health.component.json';
    const corePositionFilename = 'core_position.component.json';

    const coreHealthPath = './data/mods/core/components/core_health.component.json';
    const corePositionPath = './data/mods/core/components/core_position.component.json';

    const coreHealthDef = {
        id: 'core:health',
        description: 'Tracks entity health points.',
        dataSchema: {
            type: 'object',
            properties: {
                current: {type: 'number', default: 100},
                max: {type: 'number', default: 100},
            },
            required: ['current', 'max'],
            additionalProperties: false,
        },
    };

    const corePositionDef = {
        id: 'core:position',
        description: 'Tracks entity position in the world.',
        dataSchema: {
            type: 'object',
            properties: {
                x: {type: 'integer', default: 0},
                y: {type: 'integer', default: 0},
                z: {type: 'integer', default: 0},
            },
            required: ['x', 'y', 'z'],
            additionalProperties: false,
        },
    };

    // --- Define the 'core' mod manifest ---
    /** @type {ModManifest} */
    const mockCoreManifest = {
        id: 'core',
        name: 'Core Game Systems',
        version: '1.0.0',
        content: {
            components: [
                coreHealthFilename,
                corePositionFilename,
            ],
            // Other content types can be empty or omitted for this test
        },
        // Other manifest fields like dependencies can be omitted
    };

    // --- Define schema IDs ---
    const componentDefinitionSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    beforeEach(() => {
        // --- Setup: Instantiate Mocks using jest.fn() ---

        // Mock IConfiguration
        mockConfig = {
            getContentBasePath: jest.fn(),
            getContentTypeSchemaId: jest.fn(),
            // Add mocks for other methods required by constructor validation
            getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
            getSchemaFiles: jest.fn().mockReturnValue([]),
            getWorldBasePath: jest.fn().mockReturnValue('worlds'),
            getBaseDataPath: jest.fn().mockReturnValue('./data'),
            getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
            getModsBasePath: jest.fn().mockReturnValue('mods'),
            getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
        };

        // Mock IPathResolver
        mockResolver = {
            resolveContentPath: jest.fn(),
            resolveModContentPath: jest.fn(),
            // Add mocks for other methods required by constructor validation
            resolveSchemaPath: jest.fn(),
            resolveManifestPath: jest.fn(),
            resolveRulePath: jest.fn(),
            resolveGameConfigPath: jest.fn(),
            resolveModManifestPath: jest.fn(),
        };

        // Mock IDataFetcher
        mockFetcher = {
            fetch: jest.fn(),
        };

        // Mock ISchemaValidator
        mockValidator = {
            addSchema: jest.fn(),
            isSchemaLoaded: jest.fn(),
            getValidator: jest.fn(),
            removeSchema: jest.fn(), // Required by constructor
            validate: jest.fn(),     // Required by constructor
        };

        // Mock IDataRegistry
        mockRegistry = {
            store: jest.fn(),
            get: jest.fn(),
            // Add mocks for other methods required by constructor validation
            getAll: jest.fn().mockReturnValue([]),
            getAllSystemRules: jest.fn().mockReturnValue([]),
            clear: jest.fn(),
            getManifest: jest.fn().mockReturnValue(null),
            setManifest: jest.fn(),
            getEntityDefinition: jest.fn(),
            getItemDefinition: jest.fn(),
            getLocationDefinition: jest.fn(),
            getConnectionDefinition: jest.fn(),
            getBlockerDefinition: jest.fn(),
            getActionDefinition: jest.fn(),
            getEventDefinition: jest.fn(),
            getComponentDefinition: jest.fn(),
            getAllEntityDefinitions: jest.fn().mockReturnValue([]),
            getAllItemDefinitions: jest.fn().mockReturnValue([]),
            getAllLocationDefinitions: jest.fn().mockReturnValue([]),
            getAllConnectionDefinitions: jest.fn().mockReturnValue([]),
            getAllBlockerDefinitions: jest.fn().mockReturnValue([]),
            getAllActionDefinitions: jest.fn().mockReturnValue([]),
            getAllEventDefinitions: jest.fn().mockReturnValue([]),
            getAllComponentDefinitions: jest.fn().mockReturnValue([]),
            getStartingPlayerId: jest.fn().mockReturnValue(null),
            getStartingLocationId: jest.fn().mockReturnValue(null),
        };

        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // --- Setup: Configure Mock Implementations (Acceptance Criteria) ---

        // IConfiguration
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
            if (typeName === 'components') {
                return componentDefinitionSchemaId;
            }
            return undefined;
        });

        // IPathResolver
        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => {
            if (modId === 'core' && typeName === 'components') {
                if (filename === coreHealthFilename) return coreHealthPath;
                if (filename === corePositionFilename) return corePositionPath;
            }
            throw new Error(`Unexpected resolveModContentPath call: ${modId}, ${typeName}, ${filename}`);
        });

        // IDataFetcher
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === coreHealthPath) return Promise.resolve({...coreHealthDef}); // Return copies
            if (path === corePositionPath) return Promise.resolve({...corePositionDef});
            throw new Error(`Unexpected fetch call for path: ${path}`);
        });

        // ISchemaValidator
        const addedSchemas = new Set(); // Track schemas added via mock
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            if (schemaId === componentDefinitionSchemaId) return true;
            // Check if addSchema was called for this component ID
            return addedSchemas.has(schemaId);
        });
        mockValidator.getValidator.mockImplementation((schemaId) => {
            if (schemaId === componentDefinitionSchemaId) {
                // Return a mock validator function for the *definition* schema
                return jest.fn().mockReturnValue({isValid: true, errors: null});
            }
            // No validator needed for component *data* schemas in this loader's flow
            return undefined;
        });
        mockValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            addedSchemas.add(schemaId); // Mark schema as 'added'
            return Promise.resolve(); // Simulate success
        });
        mockValidator.removeSchema.mockReturnValue(false); // Ensure it's tracked but returns false

        // IDataRegistry
        mockRegistry.get.mockReturnValue(undefined); // Simulate empty registry initially
        mockRegistry.store.mockImplementation(() => { /* Simulate success */
        });

        // --- Setup: Instantiate Loader ---
        componentDefinitionLoader = new ComponentDefinitionLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );
    });

    test('should successfully load and register component definitions from the core mod', async () => {
        // --- Action ---
        const promise = componentDefinitionLoader.loadComponentDefinitions('core', mockCoreManifest);

        // --- Verify: Promise Resolves ---
        await expect(promise).resolves.not.toThrow();

        // --- Verify: Returned Count ---
        const count = await promise;
        expect(count).toBe(mockCoreManifest.content.components.length); // Should be 2

        // --- Verify: Mock Calls ---

        // IDataRegistry.store
        expect(mockRegistry.store).toHaveBeenCalledTimes(2);
        // Use expect.objectContaining or deep equality checks if strict object identity isn't guaranteed
        expect(mockRegistry.store).toHaveBeenCalledWith('component_definitions', coreHealthDef.id, expect.objectContaining(coreHealthDef));
        expect(mockRegistry.store).toHaveBeenCalledWith('component_definitions', corePositionDef.id, expect.objectContaining(corePositionDef));

        // ISchemaValidator.addSchema
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(2);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(coreHealthDef.dataSchema, coreHealthDef.id);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(corePositionDef.dataSchema, corePositionDef.id);

        // ISchemaValidator.removeSchema
        expect(mockValidator.removeSchema).not.toHaveBeenCalled();

        // IDataRegistry.get (called before each store)
        expect(mockRegistry.get).toHaveBeenCalledTimes(2);
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', coreHealthDef.id);
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', corePositionDef.id);

        // ILogger.info/debug (check for key messages)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Loading component definitions for mod 'core'"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found ${mockCoreManifest.content.components.length} valid component definition filenames`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Completed processing. Success: ${mockCoreManifest.content.components.length}/${mockCoreManifest.content.components.length}`));

        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing component file: ${coreHealthFilename}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing component file: ${corePositionFilename}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered dataSchema for component ID '${coreHealthDef.id}'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered dataSchema for component ID '${corePositionDef.id}'`));

        // --- CORRECTED ASSERTIONS ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully stored component definition metadata for '${coreHealthDef.id}'`),
            expect.anything() // Allow any second argument
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully stored component definition metadata for '${corePositionDef.id}'`),
            expect.anything() // Allow any second argument
        );
        // --- END CORRECTION ---
    });
});