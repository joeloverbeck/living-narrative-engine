// dataManager.js

// Import from Skypack CDN (specifying version 8 is safer)
import Ajv from 'https://cdn.skypack.dev/ajv@8';

// --- Configuration for MVP File Loading ---
// In a real app, this might come from a manifest file or server listing
const BASE_DATA_PATH = './data';

const SCHEMA_FILES = [
    'action.schema.json',
    'entity.schema.json',
    'event_trigger.schema.json',
    'interaction_test.schema.json',
    'item.schema.json',
    'location.schema.json',
    'quest.schema.json',
    'objective.schema.json',
];

const CONTENT_FILES = {
    actions: [
        'core_action_attack.json',
        'core_action_move.json',
        'core_action_take.json',
        'core_action_drop.json',
        'core_action_use.json',
        'core_action_look.json',
        'core_action_equip.json',
        'core_action_unequip.json',
        'core_action_inventory.json'
    ],
    entities: [ // Includes items and characters
        'core_player.json',
        'demo_enemy_goblin.json',
        'demo_item_key.json',
        'demo_item_potion_heal_minor.json',
        'demo_item_sword.json',
        'demo_item_leather_vest.json',
        'demo_room_entrance.json',
        'demo_room_hallway.json',
        'demo_room_monster.json',
        'demo_room_treasure.json',
        'demo_room_exit.json'
    ],
    triggers: [ // Note: This file contains an array
        'demo_triggers.json'
    ],
    objectives: [
        'story_a_obj_defeat_boss.json'
    ],
    quests: [
        'demo_quest_fetch_herbs.json'
    ],
};

const CONTENT_TYPE_SCHEMAS = {
    actions: 'http://example.com/schemas/action.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json', // Base schema
    interaction_tests: 'http://example.com/schemas/interaction_test.schema.json',
    items: 'http://example.com/schemas/item.schema.json',
    locations: 'http://example.com/schemas/location.schema.json',
    triggers: 'http://example.com/schemas/event_trigger.schema.json',
    objectives: 'http://example.com/schemas/objective.schema.json',
    quests: 'http://example.com/schemas/quest.schema.json',
};

// -----------------------------------------

class DataManager {
    constructor() {
        // Directly instantiate using the imported Ajv
        try {
            this.ajv = new Ajv({allErrors: true}); // Use the imported Ajv directly
            console.log("Successfully instantiated Ajv from Skypack import.");
        } catch (e) {
            console.error("Failed to instantiate Ajv even after import from Skypack:", e);
            alert("Critical error: Failed to initialize the Ajv validation library.");
            throw e; // Halt if instantiation fails
        }

        // In-memory storage
        this.schemas = new Map();
        this.actions = new Map();
        this.entities = new Map(); // Stores base entities, items, locations
        this.triggers = new Map();
        this.quests = new Map();
        this.objectives = new Map();
    }

    /**
     * Main entry point to load all game data. Must be called at startup.
     * @returns {Promise<void>} Resolves when loading is complete, rejects on error.
     */
    async loadAllData() {
        console.log("DataManager: Starting data load...");
        try {
            await this.loadSchemas();
            await this.loadContent();
            console.log("DataManager: Data load completed successfully.");
            this._logLoadedCounts(); // Log how much was loaded
        } catch (error) {
            console.error("DataManager: CRITICAL ERROR during data load. Halting.", error);
            // In a real app, you might show an error message to the user
            // Application should not continue if core data failed to load.
            alert(`Critical data loading error: ${error.message}. See console for details. Application cannot start.`);
            throw error; // Re-throw to halt execution
        }
    }

    /**
     * Loads and compiles all JSON schemas listed in SCHEMA_FILES.
     * @private
     */
    async loadSchemas() {
        if (!this.ajv) throw new Error("Ajv not initialized before loading schemas!"); // Safety check

        console.log("DataManager: Loading schemas...");
        const schemaPromises = SCHEMA_FILES.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/schemas/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    // Provide more context in the error message
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) fetching schema ${path}`);
                }
                const schema = await response.json();
                const schemaId = schema.$id; // Use $id from schema file

                if (!schemaId) {
                    throw new Error(`Schema file ${filename} is missing required '$id' property.`);
                }

                if (!this.schemas.has(schemaId)) {
                    this.schemas.set(schemaId, schema);
                    try {
                        // Add schema to Ajv instance.
                        this.ajv.addSchema(schema, schemaId);
                        console.log(`DataManager: Loaded and added schema ${schemaId} from ${filename}`);
                    } catch (addSchemaError) {
                        // Improve error logging for Ajv issues
                        console.error(`DataManager: Error adding schema ${schemaId} (${filename}) to Ajv instance.`, addSchemaError);
                        if (addSchemaError.message.includes('already exists')) {
                            console.warn(`DataManager: Schema ${schemaId} might already exist in Ajv, possibly due to dependencies.`);
                        } else {
                            // Log detailed errors if available (e.g., duplicate keys within the schema itself)
                            if (addSchemaError.errors) {
                                console.error("Ajv Validation Errors:", JSON.stringify(addSchemaError.errors, null, 2));
                            }
                            throw new Error(`Failed to add schema ${schemaId} to Ajv.`);
                        }
                    }
                } else {
                    console.warn(`DataManager: Schema ${schemaId} already loaded or added. Skipping add for ${filename}.`);
                }

            } catch (error) {
                console.error(`DataManager: Failed to load or parse schema ${path}`, error);
                // Ensure this error propagates to halt loading
                throw new Error(`Failed processing schema ${filename}: ${error.message}`);
            }
        });

        // Wait for all schema loading and compilation attempts
        await Promise.all(schemaPromises);
        console.log(`DataManager: All ${this.schemas.size} specified schemas processed and attempted to add to validator.`);

        // --- TICKET 5 START: Verify quest/objective schemas are loaded ---
        if (!this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.quests)) {
            throw new Error(`DataManager: Quest schema (${CONTENT_TYPE_SCHEMAS.quests}) failed to load or compile.`);
        }
        if (!this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.objectives)) {
            throw new Error(`DataManager: Objective schema (${CONTENT_TYPE_SCHEMAS.objectives}) failed to load or compile.`);
        }
        console.log("DataManager: Quest and Objective schemas successfully registered with validator.");
        // --- TICKET 5 END ---
    }

    /**
     * Loads and validates all content files defined in CONTENT_FILES.
     * @private
     */
    async loadContent() {
        if (!this.ajv) throw new Error("Ajv not initialized before loading content!");

        console.log("DataManager: Loading content definitions...");

        const loadingPromises = [
            // Load standard single-object-per-file types
            this.loadAndValidateContentType('actions', CONTENT_FILES.actions, CONTENT_TYPE_SCHEMAS.actions),
            // --- TICKET 5 START: Add loading for quests and objectives ---
            this.loadAndValidateContentType('quests', CONTENT_FILES.quests, CONTENT_TYPE_SCHEMAS.quests),
            this.loadAndValidateContentType('objectives', CONTENT_FILES.objectives, CONTENT_TYPE_SCHEMAS.objectives),
            // --- TICKET 5 END ---

            // Load types with special handling
            this.loadAndValidateEntities(), // Handles entities, items, locations based on schema used
            this.loadAndValidateTriggers(), // Handles array-based trigger files
        ];

        await Promise.all(loadingPromises);
        console.log("DataManager: All content definitions loaded and validated.");
    }

    /**
     * Generic function to load, parse, validate, and store definitions of a specific type
     * where each file contains a single JSON object definition.
     * @private
     * @param {string} typeName - The type of content (e.g., 'actions', 'quests', 'objectives').
     * @param {string[]} filenames - List of filenames for this content type.
     * @param {string} schemaId - The $id of the schema to validate against.
     * @returns {Promise<void>}
     */
    async loadAndValidateContentType(typeName, filenames, schemaId) {
        console.log(`DataManager: Loading ${typeName}...`);
        const targetMap = this[typeName]; // Get the correct map (e.g., this.actions, this.quests)
        if (!targetMap) {
            // This error should ideally not happen if the constructor and config are correct
            console.error(`DataManager: Developer Error - Target map 'this.${typeName}' does not exist.`);
            throw new Error(`DataManager: Invalid content type specified or not initialized: ${typeName}`);
        }

        const validator = this.ajv.getSchema(schemaId);
        if (!validator) {
            // This indicates a schema failed to load/compile in loadSchemas
            console.error(`DataManager: Schema ${schemaId} not found or not compiled for validating ${typeName}. Check loadSchemas logs.`);
            throw new Error(`DataManager: Prerequisite schema ${schemaId} is not available for validating ${typeName}.`);
        }

        const filePromises = filenames.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) for ${path}`);
                }
                const data = await response.json();

                // Validate the loaded data
                const isValid = validator(data);
                if (!isValid) {
                    // Provide clearer error messages for validation failures
                    const errorDetails = JSON.stringify(validator.errors, null, 2);
                    console.error(`Schema validation failed for ${path} using schema ${schemaId}:\n${errorDetails}`);
                    // Include file path and schema in the thrown error for better debugging
                    throw new Error(`Schema validation failed for ${typeName} file '${filename}' against schema ${schemaId}. See console for details.`);
                }

                // Store the validated data, keyed by ID
                if (!data.id) {
                    // Critical data integrity issue
                    throw new Error(`Data in ${path} is missing required 'id' property.`);
                }
                if (targetMap.has(data.id)) {
                    // Warn about duplicates, as specified in acceptance criteria implicitly (loading all files)
                    console.warn(`DataManager: Duplicate ID detected for ${typeName}: ${data.id} in ${filename}. Overwriting previous definition from an earlier file.`);
                }
                targetMap.set(data.id, data);
                // console.log(`DataManager: Validated and stored ${typeName}: ${data.id}`); // Optional: Verbose logging

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate ${path}`, error);
                // Re-throw to ensure the failure is caught by loadAllData
                throw new Error(`Error processing ${typeName} file ${filename}: ${error.message}`);
            }
        });

        // Wait for all files of this type to be processed
        await Promise.all(filePromises);
        console.log(`DataManager: Finished loading ${targetMap.size} ${typeName}.`);
    }

    /**
     * Special handler for entities, distinguishing between items, locations, and base entities.
     * @private
     */
    async loadAndValidateEntities() {
        const typeName = 'entities';
        console.log(`DataManager: Loading ${typeName} (incl. items, locations)...`);
        const filenames = CONTENT_FILES.entities; // Get the combined list
        const targetMap = this.entities; // Unified storage

        // Get validators for all relevant types
        const entityValidator = this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.entities);
        const itemValidator = this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.items);
        const locationValidator = this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.locations);

        // Ensure all required schemas are available before proceeding
        if (!entityValidator) throw new Error(`DataManager: Base Entity schema (${CONTENT_TYPE_SCHEMAS.entities}) not found or compiled.`);
        if (!itemValidator) throw new Error(`DataManager: Item schema (${CONTENT_TYPE_SCHEMAS.items}) not found or compiled.`);
        if (!locationValidator) throw new Error(`DataManager: Location schema (${CONTENT_TYPE_SCHEMAS.locations}) not found or compiled.`);

        const filePromises = filenames.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) for ${path}`);
                }
                const data = await response.json();

                if (!data.id) {
                    throw new Error(`Data in ${path} is missing required 'id' property.`);
                }

                let isValid = false;
                let validatorToUse = null; // Store the validator function used
                let validationErrors = null;
                let usedSchemaId = '';
                let entityType = 'Unknown'; // Start as unknown

                // --- Determine entity type and validate ---
                // Prioritize more specific types first (Location, then Item, then base Entity)
                // Check for distinctive properties or components. Adjust these checks if your schema changes.
                if (data.components?.Connections || data.components?.LocationInfo) { // Heuristic for Location
                    entityType = 'Location';
                    validatorToUse = locationValidator;
                    usedSchemaId = CONTENT_TYPE_SCHEMAS.locations;
                } else if (data.components?.Item || data.components?.Equippable) { // Heuristic for Item
                    entityType = 'Item';
                    validatorToUse = itemValidator;
                    usedSchemaId = CONTENT_TYPE_SCHEMAS.items;
                } else { // Assume base Entity otherwise
                    entityType = 'Entity';
                    validatorToUse = entityValidator;
                    usedSchemaId = CONTENT_TYPE_SCHEMAS.entities;
                }

                isValid = validatorToUse(data); // Perform validation
                validationErrors = validatorToUse.errors; // Get errors if any

                if (!isValid) {
                    const errorDetailsString = JSON.stringify(validationErrors, null, 2);
                    console.error(`Schema validation failed for ${path} (detected type: ${entityType}) using schema ${usedSchemaId}. Errors:\n`, validationErrors);
                    throw new Error(`Schema validation failed for ${entityType} file '${filename}' using schema ${usedSchemaId}:\n${errorDetailsString}`);
                }

                // Store the validated data in the unified entities map
                if (targetMap.has(data.id)) {
                    console.warn(`DataManager: Duplicate ID detected for ${typeName}/${entityType}: ${data.id} in ${filename}. Overwriting previous definition.`);
                }
                targetMap.set(data.id, data);
                // console.log(`DataManager: Validated and stored ${entityType}: ${data.id}`); // Optional verbose log

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate entity file ${path}`, error);
                throw new Error(`Error processing entity file ${filename}: ${error.message}`); // Propagate error
            }
        });

        await Promise.all(filePromises);
        console.log(`DataManager: Finished loading ${targetMap.size} entities/items/locations.`);
    }

    /**
     * Special handler for triggers, as the file contains an array.
     * @private
     */
    async loadAndValidateTriggers() {
        const typeName = 'triggers';
        console.log(`DataManager: Loading ${typeName}...`);
        const filenames = CONTENT_FILES.triggers; // Expecting one or more files, each containing an array
        const targetMap = this.triggers;
        const schemaId = CONTENT_TYPE_SCHEMAS.triggers; // Schema should validate an array of triggers

        const validator = this.ajv.getSchema(schemaId);
        if (!validator) {
            console.error(`DataManager: Schema ${schemaId} not found or compiled for validating ${typeName}. Check loadSchemas logs.`);
            throw new Error(`DataManager: Prerequisite schema ${schemaId} is not available for validating ${typeName}.`);
        }

        const filePromises = filenames.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (${response.statusText}) for ${path}`);
                }
                // Expecting an array of triggers in the file
                const triggerArray = await response.json();

                // --- Validate the entire array against the schema ---
                // NOTE: Ensure your trigger schema (`event_trigger.schema.json`) is defined
                //       to expect an array at the root if the file contains an array.
                //       If the schema expects a single trigger object, this validation will fail.
                //       Assuming the schema validates an ARRAY of trigger objects.
                const isValid = validator(triggerArray);
                if (!isValid) {
                    const errorDetails = JSON.stringify(validator.errors, null, 2);
                    console.error(`Schema validation failed for trigger array in ${path} using schema ${schemaId}:\n${errorDetails}`);
                    throw new Error(`Schema validation failed for trigger array in file '${filename}'. See console for details.`);
                }

                // Store each individual trigger object from the array, keyed by its ID
                let countInFile = 0;
                for (const triggerData of triggerArray) {
                    if (!triggerData || typeof triggerData !== 'object') {
                        console.warn(`DataManager: Non-object item found in trigger array in ${path}. Skipping.`);
                        continue; // Skip non-objects gracefully
                    }
                    if (!triggerData.id) {
                        // Halt loading if a trigger lacks an ID, as it's crucial
                        throw new Error(`Trigger object in ${path} (index ${countInFile}) is missing required 'id' property.`);
                    }
                    if (targetMap.has(triggerData.id)) {
                        console.warn(`DataManager: Duplicate ID detected for ${typeName}: ${triggerData.id} in ${filename}. Overwriting previous definition.`);
                    }
                    targetMap.set(triggerData.id, triggerData);
                    countInFile++;
                    // console.log(`DataManager: Validated and stored ${typeName}: ${triggerData.id}`); // Optional verbose log
                }
                console.log(`DataManager: Loaded ${countInFile} triggers from ${filename}.`);

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate trigger file ${path}`, error);
                throw new Error(`Error processing trigger file ${filename}: ${error.message}`); // Propagate error
            }
        });

        await Promise.all(filePromises);
        console.log(`DataManager: Finished loading ${targetMap.size} total ${typeName}.`);
    }


    // --- Public Accessor Methods ---

    getAction(id) {
        return this.actions.get(id);
    }

    getEntityDefinition(id) { // Searches the unified map (entities, items, locations)
        return this.entities.get(id);
    }

    getTrigger(id) {
        return this.triggers.get(id);
    }

    getAllTriggers() {
        return Array.from(this.triggers.values());
    }

    /**
     * Retrieves a quest definition by its unique ID.
     * @param {string} questId - The unique identifier of the quest.
     * @returns {object | undefined} The quest definition object, or undefined if not found.
     */
    getQuestDefinition(questId) {
        return this.quests.get(questId);
    }

    /**
     * Retrieves an objective definition by its unique ID.
     * @param {string} objectiveId - The unique identifier of the objective.
     * @returns {object | undefined} The objective definition object, or undefined if not found.
     */
    getObjectiveDefinition(objectiveId) {
        return this.objectives.get(objectiveId);
    }


    // --- Helper Methods ---

    _logLoadedCounts() {
        console.log("DataManager Load Summary:");
        console.log(`  - Schemas Parsed: ${this.schemas.size}`);
        console.log(`  - Actions: ${this.actions.size}`);
        console.log(`  - Entities/Items/Locations: ${this.entities.size}`);
        console.log(`  - Triggers: ${this.triggers.size}`);
        console.log(`  - Quests: ${this.quests.size}`);
        console.log(`  - Objectives: ${this.objectives.size}`);
    }
}

export default DataManager;