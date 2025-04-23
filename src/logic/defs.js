/**
 * @typedef {object} JsonLogicEntityContext
 * Represents the data context for a relevant entity (like actor or target)
 * provided to the JSON Logic engine when evaluating SystemRule conditions.
 * Provides access to the entity's ID and its component data. Properties within
 * `components` resolve to null if the component is not present on the entity,
 * ensuring predictable behavior with the JSON Logic `var` operator.
 *
 * @property {string | number} id - The unique identifier of the entity, retrieved from the Entity instance.
 * @property {Object<string, object|null>} components - A map-like structure providing access to the entity's
 * component data. Keys are Component Type IDs (e.g., "Health", "Position").
 * Accessing a key (e.g., `actor.components.Health`) dynamically retrieves the
 * raw component data object using `EntityManager.getComponentData(entityId, componentTypeId)`.
 * It yields the data object if the entity has that component, or null otherwise[cite: 467].
 * Deep access (e.g., `actor.components.Health.current`) will resolve correctly if the
 * component and property exist. If the component (`Health`) is missing, accessing `.current`
 * on the resulting null behaves as expected in JSON Logic (typically resolving to null).
 * If the component exists but the property (`current`) is missing from the data object,
 * accessing it yields `undefined`, which JSON Logic also handles predictably (typically resolving to null).
 */

/**
 * @typedef {object} JsonLogicEvaluationContext
 * The data object provided to the JSON Logic evaluation engine when processing
 * a SystemRule condition or an IF operation's condition[cite: 435]. This object aggregates
 * all necessary contextual information required for the condition logic.
 *
 * @property {object} event - Information about the triggering event[cite: 435].
 * @property {string} event.type - The namespaced ID of the triggering event (e.g., "ACTION_SUCCESS:MOVE").
 * @property {object} event.payload - The payload object carried by the triggering event. Contents vary by event type.
 *
 * @property {JsonLogicEntityContext | null} actor - Represents the primary entity contextually identified as the 'actor'
 * for this event (e.g., the entity performing an action). Its availability and identity depend
 * on the specific event type and the logic within the SystemLogicInterpreter that assembles this context.
 * Resolves to null if no actor is relevant or identified for the event[cite: 436, 468].
 *
 * @property {JsonLogicEntityContext | null} target - Represents the entity contextually identified as the 'target'
 * for this event (e.g., the entity being acted upon). Its availability and identity depend on the
 * specific event type. Resolves to null if no target is relevant or identified[cite: 436, 468].
 *
 * @property {object} context - Holds temporary variables generated during the execution
 * of the current SystemRule's action sequence[cite: 438, 502]. Primarily populated by the
 * 'result_variable' of QUERY_COMPONENT operations[cite: 466, 505]. Accessing a non-existent
 * variable (e.g., `context.myQuery`) resolves to undefined[cite: 467].
 *
 * @property {object} [globals] - Optional placeholder for future access to global game state
 * variables if needed (e.g., `globals.gameTime`, `globals.worldState.weather`)[cite: 439].
 * Structure TBD if implemented.
 *
 * @property {object} [entities] - Optional placeholder for future direct access to any entity's
 * component data by ID if needed, bypassing contextual `actor`/`target` references.
 * Structure TBD if implemented (e.g., `entities['npc-001'].components.Hostility.level`).
 */