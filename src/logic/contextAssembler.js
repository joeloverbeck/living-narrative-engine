// src/logic/contextAssembler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./defs.js').GameEvent} GameEvent */ // Assuming GameEvent is defined here or adjust path
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('./defs.js').JsonLogicEntityContext} JsonLogicEntityContext */

/** @typedef {string | number | null | undefined} EntityId */

/**
 * Creates a proxy-like object to dynamically access component data for a given entity.
 * When a property (componentTypeId) is accessed on this object, it uses the
 * EntityManager to fetch the actual component data. Returns null if the component
 * does not exist on the entity.
 *
 * Note: This uses dynamic property definition with getters to simulate the
 * dynamic lookup described in the JsonLogicEntityContext JSDoc without needing
 * a full ES6 Proxy (which might be overkill or have compatibility concerns).
 * JSON Logic typically accesses specific, known properties, making this approach viable.
 *
 * @param {string | number} entityId - The ID of the entity whose components are accessed.
 * @param {EntityManager} entityManager - The EntityManager instance to use for data fetching.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {Object<string, object|null>} An object that allows dynamic fetching of component data.
 */
export function createComponentAccessor(entityId, entityManager, logger) {
    // *** Revised Approach: Use a Proxy for true dynamic access ***
    return new Proxy({}, {
        // --- GET Trap (Correct logic + Optional Logging) ---
        get: function (target, prop, receiver) {
            // <<<--- ADD TEMPORARY LOGGING HERE --->>>
            console.log(`!!! ComponentAccessor GET Trap: EntityID=${entityId}, Prop=${String(prop)}`);
            // <<<------------------------------------>>>
            if (typeof prop === 'string') {
                if (prop === 'isProxy' || prop === 'then' || typeof prop === 'symbol') {
                    // console.log(`!!! ComponentAccessor GET Trap: Skipping special prop ${String(prop)}`);
                    return undefined;
                }
                logger.debug(`ComponentAccessor: GET trap for prop [${String(prop)}] on entity [${entityId}]`);
                try {
                    // <<<--- ADD TEMPORARY LOGGING HERE --->>>
                    console.log(`!!! ComponentAccessor GET Trap: Calling getComponentData(${entityId}, ${String(prop)})`);
                    // <<<------------------------------------>>>
                    const componentData = entityManager.getComponentData(entityId, prop);
                    // console.log(`!!! ComponentAccessor GET Trap: Data for ${String(prop)}:`, componentData); // Be careful logging potentially large objects
                    return componentData ?? null; // Return data or null
                } catch (error) {
                    logger.error(`ComponentAccessor: Error fetching component [${String(prop)}] for entity [${entityId}]:`, error);
                    return null;
                }
            }
            // console.log(`!!! ComponentAccessor GET Trap: Reflect.get for non-string prop ${String(prop)}`);
            return Reflect.get(target, prop, receiver);
        },

        set: function (target, prop, value) {
            // (Your existing set trap is fine)
            logger.warn(`ComponentAccessor: Attempted to set property [${String(prop)}] on read-only accessor for entity [${entityId}]. Operation ignored.`);
            return false;
        },

        // --- HAS Trap (Corrected Logic) ---
        has: function (target, prop) {
            if (typeof prop === 'string') {
                // --- Correct logic for 'has' trap ---
                logger.debug(`ComponentAccessor: HAS trap for prop [${String(prop)}] on entity [${entityId}]`);
                try {
                    // Check existence using the correct EntityManager method
                    const exists = entityManager.hasComponent(entityId, prop);
                    logger.debug(`ComponentAccessor: Existence check for [${String(prop)}]: ${exists}`);
                    return exists; // Return boolean
                } catch (error) {
                    logger.error(`ComponentAccessor: Error checking component existence [${String(prop)}] for entity [${entityId}]:`, error);
                    return false; // Return false on error
                }
            }
            // Fallback for non-string properties
            return Reflect.has(target, prop);
        },

        // --- OWNKEYS Trap (Existing logic is likely okay) ---
        ownKeys: function (target) {
            logger.debug(`ComponentAccessor: ownKeys trap invoked for entity [${entityId}]. Returning empty array.`);
            return []; // Returning empty is often safest unless full enumeration is needed
        },

        // --- GETOWNPROPERTYDESCRIPTOR Trap (Relies on the now-fixed 'has' trap) ---
        getOwnPropertyDescriptor: function (target, prop) {
            // Now that 'this.has' is fixed, this *might* work correctly.
            // It attempts to create a descriptor if the component exists.
            if (typeof prop === 'string' && this.has(target, prop)) { // 'this.has' now returns boolean
                logger.debug(`ComponentAccessor: getOwnPropertyDescriptor trap for existing prop [${String(prop)}]`);
                return {
                    // Using 'get' trap ensures consistency if data fetching is complex
                    get: () => this.get(target, prop, null),
                    set: undefined, // Read-only
                    enumerable: true, // Important for introspection
                    configurable: true // Usually true for proxy properties
                };
            }
            logger.debug(`ComponentAccessor: getOwnPropertyDescriptor trap for non-string or non-existent prop [${String(prop)}]`);
            // Fallback for non-string or non-existent properties
            return Reflect.getOwnPropertyDescriptor(target, prop);
        }
    });
}


/**
 * Assembles the data context object (`JsonLogicEvaluationContext`) needed for
 * evaluating JSON Logic rules within the system.
 *
 * @param {GameEvent} event - The triggering game event object.
 * @param {EntityId} actorId - The ID of the entity considered the 'actor' for this event, if applicable.
 * @param {EntityId} targetId - The ID of the entity considered the 'target' for this event, if applicable.
 * @param {EntityManager} entityManager - The EntityManager instance for retrieving entity data.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {JsonLogicEvaluationContext} The assembled data context object.
 * @throws {Error} If required arguments like event, entityManager, or logger are missing.
 */
export function createJsonLogicContext(event, actorId, targetId, entityManager, logger) {
    // --- Argument Validation ---
    if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
        throw new Error("createJsonLogicContext: Missing or invalid 'event' object.");
    }
    if (!entityManager || typeof entityManager.getComponentData !== 'function' || typeof entityManager.getEntityInstance !== 'function') {
        throw new Error("createJsonLogicContext: Missing or invalid 'entityManager' instance.");
    }
    if (!logger || typeof logger.debug !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
        throw new Error("createJsonLogicContext: Missing or invalid 'logger' instance.");
    }

    logger.debug(`Creating JsonLogicEvaluationContext for event type [${event.type}]. ActorID: [${actorId ?? 'None'}], TargetID: [${targetId ?? 'None'}]`);

    // --- Initialize Context Object ---
    /** @type {JsonLogicEvaluationContext} */
    const evaluationContext = {
        event: { // AC.3: Populate event property
            type: event.type,
            payload: event.payload || {} // Ensure payload is at least an empty object
        },
        actor: null,  // Initialize as null
        target: null, // Initialize as null
        context: {},  // AC.6: Initialize context as an empty object
        globals: {},  // AC.7: Initialize globals placeholder
        entities: {}  // AC.7: Initialize entities placeholder (if needed later)
    };

    // --- Populate Actor --- (AC.4, AC.5, AC.9)
    if (actorId && (typeof actorId === 'string' || typeof actorId === 'number')) {
        try {
            // Note: EntityManager.getEntityInstance might not be strictly necessary
            // if JsonLogicEntityContext only needs the ID and the component accessor,
            // but checking existence first is safer.
            const actorEntity = entityManager.getEntityInstance(actorId);
            if (actorEntity) {
                logger.debug(`Found actor entity [${actorId}]. Creating context entry.`);
                evaluationContext.actor = {
                    id: actorEntity.id, // Use the actual ID from the entity instance
                    components: createComponentAccessor(actorEntity.id, entityManager, logger)
                };
            } else {
                logger.warn(`Actor entity not found for ID [${actorId}]. Setting actor context to null.`);
            }
        } catch (error) {
            throw error;
        }
    } else if (actorId) {
        logger.warn(`Invalid actorId type provided: [${typeof actorId}]. Setting actor context to null.`);
    }

    // --- Populate Target --- (AC.4, AC.5, AC.9)
    if (targetId && (typeof targetId === 'string' || typeof targetId === 'number')) {
        try {
            // <<<--- ADD LOG 1 --->>>
            console.log(`!!! contextAssembler: Attempting to find target entity. ID = ${targetId}`);
            const targetEntity = entityManager.getEntityInstance(targetId);
            // <<<--- ADD LOG 2 --->>>
            console.log(`!!! contextAssembler: Result of getEntityInstance(targetId):`, targetEntity ? `Found (ID: ${targetEntity.id})` : 'NOT Found (null/undefined)');

            if (targetEntity) {
                logger.debug(`Found target entity [${targetId}]. Creating context entry.`);
                // <<<--- ADD LOG 3 --->>>
                console.log(`!!! contextAssembler: Calling createComponentAccessor for target ID: ${targetEntity.id}`);
                const componentsProxy = createComponentAccessor(targetEntity.id, entityManager, logger);
                // <<<--- ADD LOG 4 --->>>
                // Check if it's actually a proxy (might log {} or Proxy {})
                console.log(`!!! contextAssembler: Result of createComponentAccessor:`, componentsProxy);

                evaluationContext.target = {
                    id: targetEntity.id,
                    components: componentsProxy // Assign the proxy
                };
                // <<<--- ADD LOG 5 --->>>
                console.log(`!!! contextAssembler: Assigned target to evaluationContext:`, evaluationContext.target);

            } else {
                // <<<--- ADD LOG 6 --->>>
                console.log(`!!! contextAssembler: Target entity NOT found, target context will be null.`);
                logger.warn(`Target entity not found for ID [${targetId}]. Setting target context to null.`);
                // evaluationContext.target remains null
            }
        } catch (error) {
            // <<<--- ADD LOG 7 --->>>
            console.log(`!!! contextAssembler: ERROR during target processing for ID ${targetId}:`, error);
            throw error;
        }
    } else if (targetId) {
        // <<<--- ADD LOG 8 --->>>
        console.log(`!!! contextAssembler: Invalid targetId type: ${typeof targetId}. Target context will be null.`);
        logger.warn(`Invalid targetId type provided: [${typeof targetId}]. Setting target context to null.`);
        // evaluationContext.target remains null
    } else {
        // <<<--- ADD LOG 9 --->>>
        console.log(`!!! contextAssembler: No targetId provided. Target context is null.`);
        // evaluationContext.target remains null
    }

    logger.debug("JsonLogicEvaluationContext assembled successfully.");
    return evaluationContext;
}