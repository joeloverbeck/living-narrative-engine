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
    'interaction_test.schema.json', // Needed for location validation
    'item.schema.json',
    'location.schema.json'
];

const CONTENT_FILES = {
    actions: [
        'core_action_attack.json', // Underscore instead of colon
        'core_action_move.json',   // Underscore instead of colon
        'core_action_take.json',   // Underscore instead of colon
        'core_action_use.json',     // Underscore instead of colon
        'core_action_look.json',
        'core_action_inventory.json'
    ],
    entities: [ // Includes items and characters
        'core_player.json',        // Underscore instead of colon
        'demo_enemy_goblin.json',  // Underscore instead of colon
        'demo_item_key.json',      // Underscore instead of colon
        'demo_item_potion_heal_minor.json', // Underscore instead of colon
        'demo_room_entrance.json', // Underscore instead of colon
        'demo_room_hallway.json',  // Underscore instead of colon
        'demo_room_monster.json',  // Underscore instead of colon
        'demo_room_treasure.json', // Underscore instead of colon
        'demo_room_exit.json'      // Underscore instead of colon
    ],
    triggers: [ // Note: This file contains an array
        'demo_triggers.json'       // This one was likely already okay
    ]
};

const CONTENT_TYPE_SCHEMAS = {
    actions: 'http://example.com/schemas/action.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json', // Base schema
    items: 'http://example.com/schemas/item.schema.json',     // Specific item schema
    locations: 'http://example.com/schemas/location.schema.json',
    triggers: 'http://example.com/schemas/event_trigger.schema.json' // Schema for the *array*
};

// -----------------------------------------

class DataManager {
    constructor() {
        // REMOVE the window.Ajv checks

        // Directly instantiate using the imported Ajv
        try {
            this.ajv = new Ajv({allErrors: true}); // Use the imported Ajv directly
            console.log("Successfully instantiated Ajv from Skypack import.");
        } catch (e) {
            console.error("Failed to instantiate Ajv even after import from Skypack:", e);
            alert("Critical error: Failed to initialize the Ajv validation library.");
            throw e; // Halt if instantiation fails
        }

        // In-memory storage... (rest of constructor is the same)
        this.schemas = new Map();
        this.actions = new Map();
        this.entities = new Map();
        this.triggers = new Map();
    }

    /**
     * Main entry point to load all game data. Must be called at startup.
     * @returns {Promise<void>} Resolves when loading is complete, rejects on error.
     */
    async loadAllData() {
        console.log("DataManager: Starting data load...");
        // No need to explicitly initialize Ajv here anymore
        try {
            await this.loadSchemas();
            await this.loadContent();
            console.log("DataManager: Data load completed successfully.");
            this._logLoadedCounts(); // Optional: Log how much was loaded
        } catch (error) {
            console.error("DataManager: CRITICAL ERROR during data load. Halting.", error);
            // In a real app, you might show an error message to the user
            throw error; // Re-throw to halt execution
        }
    }

    /**
     * Loads and compiles all JSON schemas.
     * @private
     */
    async loadSchemas() {
        // This method should now work as `this.ajv` is already initialized
        if (!this.ajv) throw new Error("Ajv not initialized before loading schemas!"); // Safety check

        console.log("DataManager: Loading schemas...");
        const schemaPromises = SCHEMA_FILES.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/schemas/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${path}`);
                }
                const schema = await response.json();
                const schemaId = schema.$id; // Use $id from schema file

                if (!schemaId) {
                    throw new Error(`Schema file ${filename} is missing required '$id' property.`);
                }

                // Check if schema already added (e.g., if loadSchemas is called multiple times accidentally)
                if (!this.schemas.has(schemaId)) {
                    this.schemas.set(schemaId, schema);
                    try {
                        // Add schema to Ajv instance.
                        this.ajv.addSchema(schema, schemaId);
                        console.log(`DataManager: Loaded and added schema ${schemaId} from ${filename}`);
                    } catch (addSchemaError) {
                        console.error(`DataManager: Error adding schema ${schemaId} to Ajv instance. Maybe a duplicate or invalid schema?`, addSchemaError);
                        // Decide how to handle this - maybe log details from addSchemaError.errors
                        throw new Error(`Failed to add schema ${schemaId} to Ajv.`);
                    }
                } else {
                    console.warn(`DataManager: Schema ${schemaId} already loaded. Skipping add.`);
                }


            } catch (error) {
                console.error(`DataManager: Failed to load or parse schema ${path}`, error);
                throw error; // Propagate error up
            }
        });

        await Promise.all(schemaPromises);
        console.log(`DataManager: All ${this.schemas.size} schemas processed and added to validator.`);
    }

    /**
     * Loads and validates all content files (actions, entities, etc.).
     * @private
     */
    async loadContent() {
        if (!this.ajv) throw new Error("Ajv not initialized before loading content!");

        console.log("DataManager: Loading content definitions...");

        const loadingPromises = [
            this.loadAndValidateContentType('actions', CONTENT_FILES.actions, CONTENT_TYPE_SCHEMAS.actions),
            this.loadAndValidateEntities(), // This will now handle locations too
            this.loadAndValidateTriggers(),
        ];

        await Promise.all(loadingPromises);
        console.log("DataManager: All content definitions loaded and validated.");
    }

    /**
     * Generic function to load, parse, validate, and store definitions of a specific type.
     * @private
     * @param {string} typeName - The type of content (e.g., 'actions').
     * @param {string[]} filenames - List of filenames for this content type.
     * @param {string} schemaId - The $id of the schema to validate against.
     * @returns {Promise<void>}
     */
    async loadAndValidateContentType(typeName, filenames, schemaId) {
        console.log(`DataManager: Loading ${typeName}...`);
        const targetMap = this[typeName]; // Get the correct map (e.g., this.actions)
        if (!targetMap) {
            throw new Error(`DataManager: Invalid content type specified: ${typeName}`);
        }

        const validator = this.ajv.getSchema(schemaId);
        if (!validator) {
            throw new Error(`DataManager: Schema ${schemaId} not found for validating ${typeName}.`);
        }

        const filePromises = filenames.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${path}`);
                }
                const data = await response.json();

                // Validate the loaded data
                const isValid = validator(data);
                if (!isValid) {
                    const errorDetails = JSON.stringify(validator.errors, null, 2);
                    throw new Error(`Schema validation failed for ${path}:\n${errorDetails}`);
                }

                // Store the validated data, keyed by ID
                if (!data.id) {
                    throw new Error(`Data in ${path} is missing required 'id' property.`);
                }
                if (targetMap.has(data.id)) {
                    console.warn(`DataManager: Duplicate ID detected for ${typeName}: ${data.id} in ${filename}. Overwriting previous definition.`);
                }
                targetMap.set(data.id, data);
                // console.log(`DataManager: Validated and stored ${typeName}: ${data.id}`);

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate ${path}`, error);
                throw error; // Propagate error up
            }
        });

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
        const targetMap = this.entities;

        // Get validators for all relevant types
        const entityValidator = this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.entities);
        const itemValidator = this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.items);
        const locationValidator = this.ajv.getSchema(CONTENT_TYPE_SCHEMAS.locations); // Get location validator

        if (!entityValidator || !itemValidator || !locationValidator) { // Check all validators
            throw new Error(`DataManager: Entity, Item, or Location schema not found for validating entities.`);
        }

        const filePromises = filenames.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`; // Use backticks and ${}

            console.log(path);

            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${path}`);
                }
                const data = await response.json();

                if (!data.id) {
                    throw new Error(`Data in ${path} is missing required 'id' property.`);
                }

                let isValid = false;
                let validationErrors = null;
                let usedSchemaId = '';
                let entityType = 'Entity'; // Default type

                // Determine entity type (heuristic based on components or specific properties)
                const isItem = data.components && data.components.Item;
                // Check if it's a location (e.g., has Connections component or a specific 'type' property)
                const isLocation = data.components && data.components.Connections; // Adjust this check as needed

                if (isLocation) {
                    // Validate against Location schema
                    isValid = locationValidator(data);
                    validationErrors = locationValidator.errors;
                    usedSchemaId = CONTENT_TYPE_SCHEMAS.locations;
                    entityType = 'Location';
                } else if (isItem) {
                    // Validate against Item schema
                    isValid = itemValidator(data);
                    validationErrors = itemValidator.errors;
                    usedSchemaId = CONTENT_TYPE_SCHEMAS.items;
                    entityType = 'Item';
                } else {
                    // Validate against base Entity schema
                    isValid = entityValidator(data);
                    validationErrors = entityValidator.errors;
                    usedSchemaId = CONTENT_TYPE_SCHEMAS.entities;
                    entityType = 'Entity';
                }

                if (!isValid) {
                    const errorDetailsString = JSON.stringify(validationErrors, null, 2);
                    console.error(`Schema validation failed for ${path} (type: ${entityType}) using schema ${usedSchemaId}. Errors:\n`, validationErrors); // Log the detailed errors object
                    throw new Error(`Schema validation failed for ${path} (type: ${entityType}) using schema ${usedSchemaId}:\n${errorDetailsString}`); // Include details string in error message
                }

                // Store the validated data
                if (targetMap.has(data.id)) {
                    console.warn(`DataManager: Duplicate ID detected for ${typeName}: ${data.id} in ${filename}. Overwriting previous definition.`);
                }
                targetMap.set(data.id, data);
                // console.log(`DataManager: Validated and stored <span class="math-inline">\{typeName\} \(</span>{entityType}): ${data.id}`);

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate ${path}`, error);
                throw error; // Propagate error up
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
        const filenames = CONTENT_FILES.triggers; // Expecting only one file usually
        const targetMap = this.triggers;
        const schemaId = CONTENT_TYPE_SCHEMAS.triggers;

        const validator = this.ajv.getSchema(schemaId);
        if (!validator) {
            throw new Error(`DataManager: Schema ${schemaId} not found for validating ${typeName}.`);
        }

        const filePromises = filenames.map(async (filename) => {
            const path = `${BASE_DATA_PATH}/${typeName}/${filename}`;
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${path}`);
                }
                // Expecting an array of triggers in the file
                const triggerArray = await response.json();

                // Validate the entire array against the schema
                const isValid = validator(triggerArray);
                if (!isValid) {
                    const errorDetails = JSON.stringify(validator.errors, null, 2);
                    throw new Error(`Schema validation failed for trigger array in ${path}:\n${errorDetails}`);
                }

                // Store each individual trigger object from the array, keyed by its ID
                for (const triggerData of triggerArray) {
                    if (!triggerData.id) {
                        throw new Error(`Trigger object in ${path} is missing required 'id' property.`);
                    }
                    if (targetMap.has(triggerData.id)) {
                        console.warn(`DataManager: Duplicate ID detected for ${typeName}: ${triggerData.id} in ${filename}. Overwriting previous definition.`);
                    }
                    targetMap.set(triggerData.id, triggerData);
                    //  console.log(`DataManager: Validated and stored ${typeName}: ${triggerData.id}`);
                }

            } catch (error) {
                console.error(`DataManager: Failed to load, parse, or validate ${path}`, error);
                throw error; // Propagate error up
            }
        });

        await Promise.all(filePromises);
        console.log(`DataManager: Finished loading ${targetMap.size} ${typeName}.`);
    }

    // --- Public Accessor Methods ---

    getAction(id) {
        return this.actions.get(id);
    }

    getEntityDefinition(id) { // This now correctly searches the unified map
        return this.entities.get(id);
    }

    getTrigger(id) {
        return this.triggers.get(id);
    }

    getAllTriggers() {
        return Array.from(this.triggers.values());
    }

    // --- Helper Methods ---

    _logLoadedCounts() {
        console.log("DataManager Load Summary:");
        console.log(`  - Actions: ${this.actions.size}`);
        console.log(`  - Entities/Items/Locations: ${this.entities.size}`);
        console.log(`  - Triggers: ${this.triggers.size}`);
    }
}

export default DataManager;