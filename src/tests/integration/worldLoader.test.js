// src/tests/integration/worldLoader.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import WorldLoader from '../../core/services/worldLoader.js';

// --- Real Dependencies (Implementations) ---
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import StaticConfiguration from '../../core/services/staticConfiguration.js'; // Using the actual static config
import DefaultPathResolver from '../../core/services/defaultPathResolver.js';
import AjvSchemaValidator from '../../core/services/ajvSchemaValidator.js';
import RuntimeEventTypeValidator from '../../core/services/runtimeEventTypeValidator.js';
import SchemaLoader from '../../core/services/schemaLoader.js';
import ManifestLoader from '../../core/services/manifestLoader.js';
import GenericContentLoader from '../../core/services/genericContentLoader.js';

// --- Mock Interfaces (Types - not strictly needed for JS but good practice) ---
/** @typedef {import('../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */

// --- Test Data ---

// NOTE: Schema $ids MUST match those defined in StaticConfiguration for this test
// because we are using the real StaticConfiguration instance.

const testCommonSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://example.com/schemas/common.schema.json", // Matches StaticConfiguration
    title: "Test Common Definitions",
    definitions: {
        namespacedId: {type: "string", pattern: "^[a-zA-Z0-9_\\-:]+$"},
        NameComponent: {type: "object", properties: {value: {type: "string"}}, required: ["value"]},
        // Add other minimal common defs if strictly required by other test schemas
    }
};

const testItemSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://example.com/schemas/item.schema.json", // Matches StaticConfiguration
    title: "Test Item Schema",
    type: "object",
    properties: {
        id: {"$ref": "http://example.com/schemas/common.schema.json#/definitions/namespacedId"},
        components: {
            type: "object",
            properties: {
                Name: {"$ref": "http://example.com/schemas/common.schema.json#/definitions/NameComponent"}
            }
        }
    },
    required: ["id", "components"]
};

const testEntitySchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://example.com/schemas/entity.schema.json", // Matches StaticConfiguration
    title: "Test Entity Schema",
    type: "object",
    properties: {
        id: {"$ref": "http://example.com/schemas/common.schema.json#/definitions/namespacedId"},
        components: {
            type: "object",
            properties: {
                Name: {"$ref": "http://example.com/schemas/common.schema.json#/definitions/NameComponent"}
            }
        }
    },
    required: ["id", "components"]
};

const testManifestSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://example.com/schemas/world-manifest.schema.json", // Matches StaticConfiguration
    title: "Test World Manifest Schema",
    type: "object",
    properties: {
        worldName: {type: "string"},
        startingPlayerId: {"$ref": "http://example.com/schemas/common.schema.json#/definitions/namespacedId"},
        startingLocationId: {"$ref": "http://example.com/schemas/common.schema.json#/definitions/namespacedId"},
        contentFiles: {
            type: "object",
            additionalProperties: {
                type: "array",
                items: {type: "string"}
            }
        }
    },
    required: ["worldName", "contentFiles", "startingPlayerId", "startingLocationId"]
};

// Combine required schemas for easier mocking
const testSchemas = {
    "common.schema.json": testCommonSchema,
    "item.schema.json": testItemSchema,
    "entity.schema.json": testEntitySchema,
    "world-manifest.schema.json": testManifestSchema,
    // Add other schemas from StaticConfiguration.SCHEMA_FILES if they are
    // strictly required for Ajv to compile the above (e.g., base definitions).
    // For simplicity, assume the above are self-contained or only depend on common.
    // If tests fail due to missing schema refs, add minimal versions here.
    "action-definition.schema.json": {
        $id: "http://example.com/schemas/action-definition.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "trigger.schema.json": {
        $id: "http://example.com/schemas/trigger.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "interaction-test.schema.json": {
        $id: "http://example.com/schemas/interaction-test.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "location.schema.json": {
        $id: "http://example.com/schemas/location.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "connection.schema.json": {
        $id: "http://example.com/schemas/connection.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "quest.schema.json": {
        $id: "http://example.com/schemas/quest.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "objective.schema.json": {
        $id: "http://example.com/schemas/objective.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "container.schema.json": {
        $id: "http://example.com/schemas/container.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "lockable.schema.json": {
        $id: "http://example.com/schemas/lockable.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "effect.schema.json": {
        $id: "http://example.com/schemas/effect.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "openable.schema.json": {
        $id: "http://example.com/schemas/openable.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "edible.schema.json": {
        $id: "http://example.com/schemas/edible.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "pushable.schema.json": {
        $id: "http://example.com/schemas/pushable.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "liquid-container.schema.json": {
        $id: "http://example.com/schemas/liquid-container.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "breakable.schema.json": {
        $id: "http://example.com/schemas/breakable.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    } // Minimal stub

};

const testManifest = {
    // $schema: "http://example.com/schemas/world-manifest.schema.json", // Optional but good practice
    worldName: "Test World",
    startingPlayerId: "test:player",
    startingLocationId: "test:location_start",
    contentFiles: {
        items: ["test-item-1.json"],
        entities: ["test-entity-1.json", "test-player.entity.json"], // Include player def
        // Add other types if needed for the test
    }
};

const testItem1 = {
    id: "test:item_1",
    components: {
        Name: {value: "Test Item One"}
    }
};

const testEntity1 = {
    id: "test:entity_1",
    components: {
        Name: {value: "Test Entity One"}
    }
};

const testPlayer = {
    id: "test:player", // Matches startingPlayerId in manifest
    components: {
        Name: {value: "Test Player Hero"}
    }
};


// --- Test Suite ---

describe('WorldLoader Integration Test', () => {
    let worldLoader;
    let realRegistry;
    let realConfig;
    let realResolver;
    let realValidator;
    let realEventTypeValidator;
    let schemaLoader;
    let manifestLoader;
    let contentLoader;
    let mockDataFetcher;
    let mockLogger;

    // Store resolved paths for mock fetcher configuration
    const resolvedPaths = {};

    beforeEach(() => {
        // --- Instantiate Real Dependencies ---
        realRegistry = new InMemoryDataRegistry();
        realConfig = new StaticConfiguration(); // Using the real one as specified
        realResolver = new DefaultPathResolver(realConfig);
        realValidator = new AjvSchemaValidator(); // Real Ajv validator
        realEventTypeValidator = new RuntimeEventTypeValidator();
        // Initialize event type validator if needed (not critical for this success path)
        // realEventTypeValidator.initialize(['event:some_test_event']);

        // --- Create Mock Dependencies ---
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // This is the core mock setup
        mockDataFetcher = {
            // Store fetch calls for verification
            _calls: [],
            fetch: jest.fn(async (identifier) => {
                mockDataFetcher._calls.push(identifier); // Track calls

                // Determine which test data to return based on the resolved path (identifier)
                if (identifier === resolvedPaths.manifest) {
                    return Promise.resolve(testManifest);
                }
                if (identifier === resolvedPaths.item1) {
                    return Promise.resolve(testItem1);
                }
                if (identifier === resolvedPaths.entity1) {
                    return Promise.resolve(testEntity1);
                }
                if (identifier === resolvedPaths.playerEntity) {
                    return Promise.resolve(testPlayer);
                }

                // Find the schema filename that resolves to this identifier
                const schemaFilename = Object.keys(resolvedPaths.schemas).find(
                    filename => resolvedPaths.schemas[filename] === identifier
                );
                if (schemaFilename && testSchemas[schemaFilename]) {
                    return Promise.resolve(testSchemas[schemaFilename]);
                }

                // If no mapping found, reject or throw to indicate a problem in the test setup
                console.error(`MockDataFetcher: No test data configured for path: ${identifier}`);
                return Promise.reject(new Error(`MockDataFetcher: Unhandled path ${identifier}`));
            })
        };

        // Pre-calculate resolved paths using the real resolver and config
        resolvedPaths.schemas = {};
        realConfig.getSchemaFiles().forEach(filename => {
            if (testSchemas[filename]) { // Only resolve paths for schemas we defined test data for
                resolvedPaths.schemas[filename] = realResolver.resolveSchemaPath(filename);
            }
        });
        resolvedPaths.manifest = realResolver.resolveManifestPath('test-world');
        resolvedPaths.item1 = realResolver.resolveContentPath('items', 'test-item-1.json');
        resolvedPaths.entity1 = realResolver.resolveContentPath('entities', 'test-entity-1.json');
        resolvedPaths.playerEntity = realResolver.resolveContentPath('entities', 'test-player.entity.json');


        // --- Instantiate Orchestrating Loaders with Real/Mock Dependencies ---
        schemaLoader = new SchemaLoader(realConfig, realResolver, mockDataFetcher, realValidator, mockLogger);
        manifestLoader = new ManifestLoader(realConfig, realResolver, mockDataFetcher, realValidator, mockLogger);
        contentLoader = new GenericContentLoader(realConfig, realResolver, mockDataFetcher, realValidator, realEventTypeValidator, realRegistry, mockLogger);

        // --- Instantiate System Under Test (WorldLoader) ---
        worldLoader = new WorldLoader(
            realRegistry,     // Correct 1st argument
            mockLogger,         // Correct 2nd argument
            schemaLoader,       // Correct 3rd argument
            manifestLoader,     // Correct 4th argument
            contentLoader,      // Correct 5th argument
            realValidator,      // Correct 6th argument (used for summary)
            realConfig          // Correct 7th argument (used for summary)
        );
    });

    it('should successfully load schemas, manifest, and content into the registry', async () => {
        // --- Act ---
        await worldLoader.loadWorld('test-world');

        // --- Assert ---

        // 1. IDataRegistry State
        const loadedManifest = realRegistry.getManifest();
        const loadedItems = realRegistry.getAll('items');
        const loadedEntities = realRegistry.getAll('entities');

        expect(loadedManifest).toBeDefined();
        expect(loadedManifest).toEqual(testManifest); // Verify manifest content

        expect(loadedItems).toHaveLength(1);
        expect(loadedItems[0]).toEqual(testItem1); // Verify item content

        expect(loadedEntities).toHaveLength(2); // testEntity1 + testPlayer
        expect(loadedEntities).toEqual(expect.arrayContaining([testEntity1, testPlayer])); // Verify entity content (order-independent)

        // Check a type not in the manifest
        expect(realRegistry.getAll('locations')).toEqual([]);

        // 2. Mock IDataFetcher Interactions (Optional but Recommended)
        // Schemas
        Object.values(resolvedPaths.schemas).forEach(schemaPath => {
            expect(mockDataFetcher.fetch).toHaveBeenCalledWith(schemaPath);
        });
        // Manifest
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(resolvedPaths.manifest);
        // Content
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(resolvedPaths.item1);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(resolvedPaths.entity1);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(resolvedPaths.playerEntity);

        // Count fetch calls - schemas + 1 manifest + 3 content files = number of test schemas + 1 + 2 = 21 (18 schemas + 1 manifest + 2 content)
        // console.log("Fetch calls:", mockDataFetcher._calls.length, "Expected:", Object.keys(resolvedPaths.schemas).length + 1 + 2);
        // expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(Object.keys(resolvedPaths.schemas).length + 1 + 2); // Exact count based on test data

        // 3. Mock ILogger Interactions (Optional)
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for specific success logs if desired
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("WorldLoader: Starting full data load for world: 'test-world'"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Schema loading completed."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Manifest for world 'test-world' loaded and validated."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("All content loading tasks based on manifest completed."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("WorldLoader: Data load orchestration for world 'test-world' completed successfully."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("--- WorldLoader Load Summary for 'test-world' ---"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Total Content Items Loaded: 3")); // 1 item + 2 entities
    });
});