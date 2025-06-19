// src/interfaces/coreServices.js

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */

/**
 * @file Defines JSDoc typedefs for core service interfaces,
 * promoting dependency injection and loose coupling. These types define
 * the expected shape of objects implementing these responsibilities.
 */

// --- Data Fetching ---

/**
 * Interface for fetching raw data from a source (e.g., file system, network).
 *
 * @typedef {object} IDataFetcher
 * @property {(identifier: string) => Promise<any>} fetch
 * Fetches data identified by the given string (e.g., path, URL).
 * The promise should resolve with the fetched data (e.g., string, object, ArrayBuffer).
 * Implementations should handle basic fetch errors (network, HTTP status) and potentially JSON parsing errors, logging them and throwing appropriate errors.
 */

// --- Schema Validation ---

/**
 * Represents the result of a data validation against a schema.
 *
 * @typedef {object} ValidationResult
 * @property {boolean} isValid Indicates if the data passed validation.
 * @property {any[] | null} errors An array of validation error objects if `isValid` is false, otherwise null.
 */

/**
 * Interface for managing and using JSON schemas for validation.
 *
 * @typedef {object} ISchemaValidator
 * @property {(schemaData: object, schemaId: string) => Promise<void>} addSchema
 * Adds a JSON schema object to the validator instance, associating it with the given schema ID (typically the `$id`).
 * @property {(schemaId: string) => boolean} removeSchema
 * Removes a schema from the validator instance using its unique identifier ($id).
 * @property {(schemaId: string) => ((data: any) => ValidationResult) | undefined} getValidator
 * Retrieves a validation function for the specified schema ID.
 * @property {(schemaId: string) => boolean} isSchemaLoaded
 * Checks if a schema with the specified ID has been successfully loaded.
 * @property {(schemaId: string, data: any) => ValidationResult} validate
 * Directly validates the provided data against the schema identified by `schemaId`.
 */

// --- Data Storage & Registry ---

/**
 * Interface for storing, retrieving, and managing loaded game data definitions (like entities, items, actions, components)
 * and the world manifest. Acts as an in-memory cache/registry.
 *
 * **Note on Keys:** For definitions loaded via mods (using loaders like ComponentLoader, ActionLoader, etc.),
 * the `id` used with `store` and `get` methods is expected to be in the fully qualified format: `modId:itemId`.
 * The specific loader implementations are responsible for constructing this key before storing.
 *
 * @typedef {object} IDataRegistry
 * @property {(type: string, id: string, data: object) => void} store
 * Stores a data object under a specific category (`type`) and unique identifier (`id`).
 * @property {(type: string, id: string) => object | undefined} get
 * Retrieves a specific data object by its type and fully qualified ID.
 * @property {(type: string) => object[]} getAll
 * Retrieves all data objects belonging to a specific type.
 * @property {() => object[]} getAllSystemRules
 * Retrieves all loaded system rule objects.
 * @property {() => void} clear
 * Removes all stored data objects and the manifest from the registry.
 * @property {(type: string, id: string) => string | null} [getContentSource]
 * Optional helper to retrieve the mod ID that most recently provided a given
 * content item.
 * @property {(modId: string) => Record<string, string[]>} [listContentByMod]
 * Optional helper that lists all content IDs provided by the specified mod,
 * organized by content type.
 *
 * // --- Specific Getters ---
 * @property {(id: string) => object | undefined} getEntityDefinition Retrieves a definition classified as an 'entity'.
 * @property {(id: string) => object | undefined} getActionDefinition Retrieves a definition classified as an 'action'.
 * @property {(id: string) => object | undefined} getEventDefinition Retrieves a definition classified as an 'event'.
 * @property {(id: string) => object | undefined} getComponentDefinition Retrieves a definition classified as a 'component'.
 * @property {(id: string) => object | undefined} getConditionDefinition Retrieves a definition classified as a 'condition'.
 * @property {(id: string) => object | undefined} getEntityInstanceDefinition Retrieves a definition for an 'entity instance'.
 * @property {() => object[]} getAllEntityDefinitions Retrieves all 'entity' definitions.
 * @property {() => object[]} getAllActionDefinitions Retrieves all 'action' definitions.
 * @property {() => object[]} getAllEventDefinitions Retrieves all 'event' definitions.
 * @property {() => object[]} getAllComponentDefinitions Retrieves all 'component' definitions.
 * @property {() => object[]} getAllConditionDefinitions Retrieves all 'condition' definitions.
 * @property {() => object[]} getAllEntityInstanceDefinitions Retrieves all 'entity instance' definitions.
 *
 * // --- Manifest Specific Data ---
 * @property {() => string | null} getStartingPlayerId Retrieves the starting player ID from the manifest or dynamically.
 * @property {() => string | null} getStartingLocationId Retrieves the starting location ID from the manifest or dynamically.
 */

// --- Logging ---

/**
 * Interface for a logging service, providing different levels for messages.
 * Allows decoupling the core logic from specific console or file logging implementations.
 *
 * @typedef {object} ILogger
 * @property {(message: string, ...args: any[]) => void} info
 * Logs an informational message.
 * @property {(message: string, ...args: any[]) => void} warn
 * Logs a warning message.
 * @property {(message: string, ...args: any[]) => void} error
 * Logs an error message.
 * @property {(message: string, ...args: any[]) => void} debug
 * Logs a debug message.
 */

// --- Configuration Access ---

/**
 * Interface for accessing configuration values related to data loading and structure.
 * This isolates the core logic from hardcoded paths and settings.
 *
 * @typedef {object} IConfiguration
 * @property {() => string} getBaseDataPath
 * Returns the root path where all game data is located.
 * @property {() => string[]} getSchemaFiles
 * Returns a list of schema filenames that should be loaded.
 * @property {(typeName: string) => string | undefined} getContentTypeSchemaId
 * Returns the schema ID associated with a given content type name.
 * @property {() => string} getSchemaBasePath
 * Returns the path where schema files are stored.
 * @property {(typeName: string) => string} getContentBasePath
 * Returns the path where content definition files for a specific type are stored.
 * Returns the path where world manifest files are stored.
 * @property {() => string} getGameConfigFilename
 * Returns the filename for the main game configuration file.
 * @property {() => string} getModsBasePath
 * Returns the path where mod subdirectories are located.
 * @property {() => string} getModManifestFilename
 * Returns the standard filename for a mod manifest file.
 */

// --- Spatial Indexing ---
/** @typedef {import('./ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager */

// --- Boilerplate to make this a module ---
export {};
// --- FILE END ---
