// src/tests/integration/modLoadDependencyFail.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// Core services under test
import WorldLoader from '../../core/services/worldLoader.js';
import ModManifestLoader from '../../core/services/modManifestLoader.js';
import AjvSchemaValidator from '../../core/services/ajvSchemaValidator.js';
import ModDependencyError from '../../core/errors/modDependencyError.js';

/* -------------------------------------------------------------------------- */
/* Helper factories – duplicated from modManifestLoader.harness.test.js        */
/* -------------------------------------------------------------------------- */

const createMockConfiguration = (overrides = {}) => ({
    getContentTypeSchemaId: jest.fn((t) => {
        if (t === 'mod-manifest') return 'http://example.com/schemas/mod.manifest.schema.json';
        if (t === 'game') return 'http://example.com/schemas/game.schema.json';
        if (t === 'components') return 'http://example.com/schemas/components.schema.json';
        return `http://example.com/schemas/${t}.schema.json`;
    }),
    // Unused in this harness but required by ModManifestLoader interface
    getBaseDataPath: jest.fn(),
    getSchemaFiles: jest.fn(),
    getSchemaBasePath: jest.fn(),
    getContentBasePath: jest.fn(),
    getWorldBasePath: jest.fn(),
    getGameConfigFilename: jest.fn(),
    getModsBasePath: jest.fn(),
    getModManifestFilename: jest.fn(),
    ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
    resolveModManifestPath: jest.fn((id) => `./data/mods/${id}/mod.manifest.json`),
    ...overrides,
});

// Generic programmable fetcher
const createMockFetcher = (idToResponse = {}, errorIds = []) => ({
    fetch: jest.fn((path) => {
        const [, modId] = /mods\/(.*)\/mod\.manifest\.json/.exec(path) || [];
        if (errorIds.includes(modId)) return Promise.reject(new Error(`Fetch failed for ${modId}`));
        if (idToResponse.hasOwnProperty(modId)) return Promise.resolve(idToResponse[modId]);
        return Promise.reject(new Error(`404 ${modId}`));
    }),
});

const createMockRegistry = () => {
    const data = new Map(); // type -> Map
    const store = jest.fn((type, id, obj) => {
        if (!data.has(type)) data.set(type, new Map());
        data.get(type).set(id, obj);
    });
    return {
        clear: jest.fn(() => data.clear()),
        store,
        getAll: jest.fn((type) => (data.has(type) ? Array.from(data.get(type).values()) : [])),
        setManifest: jest.fn(),
        getManifest: jest.fn(),
    };
};

const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/* -------------------------------------------------------------------------- */
/* Integration test                                                           */
/* -------------------------------------------------------------------------- */

describe('WorldLoader → ModDependencyValidator integration (missing dependency)', () => {
    let validator;
    let configuration;
    let pathResolver;
    let fetcher;
    let registry;
    let logger;
    let schemaLoader;
    let componentDefinitionLoader;
    let ruleLoader;
    let gameConfigLoader;
    let modManifestLoader;
    let worldLoader;

    // Lean JSON schemas (just enough to satisfy the loader)
    const MOD_MANIFEST_SCHEMA_ID = 'http://example.com/schemas/mod.manifest.schema.json';
    const GAME_SCHEMA_ID = 'http://example.com/schemas/game.schema.json';
    const COMPONENTS_SCHEMA_ID = 'http://example.com/schemas/components.schema.json';

    const manifestSchema = {
        $id: MOD_MANIFEST_SCHEMA_ID,
        type: 'object',
        required: ['id', 'name', 'version'],
        properties: {
            id: {type: 'string', minLength: 1},
            name: {type: 'string', minLength: 1},
            version: {type: 'string', minLength: 1},
            dependencies: {type: 'array', items: {type: 'object'}},
        },
        additionalProperties: true,
    };

    const gameSchema = {$id: GAME_SCHEMA_ID, type: 'object', additionalProperties: true};
    const componentsSchema = {$id: COMPONENTS_SCHEMA_ID, type: 'object', additionalProperties: true};

    beforeEach(async () => {
        jest.clearAllMocks();

        /* -------------------- Core plumbing ---------------------------------- */
        validator = new AjvSchemaValidator();

        // SchemaLoader stub that actually registers essential schemas
        schemaLoader = {
            loadAndCompileAllSchemas: jest.fn().mockImplementation(async () => {
                await validator.addSchema(gameSchema, GAME_SCHEMA_ID);
                await validator.addSchema(componentsSchema, COMPONENTS_SCHEMA_ID);
                await validator.addSchema(manifestSchema, MOD_MANIFEST_SCHEMA_ID);
            }),
        };

        configuration = createMockConfiguration();
        pathResolver = createMockPathResolver();

        /* -------------------- Fixture manifests ------------------------------ */
        const baseManifest = {id: 'basegame', name: 'Base Game', version: '1.0.0'};
        const badManifest = {
            id: 'badmod',
            name: 'Bad Mod',
            version: '0.1.0',
            dependencies: [{id: 'MissingMod', version: '^1.0.0'}],
        };

        fetcher = createMockFetcher({basegame: baseManifest, badmod: badManifest});
        registry = createMockRegistry();
        logger = createMockLogger();

        /* -------------------- Auxiliary loaders ------------------------------ */
        ruleLoader = {loadAll: jest.fn().mockResolvedValue(undefined)};
        componentDefinitionLoader = {loadComponentDefinitions: jest.fn().mockResolvedValue(undefined)};
        gameConfigLoader = {loadConfig: jest.fn().mockResolvedValue(['basegame', 'badmod'])};

        /* -------------------- Real ModManifestLoader ------------------------- */
        modManifestLoader = new ModManifestLoader(
            configuration,
            pathResolver,
            fetcher,
            validator,
            registry,
            logger,
        );

        /* -------------------- System under test ------------------------------ */
        worldLoader = new WorldLoader(
            registry,
            logger,
            schemaLoader,
            componentDefinitionLoader,
            ruleLoader,
            validator,
            configuration,
            gameConfigLoader,
            modManifestLoader,
        );
    });

    it('rejects with ModDependencyError and fetches only mod manifests (no content)', async () => {
        await expect(worldLoader.loadWorld('TestWorld')).rejects.toThrow(ModDependencyError);

        // Exactly two manifest fetches (basegame & badmod), nothing else
        expect(fetcher.fetch).toHaveBeenCalledTimes(2);

        // Assert no content‑file paths were fetched (defensive)
        const contentFetches = fetcher.fetch.mock.calls.filter(([p]) => /\/content\//.test(p));
        expect(contentFetches.length).toBe(0);

        // Downstream loaders should never run due to early failure
        expect(ruleLoader.loadAll).not.toHaveBeenCalled();
        expect(componentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
    });
});