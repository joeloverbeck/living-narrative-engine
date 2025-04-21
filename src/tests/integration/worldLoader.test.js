// src/tests/integration/worldLoader.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import WorldLoader from '../../core/services/worldLoader.js';

// --- Real Dependencies (Implementations) ---
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import StaticConfiguration from '../../core/services/staticConfiguration.js'; // Using the actual static config
import DefaultPathResolver from '../../core/services/defaultPathResolver.js';
import AjvSchemaValidator from '../../core/services/ajvSchemaValidator.js';
import SchemaLoader from '../../core/services/schemaLoader.js';
import ManifestLoader from '../../core/services/manifestLoader.js';
import GenericContentLoader from '../../core/services/genericContentLoader.js';
import ComponentDefinitionLoader from '../../core/services/componentDefinitionLoader.js'; // *** ADDED IMPORT ***

// --- Mock Interfaces (Types - not strictly needed for JS but good practice) ---
/** @typedef {import('../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */

// --- Test Data ---
// [ Test Data remains the same ]
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
    "event-definition.schema.json": {
        $id: "http://example.com/schemas/event-definition.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "action-definition.schema.json": {
        $id: "http://example.com/schemas/action-definition.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "component-definition.schema.json": {
        $id: "http://example.com/schemas/component-definition.schema.json",
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
    }, // Minimal stub
    "item-component.schema.json": {
        $id: "http://example.com/schemas/item-component.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "usable.schema.json": {
        $id: "http://example.com/schemas/usable.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }, // Minimal stub
    "equippable.schema.json": {
        $id: "http://example.com/schemas/equippable.schema.json",
        type: "object",
        properties: {id: {type: "string"}}
    }
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
    let schemaLoader;
    let manifestLoader;
    let contentLoader;
    let componentDefinitionLoader;
    let mockDataFetcher;
    let mockLogger;

    // Store resolved paths for mock fetcher configuration
    const resolvedPaths = {};

    beforeEach(() => {
        // --- Instantiate Real Dependencies ---
        realRegistry = new InMemoryDataRegistry();
        realConfig = new StaticConfiguration();
        realResolver = new DefaultPathResolver(realConfig);
        realValidator = new AjvSchemaValidator();

        // --- Create Mock Dependencies ---
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // --- Clear resolvedPaths for the new test ---
        // It's good practice to clear this in case beforeEach runs multiple times within describe
        resolvedPaths.manifest = null;
        resolvedPaths.item1 = null;
        resolvedPaths.entity1 = null;
        resolvedPaths.playerEntity = null;
        resolvedPaths.schemas = {}; // Clear the schemas map specifically

        // This is the core mock setup
        mockDataFetcher = {
            _calls: [],
            fetch: jest.fn(async (identifier) => {
                mockDataFetcher._calls.push(identifier);
                // *** DEBUG LOG 1: Log identifier received by fetcher ***
                console.log(`\n MOCK_FETCH <<< Received: "${identifier}"`);

                // Determine which test data to return based on the resolved path (identifier)
                if (identifier === resolvedPaths.manifest) {
                    console.log(` MOCK_FETCH >>> Matched Manifest`);
                    return Promise.resolve(testManifest);
                }
                if (identifier === resolvedPaths.item1) {
                    console.log(` MOCK_FETCH >>> Matched Item1`);
                    return Promise.resolve(testItem1);
                }
                if (identifier === resolvedPaths.entity1) {
                    console.log(` MOCK_FETCH >>> Matched Entity1`);
                    return Promise.resolve(testEntity1);
                }
                if (identifier === resolvedPaths.playerEntity) {
                    console.log(` MOCK_FETCH >>> Matched PlayerEntity`);
                    return Promise.resolve(testPlayer);
                }

                // --- REVISED SCHEMA LOOKUP ---
                console.log(` MOCK_FETCH ??? Checking Schemas...`);
                for (const filename in resolvedPaths.schemas) {
                    const expectedPath = resolvedPaths.schemas[filename];
                    // *** DEBUG LOG 2: Log the comparison happening ***
                    console.log(` MOCK_FETCH CMP: Is "${identifier}" === "${expectedPath}" (for ${filename})?`);

                    if (identifier === expectedPath) {
                        console.log(` MOCK_FETCH >>> YES - Matched Schema: ${filename}`);
                        if (testSchemas[filename]) {
                            return Promise.resolve(testSchemas[filename]);
                        } else {
                            console.error(` MOCK_FETCH ERROR: Path match but no test data for ${filename}`);
                            return Promise.reject(new Error(`MockDataFetcher: Inconsistency - path match but no test data for ${filename}`));
                        }
                    } else {
                        // console.log(` MOCK_FETCH --- NO Match for ${filename}`); // Can be noisy, enable if needed
                    }
                }
                console.log(` MOCK_FETCH ??? Finished checking schemas. No exact match found.`);
                // --- END REVISED SCHEMA LOOKUP ---


                // Check for Component Definitions Path
                const componentsBasePath = realConfig.getContentBasePath('components');
                if (componentsBasePath && identifier.startsWith(componentsBasePath)) {
                    console.warn(` MOCK_FETCH WARN: Unhandled component path: ${identifier}`);
                    return Promise.reject(new Error(`MockDataFetcher: Unhandled component path ${identifier}`));
                }


                // If no mapping found after all checks
                console.error(` MOCK_FETCH ERROR: Fallback - No handler for path: "${identifier}"`);
                return Promise.reject(new Error(`MockDataFetcher: Unhandled path ${identifier}`));
            })
        };

        // Pre-calculate resolved paths using the real resolver and config
        console.log('\n--- Populating resolvedPaths in beforeEach ---');
        realConfig.getSchemaFiles().forEach(filename => {
            if (testSchemas[filename]) { // Only resolve paths for schemas we defined test data for
                const resolved = realResolver.resolveSchemaPath(filename);
                // *** DEBUG LOG 3: Log the path being stored ***
                console.log(` Storing: resolvedPaths.schemas["${filename}"] = "${resolved}"`);
                resolvedPaths.schemas[filename] = resolved;
            } else {
                console.log(` Skipping: No test data for schema "${filename}"`);
            }
        });
        resolvedPaths.manifest = realResolver.resolveManifestPath('test-world');
        console.log(` Storing: resolvedPaths.manifest = "${resolvedPaths.manifest}"`);
        resolvedPaths.item1 = realResolver.resolveContentPath('items', 'test-item-1.json');
        console.log(` Storing: resolvedPaths.item1 = "${resolvedPaths.item1}"`);
        resolvedPaths.entity1 = realResolver.resolveContentPath('entities', 'test-entity-1.json');
        console.log(` Storing: resolvedPaths.entity1 = "${resolvedPaths.entity1}"`);
        resolvedPaths.playerEntity = realResolver.resolveContentPath('entities', 'test-player.entity.json');
        console.log(` Storing: resolvedPaths.playerEntity = "${resolvedPaths.playerEntity}"`);
        console.log('--- Finished populating resolvedPaths ---');

        // *** DEBUG LOG 4: Log the final state of resolvedPaths.schemas ***
        console.log('--- Final resolvedPaths.schemas object: ---');
        console.log(resolvedPaths.schemas);
        console.log('------------------------------------------\n');


        // --- Instantiate Orchestrating Loaders with Real/Mock Dependencies ---
        schemaLoader = new SchemaLoader(realConfig, realResolver, mockDataFetcher, realValidator, mockLogger);
        manifestLoader = new ManifestLoader(realConfig, realResolver, mockDataFetcher, realValidator, mockLogger);
        contentLoader = new GenericContentLoader(realConfig, realResolver, mockDataFetcher, realValidator, realRegistry, mockLogger);
        // *** ADDED: Instantiate ComponentDefinitionLoader ***
        componentDefinitionLoader = new ComponentDefinitionLoader(
            realConfig,         // configuration
            realResolver,       // pathResolver
            mockDataFetcher,    // fetcher
            realValidator,      // validator
            realRegistry,       // registry
            mockLogger          // logger
        );

        // --- Instantiate System Under Test (WorldLoader) ---
        // *** UPDATED: Correct arguments passed to WorldLoader constructor ***
        worldLoader = new WorldLoader(
            realRegistry,             // 1st: registry
            mockLogger,               // 2nd: logger
            schemaLoader,             // 3rd: schemaLoader
            manifestLoader,           // 4th: manifestLoader
            contentLoader,            // 5th: contentLoader
            componentDefinitionLoader,// 6th: componentDefinitionLoader (NEW)
            realValidator,            // 7th: validator (Shifted)
            realConfig                // 8th: configuration (Shifted)
        );
    });

    it('should successfully load schemas, manifest, and content into the registry', async () => {
        // --- Act ---
        console.log('\n===== TEST EXECUTION STARTS =====\n');
        // --- Act ---
        await worldLoader.loadWorld('test-world');
        console.log('\n===== TEST EXECUTION ENDS =====\n');

        // --- Assert ---

        // 1. IDataRegistry State
        const loadedManifest = realRegistry.getManifest();
        const loadedItems = realRegistry.getAll('items');
        const loadedEntities = realRegistry.getAll('entities');
        const loadedComponentDefs = realRegistry.getAll('component_definitions'); // *** ADDED CHECK ***

        expect(loadedManifest).toBeDefined();
        expect(loadedManifest).toEqual(testManifest); // Verify manifest content

        expect(loadedItems).toHaveLength(1);
        expect(loadedItems[0]).toEqual(testItem1); // Verify item content

        expect(loadedEntities).toHaveLength(2); // testEntity1 + testPlayer
        expect(loadedEntities).toEqual(expect.arrayContaining([testEntity1, testPlayer])); // Verify entity content (order-independent)

        // *** ADDED ASSERTION: Expect no component defs yet due to placeholder file discovery ***
        expect(loadedComponentDefs).toEqual([]);

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
        // NOTE: No fetch calls expected for component definitions yet

        // Count fetch calls - number of test schemas + 1 manifest + 3 content files
        // If ComponentDefinitionLoader's file discovery was active, this would change.
        const expectedFetchCount = Object.keys(resolvedPaths.schemas).length + 1 + 3; // 18 schemas + 1 manifest + 3 content
        // console.log("Fetch calls:", mockDataFetcher._calls.length, "Expected:", expectedFetchCount);
        // Filter out potential debug calls if any were added to the mock
        // expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(expectedFetchCount);


        // 3. Mock ILogger Interactions (Optional)
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for specific success logs if desired
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("WorldLoader: Starting full data load for world: 'test-world'"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Schema loading completed."));
        // *** ADDED CHECK: Logs related to ComponentDefinitionLoader ***
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("WorldLoader: Starting component definition loading..."));
        // Check for the warning because no files are found (due to placeholder discovery)
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("ComponentDefinitionLoader: No component definition files (*.component.json) found"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("WorldLoader: Component definition loading completed successfully."));
        // --- End Added Check ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Manifest for world 'test-world' loaded and validated."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("All content loading tasks based on manifest completed."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("WorldLoader: Data load orchestration for world 'test-world' completed successfully."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("--- WorldLoader Load Summary for 'test-world' ---"));
        // *** UPDATED CHECK: Summary log should mention 0 component defs ***
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Component Definitions: 0 loaded."));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Total Manifest Content Items Loaded: 3")); // 1 item + 2 entities (still correct)
    });
});