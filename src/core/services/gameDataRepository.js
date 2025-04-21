// src/core/services/gameDataRepository.js

/**
 * @fileoverview Provides access to loaded game data stored within an IDataRegistry.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger // Assuming logger might be useful
 *
 * // Add specific type imports for your game data definitions if using TS/JSDoc extensively
 * // Assuming these paths might be slightly different based on project structure
 * @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition
 * @typedef {import('../../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition // Adjust if schema name differs
 * @typedef {import('../../../data/schemas/connection.schema.json').ConnectionDefinition} ConnectionDefinition // Adjust if schema name differs
 * @typedef {import('../../../data/schemas/blocker.schema.json').BlockerDefinition} BlockerDefinition // Assuming a blocker schema exists
 * @typedef {import('../../../data/schemas/trigger.schema.json').TriggerDefinition} TriggerDefinition // Adjust if schema name differs
 * @typedef {import('../../../data/schemas/quest.schema.json').QuestDefinition} QuestDefinition
 * @typedef {import('../../../data/schemas/objective.schema.json').ObjectiveDefinition} ObjectiveDefinition
 * @typedef {import('../../../data/schemas/interaction-test.schema.json').InteractionTestDefinition} InteractionTestDefinition // Adjust if schema name differs
 * @typedef {object} WorldManifest // Define structure if possible
 *
 **/

// --- EVENT-MIGR-010 Start: Add EventDefinition typedef ---
/**
 * Represents the structure of a loaded event definition.
 * Matches the structure defined in event-definition.schema.json.
 * @typedef {object} EventDefinition
 * @property {string} id - The unique, namespaced identifier for this event type (e.g., 'event:apply_heal_requested'). Required.
 * @property {string} [description] - Optional. A human-readable explanation of what this event signifies.
 * @property {object | null} [payloadSchema] - Optional. A JSON Schema object defining the structure of the data payload associated with this event. Null or omitted if no payload.
 */

// --- EVENT-MIGR-010 End ---

/**
 * Provides typed access to loaded game data stored within an IDataRegistry.
 * This class separates data access concerns from data loading (WorldLoader) and raw storage (IDataRegistry).
 * It expects the data to be already loaded into the registry.
 *
 * Note: This implementation assumes specific type names ('actions', 'items', etc.) used when storing data in the registry.
 */
export class GameDataRepository {
    /**
     * The injected data registry holding all game data.
     * @private
     * @type {IDataRegistry}
     */
    #registry;
    /**
     * Optional logger instance.
     * @private
     * @type {ILogger | null}
     */
    #logger;

    /**
     * Creates an instance of GameDataRepository.
     * @param {IDataRegistry} registry - The data registry instance holding the loaded game data.
     * @param {ILogger} [logger] - Optional logger instance for warnings/debug messages.
     * @throws {Error} If a valid registry instance is not provided.
     */
    constructor(registry, logger = null) {
        // AC: Constructor accepts an IDataRegistry instance.
        // Perform a basic check to ensure a valid registry-like object is passed
        if (!registry || typeof registry.get !== 'function' || typeof registry.getAll !== 'function' || typeof registry.getManifest !== 'function') {
            // AC: Constructor throws an error if the registry is invalid.
            throw new Error("GameDataRepository requires a valid IDataRegistry instance.");
        }
        // AC: Constructor stores the registry instance internally.
        this.#registry = registry;
        this.#logger = logger;
    }

    /**
     * Retrieves an action definition by its ID.
     * @param {string} id - The unique ID of the action.
     * @returns {ActionDefinition | undefined} The action definition or undefined if not found.
     */
    getAction(id) {
        // AC: getAction calls registry.get('actions', id).
        // Type cast might be needed/useful if using TypeScript or detailed JSDoc
        return this.#registry.get('actions', id); // e.g., as ActionDefinition | undefined;
    }

    /**
     * Retrieves all loaded entity definitions.
     * @returns {EntityDefinition[]} An array of all entity definitions. Might be empty.
     */
    getAllEntityDefinitions() {
        return this.#registry.getAll('entities'); // e.g., as EntityDefinition[];
    }

    /**
     * Retrieves all loaded item definitions.
     * @returns {ItemDefinition[]} An array of all item definitions. Might be empty.
     */
    getAllItemDefinitions() {
        return this.#registry.getAll('items'); // e.g., as ItemDefinition[];
    }

    /**
     * Retrieves an entity definition (character, item, location, connection, blocker) by its ID.
     * Checks multiple types as potentially stored separately in the registry.
     * The order reflects a potential lookup priority if IDs could overlap (though unlikely).
     * @param {string} id - The unique ID of the entity definition.
     * @returns {EntityDefinition | ItemDefinition | LocationDefinition | ConnectionDefinition | BlockerDefinition | object | undefined} The definition object or undefined if not found across relevant types.
     */
    getEntityDefinition(id) {
        // AC: getEntityDefinition calls registry.get for relevant types ('entities', 'items', etc.).
        // Adjust types based on actual registry storage keys used during loading
        // The order might matter if IDs could overlap, but typically they shouldn't.
        const definition = this.#registry.get('entities', id) ?? // Player/NPC Character types
            this.#registry.get('items', id) ??
            this.#registry.get('locations', id) ??
            this.#registry.get('connections', id) ??
            this.#registry.get('blockers', id); // Specific blocker types

        // AC: getEntityDefinition returns the first found definition or undefined.
        if (!definition && this.#logger) {
            // Optional: Log if an ID is not found across all types
            // this.#logger.debug(`GameDataRepository: Entity definition not found for ID '${id}' across standard types.`);
        }
        return definition;
    }

    /**
     * Retrieves a trigger definition by its ID.
     * @param {string} id - The unique ID of the trigger.
     * @returns {TriggerDefinition | undefined} The trigger definition or undefined if not found.
     */
    getTrigger(id) {
        // AC: getTrigger calls registry.get('triggers', id).
        return this.#registry.get('triggers', id); // e.g., as TriggerDefinition | undefined;
    }

    /**
     * Retrieves all loaded trigger definitions.
     * @returns {TriggerDefinition[]} An array of all trigger definitions. Might be empty.
     */
    getAllTriggers() {
        // AC: getAllTriggers calls registry.getAll('triggers').
        return this.#registry.getAll('triggers'); // e.g., as TriggerDefinition[];
    }

    /**
     * Retrieves all loaded action definitions.
     * @returns {ActionDefinition[]} An array of all action definitions. Might be empty.
     */
    getAllActionDefinitions() {
        return this.#registry.getAll('actions');
    }

    /**
     * Retrieves a quest definition by its ID.
     * @param {string} questId - The unique ID of the quest.
     * @returns {QuestDefinition | undefined} The quest definition or undefined if not found.
     */
    getQuestDefinition(questId) {
        // AC: getQuestDefinition calls registry.get('quests', questId).
        return this.#registry.get('quests', questId); // e.g., as QuestDefinition | undefined;
    }

    /**
     * Retrieves all loaded quest definitions.
     * @returns {QuestDefinition[]} An array of all quest definitions.
     */
    getAllQuestDefinitions() {
        // AC: getAllQuestDefinitions calls registry.getAll('quests').
        return this.#registry.getAll('quests'); // e.g., as QuestDefinition[];
    }

    /**
     * Retrieves an objective definition by its ID.
     * @param {string} objectiveId - The unique ID of the objective.
     * @returns {ObjectiveDefinition | undefined} The objective definition or undefined if not found.
     */
    getObjectiveDefinition(objectiveId) {
        // AC: getObjectiveDefinition calls registry.get('objectives', objectiveId).
        return this.#registry.get('objectives', objectiveId); // e.g., as ObjectiveDefinition | undefined;
    }

    /**
     * Retrieves an interaction test definition by its ID.
     * @param {string} id - The unique ID of the interaction test.
     * @returns {InteractionTestDefinition | undefined} The interaction test definition or undefined if not found.
     */
    getInteractionTest(id) {
        // AC: getInteractionTest calls registry.get('interactionTests', id).
        return this.#registry.get('interactionTests', id); // e.g., as InteractionTestDefinition | undefined;
    }

    // --- Manifest Data Accessors ---

    // --- EVENT-MIGR-010 Start: Add Event Definition Accessors ---

    /**
     * Retrieves an event definition by its ID.
     * Relies on event definitions being loaded into the registry under the 'events' key.
     * @param {string} eventId - The unique ID of the event definition (e.g., 'event:some_event').
     * @returns {EventDefinition | undefined} The event definition or undefined if not found.
     * @fulfills {AC1} - GameDataRepository class has the getEventDefinition method.
     * @fulfills {AC3} - Method correctly retrieves data from the IDataRegistry using the key 'events'.
     */
    getEventDefinition(eventId) {
        return this.#registry.get('events', eventId);
    }

    /**
     * Retrieves all loaded event definitions.
     * Relies on event definitions being loaded into the registry under the 'events' key.
     * @returns {EventDefinition[]} An array of all loaded event definitions. Might be empty.
     * @fulfills {AC2} - GameDataRepository class has the getAllEventDefinitions method.
     * @fulfills {AC3} - Method correctly retrieves data from the IDataRegistry using the key 'events'.
     */
    getAllEventDefinitions() {
        return this.#registry.getAll('events');
    }

    // --- EVENT-MIGR-010 End ---

    /**
     * Gets the starting player ID defined in the world manifest.
     * @returns {string | null} The player ID or null if not defined/loaded.
     */
    getStartingPlayerId() {
        // AC: getStartingPlayerId calls registry.getManifest().
        const manifest = this.#registry.getManifest();
        // AC: getStartingPlayerId returns manifest.startingPlayerId or null.
        return manifest?.startingPlayerId ?? null;
    }

    /**
     * Gets the starting location ID defined in the world manifest.
     * @returns {string | null} The location ID or null if not defined/loaded.
     */
    getStartingLocationId() {
        // AC: getStartingLocationId calls registry.getManifest().
        const manifest = this.#registry.getManifest();
        // AC: getStartingLocationId returns manifest.startingLocationId or null.
        return manifest?.startingLocationId ?? null;
    }

    /**
     * Retrieves all loaded location definitions.
     * @returns {LocationDefinition[]} An array of all location definitions.
     */
    getAllLocationDefinitions() {
        return this.#registry.getAll('locations'); // e.g., as LocationDefinition[];
    }

    /**
     * Retrieves all loaded connection definitions.
     * @returns {ConnectionDefinition[]} An array of all connection definitions. Might be empty.
     */
    getAllConnectionDefinitions() {
        return this.#registry.getAll('connections'); // e.g., as ConnectionDefinition[];
    }

    /**
     * Retrieves all loaded blocker definitions.
     * @returns {BlockerDefinition[]} An array of all blocker definitions. Might be empty.
     */
    getAllBlockerDefinitions() {
        return this.#registry.getAll('blockers'); // e.g., as BlockerDefinition[];
    }


    /**
     * Gets the world name defined in the world manifest.
     * @returns {string | null} The world name or null if not defined/loaded.
     */
    getWorldName() {
        // AC: getWorldName calls registry.getManifest().
        const manifest = this.#registry.getManifest();
        // This repository doesn't track the loading context like #currentWorldName in GameDataRepository
        // It relies purely on the loaded manifest data in the registry.
        // AC: getWorldName returns manifest.worldName or null.
        return manifest?.worldName ?? null; // Assumes manifest schema includes worldName
    }

    // Add any other identified accessor methods here if discovered during Task step...
    // E.g., retrieving specific content types like locations, items directly if needed
    // /**
    //  * Retrieves a location definition by its ID.
    //  * @param {string} id - The unique ID of the location.
    //  * @returns {LocationDefinition | undefined} The location definition or undefined if not found.
    //  */
    // getLocation(id) {
    //     return this.#registry.get('locations', id);
    // }

    // /**
    //  * Retrieves an item definition by its ID.
    //  * @param {string} id - The unique ID of the item.
    //  * @returns {ItemDefinition | undefined} The item definition or undefined if not found.
    //  */
    // getItem(id) {
    //     return this.#registry.get('items', id);
    // }
}

// AC: gameDataRepository.js exists and exports the GameDataRepository class.
// Choose default or named export based on your project's conventions
// export default GameDataRepository; // If default is preferred