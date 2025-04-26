// src/core/interfaces/coreServices.js

/**
 * @fileoverview Defines JSDoc typedefs for core service interfaces,
 * promoting dependency injection and loose coupling. These types define
 * the expected shape of objects implementing these responsibilities,
 * replacing direct dependencies on a monolithic GameDataRepository.
 */

// --- Data Fetching ---

/**
 * Interface for fetching raw data from a source (e.g., file system, network).
 * @typedef {object} IDataFetcher
 * @property {(identifier: string) => Promise<any>} fetch
 * Fetches data identified by the given string (e.g., path, URL).
 * The promise should resolve with the fetched data (e.g., string, object, ArrayBuffer).
 * Implementations should handle basic fetch errors (network, HTTP status) and potentially JSON parsing errors, logging them and throwing appropriate errors.
 */

// --- Schema Validation ---

/**
 * Represents the result of a data validation against a schema.
 * @typedef {object} ValidationResult
 * @property {boolean} isValid Indicates if the data passed validation.
 * @property {any[] | null} errors An array of validation error objects if `isValid` is false, otherwise null.
 */

/**
 * Interface for managing and using JSON schemas for validation.
 * @typedef {object} ISchemaValidator
 * @property {(schemaData: object, schemaId: string) => Promise<void>} addSchema
 * Adds a JSON schema object to the validator instance, associating it with the given schema ID (typically the `$id`).
 * The promise resolves when the schema is successfully added and potentially compiled/prepared for validation.
 * @property {(schemaId: string) => ((data: any) => ValidationResult) | undefined} getValidator
 * Retrieves a validation function for the specified schema ID.
 * The returned function takes data as input and returns a `ValidationResult`.
 * Returns `undefined` if no schema with the given ID is loaded or compiled.
 * @property {(schemaId: string) => boolean} isSchemaLoaded
 * Checks if a schema with the specified ID has been successfully loaded and is ready for use.
 * @property {(schemaId: string, data: any) => ValidationResult} validate
 * Directly validates the provided data against the schema identified by `schemaId`.
 * Returns a `ValidationResult` object indicating success or failure, including any validation errors.
 * Returns a failure result if the schema itself is not found or invalid.
 */

// --- Data Storage & Registry ---

/**
 * Interface for storing, retrieving, and managing loaded game data definitions (like entities, items, actions)
 * and the world manifest. Acts as an in-memory cache/registry.
 * @typedef {object} IDataRegistry
 * @property {(type: string, id: string, data: object) => void} store
 * Stores a data object under a specific category (`type`) and unique identifier (`id`).
 * @property {(type: string, id: string) => object | undefined} get
 * Retrieves a specific data object by its type and ID. Returns `undefined` if not found.
 * @property {(type: string) => object[]} getAll
 * Retrieves all data objects belonging to a specific type. Returns an empty array if the type is unknown or has no data.
 * @property {() => object[]} getAllSystemRules
 * Retrieves all loaded system rule objects. Returns an empty array `[]` if no system rules are stored. (Added for RULESYS-101)
 * @property {() => void} clear
 * Removes all stored data objects and the manifest from the registry. Typically used when loading a new world or resetting state.
 * @property {() => object | null} getManifest
 * Retrieves the currently loaded world manifest object. Returns `null` if no manifest is loaded.
 * @property {(data: object) => void} setManifest
 * Stores the world manifest object.
 * // --- Specific Getters (Added for REFACTOR-014 / TICKET-11) ---
 * @property {(id: string) => object | undefined} getEntityDefinition Retrieves a definition classified as an 'entity'.
 * @property {(id: string) => object | undefined} getItemDefinition Retrieves a definition classified as an 'item'.
 * @property {(id: string) => object | undefined} getLocationDefinition Retrieves a definition classified as a 'location'.
 * @property {(id: string) => object | undefined} getConnectionDefinition Retrieves a definition classified as a 'connection'.
 * @property {(id: string) => object | undefined} getBlockerDefinition Retrieves a definition classified as a 'blocker'.
 * @property {(id: string) => object | undefined} getActionDefinition Retrieves a definition classified as an 'action'.
 * @property {(id: string) => object | undefined} getEventDefinition Retrieves a definition classified as an 'event'.
 * @property {(id: string) => object | undefined} getComponentDefinition Retrieves a definition classified as a 'component'.
 * @property {() => object[]} getAllEntityDefinitions Retrieves all 'entity' definitions.
 * @property {() => object[]} getAllItemDefinitions Retrieves all 'item' definitions.
 * @property {() => object[]} getAllLocationDefinitions Retrieves all 'location' definitions.
 * @property {() => object[]} getAllConnectionDefinitions Retrieves all 'connection' definitions.
 * @property {() => object[]} getAllBlockerDefinitions Retrieves all 'blocker' definitions.
 * @property {() => object[]} getAllActionDefinitions Retrieves all 'action' definitions.
 * @property {() => object[]} getAllEventDefinitions Retrieves all 'event' definitions.
 * @property {() => object[]} getAllComponentDefinitions Retrieves all 'component' definitions.
 * // --- Manifest Specific Data (Added for REFACTOR-014 / TICKET-11) ---
 * @property {() => string | null} getStartingPlayerId Retrieves the starting player ID from the manifest.
 * @property {() => string | null} getStartingLocationId Retrieves the starting location ID from the manifest.
 */

// --- Logging ---

/**
 * Interface for a logging service, providing different levels for messages.
 * Allows decoupling the core logic from specific console or file logging implementations.
 * @typedef {object} ILogger
 * @property {(message: string, ...args: any[]) => void} info
 * Logs an informational message. `args` can contain additional data/objects to be logged.
 * @property {(message: string, ...args: any[]) => void} warn
 * Logs a warning message. `args` can contain additional data/objects to be logged.
 * @property {(message: string, ...args: any[]) => void} error
 * Logs an error message. `args` can contain additional data/objects to be logged.
 * @property {(message: string, ...args: any[]) => void} debug
 * Logs a debug message (often filtered out in production builds). `args` can contain additional data/objects to be logged.
 */

// --- Configuration Access ---

/**
 * Interface for accessing configuration values related to data loading and structure.
 * This isolates the core logic from hardcoded paths and settings.
 * @typedef {object} IConfiguration
 * @property {() => string} getBaseDataPath
 * Returns the root path where all game data (worlds, schemas, content) is located.
 * @property {() => string[]} getSchemaFiles
 * Returns a list of schema filenames that should be loaded.
 * @property {(typeName: string) => string | undefined} getContentTypeSchemaId
 * Returns the schema ID (e.g., the `$id` value) associated with a given content type name (like 'entities', 'items', 'actions').
 * Returns `undefined` if the type name has no associated schema ID configured.
 * @property {() => string} getSchemaBasePath
 * Returns the path (often relative to the `baseDataPath`) where schema files are stored.
 * @property {(typeName: string) => string} getContentBasePath
 * Returns the path (often relative to the `baseDataPath`) where content definition files for a specific type (e.g., 'items', 'actions') are stored.
 * @property {() => string} getWorldBasePath
 * Returns the path (often relative to the `baseDataPath`) where world manifest files (`.world.json`) are stored.
 * @property {() => string} getGameConfigFilename // <<< ADDED for GameConfigLoader
 * Returns the filename (e.g., 'game.json') for the main game configuration file.
 * @property {() => string} getModsBasePath // <<< ADDED for MODLOADER-003
 * Returns the path (often relative to baseDataPath) where mod subdirectories are located.
 * @property {() => string} getModManifestFilename // <<< ADDED for MODLOADER-003
 * Returns the standard filename for a mod manifest file (e.g., 'mod.manifest.json').
 */

// --- Path Resolution ---

/**
 * Interface for resolving abstract identifiers or relative paths into absolute, fetchable paths/URLs.
 * Combines configuration values (like base paths) with specific filenames.
 * @typedef {object} IPathResolver
 * @property {(filename: string) => string} resolveSchemaPath
 * Takes a schema filename (e.g., 'common.schema.json') and returns the full path needed to fetch it.
 * @property {(worldName: string) => string} resolveManifestPath
 * Takes a world name (e.g., 'demo') and returns the full path needed to fetch its corresponding manifest file (e.g., 'data/worlds/demo.world.json').
 * @property {(typeName: string, filename: string) => string} resolveContentPath
 * Takes a content type (e.g., 'items') and a filename (e.g., 'potion.json') and returns the full path needed to fetch that content definition file.
 * @property {() => string} resolveGameConfigPath // <<< ADDED for GameConfigLoader
 * Returns the full path needed to fetch the main game configuration file (e.g., './game.json' or 'data/game.json').
 */


// --- Spatial Indexing ---
/**
 * @typedef {import('../entities/entityManager.js').default} EntityManager
 */

/**
 * Interface for managing a spatial index of entities based on their location.
 * Allows efficient querying of entities within a specific location.
 * @typedef {object} ISpatialIndexManager
 * @property {(entityId: string, locationId: string | null | undefined) => void} addEntity
 * Adds or updates an entity's presence in the index for a given location.
 * Handles cases where locationId is null or undefined (entity might be nowhere).
 * @property {(entityId: string, oldLocationId: string | null | undefined) => void} removeEntity
 * Removes an entity from the index, potentially specifying its previous location for efficiency.
 * Handles cases where oldLocationId is null or undefined.
 * @property {(entityId: string, oldLocationId: string | null | undefined, newLocationId: string | null | undefined) => void} updateEntityLocation
 * Updates an entity's location from an old location to a new one. This is often more efficient
 * than separate remove and add calls. Handles null/undefined for both old and new locations.
 * @property {(locationId: string) => Set<string>} getEntitiesInLocation
 * Retrieves a set of all entity IDs currently registered in the specified location.
 * Returns an empty set if the location is not found or has no entities.
 * @property {(entityManager: EntityManager) => void} buildIndex
 * Builds or rebuilds the entire spatial index based on the current state of entities
 * provided by the EntityManager. Typically called during initialization.
 * @property {() => void} clearIndex
 * Clears all entries from the spatial index.
 */


// --- Boilerplate to make this a module ---
// This prevents JSDoc types from potentially polluting the global scope in some environments
// and clearly marks the file as a module.
export {};