// dataManager.js

// Import from Skypack CDN (specifying version 8 is safer)
import Ajv from 'https://cdn.skypack.dev/ajv@8';

// Base path for all data
const BASE_DATA_PATH = './data';

// List of schema files
const SCHEMA_FILES = [
    'common.schema.json',
    'action.schema.json',
    'entity.schema.json',
    'event-trigger.schema.json',
    'interaction-test.schema.json',
    'item.schema.json',
    'location.schema.json',
    'quest.schema.json',
    'objective.schema.json',
    'world-manifest.schema.json',
    'container.schema.json',
    'lockable.schema.json',
    'openable.schema.json',
    'edible.schema.json',
    'pushable.schema.json',
    'liquid-container.schema.json'
];

// Mapping of content types (keys from manifest) to their schema $ids
// Ensure all types expected in manifests are listed here
const CONTENT_TYPE_SCHEMAS = {
    common: 'http://example.com/schemas/common.schema.json',
    actions: 'http://example.com/schemas/action.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json', // For player/NPC entities listed under "entities"
    items: 'http://example.com/schemas/item.schema.json', // For items listed under "items"
    locations: 'http://example.com/schemas/location.schema.json', // For locations listed under "locations"
    triggers: 'http://example.com/schemas/event-trigger.schema.json', // For triggers listed under "triggers" (array)
    objectives: 'http://example.com/schemas/objective.schema.json', // For objectives listed under "objectives"
    quests: 'http://example.com/schemas/quest.schema.json', // For quests listed under "quests"
    interactionTests: 'http://example.com/schemas/interaction-test.schema.json', // For tests listed under "interactionTests"
    manifest: 'http://example.com/schemas/world-manifest.schema.json', // Schema for the manifest itself
    containers: 'http://example.com/schemas/container.schema.json',
    lockables: 'http://example.com/schemas/lockable.schema.json',
    openables: 'http://example.com/schemas/openable.schema.json',
    edibles: 'http://example.com/schemas/edible.schema.json',
    pushables: 'http://example.com/schemas/pushable.schema.json',
    liquidContainers: 'http://example.com/schemas/liquid-container.schema.json',
};

// -----------------------------------------

class DataManager {
    // --- Private Properties ---
    #worldManifestData = null; // Stores the loaded world manifest object
    #currentWorldName = null; // Stores the name of the loaded world
    #ajv = null; // Ajv instance

    // --- In-memory storage ---
    schemas = new Map();
    actions = new Map();
    entities = new Map();
    items = new Map();
    locations = new Map();
    triggers = new Map();
    quests = new Map();
    objectives = new Map();
    interactionTests = new Map();

    constructor() {
        try {
            this.#ajv = new Ajv({
                allErrors: true,
                strictTypes: false
            });
            console.log("Successfully instantiated Ajv.");
        } catch (e) {
            console.error("Failed to instantiate Ajv:", e);
            alert("Critical error: Failed to initialize the Ajv validation library.");
            throw e;
        }
    }

    /**
     * Main entry point to load all game data for a specific world.
     * Must be called at startup after choosing a world.
     * @param {string} worldName - The name of the world to load (e.g., 'demo').
     * @returns {Promise<void>} Resolves when loading is complete, rejects on error.
     */
    async loadAllData(worldName) {
        if (!worldName) {
            throw new Error("DataManager: worldName must be provided to loadAllData.");
        }
        console.log(`DataManager: Starting data load for world: ${worldName}...`);
        this.#resetDataMaps(); // Clear any previously loaded data

        try {
            await this.loadSchemas(); // Load all schemas first
            await this.#loadWorldManifest(worldName); // Load and validate the specific world manifest
            await this.#loadContent(); // Load content based on the manifest
            console.log(`DataManager: Data load for world '${this.#currentWorldName}' completed successfully.`);
            this._logLoadedCounts(); // Log how much was loaded
        } catch (error) {
            console.error(`DataManager: CRITICAL ERROR during data load for world '${worldName}'. Halting.`, error);
            alert(`Critical data loading error for world '${worldName}': ${error.message}. See console for details. Application cannot start.`);
            this.#resetDataMaps(); // Clear partial data on failure
            throw error; // Re-throw to halt execution
        }
    }

    /**
     * Clears all loaded content data maps. Called before loading a new world.
     * @private
     */
    #resetDataMaps() {
        this.actions.clear();
        this.entities.clear();
        this.items.clear();
        this.locations.clear();
        this.triggers.clear();
        this.quests.clear();
        this.objectives.clear();
        this.interactionTests.clear();
        this.#worldManifestData = null;
        this.#currentWorldName = null;
        console.log("DataManager: Cleared existing content data.");
    }


    /**
     * Loads and compiles all JSON schemas listed in SCHEMA_FILES.
     * @private
     */
    async loadSchemas() {
        if (!this.#ajv) throw new Error("Ajv not initialized before loading schemas!");

        // Avoid reloading schemas if already loaded
        if (this.schemas.size > 0 && SCHEMA_FILES.every(f => this.schemas.has(CONTENT_TYPE_SCHEMAS[f.split('.')[0]] || `http://example.com/schemas/${f}`))) {
            console.log("DataManager: Schemas appear to be already loaded. Skipping reload.");
            // Quick check if essential schemas are compiled in Ajv
            if (this.#ajv.getSchema(CONTENT_TYPE_SCHEMAS.entities) && this.#ajv.getSchema(CONTENT_TYPE_SCHEMAS.manifest)) {
                return; // Assume schemas are ready
            } else {
                console.warn("DataManager: Schemas map populated, but essential schemas missing from Ajv. Forcing reload.");
                this.schemas.clear(); // Clear map to force reload
                // Note: Ajv doesn't have a simple 'clear' - recreating might be safer if needed, but adding should be okay.
            }
        }


        console.log("DataManager: Loading schemas...");
        const schemaPromises = SCHEMA_FILES.map(async (filename) => {
            // Adjusted path for schemas
            const path = `${BASE_DATA_PATH}/schemas/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) fetching schema ${path}`);
                }
                const schema = await response.json();
                const schemaId = schema.$id; // Use $id from schema file

                if (!schemaId) {
                    throw new Error(`Schema file ${filename} is missing required '$id' property.`);
                }

                // Add schema to internal map and Ajv instance if not already present
                if (!this.schemas.has(schemaId)) {
                    this.schemas.set(schemaId, schema);
                    try {
                        // Use addSchema with the schema object and its ID
                        this.#ajv.addSchema(schema, schemaId);
                        console.log(`DataManager: Loaded and added schema ${schemaId} from ${filename}`);
                    } catch (addSchemaError) {
                        console.error(`DataManager: Error adding schema ${schemaId} (${filename}) to Ajv instance.`, addSchemaError);
                        if (addSchemaError.message.includes('already exists')) {
                            console.warn(`DataManager: Schema ${schemaId} might already exist in Ajv.`);
                            // Ensure it's actually retrievable if Ajv claims it exists
                            if (!this.#ajv.getSchema(schemaId)) {
                                throw new Error(`Ajv reported schema ${schemaId} exists but getSchema failed.`);
                            }
                        } else {
                            if (addSchemaError.errors) {
                                console.error("Ajv Validation Errors:", JSON.stringify(addSchemaError.errors, null, 2));
                            }
                            throw new Error(`Failed to add schema ${schemaId} to Ajv: ${addSchemaError.message}`);
                        }
                    }
                } else {
                    console.warn(`DataManager: Schema ${schemaId} already in internal map. Ensuring it's in Ajv.`);
                    // Double-check if it's in Ajv, add if missing (e.g., after a clear)
                    if (!this.#ajv.getSchema(schemaId)) {
                        try {
                            this.#ajv.addSchema(this.schemas.get(schemaId), schemaId);
                            console.log(`DataManager: Added missing schema ${schemaId} to Ajv from internal map.`);
                        } catch (reAddError) {
                            console.error(`DataManager: Failed to re-add schema ${schemaId} to Ajv.`, reAddError);
                            throw new Error(`Failed to re-add schema ${schemaId} to Ajv: ${reAddError.message}`);
                        }
                    }
                }

            } catch (error) {
                console.error(`DataManager: Failed to load or process schema ${path}`, error);
                throw new Error(`Failed processing schema ${filename}: ${error.message}`); // Halt loading
            }
        });

        await Promise.all(schemaPromises);
        console.log(`DataManager: All ${this.schemas.size} specified schemas processed.`);

        // Final check for essential schemas needed for content/manifest validation
        const requiredSchemaIds = [
            CONTENT_TYPE_SCHEMAS.manifest,
            CONTENT_TYPE_SCHEMAS.entities,
            CONTENT_TYPE_SCHEMAS.items,
            CONTENT_TYPE_SCHEMAS.locations
            // Add other essential schemas if needed
        ];
        for (const id of requiredSchemaIds) {
            if (!this.#ajv.getSchema(id)) {
                console.error(`DataManager: Essential schema ${id} failed to load or compile. Content loading cannot proceed.`);
                throw new Error(`DataManager: Prerequisite schema ${id} is not available.`);
            }
        }
        console.log("DataManager: Essential schemas confirmed available in validator.");
    }

    /**
     * Loads and validates the world manifest file for the specified world.
     * @param {string} worldName - The name of the world (e.g., 'demo').
     * @private
     */
    async #loadWorldManifest(worldName) {
        if (!this.#ajv) throw new Error("Ajv not initialized before loading manifest!");
        this.#currentWorldName = worldName; // Store the current world name
        const manifestPath = `${BASE_DATA_PATH}/worlds/${worldName}.world.json`;
        const manifestSchemaId = CONTENT_TYPE_SCHEMAS.manifest; //'http://example.com/schemas/world-manifest.schema.json';

        console.log(`DataManager: Loading manifest for world '${worldName}' from ${manifestPath}...`);

        try {
            const response = await fetch(manifestPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) fetching manifest ${manifestPath}`);
            }
            const manifestData = await response.json();

            // --- Validate the manifest ---
            const validator = this.#ajv.getSchema(manifestSchemaId);
            if (!validator) {
                // This should ideally not happen if loadSchemas worked correctly
                console.error(`DataManager: World manifest schema (${manifestSchemaId}) not found or compiled. Check loadSchemas.`);
                throw new Error(`DataManager: Prerequisite schema ${manifestSchemaId} is not available for validating the world manifest.`);
            }

            const isValid = validator(manifestData);
            if (!isValid) {
                const errorDetails = JSON.stringify(validator.errors, null, 2);
                console.error(`Schema validation failed for ${manifestPath} using schema ${manifestSchemaId}:\n${errorDetails}`);
                throw new Error(`Schema validation failed for world manifest '${worldName}'. See console for details.`);
            }

            console.log(`DataManager: Manifest for world '${worldName}' loaded and validated successfully.`);
            this.#worldManifestData = manifestData; // Store the validated manifest

            // Basic check for contentFiles structure
            if (!this.#worldManifestData.contentFiles || typeof this.#worldManifestData.contentFiles !== 'object') {
                throw new Error(`Manifest for world '${worldName}' is missing the required 'contentFiles' object.`);
            }


        } catch (error) {
            console.error(`DataManager: Failed to load or validate manifest ${manifestPath}`, error);
            this.#currentWorldName = null; // Reset world name on failure
            throw new Error(`Error processing world manifest for '${worldName}': ${error.message}`); // Propagate error
        }
    }


    /**
     * Loads and validates all content files defined in the loaded world manifest.
     * Uses the #worldManifestData property.
     * @private
     */
    async #loadContent() {
        if (!this.#ajv) throw new Error("Ajv not initialized before loading content!");
        if (!this.#worldManifestData) throw new Error("World manifest not loaded before loading content!");
        if (!this.#currentWorldName) throw new Error("Current world name not set before loading content!");

        console.log(`DataManager: Loading content definitions for world '${this.#currentWorldName}' based on manifest...`);

        const contentFiles = this.#worldManifestData.contentFiles;
        const loadingPromises = [];

        // Iterate through the content types defined in the manifest's contentFiles
        for (const typeName in contentFiles) {
            if (Object.hasOwnProperty.call(contentFiles, typeName)) {
                const filenames = contentFiles[typeName];

                if (!Array.isArray(filenames)) {
                    console.warn(`DataManager: Expected an array for content type '${typeName}' in manifest, but got ${typeof filenames}. Skipping.`);
                    continue;
                }
                if (filenames.length === 0) {
                    console.log(`DataManager: No files listed for content type '${typeName}' in manifest. Skipping.`);
                    continue;
                }

                const schemaId = CONTENT_TYPE_SCHEMAS[typeName];
                if (!schemaId) {
                    console.warn(`DataManager: No schema mapping found for content type '${typeName}' defined in manifest. Skipping validation for this type.`);
                    // Decide if you want to load without validation or throw an error
                    // For now, we'll skip loading if schema is unknown, as validation is key
                    // throw new Error(`Unknown content type '${typeName}' encountered in manifest. No schema mapping defined.`);
                    continue; // Skip loading unknown types
                }

                // --- Choose the appropriate loading function based on typeName ---
                switch (typeName) {
                    case 'entities':
                    case 'items':
                    case 'locations':
                        // Use the dedicated entity loader which handles unified map storage
                        // Pass the typeName so it knows the subdirectory and schema
                        loadingPromises.push(this.#loadAndValidateEntityTypes(typeName, filenames, schemaId));
                        break;

                    case 'actions':
                    case 'quests':
                    case 'objectives':
                    case 'interactionTests':
                    case 'triggers':
                        // Generic loader for types where each file is one object
                        loadingPromises.push(this.#loadAndValidateContentType(typeName, filenames, schemaId));
                        break;

                    default:
                        console.warn(`DataManager: Unhandled content type '${typeName}' in manifest loading switch. Add a case if needed.`);
                        break;
                }
            }
        }

        if (loadingPromises.length === 0) {
            console.warn(`DataManager: No content files found or processed based on the manifest for world '${this.#currentWorldName}'.`);
        }

        await Promise.all(loadingPromises);
        console.log(`DataManager: Content loading based on manifest for world '${this.#currentWorldName}' finished.`);
    }

    /**
     * Generic function to load, parse, validate, and store definitions of a specific type
     * where each file contains a single JSON object definition.
     * Uses the CORRECTED path structure: data/<typeName>/<filename>
     * @private
     * @param {string} typeName - The type of content (e.g., 'actions', 'quests').
     * @param {string[]} filenames - List of filenames for this content type (from manifest).
     * @param {string} schemaId - The $id of the schema to validate against.
     * @returns {Promise<void>}
     */
    async #loadAndValidateContentType(typeName, filenames, schemaId) {
        console.log(`DataManager: Loading ${filenames.length} ${typeName}...`);
        // Determine the target map (e.g., this.actions, this.quests, this.interactionTests)
        const targetMap = this[typeName];
        if (!targetMap || typeof targetMap.set !== 'function') {
            console.error(`DataManager: Developer Error - Target map 'this.${typeName}' does not exist or is not a Map.`);
            throw new Error(`DataManager: Invalid content type specified or target map not initialized: ${typeName}`);
        }

        const validator = this.#ajv.getSchema(schemaId);
        if (!validator) {
            console.error(`DataManager: Schema ${schemaId} not found or not compiled for validating ${typeName}. Check loadSchemas logs.`);
            throw new Error(`DataManager: Prerequisite schema ${schemaId} is not available for validating ${typeName}.`);
        }

        const filePromises = filenames.map(async (filename) => {
            // Assumes filenames in manifest are like 'core_ttack.action.json'
            // And files are located like 'data/actions/core_attack.action.json'
            if (filename.includes('/') || filename.includes('\\')) {
                console.warn(`DataManager: Filename '${filename}' for type '${typeName}' contains path separators. Ensure this is intended and paths in manifest are correct relative filenames only.`);
                // Assuming the filename IS the relative path needed within the type directory.
            }
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            //console.log(`Attempting to load: ${path}`); // Debug log for path

            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) for ${path}`);
                }
                const data = await response.json();

                // Validate the loaded data
                const isValid = validator(data);
                if (!isValid) {
                    const errorDetails = JSON.stringify(validator.errors, null, 2);
                    console.error(`Schema validation failed for ${path} using schema ${schemaId}:\n${errorDetails}`);
                    throw new Error(`Schema validation failed for ${typeName} file '${filename}' against schema ${schemaId}. See console for details.`);
                }

                // Store the validated data, keyed by ID
                if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
                    throw new Error(`Data in ${path} is missing a valid required 'id' property.`);
                }
                if (targetMap.has(data.id)) {
                    console.warn(`DataManager: Duplicate ID detected for ${typeName}: '${data.id}' in file ${filename}. Overwriting previous definition.`);
                }
                targetMap.set(data.id, data);

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate ${path}`, error);
                // Re-throw to ensure the failure is caught by loadAllData
                throw new Error(`Error processing ${typeName} file ${filename}: ${error.message}`);
            }
        });

        await Promise.all(filePromises);
        console.log(`DataManager: Finished loading ${targetMap.size} ${typeName}.`);
    }


    /**
     * Special handler for loading entities, items, and locations listed in the manifest.
     * Stores all of them in the unified `this.entities` map.
     * Uses the CORRECTED path structure: data/<typeName>/<filename>
     * @private
     * @param {string} typeName - The type ('entities', 'items', or 'locations').
     * @param {string[]} filenames - List of filenames for this type (from manifest).
     * @param {string} schemaId - The schema $id corresponding to this typeName.
     * @returns {Promise<void>}
     */
    async #loadAndValidateEntityTypes(typeName, filenames, schemaId) {
        console.log(`DataManager: Loading ${filenames.length} ${typeName} (to unified entity map)...`);
        // All these types go into the unified 'entities' map
        const targetMap = this.entities;

        const validator = this.#ajv.getSchema(schemaId);
        if (!validator) {
            console.error(`DataManager: Schema ${schemaId} not found or compiled for validating ${typeName}. Check loadSchemas.`);
            throw new Error(`DataManager: Prerequisite schema ${schemaId} is not available for validating ${typeName}.`);
        }

        const filePromises = filenames.map(async (filename) => {
            if (filename.includes('/') || filename.includes('\\')) {
                console.warn(`DataManager: Filename '${filename}' for type '${typeName}' contains path separators. Ensure filenames in manifest are correct.`);
            }
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            //console.log(`Attempting to load entity type: ${path}`); // Debug log

            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) for ${path}`);
                }
                const data = await response.json();

                // Validate against the specific schema for this type (entity, item, or location)
                const isValid = validator(data);
                if (!isValid) {
                    const errorDetails = JSON.stringify(validator.errors, null, 2);
                    console.error(`Schema validation failed for ${path} (as type ${typeName}) using schema ${schemaId}:\n${errorDetails}`);
                    throw new Error(`Schema validation failed for ${typeName} file '${filename}' against schema ${schemaId}.`);
                }

                // Store the validated data in the unified entities map
                if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
                    throw new Error(`Data in ${path} (type ${typeName}) is missing a valid required 'id' property.`);
                }
                if (targetMap.has(data.id)) {
                    // More specific warning if duplicate ID found across different types being loaded into the same map
                    console.warn(`DataManager: Duplicate entity ID detected: '${data.id}' from file ${filename} (type ${typeName}). Overwriting previous definition in the unified entity map.`);
                }
                // Add type information for easier debugging later if needed
                // data._internalType = typeName; // Optional: uncomment to add type hint
                targetMap.set(data.id, data);

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate ${path} (as type ${typeName})`, error);
                throw new Error(`Error processing ${typeName} file ${filename}: ${error.message}`);
            }
        });

        await Promise.all(filePromises);
        // Log statement is handled by the calling function (#loadContent summary)
        // console.log(`DataManager: Finished processing ${filenames.length} ${typeName} files.`);
    }

    // --- Public Accessor Methods ---

    getAction(id) {
        return this.actions.get(id);
    }

    /**
     * Retrieves an entity definition (entity, item, or location) by its ID
     * from the unified entity map.
     * @param {string} id - The unique ID of the entity, item, or location.
     * @returns {object | undefined} The definition object or undefined if not found.
     */
    getEntityDefinition(id) {
        return this.entities.get(id);
    }

    getTrigger(id) {
        return this.triggers.get(id);
    }

    getAllTriggers() {
        return Array.from(this.triggers.values());
    }

    getQuestDefinition(questId) {
        return this.quests.get(questId);
    }

    getAllQuestDefinitions() {
        return Array.from(this.quests.values());
    }

    getObjectiveDefinition(objectiveId) {
        return this.objectives.get(objectiveId);
    }

    getInteractionTest(id) {
        return this.interactionTests.get(id);
    }

    /**
     * Gets the starting player entity ID specified in the loaded world manifest.
     * @returns {string | null} The starting player ID or null if manifest not loaded.
     */
    getStartingPlayerId() {
        return this.#worldManifestData?.startingPlayerId ?? null;
    }

    /**
     * Gets the starting location entity ID specified in the loaded world manifest.
     * @returns {string | null} The starting location ID or null if manifest not loaded.
     */
    getStartingLocationId() {
        return this.#worldManifestData?.startingLocationId ?? null;
    }

    /**
     * Gets the name of the currently loaded world from the manifest.
     * @returns {string | null} The world name or null if manifest not loaded.
     */
    getWorldName() {
        return this.#worldManifestData?.worldName ?? null; // Accesses loaded manifest data
        // Alternative: return this.#currentWorldName; // Returns the name passed to loadAllData
    }


    // --- Helper Methods ---

    _logLoadedCounts() {
        console.log("DataManager Load Summary:");
        console.log(`  - World Loaded: ${this.getWorldName() || 'None'}`);
        console.log(`  - Schemas Parsed: ${this.schemas.size}`);
        console.log(`  - Actions: ${this.actions.size}`);
        console.log(`  - Entities/Items/Locations (Unified): ${this.entities.size}`);
        console.log(`  - Triggers: ${this.triggers.size}`);
        console.log(`  - Quests: ${this.quests.size}`);
        console.log(`  - Objectives: ${this.objectives.size}`);
        console.log(`  - Interaction Tests: ${this.interactionTests.size}`);
    }
}

export default DataManager;